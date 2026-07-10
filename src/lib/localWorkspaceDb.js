import { deleteDB, openDB } from 'idb';
import {
  MAX_WORKSPACE_RESUMES,
  WORKSPACE_INDEX_STORAGE_KEY,
  createDuplicateResumeName,
  createDraftPayload,
  createEmptyResume,
  createFreshWorkspaceDraft,
  createResumeStorageKey,
  createWorkspaceResumeId,
  createWorkspaceResumeMeta,
  normalizeDraftPayload,
  normalizeWorkspaceIndex,
  trimText,
} from './resume.js';

const LOCAL_WORKSPACE_DB_NAME = 'resumeloomr-local-workspace';
const LOCAL_WORKSPACE_DB_VERSION = 1;
const LOCAL_WORKSPACE_ID = 'main';
const LOCAL_ACCOUNT_BINDING_ID = 'current';
export const LOCAL_WORKSPACE_PRESENT_KEY = 'resumeloomr:local-workspace-present:v1';

const WORKSPACE_STORE = 'workspace';
const DRAFTS_STORE = 'drafts';
const OUTBOX_STORE = 'outbox';
const TOMBSTONES_STORE = 'tombstones';
const ACCOUNT_BINDING_STORE = 'accountBinding';
const LOCAL_WORKSPACE_LOCK_NAME = 'resumeloomr-local-workspace-mutation';
const LOCAL_SYNC_CLIENT_ID_KEY = 'resumeloomr:sync-client-id:v1';
const LOCAL_SYNC_SEQUENCE_KEY = 'resumeloomr:sync-sequence:v1';

let dbPromise = null;
let localMutationQueue = Promise.resolve();
let localMutationDepth = 0;
let fallbackSyncSequence = 0;
let fallbackSyncClientId = '';

function createSyncClientId() {
  return globalThis.crypto?.randomUUID?.() ?? `client-${Math.random().toString(36).slice(2, 12)}`;
}

function getSyncOperationIdentity() {
  const storage = getStorage();

  if (!storage) {
    fallbackSyncClientId ||= createSyncClientId();
    fallbackSyncSequence += 1;
    return {
      clientId: fallbackSyncClientId,
      operationVersion: fallbackSyncSequence,
    };
  }

  try {
    let clientId = trimText(storage.getItem(LOCAL_SYNC_CLIENT_ID_KEY));

    if (!clientId) {
      clientId = createSyncClientId();
      storage.setItem(LOCAL_SYNC_CLIENT_ID_KEY, clientId);
    }

    const previousSequence = Number(storage.getItem(LOCAL_SYNC_SEQUENCE_KEY) || 0);
    const operationVersion = Number.isSafeInteger(previousSequence) && previousSequence >= 0
      ? previousSequence + 1
      : 1;

    storage.setItem(LOCAL_SYNC_SEQUENCE_KEY, String(operationVersion));
    return { clientId, operationVersion };
  } catch {
    fallbackSyncClientId ||= createSyncClientId();
    fallbackSyncSequence += 1;
    return {
      clientId: fallbackSyncClientId,
      operationVersion: fallbackSyncSequence,
    };
  }
}

function createLocalRevision() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getDraftRecordRevision(record) {
  if (record?.localRevision) {
    return record.localRevision;
  }

  if (record?.draft?.localRevision) {
    return record.draft.localRevision;
  }

  return `legacy:${record?.updatedAt || record?.draft?.savedAt || 'unknown'}`;
}

function getDraftStateRevision(draft) {
  return draft?.localRevision || '';
}

function normalizeOutboxAckDescriptor(operation) {
  if (!operation || typeof operation !== 'object') {
    return null;
  }

  const id = trimText(operation.id);

  if (!id) {
    return null;
  }

  return {
    id,
    operationVersion: Number(operation.operationVersion || 0) || 0,
    localRevision: trimText(operation.localRevision),
  };
}

export function createOutboxAckDescriptor(operation) {
  return normalizeOutboxAckDescriptor(operation);
}

