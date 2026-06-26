import { openDB } from 'idb';
import {
  DRAFT_STORAGE_KEY,
  WORKSPACE_INDEX_STORAGE_KEY,
  createDraftPayload,
  createFreshWorkspaceDraft,
  createResumeStorageKey,
  createWorkspaceFromLegacyDraft,
  normalizeDraftPayload,
  normalizeSectionOrder,
  normalizeWorkspaceIndex,
} from './resume.js';

export const LOCAL_WORKSPACE_DB_NAME = 'resumeloomr-local-workspace';
export const LOCAL_WORKSPACE_DB_VERSION = 1;
export const LOCAL_WORKSPACE_ID = 'main';
export const LOCAL_SYNC_META_ID = 'main';
export const LOCAL_ACCOUNT_BINDING_ID = 'current';
export const LOCAL_WORKSPACE_PRESENT_KEY = 'resumeloomr:local-workspace-present:v1';
export const LOCAL_PENDING_CLEAR_KEY = 'resumeloomr:pending-clear-after-sync:v1';

const WORKSPACE_STORE = 'workspace';
const DRAFTS_STORE = 'drafts';
const OUTBOX_STORE = 'outbox';
const TOMBSTONES_STORE = 'tombstones';
const SYNC_META_STORE = 'syncMeta';
const ACCOUNT_BINDING_STORE = 'accountBinding';

const STORE_NAMES = [
  WORKSPACE_STORE,
  DRAFTS_STORE,
  OUTBOX_STORE,
  TOMBSTONES_STORE,
  SYNC_META_STORE,
  ACCOUNT_BINDING_STORE,
];

let dbPromise = null;

function getStorage() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
}

function safeJsonParse(rawValue) {
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
}

function markLocalWorkspacePresent() {
  try {
    getStorage()?.setItem(LOCAL_WORKSPACE_PRESENT_KEY, 'true');
  } catch {
    // IndexedDB remains the durable source of truth if localStorage is full.
  }
}

function clearLocalWorkspacePresent() {
  try {
    getStorage()?.removeItem(LOCAL_WORKSPACE_PRESENT_KEY);
  } catch {
    // Best effort only.
  }
}

function serializeDraftState(draft) {
  return {
    version: 2,
    savedAt: draft?.savedAt ?? null,
    template: draft?.template,
    sectionOrder: normalizeSectionOrder(draft?.sectionOrder),
    resume: draft?.resume,
  };
}

function normalizeDraftState(draft) {
  const normalizedDraft = normalizeDraftPayload(draft);

  return {
    resume: normalizedDraft.resume,
    template: normalizedDraft.template,
    sectionOrder: normalizedDraft.sectionOrder,
    savedAt: draft?.savedAt || null,
  };
}

function createBlankDraftState() {
  const fresh = createFreshWorkspaceDraft();
  return fresh.draft;
}

function writeLocalStorageWorkspace(workspace) {
  try {
    getStorage()?.setItem(WORKSPACE_INDEX_STORAGE_KEY, JSON.stringify(normalizeWorkspaceIndex(workspace)));
    markLocalWorkspacePresent();
  } catch {
    markLocalWorkspacePresent();
  }
}

function writeLocalStorageDraft(resumeId, draft) {
  try {
    getStorage()?.setItem(createResumeStorageKey(resumeId), JSON.stringify(serializeDraftState(draft)));
    markLocalWorkspacePresent();
  } catch {
    markLocalWorkspacePresent();
  }
}

function removeLocalStorageDraft(resumeId) {
  try {
    getStorage()?.removeItem(createResumeStorageKey(resumeId));
  } catch {
    // Best effort only.
  }
}

function readLegacyDraftFromLocalStorage(resumeId) {
  const storage = getStorage();

  if (!storage || !resumeId) {
    return null;
  }

  return normalizeDraftState(safeJsonParse(storage.getItem(createResumeStorageKey(resumeId))));
}

