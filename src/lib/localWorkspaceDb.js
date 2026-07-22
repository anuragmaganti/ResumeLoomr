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
  dismissSampleInformation,
  mergeWorkspaceOrganizations,
  normalizeDraftPayload,
  normalizeWorkspaceIndex,
  placeWorkspaceResumeAfter,
  removeWorkspaceResumes,
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

function normalizeCloudVersion(value) {
  const version = Number(value);

  return Number.isSafeInteger(version) && version >= 0 ? version : 0;
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

  const rawCloudVersion = Number(operation.cloudVersion);

  const descriptor = {
    id,
    operationVersion: Number(operation.operationVersion || 0) || 0,
    localRevision: trimText(operation.localRevision),
  };

  if (Number.isSafeInteger(rawCloudVersion) && rawCloudVersion >= 0) {
    descriptor.cloudVersion = rawCloudVersion;
  }

  if (trimText(operation.reason)) {
    descriptor.reason = trimText(operation.reason);
  }

  return descriptor;
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
  const run = () => withLocalWorkspaceLock(callback);
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
    cloudVersion: normalizeCloudVersion(draft?.cloudVersion),
  };
}

function normalizeDraftState(draft) {
  const normalizedDraft = normalizeDraftPayload(draft);

  return {
    resume: normalizedDraft.resume,
    template: normalizedDraft.template,
    savedAt: draft?.savedAt || null,
    localRevision: draft?.localRevision || '',
    cloudVersion: normalizeCloudVersion(draft?.cloudVersion),
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

function preservePermanentSampleDismissal(preferredDraft, ...otherDrafts) {
  const normalizedPreferredDraft = normalizeDraftState(preferredDraft);
  const isDismissed = [normalizedPreferredDraft, ...otherDrafts]
    .some((draft) => normalizeDraftState(draft).resume.sampleDisplay.isDismissed);

  if (!isDismissed || normalizedPreferredDraft.resume.sampleDisplay.isDismissed) {
    return normalizedPreferredDraft;
  }

  return {
    ...normalizedPreferredDraft,
    resume: dismissSampleInformation(normalizedPreferredDraft.resume),
  };
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

function getTimestamp(value) {
  const timestamp = Date.parse(value || '');

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

function tombstoneAppliesToAccount(tombstone, accountUid = '') {
  const tombstoneAccountUid = trimText(tombstone?.accountUid);
  const normalizedAccountUid = trimText(accountUid);

  return !tombstoneAccountUid || !normalizedAccountUid || tombstoneAccountUid === normalizedAccountUid;
}

function filterTombstonesForAccount(tombstones, accountUid = '') {
  return (Array.isArray(tombstones) ? tombstones : [])
    .filter((tombstone) => tombstoneAppliesToAccount(tombstone, accountUid));
}

function mergeConcurrentLocalWorkspaces(currentWorkspace, incomingWorkspace, tombstones = []) {
  const current = normalizeWorkspaceIndex(currentWorkspace);
  const incoming = normalizeWorkspaceIndex(incomingWorkspace);
  const deletedIds = new Set(normalizeTombstoneList(tombstones).map((record) => record.resumeId));
  const resumeIds = [...new Set([...incoming.resumeIds, ...current.resumeIds])]
    .filter((resumeId) => !deletedIds.has(resumeId))
    .slice(0, MAX_WORKSPACE_RESUMES);
  const meta = Object.fromEntries(resumeIds.map((resumeId, index) => {
    const incomingMeta = incoming.meta[resumeId];
    const currentMeta = current.meta[resumeId];
    const incomingTimestamp = getTimestamp(incomingMeta?.updatedAt);
    const currentTimestamp = getTimestamp(currentMeta?.updatedAt);
    const preferredMeta = incomingTimestamp >= currentTimestamp ? incomingMeta : currentMeta;

    return [
      resumeId,
      createWorkspaceResumeMeta(preferredMeta?.name || `Resume ${index + 1}`, preferredMeta?.updatedAt || ''),
    ];
  }));

  return normalizeWorkspaceIndex({
    activeResumeId: resumeIds.includes(incoming.activeResumeId)
      ? incoming.activeResumeId
      : (resumeIds.includes(current.activeResumeId) ? current.activeResumeId : resumeIds[0] || ''),
    resumeIds,
    meta,
    organization: mergeWorkspaceOrganizations(
      incoming.organization,
      current.organization,
      resumeIds,
      {
        primaryResumeIds: incoming.resumeIds,
        secondaryResumeIds: current.resumeIds,
      },
    ),
  });
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

async function writeWorkspaceRecord(tx, workspace, { localRevision = '', cloudVersion = null } = {}) {
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

async function writeDraftRecord(tx, resumeId, draft, { localRevision = '' } = {}) {
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

function createOutboxRecordId(type, resumeId = '', accountUid = '') {
  const accountScope = encodeURIComponent(trimText(accountUid) || 'guest');
  const operationKey = type === 'workspace' ? 'workspace' : `${type}:${resumeId}`;

  return `${accountScope}:${operationKey}`;
}

function createOutboxRecord({ type, resumeId = '', workspace = null, draft = null, tombstone = null, accountUid = '', reason = '', baseCloudVersion = 0 }) {
  const now = new Date().toISOString();
  const syncIdentity = getSyncOperationIdentity();
  const id = createOutboxRecordId(type, resumeId, accountUid);

  return {
    id,
    type,
    resumeId,
    workspace: workspace ? normalizeWorkspaceIndex(workspace) : null,
    draft: draft ? normalizeDraftState(draft) : null,
    localRevision: draft ? (getDraftStateRevision(draft) || createLocalRevision()) : createLocalRevision(),
    baseCloudVersion: normalizeCloudVersion(baseCloudVersion),
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

async function deleteMatchingLegacyOutboxRecord(tx, legacyId, accountUid = '') {
  const outboxStore = tx.objectStore(OUTBOX_STORE);
  const legacyRecord = await outboxStore.get(legacyId);

  if (legacyRecord && trimText(legacyRecord.accountUid) === trimText(accountUid)) {
    await outboxStore.delete(legacyId);
  }
}

async function queueWorkspaceSyncInTx(tx, workspace, options = {}) {
  const workspaceRecord = await tx.objectStore(WORKSPACE_STORE).get(LOCAL_WORKSPACE_ID);

  await deleteMatchingLegacyOutboxRecord(tx, 'workspace', options.accountUid);
  await putOutboxRecord(tx, createOutboxRecord({
    type: 'workspace',
    workspace,
    baseCloudVersion: options.baseCloudVersion ?? workspaceRecord?.cloudVersion,
    accountUid: options.accountUid,
    reason: options.reason || 'workspace',
  }));
}

async function queueDraftSyncInTx(tx, resumeId, workspace, draft, options = {}) {
  await deleteMatchingLegacyOutboxRecord(tx, `upsertDraft:${resumeId}`, options.accountUid);
  await putOutboxRecord(tx, createOutboxRecord({
    type: 'upsertDraft',
    resumeId,
    workspace,
    draft,
    baseCloudVersion: options.baseCloudVersion ?? draft?.cloudVersion,
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
  await tx.objectStore(OUTBOX_STORE).delete(createOutboxRecordId('upsertDraft', resumeId, options.accountUid));
  await deleteMatchingLegacyOutboxRecord(tx, `upsertDraft:${resumeId}`, options.accountUid);
  await deleteMatchingLegacyOutboxRecord(tx, `deleteDraft:${resumeId}`, options.accountUid);
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
        workspaceLocalRevision: existingWorkspaceRecord.localRevision || '',
        workspaceCloudVersion: normalizeCloudVersion(existingWorkspaceRecord.cloudVersion),
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

    const workspaceRecord = await readWorkspaceRecord(db);

    return {
      ...legacySnapshot,
      workspaceLocalRevision: workspaceRecord?.localRevision || '',
      workspaceCloudVersion: normalizeCloudVersion(workspaceRecord?.cloudVersion),
    };
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
    workspaceLocalRevision: workspaceRecord?.localRevision || '',
    workspaceCloudVersion: normalizeCloudVersion(workspaceRecord?.cloudVersion),
  };
}

export async function readLocalDraft(resumeId) {
  const db = await getLocalWorkspaceDb();

  if (!db || !resumeId) {
    return readLegacyDraftFromLocalStorage(resumeId) || createBlankDraftState();
  }

  const record = await db.get(DRAFTS_STORE, resumeId);

  if (record?.draft) {
    return normalizeDraftWithRevision({
      ...record.draft,
      cloudVersion: record.draft.cloudVersion ?? record.cloudVersion,
    }, getDraftRecordRevision(record));
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

async function readLocalOutboxRecords() {
  const db = await getLocalWorkspaceDb();

  if (!db) {
    return [];
  }

  return db.getAll(OUTBOX_STORE);
}

export async function readLocalWorkspaceBundle() {
  const snapshot = await readLocalWorkspaceSnapshot();
  const [
    draftsByResumeId,
    tombstones,
    pendingOutbox,
    outboxRecords,
  ] = await Promise.all([
    readAllLocalDrafts(snapshot.workspace),
    readLocalTombstones(),
    readPendingOutbox({ limit: 1000 }),
    readLocalOutboxRecords(),
  ]);

  return {
    ...snapshot,
    draftsByResumeId,
    tombstones,
    pendingOutbox,
    outboxRecords,
  };
}

export function mergeLocalAndCloudWorkspaces({
  localWorkspace,
  localDraftsByResumeId,
  cloudWorkspace = null,
  cloudDraftsByResumeId = null,
  tombstones = [],
  cloudTombstones = [],
  pendingOutbox = [],
  outboxRecords = pendingOutbox,
  workspaceCloudVersion = 0,
  maxResumes = MAX_WORKSPACE_RESUMES,
} = {}) {
  const normalizedLocalWorkspace = normalizeWorkspaceIndex(localWorkspace);
  const normalizedCloudWorkspace = normalizeWorkspaceIndex(cloudWorkspace);
  const localDrafts = normalizeDraftMap(localDraftsByResumeId);
  const cloudDrafts = normalizeDraftMap(cloudDraftsByResumeId);
  const localTombstoneRecords = normalizeTombstoneList(tombstones, outboxRecords);
  const cloudTombstoneRecords = normalizeTombstoneList(cloudTombstones);
  const tombstoneRecords = normalizeTombstoneList([
    ...localTombstoneRecords,
    ...cloudTombstoneRecords,
  ]);
  const localTombstonedResumeIds = new Set(localTombstoneRecords.map((record) => record.resumeId));
  const remotelyTombstonedResumeIds = new Set(cloudTombstoneRecords.map((record) => record.resumeId));
  const unsyncedLocalUpsertResumeIds = new Set(
    (Array.isArray(outboxRecords) ? outboxRecords : [])
      .filter((record) => (
        record?.type === 'upsertDraft'
        && trimText(record.resumeId)
        && record.status !== 'synced'
      ))
      .map((record) => trimText(record.resumeId)),
  );
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
  const conflictCopySources = [];

  function addResume({ resumeId, draft, meta = {}, origin = 'cloud', forceUpsert = false, cloudVersion = null }) {
    if (!resumeId || mergedDrafts.has(resumeId) || tombstonedResumeIds.has(resumeId)) {
      return;
    }

    const normalizedDraft = normalizeDraftState({
      ...draft,
      cloudVersion: cloudVersion === null ? draft?.cloudVersion : cloudVersion,
    });
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

  function addConflictCopy({ sourceResumeId, draft, meta = {} }) {
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
      cloudVersion: 0,
    });
    conflictCopySources.push({ copyId, sourceResumeId });
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
          cloudVersion: 0,
        });
        return;
      }

      const localHash = createDraftMergeContentHash(localDraft);
      const cloudHash = createDraftMergeContentHash(cloudDraft);
      const cloudFullHash = createDraftContentHash(cloudDraft);

      if (localHash === cloudHash) {
        const localIsNewer = getDraftTimestamp(localDraft, normalizedLocalWorkspace.meta[resumeId]) >= getDraftTimestamp(cloudDraft, normalizedCloudWorkspace.meta[resumeId]);
        const preferredDraft = localIsNewer ? localDraft : cloudDraft;
        const mergedDraft = preservePermanentSampleDismissal(preferredDraft, localDraft, cloudDraft);
        const mergedFullHash = createDraftContentHash(mergedDraft);

        addResume({
          resumeId,
          draft: mergedDraft,
          meta: localHasContent ? normalizedLocalWorkspace.meta[resumeId] : normalizedCloudWorkspace.meta[resumeId],
          origin: mergedFullHash !== cloudFullHash ? 'local' : 'cloud',
          forceUpsert: mergedFullHash !== cloudFullHash,
          cloudVersion: cloudDraft.cloudVersion,
        });
        return;
      }

      const localIsNewer = getDraftTimestamp(localDraft, normalizedLocalWorkspace.meta[resumeId]) >= getDraftTimestamp(cloudDraft, normalizedCloudWorkspace.meta[resumeId]);

      if (localIsNewer) {
        addResume({
          resumeId,
          draft: preservePermanentSampleDismissal(localDraft, cloudDraft),
          meta: normalizedLocalWorkspace.meta[resumeId],
          origin: 'local',
          forceUpsert: true,
          cloudVersion: cloudDraft.cloudVersion,
        });
        addConflictCopy({
          sourceResumeId: resumeId,
          draft: cloudDraft,
          meta: normalizedCloudWorkspace.meta[resumeId],
        });
      } else {
        const mergedCloudDraft = preservePermanentSampleDismissal(cloudDraft, localDraft);

        addResume({
          resumeId,
          draft: mergedCloudDraft,
          meta: normalizedCloudWorkspace.meta[resumeId],
          origin: 'cloud',
          forceUpsert: createDraftContentHash(mergedCloudDraft) !== cloudFullHash,
          cloudVersion: cloudDraft.cloudVersion,
        });
        addConflictCopy({
          sourceResumeId: resumeId,
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

  let preservedRemoteDeleteConflict = false;

  remotelyTombstonedResumeIds.forEach((resumeId) => {
    if (
      localTombstonedResumeIds.has(resumeId)
      || !unsyncedLocalUpsertResumeIds.has(resumeId)
      || !normalizedLocalWorkspace.resumeIds.includes(resumeId)
    ) {
      return;
    }

    const localDraft = localDrafts.get(resumeId);

    if (!localDraft) {
      return;
    }

    addConflictCopy({
      sourceResumeId: resumeId,
      draft: localDraft,
      meta: normalizedLocalWorkspace.meta[resumeId],
    });
    preservedRemoteDeleteConflict = true;
  });

  if (preservedRemoteDeleteConflict) {
    warnings.push('A resume deleted on another device had local edits, so those edits were preserved as a separate copy.');
  }

  if (mergedResumeIds.length === 0) {
    const fresh = createFreshWorkspaceDraft();

    existingIds.add(fresh.activeResumeId);
    addResume({
      resumeId: fresh.activeResumeId,
      draft: fresh.draft,
      meta: fresh.workspace.meta[fresh.activeResumeId],
      origin: 'local',
      forceUpsert: true,
      cloudVersion: 0,
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
  const primaryOrganization = localHasContent
    ? normalizedLocalWorkspace.organization
    : normalizedCloudWorkspace.organization;
  const secondaryOrganization = localHasContent
    ? normalizedCloudWorkspace.organization
    : normalizedLocalWorkspace.organization;
  const primaryOrganizationResumeIds = localHasContent
    ? normalizedLocalWorkspace.resumeIds
    : normalizedCloudWorkspace.resumeIds;
  const secondaryOrganizationResumeIds = localHasContent
    ? normalizedCloudWorkspace.resumeIds
    : normalizedLocalWorkspace.resumeIds;
  let workspace = normalizeWorkspaceIndex({
    activeResumeId,
    resumeIds: nextResumeIds,
    meta: mergedMeta,
    organization: mergeWorkspaceOrganizations(
      primaryOrganization,
      secondaryOrganization,
      nextResumeIds,
      {
        primaryResumeIds: primaryOrganizationResumeIds,
        secondaryResumeIds: secondaryOrganizationResumeIds,
      },
    ),
  });
  conflictCopySources.forEach(({ copyId, sourceResumeId }) => {
    workspace = placeWorkspaceResumeAfter(workspace, copyId, sourceResumeId);
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
    tombstones: tombstoneRecords,
    workspaceCloudVersion: normalizeCloudVersion(workspaceCloudVersion),
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
  enqueueWorkspaceSync = false,
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

    const tx = db.transaction([WORKSPACE_STORE, DRAFTS_STORE, OUTBOX_STORE, TOMBSTONES_STORE], 'readwrite');
    const existingRecord = await tx.objectStore(DRAFTS_STORE).get(resumeId);
    const existingWorkspaceRecord = await tx.objectStore(WORKSPACE_STORE).get(LOCAL_WORKSPACE_ID);
    const tombstones = filterTombstonesForAccount(
      await tx.objectStore(TOMBSTONES_STORE).getAll(),
      accountUid,
    );
    const currentRevision = existingRecord ? getDraftRecordRevision(existingRecord) : '';

    if (tombstones.some((record) => record?.resumeId === resumeId)) {
      await tx.done;
      return {
        workspace: normalizeWorkspaceIndex(existingWorkspaceRecord?.workspace || normalizedWorkspace),
        draft: null,
        conflict: false,
        deleted: true,
        skipped: true,
      };
    }

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
    const draftWithRevision = normalizeDraftWithRevision({
      ...normalizedDraft,
      cloudVersion: Math.max(
        normalizeCloudVersion(normalizedDraft.cloudVersion),
        normalizeCloudVersion(existingRecord?.cloudVersion ?? existingRecord?.draft?.cloudVersion),
      ),
    }, nextRevision);
    const persistedWorkspace = persistWorkspace
      ? mergeConcurrentLocalWorkspaces(existingWorkspaceRecord?.workspace, normalizedWorkspace, tombstones)
      : normalizedWorkspace;

    if (persistWorkspace) {
      await writeWorkspaceRecord(tx, persistedWorkspace);
    }
    await writeDraftRecord(tx, resumeId, draftWithRevision, { localRevision: nextRevision });

    if (enqueueSync && enqueueWorkspaceSync && persistWorkspace) {
      await queueWorkspaceSyncInTx(tx, persistedWorkspace, { accountUid, reason });
    }

    if (enqueueSync) {
      await queueDraftSyncInTx(tx, resumeId, persistedWorkspace, draftWithRevision, { accountUid, reason });
    }

    await tx.done;

    if (persistWorkspace) {
      writeLocalStorageWorkspace(persistedWorkspace);
    }
    writeLocalStorageDraft(resumeId, draftWithRevision);

    return { workspace: persistedWorkspace, draft: draftWithRevision, conflict: false };
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

    if (!db) {
      writeLocalStorageWorkspace(normalizedWorkspace);
      return normalizedWorkspace;
    }

    const tx = db.transaction([WORKSPACE_STORE, OUTBOX_STORE, TOMBSTONES_STORE], 'readwrite');
    const [existingWorkspaceRecord, allTombstones] = await Promise.all([
      tx.objectStore(WORKSPACE_STORE).get(LOCAL_WORKSPACE_ID),
      tx.objectStore(TOMBSTONES_STORE).getAll(),
    ]);
    const tombstones = filterTombstonesForAccount(allTombstones, accountUid);
    const persistedWorkspace = mergeConcurrentLocalWorkspaces(
      existingWorkspaceRecord?.workspace,
      normalizedWorkspace,
      tombstones,
    );

    await writeWorkspaceRecord(tx, persistedWorkspace);

    if (enqueueSync) {
      await queueWorkspaceSyncInTx(tx, persistedWorkspace, { accountUid, reason });
    }

    await tx.done;
    writeLocalStorageWorkspace(persistedWorkspace);
    return persistedWorkspace;
  });
}

export async function persistLocalResumeBatchDelete({
  resumeIds,
  workspace,
  accountUid = '',
  enqueueSync = true,
  reason = 'batch-delete',
}) {
  return runLocalMutation(async () => {
    const db = await getLocalWorkspaceDb();
    const normalizedWorkspace = normalizeWorkspaceIndex(workspace);
    const deletedResumeIds = [...new Set(
      (Array.isArray(resumeIds) ? resumeIds : [])
        .map((resumeId) => trimText(resumeId))
        .filter(Boolean),
    )];

    if (!db || deletedResumeIds.length === 0) {
      writeLocalStorageWorkspace(normalizedWorkspace);
      deletedResumeIds.forEach(removeLocalStorageDraft);
      return normalizedWorkspace;
    }

    const tx = db.transaction([WORKSPACE_STORE, DRAFTS_STORE, OUTBOX_STORE, TOMBSTONES_STORE], 'readwrite');
    const [existingWorkspaceRecord, allExistingTombstones] = await Promise.all([
      tx.objectStore(WORKSPACE_STORE).get(LOCAL_WORKSPACE_ID),
      tx.objectStore(TOMBSTONES_STORE).getAll(),
    ]);
    const existingTombstones = filterTombstonesForAccount(allExistingTombstones, accountUid);
    const mergedWorkspace = mergeConcurrentLocalWorkspaces(
      existingWorkspaceRecord?.workspace,
      normalizedWorkspace,
      existingTombstones,
    );
    const deletionResult = removeWorkspaceResumes(mergedWorkspace, deletedResumeIds);
    const persistedWorkspace = deletionResult.rejectedReason
      ? normalizedWorkspace
      : deletionResult.workspace;

    await writeWorkspaceRecord(tx, persistedWorkspace);

    for (const resumeId of deletedResumeIds) {
      await tx.objectStore(DRAFTS_STORE).delete(resumeId);
    }

    if (enqueueSync) {
      await queueWorkspaceSyncInTx(tx, persistedWorkspace, { accountUid, reason });

      for (const resumeId of deletedResumeIds) {
        await queueDeleteSyncInTx(tx, resumeId, persistedWorkspace, { accountUid, reason });
      }
    }

    await tx.done;
    writeLocalStorageWorkspace(persistedWorkspace);
    deletedResumeIds.forEach(removeLocalStorageDraft);
    return persistedWorkspace;
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
    const mergedTombstones = normalizeTombstoneList(mergeResult?.tombstones);
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

    const effectiveAccountUid = trimText(accountUid || account?.uid);
    const [existingOutboxRecords, existingTombstones] = await Promise.all([
      tx.objectStore(OUTBOX_STORE).getAll(),
      tx.objectStore(TOMBSTONES_STORE).getAll(),
    ]);
    const preservedOutboxRecords = existingOutboxRecords.filter((record) => (
      trimText(record?.accountUid) && trimText(record.accountUid) !== effectiveAccountUid
    ));
    const preservedTombstones = existingTombstones.filter((record) => (
      trimText(record?.accountUid) && trimText(record.accountUid) !== effectiveAccountUid
    ));

    await writeWorkspaceRecord(tx, normalizedWorkspace, {
      cloudVersion: mergeResult?.workspaceCloudVersion,
    });
    await tx.objectStore(DRAFTS_STORE).clear();
    await tx.objectStore(OUTBOX_STORE).clear();
    await tx.objectStore(TOMBSTONES_STORE).clear();

    for (const record of preservedOutboxRecords) {
      await tx.objectStore(OUTBOX_STORE).put(record);
    }

    for (const tombstone of preservedTombstones) {
      await tx.objectStore(TOMBSTONES_STORE).put(tombstone);
    }

    for (const tombstone of mergedTombstones) {
      await tx.objectStore(TOMBSTONES_STORE).put({
        ...tombstone,
        accountUid: tombstone.accountUid || accountUid || account?.uid || '',
      });
    }

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
        clearSessionWhenSynced: false,
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

export async function readLocalAccountBinding() {
  const db = await getLocalWorkspaceDb();

  if (!db) {
    return null;
  }

  return db.get(ACCOUNT_BINDING_STORE, LOCAL_ACCOUNT_BINDING_ID);
}

export async function readDurableLocalBrowserContext() {
  const db = await getLocalWorkspaceDb();

  if (!db) {
    const legacy = readLegacyWorkspaceSnapshot();
    return {
      accountBinding: null,
      hasWorkspaceData: legacy.workspace.resumeIds.length > 0,
    };
  }

  const [workspaceRecord, draftRecords, accountBinding] = await Promise.all([
    db.get(WORKSPACE_STORE, LOCAL_WORKSPACE_ID),
    db.getAll(DRAFTS_STORE),
    db.get(ACCOUNT_BINDING_STORE, LOCAL_ACCOUNT_BINDING_ID),
  ]);
  const workspace = normalizeWorkspaceIndex(workspaceRecord?.workspace);

  return {
    accountBinding: accountBinding || null,
    hasWorkspaceData: workspace.resumeIds.length > 0 || draftRecords.length > 0,
  };
}

export async function setSyncSessionCleanupRequested(accountUid, requested = true) {
  const uid = trimText(accountUid);
  const db = await getLocalWorkspaceDb();

  if (!db || !uid) {
    return false;
  }

  return runLocalMutation(async () => {
    const current = await db.get(ACCOUNT_BINDING_STORE, LOCAL_ACCOUNT_BINDING_ID);

    if (trimText(current?.uid) !== uid) {
      return false;
    }

    await db.put(ACCOUNT_BINDING_STORE, {
      ...current,
      id: LOCAL_ACCOUNT_BINDING_ID,
      clearSessionWhenSynced: Boolean(requested),
      updatedAt: new Date().toISOString(),
    });
    return true;
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

  const tx = db.transaction([
    WORKSPACE_STORE,
    DRAFTS_STORE,
    OUTBOX_STORE,
    TOMBSTONES_STORE,
    ACCOUNT_BINDING_STORE,
  ], 'readwrite');
  const accountBinding = await tx.objectStore(ACCOUNT_BINDING_STORE).get(LOCAL_ACCOUNT_BINDING_ID);
  const boundAccountUid = trimText(accountBinding?.uid);

  for (const ack of acks) {
    const outboxStore = tx.objectStore(OUTBOX_STORE);
    const record = await outboxStore.get(ack.id);

    if (!record) {
      continue;
    }

    const exactMatch = outboxOperationMatchesAck(record, ack);
    const recordAccountUid = trimText(record.accountUid);
    const recordOwnsCurrentWorkspace = Boolean(
      recordAccountUid
      && boundAccountUid
      && recordAccountUid === boundAccountUid
    );

    if (recordOwnsCurrentWorkspace && Number.isSafeInteger(ack.cloudVersion) && ack.cloudVersion >= 0) {
      if (record.type === 'workspace') {
        const workspaceStore = tx.objectStore(WORKSPACE_STORE);
        const workspaceRecord = await workspaceStore.get(LOCAL_WORKSPACE_ID);

        if (workspaceRecord) {
          await workspaceStore.put({
            ...workspaceRecord,
            cloudVersion: Math.max(normalizeCloudVersion(workspaceRecord.cloudVersion), ack.cloudVersion),
          });
        }
      } else if (record.type === 'upsertDraft' && record.resumeId) {
        const draftsStore = tx.objectStore(DRAFTS_STORE);
        const draftRecord = await draftsStore.get(record.resumeId);

        if (draftRecord) {
          const cloudVersion = Math.max(
            normalizeCloudVersion(draftRecord.cloudVersion ?? draftRecord.draft?.cloudVersion),
            ack.cloudVersion,
          );
          await draftsStore.put({
            ...draftRecord,
            cloudVersion,
            draft: {
              ...draftRecord.draft,
              cloudVersion,
            },
          });
        }
      }

      if (!exactMatch && record.status === 'pending') {
        await outboxStore.put({
          ...record,
          baseCloudVersion: Math.max(normalizeCloudVersion(record.baseCloudVersion), ack.cloudVersion),
        });
      }
    }

    if (!exactMatch) {
      continue;
    }

    await outboxStore.delete(ack.id);

    if (record?.type === 'deleteDraft' && record.resumeId) {
      const tombstoneStore = tx.objectStore(TOMBSTONES_STORE);
      const tombstone = await tombstoneStore.get(record.resumeId);

      if (
        tombstone
        && (
          !trimText(tombstone.accountUid)
          || trimText(tombstone.accountUid) === recordAccountUid
        )
      ) {
        await tombstoneStore.put({
          ...tombstone,
          syncedAt: new Date().toISOString(),
        });
      }
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

export function createSavedDraftState({ resume, template, localRevision = '', cloudVersion = 0 }) {
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
    cloudVersion: normalizeCloudVersion(cloudVersion),
  };
}

export function createUnsyncedDraftCopyState(draft) {
  return createSavedDraftState({
    resume: draft?.resume,
    template: draft?.template,
  });
}