export function outboxOperationMatchesAck(operation, ack) {
  const normalizedAck = normalizeOutboxAckDescriptor(ack);

  if (!operation || !normalizedAck || operation.id !== normalizedAck.id) {
    return false;
  }

  const operationVersion = Number(operation.operationVersion || 0) || 0;
  const operationRevision = trimText(operation.localRevision);

  return (
    operationVersion === normalizedAck.operationVersion &&
    operationRevision === normalizedAck.localRevision
  );
}

export function outboxOperationBelongsToAccount(operation, accountUid) {
  const normalizedAccountUid = trimText(accountUid);

  return Boolean(normalizedAccountUid) && trimText(operation?.accountUid) === normalizedAccountUid;
}

export function filterOutboxOperationsForAccount(operations, accountUid) {
  if (!Array.isArray(operations)) {
    return [];
  }

  return operations.filter((operation) => outboxOperationBelongsToAccount(operation, accountUid));
}

function normalizeDraftWithRevision(draft, localRevision = '') {
  return {
    ...normalizeDraftState(draft),
    localRevision: localRevision || getDraftStateRevision(draft),
  };
}

async function withLocalWorkspaceLock(callback) {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : null;

  if (!locks?.request) {
    return callback();
  }

  return locks.request(LOCAL_WORKSPACE_LOCK_NAME, { mode: 'exclusive' }, callback);
}

function runLocalMutation(callback) {
  if (localMutationDepth > 0) {
    return callback();
  }

  const run = async () => {
    localMutationDepth += 1;

    try {
      return await withLocalWorkspaceLock(callback);
    } finally {
      localMutationDepth -= 1;
    }
  };
  const resultPromise = localMutationQueue.then(run, run);

  localMutationQueue = resultPromise.catch(() => null);
  return resultPromise;
}

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

function serializeDraftState(draft) {
  return {
    version: 3,
    savedAt: draft?.savedAt ?? null,
    template: draft?.template,
    resume: draft?.resume,
    localRevision: draft?.localRevision || '',
  };
}

function normalizeDraftState(draft) {
  const normalizedDraft = normalizeDraftPayload(draft);

  return {
    resume: normalizedDraft.resume,
    template: normalizedDraft.template,
    savedAt: draft?.savedAt || null,
    localRevision: draft?.localRevision || '',
  };
}

function createBlankDraftState() {
  const fresh = createFreshWorkspaceDraft();
  return fresh.draft;
}

function stableValue(value) {
  if (Array.isArray(value)) {
    return value.map(stableValue);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, stableValue(value[key])]),
    );
  }

  return value;
}

function stableJson(value) {
  return JSON.stringify(stableValue(value));
}

function withoutIdentityFields(value) {
  if (Array.isArray(value)) {
    return value.map(withoutIdentityFields);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== 'id')
        .map(([key, entryValue]) => [key, withoutIdentityFields(entryValue)]),
    );
  }

  return value;
}