function readLegacyWorkspaceFromLocalStorage() {
  const storage = getStorage();

  if (!storage) {
    return {
      ...createFreshWorkspaceDraft(),
      source: 'fresh',
    };
  }

  const rawWorkspace = safeJsonParse(storage.getItem(WORKSPACE_INDEX_STORAGE_KEY));

  if (rawWorkspace) {
    const workspace = normalizeWorkspaceIndex(rawWorkspace);

    if (workspace.resumeIds.length > 0) {
      const activeResumeId = workspace.activeResumeId || workspace.resumeIds[0];
      const draft = readLegacyDraftFromLocalStorage(activeResumeId) || createBlankDraftState();

      return {
        workspace,
        activeResumeId,
        draft,
        source: 'workspace-localstorage',
      };
    }
  }

  const rawLegacyDraft = safeJsonParse(storage.getItem(DRAFT_STORAGE_KEY));

  if (rawLegacyDraft) {
    return {
      ...createWorkspaceFromLegacyDraft(rawLegacyDraft),
      source: 'legacy-draft',
    };
  }

  return {
    ...createFreshWorkspaceDraft(),
    source: 'fresh',
  };
}

export function readLegacyWorkspaceSnapshot() {
  const legacy = readLegacyWorkspaceFromLocalStorage();

  return {
    workspace: normalizeWorkspaceIndex(legacy.workspace),
    activeResumeId: legacy.activeResumeId || legacy.workspace.activeResumeId,
    draft: normalizeDraftState(legacy.draft),
    source: legacy.source,
  };
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

        if (!db.objectStoreNames.contains(SYNC_META_STORE)) {
          db.createObjectStore(SYNC_META_STORE, { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains(ACCOUNT_BINDING_STORE)) {
          db.createObjectStore(ACCOUNT_BINDING_STORE, { keyPath: 'id' });
        }
      },
    });
  }

  return dbPromise;
}

async function readWorkspaceRecord(db) {
  return db.get(WORKSPACE_STORE, LOCAL_WORKSPACE_ID);
}

async function writeWorkspaceRecord(tx, workspace) {
  await tx.objectStore(WORKSPACE_STORE).put({
    id: LOCAL_WORKSPACE_ID,
    workspace: normalizeWorkspaceIndex(workspace),
    updatedAt: new Date().toISOString(),
  });
}

async function writeDraftRecord(tx, resumeId, draft) {
  await tx.objectStore(DRAFTS_STORE).put({
    resumeId,
    draft: normalizeDraftState(draft),
    updatedAt: draft?.savedAt || new Date().toISOString(),
  });
}

function createOutboxRecord({ type, resumeId = '', workspace = null, draft = null, tombstone = null, accountUid = '', reason = '' }) {
  const now = new Date().toISOString();
  const id = type === 'workspace'
    ? 'workspace'
    : `${type}:${resumeId}`;

  return {
    id,
    type,
    resumeId,
    workspace: workspace ? normalizeWorkspaceIndex(workspace) : null,
    draft: draft ? normalizeDraftState(draft) : null,
    tombstone,
    accountUid: accountUid || '',
    reason,
    status: 'pending',
    attempts: 0,
    createdAt: now,
    updatedAt: now,
    lastError: '',
  };
}

async function putOutboxRecord(tx, record) {
  const outboxStore = tx.objectStore(OUTBOX_STORE);
  const existing = await outboxStore.get(record.id);

  await outboxStore.put({
    ...existing,
    ...record,
    attempts: existing?.attempts || 0,
    createdAt: existing?.createdAt || record.createdAt,
    status: 'pending',
    updatedAt: record.updatedAt,
  });
}

async function queueWorkspaceSyncInTx(tx, workspace, options = {}) {
  await putOutboxRecord(tx, createOutboxRecord({
    type: 'workspace',
    workspace,
    accountUid: options.accountUid,
    reason: options.reason || 'workspace',
  }));
}

async function queueDraftSyncInTx(tx, resumeId, workspace, draft, options = {}) {
  await putOutboxRecord(tx, createOutboxRecord({
    type: 'upsertDraft',
    resumeId,
    workspace,
    draft,
    accountUid: options.accountUid,
    reason: options.reason || 'draft',
  }));
}

