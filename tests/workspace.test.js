import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { createBlankDraftState, createFreshWorkspaceDraft } from '../src/lib/workspaceDraft.js';
import { readLegacyWorkspaceSnapshot } from '../src/lib/localWorkspaceMirror.js';
import {
  MAX_WORKSPACE_RESUME_NAME_LENGTH,
  MAX_WORKSPACE_RESUMES,
  addWorkspaceResume,
  createDuplicateResumeName,
  createNextResumeName,
  createWorkspaceFolderFromResumes,
  createWorkspaceResumeId,
  normalizeWorkspaceFolderToneIndex,
  normalizeWorkspaceOrganization,
  normalizeWorkspaceIndex,
  placeWorkspaceResumeAfter,
  removeWorkspaceFolders,
  removeWorkspaceResumes,
  renameWorkspaceFolder,
  updateWorkspaceResumeMeta,
} from '../src/lib/workspace.js';
import {
  buildResumeRailLayout,
  collapseResumeBundleForDragPreview,
  createResumeBundleDragPreview,
  getFolderPlacementCellRect,
  getFolderResumeInsertionIndex,
  getFolderResumeDropIntent,
  getOrganizationResumePlacement,
  getOrganizationVisualResumeIds,
  isPointerWithinFolderPlacementSurface,
  isResumeBundleSourcePlaceholder,
  moveOrganizationResumeBundle,
  moveOrganizationRootItem,
  moveOrganizationRootItemToIndex,
  workspaceOrganizationsEqual,
} from '../src/lib/workspaceOrganization.js';
import {
  applyOpenFolderPointerDestination,
  applyRootPointerDestination,
  chooseResumePointerDestination,
  getRailGridMetrics,
  getOpenFolderPointerDestination,
  getRootPointerDestination,
} from '../src/components/resumeWorkspaceRailDrag.js';
import { persistLocalResumeBatchDelete } from '../src/lib/localWorkspaceDb.js';
import { createWorkspace } from './helpers/resumeFixtures.js';

test('workspace helpers support local-first resume ordering and naming', () => {
  const resumeId = createWorkspaceResumeId();
  const workspace = createFreshWorkspaceDraft();

  assert.match(resumeId, /^id-|^[0-9a-f-]{8,}$/i);
  assert.equal(MAX_WORKSPACE_RESUMES, 100);
  assert.equal(workspace.workspace.meta[workspace.activeResumeId].name, 'Resume 1');
  assert.equal(createNextResumeName(['Resume 1', 'Resume 3']), 'Resume 2');
  assert.equal(createDuplicateResumeName('Resume no skills', ['Resume no skills']), 'Resume no skills copy');
  assert.ok(createDuplicateResumeName('abcdefghijklmnopqrstuvwxyz'.repeat(2), []).length <= MAX_WORKSPACE_RESUME_NAME_LENGTH);
});

test('blank drafts and resume metadata share canonical workspace helpers', () => {
  const blankDraft = createBlankDraftState();
  const workspace = createWorkspace(['r1', 'r2']);
  const updatedWorkspace = updateWorkspaceResumeMeta(workspace, 'r2', {
    name: 'Updated resume',
    updatedAt: '2026-07-22T12:00:00.000Z',
  });

  assert.equal(blankDraft.template, 'compact');
  assert.equal(blankDraft.savedAt, null);
  assert.deepEqual(Object.keys(blankDraft.resume).sort(), ['personal', 'sampleDisplay', 'sections', 'settings']);
  assert.equal(updatedWorkspace.meta.r2.name, 'Updated resume');
  assert.equal(updatedWorkspace.meta.r2.updatedAt, '2026-07-22T12:00:00.000Z');
  assert.deepEqual(updateWorkspaceResumeMeta(workspace, 'missing', { name: 'Ignored' }), workspace);
});

test('workspace resume creation centralizes metadata, activation, and organization placement', () => {
  const workspace = normalizeWorkspaceIndex({
    ...createWorkspace(['r1', 'r2']),
    organization: {
      rootItems: [{ type: 'folder', id: 'folder-1' }],
      folders: {
        'folder-1': { id: 'folder-1', name: 'Applications', resumeIds: ['r1', 'r2'] },
      },
    },
  });
  const created = addWorkspaceResume(workspace, {
    resumeId: 'r3',
    name: 'Backend roles',
    updatedAt: '2026-07-22T12:00:00.000Z',
    afterResumeId: 'r1',
    now: '2026-07-22T12:00:01.000Z',
  });

  assert.equal(created.resumeId, 'r3');
  assert.equal(created.workspace.activeResumeId, 'r3');
  assert.deepEqual(created.workspace.meta.r3, {
    name: 'Backend roles',
    updatedAt: '2026-07-22T12:00:00.000Z',
  });
  assert.deepEqual(created.workspace.organization.folders['folder-1'].resumeIds, ['r1', 'r3', 'r2']);
  assert.equal(created.workspace.organization.updatedAt, '2026-07-22T12:00:01.000Z');
  assert.equal(addWorkspaceResume(created.workspace, { resumeId: 'r3' }).resumeId, '');
});

test('legacy workspace fallback returns a normalized fresh draft without browser storage', () => {
  const snapshot = readLegacyWorkspaceSnapshot();

  assert.equal(snapshot.workspace.activeResumeId, snapshot.activeResumeId);
  assert.equal(snapshot.draft.savedAt, null);
  assert.equal(snapshot.draft.localRevision, '');
  assert.equal(snapshot.draft.cloudVersion, 0);
});

test('workspace organization normalizes flat workspaces and enforces one placement per resume', () => {
  const flatWorkspace = createWorkspace(['r1', 'r2', 'r3']);
  assert.deepEqual(flatWorkspace.organization.rootItems, [
    { type: 'resume', id: 'r1' },
    { type: 'resume', id: 'r2' },
    { type: 'resume', id: 'r3' },
  ]);

  const organization = normalizeWorkspaceOrganization({
    rootItems: [
      { type: 'resume', id: 'r1' },
      { type: 'folder', id: 'folder-1' },
      { type: 'resume', id: 'r2' },
      { type: 'resume', id: 'missing' },
    ],
    folders: {
      'folder-1': {
        id: 'folder-1',
        name: 'Applications',
        resumeIds: ['r2', 'r1', 'r2'],
      },
    },
  }, ['r1', 'r2', 'r3']);

  assert.deepEqual(organization.folders['folder-1'], {
    id: 'folder-1',
    name: 'Applications',
    toneIndex: normalizeWorkspaceFolderToneIndex(undefined, 'folder-1'),
    resumeIds: ['r2', 'r1'],
  });
  assert.deepEqual(organization.rootItems, [
    { type: 'folder', id: 'folder-1' },
    { type: 'resume', id: 'r3' },
  ]);
  assert.deepEqual(getOrganizationVisualResumeIds(organization), ['r2', 'r1', 'r3']);
});

