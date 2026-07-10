import {
  createDraftPayload,
  createWorkspaceResumeMeta,
  dismissSampleInformation,
  normalizeDraftPayload,
  normalizeWorkspaceIndex,
} from '../src/lib/resume.js';
import {
  FirebaseAdminError,
  getAdminDb,
  verifyRequestUser,
} from '../server/firebaseAdmin.js';
import { createHash } from 'node:crypto';

const CLOUD_WORKSPACE_SCHEMA_VERSION = 1;
const CLOUD_WORKSPACE_RESUME_LIMIT = 100;
const CLOUD_DRAFT_MAX_BYTES = 850_000;
const MAX_SYNC_OPERATIONS = 250;

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function getSerializedByteSize(value) {
  const serialized = JSON.stringify(value);
  return Buffer.byteLength(serialized, 'utf8');
}

function getTimestamp(value) {
  const timestamp = Date.parse(value || '');
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function readRequestBody(req) {
  if (req.body && typeof req.body === 'object') {
    return Promise.resolve(req.body);
  }

  if (typeof req.body === 'string') {
    try {
      return Promise.resolve(JSON.parse(req.body));
    } catch {
      return Promise.resolve(null);
    }
  }

  return new Promise((resolve, reject) => {
    let rawBody = '';

    req.on('data', (chunk) => {
      rawBody += chunk;

      if (rawBody.length > 4 * 1024 * 1024) {
        reject(new Error('Request body is too large.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(rawBody ? JSON.parse(rawBody) : {});
      } catch {
        resolve(null);
      }
    });
    req.on('error', reject);
  });
}

function normalizeOperationList(body) {
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
  return operation?.type === 'workspace' ? 'workspace' : `resume:${operation?.resumeId || 'unknown'}`;
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

function createOperationAck(operation) {
  return {
    id: operation.id,
    operationVersion: Number(operation.operationVersion || 0) || 0,
    localRevision: typeof operation.localRevision === 'string' ? operation.localRevision : '',
  };
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

function createWorkspaceDoc(workspace, { deviceId = 'browser', sessionId = 'background-sync', updatedAt = new Date().toISOString(), version = Date.now() } = {}) {
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
  };
}

function cloudWorkspaceFromDoc(data) {
  return normalizeWorkspaceIndex({
    activeResumeId: data?.activeResumeId,
    resumeIds: data?.resumeIds,
    meta: data?.meta,
  });
}

function sortResumeDocsByUpdatedAt(docs) {
  return [...docs].sort((a, b) => (
    getTimestamp(b.data.updatedAt || b.data.savedAt) - getTimestamp(a.data.updatedAt || a.data.savedAt)
  ));
}

async function readCloudSnapshot(uid) {
  const db = getAdminDb();
  const workspaceRef = db.doc(`users/${uid}/workspace/main`);
  const [resumesSnapshot, tombstonesSnapshot] = await Promise.all([
    db.collection(`users/${uid}/resumes`).get(),
    db.collection(`users/${uid}/resumeTombstones`).get(),
  ]);
  const tombstonedResumeIds = new Set(tombstonesSnapshot.docs.map((doc) => doc.id));
  const resumeDocs = sortResumeDocsByUpdatedAt(
    resumesSnapshot.docs
      .map((doc) => ({ id: doc.id, data: doc.data() }))
      .filter((record) => !record.data?.deletedAt && !tombstonedResumeIds.has(record.id)),
  ).slice(0, CLOUD_WORKSPACE_RESUME_LIMIT);
  const draftsByResumeId = new Map(
    resumeDocs.map((record) => [record.id, cloudDocToDraft(record.data)]),
  );
  const workspaceSnapshot = await workspaceRef.get();
  const storedWorkspace = workspaceSnapshot.exists ? cloudWorkspaceFromDoc(workspaceSnapshot.data()) : null;
  const orderedResumeIds = storedWorkspace
    ? [
        ...storedWorkspace.resumeIds.filter((resumeId) => draftsByResumeId.has(resumeId)),
        ...resumeDocs.map((record) => record.id).filter((resumeId) => !storedWorkspace.resumeIds.includes(resumeId)),
      ]
    : resumeDocs.map((record) => record.id);

  if (orderedResumeIds.length === 0) {
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
  });

  await workspaceRef.set(createWorkspaceDoc(workspace), { merge: false });

  return {
    workspace,
    drafts: Object.fromEntries(
      workspace.resumeIds.map((resumeId) => [resumeId, draftsByResumeId.get(resumeId)]).filter(([, draft]) => draft),
    ),
  };
}

function coalesceOperations(operations) {
  const latestWorkspaceOperation = [...operations].reverse().find((operation) => (
    operation.type === 'workspace' && operation.workspace
  ));
  const draftOperations = new Map();
  const deleteOperations = new Map();

  operations.forEach((operation) => {
    if (operation.type === 'deleteDraft' && operation.resumeId) {
      draftOperations.delete(operation.resumeId);
      deleteOperations.set(operation.resumeId, operation);
      return;
    }

    if (operation.type === 'upsertDraft' && operation.resumeId && operation.draft) {
      deleteOperations.delete(operation.resumeId);
      draftOperations.set(operation.resumeId, operation);
    }
  });

  return {
    workspaceOperation: latestWorkspaceOperation || null,
    draftOperations: Array.from(draftOperations.values()),
    deleteOperations: Array.from(deleteOperations.values()),
  };
}

async function applySyncOperations(uid, operations) {
  const db = getAdminDb();
  const workspaceRef = db.doc(`users/${uid}/workspace/main`);
  const { workspaceOperation, draftOperations, deleteOperations } = coalesceOperations(operations);
  const syncedOperations = [];
  const staleOperations = [];

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
    const [
      workspaceSnapshot,
      workspaceCursorSnapshot,
      draftSnapshots,
      draftCursorSnapshots,
      draftTombstoneSnapshots,
      deleteCursorSnapshots,
    ] = await Promise.all([
      workspaceWrite ? transaction.get(workspaceWrite.ref) : Promise.resolve(null),
      workspaceWrite ? transaction.get(workspaceWrite.cursorRef) : Promise.resolve(null),
      Promise.all(draftWrites.map((write) => transaction.get(write.ref))),
      Promise.all(draftWrites.map((write) => transaction.get(write.cursorRef))),
      Promise.all(draftWrites.map((write) => transaction.get(write.tombstoneRef))),
      Promise.all(deleteWrites.map((write) => transaction.get(write.cursorRef))),
    ]);

    function writeCursor(write) {
      transaction.set(write.cursorRef, {
        clientId: getOperationClientId(write.operation),
        scope: getOperationScope(write.operation),
        lastSequence: getOperationVersion(write.operation),
        updatedAt: new Date().toISOString(),
      }, { merge: false });
    }

    if (workspaceWrite) {
      const currentVersion = Number(workspaceSnapshot?.exists ? workspaceSnapshot.data()?.version || 0 : 0);

      if (shouldAcceptSyncOperation(workspaceWrite.operation, workspaceCursorSnapshot?.data?.())) {
        transaction.set(workspaceWrite.ref, createWorkspaceDoc(workspace, {
          updatedAt: new Date().toISOString(),
          version: currentVersion + 1,
        }), { merge: false });
        writeCursor(workspaceWrite);
        syncedOperations.push(createOperationAck(workspaceWrite.operation));
      } else {
        staleOperations.push(createOperationAck(workspaceWrite.operation));
      }
    }

    draftWrites.forEach((write, index) => {
      const currentSnapshot = draftSnapshots[index];
      const currentVersion = Number(currentSnapshot.exists ? currentSnapshot.data()?.version || 0 : 0);

      if (
        shouldAcceptDraftSyncOperation(
          write.operation,
          draftCursorSnapshots[index]?.data?.(),
          draftTombstoneSnapshots[index].exists,
        )
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
        syncedOperations.push(createOperationAck(write.operation));
      } else {
        staleOperations.push(createOperationAck(write.operation));
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
        syncedOperations.push(createOperationAck(write.operation));
      } else {
        staleOperations.push(createOperationAck(write.operation));
      }
    });
  });

  return { syncedOperations, staleOperations };
}

export default async function handler(req, res) {
  try {
    const decodedUser = await verifyRequestUser(req);

    if (req.method === 'GET') {
      const snapshot = await readCloudSnapshot(decodedUser.uid);

      if (!snapshot) {
        sendJson(res, 404, {
          error: {
            code: 'sync/not-found',
            message: 'No cloud resumes found.',
          },
        });
        return;
      }

      sendJson(res, 200, snapshot);
      return;
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'GET, POST');
      sendJson(res, 405, {
        error: {
          code: 'sync/method-not-allowed',
          message: 'Use POST to sync resumes.',
        },
      });
      return;
    }

    const body = await readRequestBody(req);
    const operations = normalizeOperationList(body);
    const requestAccountUid = typeof body?.accountUid === 'string' ? body.accountUid.trim() : '';

    if (operations.length === 0) {
      sendJson(res, 200, {
        ok: true,
        syncedOperations: [],
        staleOperations: [],
        rejectedOperations: [],
        syncedOperationIds: [],
        staleOperationIds: [],
        rejectedOperationIds: [],
      });
      return;
    }

    if (requestAccountUid && requestAccountUid !== decodedUser.uid) {
      sendJson(res, 409, {
        error: {
          code: 'sync/account-mismatch',
          message: 'This browser sync session belongs to a different account.',
        },
      });
      return;
    }

    const {
      scopedOperations,
      rejectedOperations,
    } = partitionSyncOperationsByAccount(operations, decodedUser.uid);
    const { syncedOperations, staleOperations } = scopedOperations.length > 0
      ? await applySyncOperations(decodedUser.uid, scopedOperations)
      : { syncedOperations: [], staleOperations: [] };

    sendJson(res, 200, {
      ok: true,
      syncedOperations,
      staleOperations,
      rejectedOperations,
      syncedOperationIds: syncedOperations.map((operation) => operation.id),
      staleOperationIds: staleOperations.map((operation) => operation.id),
      rejectedOperationIds: rejectedOperations.map((operation) => operation.id),
    });
  } catch (error) {
    const statusCode = error instanceof FirebaseAdminError ? error.statusCode : (error?.statusCode || 500);

    if (statusCode >= 500) {
      console.error(JSON.stringify({
        level: 'error',
        message: 'Workspace sync failed',
        code: error?.code,
        errorMessage: error?.message,
      }));
    }

    sendJson(res, statusCode, {
      error: {
        code: error?.code || 'sync/failed',
        message: error?.message || 'Could not sync resumes.',
      },
    });
  }
}
