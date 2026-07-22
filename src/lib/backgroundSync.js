import {
  markOutboxFailed,
  markOutboxStale,
  markOutboxSynced,
  readLocalAccountBinding,
  readPendingOutbox,
  setSyncSessionCleanupRequested,
} from './localWorkspaceDb.js';
import { createOutboxAckDescriptor } from './outboxProtocol.js';

const RESUME_SYNC_TAG = 'resumeloomr-sync-outbox';
const MAX_SYNC_REQUEST_BYTES = 3_000_000;
const MAX_SYNC_OPERATION_BYTES = 1_000_000;

function getSerializedByteSize(value) {
  const serialized = JSON.stringify(value);

  return new TextEncoder().encode(serialized).byteLength;
}

export function partitionClientSyncOperations(operations) {
  const oversizedOperations = [];
  const eligibleOperations = [];

  (Array.isArray(operations) ? operations : []).forEach((operation) => {
    if (getSerializedByteSize(operation) > MAX_SYNC_OPERATION_BYTES) {
      oversizedOperations.push(createOutboxAckDescriptor({
        ...operation,
        reason: 'payload-too-large',
      }));
    } else {
      eligibleOperations.push(operation);
    }
  });

  const selectedOperations = [];
  let selectedBytes = 256;

  for (const operation of eligibleOperations) {
    const operationBytes = getSerializedByteSize(operation) + 1;

    if (selectedOperations.length > 0 && selectedBytes + operationBytes > MAX_SYNC_REQUEST_BYTES) {
      break;
    }

    selectedOperations.push(operation);
    selectedBytes += operationBytes;
  }

  return {
    operations: selectedOperations,
    oversizedOperations: oversizedOperations.filter(Boolean),
  };
}

function isServiceWorkerSupported() {
  return typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
}

function isBackgroundSyncSupported(registration) {
  return Boolean(registration && 'sync' in registration);
}

export async function registerResumeSyncWorker() {
  if (!isServiceWorkerSupported()) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sync-worker.js');

    registration.active?.postMessage({ type: 'SYNC_RESUME_OUTBOX' });
    return registration;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('Resume sync worker registration failed', error);
    }
    return null;
  }
}

export async function requestResumeBackgroundSync() {
  if (!isServiceWorkerSupported()) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    if (isBackgroundSyncSupported(registration)) {
      await registration.sync.register(RESUME_SYNC_TAG);
      return true;
    }

    registration.active?.postMessage({ type: 'SYNC_RESUME_OUTBOX' });
    return true;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn('Resume background sync request failed', error);
    }
    return false;
  }
}

export async function createResumeSyncSession(idToken) {
  if (!idToken) {
    return false;
  }

  const response = await fetch('/api/sync-session', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Could not start browser sync session.');
  }

  return true;
}

export async function clearResumeSyncSession() {
  try {
    const response = await fetch('/api/sync-session', {
      method: 'DELETE',
      credentials: 'include',
    });

    return response.ok;
  } catch {
    return false;
  }
}

async function clearCompletedBackgroundSession(accountUid, pendingCount) {
  if (pendingCount !== 0) {
    return;
  }

  const binding = await readLocalAccountBinding();

  if (binding?.uid !== accountUid || binding?.clearSessionWhenSynced !== true) {
    return;
  }

  const cleared = await clearResumeSyncSession();

  if (cleared) {
    await setSyncSessionCleanupRequested(accountUid, false);
  }
}

export async function pullCloudWorkspaceSnapshot(idToken) {
  if (!idToken) {
    return null;
  }

  const response = await fetch('/api/sync-workspace', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
    credentials: 'include',
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error('Could not load cloud resumes.');
  }

  return response.json();
}

export function getOperationAcksFromResponse(payload, operations, descriptorKey, legacyIdKey) {
  if (Array.isArray(payload?.[descriptorKey])) {
    return payload[descriptorKey].map(createOutboxAckDescriptor).filter(Boolean);
  }

  if (!Array.isArray(payload?.[legacyIdKey])) {
    return [];
  }

  const operationById = new Map(operations.map((operation) => [operation.id, operation]));

  return payload[legacyIdKey]
    .map((operationId) => createOutboxAckDescriptor(operationById.get(operationId)))
    .filter(Boolean);
}

