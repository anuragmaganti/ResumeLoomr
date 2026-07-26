import {
  createDraftPayload,
  dismissSampleInformation,
  normalizeDraftPayload,
} from '../src/lib/resume.js';
import {
  createSavedCoverLetterDraft,
  normalizeCoverLetterDraft,
  serializeCoverLetterDraft,
} from '../src/lib/coverLetter.js';
import {
  mergeCoverLetterRegistries,
  getResumeCoverLetterIds,
  normalizeCoverLetterRegistry,
} from '../src/lib/coverLetterWorkspace.js';
import {
  createWorkspaceResumeMeta,
  mergeWorkspaceOrganizations,
  normalizeWorkspaceIndex,
} from '../src/lib/workspace.js';
import { getAdminDb } from './firebaseAdmin.js';
import { createHash } from 'node:crypto';

const CLOUD_WORKSPACE_SCHEMA_VERSION = 3;
const CLOUD_WORKSPACE_RESUME_LIMIT = 100;
const CLOUD_WORKSPACE_COVER_LETTER_LIMIT = 300;
const CLOUD_DRAFT_MAX_BYTES = 850_000;
const MAX_SYNC_OPERATIONS = 150;

function getSerializedByteSize(value) {
  const serialized = JSON.stringify(value);
  return Buffer.byteLength(serialized, 'utf8');
}