test('workspace organization equality ignores timestamps and object insertion order', () => {
  const first = {
    updatedAt: '2026-01-01T00:00:00.000Z',
    rootItems: [{ type: 'folder', id: 'folder-a' }, { type: 'folder', id: 'folder-b' }],
    folders: {
      'folder-a': { id: 'folder-a', name: 'A', resumeIds: ['r1'] },
      'folder-b': { id: 'folder-b', name: 'B', resumeIds: ['r2'] },
    },
    removedFolderIds: [],
  };
  const second = {
    removedFolderIds: [],
    folders: {
      'folder-b': { resumeIds: ['r2'], name: 'B', id: 'folder-b' },
      'folder-a': { resumeIds: ['r1'], name: 'A', id: 'folder-a' },
    },
    rootItems: [{ id: 'folder-a', type: 'folder' }, { id: 'folder-b', type: 'folder' }],
    updatedAt: '2026-07-22T00:00:00.000Z',
  };

  assert.equal(workspaceOrganizationsEqual(first, second), true);
  assert.equal(workspaceOrganizationsEqual(first, {
    ...second,
    rootItems: [...second.rootItems].reverse(),
  }), false);
});

test('folder creation preserves visual order and uses the earliest selected root anchor', () => {
  const workspace = normalizeWorkspaceIndex({
    ...createWorkspace(['r1', 'r2', 'r3', 'r4']),
    organization: {
      updatedAt: '2026-01-01T00:00:00.000Z',
      rootItems: [
        { type: 'resume', id: 'r1' },
        { type: 'folder', id: 'folder-old' },
        { type: 'resume', id: 'r4' },
      ],
      folders: {
        'folder-old': {
          id: 'folder-old',
          name: 'Existing',
          resumeIds: ['r2', 'r3'],
        },
      },
    },
  });
  const result = createWorkspaceFolderFromResumes(workspace, ['r4', 'r2'], {
    folderId: 'folder-new',
    now: '2026-02-01T00:00:00.000Z',
  });

  assert.equal(result.folderId, 'folder-new');
  assert.deepEqual(result.movedResumeIds, ['r2', 'r4']);
  assert.deepEqual(result.workspace.organization.rootItems, [
    { type: 'resume', id: 'r1' },
    { type: 'folder', id: 'folder-new' },
    { type: 'folder', id: 'folder-old' },
  ]);
  assert.deepEqual(result.workspace.organization.folders['folder-new'].resumeIds, ['r2', 'r4']);
  assert.deepEqual(result.workspace.organization.folders['folder-old'].resumeIds, ['r3']);
  assert.ok(result.workspace.organization.folders['folder-new'].toneIndex >= 0);
  assert.notEqual(
    result.workspace.organization.folders['folder-new'].toneIndex,
    result.workspace.organization.folders['folder-old'].toneIndex,
  );
});

test('folder tone identity survives normalization and does not depend on root order', () => {
  const first = normalizeWorkspaceOrganization({
    rootItems: [
      { type: 'folder', id: 'folder-a' },
      { type: 'folder', id: 'folder-b' },
    ],
    folders: {
      'folder-a': { id: 'folder-a', name: 'A', toneIndex: 4, resumeIds: ['r1'] },
      'folder-b': { id: 'folder-b', name: 'B', resumeIds: ['r2'] },
    },
  }, ['r1', 'r2']);
  const reordered = normalizeWorkspaceOrganization({
    ...first,
    rootItems: [...first.rootItems].reverse(),
  }, ['r1', 'r2']);

  assert.equal(first.folders['folder-a'].toneIndex, 4);
  assert.equal(reordered.folders['folder-a'].toneIndex, 4);
  assert.equal(
    reordered.folders['folder-b'].toneIndex,
    normalizeWorkspaceFolderToneIndex(undefined, 'folder-b'),
  );
});

test('folder removal ungroups children in place and records a folder tombstone', () => {
  const workspace = normalizeWorkspaceIndex({
    ...createWorkspace(['r1', 'r2', 'r3', 'r4']),
    organization: {
      rootItems: [
        { type: 'resume', id: 'r1' },
        { type: 'folder', id: 'folder-1' },
        { type: 'resume', id: 'r4' },
      ],
      folders: {
        'folder-1': { id: 'folder-1', name: 'Folder', resumeIds: ['r2', 'r3'] },
      },
    },
  });
  const result = removeWorkspaceFolders(workspace, ['folder-1'], {
    now: '2026-02-01T00:00:00.000Z',
  });

  assert.deepEqual(result.workspace.organization.rootItems, [
    { type: 'resume', id: 'r1' },
    { type: 'resume', id: 'r2' },
    { type: 'resume', id: 'r3' },
    { type: 'resume', id: 'r4' },
  ]);
  assert.equal(result.workspace.organization.folders['folder-1'], undefined);
  assert.deepEqual(result.workspace.organization.removedFolderIds, ['folder-1']);
});

test('deleting a foldered resume preserves every remaining folder and placement', () => {
  const workspace = normalizeWorkspaceIndex({
    ...createWorkspace(['r1', 'r2', 'r3']),
    activeResumeId: 'r1',
    organization: {
      updatedAt: '2026-02-01T00:00:00.000Z',
      rootItems: [
        { type: 'folder', id: 'folder-1' },
        { type: 'resume', id: 'r3' },
      ],
      folders: {
        'folder-1': {
          id: 'folder-1',
          name: 'Applications',
          resumeIds: ['r1', 'r2'],
        },
      },
    },
  });
  const firstDeletion = removeWorkspaceResumes(workspace, ['r1'], {
    now: '2026-03-01T00:00:00.000Z',
  });
  const secondDeletion = removeWorkspaceResumes(firstDeletion.workspace, ['r2'], {
    now: '2026-04-01T00:00:00.000Z',
  });

  assert.deepEqual(firstDeletion.workspace.organization.rootItems, [
    { type: 'folder', id: 'folder-1' },
    { type: 'resume', id: 'r3' },
  ]);
  assert.deepEqual(firstDeletion.workspace.organization.folders['folder-1'].resumeIds, ['r2']);
  assert.deepEqual(secondDeletion.workspace.organization.rootItems, [
    { type: 'folder', id: 'folder-1' },
    { type: 'resume', id: 'r3' },
  ]);
  assert.deepEqual(secondDeletion.workspace.organization.folders['folder-1'].resumeIds, []);
  assert.ok(
    Date.parse(secondDeletion.workspace.organization.updatedAt)
      >= Date.parse(firstDeletion.workspace.organization.updatedAt),
  );
});

test('combined folder removal and resume deletion keeps non-selected children at root', () => {
  const workspace = normalizeWorkspaceIndex({
    ...createWorkspace(['r1', 'r2', 'r3']),
    organization: {
      rootItems: [
        { type: 'folder', id: 'folder-1' },
        { type: 'resume', id: 'r3' },
      ],
      folders: {
        'folder-1': { id: 'folder-1', name: 'Folder', resumeIds: ['r1', 'r2'] },
      },
    },
  });
  const folderRemoval = removeWorkspaceFolders(workspace, ['folder-1'], {
    now: '2026-02-01T00:00:00.000Z',
  });
  const deletion = removeWorkspaceResumes(folderRemoval.workspace, ['r1'], {
    now: '2026-02-02T00:00:00.000Z',
  });

  assert.deepEqual(deletion.workspace.organization.rootItems, [
    { type: 'resume', id: 'r2' },
    { type: 'resume', id: 'r3' },
  ]);
  assert.deepEqual(deletion.workspace.organization.removedFolderIds, ['folder-1']);
});

