import {
  FirebaseAdminError,
  verifyFirebaseIdTokenHeader,
  verifyRequestUser,
} from '../server/firebaseAdmin.js';
import {
  applySyncOperations,
  normalizeOperationList,
  partitionOversizedSyncOperations,
  partitionSyncOperationsByAccount,
  readCloudSnapshot,
} from '../server/syncWorkspace.js';

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
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

export default async function handler(req, res) {
  try {
    const decodedUser = req.method === 'GET'
      ? await verifyFirebaseIdTokenHeader(req.headers.authorization)
      : await verifyRequestUser(req);

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

    const accountPartition = partitionSyncOperationsByAccount(operations, decodedUser.uid);
    const sizePartition = partitionOversizedSyncOperations(accountPartition.scopedOperations);
    const rejectedOperations = [
      ...accountPartition.rejectedOperations,
      ...sizePartition.rejectedOperations,
    ];
    const { syncedOperations, staleOperations } = sizePartition.acceptedOperations.length > 0
      ? await applySyncOperations(decodedUser.uid, sizePartition.acceptedOperations)
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
