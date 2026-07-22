import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';

import { normalizeDraftState } from '../src/lib/draftState.js';
import {
  deleteLocalWorkspaceDatabase,
  initializeLocalWorkspace,
  persistLocalDraftSnapshot,
} from '../src/lib/localWorkspaceDb.js';
import {
  readLegacyDraftFromLocalStorage,
  writeLocalStorageDraft,
} from '../src/lib/localWorkspaceMirror.js';
import {
  createBlankDraftState,
  createFreshWorkspaceDraft,
} from '../src/lib/workspaceDraft.js';

class MemoryStorage {
  #values = new Map();

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

beforeEach(async () => {
  globalThis.indexedDB = workingIndexedDb;
  await deleteLocalWorkspaceDatabase();
  globalThis.window = { localStorage: new MemoryStorage() };
});

afterEach(async () => {
  globalThis.indexedDB = workingIndexedDb;
  await deleteLocalWorkspaceDatabase().catch(() => null);
  delete globalThis.window;
});

test('an IndexedDB open failure is surfaced instead of creating a second writable source of truth', async () => {
  globalThis.indexedDB = {
    open() {
      throw new Error('IndexedDB is disabled for this test.');
    },
  };

  await assert.rejects(initializeLocalWorkspace(), /IndexedDB is disabled/);
});

test('draft persistence rejects a missing resume identity before touching browser storage', async () => {
  const fresh = createFreshWorkspaceDraft();

  await assert.rejects(
    persistLocalDraftSnapshot({
      resumeId: '',
      workspace: fresh.workspace,
      draft: fresh.draft,
    }),
    /resume ID is required/i,
  );
});

test('the compatibility mirror distinguishes missing drafts from intentionally blank drafts', () => {
  const blankDraft = createBlankDraftState();

  assert.equal(readLegacyDraftFromLocalStorage('missing-resume'), null);
  assert.equal(writeLocalStorageDraft('blank-resume', blankDraft), true);
  assert.deepEqual(readLegacyDraftFromLocalStorage('blank-resume'), normalizeDraftState(blankDraft));
});

test('compatibility mirror writes report browser storage failures', () => {
  globalThis.window.localStorage = {
    setItem() {
      throw new Error('Quota exceeded.');
    },
  };

  assert.equal(writeLocalStorageDraft('resume-id', createBlankDraftState()), false);
});