async function queueDeleteSyncInTx(tx, resumeId, workspace, options = {}) {
  const now = new Date().toISOString();
  const tombstone = {
    resumeId,
    deletedAt: now,
    version: Date.now(),
    accountUid: options.accountUid || '',
  };

  await tx.objectStore(TOMBSTONES_STORE).put(tombstone);
  await tx.objectStore(OUTBOX_STORE).delete(`upsertDraft:${resumeId}`);
  await putOutboxRecord(tx, createOutboxRecord({
    type: 'deleteDraft',
    resumeId,
    workspace,
    tombstone,
    accountUid: options.accountUid,
    reason: options.reason || 'delete',
  }));
}

export async function initializeLocalWorkspace() {
  const db = await getLocalWorkspaceDb();

  if (!db) {
    return readLegacyWorkspaceSnapshot();
  }

  const existingWorkspaceRecord = await readWorkspaceRecord(db);

  if (existingWorkspaceRecord?.workspace?.resumeIds?.length > 0) {
    const workspace = normalizeWorkspaceIndex(existingWorkspaceRecord.workspace);
    const activeResumeId = workspace.activeResumeId || workspace.resumeIds[0];
    const draft = await readLocalDraft(activeResumeId);

    markLocalWorkspacePresent();
    return {
      workspace,
      activeResumeId,
      draft,
      source: 'indexeddb',
    };
  }

  const legacySnapshot = readLegacyWorkspaceSnapshot();
  const tx = db.transaction([WORKSPACE_STORE, DRAFTS_STORE, SYNC_META_STORE], 'readwrite');

  await writeWorkspaceRecord(tx, legacySnapshot.workspace);

  for (const resumeId of legacySnapshot.workspace.resumeIds) {
    const draft = resumeId === legacySnapshot.activeResumeId
      ? legacySnapshot.draft
      : readLegacyDraftFromLocalStorage(resumeId);

    if (draft) {
      await writeDraftRecord(tx, resumeId, draft);
    }
  }

  await tx.objectStore(SYNC_META_STORE).put({
    id: LOCAL_SYNC_META_ID,
    migratedAt: new Date().toISOString(),
    source: legacySnapshot.source,
  });
  await tx.done;

  writeLocalStorageWorkspace(legacySnapshot.workspace);
  writeLocalStorageDraft(legacySnapshot.activeResumeId, legacySnapshot.draft);

  return legacySnapshot;
}

export async function readLocalWorkspaceSnapshot() {
  const db = await getLocalWorkspaceDb();

  if (!db) {
    return readLegacyWorkspaceSnapshot();
  }

  await initializeLocalWorkspace();
  const workspaceRecord = await readWorkspaceRecord(db);
  const workspace = normalizeWorkspaceIndex(workspaceRecord?.workspace);

  if (workspace.resumeIds.length === 0) {
    return initializeLocalWorkspace();
  }

  const activeResumeId = workspace.activeResumeId || workspace.resumeIds[0];

  return {
    workspace,
    activeResumeId,
    draft: await readLocalDraft(activeResumeId),
    source: 'indexeddb',
  };
}

export async function readLocalDraft(resumeId) {
  const db = await getLocalWorkspaceDb();

  if (!db || !resumeId) {
    return readLegacyDraftFromLocalStorage(resumeId) || createBlankDraftState();
  }

  const record = await db.get(DRAFTS_STORE, resumeId);

  if (record?.draft) {
    return normalizeDraftState(record.draft);
  }

  return readLegacyDraftFromLocalStorage(resumeId) || createBlankDraftState();
}

export async function readAllLocalDrafts(workspace) {
  const normalizedWorkspace = normalizeWorkspaceIndex(workspace);
  const drafts = new Map();

  await Promise.all(normalizedWorkspace.resumeIds.map(async (resumeId) => {
    drafts.set(resumeId, await readLocalDraft(resumeId));
  }));

  return drafts;
}

