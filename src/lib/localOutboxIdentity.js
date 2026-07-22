import { trimText } from './text.js';
import { getLocalWorkspaceStorage } from './localWorkspaceMirror.js';
import {
  LOCAL_SYNC_CLIENT_ID_KEY,
  LOCAL_SYNC_SEQUENCE_KEY,
} from './localWorkspaceKeys.js';

let fallbackSyncSequence = 0;
let fallbackSyncClientId = '';

function createSyncClientId() {
  return globalThis.crypto?.randomUUID?.() ?? `client-${Math.random().toString(36).slice(2, 12)}`;
}

export function getSyncOperationIdentity() {
  const storage = getLocalWorkspaceStorage();

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
