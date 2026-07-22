import { deleteDB, openDB } from 'idb';
import { normalizeWorkspaceIndex } from './workspace.js';
import {
  getDraftStateRevision,
  normalizeCloudVersion,
  normalizeDraftWithRevision,
} from './draftState.js';

export const LOCAL_WORKSPACE_ID = 'main';
export const LOCAL_ACCOUNT_BINDING_ID = 'current';
export const WORKSPACE_STORE = 'workspace';
export const DRAFTS_STORE = 'drafts';
export const OUTBOX_STORE = 'outbox';
export const TOMBSTONES_STORE = 'tombstones';
export const ACCOUNT_BINDING_STORE = 'accountBinding';

const LOCAL_WORKSPACE_DB_NAME = 'resumeloomr-local-workspace';
const LOCAL_WORKSPACE_DB_VERSION = 1;
const LOCAL_WORKSPACE_LOCK_NAME = 'resumeloomr-local-workspace-mutation';

let dbPromise = null;
let localMutationQueue = Promise.resolve();

export function createLocalRevision() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function getDraftRecordRevision(record) {
  if (record?.localRevision) {
    return record.localRevision;
  }

  if (record?.draft?.localRevision) {
    return record.draft.localRevision;
  }

  return `legacy:${record?.updatedAt || record?.draft?.savedAt || 'unknown'}`;
}

async function withLocalWorkspaceLock(callback) {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : null;

  if (!locks?.request) {
    return callback();
  }

  return locks.request(LOCAL_WORKSPACE_LOCK_NAME, { mode: 'exclusive' }, callback);
}

export function runLocalMutation(callback) {
  const run = () => withLocalWorkspaceLock(callback);
  const resultPromise = localMutationQueue.then(run, run);

  localMutationQueue = resultPromise.catch(() => null);
  return resultPromise;
}

export async function getLocalWorkspaceDb() {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!dbPromise) {
    dbPromise = openDB(LOCAL_WORKSPACE_DB_NAME, LOCAL_WORKSPACE_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(WORKSPACE_STORE)) {
          db.createObjectStore(WORKSPACE_STORE, { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains(DRAFTS_STORE)) {
          db.createObjectStore(DRAFTS_STORE, { keyPath: 'resumeId' });
        }

        if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
          const outboxStore = db.createObjectStore(OUTBOX_STORE, { keyPath: 'id' });
          outboxStore.createIndex('status', 'status');
          outboxStore.createIndex('updatedAt', 'updatedAt');
          outboxStore.createIndex('resumeId', 'resumeId');
        }

        if (!db.objectStoreNames.contains(TOMBSTONES_STORE)) {
          db.createObjectStore(TOMBSTONES_STORE, { keyPath: 'resumeId' });
        }

        if (!db.objectStoreNames.contains(ACCOUNT_BINDING_STORE)) {
          db.createObjectStore(ACCOUNT_BINDING_STORE, { keyPath: 'id' });
        }
      },
      blocking(_currentVersion, _blockedVersion, event) {
        event?.target?.close?.();
      },
    });
  }

  return dbPromise;
}

export async function readWorkspaceRecord(db) {
  return db.get(WORKSPACE_STORE, LOCAL_WORKSPACE_ID);
}

export async function writeWorkspaceRecord(tx, workspace, { localRevision = '', cloudVersion = null } = {}) {
  const store = tx.objectStore(WORKSPACE_STORE);
  const existingRecord = await store.get(LOCAL_WORKSPACE_ID);
  const nextLocalRevision = localRevision || createLocalRevision();
  const nextCloudVersion = cloudVersion === null
    ? normalizeCloudVersion(existingRecord?.cloudVersion)
    : normalizeCloudVersion(cloudVersion);

  await store.put({
    id: LOCAL_WORKSPACE_ID,
    workspace: normalizeWorkspaceIndex(workspace),
    localRevision: nextLocalRevision,
    cloudVersion: nextCloudVersion,
    updatedAt: new Date().toISOString(),
  });

  return {
    localRevision: nextLocalRevision,
    cloudVersion: nextCloudVersion,
  };
}

export async function writeDraftRecord(tx, resumeId, draft, { localRevision = '' } = {}) {
  const revision = localRevision || getDraftStateRevision(draft) || createLocalRevision();

  await tx.objectStore(DRAFTS_STORE).put({
    resumeId,
    draft: normalizeDraftWithRevision(draft, revision),
    localRevision: revision,
    cloudVersion: normalizeCloudVersion(draft?.cloudVersion),
    updatedAt: draft?.savedAt || new Date().toISOString(),
  });

  return revision;
}

export async function deleteLocalWorkspaceDatabase() {
  await localMutationQueue.catch(() => null);
  const pendingDb = dbPromise;
  dbPromise = null;

  if (pendingDb) {
    try {
      const db = await pendingDb;
      db?.close?.();
    } catch {
      // Continue with deletion even if opening the old connection failed.
    }
  }

  await deleteDB(LOCAL_WORKSPACE_DB_NAME);
  localMutationQueue = Promise.resolve();
}