export function createDraftContentHash(draft) {
  const normalizedDraft = normalizeDraftState(draft);
  const content = {
    resume: normalizedDraft.resume,
    template: normalizedDraft.template,
  };
  const serialized = stableJson(content);
  let hash = 2166136261;

  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

function createDraftMergeContentHash(draft) {
  const normalizedDraft = normalizeDraftState(draft);
  const { sampleDisplay: _sampleDisplay, ...resumeForMerge } = normalizedDraft.resume || {};
  const content = {
    resume: resumeForMerge,
    template: normalizedDraft.template,
  };
  const serialized = stableJson(content);
  let hash = 2166136261;

  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

function draftHasVisibleText(draft) {
  const normalizedDraft = normalizeDraftPayload(draft);
  const personal = normalizedDraft.resume.personal || {};

  if (Object.values(personal).some((value) => trimText(value) !== '')) {
    return true;
  }

  function valueHasText(value, key = '') {
    if (key === 'id' || key === 'groupLabel') {
      return false;
    }

    if (typeof value === 'string') {
      return trimText(value) !== '';
    }

    if (Array.isArray(value)) {
      return value.some((item) => valueHasText(item));
    }

    if (value && typeof value === 'object') {
      return Object.entries(value).some(([entryKey, entryValue]) => valueHasText(entryValue, entryKey));
    }

    return false;
  }

  return Array.isArray(normalizedDraft.resume.sections)
    && normalizedDraft.resume.sections.some((section) => (
      trimText(section.title) !== ''
      && Array.isArray(section.entries)
      && section.entries.some((entry) => valueHasText(entry))
    ));
}

function draftHasMeaningfulChanges(draft) {
  if (draftHasVisibleText(draft)) {
    return true;
  }

  const normalizedDraft = normalizeDraftState(draft);
  const pristineDraft = normalizeDraftState({
    resume: createEmptyResume(),
    template: 'compact',
  });
  const { sampleDisplay: _sampleDisplay, ...resumeWithoutSampleDisplay } = normalizedDraft.resume;
  const { sampleDisplay: _pristineSampleDisplay, ...pristineResumeWithoutSampleDisplay } = pristineDraft.resume;

  return stableJson(withoutIdentityFields({
    resume: resumeWithoutSampleDisplay,
    template: normalizedDraft.template,
  })) !== stableJson(withoutIdentityFields({
    resume: pristineResumeWithoutSampleDisplay,
    template: pristineDraft.template,
  }));
}

function normalizeDraftMap(candidate) {
  if (candidate instanceof Map) {
    return new Map(Array.from(candidate.entries()).map(([resumeId, draft]) => [
      resumeId,
      normalizeDraftState(draft),
    ]));
  }

  if (candidate && typeof candidate === 'object') {
    return new Map(Object.entries(candidate).map(([resumeId, draft]) => [
      resumeId,
      normalizeDraftState(draft),
    ]));
  }

  return new Map();
}

function getDraftTimestamp(draft, meta = {}) {
  const timestamp = Date.parse(draft?.savedAt || meta?.updatedAt || '');
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function workspaceHasVisibleDrafts(workspace, draftsByResumeId, tombstonedResumeIds = new Set()) {
  const normalizedWorkspace = normalizeWorkspaceIndex(workspace);

  if (normalizedWorkspace.resumeIds.length > 1) {
    return true;
  }

  return normalizedWorkspace.resumeIds.some((resumeId, index) => {
    if (tombstonedResumeIds.has(resumeId)) {
      return false;
    }

    const name = trimText(normalizedWorkspace.meta[resumeId]?.name);
    const hasCustomName = name !== '' && name !== `Resume ${index + 1}`;

    return hasCustomName || draftHasMeaningfulChanges(draftsByResumeId.get(resumeId));
  });
}

function createUniqueResumeId(existingIds) {
  let resumeId = createWorkspaceResumeId();

  while (existingIds.has(resumeId)) {
    resumeId = createWorkspaceResumeId();
  }

  existingIds.add(resumeId);
  return resumeId;
}

function createConflictCopyName(baseName, existingNames) {
  const fallbackName = trimText(baseName) || 'Resume';
  return createDuplicateResumeName(fallbackName, existingNames);
}

function normalizeTombstoneList(tombstones, pendingOutbox = []) {
  const records = [
    ...(Array.isArray(tombstones) ? tombstones : []),
    ...(Array.isArray(pendingOutbox) ? pendingOutbox.map((record) => record?.tombstone).filter(Boolean) : []),
  ];

  return records
    .filter((record) => trimText(record?.resumeId) !== '')
    .map((record) => ({
      ...record,
      resumeId: trimText(record.resumeId),
    }));
}

function workspacesMatch(firstWorkspace, secondWorkspace) {
  return stableJson(normalizeWorkspaceIndex(firstWorkspace)) === stableJson(normalizeWorkspaceIndex(secondWorkspace));
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
  const fresh = createFreshWorkspaceDraft();

  if (!storage) {
    return fresh;
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
      };
    }
  }

  return fresh;
}

export function readLegacyWorkspaceSnapshot() {
  const legacy = readLegacyWorkspaceFromLocalStorage();

  return {
    workspace: normalizeWorkspaceIndex(legacy.workspace),
    activeResumeId: legacy.activeResumeId || legacy.workspace.activeResumeId,
    draft: normalizeDraftState(legacy.draft),
  };
}

async function getLocalWorkspaceDb() {
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

async function writeDraftRecord(tx, resumeId, draft, { localRevision = '' } = {}) {
  const revision = localRevision || getDraftStateRevision(draft) || createLocalRevision();

  await tx.objectStore(DRAFTS_STORE).put({
    resumeId,
    draft: normalizeDraftWithRevision(draft, revision),
    localRevision: revision,
    updatedAt: draft?.savedAt || new Date().toISOString(),
  });

  return revision;
}

function createOutboxRecord({ type, resumeId = '', workspace = null, draft = null, tombstone = null, accountUid = '', reason = '' }) {
  const now = new Date().toISOString();
  const syncIdentity = getSyncOperationIdentity();
  const id = type === 'workspace'
    ? 'workspace'
    : `${type}:${resumeId}`;

  return {
    id,
    type,
    resumeId,
    workspace: workspace ? normalizeWorkspaceIndex(workspace) : null,
    draft: draft ? normalizeDraftState(draft) : null,
    localRevision: draft ? (getDraftStateRevision(draft) || createLocalRevision()) : createLocalRevision(),
    clientId: syncIdentity.clientId,
    operationVersion: syncIdentity.operationVersion,
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
  return runLocalMutation(async () => {
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
      };
    }

    const legacySnapshot = readLegacyWorkspaceSnapshot();
    const tx = db.transaction([WORKSPACE_STORE, DRAFTS_STORE], 'readwrite');

    await writeWorkspaceRecord(tx, legacySnapshot.workspace);

    for (const resumeId of legacySnapshot.workspace.resumeIds) {
      const draft = resumeId === legacySnapshot.activeResumeId
        ? legacySnapshot.draft
        : readLegacyDraftFromLocalStorage(resumeId);

      if (draft) {
        await writeDraftRecord(tx, resumeId, draft);
      }
    }

    await tx.done;

    writeLocalStorageWorkspace(legacySnapshot.workspace);
    writeLocalStorageDraft(legacySnapshot.activeResumeId, legacySnapshot.draft);

    return legacySnapshot;
  });
}

async function readLocalWorkspaceSnapshot() {
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
  };
}

