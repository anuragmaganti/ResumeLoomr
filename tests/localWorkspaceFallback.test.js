import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';

import { createSavedDraftState } from '../src/lib/draftState.js';
import {
  deleteLocalWorkspaceDatabase,
  initializeLocalWorkspace,
  persistLocalDraftSnapshot,
  persistLocalResumeBatchDelete,
  readLocalDraft,
  readPendingOutbox,
} from '../src/lib/localWorkspaceDb.js';
import {
  addWorkspaceResume,
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

const workingIndexedDb = globalThis.indexedDB;

function disableIndexedDb() {
  globalThis.indexedDB = {
    open() {
      throw new Error('IndexedDB is disabled for this test.');
    },
  };
}

function createNamedDraft(draft, name) {
  return createSavedDraftState({
    ...draft,
    resume: {
      ...draft.resume,
      personal: {
        ...draft.resume.personal,
        name,
      },
    },
  });
}

beforeEach(async () => {
  globalThis.indexedDB = workingIndexedDb;
  await deleteLocalWorkspaceDatabase();
  globalThis.window = { localStorage: new MemoryStorage() };
  disableIndexedDb();
});

afterEach(async () => {
  globalThis.indexedDB = workingIndexedDb;
  await deleteLocalWorkspaceDatabase();
  delete globalThis.window;
});

test('an IndexedDB open failure persists and reloads drafts through the limited localStorage fallback', async () => {
  const initial = await initializeLocalWorkspace();
  const saved = await persistLocalDraftSnapshot({
    resumeId: initial.activeResumeId,
    workspace: initial.workspace,
    draft: createNamedDraft(initial.draft, 'Fallback User'),
    accountUid: 'account-a',
  });
  const restored = await readLocalDraft(initial.activeResumeId);

  assert.equal(initial.storageMode, 'localStorage');
  assert.equal(saved.storageMode, 'localStorage');
  assert.equal(restored.resume.personal.name, 'Fallback User');
  assert.equal(restored.localRevision, saved.draft.localRevision);
  assert.deepEqual(await readPendingOutbox({ accountUid: 'account-a' }), []);
});

test('the localStorage fallback keeps stale tabs from replacing a newer draft revision', async () => {
  const initial = await initializeLocalWorkspace();
  const first = await persistLocalDraftSnapshot({
    resumeId: initial.activeResumeId,
    workspace: initial.workspace,
    draft: createNamedDraft(initial.draft, 'First Edit'),
  });
  const second = await persistLocalDraftSnapshot({
    resumeId: initial.activeResumeId,
    workspace: first.workspace,
    draft: createNamedDraft(first.draft, 'Newer Edit'),
    expectedRevision: first.draft.localRevision,
  });
  const stale = await persistLocalDraftSnapshot({
    resumeId: initial.activeResumeId,
    workspace: first.workspace,
    draft: createNamedDraft(first.draft, 'Stale Edit'),
    expectedRevision: first.draft.localRevision,
  });

  assert.equal(stale.conflict, true);
  assert.equal(stale.currentRevision, second.draft.localRevision);
  assert.equal((await readLocalDraft(initial.activeResumeId)).resume.personal.name, 'Newer Edit');
});

test('the localStorage fallback prevents a stale tab from recreating a deleted resume', async () => {
  const initial = await initializeLocalWorkspace();
  const first = await persistLocalDraftSnapshot({
    resumeId: initial.activeResumeId,
    workspace: initial.workspace,
    draft: createNamedDraft(initial.draft, 'Deleted Resume'),
  });
  const addition = addWorkspaceResume(first.workspace, { name: 'Survivor' });
  const second = await persistLocalDraftSnapshot({
    resumeId: addition.resumeId,
    workspace: addition.workspace,
    draft: createNamedDraft(initial.draft, 'Surviving Resume'),
  });
  const deletion = removeWorkspaceResumes(second.workspace, [initial.activeResumeId]);

  await persistLocalResumeBatchDelete({
    resumeIds: [initial.activeResumeId],
    workspace: deletion.workspace,
  });

  const stale = await persistLocalDraftSnapshot({
    resumeId: initial.activeResumeId,
    workspace: first.workspace,
    draft: createNamedDraft(first.draft, 'Resurrected Resume'),
    expectedRevision: first.draft.localRevision,
  });

  assert.equal(stale.deleted, true);
  assert.equal(stale.workspace.resumeIds.includes(initial.activeResumeId), false);
});

test('the fallback rejects a save when localStorage cannot accept the write', async () => {
  const initial = await initializeLocalWorkspace();

  globalThis.window.localStorage = {
    getItem: () => null,
    setItem() {
      throw new Error('Quota exceeded.');
    },
    removeItem() {},
  };

  await assert.rejects(
    persistLocalDraftSnapshot({
      resumeId: initial.activeResumeId,
      workspace: initial.workspace,
      draft: createNamedDraft(initial.draft, 'Unsaved User'),
    }),
    /could not persist/i,
  );
});

test('draft persistence rejects a missing resume identity instead of creating an invalid mirror key', async () => {
  const initial = await initializeLocalWorkspace();

  await assert.rejects(
    persistLocalDraftSnapshot({
      resumeId: '',
      workspace: initial.workspace,
      draft: initial.draft,
    }),
    /resume ID is required/i,
  );
});