export async function syncLocalOutbox({ idToken = '', useCookie = false, accountUid = '' } = {}) {
  const normalizedAccountUid = String(accountUid || '').trim();
  const canAttemptCloudSync = Boolean(idToken || useCookie);
  const pendingOperations = normalizedAccountUid
    ? await readPendingOutbox({ accountUid: normalizedAccountUid })
    : await readPendingOutbox();

  if (pendingOperations.length === 0) {
    if (normalizedAccountUid) {
      await clearCompletedBackgroundSession(normalizedAccountUid, 0);
    }
    return {
      status: 'idle',
      syncedCount: 0,
      pendingCount: 0,
    };
  }

  if (!canAttemptCloudSync || !normalizedAccountUid) {
    await requestResumeBackgroundSync();
    return {
      status: 'queued',
      syncedCount: 0,
      pendingCount: pendingOperations.length,
    };
  }

  const clientPartition = partitionClientSyncOperations(pendingOperations);
  const operations = clientPartition.operations;

  await markOutboxStale(
    clientPartition.oversizedOperations,
    'This resume is too large to sync, but it remains saved in this browser.',
  );

  if (operations.length === 0) {
    const remainingOperations = await readPendingOutbox({ accountUid: normalizedAccountUid });

    await clearCompletedBackgroundSession(normalizedAccountUid, remainingOperations.length);
    return {
      status: 'stale',
      syncedCount: 0,
      staleCount: 0,
      rejectedCount: clientPartition.oversizedOperations.length,
      oversizedCount: clientPartition.oversizedOperations.length,
      requiresReconcile: false,
      pendingCount: remainingOperations.length,
    };
  }

  const headers = {
    'Content-Type': 'application/json',
  };

  if (idToken) {
    headers.Authorization = `Bearer ${idToken}`;
  }

  try {
    const response = await fetch('/api/sync-workspace', {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        accountUid: normalizedAccountUid,
        operations,
      }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error?.message || 'Cloud sync failed.');
    }

    const payload = await response.json();
    const syncedOperations = getOperationAcksFromResponse(payload, operations, 'syncedOperations', 'syncedOperationIds');
    const staleOperations = getOperationAcksFromResponse(payload, operations, 'staleOperations', 'staleOperationIds');
    const rejectedOperations = getOperationAcksFromResponse(payload, operations, 'rejectedOperations', 'rejectedOperationIds');
    const serverOversizedOperations = rejectedOperations.filter((operation) => operation.reason === 'payload-too-large');
    const accountRejectedOperations = rejectedOperations.filter((operation) => operation.reason !== 'payload-too-large');

    await markOutboxSynced(syncedOperations);
    await markOutboxStale(staleOperations);
    await markOutboxStale(serverOversizedOperations, 'This resume is too large to sync, but it remains saved in this browser.');
    await markOutboxStale(accountRejectedOperations, 'Skipped cloud sync because these changes belong to another account.');

    const oversizedCount = clientPartition.oversizedOperations.length + serverOversizedOperations.length;
    const skippedCount = staleOperations.length + rejectedOperations.length + clientPartition.oversizedOperations.length;
    const remainingOperations = await readPendingOutbox({ accountUid: normalizedAccountUid });
    await clearCompletedBackgroundSession(normalizedAccountUid, remainingOperations.length);

    return {
      status: skippedCount > 0 ? 'stale' : 'synced',
      syncedCount: syncedOperations.length,
      staleCount: staleOperations.length,
      rejectedCount: rejectedOperations.length + clientPartition.oversizedOperations.length,
      oversizedCount,
      requiresReconcile: staleOperations.some((operation) => (
        operation.reason === 'version-conflict' || operation.reason === 'deleted-remotely'
      )),
      pendingCount: remainingOperations.length,
    };
  } catch (error) {
    await markOutboxFailed(operations.map(createOutboxAckDescriptor).filter(Boolean), error?.message || 'Cloud sync failed.');
    await requestResumeBackgroundSync();
    throw error;
  }
}