function getTimestamp(value) {
  const timestamp = Date.parse(value || '');
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function normalizeOperationList(body) {
  const operations = Array.isArray(body?.operations) ? body.operations : [];

  return operations
    .filter((operation) => operation && typeof operation === 'object' && typeof operation.id === 'string')
    .slice(0, MAX_SYNC_OPERATIONS);
}

function getOperationVersion(operation) {
  const explicitVersion = Number(operation?.operationVersion || 0);

  if (Number.isFinite(explicitVersion) && explicitVersion > 0) {
    return explicitVersion;
  }

  return getTimestamp(operation?.updatedAt) || Date.now();
}

function getOperationClientId(operation) {
  const clientId = typeof operation?.clientId === 'string' ? operation.clientId.trim() : '';

  return clientId || `legacy:${getOperationAccountUid(operation) || 'unknown'}`;
}

function getOperationScope(operation) {
  if (operation?.type === 'workspace') return 'workspace';
  if (operation?.type === 'upsertCoverLetter' || operation?.type === 'deleteCoverLetter') {
    return `cover-letter:${operation?.coverLetterId || 'unknown'}`;
  }
  return `resume:${operation?.resumeId || 'unknown'}`;
}

export function getSyncCursorId(operation) {
  return createHash('sha256')
    .update(`${getOperationClientId(operation)}:${getOperationScope(operation)}`)
    .digest('hex');
}

export function shouldAcceptSyncOperation(operation, cursorData = null) {
  const sequence = getOperationVersion(operation);
  const lastSequence = Number(cursorData?.lastSequence || 0);

  return Number.isFinite(sequence) && sequence > lastSequence;
}

export function shouldAcceptDraftSyncOperation(operation, cursorData = null, tombstoneExists = false) {
  return !tombstoneExists && shouldAcceptSyncOperation(operation, cursorData);
}

function getBaseCloudVersion(operation) {
  const version = Number(operation?.baseCloudVersion);

  return Number.isSafeInteger(version) && version >= 0 ? version : null;
}

export function shouldAcceptCloudVersion(operation, currentVersion = 0) {
  const normalizedCurrentVersion = Number.isSafeInteger(Number(currentVersion))
    ? Math.max(0, Number(currentVersion))
    : 0;
  const baseCloudVersion = getBaseCloudVersion(operation);

  // A brand-new cloud document is the only safe legacy rollout case. Existing
  // documents require an explicit precondition so another browser cannot win
  // merely because it has a different client cursor.
  if (baseCloudVersion === null) {
    return normalizedCurrentVersion === 0;
  }

  return baseCloudVersion === normalizedCurrentVersion;
}

function createOperationAck(operation, { cloudVersion = null, reason = '' } = {}) {
  const ack = {
    id: operation.id,
    operationVersion: Number(operation.operationVersion || 0) || 0,
    localRevision: typeof operation.localRevision === 'string' ? operation.localRevision : '',
  };

  if (cloudVersion !== null && Number.isSafeInteger(Number(cloudVersion)) && Number(cloudVersion) >= 0) {
    ack.cloudVersion = Number(cloudVersion);
  }

  if (reason) {
    ack.reason = reason;
  }

  return ack;
}

function getOperationAccountUid(operation) {
  return typeof operation?.accountUid === 'string' ? operation.accountUid.trim() : '';
}

export function operationBelongsToSyncAccount(operation, accountUid) {
  return Boolean(accountUid) && getOperationAccountUid(operation) === accountUid;
}

export function partitionSyncOperationsByAccount(operations, accountUid) {
  const scopedOperations = [];
  const rejectedOperations = [];

  operations.forEach((operation) => {
    if (operationBelongsToSyncAccount(operation, accountUid)) {
      scopedOperations.push(operation);
      return;
    }

    rejectedOperations.push(createOperationAck(operation));
  });

  return {
    scopedOperations,
    rejectedOperations,
  };
}

export function partitionOversizedSyncOperations(operations) {
  const acceptedOperations = [];
  const rejectedOperations = [];

  operations.forEach((operation) => {
    if (operation.type !== 'upsertDraft' && operation.type !== 'upsertCoverLetter') {
      acceptedOperations.push(operation);
      return;
    }

    try {
      if (operation.type === 'upsertCoverLetter') {
        createCoverLetterDoc({
          coverLetterId: operation.coverLetterId,
          resumeId: operation.resumeId,
          workspace: operation.workspace,
          draft: operation.draft,
          version: Math.max(1, Number(operation.baseCloudVersion || 0) + 1),
        });
      } else {
        createDraftDoc({
          resumeId: operation.resumeId,
          workspace: operation.workspace,
          draft: operation.draft,
          version: Math.max(1, Number(operation.baseCloudVersion || 0) + 1),
        });
      }
      acceptedOperations.push(operation);
    } catch (error) {
      if (error?.code !== 'sync/payload-too-large') {
        throw error;
      }

      rejectedOperations.push(createOperationAck(operation, {
        reason: 'payload-too-large',
      }));
    }
  });

  return { acceptedOperations, rejectedOperations };
}

export function createWorkspaceDoc(workspace, { deviceId = 'browser', sessionId = 'background-sync', updatedAt = new Date().toISOString(), version = Date.now() } = {}) {
  const normalizedWorkspace = normalizeWorkspaceIndex(workspace);
  const resumeIds = normalizedWorkspace.resumeIds.slice(0, CLOUD_WORKSPACE_RESUME_LIMIT);
  const activeResumeId = resumeIds.includes(normalizedWorkspace.activeResumeId)
    ? normalizedWorkspace.activeResumeId
    : resumeIds[0] || '';

  return {
    schemaVersion: CLOUD_WORKSPACE_SCHEMA_VERSION,
    activeResumeId,
    resumeIds,
    meta: Object.fromEntries(
      resumeIds.map((resumeId, index) => [
        resumeId,
        createWorkspaceResumeMeta(
          normalizedWorkspace.meta[resumeId]?.name || `Resume ${index + 1}`,
          normalizedWorkspace.meta[resumeId]?.updatedAt || updatedAt,
        ),
      ]),
    ),
    organization: normalizedWorkspace.organization,
    coverLetters: normalizedWorkspace.coverLetters,
    updatedAt,
    version,
    deviceId,
    sessionId,
  };
}

function createDraftDoc({
  resumeId,
  workspace,
  draft,
  deviceId = 'browser',
  sessionId = 'background-sync',
  updatedAt = new Date().toISOString(),
  version = 1,
}) {
  const normalizedWorkspace = normalizeWorkspaceIndex(workspace);
  const normalizedDraft = normalizeDraftPayload(draft);
  const savedAt = typeof draft?.savedAt === 'string' && draft.savedAt
    ? draft.savedAt
    : new Date().toISOString();
  const payload = createDraftPayload({
    resume: normalizedDraft.resume,
    template: normalizedDraft.template,
    savedAt,
    localRevision: normalizedDraft.localRevision,
  });
  const name = normalizedWorkspace.meta[resumeId]?.name || 'Resume';
  const doc = {
    schemaVersion: CLOUD_WORKSPACE_SCHEMA_VERSION,
    resumeId,
    name,
    template: payload.template,
    resume: payload.resume,
    savedAt,
    updatedAt,
    version,
    deviceId,
    sessionId,
    deletedAt: null,
  };

  if (getSerializedByteSize(doc) > CLOUD_DRAFT_MAX_BYTES) {
    const error = new Error('This resume is too large to sync.');
    error.statusCode = 413;
    error.code = 'sync/payload-too-large';
    throw error;
  }

  return doc;
}

function createCoverLetterDoc({
  coverLetterId,
  resumeId,
  workspace,
  draft,
  deviceId = 'browser',
  sessionId = 'background-sync',
  updatedAt = new Date().toISOString(),
  version = 1,
}) {
  const normalizedWorkspace = normalizeWorkspaceIndex(workspace);
  const normalizedDraft = createSavedCoverLetterDraft(
    normalizeCoverLetterDraft(draft, resumeId),
    draft?.savedAt || updatedAt,
  );
  const meta = normalizedWorkspace.coverLetters.meta[coverLetterId];
  const payload = serializeCoverLetterDraft(normalizedDraft);
  const doc = {
    schemaVersion: CLOUD_WORKSPACE_SCHEMA_VERSION,
    coverLetterId,
    resumeId: meta?.resumeId || normalizedDraft.coverLetter.resumeId || resumeId,
    name: meta?.name || 'Cover letter',
    template: payload.template,
    coverLetter: payload.coverLetter,
    savedAt: payload.savedAt,
    importWarnings: payload.importWarnings,
    updatedAt,
    version,
    deviceId,
    sessionId,
    deletedAt: null,
  };

  if (getSerializedByteSize(doc) > CLOUD_DRAFT_MAX_BYTES) {
    const error = new Error('This cover letter is too large to sync.');
    error.statusCode = 413;
    error.code = 'sync/payload-too-large';
    throw error;
  }

  return doc;
}

export function preservePermanentSampleDismissal(draft, currentResumeDocument = null) {
  const normalizedDraft = normalizeDraftPayload(draft);
  const wasDismissed = currentResumeDocument?.resume?.sampleDisplay?.isDismissed === true;

  if (!wasDismissed || normalizedDraft.resume.sampleDisplay.isDismissed) {
    return normalizedDraft;
  }

  return {
    ...normalizedDraft,
    resume: dismissSampleInformation(normalizedDraft.resume),
  };
}

function cloudDocToDraft(data) {
  const normalizedDraft = normalizeDraftPayload({
    template: data?.template,
    resume: data?.resume,
    savedAt: data?.savedAt || data?.updatedAt || null,
  });

  return {
    resume: normalizedDraft.resume,
    template: normalizedDraft.template,
    savedAt: data?.savedAt || data?.updatedAt || null,
    cloudVersion: Math.max(0, Number(data?.version || 0) || 0),
  };
}

function cloudDocToCoverLetterDraft(data) {
  return normalizeCoverLetterDraft({
    coverLetter: data?.coverLetter,
    template: data?.template,
    savedAt: data?.savedAt || data?.updatedAt || null,
    importWarnings: data?.importWarnings,
    cloudVersion: Math.max(0, Number(data?.version || 0) || 0),
  }, data?.resumeId);
}

function getCoverLetterOperationValidationReason(operation, {
  currentCoverLetter = null,
  parentExists = false,
  parentDeleted = false,
  parentWillExist = false,
} = {}) {
  const coverLetterId = typeof operation?.coverLetterId === 'string'
    ? operation.coverLetterId.trim()
    : '';
  const resumeId = typeof operation?.resumeId === 'string' ? operation.resumeId.trim() : '';
  const draftResumeId = typeof operation?.draft?.coverLetter?.resumeId === 'string'
    ? operation.draft.coverLetter.resumeId.trim()
    : '';
  const operationWorkspace = normalizeWorkspaceIndex(operation?.workspace);
  const registryMeta = operationWorkspace.coverLetters.meta[coverLetterId];

  if (!coverLetterId || !resumeId || coverLetterId.includes('/') || resumeId.includes('/')) {
    return 'invalid-document-id';
  }
  if (coverLetterId.length > 200 || resumeId.length > 200) return 'invalid-document-id';
  if (draftResumeId !== resumeId) return 'parent-mismatch';
  if (!operationWorkspace.resumeIds.includes(resumeId) || registryMeta?.resumeId !== resumeId) {
    return 'missing-attachment-metadata';
  }
  if (currentCoverLetter?.resumeId && currentCoverLetter.resumeId !== resumeId) {
    return 'parent-mismatch';
  }
  if (parentDeleted) return 'parent-deleted';
  if (!parentExists && !parentWillExist) return 'parent-missing';
  return '';
}

export function validateCoverLetterSyncOperation(operation, context = {}) {
  return getCoverLetterOperationValidationReason(operation, context);
}

async function cascadeDeletedResumeCoverLetters(db, uid, resumeIds, registryEntries = []) {
  const normalizedResumeIds = [...new Set(
    (Array.isArray(resumeIds) ? resumeIds : [])
      .map((resumeId) => String(resumeId || '').trim())
      .filter(Boolean),
  )];
  if (normalizedResumeIds.length === 0) return;

  const discovered = new Map(
    (Array.isArray(registryEntries) ? registryEntries : [])
      .filter((entry) => entry?.coverLetterId && entry?.resumeId)
      .map((entry) => [entry.coverLetterId, entry]),
  );

  for (const resumeId of normalizedResumeIds) {
    const snapshot = await db.collection(`users/${uid}/coverLetters`)
      .where('resumeId', '==', resumeId)
      .get();
    snapshot.docs.forEach((doc) => {
      discovered.set(doc.id, { coverLetterId: doc.id, resumeId });
    });
  }

  const entries = [...discovered.values()];
  for (let offset = 0; offset < entries.length; offset += 200) {
    const batch = db.batch();
    const deletedAt = new Date().toISOString();
    entries.slice(offset, offset + 200).forEach(({ coverLetterId, resumeId }) => {
      batch.delete(db.doc(`users/${uid}/coverLetters/${coverLetterId}`));
      batch.set(db.doc(`users/${uid}/coverLetterTombstones/${coverLetterId}`), {
        coverLetterId,
        resumeId,
        deletedAt,
        clientId: 'server:cascade-resume-delete',
        operationVersion: Date.now(),
        localRevision: '',
      }, { merge: false });
    });
    await batch.commit();
  }
}

export function cloudWorkspaceFromDoc(data) {
  return normalizeWorkspaceIndex({
    activeResumeId: data?.activeResumeId,
    resumeIds: data?.resumeIds,
    meta: data?.meta,
    organization: data?.organization,
    coverLetters: data?.coverLetters,
  });
}

export function mergeCloudWorkspaceForWrite(incomingWorkspace, currentData, { deletedResumeIds = [] } = {}) {
  const incoming = normalizeWorkspaceIndex(incomingWorkspace);
  const current = cloudWorkspaceFromDoc(currentData);
  const deletedIds = new Set(deletedResumeIds);
  const resumeIds = [...new Set([...incoming.resumeIds, ...current.resumeIds])]
    .filter((resumeId) => !deletedIds.has(resumeId))
    .slice(0, CLOUD_WORKSPACE_RESUME_LIMIT);
  const meta = Object.fromEntries(resumeIds.map((resumeId, index) => {
    const incomingMeta = incoming.meta[resumeId];
    const currentMeta = current.meta[resumeId];
    const incomingIsNewer = getTimestamp(incomingMeta?.updatedAt) >= getTimestamp(currentMeta?.updatedAt);
    const preferredMeta = incomingIsNewer ? incomingMeta : currentMeta;

    return [
      resumeId,
      createWorkspaceResumeMeta(preferredMeta?.name || `Resume ${index + 1}`, preferredMeta?.updatedAt || ''),
    ];
  }));
  const activeResumeId = resumeIds.includes(incoming.activeResumeId)
    ? incoming.activeResumeId
    : (resumeIds.includes(current.activeResumeId) ? current.activeResumeId : resumeIds[0] || '');

  const nextCoverLetters = mergeCoverLetterRegistries(
    incoming.coverLetters,
    current.coverLetters,
    resumeIds,
  );

  return normalizeWorkspaceIndex({
    activeResumeId,
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
    coverLetters: nextCoverLetters,
  });
}

function sortResumeDocsByUpdatedAt(docs) {
  return [...docs].sort((a, b) => (
    getTimestamp(b.data.updatedAt || b.data.savedAt) - getTimestamp(a.data.updatedAt || a.data.savedAt)
  ));
}

export async function readCloudSnapshot(uid) {
  const db = getAdminDb();
  const workspaceRef = db.doc(`users/${uid}/workspace/main`);
  const [
    workspaceSnapshot,
    resumesSnapshot,
    tombstonesSnapshot,
    coverLettersSnapshot,
    coverLetterTombstonesSnapshot,
  ] = await Promise.all([
    workspaceRef.get(),
    db.collection(`users/${uid}/resumes`).get(),
    db.collection(`users/${uid}/resumeTombstones`).get(),
    db.collection(`users/${uid}/coverLetters`).get(),
    db.collection(`users/${uid}/coverLetterTombstones`).get(),
  ]);
  const tombstones = tombstonesSnapshot.docs.map((doc) => ({
    ...doc.data(),
    resumeId: doc.id,
  }));
  const tombstonedResumeIds = new Set(tombstones.map((record) => record.resumeId));
  const resumeDocs = sortResumeDocsByUpdatedAt(
    resumesSnapshot.docs
      .map((doc) => ({ id: doc.id, data: doc.data() }))
      .filter((record) => !record.data?.deletedAt && !tombstonedResumeIds.has(record.id)),
  ).slice(0, CLOUD_WORKSPACE_RESUME_LIMIT);
  const draftsByResumeId = new Map(
    resumeDocs.map((record) => [record.id, cloudDocToDraft(record.data)]),
  );
  const storedWorkspace = workspaceSnapshot.exists ? cloudWorkspaceFromDoc(workspaceSnapshot.data()) : null;
  const orderedResumeIds = storedWorkspace
    ? [
        ...storedWorkspace.resumeIds.filter((resumeId) => draftsByResumeId.has(resumeId)),
        ...resumeDocs.map((record) => record.id).filter((resumeId) => !storedWorkspace.resumeIds.includes(resumeId)),
      ]
    : resumeDocs.map((record) => record.id);

  if (
    orderedResumeIds.length === 0
    && tombstones.length === 0
    && coverLetterTombstonesSnapshot.empty
  ) {
    return null;
  }

  const meta = Object.fromEntries(
    orderedResumeIds.map((resumeId, index) => {
      const sourceMeta = storedWorkspace?.meta?.[resumeId];
      const docData = resumeDocs.find((record) => record.id === resumeId)?.data;

      return [
        resumeId,
        createWorkspaceResumeMeta(
          sourceMeta?.name || docData?.name || `Resume ${index + 1}`,
          sourceMeta?.updatedAt || docData?.updatedAt || docData?.savedAt || '',
        ),
      ];
    }),
  );
  const workspace = normalizeWorkspaceIndex({
    activeResumeId: orderedResumeIds.includes(storedWorkspace?.activeResumeId)
      ? storedWorkspace.activeResumeId
      : orderedResumeIds[0],
    resumeIds: orderedResumeIds,
    meta,
    organization: storedWorkspace?.organization,
    coverLetters: storedWorkspace?.coverLetters,
  });

  const coverLetterTombstones = coverLetterTombstonesSnapshot.docs.map((doc) => ({
    ...doc.data(),
    coverLetterId: doc.id,
  }));
  const tombstonedCoverLetterIds = new Set(coverLetterTombstones.map((record) => record.coverLetterId));
  const coverLetterDocs = sortResumeDocsByUpdatedAt(
    coverLettersSnapshot.docs
      .map((doc) => ({ id: doc.id, data: doc.data() }))
      .filter((record) => (
        !record.data?.deletedAt
        && !tombstonedCoverLetterIds.has(record.id)
        && workspace.resumeIds.includes(record.data?.resumeId)
      )),
  ).slice(0, CLOUD_WORKSPACE_COVER_LETTER_LIMIT);
  const recoveredRegistry = normalizeCoverLetterRegistry({
    ...workspace.coverLetters,
    meta: {
      ...workspace.coverLetters.meta,
      ...Object.fromEntries(coverLetterDocs.map((record) => [record.id, {
        id: record.id,
        resumeId: record.data.resumeId,
        name: record.data.name || 'Cover letter',
        updatedAt: record.data.updatedAt || record.data.savedAt || '',
      }])),
    },
    orderByResumeId: Object.fromEntries(workspace.resumeIds.map((resumeId) => [
      resumeId,
      [
        ...(workspace.coverLetters.orderByResumeId[resumeId] || []),
        ...coverLetterDocs
          .filter((record) => record.data.resumeId === resumeId)
          .map((record) => record.id),
      ],
    ])),
  }, workspace.resumeIds);
  const restoredWorkspace = normalizeWorkspaceIndex({ ...workspace, coverLetters: recoveredRegistry });

  return {
    workspace: restoredWorkspace,
    workspaceVersion: Math.max(0, Number(workspaceSnapshot.data()?.version || 0) || 0),
    drafts: Object.fromEntries(
      restoredWorkspace.resumeIds.map((resumeId) => [resumeId, draftsByResumeId.get(resumeId)]).filter(([, draft]) => draft),
    ),
    tombstones,
    coverLetterDrafts: Object.fromEntries(
      coverLetterDocs.map((record) => [record.id, cloudDocToCoverLetterDraft(record.data)]),
    ),
    coverLetterTombstones,
  };
}

function coalesceOperations(operations) {
  const latestWorkspaceOperation = [...operations].reverse().find((operation) => (
    operation.type === 'workspace' && operation.workspace
  ));
  const draftOperations = new Map();
  const deleteOperations = new Map();
  const coverLetterOperations = new Map();
  const coverLetterDeleteOperations = new Map();

  operations.forEach((operation) => {
    if (operation.type === 'deleteDraft' && operation.resumeId) {
      draftOperations.delete(operation.resumeId);
      deleteOperations.set(operation.resumeId, operation);
      return;
    }

    if (operation.type === 'upsertDraft' && operation.resumeId && operation.draft) {
      deleteOperations.delete(operation.resumeId);
      draftOperations.set(operation.resumeId, operation);
      return;
    }

    if (operation.type === 'deleteCoverLetter' && operation.coverLetterId) {
      coverLetterOperations.delete(operation.coverLetterId);
      coverLetterDeleteOperations.set(operation.coverLetterId, operation);
      return;
    }

    if (operation.type === 'upsertCoverLetter' && operation.coverLetterId && operation.resumeId && operation.draft) {
      coverLetterDeleteOperations.delete(operation.coverLetterId);
      coverLetterOperations.set(operation.coverLetterId, operation);
    }
  });

  return {
    workspaceOperation: latestWorkspaceOperation || null,
    draftOperations: Array.from(draftOperations.values()),
    deleteOperations: Array.from(deleteOperations.values()),
    coverLetterOperations: Array.from(coverLetterOperations.values()),
    coverLetterDeleteOperations: Array.from(coverLetterDeleteOperations.values()),
  };
}

export async function applySyncOperations(uid, operations) {
  const db = getAdminDb();
  const workspaceRef = db.doc(`users/${uid}/workspace/main`);
  const {
    workspaceOperation,
    draftOperations,
    deleteOperations,
    coverLetterOperations,
    coverLetterDeleteOperations,
  } = coalesceOperations(operations);
  const syncedOperations = [];
  const staleOperations = [];
  const cascadedResumeIds = new Set();
  const cascadeRegistryEntries = new Map();

  await db.runTransaction(async (transaction) => {
    const workspace = workspaceOperation?.workspace ? normalizeWorkspaceIndex(workspaceOperation.workspace) : null;
    const workspaceWrite = workspace
      ? {
          operation: workspaceOperation,
          ref: workspaceRef,
          cursorRef: db.doc(`users/${uid}/syncCursors/${getSyncCursorId(workspaceOperation)}`),
        }
      : null;
    const draftWrites = draftOperations.map((operation) => ({
      operation,
      ref: db.doc(`users/${uid}/resumes/${operation.resumeId}`),
      cursorRef: db.doc(`users/${uid}/syncCursors/${getSyncCursorId(operation)}`),
      tombstoneRef: db.doc(`users/${uid}/resumeTombstones/${operation.resumeId}`),
    }));
    const deleteWrites = deleteOperations.map((operation) => ({
      operation,
      ref: db.doc(`users/${uid}/resumes/${operation.resumeId}`),
      cursorRef: db.doc(`users/${uid}/syncCursors/${getSyncCursorId(operation)}`),
      tombstoneRef: db.doc(`users/${uid}/resumeTombstones/${operation.resumeId}`),
    }));
    const coverLetterWrites = coverLetterOperations.map((operation) => ({
      operation,
      ref: db.doc(`users/${uid}/coverLetters/${operation.coverLetterId}`),
      cursorRef: db.doc(`users/${uid}/syncCursors/${getSyncCursorId(operation)}`),
      tombstoneRef: db.doc(`users/${uid}/coverLetterTombstones/${operation.coverLetterId}`),
      parentRef: db.doc(`users/${uid}/resumes/${operation.resumeId}`),
      parentTombstoneRef: db.doc(`users/${uid}/resumeTombstones/${operation.resumeId}`),
    }));
    const coverLetterDeleteWrites = coverLetterDeleteOperations.map((operation) => ({
      operation,
      ref: db.doc(`users/${uid}/coverLetters/${operation.coverLetterId}`),
      cursorRef: db.doc(`users/${uid}/syncCursors/${getSyncCursorId(operation)}`),
      tombstoneRef: db.doc(`users/${uid}/coverLetterTombstones/${operation.coverLetterId}`),
    }));
    const [
      workspaceSnapshot,
      workspaceCursorSnapshot,
      draftSnapshots,
      draftCursorSnapshots,
      draftTombstoneSnapshots,
      deleteCursorSnapshots,
      deleteTombstoneSnapshots,
      coverLetterSnapshots,
      coverLetterCursorSnapshots,
      coverLetterTombstoneSnapshots,
      coverLetterParentSnapshots,
      coverLetterParentTombstoneSnapshots,
      coverLetterDeleteCursorSnapshots,
      coverLetterDeleteTombstoneSnapshots,
    ] = await Promise.all([
      workspaceWrite || deleteWrites.length > 0
        ? transaction.get(workspaceRef)
        : Promise.resolve(null),
      workspaceWrite ? transaction.get(workspaceWrite.cursorRef) : Promise.resolve(null),
      Promise.all(draftWrites.map((write) => transaction.get(write.ref))),
      Promise.all(draftWrites.map((write) => transaction.get(write.cursorRef))),
      Promise.all(draftWrites.map((write) => transaction.get(write.tombstoneRef))),
      Promise.all(deleteWrites.map((write) => transaction.get(write.cursorRef))),
      Promise.all(deleteWrites.map((write) => transaction.get(write.tombstoneRef))),
      Promise.all(coverLetterWrites.map((write) => transaction.get(write.ref))),
      Promise.all(coverLetterWrites.map((write) => transaction.get(write.cursorRef))),
      Promise.all(coverLetterWrites.map((write) => transaction.get(write.tombstoneRef))),
      Promise.all(coverLetterWrites.map((write) => transaction.get(write.parentRef))),
      Promise.all(coverLetterWrites.map((write) => transaction.get(write.parentTombstoneRef))),
      Promise.all(coverLetterDeleteWrites.map((write) => transaction.get(write.cursorRef))),
      Promise.all(coverLetterDeleteWrites.map((write) => transaction.get(write.tombstoneRef))),
    ]);

    const acceptedDraftResumeIds = new Set(
      draftWrites
        .filter((write, index) => {
          const currentSnapshot = draftSnapshots[index];
          return (
            !draftTombstoneSnapshots[index].exists
            && shouldAcceptSyncOperation(write.operation, draftCursorSnapshots[index]?.data?.())
            && shouldAcceptCloudVersion(
              write.operation,
              Number(currentSnapshot.exists ? currentSnapshot.data()?.version || 0 : 0),
            )
          );
        })
        .map((write) => write.operation.resumeId),
    );
    const acceptedDeleteResumeIds = deleteWrites
      .filter((write, index) => shouldAcceptSyncOperation(
        write.operation,
        deleteCursorSnapshots[index]?.data?.(),
      ))
      .map((write) => write.operation.resumeId);
    const currentWorkspace = workspaceSnapshot?.exists
      ? cloudWorkspaceFromDoc(workspaceSnapshot.data())
      : normalizeWorkspaceIndex({});

    acceptedDeleteResumeIds.forEach((resumeId) => {
      getResumeCoverLetterIds(currentWorkspace, resumeId).forEach((coverLetterId) => {
        cascadeRegistryEntries.set(coverLetterId, { coverLetterId, resumeId });
      });
    });

    function writeCursor(write) {
      transaction.set(write.cursorRef, {
        clientId: getOperationClientId(write.operation),
        scope: getOperationScope(write.operation),
        lastSequence: getOperationVersion(write.operation),
        updatedAt: new Date().toISOString(),
      }, { merge: false });
    }

    let workspaceWasWritten = false;

    if (workspaceWrite) {
      const currentVersion = Number(workspaceSnapshot?.exists ? workspaceSnapshot.data()?.version || 0 : 0);
      const cursorIsCurrent = shouldAcceptSyncOperation(workspaceWrite.operation, workspaceCursorSnapshot?.data?.());
      const cloudVersionMatches = shouldAcceptCloudVersion(workspaceWrite.operation, currentVersion);

      if (cursorIsCurrent && cloudVersionMatches) {
        const mergedWorkspace = mergeCloudWorkspaceForWrite(
          workspace,
          workspaceSnapshot?.exists ? workspaceSnapshot.data() : null,
          { deletedResumeIds: acceptedDeleteResumeIds },
        );

        transaction.set(workspaceWrite.ref, createWorkspaceDoc(mergedWorkspace, {
          updatedAt: new Date().toISOString(),
          version: currentVersion + 1,
        }), { merge: false });
        writeCursor(workspaceWrite);
        workspaceWasWritten = true;
        syncedOperations.push(createOperationAck(workspaceWrite.operation, {
          cloudVersion: currentVersion + 1,
        }));
      } else {
        staleOperations.push(createOperationAck(workspaceWrite.operation, {
          cloudVersion: currentVersion,
          reason: cloudVersionMatches ? 'duplicate-operation' : 'version-conflict',
        }));
      }
    }

    if (!workspaceWasWritten && acceptedDeleteResumeIds.length > 0 && workspaceSnapshot?.exists) {
      const currentVersion = Number(workspaceSnapshot.data()?.version || 0);
      const cleanedWorkspace = mergeCloudWorkspaceForWrite(
        currentWorkspace,
        workspaceSnapshot.data(),
        { deletedResumeIds: acceptedDeleteResumeIds },
      );
      transaction.set(workspaceRef, createWorkspaceDoc(cleanedWorkspace, {
        updatedAt: new Date().toISOString(),
        version: currentVersion + 1,
      }), { merge: false });
    }

    draftWrites.forEach((write, index) => {
      const currentSnapshot = draftSnapshots[index];
      const currentVersion = Number(currentSnapshot.exists ? currentSnapshot.data()?.version || 0 : 0);
      const cursorIsCurrent = shouldAcceptSyncOperation(
        write.operation,
        draftCursorSnapshots[index]?.data?.(),
      );
      const cloudVersionMatches = shouldAcceptCloudVersion(write.operation, currentVersion);
      const tombstoneExists = draftTombstoneSnapshots[index].exists;

      if (
        !tombstoneExists
        && cursorIsCurrent
        && cloudVersionMatches
      ) {
        transaction.set(write.ref, createDraftDoc({
          resumeId: write.operation.resumeId,
          workspace: write.operation.workspace || workspace,
          draft: preservePermanentSampleDismissal(
            write.operation.draft,
            currentSnapshot.exists ? currentSnapshot.data() : null,
          ),
          updatedAt: new Date().toISOString(),
          version: currentVersion + 1,
        }), { merge: false });
        writeCursor(write);
        syncedOperations.push(createOperationAck(write.operation, {
          cloudVersion: currentVersion + 1,
        }));
      } else {
        staleOperations.push(createOperationAck(write.operation, {
          cloudVersion: currentVersion,
          reason: tombstoneExists
            ? 'deleted-remotely'
            : (cloudVersionMatches ? 'duplicate-operation' : 'version-conflict'),
        }));
      }
    });

    coverLetterWrites.forEach((write, index) => {
      const currentSnapshot = coverLetterSnapshots[index];
      const currentVersion = Number(currentSnapshot.exists ? currentSnapshot.data()?.version || 0 : 0);
      const cursorIsCurrent = shouldAcceptSyncOperation(
        write.operation,
        coverLetterCursorSnapshots[index]?.data?.(),
      );
      const cloudVersionMatches = shouldAcceptCloudVersion(write.operation, currentVersion);
      const tombstoneExists = coverLetterTombstoneSnapshots[index].exists;
      const parentExists = coverLetterParentSnapshots[index].exists;
      const parentDeleted = coverLetterParentTombstoneSnapshots[index].exists;
      const validationReason = getCoverLetterOperationValidationReason(write.operation, {
        currentCoverLetter: currentSnapshot.exists ? currentSnapshot.data() : null,
        parentExists,
        parentDeleted,
        parentWillExist: acceptedDraftResumeIds.has(write.operation.resumeId),
      });

      if (!validationReason && !tombstoneExists && cursorIsCurrent && cloudVersionMatches) {
        transaction.set(write.ref, createCoverLetterDoc({
          coverLetterId: write.operation.coverLetterId,
          resumeId: write.operation.resumeId,
          workspace: write.operation.workspace || workspace,
          draft: write.operation.draft,
          updatedAt: new Date().toISOString(),
          version: currentVersion + 1,
        }), { merge: false });
        writeCursor(write);
        syncedOperations.push(createOperationAck(write.operation, {
          cloudVersion: currentVersion + 1,
        }));
      } else {
        staleOperations.push(createOperationAck(write.operation, {
          cloudVersion: currentVersion,
          reason: validationReason || (tombstoneExists
            ? 'deleted-remotely'
            : (cloudVersionMatches ? 'duplicate-operation' : 'version-conflict')),
        }));
      }
    });

    deleteWrites.forEach((write, index) => {
      if (shouldAcceptSyncOperation(write.operation, deleteCursorSnapshots[index]?.data?.())) {
        transaction.delete(write.ref);
        transaction.set(write.tombstoneRef, {
          resumeId: write.operation.resumeId,
          deletedAt: new Date().toISOString(),
          clientId: getOperationClientId(write.operation),
          operationVersion: getOperationVersion(write.operation),
          localRevision: write.operation.localRevision || '',
        }, { merge: false });
        writeCursor(write);
        cascadedResumeIds.add(write.operation.resumeId);
        syncedOperations.push(createOperationAck(write.operation, {
          cloudVersion: 0,
        }));
      } else if (
        deleteTombstoneSnapshots[index].exists
        && Number(deleteTombstoneSnapshots[index].data()?.operationVersion || 0)
          === getOperationVersion(write.operation)
        && deleteTombstoneSnapshots[index].data()?.clientId === getOperationClientId(write.operation)
      ) {
        cascadedResumeIds.add(write.operation.resumeId);
        syncedOperations.push(createOperationAck(write.operation, { cloudVersion: 0 }));
      } else {
        staleOperations.push(createOperationAck(write.operation, {
          reason: 'duplicate-operation',
        }));
      }
    });

    coverLetterDeleteWrites.forEach((write, index) => {
      if (shouldAcceptSyncOperation(write.operation, coverLetterDeleteCursorSnapshots[index]?.data?.())) {
        transaction.delete(write.ref);
        transaction.set(write.tombstoneRef, {
          coverLetterId: write.operation.coverLetterId,
          resumeId: write.operation.resumeId || '',
          deletedAt: new Date().toISOString(),
          clientId: getOperationClientId(write.operation),
          operationVersion: getOperationVersion(write.operation),
          localRevision: write.operation.localRevision || '',
        }, { merge: false });
        writeCursor(write);
        syncedOperations.push(createOperationAck(write.operation, { cloudVersion: 0 }));
      } else if (
        coverLetterDeleteTombstoneSnapshots[index].exists
        && Number(coverLetterDeleteTombstoneSnapshots[index].data()?.operationVersion || 0)
          === getOperationVersion(write.operation)
        && coverLetterDeleteTombstoneSnapshots[index].data()?.clientId === getOperationClientId(write.operation)
      ) {
        syncedOperations.push(createOperationAck(write.operation, { cloudVersion: 0 }));
      } else {
        staleOperations.push(createOperationAck(write.operation, { reason: 'duplicate-operation' }));
      }
    });
  });

  await cascadeDeletedResumeCoverLetters(
    db,
    uid,
    [...cascadedResumeIds],
    [...cascadeRegistryEntries.values()],
  );

  return { syncedOperations, staleOperations };
}