test('folder names fall back safely and receive deterministic duplicate suffixes', () => {
  const first = createWorkspaceFolderFromResumes(createWorkspace(['r1', 'r2']), ['r1'], {
    folderId: 'folder-1',
    now: '2026-02-01T00:00:00.000Z',
  }).workspace;
  const secondResult = createWorkspaceFolderFromResumes(first, ['r2'], {
    folderId: 'folder-2',
    now: '2026-02-02T00:00:00.000Z',
  });
  const renamed = renameWorkspaceFolder(secondResult.workspace, 'folder-2', '', {
    now: '2026-02-03T00:00:00.000Z',
  });

  assert.equal(first.organization.folders['folder-1'].name, 'New folder');
  assert.equal(secondResult.workspace.organization.folders['folder-2'].name, 'New folder 2');
  assert.equal(renamed.organization.folders['folder-2'].name, 'New folder 2');
});

test('duplicate placement keeps a copied resume beside its source container', () => {
  const workspace = normalizeWorkspaceIndex({
    ...createWorkspace(['r1', 'r2', 'r3']),
    organization: {
      rootItems: [
        { type: 'folder', id: 'folder-1' },
        { type: 'resume', id: 'r3' },
      ],
      folders: {
        'folder-1': { id: 'folder-1', name: 'Folder', resumeIds: ['r1'] },
      },
    },
  });
  const next = placeWorkspaceResumeAfter(workspace, 'r2', 'r1', {
    now: '2026-02-01T00:00:00.000Z',
  });

  assert.deepEqual(next.organization.folders['folder-1'].resumeIds, ['r1', 'r2']);
  assert.deepEqual(getOrganizationResumePlacement(next.organization, 'r2'), {
    containerId: 'folder-1',
    index: 1,
  });
});

test('organization movement supports ordered resume bundles across root and folders', () => {
  const organization = normalizeWorkspaceOrganization({
    rootItems: [
      { type: 'resume', id: 'r1' },
      { type: 'folder', id: 'folder-1' },
      { type: 'resume', id: 'r4' },
    ],
    folders: {
      'folder-1': { id: 'folder-1', name: 'Folder', resumeIds: ['r2', 'r3'] },
    },
  }, ['r1', 'r2', 'r3', 'r4']);
  const movedIntoFolder = moveOrganizationResumeBundle(organization, ['r1', 'r4'], {
    containerId: 'folder-1',
    overResumeId: 'r3',
  });
  const movedBackToRoot = moveOrganizationResumeBundle(movedIntoFolder, ['r3', 'r1'], {
    containerId: 'root',
    overResumeId: 'r4',
  });

  assert.deepEqual(movedIntoFolder.folders['folder-1'].resumeIds, ['r2', 'r1', 'r4', 'r3']);
  assert.deepEqual(movedBackToRoot.rootItems, [
    { type: 'folder', id: 'folder-1' },
    { type: 'resume', id: 'r3' },
    { type: 'resume', id: 'r1' },
  ]);
  assert.deepEqual(movedBackToRoot.folders['folder-1'].resumeIds, ['r2', 'r4']);
});

test('multi-resume movement preserves its cross-container source until the bundle is committed', () => {
  const organization = normalizeWorkspaceOrganization({
    rootItems: [
      { type: 'resume', id: 'r1' },
      { type: 'folder', id: 'folder-1' },
      { type: 'resume', id: 'r4' },
      { type: 'folder', id: 'folder-2' },
    ],
    folders: {
      'folder-1': { id: 'folder-1', name: 'First', resumeIds: ['r2', 'r3'] },
      'folder-2': { id: 'folder-2', name: 'Second', resumeIds: ['r5'] },
    },
  }, ['r1', 'r2', 'r3', 'r4', 'r5']);
  const selectedIds = ['r1', 'r3', 'r5'];
  const sourceOrder = getOrganizationVisualResumeIds(organization);
  const preview = collapseResumeBundleForDragPreview(
    organization,
    selectedIds,
    'r3',
    'r3',
  );

  const moved = moveOrganizationResumeBundle(organization, selectedIds, {
    containerId: 'folder-2',
  });

  assert.deepEqual(sourceOrder, ['r1', 'r2', 'r3', 'r4', 'r5']);
  assert.deepEqual(getOrganizationVisualResumeIds(organization), sourceOrder);
  assert.deepEqual(getOrganizationVisualResumeIds(preview), ['r2', 'r3', 'r4']);
  assert.deepEqual(moved.folders['folder-2'].resumeIds, ['r1', 'r3', 'r5']);
});

test('multi-resume drag preview reserves every source cell until drop', () => {
  const organization = normalizeWorkspaceOrganization({
    rootItems: [{ type: 'folder', id: 'folder-1' }, { type: 'resume', id: 'r5' }],
    folders: {
      'folder-1': { id: 'folder-1', name: 'First', resumeIds: ['r1', 'r2', 'r3', 'r4'] },
    },
  }, ['r1', 'r2', 'r3', 'r4', 'r5']);
  const selectedIds = ['r1', 'r2', 'r3'];
  const moved = moveOrganizationResumeBundle(organization, selectedIds, {
    containerId: 'root',
    overResumeId: 'r5',
    after: true,
  });
  const preview = createResumeBundleDragPreview(organization, moved, selectedIds, 'r2');
  const sourceCells = preview.folders['folder-1'].resumeIds.slice(0, 3);

  assert.equal(sourceCells.filter(isResumeBundleSourcePlaceholder).length, 3);
  assert.equal(preview.folders['folder-1'].resumeIds[3], 'r4');
  assert.deepEqual(
    preview.rootItems.filter((item) => item.type === 'resume' && !isResumeBundleSourcePlaceholder(item.id)),
    [{ type: 'resume', id: 'r5' }, { type: 'resume', id: 'r2' }],
  );
  assert.deepEqual(organization.folders['folder-1'].resumeIds, ['r1', 'r2', 'r3', 'r4']);
});

test('organization movement transfers a resume between folders without duplicating it', () => {
  const organization = normalizeWorkspaceOrganization({
    rootItems: [
      { type: 'folder', id: 'folder-1' },
      { type: 'folder', id: 'folder-2' },
    ],
    folders: {
      'folder-1': { id: 'folder-1', name: 'One', resumeIds: ['r1', 'r2'] },
      'folder-2': { id: 'folder-2', name: 'Two', resumeIds: ['r3', 'r4'] },
    },
  }, ['r1', 'r2', 'r3', 'r4']);
  const moved = moveOrganizationResumeBundle(organization, ['r2'], {
    containerId: 'folder-2',
    overResumeId: 'r4',
  });

  assert.deepEqual(moved.folders['folder-1'].resumeIds, ['r1']);
  assert.deepEqual(moved.folders['folder-2'].resumeIds, ['r3', 'r2', 'r4']);
  assert.deepEqual(getOrganizationVisualResumeIds(moved), ['r1', 'r3', 'r2', 'r4']);
});