export async function readLocalDraft(resumeId) {
  const db = await getLocalWorkspaceDb();

  if (!db || !resumeId) {
    return readLegacyDraftFromLocalStorage(resumeId) || createBlankDraftState();
  }

  const record = await db.get(DRAFTS_STORE, resumeId);

  if (record?.draft) {
    return normalizeDraftWithRevision(record.draft, getDraftRecordRevision(record));
  }

  const legacyDraft = readLegacyDraftFromLocalStorage(resumeId);

  return legacyDraft
    ? normalizeDraftWithRevision(legacyDraft, getDraftStateRevision(legacyDraft) || `legacy-localstorage:${legacyDraft.savedAt || 'unknown'}`)
    : normalizeDraftWithRevision(createBlankDraftState(), createLocalRevision());
}

async function readAllLocalDrafts(workspace) {
  const normalizedWorkspace = normalizeWorkspaceIndex(workspace);
  const drafts = new Map();

  await Promise.all(normalizedWorkspace.resumeIds.map(async (resumeId) => {
    drafts.set(resumeId, await readLocalDraft(resumeId));
  }));

  return drafts;
}

async function readLocalTombstones() {
  const db = await getLocalWorkspaceDb();

  if (!db) {
    return [];
  }

  return db.getAll(TOMBSTONES_STORE);
}

export async function readLocalWorkspaceBundle() {
  const snapshot = await readLocalWorkspaceSnapshot();
  const [
    draftsByResumeId,
    tombstones,
    pendingOutbox,
  ] = await Promise.all([
    readAllLocalDrafts(snapshot.workspace),
    readLocalTombstones(),
    readPendingOutbox({ limit: 1000 }),
  ]);

  return {
    ...snapshot,
    draftsByResumeId,
    tombstones,
    pendingOutbox,
  };
}