export async function persistLocalDraftSnapshot({
  resumeId,
  workspace,
  draft,
  accountUid = '',
  enqueueSync = true,
  persistWorkspace = true,
  reason = 'autosave',
}) {
  const db = await getLocalWorkspaceDb();
  const normalizedWorkspace = normalizeWorkspaceIndex(workspace);
  const normalizedDraft = normalizeDraftState(draft);

  if (persistWorkspace) {
    writeLocalStorageWorkspace(normalizedWorkspace);
  }
  writeLocalStorageDraft(resumeId, normalizedDraft);

  if (!db || !resumeId) {
    return { workspace: normalizedWorkspace, draft: normalizedDraft };
  }

  const tx = db.transaction([WORKSPACE_STORE, DRAFTS_STORE, OUTBOX_STORE], 'readwrite');

  if (persistWorkspace) {
    await writeWorkspaceRecord(tx, normalizedWorkspace);
  }
  await writeDraftRecord(tx, resumeId, normalizedDraft);

  if (enqueueSync) {
    await queueWorkspaceSyncInTx(tx, normalizedWorkspace, { accountUid, reason });
    await queueDraftSyncInTx(tx, resumeId, normalizedWorkspace, normalizedDraft, { accountUid, reason });
  }

  await tx.done;
  return { workspace: normalizedWorkspace, draft: normalizedDraft };
}

export async function persistLocalWorkspaceSnapshot({
  workspace,
  accountUid = '',
  enqueueSync = true,
  reason = 'workspace',
}) {
  const db = await getLocalWorkspaceDb();
  const normalizedWorkspace = normalizeWorkspaceIndex(workspace);

  writeLocalStorageWorkspace(normalizedWorkspace);

  if (!db) {
    return normalizedWorkspace;
  }

  const tx = db.transaction([WORKSPACE_STORE, OUTBOX_STORE], 'readwrite');

  await writeWorkspaceRecord(tx, normalizedWorkspace);

  if (enqueueSync) {
    await queueWorkspaceSyncInTx(tx, normalizedWorkspace, { accountUid, reason });
  }

  await tx.done;
  return normalizedWorkspace;
}

export async function persistLocalResumeDelete({
  resumeId,
  workspace,
  accountUid = '',
  enqueueSync = true,
  reason = 'delete',
}) {
  const db = await getLocalWorkspaceDb();
  const normalizedWorkspace = normalizeWorkspaceIndex(workspace);

  writeLocalStorageWorkspace(normalizedWorkspace);
  removeLocalStorageDraft(resumeId);

  if (!db || !resumeId) {
    return normalizedWorkspace;
  }

  const tx = db.transaction([WORKSPACE_STORE, DRAFTS_STORE, OUTBOX_STORE, TOMBSTONES_STORE], 'readwrite');

  await writeWorkspaceRecord(tx, normalizedWorkspace);
  await tx.objectStore(DRAFTS_STORE).delete(resumeId);

  if (enqueueSync) {
    await queueWorkspaceSyncInTx(tx, normalizedWorkspace, { accountUid, reason });
    await queueDeleteSyncInTx(tx, resumeId, normalizedWorkspace, { accountUid, reason });
  }

  await tx.done;
  return normalizedWorkspace;
}

export async function replaceLocalWorkspaceFromCloud({ workspace, draftsByResumeId, accountUid = '' }) {
  const db = await getLocalWorkspaceDb();
  const normalizedWorkspace = normalizeWorkspaceIndex(workspace);

  writeLocalStorageWorkspace(normalizedWorkspace);

  draftsByResumeId.forEach((draft, resumeId) => {
    writeLocalStorageDraft(resumeId, normalizeDraftState(draft));
  });

  if (!db) {
    return;
  }

  const tx = db.transaction([WORKSPACE_STORE, DRAFTS_STORE, OUTBOX_STORE, TOMBSTONES_STORE, ACCOUNT_BINDING_STORE], 'readwrite');

  await writeWorkspaceRecord(tx, normalizedWorkspace);
  await tx.objectStore(DRAFTS_STORE).clear();
  await tx.objectStore(OUTBOX_STORE).clear();
  await tx.objectStore(TOMBSTONES_STORE).clear();

  for (const resumeId of normalizedWorkspace.resumeIds) {
    const draft = draftsByResumeId.get(resumeId);

    if (draft) {
      await writeDraftRecord(tx, resumeId, normalizeDraftState(draft));
    }
  }

  if (accountUid) {
    await tx.objectStore(ACCOUNT_BINDING_STORE).put({
      id: LOCAL_ACCOUNT_BINDING_ID,
      uid: accountUid,
      updatedAt: new Date().toISOString(),
    });
  }

  await tx.done;
}

