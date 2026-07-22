import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';

import {
  createSavedDraftState,
  createUnsyncedDraftCopyState,
} from '../src/lib/draftState.js';
import {
  deleteLocalWorkspaceDatabase,
  initializeLocalWorkspace,
  markOutboxFailed,
  markOutboxSynced,
  persistLoginMergedWorkspace,
  persistLocalDraftSnapshot,
  persistLocalResumeBatchDelete,
  persistLocalWorkspaceSnapshot,
  readDurableLocalBrowserContext,
  readLocalAccountBinding,
  readLocalDraft,
  readLocalWorkspaceBundle,
  readPendingOutbox,
  setSyncSessionCleanupRequested,
} from '../src/lib/localWorkspaceDb.js';
import {
  createWorkspaceResumeMeta,
  normalizeWorkspaceIndex,
  removeWorkspaceResumes,
} from '../src/lib/workspace.js';

class MemoryStorage {
  #values = new Map();

  get length() {
    return this.#values.size;
  }

  key(index) {
    return Array.from(this.#values.keys())[index] ?? null;
  }

  getItem(key) {
    return this.#values.has(key) ? this.#values.get(key) : null;
  }

  setItem(key, value) {
    this.#values.set(String(key), String(value));
  }

  removeItem(key) {
    this.#values.delete(String(key));
  }
}

beforeEach(async () => {
  globalThis.window = {
    localStorage: new MemoryStorage(),
  };
  await deleteLocalWorkspaceDatabase().catch(() => null);
});

afterEach(async () => {
  await deleteLocalWorkspaceDatabase().catch(() => null);
  delete globalThis.window;
});

function addResumeToWorkspace(workspace, resumeId, updatedAt) {
  return normalizeWorkspaceIndex({
    ...workspace,
    resumeIds: [...workspace.resumeIds, resumeId],
    meta: {
      ...workspace.meta,
      [resumeId]: createWorkspaceResumeMeta(resumeId, updatedAt),
    },
  });
}

test('divergent tab workspace writes preserve both additions', async () => {
  const initial = await initializeLocalWorkspace();
  const tabAWorkspace = addResumeToWorkspace(initial.workspace, 'tab-a-resume', '2026-07-21T10:00:00.000Z');
  const tabBWorkspace = addResumeToWorkspace(initial.workspace, 'tab-b-resume', '2026-07-21T10:00:01.000Z');

  await Promise.all([
    persistLocalWorkspaceSnapshot({ workspace: tabAWorkspace, enqueueSync: false }),
    persistLocalWorkspaceSnapshot({ workspace: tabBWorkspace, enqueueSync: false }),
  ]);

  const bundle = await readLocalWorkspaceBundle();

  assert.equal(bundle.workspace.resumeIds.includes('tab-a-resume'), true);
  assert.equal(bundle.workspace.resumeIds.includes('tab-b-resume'), true);
});

test('content-only draft saves persist workspace metadata locally without queueing a cloud workspace write', async () => {
  const initial = await initializeLocalWorkspace();
  const resumeId = initial.activeResumeId;
  const updatedAt = '2026-07-22T14:00:00.000Z';
  const workspace = normalizeWorkspaceIndex({
    ...initial.workspace,
    meta: {
      ...initial.workspace.meta,
      [resumeId]: {
        ...initial.workspace.meta[resumeId],
        updatedAt,
      },
    },
  });
  const contentSave = await persistLocalDraftSnapshot({
    resumeId,
    workspace,
    draft: createSavedDraftState(initial.draft),
    accountUid: 'account-a',
  });
  const contentOperations = await readPendingOutbox({ accountUid: 'account-a' });
  const localBundle = await readLocalWorkspaceBundle();

  assert.deepEqual(contentOperations.map((operation) => operation.type), ['upsertDraft']);
  assert.equal(localBundle.workspace.meta[resumeId].updatedAt, updatedAt);

  await persistLocalDraftSnapshot({
    resumeId,
    workspace: contentSave.workspace,
    draft: createSavedDraftState(contentSave.draft),
    accountUid: 'account-a',
    enqueueWorkspaceSync: true,
    expectedRevision: contentSave.draft.localRevision,
  });

  const structuralOperations = await readPendingOutbox({ accountUid: 'account-a' });

  assert.deepEqual(
    structuralOperations.map((operation) => operation.type).sort(),
    ['upsertDraft', 'workspace'],
  );
});

test('summary heading metadata round trips as draft content without queueing a workspace write', async () => {
  const initial = await initializeLocalWorkspace();
  const resumeId = initial.activeResumeId;
  const nextDraft = createSavedDraftState({
    ...initial.draft,
    resume: {
      ...initial.draft.resume,
      personal: {
        ...initial.draft.resume.personal,
        aboutMe: 'Product engineer focused on reliable interfaces.',
        summaryTitle: 'Profile',
      },
      settings: {
        ...initial.draft.resume.settings,
        showSummaryTitle: true,
        sectionHeadingAlignment: 'center',
      },
    },
  });

  await persistLocalDraftSnapshot({
    resumeId,
    workspace: initial.workspace,
    draft: nextDraft,
    accountUid: 'account-a',
    expectedRevision: initial.draft.localRevision || '',
  });

  const storedDraft = await readLocalDraft(resumeId);
  const operations = await readPendingOutbox({ accountUid: 'account-a' });

  assert.equal(storedDraft.resume.personal.summaryTitle, 'Profile');
  assert.equal(storedDraft.resume.settings.showSummaryTitle, true);
  assert.equal(storedDraft.resume.settings.sectionHeadingAlignment, 'center');
  assert.deepEqual(operations.map((operation) => operation.type), ['upsertDraft']);
});

test('a draft copied to a new resume id starts with fresh local and cloud identity', async () => {
  const initial = await initializeLocalWorkspace();
  const copyResumeId = 'copied-resume';
  const sourceDraft = {
    ...createSavedDraftState(initial.draft),
    localRevision: 'source-revision',
    cloudVersion: 7,
  };
  const copiedDraft = createUnsyncedDraftCopyState(sourceDraft);
  const workspaceWithCopy = addResumeToWorkspace(
    initial.workspace,
    copyResumeId,
    copiedDraft.savedAt,
  );

  assert.equal(copiedDraft.localRevision, '');
  assert.equal(copiedDraft.cloudVersion, 0);
  assert.deepEqual(copiedDraft.resume, sourceDraft.resume);
  assert.equal(copiedDraft.template, sourceDraft.template);

  const persistedCopy = await persistLocalDraftSnapshot({
    resumeId: copyResumeId,
    workspace: workspaceWithCopy,
    draft: copiedDraft,
    accountUid: 'account-a',
    enqueueWorkspaceSync: true,
  });
  const pendingOperations = await readPendingOutbox({ accountUid: 'account-a' });
  const copyOperation = pendingOperations.find((operation) => (
    operation.type === 'upsertDraft' && operation.resumeId === copyResumeId
  ));

  assert.notEqual(persistedCopy.draft.localRevision, sourceDraft.localRevision);
  assert.equal(copyOperation?.baseCloudVersion, 0);
});

test('an old in-flight acknowledgement cannot clear a newer draft operation', async () => {
  const initial = await initializeLocalWorkspace();
  const resumeId = initial.activeResumeId;

  await persistLoginMergedWorkspace({
    mergeResult: {
      workspace: initial.workspace,
      draftsByResumeId: new Map([[resumeId, initial.draft]]),
      tombstones: [],
      workspaceCloudVersion: 0,
      syncPlan: {
        workspaceNeedsSync: false,
        upsertResumeIds: [],
        deleteResumeIds: [],
      },
    },
    account: { uid: 'account-a', email: 'account-a@example.com' },
    accountUid: 'account-a',
  });

  const firstDraft = createSavedDraftState(initial.draft);
  const firstSave = await persistLocalDraftSnapshot({
    resumeId,
    workspace: initial.workspace,
    draft: firstDraft,
    accountUid: 'account-a',
    expectedRevision: initial.draft.localRevision || '',
  });
  const firstOperation = (await readPendingOutbox({ accountUid: 'account-a' }))
    .find((operation) => operation.type === 'upsertDraft');
  const secondDraft = createSavedDraftState({
    ...firstSave.draft,
    resume: {
      ...firstSave.draft.resume,
      personal: {
        ...firstSave.draft.resume.personal,
        name: 'Newer local edit',
      },
    },
  });

  await persistLocalDraftSnapshot({
    resumeId,
    workspace: firstSave.workspace,
    draft: secondDraft,
    accountUid: 'account-a',
    expectedRevision: firstSave.draft.localRevision,
  });
  const newerOperation = (await readPendingOutbox({ accountUid: 'account-a' }))
    .find((operation) => operation.type === 'upsertDraft');

  assert.notEqual(newerOperation.operationVersion, firstOperation.operationVersion);

  await markOutboxSynced([{
    id: firstOperation.id,
    operationVersion: firstOperation.operationVersion,
    localRevision: firstOperation.localRevision,
    cloudVersion: 7,
  }]);

  const pendingAfterAck = (await readPendingOutbox({ accountUid: 'account-a' }))
    .find((operation) => operation.type === 'upsertDraft');
  const storedDraft = await readLocalDraft(resumeId);

  assert.equal(pendingAfterAck.operationVersion, newerOperation.operationVersion);
  assert.equal(pendingAfterAck.baseCloudVersion, 7);
  assert.equal(storedDraft.cloudVersion, 7);
  assert.equal(storedDraft.resume.personal.name, 'Newer local edit');
});

test('an old account acknowledgement cannot update the current account draft version', async () => {
  const initial = await initializeLocalWorkspace();
  const resumeId = initial.activeResumeId;

  await persistLocalDraftSnapshot({
    resumeId,
    workspace: initial.workspace,
    draft: createSavedDraftState(initial.draft),
    accountUid: 'account-a',
  });
  const accountAOperation = (await readPendingOutbox({ accountUid: 'account-a' }))
    .find((operation) => operation.type === 'upsertDraft');
  const accountBDraft = {
    ...createSavedDraftState(initial.draft),
    cloudVersion: 3,
  };

  await persistLoginMergedWorkspace({
    mergeResult: {
      workspace: initial.workspace,
      draftsByResumeId: new Map([[resumeId, accountBDraft]]),
      tombstones: [],
      workspaceCloudVersion: 4,
      syncPlan: {
        workspaceNeedsSync: false,
        upsertResumeIds: [],
        deleteResumeIds: [],
      },
    },
    account: { uid: 'account-b', email: 'account-b@example.com' },
    accountUid: 'account-b',
  });

  await markOutboxSynced([{
    id: accountAOperation.id,
    operationVersion: accountAOperation.operationVersion,
    localRevision: accountAOperation.localRevision,
    cloudVersion: 99,
  }]);

  const storedDraft = await readLocalDraft(resumeId);
  const bundle = await readLocalWorkspaceBundle();

  assert.equal(storedDraft.cloudVersion, 3);
  assert.equal(bundle.workspaceCloudVersion, 4);
  assert.equal((await readPendingOutbox({ accountUid: 'account-a' })).some((operation) => (
    operation.type === 'upsertDraft' && operation.resumeId === resumeId
  )), false);
});

test('an old failed request cannot mark a newer replacement as failed', async () => {
  const initial = await initializeLocalWorkspace();
  const resumeId = initial.activeResumeId;
  const firstSave = await persistLocalDraftSnapshot({
    resumeId,
    workspace: initial.workspace,
    draft: createSavedDraftState(initial.draft),
    accountUid: 'account-a',
  });
  const firstOperation = (await readPendingOutbox({ accountUid: 'account-a' }))
    .find((operation) => operation.type === 'upsertDraft');

  await persistLocalDraftSnapshot({
    resumeId,
    workspace: firstSave.workspace,
    draft: createSavedDraftState(firstSave.draft),
    accountUid: 'account-a',
    expectedRevision: firstSave.draft.localRevision,
  });
  const newerOperation = (await readPendingOutbox({ accountUid: 'account-a' }))
    .find((operation) => operation.type === 'upsertDraft');

  await markOutboxFailed([firstOperation], 'Old request failed');

  const pendingAfterFailure = (await readPendingOutbox({ accountUid: 'account-a' }))
    .find((operation) => operation.type === 'upsertDraft');

  assert.equal(pendingAfterFailure.operationVersion, newerOperation.operationVersion);
  assert.equal(pendingAfterFailure.attempts, newerOperation.attempts);
  assert.equal(pendingAfterFailure.lastError, newerOperation.lastError);
});

test('a tombstone blocks a stale tab from recreating a deleted local draft', async () => {
  const initial = await initializeLocalWorkspace();
  const deletedResumeId = initial.activeResumeId;
  const workspaceWithSecondResume = addResumeToWorkspace(
    initial.workspace,
    'surviving-resume',
    '2026-07-21T12:00:00.000Z',
  );
  const secondSave = await persistLocalDraftSnapshot({
    resumeId: 'surviving-resume',
    workspace: workspaceWithSecondResume,
    draft: createSavedDraftState(initial.draft),
    accountUid: 'account-a',
  });
  const deletion = removeWorkspaceResumes(secondSave.workspace, [deletedResumeId]);

  await persistLocalResumeBatchDelete({
    resumeIds: [deletedResumeId],
    workspace: deletion.workspace,
    accountUid: 'account-a',
  });

  const staleSave = await persistLocalDraftSnapshot({
    resumeId: deletedResumeId,
    workspace: initial.workspace,
    draft: createSavedDraftState(initial.draft),
    accountUid: 'account-a',
  });
  const pending = await readPendingOutbox({ accountUid: 'account-a' });

  assert.equal(staleSave.deleted, true);
  assert.equal(pending.some((operation) => (
    operation.type === 'upsertDraft' && operation.resumeId === deletedResumeId
  )), false);
});

test('durable account binding gates account switches and retains deferred session cleanup', async () => {
  const initial = await initializeLocalWorkspace();
  const account = {
    uid: 'account-a',
    email: 'account-a@example.com',
    displayName: 'Account A',
  };

  await persistLoginMergedWorkspace({
    mergeResult: {
      workspace: initial.workspace,
      draftsByResumeId: new Map([[initial.activeResumeId, initial.draft]]),
      tombstones: [],
      workspaceCloudVersion: 4,
      syncPlan: {
        workspaceNeedsSync: false,
        upsertResumeIds: [],
        deleteResumeIds: [],
      },
    },
    account,
    accountUid: account.uid,
  });

  const context = await readDurableLocalBrowserContext();

  assert.equal(context.hasWorkspaceData, true);
  assert.equal(context.accountBinding.uid, account.uid);
  assert.equal(context.accountBinding.email, account.email);
  assert.equal(context.accountBinding.clearSessionWhenSynced, false);

  assert.equal(await setSyncSessionCleanupRequested(account.uid, true), true);
  assert.equal((await readLocalAccountBinding()).clearSessionWhenSynced, true);
  assert.equal(await setSyncSessionCleanupRequested('different-account', true), false);
  assert.equal((await readLocalAccountBinding()).clearSessionWhenSynced, true);
});

test('account switching preserves the previous account outbox and scopes its tombstones', async () => {
  const initial = await initializeLocalWorkspace();
  const deletedResumeId = initial.activeResumeId;
  const workspaceWithSurvivor = addResumeToWorkspace(
    initial.workspace,
    'account-a-survivor',
    '2026-07-21T13:00:00.000Z',
  );
  const survivorSave = await persistLocalDraftSnapshot({
    resumeId: 'account-a-survivor',
    workspace: workspaceWithSurvivor,
    draft: createSavedDraftState(initial.draft),
    accountUid: 'account-a',
  });
  const deletion = removeWorkspaceResumes(survivorSave.workspace, [deletedResumeId]);

  await persistLocalResumeBatchDelete({
    resumeIds: [deletedResumeId],
    workspace: deletion.workspace,
    accountUid: 'account-a',
  });

  await persistLoginMergedWorkspace({
    mergeResult: {
      workspace: initial.workspace,
      draftsByResumeId: new Map([[deletedResumeId, initial.draft]]),
      tombstones: [],
      workspaceCloudVersion: 0,
      syncPlan: {
        workspaceNeedsSync: true,
        upsertResumeIds: [deletedResumeId],
        deleteResumeIds: [],
      },
    },
    account: { uid: 'account-b', email: 'account-b@example.com' },
    accountUid: 'account-b',
  });

  const accountAOperations = await readPendingOutbox({ accountUid: 'account-a' });
  const accountBOperations = await readPendingOutbox({ accountUid: 'account-b' });

  assert.equal(accountAOperations.some((operation) => (
    operation.type === 'deleteDraft' && operation.resumeId === deletedResumeId
  )), true);
  assert.equal(accountBOperations.some((operation) => (
    operation.type === 'upsertDraft' && operation.resumeId === deletedResumeId
  )), true);
  assert.equal(new Set([
    ...accountAOperations.map((operation) => operation.id),
    ...accountBOperations.map((operation) => operation.id),
  ]).size, accountAOperations.length + accountBOperations.length);

  const accountBSave = await persistLocalDraftSnapshot({
    resumeId: deletedResumeId,
    workspace: initial.workspace,
    draft: createSavedDraftState(initial.draft),
    accountUid: 'account-b',
  });

  assert.notEqual(accountBSave.deleted, true);
  assert.equal(accountBSave.workspace.resumeIds.includes(deletedResumeId), true);
});