export function mergeLocalAndCloudWorkspaces({
  localWorkspace,
  localDraftsByResumeId,
  cloudWorkspace = null,
  cloudDraftsByResumeId = null,
  tombstones = [],
  pendingOutbox = [],
  maxResumes = MAX_WORKSPACE_RESUMES,
} = {}) {
  const normalizedLocalWorkspace = normalizeWorkspaceIndex(localWorkspace);
  const normalizedCloudWorkspace = normalizeWorkspaceIndex(cloudWorkspace);
  const localDrafts = normalizeDraftMap(localDraftsByResumeId);
  const cloudDrafts = normalizeDraftMap(cloudDraftsByResumeId);
  const tombstoneRecords = normalizeTombstoneList(tombstones, pendingOutbox);
  const tombstonedResumeIds = new Set(tombstoneRecords.map((record) => record.resumeId));
  const localHasContent = workspaceHasVisibleDrafts(normalizedLocalWorkspace, localDrafts, tombstonedResumeIds);
  const cloudHasContent = workspaceHasVisibleDrafts(normalizedCloudWorkspace, cloudDrafts, tombstonedResumeIds);
  const mergedDrafts = new Map();
  const mergedResumeIds = [];
  const mergedMeta = {};
  const existingIds = new Set([...normalizedLocalWorkspace.resumeIds, ...normalizedCloudWorkspace.resumeIds]);
  const existingNames = [];
  const upsertResumeIds = new Set();
  const warnings = [];

  function addResume({ resumeId, draft, meta = {}, origin = 'cloud', forceUpsert = false }) {
    if (!resumeId || mergedDrafts.has(resumeId) || tombstonedResumeIds.has(resumeId)) {
      return;
    }

    const normalizedDraft = normalizeDraftState(draft);
    const name = trimText(meta.name) || `Resume ${mergedResumeIds.length + 1}`;
    const updatedAt = normalizedDraft.savedAt || meta.updatedAt || '';

    mergedResumeIds.push(resumeId);
    mergedDrafts.set(resumeId, normalizedDraft);
    mergedMeta[resumeId] = createWorkspaceResumeMeta(name, updatedAt);
    existingNames.push(name);

    if (forceUpsert || origin === 'local' || origin === 'copy') {
      upsertResumeIds.add(resumeId);
    }
  }

  function addConflictCopy({ draft, meta = {} }) {
    const copyId = createUniqueResumeId(existingIds);
    const copyName = createConflictCopyName(meta.name || 'Resume', existingNames);

    addResume({
      resumeId: copyId,
      draft,
      meta: {
        ...meta,
        name: copyName,
      },
      origin: 'copy',
      forceUpsert: true,
    });
  }

  if (!localHasContent && cloudHasContent) {
    normalizedCloudWorkspace.resumeIds.forEach((resumeId) => {
      addResume({
        resumeId,
        draft: cloudDrafts.get(resumeId),
        meta: normalizedCloudWorkspace.meta[resumeId],
        origin: 'cloud',
      });
    });
  } else {
    normalizedLocalWorkspace.resumeIds.forEach((resumeId) => {
      if (tombstonedResumeIds.has(resumeId)) {
        return;
      }

      const localDraft = localDrafts.get(resumeId);
      const cloudDraft = cloudDrafts.get(resumeId);

      if (!localDraft) {
        return;
      }

      if (!cloudDraft) {
        addResume({
          resumeId,
          draft: localDraft,
          meta: normalizedLocalWorkspace.meta[resumeId],
          origin: localHasContent ? 'local' : 'blank-local',
          forceUpsert: localHasContent,
        });
        return;
      }

      const localHash = createDraftMergeContentHash(localDraft);
      const cloudHash = createDraftMergeContentHash(cloudDraft);
      const localFullHash = createDraftContentHash(localDraft);
      const cloudFullHash = createDraftContentHash(cloudDraft);

      if (localHash === cloudHash) {
        const localIsNewer = getDraftTimestamp(localDraft, normalizedLocalWorkspace.meta[resumeId]) >= getDraftTimestamp(cloudDraft, normalizedCloudWorkspace.meta[resumeId]);

        addResume({
          resumeId,
          draft: localIsNewer ? localDraft : cloudDraft,
          meta: localHasContent ? normalizedLocalWorkspace.meta[resumeId] : normalizedCloudWorkspace.meta[resumeId],
          origin: localIsNewer && localFullHash !== cloudFullHash ? 'local' : 'cloud',
          forceUpsert: localIsNewer && localFullHash !== cloudFullHash,
        });
        return;
      }

      const localIsNewer = getDraftTimestamp(localDraft, normalizedLocalWorkspace.meta[resumeId]) >= getDraftTimestamp(cloudDraft, normalizedCloudWorkspace.meta[resumeId]);

      if (localIsNewer) {
        addResume({
          resumeId,
          draft: localDraft,
          meta: normalizedLocalWorkspace.meta[resumeId],
          origin: 'local',
          forceUpsert: true,
        });
        addConflictCopy({
          draft: cloudDraft,
          meta: normalizedCloudWorkspace.meta[resumeId],
        });
      } else {
        addResume({
          resumeId,
          draft: cloudDraft,
          meta: normalizedCloudWorkspace.meta[resumeId],
          origin: 'cloud',
        });
        addConflictCopy({
          draft: localDraft,
          meta: normalizedLocalWorkspace.meta[resumeId],
        });
      }
    });

    normalizedCloudWorkspace.resumeIds.forEach((resumeId) => {
      if (mergedDrafts.has(resumeId) || tombstonedResumeIds.has(resumeId)) {
        return;
      }

      const cloudDraft = cloudDrafts.get(resumeId);

      if (cloudDraft) {
        addResume({
          resumeId,
          draft: cloudDraft,
          meta: normalizedCloudWorkspace.meta[resumeId],
          origin: 'cloud',
        });
      }
    });
  }

  let nextResumeIds = mergedResumeIds;

  if (nextResumeIds.length > maxResumes) {
    warnings.push(`Only the first ${maxResumes} resumes were kept in this browser.`);
    nextResumeIds = nextResumeIds.slice(0, maxResumes);
  }

  const nextResumeIdSet = new Set(nextResumeIds);

  Array.from(mergedDrafts.keys()).forEach((resumeId) => {
    if (!nextResumeIdSet.has(resumeId)) {
      mergedDrafts.delete(resumeId);
      delete mergedMeta[resumeId];
      upsertResumeIds.delete(resumeId);
    }
  });

  const preferredActiveResumeId = localHasContent
    ? normalizedLocalWorkspace.activeResumeId
    : normalizedCloudWorkspace.activeResumeId;
  const activeResumeId = nextResumeIdSet.has(preferredActiveResumeId)
    ? preferredActiveResumeId
    : (nextResumeIds[0] || normalizedLocalWorkspace.activeResumeId || normalizedCloudWorkspace.activeResumeId || '');
  const workspace = normalizeWorkspaceIndex({
    activeResumeId,
    resumeIds: nextResumeIds,
    meta: mergedMeta,
  });
  const cloudHasWorkspace = normalizedCloudWorkspace.resumeIds.length > 0 && cloudDrafts.size > 0;
  const deleteResumeIds = Array.from(tombstonedResumeIds).filter((resumeId) => (
    cloudDrafts.has(resumeId) || normalizedCloudWorkspace.resumeIds.includes(resumeId)
  ));
  const workspaceNeedsSync = (
    upsertResumeIds.size > 0
    || deleteResumeIds.length > 0
    || (localHasContent && !workspacesMatch(workspace, normalizedCloudWorkspace))
  ) && (localHasContent || cloudHasWorkspace || upsertResumeIds.size > 0 || deleteResumeIds.length > 0);

  return {
    workspace,
    draftsByResumeId: mergedDrafts,
    activeResumeId: workspace.activeResumeId,
    syncPlan: {
      workspaceNeedsSync,
      upsertResumeIds: Array.from(upsertResumeIds).filter((resumeId) => mergedDrafts.has(resumeId)),
      deleteResumeIds,
    },
    warnings,
    localHasContent,
    cloudHasContent,
  };
}

