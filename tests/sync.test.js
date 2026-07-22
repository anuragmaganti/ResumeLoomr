import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  createEmptyResume,
  dismissSampleInformation,
  setResumeSettingValue,
  updateSampleDisplay,
} from '../src/lib/resume.js';
import { DEFAULT_TEMPLATE } from '../src/lib/resumeSettings.js';
import {
  mergeWorkspaceOrganizations,
  normalizeWorkspaceIndex,
} from '../src/lib/workspace.js';
import {
  createDraftContentHash,
  createSavedDraftState,
} from '../src/lib/draftState.js';
import { normalizeCloudWorkspaceSnapshot } from '../src/lib/cloudWorkspaceSnapshot.js';
import { mergeLocalAndCloudWorkspaces } from '../src/lib/workspaceReconciliation.js';
import {
  createOutboxAckDescriptor,
  filterOutboxOperationsForAccount,
  outboxOperationBelongsToAccount,
  outboxOperationMatchesAck,
} from '../src/lib/outboxProtocol.js';
import {
  getOperationAcksFromResponse,
  partitionClientSyncOperations,
} from '../src/lib/backgroundSync.js';
import {
  runBrowserDisconnect,
  runBrowserSignOut,
} from '../src/lib/browserAccountLifecycle.js';
import {
  cloudWorkspaceFromDoc,
  createWorkspaceDoc,
  getSyncCursorId,
  mergeCloudWorkspaceForWrite,
  operationBelongsToSyncAccount,
  partitionOversizedSyncOperations,
  partitionSyncOperationsByAccount,
  preservePermanentSampleDismissal,
  shouldAcceptDraftSyncOperation,
  shouldAcceptCloudVersion,
  shouldAcceptSyncOperation,
} from '../server/syncWorkspace.js';
import {
  createDraft,
  createWorkspace,
} from './helpers/resumeFixtures.js';

test('draft content hashes ignore saved time but track content', () => {
  const firstDraft = createDraft('Resume A', '2026-01-01T00:00:00.000Z');
  const secondDraft = {
    ...firstDraft,
    savedAt: '2026-02-01T00:00:00.000Z',
  };
  const thirdDraft = createDraft('Resume B', '2026-02-01T00:00:00.000Z');

  assert.equal(createDraftContentHash(firstDraft), createDraftContentHash(secondDraft));
  assert.notEqual(createDraftContentHash(firstDraft), createDraftContentHash(thirdDraft));
});