test('moving a resume out of a folder can place it beside its source folder', () => {
  const organization = normalizeWorkspaceOrganization({
    rootItems: [
      { type: 'resume', id: 'r1' },
      { type: 'folder', id: 'folder-1' },
      { type: 'resume', id: 'r4' },
    ],
    folders: {
      'folder-1': { id: 'folder-1', name: 'One', resumeIds: ['r2', 'r3'] },
    },
  }, ['r1', 'r2', 'r3', 'r4']);
  const moved = moveOrganizationResumeBundle(organization, ['r2'], {
    containerId: 'root',
    afterRootItem: { type: 'folder', id: 'folder-1' },
  });

  assert.deepEqual(moved.rootItems, [
    { type: 'resume', id: 'r1' },
    { type: 'folder', id: 'folder-1' },
    { type: 'resume', id: 'r2' },
    { type: 'resume', id: 'r4' },
  ]);
  assert.deepEqual(moved.folders['folder-1'].resumeIds, ['r3']);
  assert.deepEqual(getOrganizationVisualResumeIds(moved), ['r1', 'r3', 'r2', 'r4']);
});

test('resume movement can insert at root before or after a folder', () => {
  const organization = normalizeWorkspaceOrganization({
    rootItems: [
      { type: 'folder', id: 'folder-1' },
      { type: 'folder', id: 'folder-2' },
    ],
    folders: {
      'folder-1': { id: 'folder-1', name: 'One', resumeIds: ['r1'] },
      'folder-2': { id: 'folder-2', name: 'Two', resumeIds: ['r2'] },
    },
  }, ['r1', 'r2']);
  const beforeSecond = moveOrganizationResumeBundle(organization, ['r1'], {
    containerId: 'root',
    overRootItem: { type: 'folder', id: 'folder-2' },
    after: false,
  });
  const afterSecond = moveOrganizationResumeBundle(beforeSecond, ['r1'], {
    containerId: 'root',
    overRootItem: { type: 'folder', id: 'folder-2' },
    after: true,
  });

  assert.deepEqual(beforeSecond.rootItems, [
    { type: 'folder', id: 'folder-1' },
    { type: 'resume', id: 'r1' },
    { type: 'folder', id: 'folder-2' },
  ]);
  assert.deepEqual(afterSecond.rootItems, [
    { type: 'folder', id: 'folder-1' },
    { type: 'folder', id: 'folder-2' },
    { type: 'resume', id: 'r1' },
  ]);
});

test('folder resume drop intent reserves edges for root insertion', () => {
  const rect = { left: 100, right: 300, top: 40, bottom: 78 };

  assert.equal(getFolderResumeDropIntent({ x: 200, y: 59 }, rect), 'inside');
  assert.equal(getFolderResumeDropIntent({ x: 110, y: 59 }, rect), 'before');
  assert.equal(getFolderResumeDropIntent({ x: 290, y: 59 }, rect), 'after');
  assert.equal(getFolderResumeDropIntent({ x: 200, y: 35 }, rect), 'before');
  assert.equal(getFolderResumeDropIntent({ x: 200, y: 83 }, rect), 'after');
});

test('root folder-edge placement wins over an expanded folder collision', () => {
  const rootDestination = {
    type: 'root',
    insertionIndex: 1,
    targetItem: { type: 'folder', id: 'folder-2' },
    position: 'before',
    folderEdgeIntent: 'before',
  };
  const openFolderDestination = {
    type: 'folder',
    folderId: 'folder-1',
    insertionIndex: 2,
  };

  assert.deepEqual(
    chooseResumePointerDestination(rootDestination, openFolderDestination),
    { rootDestination, openFolderDestination: null },
  );
});

test('expanded folder contents still win away from a root folder edge', () => {
  const rootDestination = {
    type: 'root',
    insertionIndex: 1,
    targetItem: { type: 'folder', id: 'folder-1' },
    position: 'before',
  };
  const openFolderDestination = {
    type: 'folder',
    folderId: 'folder-1',
    insertionIndex: 2,
  };

  assert.deepEqual(
    chooseResumePointerDestination(rootDestination, openFolderDestination),
    { rootDestination: null, openFolderDestination },
  );
});

test('auto-opening a folder cannot replace a between-folders root destination', () => {
  const resumeIds = ['r1', 'r2', 'r3', 'r4', 'r5'];
  const organization = normalizeWorkspaceOrganization({
    rootItems: [
      { type: 'resume', id: 'r1' },
      { type: 'folder', id: 'folder-1' },
      { type: 'folder', id: 'folder-2' },
    ],
    folders: {
      'folder-1': { id: 'folder-1', name: 'First', resumeIds: ['r2', 'r3'] },
      'folder-2': { id: 'folder-2', name: 'Second', resumeIds: ['r4', 'r5'] },
    },
  }, resumeIds);
  const metrics = getRailGridMetrics({ left: 0, top: 0, width: 800 }, 4);
  const pointer = {
    x: metrics.left + metrics.columnStride - 2,
    y: metrics.top + 19,
  };
  const common = {
    pointer,
    baseOrganization: organization,
    draggedItem: { type: 'resume', id: 'r1' },
    draggedResumeIds: ['r1'],
    columns: 4,
    metrics,
  };
  const rootDestination = getRootPointerDestination({
    ...common,
    openFolderIds: new Set(),
  });
  const openFolderDestination = getOpenFolderPointerDestination({
    ...common,
    currentOrganization: organization,
    openFolderIds: new Set(['folder-1']),
  });
  const chosen = chooseResumePointerDestination(rootDestination, openFolderDestination);
  const moved = applyRootPointerDestination(
    organization,
    common.draggedItem,
    common.draggedResumeIds,
    chosen.rootDestination,
  );

  assert.equal(rootDestination.folderEdgeIntent, 'before');
  assert.equal(openFolderDestination.folderId, 'folder-1');
  assert.equal(chosen.openFolderDestination, null);
  assert.deepEqual(moved.rootItems, [
    { type: 'folder', id: 'folder-1' },
    { type: 'resume', id: 'r1' },
    { type: 'folder', id: 'folder-2' },
  ]);
});

test('a resume dropped left of a first-column folder stays at root', () => {
  const rootResumeIds = ['r1', 'r2', 'r3', 'r4'];
  const resumeIds = [...rootResumeIds, 'dragged', 'folder-child'];
  const organization = normalizeWorkspaceOrganization({
    rootItems: [
      ...rootResumeIds.map((id) => ({ type: 'resume', id })),
      { type: 'folder', id: 'folder-1' },
      { type: 'resume', id: 'dragged' },
    ],
    folders: {
      'folder-1': { id: 'folder-1', name: 'Folder', resumeIds: ['folder-child'] },
    },
  }, resumeIds);
  const metrics = getRailGridMetrics({ left: 0, top: 0, width: 800 }, 4);
  const pointer = {
    x: metrics.left + 4,
    y: metrics.top + metrics.rowStride + 19,
  };
  const common = {
    pointer,
    baseOrganization: organization,
    draggedItem: { type: 'resume', id: 'dragged' },
    draggedResumeIds: ['dragged'],
    columns: 4,
    metrics,
  };
  const rootDestination = getRootPointerDestination({
    ...common,
    openFolderIds: new Set(),
  });
  const openFolderDestination = getOpenFolderPointerDestination({
    ...common,
    currentOrganization: organization,
    openFolderIds: new Set(['folder-1']),
  });
  const chosen = chooseResumePointerDestination(rootDestination, openFolderDestination);
  const moved = applyRootPointerDestination(
    organization,
    common.draggedItem,
    common.draggedResumeIds,
    chosen.rootDestination,
  );

  assert.equal(chosen.rootDestination.targetItem.id, 'folder-1');
  assert.equal(chosen.rootDestination.position, 'before');
  assert.deepEqual(moved.rootItems.slice(-2), [
    { type: 'resume', id: 'dragged' },
    { type: 'folder', id: 'folder-1' },
  ]);
  assert.deepEqual(moved.folders['folder-1'].resumeIds, ['folder-child']);
});

