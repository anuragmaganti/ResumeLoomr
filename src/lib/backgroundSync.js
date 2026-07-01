import {
  createOutboxAckDescriptor,
  markOutboxFailed,
  markOutboxStale,
  markOutboxSynced,
  readPendingOutbox,
} from './localWorkspaceDb.js';

const RESUME_SYNC_TAG = 'resumeloomr-sync-outbox';

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
    return await navigator.serviceWorker.register('/sync-worker.js');
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
  await fetch('/api/sync-session', {
    method: 'DELETE',
    credentials: 'include',
  }).catch(() => null);
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
  const operations = normalizedAccountUid
    ? await readPendingOutbox({ accountUid: normalizedAccountUid })
    : await readPendingOutbox();

  if (operations.length === 0) {
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
      pendingCount: operations.length,
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

    await markOutboxSynced(syncedOperations);
    await markOutboxStale(staleOperations);
    await markOutboxStale(rejectedOperations, 'Skipped cloud sync because these changes belong to another account.');

    const skippedCount = staleOperations.length + rejectedOperations.length;

    return {
      status: skippedCount > 0 ? 'stale' : 'synced',
      syncedCount: syncedOperations.length,
      staleCount: staleOperations.length,
      rejectedCount: rejectedOperations.length,
      pendingCount: Math.max(0, operations.length - syncedOperations.length - skippedCount),
    };
  } catch (error) {
    await markOutboxFailed(operations.map(createOutboxAckDescriptor).filter(Boolean), error?.message || 'Cloud sync failed.');
    await requestResumeBackgroundSync();
    throw error;
  }
}
