import { setSyncSessionCleanupRequested } from './localWorkspaceDb.js';
import { fetchWithTimeout } from './httpClient.js';

const SYNC_SESSION_REFRESH_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000;

function createEmptySessionState() {
  return {
    accountUid: '',
    attempt: null,
    refreshedAt: 0,
  };
}

let syncSessionState = createEmptySessionState();

async function createResumeSyncSession(idToken, { signal } = {}) {
  const response = await fetchWithTimeout('/api/sync-session', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
    credentials: 'include',
    signal,
  });

  if (!response.ok) {
    throw new Error('Could not start browser sync session.');
  }
}

export function resetResumeSyncSessionState() {
  syncSessionState.attempt?.controller.abort();
  syncSessionState = createEmptySessionState();
}

export function ensureResumeSyncSession({ idToken, accountUid }) {
  const normalizedAccountUid = String(accountUid || '').trim();

  if (!idToken || !normalizedAccountUid) {
    return Promise.resolve(false);
  }

  const sessionIsFresh = syncSessionState.accountUid === normalizedAccountUid
    && Date.now() - syncSessionState.refreshedAt < SYNC_SESSION_REFRESH_INTERVAL_MS;

  if (sessionIsFresh) {
    return Promise.resolve(true);
  }

  if (syncSessionState.accountUid === normalizedAccountUid && syncSessionState.attempt) {
    return syncSessionState.attempt.promise;
  }

  if (syncSessionState.accountUid && syncSessionState.accountUid !== normalizedAccountUid) {
    resetResumeSyncSessionState();
  }

  const attempt = {
    controller: new AbortController(),
    promise: null,
  };

  attempt.promise = (async () => {
    try {
      await setSyncSessionCleanupRequested(normalizedAccountUid, false);
      await createResumeSyncSession(idToken, { signal: attempt.controller.signal });

      if (syncSessionState.attempt !== attempt) {
        return false;
      }

      syncSessionState = {
        accountUid: normalizedAccountUid,
        attempt: null,
        refreshedAt: Date.now(),
      };
      return true;
    } catch (error) {
      if (syncSessionState.attempt === attempt) {
        syncSessionState = createEmptySessionState();
      }
      throw error;
    }
  })();

  syncSessionState = {
    accountUid: normalizedAccountUid,
    attempt,
    refreshedAt: 0,
  };

  return attempt.promise;
}

export async function clearResumeSyncSession() {
  resetResumeSyncSessionState();

  try {
    const response = await fetchWithTimeout('/api/sync-session', {
      method: 'DELETE',
      credentials: 'include',
    });

    return response.ok;
  } catch {
    return false;
  }
}