test('open-folder collision only includes visibly painted folder cells', () => {
  const placement = {
    isOpen: true,
    width: 4,
    height: 2,
    surfaceRows: [
      { row: 0, column: 1, span: 3 },
      { row: 1, column: 0, span: 1 },
    ],
  };
  const rect = { left: 100, top: 50, width: 400, height: 83 };

  assert.equal(isPointerWithinFolderPlacementSurface({ x: 255, y: 69 }, rect, placement), true);
  assert.equal(isPointerWithinFolderPlacementSurface({ x: 150, y: 69 }, rect, placement), false);
  assert.equal(isPointerWithinFolderPlacementSurface({ x: 150, y: 114 }, rect, placement), true);
  assert.equal(isPointerWithinFolderPlacementSurface({ x: 255, y: 114 }, rect, placement), false);
  assert.equal(isPointerWithinFolderPlacementSurface({ x: 201, y: 69 }, rect, placement), false);
  assert.equal(
    isPointerWithinFolderPlacementSurface({ x: 201, y: 69 }, rect, placement, { includeGaps: true }),
    true,
  );
  assert.equal(
    isPointerWithinFolderPlacementSurface({ x: 150, y: 69 }, rect, placement, { includeGaps: true }),
    false,
  );
});

test('auto-open folder collision cells use their final grid positions', () => {
  const placement = {
    isOpen: true,
    width: 4,
    tile: { row: 0, column: 1 },
    children: [{ resumeId: 'r1', row: 0, column: 2 }],
  };
  const rect = { left: 100, top: 50, width: 400, height: 38 };

  assert.deepEqual(getFolderPlacementCellRect(rect, placement, placement.tile), {
    x: 201.75,
    y: 50,
    top: 50,
    right: 296.5,
    bottom: 88,
    left: 201.75,
    width: 94.75,
    height: 38,
  });
  assert.equal(getFolderPlacementCellRect(rect, placement, placement.children[0]).left, 303.5);
});

test('folder resume insertion gives each child cell one stable destination', () => {
  const rect = { left: 100, top: 50, width: 400, height: 83 };
  const sameRowPlacement = {
    isOpen: true,
    width: 4,
    tile: { row: 0, column: 1 },
  };

  assert.equal(getFolderResumeInsertionIndex({ x: 320, y: 69 }, rect, sameRowPlacement, 2), 0);
  assert.equal(getFolderResumeInsertionIndex({ x: 380, y: 69 }, rect, sameRowPlacement, 2), 0);
  assert.equal(getFolderResumeInsertionIndex({ x: 420, y: 69 }, rect, sameRowPlacement, 2), 1);
  assert.equal(getFolderResumeInsertionIndex({ x: 485, y: 69 }, rect, sameRowPlacement, 2), 2);

  const wrappedPlacement = {
    isOpen: true,
    width: 4,
    tile: { row: 0, column: 3 },
  };

  assert.equal(getFolderResumeInsertionIndex({ x: 120, y: 114 }, rect, wrappedPlacement, 2), 0);
  assert.equal(getFolderResumeInsertionIndex({ x: 180, y: 114 }, rect, wrappedPlacement, 2), 0);
  assert.equal(getFolderResumeInsertionIndex({ x: 220, y: 114 }, rect, wrappedPlacement, 2), 1);
  assert.equal(getFolderResumeInsertionIndex({ x: 285, y: 114 }, rect, wrappedPlacement, 2), 2);
  assert.equal(getFolderResumeInsertionIndex({ x: 200, y: 69 }, rect, sameRowPlacement, 0), 0);
  assert.equal(getFolderResumeInsertionIndex(null, rect, sameRowPlacement, 2), null);
});

test('root folder movement never nests folders and preserves the moved folder contents', () => {
  const organization = normalizeWorkspaceOrganization({
    rootItems: [
      { type: 'folder', id: 'folder-1' },
      { type: 'resume', id: 'r3' },
      { type: 'folder', id: 'folder-2' },
    ],
    folders: {
      'folder-1': { id: 'folder-1', name: 'One', resumeIds: ['r1'] },
      'folder-2': { id: 'folder-2', name: 'Two', resumeIds: ['r2'] },
    },
  }, ['r1', 'r2', 'r3']);
  const moved = moveOrganizationRootItem(
    organization,
    { type: 'folder', id: 'folder-2' },
    { type: 'resume', id: 'r3' },
    false,
  );

  assert.deepEqual(moved.rootItems, [
    { type: 'folder', id: 'folder-1' },
    { type: 'folder', id: 'folder-2' },
    { type: 'resume', id: 'r3' },
  ]);
  assert.deepEqual(moved.folders['folder-2'].resumeIds, ['r2']);
});

test('root folder movement ignores its own drop target', () => {
  const organization = normalizeWorkspaceOrganization({
    rootItems: [
      { type: 'resume', id: 'r1' },
      { type: 'folder', id: 'folder-1' },
      { type: 'resume', id: 'r2' },
    ],
    folders: {
      'folder-1': { id: 'folder-1', name: 'Folder', resumeIds: ['r3'] },
    },
  }, ['r1', 'r2', 'r3']);
  const unchanged = moveOrganizationRootItem(
    organization,
    { type: 'folder', id: 'folder-1' },
    { type: 'folder', id: 'folder-1' },
    true,
  );

  assert.equal(unchanged, organization);
  assert.deepEqual(unchanged.rootItems, organization.rootItems);
});

test('root resume and folder movement accept deterministic insertion indexes', () => {
  const organization = normalizeWorkspaceOrganization({
    rootItems: [
      { type: 'resume', id: 'r1' },
      { type: 'folder', id: 'folder-1' },
      { type: 'resume', id: 'r3' },
    ],
    folders: {
      'folder-1': { id: 'folder-1', name: 'Folder', resumeIds: ['r2'] },
    },
  }, ['r1', 'r2', 'r3']);
  const resumeFirst = moveOrganizationResumeBundle(organization, ['r3'], {
    containerId: 'root',
    rootIndex: 0,
  });
  const folderFirst = moveOrganizationRootItemToIndex(
    resumeFirst,
    { type: 'folder', id: 'folder-1' },
    0,
  );

  assert.deepEqual(resumeFirst.rootItems, [
    { type: 'resume', id: 'r3' },
    { type: 'resume', id: 'r1' },
    { type: 'folder', id: 'folder-1' },
  ]);
  assert.deepEqual(folderFirst.rootItems, [
    { type: 'folder', id: 'folder-1' },
    { type: 'resume', id: 'r3' },
    { type: 'resume', id: 'r1' },
  ]);
  assert.deepEqual(folderFirst.folders['folder-1'].resumeIds, ['r2']);
});

function railPlacementsOverlap(first, second) {
  const getCells = (placement) => new Set(
    placement.isOpen
      ? placement.surfaceRows.flatMap((surfaceRow) => (
        Array.from({ length: surfaceRow.span }, (_, offset) => (
          `${placement.row + surfaceRow.row}:${surfaceRow.column + offset}`
        ))
      ))
      : [`${placement.row + (placement.tile?.row || 0)}:${placement.tile?.column ?? placement.column}`],
  );
  const firstCells = getCells(first);
  return [...getCells(second)].some((cell) => firstCells.has(cell));
}

