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
import {
  readJsonRequestBody,
  sendPrivateError,
  sendPrivateJson,
} from '../server/httpProtocol.js';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    sendPrivateJson(res, 405, {
      error: {
        code: 'sync/method-not-allowed',
        message: 'Use GET or POST to sync resumes.',
      },
    });
    return;
  }

  try {
    const decodedUser = req.method === 'GET'
      ? await verifyFirebaseIdTokenHeader(req.headers.authorization)
      : await verifyRequestUser(req);

    if (req.method === 'GET') {
      const snapshot = await readCloudSnapshot(decodedUser.uid);

      if (!snapshot) {
        sendPrivateJson(res, 404, {
          error: {
            code: 'sync/not-found',
            message: 'No cloud resumes found.',
          },
        });
        return;
      }

      sendPrivateJson(res, 200, snapshot);
      return;
    }

    const body = await readJsonRequestBody(req);

    if (body === null || typeof body !== 'object' || Array.isArray(body)) {
      sendPrivateJson(res, 400, {
        error: {
          code: 'sync/invalid-json',
          message: 'The sync request could not be read.',
        },
      });
      return;
    }

    const operations = normalizeOperationList(body);
    const requestAccountUid = typeof body?.accountUid === 'string' ? body.accountUid.trim() : '';

    if (operations.length === 0) {
      sendPrivateJson(res, 200, {
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
      sendPrivateJson(res, 409, {
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

    sendPrivateJson(res, 200, {
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

    sendPrivateError(res, statusCode, error, {
      code: 'sync/failed',
      message: 'Could not sync resumes.',
    });
  }
}