export async function persistLocalDraftSnapshot({
  resumeId,
  workspace,
  draft,
  accountUid = '',
  enqueueSync = true,
  persistWorkspace = true,
  reason = 'autosave',
  expectedRevision = '',
  allowStaleOverwrite = false,
}) {
  return runLocalMutation(async () => {
    const db = await getLocalWorkspaceDb();
    const normalizedWorkspace = normalizeWorkspaceIndex(workspace);
    const normalizedDraft = normalizeDraftState(draft);

    if (!db || !resumeId) {
      const nextRevision = createLocalRevision();
      const draftWithRevision = normalizeDraftWithRevision(normalizedDraft, nextRevision);

      if (persistWorkspace) {
        writeLocalStorageWorkspace(normalizedWorkspace);
      }
      writeLocalStorageDraft(resumeId, draftWithRevision);
      return { workspace: normalizedWorkspace, draft: draftWithRevision, conflict: false };
    }

    const tx = db.transaction([WORKSPACE_STORE, DRAFTS_STORE, OUTBOX_STORE], 'readwrite');
    const existingRecord = await tx.objectStore(DRAFTS_STORE).get(resumeId);
    const currentRevision = existingRecord ? getDraftRecordRevision(existingRecord) : '';

    if (
      expectedRevision &&
      currentRevision &&
      currentRevision !== expectedRevision &&
      !allowStaleOverwrite
    ) {
      await tx.done;
      return {
        workspace: normalizedWorkspace,
        draft: existingRecord?.draft ? normalizeDraftWithRevision(existingRecord.draft, currentRevision) : null,
        conflict: true,
        expectedRevision,
        currentRevision,
      };
    }

    const nextRevision = createLocalRevision();
    const draftWithRevision = normalizeDraftWithRevision(normalizedDraft, nextRevision);

    if (persistWorkspace) {
      await writeWorkspaceRecord(tx, normalizedWorkspace);
    }
    await writeDraftRecord(tx, resumeId, draftWithRevision, { localRevision: nextRevision });

    if (enqueueSync && persistWorkspace) {
      await queueWorkspaceSyncInTx(tx, normalizedWorkspace, { accountUid, reason });
    }

    if (enqueueSync) {
      await queueDraftSyncInTx(tx, resumeId, normalizedWorkspace, draftWithRevision, { accountUid, reason });
    }

    await tx.done;

    if (persistWorkspace) {
      writeLocalStorageWorkspace(normalizedWorkspace);
    }
    writeLocalStorageDraft(resumeId, draftWithRevision);

    return { workspace: normalizedWorkspace, draft: draftWithRevision, conflict: false };
  });
}