test('saved draft state stamps a fresh save time', async () => {
  const oldDraft = createDraft('Fresh Save', '2000-01-01T03:10:00.000Z');
  const beforeSave = Date.now();
  await new Promise((resolve) => setTimeout(resolve, 2));
  const savedDraft = createSavedDraftState(oldDraft);

  assert.ok(Date.parse(savedDraft.savedAt) >= beforeSave);
  assert.notEqual(savedDraft.savedAt, oldDraft.savedAt);

  const blankSavedDraft = createSavedDraftState({
    ...oldDraft,
    savedAt: null,
  });

  assert.match(blankSavedDraft.savedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('cloud workspace snapshots normalize only owned workspace drafts', () => {
  const workspace = createWorkspace(['r1', 'r2'], { activeResumeId: 'r2' });
  const snapshot = normalizeCloudWorkspaceSnapshot({
    workspace,
    workspaceVersion: 7,
    drafts: {
      r1: { ...createDraft('Cloud One'), cloudVersion: 3 },
      ignored: createDraft('Not in workspace'),
    },
    tombstones: [{ resumeId: 'deleted' }],
  });

  assert.equal(snapshot.activeResumeId, 'r2');
  assert.equal(snapshot.workspaceCloudVersion, 7);
  assert.equal(snapshot.draftsByResumeId.get('r1').resume.personal.name, 'Cloud One');
  assert.equal(snapshot.draftsByResumeId.get('r1').cloudVersion, 3);
  assert.equal(snapshot.draftsByResumeId.has('ignored'), false);
  assert.deepEqual(snapshot.tombstones, [{ resumeId: 'deleted' }]);
  assert.equal(normalizeCloudWorkspaceSnapshot({ workspace: createWorkspace([]) }), null);
});

test('login merge restores cloud resumes into blank local workspaces', () => {
  const localWorkspace = createWorkspace(['local-blank']);
  const cloudWorkspace = createWorkspace(['cloud-1', 'cloud-2'], { activeResumeId: 'cloud-2' });
  const result = mergeLocalAndCloudWorkspaces({
    localWorkspace,
    localDraftsByResumeId: new Map([['local-blank', createDraft('')]]),
    cloudWorkspace,
    cloudDraftsByResumeId: new Map([
      ['cloud-1', createDraft('Cloud One')],
      ['cloud-2', createDraft('Cloud Two')],
    ]),
  });

  assert.deepEqual(result.workspace.resumeIds, ['cloud-1', 'cloud-2']);
  assert.equal(result.activeResumeId, 'cloud-2');
  assert.equal(result.draftsByResumeId.get('cloud-1').resume.personal.name, 'Cloud One');
});

test('login merge treats sample-only local state as blank when restoring cloud resumes', () => {
  const localWorkspace = createWorkspace(['local-blank']);
  const localBlankDraft = {
    ...createDraft('', '2026-02-01T00:00:00.000Z'),
    resume: updateSampleDisplay(createEmptyResume(), {
      hasStarted: true,
      showInformation: false,
    }),
  };
  const cloudWorkspace = createWorkspace(['cloud-1'], { activeResumeId: 'cloud-1' });
  const result = mergeLocalAndCloudWorkspaces({
    localWorkspace,
    localDraftsByResumeId: new Map([['local-blank', localBlankDraft]]),
    cloudWorkspace,
    cloudDraftsByResumeId: new Map([['cloud-1', createDraft('Cloud Resume')]]),
  });

  assert.deepEqual(result.workspace.resumeIds, ['cloud-1']);
  assert.equal(result.activeResumeId, 'cloud-1');
  assert.equal(result.localHasContent, false);
  assert.deepEqual(result.syncPlan.upsertResumeIds, []);
});

test('login merge preserves blank resumes with intentional layout or settings changes', () => {
  const localResume = setResumeSettingValue(createEmptyResume(), 'textSize', 2);
  const localDraft = {
    resume: localResume,
    template: DEFAULT_TEMPLATE,
    savedAt: '2026-02-01T00:00:00.000Z',
  };
  const result = mergeLocalAndCloudWorkspaces({
    localWorkspace: createWorkspace(['local-layout']),
    localDraftsByResumeId: new Map([['local-layout', localDraft]]),
    cloudWorkspace: createWorkspace(['cloud-1']),
    cloudDraftsByResumeId: new Map([['cloud-1', createDraft('Cloud Resume')]]),
  });

  assert.equal(result.localHasContent, true);
  assert.deepEqual(result.workspace.resumeIds, ['local-layout', 'cloud-1']);
  assert.deepEqual(result.syncPlan.upsertResumeIds, ['local-layout']);
});

test('login merge preserves local and cloud content without dropping either side', () => {
  const result = mergeLocalAndCloudWorkspaces({
    localWorkspace: createWorkspace(['local-1']),
    localDraftsByResumeId: new Map([['local-1', createDraft('Local Resume')]]),
    cloudWorkspace: createWorkspace(['cloud-1']),
    cloudDraftsByResumeId: new Map([['cloud-1', createDraft('Cloud Resume')]]),
  });

  assert.deepEqual(result.workspace.resumeIds, ['local-1', 'cloud-1']);
  assert.equal(result.syncPlan.workspaceNeedsSync, true);
  assert.deepEqual(result.syncPlan.upsertResumeIds, ['local-1']);
});

test('login merge restores cloud folder organization into a blank browser', () => {
  const cloudWorkspace = normalizeWorkspaceIndex({
    ...createWorkspace(['cloud-1', 'cloud-2'], { activeResumeId: 'cloud-2' }),
    organization: {
      updatedAt: '2026-02-01T00:00:00.000Z',
      rootItems: [{ type: 'folder', id: 'cloud-folder' }],
      folders: {
        'cloud-folder': {
          id: 'cloud-folder',
          name: 'Cloud folder',
          resumeIds: ['cloud-1', 'cloud-2'],
        },
      },
    },
  });
  const result = mergeLocalAndCloudWorkspaces({
    localWorkspace: createWorkspace(['local-blank']),
    localDraftsByResumeId: new Map([['local-blank', createDraft('')]]),
    cloudWorkspace,
    cloudDraftsByResumeId: new Map([
      ['cloud-1', createDraft('Cloud One')],
      ['cloud-2', createDraft('Cloud Two')],
    ]),
  });

  assert.deepEqual(result.workspace.organization.rootItems, [
    { type: 'folder', id: 'cloud-folder' },
  ]);
  assert.deepEqual(result.workspace.organization.folders['cloud-folder'].resumeIds, ['cloud-1', 'cloud-2']);
});

test('login merge keeps local placement, cloud-only folders, and unioned folder tombstones', () => {
  const sharedDraftOne = createDraft('One');
  const sharedDraftTwo = createDraft('Two');
  const localWorkspace = normalizeWorkspaceIndex({
    ...createWorkspace(['r1', 'r2']),
    organization: {
      updatedAt: '2026-03-01T00:00:00.000Z',
      rootItems: [
        { type: 'folder', id: 'local-folder' },
        { type: 'resume', id: 'r2' },
      ],
      folders: {
        'local-folder': {
          id: 'local-folder',
          name: 'Local',
          resumeIds: ['r1'],
        },
      },
      removedFolderIds: ['removed-locally'],
    },
  });
  const cloudWorkspace = normalizeWorkspaceIndex({
    ...createWorkspace(['r1', 'r2', 'r3']),
    organization: {
      updatedAt: '2026-02-01T00:00:00.000Z',
      rootItems: [
        { type: 'folder', id: 'removed-locally' },
        { type: 'folder', id: 'cloud-folder' },
        { type: 'resume', id: 'r1' },
        { type: 'resume', id: 'r2' },
      ],
      folders: {
        'removed-locally': { id: 'removed-locally', name: 'Old', resumeIds: [] },
        'cloud-folder': {
          id: 'cloud-folder',
          name: 'Cloud',
          resumeIds: ['r3'],
        },
      },
      removedFolderIds: ['removed-in-cloud'],
    },
  });
  const result = mergeLocalAndCloudWorkspaces({
    localWorkspace,
    localDraftsByResumeId: new Map([
      ['r1', sharedDraftOne],
      ['r2', sharedDraftTwo],
    ]),
    cloudWorkspace,
    cloudDraftsByResumeId: new Map([
      ['r1', sharedDraftOne],
      ['r2', sharedDraftTwo],
      ['r3', createDraft('Three')],
    ]),
  });

  assert.deepEqual(result.workspace.organization.folders['local-folder'].resumeIds, ['r1']);
  assert.deepEqual(result.workspace.organization.folders['cloud-folder'].resumeIds, ['r3']);
  assert.equal(result.workspace.organization.folders['removed-locally'], undefined);
  assert.deepEqual(
    new Set(result.workspace.organization.removedFolderIds),
    new Set(['removed-locally', 'removed-in-cloud']),
  );
  assert.equal(result.syncPlan.workspaceNeedsSync, true);
});

test('login merge keeps local organization despite a future cloud clock', () => {
  const sharedDraftOne = createDraft('One');
  const sharedDraftTwo = createDraft('Two');
  const localWorkspace = normalizeWorkspaceIndex({
    ...createWorkspace(['r1', 'r2']),
    organization: {
      updatedAt: '2026-01-01T00:00:00.000Z',
      rootItems: [
        { type: 'resume', id: 'r2' },
        { type: 'resume', id: 'r1' },
      ],
      folders: {},
    },
  });
  const cloudWorkspace = normalizeWorkspaceIndex({
    ...createWorkspace(['r1', 'r2']),
    organization: {
      updatedAt: '2099-01-01T00:00:00.000Z',
      rootItems: [
        { type: 'resume', id: 'r1' },
        { type: 'resume', id: 'r2' },
      ],
      folders: {},
    },
  });
  const result = mergeLocalAndCloudWorkspaces({
    localWorkspace,
    localDraftsByResumeId: new Map([
      ['r1', sharedDraftOne],
      ['r2', sharedDraftTwo],
    ]),
    cloudWorkspace,
    cloudDraftsByResumeId: new Map([
      ['r1', sharedDraftOne],
      ['r2', sharedDraftTwo],
    ]),
  });

  assert.deepEqual(result.workspace.organization.rootItems, [
    { type: 'resume', id: 'r2' },
    { type: 'resume', id: 'r1' },
  ]);
  assert.equal(result.syncPlan.workspaceNeedsSync, true);
});

test('folder tombstones remain durable beyond the former normalization cap', () => {
  const removedFolderIds = Array.from({ length: 250 }, (_, index) => `removed-${index}`);
  const normalized = normalizeWorkspaceIndex({
    ...createWorkspace(['r1']),
    organization: {
      rootItems: [{ type: 'resume', id: 'r1' }],
      folders: {},
      removedFolderIds,
    },
  });
  const staleOrganization = {
    rootItems: [
      { type: 'folder', id: 'removed-0' },
      { type: 'resume', id: 'r1' },
    ],
    folders: {
      'removed-0': { id: 'removed-0', name: 'Old folder', resumeIds: [] },
    },
    removedFolderIds: [],
  };
  const merged = mergeWorkspaceOrganizations(
    normalized.organization,
    staleOrganization,
    ['r1'],
  );

  assert.equal(normalized.organization.removedFolderIds.length, 250);
  assert.ok(normalized.organization.removedFolderIds.includes('removed-0'));
  assert.equal(merged.folders['removed-0'], undefined);
  assert.equal(merged.rootItems.some((item) => item.id === 'removed-0'), false);
});

test('sync API workspace documents round trip folder organization', () => {
  const workspace = normalizeWorkspaceIndex({
    ...createWorkspace(['r1', 'r2']),
    organization: {
      updatedAt: '2026-03-01T00:00:00.000Z',
      rootItems: [{ type: 'folder', id: 'folder-1' }],
      folders: {
        'folder-1': {
          id: 'folder-1',
          name: 'Interviews',
          toneIndex: 3,
          resumeIds: ['r1', 'r2'],
        },
      },
      removedFolderIds: ['folder-old'],
    },
  });
  const cloudDocument = createWorkspaceDoc(workspace, {
    updatedAt: '2026-03-01T00:00:00.000Z',
    version: 42,
  });
  const restored = cloudWorkspaceFromDoc(cloudDocument);

  assert.equal(cloudDocument.schemaVersion, 2);
  assert.equal(restored.organization.folders['folder-1'].toneIndex, 3);
  assert.deepEqual(restored.organization, workspace.organization);
});

test('cloud workspace writes preserve concurrent browser folders and honor deletes', () => {
  const currentWorkspace = normalizeWorkspaceIndex({
    ...createWorkspace(['cloud-1']),
    organization: {
      updatedAt: '2026-02-01T00:00:00.000Z',
      rootItems: [{ type: 'folder', id: 'cloud-folder' }],
      folders: {
        'cloud-folder': {
          id: 'cloud-folder',
          name: 'Cloud folder',
          resumeIds: ['cloud-1'],
        },
      },
    },
  });
  const incomingWorkspace = normalizeWorkspaceIndex({
    ...createWorkspace(['local-1']),
    organization: {
      updatedAt: '2026-03-01T00:00:00.000Z',
      rootItems: [{ type: 'folder', id: 'local-folder' }],
      folders: {
        'local-folder': {
          id: 'local-folder',
          name: 'Local folder',
          resumeIds: ['local-1'],
        },
      },
    },
  });
  const currentDocument = createWorkspaceDoc(currentWorkspace, {
    updatedAt: '2026-02-01T00:00:00.000Z',
    version: 8,
  });
  const merged = mergeCloudWorkspaceForWrite(incomingWorkspace, currentDocument);
  const afterDelete = mergeCloudWorkspaceForWrite(incomingWorkspace, currentDocument, {
    deletedResumeIds: ['cloud-1'],
  });
  const incomingWithFolderTombstone = normalizeWorkspaceIndex({
    ...incomingWorkspace,
    organization: {
      ...incomingWorkspace.organization,
      removedFolderIds: ['cloud-folder'],
    },
  });
  const afterFolderRemoval = mergeCloudWorkspaceForWrite(incomingWithFolderTombstone, currentDocument);

  assert.deepEqual(merged.resumeIds, ['local-1', 'cloud-1']);
  assert.deepEqual(merged.organization.folders['local-folder'].resumeIds, ['local-1']);
  assert.deepEqual(merged.organization.folders['cloud-folder'].resumeIds, ['cloud-1']);
  assert.deepEqual(afterDelete.resumeIds, ['local-1']);
  assert.equal(afterDelete.organization.folders['cloud-folder'].resumeIds.length, 0);
  assert.equal(afterFolderRemoval.organization.folders['cloud-folder'], undefined);
  assert.ok(afterFolderRemoval.organization.removedFolderIds.includes('cloud-folder'));
});

test('accepted cloud workspace writes ignore client clock skew', () => {
  const currentWorkspace = normalizeWorkspaceIndex({
    ...createWorkspace(['r1', 'r2']),
    organization: {
      updatedAt: '2099-01-01T00:00:00.000Z',
      rootItems: [
        { type: 'resume', id: 'r1' },
        { type: 'resume', id: 'r2' },
      ],
      folders: {},
    },
  });
  const incomingWorkspace = normalizeWorkspaceIndex({
    ...createWorkspace(['r1', 'r2']),
    organization: {
      updatedAt: '2026-01-01T00:00:00.000Z',
      rootItems: [
        { type: 'resume', id: 'r2' },
        { type: 'resume', id: 'r1' },
      ],
      folders: {},
    },
  });
  const merged = mergeCloudWorkspaceForWrite(
    incomingWorkspace,
    createWorkspaceDoc(currentWorkspace),
  );

  assert.deepEqual(merged.organization.rootItems, [
    { type: 'resume', id: 'r2' },
    { type: 'resume', id: 'r1' },
  ]);
});

test('login merge syncs sample display preference without duplicating identical content', () => {
  const baseResume = createDraft('Same Resume').resume;
  const localDraft = {
    ...createDraft('Same Resume', '2026-02-01T00:00:00.000Z'),
    resume: updateSampleDisplay(baseResume, {
      hasStarted: true,
      showInformation: false,
    }),
  };
  const cloudDraft = {
    ...createDraft('Same Resume', '2026-01-01T00:00:00.000Z'),
    resume: updateSampleDisplay(baseResume, {
      hasStarted: true,
      showInformation: true,
    }),
  };
  const result = mergeLocalAndCloudWorkspaces({
    localWorkspace: createWorkspace(['resume-1'], { activeResumeId: 'resume-1' }),
    localDraftsByResumeId: new Map([['resume-1', localDraft]]),
    cloudWorkspace: createWorkspace(['resume-1'], { activeResumeId: 'resume-1' }),
    cloudDraftsByResumeId: new Map([['resume-1', cloudDraft]]),
  });

  assert.deepEqual(result.workspace.resumeIds, ['resume-1']);
  assert.equal(result.draftsByResumeId.get('resume-1').resume.sampleDisplay.showInformation, false);
  assert.equal(result.syncPlan.workspaceNeedsSync, true);
  assert.deepEqual(result.syncPlan.upsertResumeIds, ['resume-1']);
});

test('login merge never resurrects sample information after either copy dismissed it', () => {
  const baseResume = createDraft('Same Resume').resume;
  const localDraft = {
    ...createDraft('Same Resume', '2026-01-01T00:00:00.000Z'),
    resume: dismissSampleInformation(baseResume),
  };
  const cloudDraft = {
    ...createDraft('Same Resume', '2026-02-01T00:00:00.000Z'),
    resume: updateSampleDisplay(baseResume, {
      hasStarted: true,
      showInformation: true,
    }),
  };
  const result = mergeLocalAndCloudWorkspaces({
    localWorkspace: createWorkspace(['resume-1'], { activeResumeId: 'resume-1' }),
    localDraftsByResumeId: new Map([['resume-1', localDraft]]),
    cloudWorkspace: createWorkspace(['resume-1'], { activeResumeId: 'resume-1' }),
    cloudDraftsByResumeId: new Map([['resume-1', cloudDraft]]),
  });

  assert.equal(result.draftsByResumeId.get('resume-1').resume.sampleDisplay.isDismissed, true);
  assert.equal(result.draftsByResumeId.get('resume-1').resume.sampleDisplay.showInformation, false);
  assert.deepEqual(result.syncPlan.upsertResumeIds, ['resume-1']);
});

test('sync API preserves an existing permanent sample dismissal', () => {
  const incomingDraft = {
    ...createDraft('Same Resume'),
    resume: updateSampleDisplay(createDraft('Same Resume').resume, {
      hasStarted: true,
      showInformation: true,
    }),
  };
  const preservedDraft = preservePermanentSampleDismissal(incomingDraft, {
    resume: {
      sampleDisplay: {
        isDismissed: true,
      },
    },
  });

  assert.equal(preservedDraft.resume.sampleDisplay.isDismissed, true);
  assert.equal(preservedDraft.resume.sampleDisplay.showInformation, false);
});

test('outbox acknowledgement matching requires the exact operation version and revision', () => {
  const operation = {
    id: 'upsertDraft:r1',
    type: 'upsertDraft',
    operationVersion: 100,
    localRevision: 'rev-a',
  };

  assert.deepEqual(createOutboxAckDescriptor(operation), {
    id: 'upsertDraft:r1',
    operationVersion: 100,
    localRevision: 'rev-a',
  });
  assert.equal(outboxOperationMatchesAck(operation, {
    id: 'upsertDraft:r1',
    operationVersion: 100,
    localRevision: 'rev-a',
  }), true);
  assert.equal(outboxOperationMatchesAck(operation, {
    id: 'upsertDraft:r1',
    operationVersion: 101,
    localRevision: 'rev-a',
  }), false);
  assert.equal(outboxOperationMatchesAck(operation, {
    id: 'upsertDraft:r1',
    operationVersion: 100,
    localRevision: 'rev-b',
  }), false);
  assert.equal(outboxOperationMatchesAck({
    id: 'deleteDraft:r1',
    type: 'deleteDraft',
    operationVersion: 200,
    localRevision: 'delete-token',
  }, {
    id: 'deleteDraft:r1',
    operationVersion: 200,
    localRevision: 'delete-token',
  }), true);
});

test('server sync cursors reject older same-browser operations without using wall-clock time', () => {
  const operation = {
    id: 'upsertDraft:r1',
    type: 'upsertDraft',
    resumeId: 'r1',
    clientId: 'browser-a',
    operationVersion: 7,
  };

  assert.equal(shouldAcceptSyncOperation(operation, null), true);
  assert.equal(shouldAcceptSyncOperation(operation, { lastSequence: 6 }), true);
  assert.equal(shouldAcceptSyncOperation(operation, { lastSequence: 7 }), false);
  assert.equal(shouldAcceptSyncOperation(operation, { lastSequence: 8 }), false);
});

test('cloud document versions reject stale writes from a different browser', () => {
  assert.equal(shouldAcceptCloudVersion({ baseCloudVersion: 4 }, 4), true);
  assert.equal(shouldAcceptCloudVersion({ baseCloudVersion: 3 }, 4), false);
  assert.equal(shouldAcceptCloudVersion({}, 4), false);
  assert.equal(shouldAcceptCloudVersion({}, 0), true);
});

test('remote tombstones remove deleted resumes without requeueing an upsert', () => {
  const localWorkspace = createWorkspace(['resume-1', 'resume-2'], { activeResumeId: 'resume-2' });
  const cloudWorkspace = createWorkspace(['resume-1'], { activeResumeId: 'resume-1' });
  const sharedResumeOne = createDraft('Resume one');
  const result = mergeLocalAndCloudWorkspaces({
    localWorkspace,
    localDraftsByResumeId: new Map([
      ['resume-1', sharedResumeOne],
      ['resume-2', createDraft('Resume two')],
    ]),
    cloudWorkspace,
    cloudDraftsByResumeId: new Map([['resume-1', {
      ...sharedResumeOne,
      cloudVersion: 9,
    }]]),
    cloudTombstones: [{ resumeId: 'resume-2', deletedAt: '2026-07-21T12:00:00.000Z' }],
    workspaceCloudVersion: 6,
  });

  assert.deepEqual(result.workspace.resumeIds, ['resume-1']);
  assert.equal(result.draftsByResumeId.has('resume-2'), false);
  assert.equal(result.syncPlan.upsertResumeIds.includes('resume-2'), false);
  assert.equal(result.tombstones.some((record) => record.resumeId === 'resume-2'), true);
  assert.equal(result.workspaceCloudVersion, 6);
  assert.equal(result.draftsByResumeId.get('resume-1').cloudVersion, 9);
});

test('remote deletion preserves an unsynced local edit as a conflict copy', () => {
  const localWorkspace = createWorkspace(['resume-1', 'resume-2'], {
    activeResumeId: 'resume-2',
    names: { 'resume-2': 'Offline edit' },
  });
  const cloudWorkspace = createWorkspace(['resume-1']);
  const sharedResumeOne = createDraft('Resume one');
  const result = mergeLocalAndCloudWorkspaces({
    localWorkspace,
    localDraftsByResumeId: new Map([
      ['resume-1', sharedResumeOne],
      ['resume-2', createDraft('Unsynced local version')],
    ]),
    cloudWorkspace,
    cloudDraftsByResumeId: new Map([['resume-1', sharedResumeOne]]),
    cloudTombstones: [{ resumeId: 'resume-2', deletedAt: '2026-07-21T12:00:00.000Z' }],
    outboxRecords: [{
      id: 'account-a:upsertDraft:resume-2',
      type: 'upsertDraft',
      resumeId: 'resume-2',
      status: 'stale',
    }],
  });
  const preservedCopyId = result.workspace.resumeIds.find((resumeId) => (
    resumeId !== 'resume-1'
  ));

  assert.notEqual(preservedCopyId, 'resume-2');
  assert.equal(result.workspace.resumeIds.includes('resume-2'), false);
  assert.equal(result.draftsByResumeId.get(preservedCopyId).resume.personal.name, 'Unsynced local version');
  assert.equal(result.syncPlan.upsertResumeIds.includes(preservedCopyId), true);
  assert.match(result.warnings[0], /preserved as a separate copy/i);
});

test('remote deletion of the final clean resume leaves a fresh local workspace', () => {
  const result = mergeLocalAndCloudWorkspaces({
    localWorkspace: createWorkspace(['resume-1']),
    localDraftsByResumeId: new Map([['resume-1', createDraft('')]]),
    cloudTombstones: [{ resumeId: 'resume-1', deletedAt: '2026-07-21T12:00:00.000Z' }],
  });

  assert.equal(result.workspace.resumeIds.length, 1);
  assert.notEqual(result.workspace.resumeIds[0], 'resume-1');
  assert.equal(result.draftsByResumeId.has(result.workspace.resumeIds[0]), true);
  assert.deepEqual(result.syncPlan.upsertResumeIds, [result.workspace.resumeIds[0]]);
});

test('one oversized draft does not block valid operations in the same sync batch', () => {
  const workspace = createWorkspace(['resume-1'], { activeResumeId: 'resume-1' });
  const oversizedDraft = createDraft('Large resume');

  oversizedDraft.resume.personal.aboutMe = 'x'.repeat(900_000);

  const result = partitionOversizedSyncOperations([
    {
      id: 'workspace',
      type: 'workspace',
      workspace,
      accountUid: 'account-a',
    },
    {
      id: 'upsertDraft:resume-1',
      type: 'upsertDraft',
      resumeId: 'resume-1',
      workspace,
      draft: oversizedDraft,
      operationVersion: 2,
      localRevision: 'large-draft',
      accountUid: 'account-a',
    },
  ]);

  assert.deepEqual(result.acceptedOperations.map((operation) => operation.id), ['workspace']);
  assert.deepEqual(result.rejectedOperations, [{
    id: 'upsertDraft:resume-1',
    operationVersion: 2,
    localRevision: 'large-draft',
    reason: 'payload-too-large',
  }]);
});

test('draft upserts and deletes share a cursor and permanent tombstones block resurrection', () => {
  const upsert = {
    id: 'upsertDraft:r1',
    type: 'upsertDraft',
    resumeId: 'r1',
    clientId: 'browser-a',
    operationVersion: 7,
  };
  const remove = {
    ...upsert,
    id: 'deleteDraft:r1',
    type: 'deleteDraft',
    operationVersion: 8,
  };

  assert.equal(getSyncCursorId(upsert), getSyncCursorId(remove));
  assert.equal(shouldAcceptDraftSyncOperation(upsert, { lastSequence: 6 }, false), true);
  assert.equal(shouldAcceptDraftSyncOperation(upsert, { lastSequence: 6 }, true), false);
  assert.equal(shouldAcceptSyncOperation(upsert, { lastSequence: 8 }), false);
});

test('local persistence serializes editor saves and database clears', () => {
  const builderHook = fs.readFileSync('src/hooks/useResumeBuilder.js', 'utf8');
  const browserConnection = fs.readFileSync('src/lib/browserConnection.js', 'utf8');

  assert.match(builderHook, /const editorSaveQueueRef = useRef\(Promise\.resolve\(\)\)/);
  assert.match(builderHook, /const saveResult = await persistCurrentEditorDraft\(\{ reason: 'switch-resume'/);
  assert.match(builderHook, /saveResult\?\.conflict \|\|\s*saveResult\?\.error \|\|\s*saveResult\?\.skipped/);
  assert.match(browserConnection, /await deleteLocalWorkspaceDatabase\(\)/);
});

test('sign-out refuses to clear browser data until cloud sync completes', async () => {
  const calls = [];
  const result = await runBrowserSignOut({
    user: { uid: 'account-a' },
    allowSignedOutEditing: false,
    flushActiveCloudDraft: async ({ reason }) => {
      calls.push(`flush:${reason}`);
      return false;
    },
    requestBackgroundSync: async () => calls.push('background-sync'),
    setSessionCleanupRequested: async () => calls.push('cleanup-request'),
    clearSyncSession: async () => calls.push('clear-session'),
    signOut: async () => calls.push('sign-out'),
    clearLocalWorkspace: async () => calls.push('clear-local'),
    reloadBrowser: () => calls.push('reload'),
  });

  assert.equal(result.status, 'cloud-sync-incomplete');
  assert.deepEqual(calls, ['flush:signout']);
});

test('signed-out editing defers session cleanup when cloud sync remains queued', async () => {
  const calls = [];
  const result = await runBrowserSignOut({
    user: { uid: 'account-a' },
    allowSignedOutEditing: true,
    flushActiveCloudDraft: async ({ reason }) => {
      calls.push(`flush:${reason}`);
      return false;
    },
    requestBackgroundSync: async () => calls.push('background-sync'),
    setSessionCleanupRequested: async (uid, requested) => calls.push(`cleanup:${uid}:${requested}`),
    clearSyncSession: async () => calls.push('clear-session'),
    signOut: async () => {
      calls.push('sign-out');
      return true;
    },
    clearLocalWorkspace: async () => calls.push('clear-local'),
    reloadBrowser: () => calls.push('reload'),
  });

  assert.deepEqual(result, { status: 'signed-out', cloudSyncCompleted: false });
  assert.deepEqual(calls, [
    'flush:signout',
    'cleanup:account-a:true',
    'background-sync',
    'sign-out',
  ]);
});

test('remove-on-sign-out clears data only after cloud, session, and auth succeed', async () => {
  const calls = [];
  const result = await runBrowserSignOut({
    user: { uid: 'account-a' },
    allowSignedOutEditing: false,
    flushActiveCloudDraft: async ({ reason }) => {
      calls.push(`flush:${reason}`);
      return true;
    },
    requestBackgroundSync: async () => calls.push('background-sync'),
    setSessionCleanupRequested: async () => calls.push('cleanup-request'),
    clearSyncSession: async () => {
      calls.push('clear-session');
      return true;
    },
    signOut: async () => {
      calls.push('sign-out');
      return true;
    },
    clearLocalWorkspace: async () => calls.push('clear-local'),
    reloadBrowser: () => calls.push('reload'),
  });

  assert.deepEqual(result, { status: 'signed-out', cloudSyncCompleted: true });
  assert.deepEqual(calls, [
    'flush:signout',
    'clear-session',
    'sign-out',
    'clear-local',
    'reload',
  ]);
});

test('failed deferred sign-out cancels the pending session cleanup request', async () => {
  const calls = [];
  const result = await runBrowserSignOut({
    user: { uid: 'account-a' },
    allowSignedOutEditing: true,
    flushActiveCloudDraft: async () => false,
    requestBackgroundSync: async () => calls.push('background-sync'),
    setSessionCleanupRequested: async (uid, requested) => calls.push(`cleanup:${uid}:${requested}`),
    clearSyncSession: async () => calls.push('clear-session'),
    signOut: async () => false,
    clearLocalWorkspace: async () => calls.push('clear-local'),
    reloadBrowser: () => calls.push('reload'),
  });

  assert.equal(result.status, 'auth-signout-failed');
  assert.deepEqual(calls, [
    'cleanup:account-a:true',
    'background-sync',
    'cleanup:account-a:false',
  ]);
});

test('browser disconnect never clears local data after an incomplete cloud flush', async () => {
  const calls = [];
  const result = await runBrowserDisconnect({
    user: { uid: 'account-a' },
    flushActiveCloudDraft: async ({ reason }) => {
      calls.push(`flush:${reason}`);
      return false;
    },
    disconnectAuth: async () => calls.push('disconnect-auth'),
    clearBrowserData: async () => calls.push('clear-browser'),
    reloadBrowser: () => calls.push('reload'),
  });

  assert.equal(result.status, 'cloud-sync-incomplete');
  assert.deepEqual(calls, ['flush:disconnect-browser']);
});

test('browser disconnect clears local data only after the auth connection is removed', async () => {
  const calls = [];
  const result = await runBrowserDisconnect({
    user: { uid: 'account-a' },
    flushActiveCloudDraft: async ({ reason }) => {
      calls.push(`flush:${reason}`);
      return true;
    },
    disconnectAuth: async () => {
      calls.push('disconnect-auth');
      return true;
    },
    clearBrowserData: async () => calls.push('clear-browser'),
    reloadBrowser: () => calls.push('reload'),
  });

  assert.equal(result.status, 'disconnected');
  assert.deepEqual(calls, [
    'flush:disconnect-browser',
    'disconnect-auth',
    'clear-browser',
    'reload',
  ]);
});

test('outbox account filtering keeps cloud sync scoped to the signed-in user', () => {
  const operations = [
    {
      id: 'upsertDraft:a1',
      type: 'upsertDraft',
      accountUid: 'account-a',
    },
    {
      id: 'upsertDraft:b1',
      type: 'upsertDraft',
      accountUid: 'account-b',
    },
    {
      id: 'upsertDraft:guest',
      type: 'upsertDraft',
      accountUid: '',
    },
  ];

  assert.equal(outboxOperationBelongsToAccount(operations[0], 'account-a'), true);
  assert.equal(outboxOperationBelongsToAccount(operations[1], 'account-a'), false);
  assert.equal(outboxOperationBelongsToAccount(operations[2], 'account-a'), false);
  assert.deepEqual(
    filterOutboxOperationsForAccount(operations, 'account-a').map((operation) => operation.id),
    ['upsertDraft:a1'],
  );
});

test('sync API partitions operations by the authenticated Firebase account', () => {
  const operations = [
    {
      id: 'workspace',
      type: 'workspace',
      accountUid: 'account-a',
      operationVersion: 10,
      localRevision: 'workspace-a',
    },
    {
      id: 'upsertDraft:r1',
      type: 'upsertDraft',
      accountUid: 'account-b',
      operationVersion: 20,
      localRevision: 'draft-b',
    },
    {
      id: 'upsertDraft:guest',
      type: 'upsertDraft',
      accountUid: '',
      operationVersion: 30,
      localRevision: 'guest-draft',
    },
  ];
  const result = partitionSyncOperationsByAccount(operations, 'account-a');

  assert.equal(operationBelongsToSyncAccount(operations[0], 'account-a'), true);
  assert.deepEqual(result.scopedOperations.map((operation) => operation.id), ['workspace']);
  assert.deepEqual(result.rejectedOperations, [
    { id: 'upsertDraft:r1', operationVersion: 20, localRevision: 'draft-b' },
    { id: 'upsertDraft:guest', operationVersion: 30, localRevision: 'guest-draft' },
  ]);
});

test('sync response acknowledgement mapping preserves sent operation descriptors', () => {
  const operations = [
    {
      id: 'workspace',
      type: 'workspace',
      operationVersion: 10,
      localRevision: 'workspace-token',
    },
    {
      id: 'upsertDraft:r1',
      type: 'upsertDraft',
      operationVersion: 20,
      localRevision: 'draft-rev',
    },
  ];

  assert.deepEqual(getOperationAcksFromResponse({
    syncedOperations: [{ id: 'workspace', operationVersion: 10, localRevision: 'workspace-token' }],
  }, operations, 'syncedOperations', 'syncedOperationIds'), [
    { id: 'workspace', operationVersion: 10, localRevision: 'workspace-token' },
  ]);
  assert.deepEqual(getOperationAcksFromResponse({
    syncedOperationIds: ['upsertDraft:r1'],
  }, operations, 'syncedOperations', 'syncedOperationIds'), [
    { id: 'upsertDraft:r1', operationVersion: 20, localRevision: 'draft-rev' },
  ]);
});

test('client sync batching isolates impossible operations and stays below the request budget', () => {
  const createOperation = (id, payloadSize) => ({
    id,
    type: 'upsertDraft',
    resumeId: id,
    operationVersion: Number(id.replace(/\D/g, '')) || 1,
    localRevision: `revision-${id}`,
    draft: { payload: 'x'.repeat(payloadSize) },
  });
  const operations = [
    createOperation('resume-1', 1_050_000),
    createOperation('resume-2', 800_000),
    createOperation('resume-3', 800_000),
    createOperation('resume-4', 800_000),
    createOperation('resume-5', 800_000),
  ];
  const result = partitionClientSyncOperations(operations);

  assert.deepEqual(result.oversizedOperations, [{
    id: 'resume-1',
    operationVersion: 1,
    localRevision: 'revision-resume-1',
    reason: 'payload-too-large',
  }]);
  assert.deepEqual(result.operations.map((operation) => operation.id), [
    'resume-2',
    'resume-3',
    'resume-4',
  ]);
});