export async function enqueueFullWorkspaceSync({ accountUid = '', reason = 'full-sync' } = {}) {
  const snapshot = await readLocalWorkspaceSnapshot();
  const drafts = await readAllLocalDrafts(snapshot.workspace);
  const db = await getLocalWorkspaceDb();

  if (!db) {
    return [];
  }

  const tx = db.transaction([OUTBOX_STORE], 'readwrite');
  await queueWorkspaceSyncInTx(tx, snapshot.workspace, { accountUid, reason });

  for (const [resumeId, draft] of drafts) {
    await queueDraftSyncInTx(tx, resumeId, snapshot.workspace, draft, { accountUid, reason });
  }

  await tx.done;
  return Array.from(drafts.keys());
}

export async function readPendingOutbox({ limit = 150 } = {}) {
  const db = await getLocalWorkspaceDb();

  if (!db) {
    return [];
  }

  const records = await db.getAll(OUTBOX_STORE);

  return records
    .filter((record) => record?.status === 'pending')
    .sort((a, b) => String(a.updatedAt).localeCompare(String(b.updatedAt)))
    .slice(0, limit);
}

export async function markOutboxSynced(operationIds) {
  const db = await getLocalWorkspaceDb();
  const ids = Array.isArray(operationIds) ? operationIds.filter(Boolean) : [];

  if (!db || ids.length === 0) {
    return;
  }

  const tx = db.transaction([OUTBOX_STORE, TOMBSTONES_STORE], 'readwrite');

  for (const id of ids) {
    const record = await tx.objectStore(OUTBOX_STORE).get(id);
    await tx.objectStore(OUTBOX_STORE).delete(id);

    if (record?.type === 'deleteDraft' && record.resumeId) {
      await tx.objectStore(TOMBSTONES_STORE).delete(record.resumeId);
    }
  }

  await tx.done;
}

export async function markOutboxFailed(operationIds, errorMessage = '') {
  const db = await getLocalWorkspaceDb();
  const ids = Array.isArray(operationIds) ? operationIds.filter(Boolean) : [];

  if (!db || ids.length === 0) {
    return;
  }

  const tx = db.transaction(OUTBOX_STORE, 'readwrite');

  for (const id of ids) {
    const record = await tx.store.get(id);

    if (!record) {
      continue;
    }

    await tx.store.put({
      ...record,
      attempts: Number(record.attempts || 0) + 1,
      lastError: errorMessage,
      updatedAt: new Date().toISOString(),
      status: 'pending',
    });
  }

  await tx.done;
}

export async function hasPendingOutbox() {
  return (await readPendingOutbox({ limit: 1 })).length > 0;
}

export async function readAccountBinding() {
  const db = await getLocalWorkspaceDb();

  if (!db) {
    return null;
  }

  return db.get(ACCOUNT_BINDING_STORE, LOCAL_ACCOUNT_BINDING_ID);
}

export async function writeAccountBinding(account) {
  const db = await getLocalWorkspaceDb();

  if (!db || !account?.uid) {
    return null;
  }

  const binding = {
    id: LOCAL_ACCOUNT_BINDING_ID,
    uid: account.uid,
    email: account.email || '',
    displayName: account.displayName || '',
    updatedAt: new Date().toISOString(),
  };

  await db.put(ACCOUNT_BINDING_STORE, binding);
  return binding;
}

export async function clearLocalWorkspaceDb() {
  const db = await getLocalWorkspaceDb();

  if (!db) {
    clearLocalWorkspacePresent();
    return;
  }

  const tx = db.transaction(STORE_NAMES, 'readwrite');

  await Promise.all(STORE_NAMES.map((storeName) => tx.objectStore(storeName).clear()));
  await tx.done;
  clearLocalWorkspacePresent();
}

export function createSavedDraftState({ resume, template, sectionOrder }) {
  const payload = createDraftPayload({ resume, template, sectionOrder });

  return {
    resume: payload.resume,
    template: payload.template,
    sectionOrder: payload.sectionOrder,
    savedAt: payload.savedAt,
  };
}