export async function persistLocalWorkspaceSnapshot({
  workspace,
  accountUid = '',
  enqueueSync = true,
  reason = 'workspace',
}) {
  return runLocalMutation(async () => {
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
  });
}

export async function persistLocalResumeDelete({
  resumeId,
  workspace,
  accountUid = '',
  enqueueSync = true,
  reason = 'delete',
}) {
  return runLocalMutation(async () => {
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
  });
}

export async function persistLoginMergedWorkspace({
  mergeResult,
  account = null,
  accountUid = '',
  reason = 'login-merge',
} = {}) {
  return runLocalMutation(async () => {
    const db = await getLocalWorkspaceDb();
    const normalizedWorkspace = normalizeWorkspaceIndex(mergeResult?.workspace);
    const draftsByResumeId = normalizeDraftMap(mergeResult?.draftsByResumeId);
    const syncPlan = mergeResult?.syncPlan || {};
    const upsertResumeIds = Array.isArray(syncPlan.upsertResumeIds) ? syncPlan.upsertResumeIds : [];
    const deleteResumeIds = Array.isArray(syncPlan.deleteResumeIds) ? syncPlan.deleteResumeIds : [];

    writeLocalStorageWorkspace(normalizedWorkspace);
    draftsByResumeId.forEach((draft, resumeId) => {
      if (normalizedWorkspace.resumeIds.includes(resumeId)) {
        writeLocalStorageDraft(resumeId, draft);
      }
    });

    if (!db) {
      return {
        workspace: normalizedWorkspace,
        draftsByResumeId,
      };
    }

    const tx = db.transaction([WORKSPACE_STORE, DRAFTS_STORE, OUTBOX_STORE, TOMBSTONES_STORE, ACCOUNT_BINDING_STORE], 'readwrite');

    await writeWorkspaceRecord(tx, normalizedWorkspace);
    await tx.objectStore(DRAFTS_STORE).clear();
    await tx.objectStore(OUTBOX_STORE).clear();
    await tx.objectStore(TOMBSTONES_STORE).clear();

    for (const resumeId of normalizedWorkspace.resumeIds) {
      const draft = draftsByResumeId.get(resumeId);

      if (draft) {
        await writeDraftRecord(tx, resumeId, draft, { localRevision: getDraftStateRevision(draft) });
      }
    }

    if (syncPlan.workspaceNeedsSync) {
      await queueWorkspaceSyncInTx(tx, normalizedWorkspace, { accountUid, reason });
    }

    for (const resumeId of upsertResumeIds) {
      const draft = draftsByResumeId.get(resumeId);

      if (draft && normalizedWorkspace.resumeIds.includes(resumeId)) {
        await queueDraftSyncInTx(tx, resumeId, normalizedWorkspace, draft, { accountUid, reason });
      }
    }

    for (const resumeId of deleteResumeIds) {
      await queueDeleteSyncInTx(tx, resumeId, normalizedWorkspace, { accountUid, reason });
    }

    if (accountUid || account?.uid) {
      await tx.objectStore(ACCOUNT_BINDING_STORE).put({
        id: LOCAL_ACCOUNT_BINDING_ID,
        uid: accountUid || account.uid,
        email: account?.email || '',
        displayName: account?.displayName || '',
        updatedAt: new Date().toISOString(),
      });
    }

    await tx.done;

    return {
      workspace: normalizedWorkspace,
      draftsByResumeId,
    };
  });
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
  localMutationDepth = 0;
}