test('resume rail cluster packing stays bounded and collision-free from two through six columns', () => {
  const organization = normalizeWorkspaceOrganization({
    rootItems: [
      { type: 'folder', id: 'folder-1' },
      { type: 'resume', id: 'r4' },
      { type: 'folder', id: 'folder-2' },
      { type: 'resume', id: 'r5' },
    ],
    folders: {
      'folder-1': { id: 'folder-1', name: 'One', resumeIds: ['r1', 'r2'] },
      'folder-2': { id: 'folder-2', name: 'Two', resumeIds: ['r3'] },
    },
  }, ['r1', 'r2', 'r3', 'r4', 'r5']);

  [2, 3, 4, 5, 6].forEach((columns) => {
    const layout = buildResumeRailLayout(organization, new Set(['folder-1', 'folder-2']), columns);
    const folderPlacements = layout.placements.filter((placement) => placement.item.type === 'folder');

    assert.equal(folderPlacements.length, 2);
    layout.placements.forEach((placement, index) => {
      assert.ok(placement.column >= 0);
      assert.ok(placement.column + placement.width <= columns);
      assert.ok(placement.row >= 0);
      assert.ok(placement.row + placement.height <= layout.rowCount);
      layout.placements.slice(index + 1).forEach((otherPlacement) => {
        assert.equal(railPlacementsOverlap(placement, otherPlacement), false);
      });
    });
    folderPlacements.forEach((placement) => {
      const folder = organization.folders[placement.folderId];
      assert.equal(placement.isOpen, true);
      assert.equal(placement.children.length, folder.resumeIds.length);
      assert.ok(placement.width * placement.height >= folder.resumeIds.length + 1);
    });
  });
});