export async function readPendingOutbox({ limit = 150, accountUid = null } = {}) {
  const db = await getLocalWorkspaceDb();

  if (!db) {
    return [];
  }

  const records = await db.getAll(OUTBOX_STORE);
  const pendingRecords = records.filter((record) => record?.status === 'pending');
  const scopedRecords = accountUid === null || typeof accountUid === 'undefined'
    ? pendingRecords
    : filterOutboxOperationsForAccount(pendingRecords, accountUid);

  return scopedRecords
    .sort((a, b) => String(a.updatedAt).localeCompare(String(b.updatedAt)))
    .slice(0, limit);
}

function normalizeOutboxAckList(operations) {
  return Array.isArray(operations)
    ? operations.map(normalizeOutboxAckDescriptor).filter(Boolean)
    : [];
}

export async function markOutboxSynced(operations) {
  const db = await getLocalWorkspaceDb();
  const acks = normalizeOutboxAckList(operations);

  if (!db || acks.length === 0) {
    return;
  }

  const tx = db.transaction([OUTBOX_STORE, TOMBSTONES_STORE], 'readwrite');

  for (const ack of acks) {
    const record = await tx.objectStore(OUTBOX_STORE).get(ack.id);

    if (!outboxOperationMatchesAck(record, ack)) {
      continue;
    }

    await tx.objectStore(OUTBOX_STORE).delete(ack.id);

    if (record?.type === 'deleteDraft' && record.resumeId) {
      await tx.objectStore(TOMBSTONES_STORE).delete(record.resumeId);
    }
  }

  await tx.done;
}

export async function markOutboxFailed(operations, errorMessage = '') {
  const db = await getLocalWorkspaceDb();
  const acks = normalizeOutboxAckList(operations);

  if (!db || acks.length === 0) {
    return;
  }

  const tx = db.transaction(OUTBOX_STORE, 'readwrite');

  for (const ack of acks) {
    const record = await tx.store.get(ack.id);

    if (!outboxOperationMatchesAck(record, ack)) {
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

export async function markOutboxStale(operations, errorMessage = 'Skipped stale cloud write.') {
  const db = await getLocalWorkspaceDb();
  const acks = normalizeOutboxAckList(operations);

  if (!db || acks.length === 0) {
    return;
  }

  const tx = db.transaction(OUTBOX_STORE, 'readwrite');

  for (const ack of acks) {
    const record = await tx.store.get(ack.id);

    if (!outboxOperationMatchesAck(record, ack)) {
      continue;
    }

    await tx.store.put({
      ...record,
      lastError: errorMessage,
      updatedAt: new Date().toISOString(),
      status: 'stale',
    });
  }

  await tx.done;
}

export function createSavedDraftState({ resume, template, localRevision = '' }) {
  const payload = createDraftPayload({
    resume,
    template,
    savedAt: new Date().toISOString(),
    localRevision,
  });

  return {
    resume: payload.resume,
    template: payload.template,
    savedAt: payload.savedAt,
    localRevision: payload.localRevision,
  };
}