test('each open folder tile stays immediately before its resumes in the cell stream', () => {
  const organization = normalizeWorkspaceOrganization({
    rootItems: [
      { type: 'folder', id: 'folder-1' },
      { type: 'folder', id: 'folder-2' },
    ],
    folders: {
      'folder-1': { id: 'folder-1', name: 'One', resumeIds: ['r1', 'r2'] },
      'folder-2': { id: 'folder-2', name: 'Two', resumeIds: ['r3', 'r4', 'r5', 'r6', 'r7'] },
    },
  }, ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7']);
  const layout = buildResumeRailLayout(organization, new Set(['folder-1', 'folder-2']), 6);
  const first = layout.placements.find((placement) => placement.folderId === 'folder-1');
  const second = layout.placements.find((placement) => placement.folderId === 'folder-2');

  assert.deepEqual({ row: first.row, column: first.column, width: first.width, height: first.height }, {
    row: 0, column: 0, width: 6, height: 1,
  });
  assert.equal(first.tile.column, 0);
  assert.deepEqual({ row: second.row, column: second.column, width: second.width, height: second.height }, {
    row: 0, column: 0, width: 6, height: 2,
  });
  assert.equal(second.tile.column, 3);
  assert.deepEqual(second.children.map(({ row, column }) => ({ row, column })), [
    { row: 0, column: 4 },
    { row: 0, column: 5 },
    { row: 1, column: 0 },
    { row: 1, column: 1 },
    { row: 1, column: 2 },
  ]);
  assert.equal(railPlacementsOverlap(first, second), false);
});

test('the 2 5 2 2 2 folder case flows continuously without reserving empty cells', () => {
  const resumeIds = Array.from({ length: 13 }, (_, index) => `r${index + 1}`);
  const organization = normalizeWorkspaceOrganization({
    rootItems: [1, 2, 3, 4, 5].map((index) => ({ type: 'folder', id: `folder-${index}` })),
    folders: {
      'folder-1': { id: 'folder-1', name: 'One', resumeIds: ['r1', 'r2'] },
      'folder-2': { id: 'folder-2', name: 'Two', resumeIds: ['r3', 'r4', 'r5', 'r6', 'r7'] },
      'folder-3': { id: 'folder-3', name: 'Three', resumeIds: ['r8', 'r9'] },
      'folder-4': { id: 'folder-4', name: 'Four', resumeIds: ['r10', 'r11'] },
      'folder-5': { id: 'folder-5', name: 'Five', resumeIds: ['r12', 'r13'] },
    },
  }, resumeIds);
  const layout = buildResumeRailLayout(
    organization,
    new Set(['folder-1', 'folder-2', 'folder-3', 'folder-4', 'folder-5']),
    6,
  );

  assert.equal(layout.rowCount, 3);
  assert.equal(layout.placements.length, 5);
  assert.deepEqual(
    layout.placements.map((placement) => ({
      id: placement.folderId,
      row: placement.row,
      column: placement.column,
      width: placement.width,
      height: placement.height,
    })),
    [
      { id: 'folder-1', row: 0, column: 0, width: 6, height: 1 },
      { id: 'folder-2', row: 0, column: 0, width: 6, height: 2 },
      { id: 'folder-3', row: 1, column: 0, width: 6, height: 1 },
      { id: 'folder-4', row: 2, column: 0, width: 6, height: 1 },
      { id: 'folder-5', row: 2, column: 0, width: 6, height: 1 },
    ],
  );
  assert.deepEqual(layout.placements.map((placement) => placement.tile.column), [0, 3, 3, 0, 3]);
  layout.placements.forEach((placement, index) => {
    const occupiedCells = [placement.tile, ...placement.children]
      .map((cell) => `${cell.row}:${cell.column}`);
    assert.equal(new Set(occupiedCells).size, occupiedCells.length);
    assert.equal(placement.children.length, organization.folders[placement.folderId].resumeIds.length);
    layout.placements.slice(index + 1).forEach((otherPlacement) => {
      assert.equal(railPlacementsOverlap(placement, otherPlacement), false);
    });
  });
});

test('the next folder starts immediately after a wrapped open folder', () => {
  const resumeIds = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6'];
  const organization = normalizeWorkspaceOrganization({
    rootItems: [
      { type: 'folder', id: 'folder-1' },
      { type: 'folder', id: 'folder-2' },
      { type: 'folder', id: 'folder-3' },
    ],
    folders: {
      'folder-1': { id: 'folder-1', name: 'One', resumeIds: ['r1'] },
      'folder-2': { id: 'folder-2', name: 'Two', resumeIds: ['r2', 'r3', 'r4', 'r5', 'r6'] },
      'folder-3': { id: 'folder-3', name: 'Three', resumeIds: [] },
    },
  }, resumeIds);
  const layout = buildResumeRailLayout(
    organization,
    new Set(['folder-1', 'folder-2']),
    6,
  );
  const second = layout.placements.find((placement) => placement.folderId === 'folder-2');
  const third = layout.placements.find((placement) => placement.folderId === 'folder-3');

  assert.deepEqual(second.surfaceRows, [
    { row: 0, column: 2, span: 4 },
    { row: 1, column: 0, span: 2 },
  ]);
  assert.deepEqual({
    row: third.row + third.tile.row,
    column: third.tile.column,
  }, { row: 1, column: 2 });
  assert.equal(layout.rowCount, 2);
});

test('open folder resumes wrap horizontally across as many full-width rows as needed', () => {
  const resumeIds = Array.from({ length: 8 }, (_, index) => `r${index + 1}`);
  const organization = normalizeWorkspaceOrganization({
    rootItems: [{ type: 'folder', id: 'folder-1' }],
    folders: {
      'folder-1': { id: 'folder-1', name: 'One', resumeIds },
    },
  }, resumeIds);
  const layout = buildResumeRailLayout(organization, new Set(['folder-1']), 3);
  const [folder] = layout.placements;

  assert.deepEqual({ row: folder.row, column: folder.column, width: folder.width, height: folder.height }, {
    row: 0, column: 0, width: 3, height: 3,
  });
  assert.deepEqual(folder.children.map(({ row, column }) => ({ row, column })), [
    { row: 0, column: 1 },
    { row: 0, column: 2 },
    { row: 1, column: 0 },
    { row: 1, column: 1 },
    { row: 1, column: 2 },
    { row: 2, column: 0 },
    { row: 2, column: 1 },
    { row: 2, column: 2 },
  ]);
  assert.equal(layout.rowCount, 3);
});

test('workspace batch deletion preserves order and an active resume that survives', () => {
  const workspace = createWorkspace(['r1', 'r2', 'r3', 'r4'], { activeResumeId: 'r2' });
  const result = removeWorkspaceResumes(workspace, ['r4', 'r1']);

  assert.deepEqual(result.deletedResumeIds, ['r1', 'r4']);
  assert.deepEqual(result.workspace.resumeIds, ['r2', 'r3']);
  assert.equal(result.workspace.activeResumeId, 'r2');
  assert.equal(result.workspace.meta.r1, undefined);
  assert.equal(result.rejectedReason, '');
});

test('workspace batch deletion chooses the next ordered resume when active is deleted', () => {
  const workspace = createWorkspace(['r1', 'r2', 'r3', 'r4'], { activeResumeId: 'r2' });
  const result = removeWorkspaceResumes(workspace, ['r2', 'r4']);

  assert.deepEqual(result.workspace.resumeIds, ['r1', 'r3']);
  assert.equal(result.workspace.activeResumeId, 'r3');
});

test('workspace batch deletion ignores stale ids and refuses to remove every resume', () => {
  const workspace = createWorkspace(['r1', 'r2'], { activeResumeId: 'r1' });
  const staleResult = removeWorkspaceResumes(workspace, ['missing', 'r2', 'missing']);
  const rejectedResult = removeWorkspaceResumes(workspace, ['r2', 'r1', 'missing']);
  const emptyResult = removeWorkspaceResumes(workspace, ['missing']);

  assert.deepEqual(staleResult.deletedResumeIds, ['r2']);
  assert.deepEqual(staleResult.workspace.resumeIds, ['r1']);
  assert.equal(rejectedResult.rejectedReason, 'all');
  assert.deepEqual(rejectedResult.workspace.resumeIds, ['r1', 'r2']);
  assert.equal(emptyResult.rejectedReason, 'empty');
});

test('local batch deletion accepts one normalized workspace snapshot without browser storage', async () => {
  const workspace = createWorkspace(['r1', 'r3'], { activeResumeId: 'r3' });
  const persistedWorkspace = await persistLocalResumeBatchDelete({
    resumeIds: ['r2', 'r2'],
    workspace,
    enqueueSync: false,
  });

  assert.deepEqual(persistedWorkspace.resumeIds, ['r1', 'r3']);
  assert.equal(persistedWorkspace.activeResumeId, 'r3');
});
test('resume rail uses stable container-driven columns instead of viewport-sized tiles', () => {
  const railCss = fs.readFileSync('src/styles/workspace-rail.css', 'utf8');
  const railComponent = fs.readFileSync('src/components/resumeWorkspaceRail.jsx', 'utf8');
  const railView = fs.readFileSync('src/components/resumeWorkspaceRailView.jsx', 'utf8');
  const railDrag = fs.readFileSync('src/components/resumeWorkspaceRailDrag.js', 'utf8');

  assert.match(railCss, /\.resumeSubbar\s*\{[\s\S]*?container-name:\s*resume-rail/);
  assert.match(railCss, /\.resumePillStrip\s*\{[\s\S]*?--resume-rail-columns:\s*2/);
  assert.match(railCss, /grid-template-columns:\s*repeat\(var\(--resume-rail-columns\),\s*minmax\(0,\s*1fr\)\)/);
  assert.match(railCss, /\.resumePillStrip\s*\{[\s\S]*?row-gap:\s*7px/);
  assert.match(railCss, /\.resumePillStrip\s*\{[\s\S]*?grid-auto-rows:\s*38px/);
  assert.match(railCss, /@container resume-rail \(min-width:\s*1030px\)\s*\{[\s\S]*?--resume-rail-columns:\s*6/);
  assert.match(railCss, /\.resumePill\s*\{[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*0/);
  assert.match(railCss, /\.resumeNewButton\s*\{[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*0/);
  assert.match(railCss, /\.resumeRailCell:has\(\.entryMenu\.isOpen\)\s*\{[\s\S]*?z-index:\s*60/);
  assert.match(railView, /animateLayoutChanges:\s*disableSortableLayoutAnimation/);
  assert.match(railComponent, /buildResumeRailLayout\(layoutOrganization, displayedOpenFolderIds, columns\)/);
  assert.match(railView, /placement\.surfaceRows\.map\([\s\S]*?className="resumeFolderClusterSurface"/);
  assert.match(railView, /dragDisabled=\{isRenaming \|\| isOpen \|\| isTransitioning\}/);
  assert.match(railView, /const animationOrder = placement\.children\.length - index - 1/);
  assert.match(railView, /delay: shouldReduceMotion \? 0 : index \* itemStagger/);
  assert.match(railComponent, /validClosingFolderSnapshots\.values\(\)[\s\S]*?<ClosingFolderLayer/);
  assert.match(railComponent, /onDragMove=\{handleDragMove\}/);
  assert.doesNotMatch(railComponent, /onDragOver=/);
  assert.match(railDrag, /getFolderResumeInsertionIndex\(pointer, rect, placement, targetCount\)/);
  assert.match(railDrag, /getFolderPlacementRect\(metrics, placement\)/);
  assert.doesNotMatch(railComponent, /dragOverTargetRef|stableItemCollisionRef/);
  assert.match(railComponent, /<SortableContext items=\{rootSortableIds\} strategy=\{railSortingStrategy\}>/);
  assert.match(railComponent, /dragCollisionRectsRef/);
  assert.match(railComponent, /suppressedActiveFolderKey !== activeFolderKey/);
  assert.doesNotMatch(railComponent, /rectSortingStrategy/);
  assert.match(railComponent, /from '\.\/resumeWorkspaceRailDrag\.js'/);
  assert.match(railComponent, /from '\.\/resumeWorkspaceRailView\.jsx'/);
});

test('resume rail cells use stable destinations and New is the dedicated terminal target', () => {
  const rootItems = Array.from({ length: 7 }, (_, index) => ({
    type: 'resume',
    id: `resume-${index + 1}`,
  }));
  const organization = normalizeWorkspaceOrganization({ rootItems, folders: {} }, rootItems.map((item) => item.id));
  const metrics = getRailGridMetrics({ left: 0, top: 0, width: 1200 }, 6);
  const finalItemY = metrics.top + metrics.rowStride * 0.4;
  const finalItemLeftX = metrics.left + metrics.columnStride * 5 + metrics.cellWidth * 0.1;
  const finalItemRightX = metrics.left + metrics.columnStride * 5 + metrics.cellWidth * 0.9;
  const terminalRowY = metrics.top + metrics.rowStride * 1.4;
  const terminalCellX = metrics.left + metrics.cellWidth * 0.5;
  const options = {
    baseOrganization: organization,
    draggedItem: rootItems[0],
    draggedResumeIds: [rootItems[0].id],
    openFolderIds: new Set(),
    columns: 6,
    metrics,
  };

  const finalItemFromLeft = getRootPointerDestination({
    ...options,
    pointer: { x: finalItemLeftX, y: finalItemY },
  });
  const finalItemFromRight = getRootPointerDestination({
    ...options,
    pointer: { x: finalItemRightX, y: finalItemY },
  });
  const afterFinal = getRootPointerDestination({
    ...options,
    pointer: { x: terminalCellX, y: terminalRowY },
  });

  assert.equal(finalItemFromLeft.insertionIndex, 5);
  assert.equal(finalItemFromLeft.position, 'before');
  assert.equal(finalItemFromLeft.targetItem.id, 'resume-7');
  assert.equal(finalItemFromRight.insertionIndex, 5);
  assert.equal(finalItemFromRight.position, 'before');
  assert.equal(finalItemFromRight.targetItem.id, 'resume-7');
  assert.equal(afterFinal.insertionIndex, 6);
  assert.equal(afterFinal.position, 'after');
  assert.equal(afterFinal.targetItem.id, 'resume-7');
});

test('root resume placement changes symmetrically at adjacent cell boundaries', () => {
  const resumeIds = ['r1', 'r2', 'r3', 'r4'];
  const organization = normalizeWorkspaceOrganization({
    rootItems: resumeIds.map((id) => ({ type: 'resume', id })),
    folders: {},
  }, resumeIds);
  const metrics = getRailGridMetrics({ left: 0, top: 0, width: 800 }, 4);
  const options = {
    baseOrganization: organization,
    draggedItem: { type: 'resume', id: 'r2' },
    draggedResumeIds: ['r2'],
    openFolderIds: new Set(),
    columns: 4,
    metrics,
  };
  const pointerY = metrics.top + 19;
  const previousCell = getRootPointerDestination({
    ...options,
    pointer: { x: metrics.left + metrics.cellWidth - 1, y: pointerY },
  });
  const sourceCell = getRootPointerDestination({
    ...options,
    pointer: { x: metrics.left + metrics.columnStride + 1, y: pointerY },
  });
  const nextCell = getRootPointerDestination({
    ...options,
    pointer: { x: metrics.left + metrics.columnStride * 2 + 1, y: pointerY },
  });

  assert.deepEqual(
    applyRootPointerDestination(organization, options.draggedItem, ['r2'], previousCell)
      .rootItems.map((item) => item.id),
    ['r2', 'r1', 'r3', 'r4'],
  );
  assert.deepEqual(
    applyRootPointerDestination(organization, options.draggedItem, ['r2'], sourceCell)
      .rootItems.map((item) => item.id),
    ['r1', 'r2', 'r3', 'r4'],
  );
  assert.deepEqual(
    applyRootPointerDestination(organization, options.draggedItem, ['r2'], nextCell)
      .rootItems.map((item) => item.id),
    ['r1', 'r3', 'r2', 'r4'],
  );
});

test('multi-resume root hit testing uses the same source-reserved layout as its preview', () => {
  const rootItems = ['r1', 'r2', 'r3', 'r4', 'r5'].map((id) => ({ type: 'resume', id }));
  const organization = normalizeWorkspaceOrganization(
    { rootItems, folders: {} },
    rootItems.map((item) => item.id),
  );
  const draggedResumeIds = ['r1', 'r2', 'r3'];
  const metrics = getRailGridMetrics({ left: 0, top: 0, width: 1000 }, 5);
  draggedResumeIds.forEach((activeResumeId) => {
    const destination = getRootPointerDestination({
      pointer: {
        x: metrics.left + metrics.columnStride * 4 + metrics.cellWidth * 0.25,
        y: metrics.top + 19,
      },
      baseOrganization: organization,
      draggedItem: { type: 'resume', id: activeResumeId },
      draggedResumeIds,
      openFolderIds: new Set(),
      columns: 5,
      metrics,
      preserveSourceSlots: true,
    });
    const moved = applyRootPointerDestination(
      organization,
      { type: 'resume', id: activeResumeId },
      draggedResumeIds,
      destination,
    );
    const preview = createResumeBundleDragPreview(
      organization,
      moved,
      draggedResumeIds,
      activeResumeId,
    );

    assert.equal(destination.insertionIndex, 4);
    assert.deepEqual(moved.rootItems.map((item) => item.id), ['r4', 'r1', 'r2', 'r3', 'r5']);
    assert.equal(getOrganizationResumePlacement(preview, activeResumeId).index, 4);
  });
});

test('multi-resume folder hit testing stays aligned while source cells remain reserved', () => {
  const resumeIds = ['r1', 'r2', 'r3', 'r4', 'r5'];
  const organization = normalizeWorkspaceOrganization({
    rootItems: [{ type: 'folder', id: 'folder-1' }],
    folders: {
      'folder-1': { id: 'folder-1', name: 'Folder', resumeIds },
    },
  }, resumeIds);
  const draggedResumeIds = ['r1', 'r2', 'r3'];
  const openFolderIds = new Set(['folder-1']);
  const columns = 5;
  const metrics = getRailGridMetrics({ left: 0, top: 0, width: 1000 }, columns);
  draggedResumeIds.forEach((activeResumeId) => {
    const sourcePreview = createResumeBundleDragPreview(
      organization,
      organization,
      draggedResumeIds,
      activeResumeId,
    );
    const placement = buildResumeRailLayout(sourcePreview, openFolderIds, columns).placements[0];
    const folderRect = {
      left: metrics.left,
      top: metrics.top,
      width: metrics.width,
      height: placement.height * 38 + Math.max(0, placement.height - 1) * 7,
    };
    const finalChildCell = placement.children[4];
    const finalChildRect = getFolderPlacementCellRect(folderRect, placement, finalChildCell);
    const destination = getOpenFolderPointerDestination({
      pointer: { x: finalChildRect.left + finalChildRect.width * 0.25, y: finalChildRect.top + 19 },
      baseOrganization: organization,
      currentOrganization: sourcePreview,
      draggedResumeIds,
      openFolderIds,
      columns,
      metrics,
      preserveSourceSlots: true,
      activeResumeId,
    });
    const moved = applyOpenFolderPointerDestination(organization, draggedResumeIds, destination);
    const preview = createResumeBundleDragPreview(
      organization,
      moved,
      draggedResumeIds,
      activeResumeId,
    );

    assert.equal(destination.insertionIndex, 4);
    assert.deepEqual(moved.folders['folder-1'].resumeIds, ['r4', 'r1', 'r2', 'r3', 'r5']);
    assert.equal(getOrganizationResumePlacement(preview, activeResumeId).index, 4);
  });
});
