import {
  CLOUD_DEVICE_ID_KEY,
  CLOUD_IMPORT_PREFIX,
  CLOUD_SESSION_ID_KEY,
  CLOUD_TRUSTED_DEVICE_KEY,
} from './firebaseWorkspace.js';
import {
  DRAFT_STORAGE_KEY,
  RESUME_STORAGE_KEY_PREFIX,
  WORKSPACE_INDEX_STORAGE_KEY,
} from './resume.js';
import { GUEST_WORKSPACE_CLOUD_MIRROR_BACKUP_KEY } from './localWorkspaceMirror.js';

export const CONNECTED_ACCOUNT_STORAGE_KEY = 'resumeloomr:connected-account:v1';

function getStorage(storage) {
  if (storage) {
    return storage;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
}

function getSessionStorage(storage) {
  if (storage) {
    return storage;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  return window.sessionStorage;
}

function safeParse(rawValue) {
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
}

export function readConnectedAccount(storage) {
  const targetStorage = getStorage(storage);

  if (!targetStorage) {
    return null;
  }

  const account = safeParse(targetStorage.getItem(CONNECTED_ACCOUNT_STORAGE_KEY));

  if (!account?.uid) {
    return null;
  }

  return {
    uid: account.uid,
    email: typeof account.email === 'string' ? account.email : '',
    displayName: typeof account.displayName === 'string' ? account.displayName : '',
    lastConnectedAt: typeof account.lastConnectedAt === 'string' ? account.lastConnectedAt : '',
    trustedDevice: Boolean(account.trustedDevice),
    cacheMode: typeof account.cacheMode === 'string' ? account.cacheMode : '',
  };
}

export function writeConnectedAccount(user, { trustedDevice = false, cacheMode = '' } = {}, storage) {
  const targetStorage = getStorage(storage);

  if (!targetStorage || !user?.uid) {
    return null;
  }

  const account = {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || '',
    lastConnectedAt: new Date().toISOString(),
    trustedDevice: Boolean(trustedDevice),
    cacheMode: cacheMode || '',
  };

  targetStorage.setItem(CONNECTED_ACCOUNT_STORAGE_KEY, JSON.stringify(account));
  return account;
}

export function clearConnectedAccount(storage) {
  const targetStorage = getStorage(storage);

  if (!targetStorage) {
    return;
  }

  targetStorage.removeItem(CONNECTED_ACCOUNT_STORAGE_KEY);
}

export function clearBrowserResumeConnectionData({ storage, sessionStorage } = {}) {
  const targetStorage = getStorage(storage);
  const targetSessionStorage = getSessionStorage(sessionStorage);

  if (!targetStorage) {
    return;
  }

  const keysToRemove = [];

  for (let index = 0; index < targetStorage.length; index += 1) {
    const key = targetStorage.key(index);

    if (
      key === WORKSPACE_INDEX_STORAGE_KEY ||
      key === DRAFT_STORAGE_KEY ||
      key === GUEST_WORKSPACE_CLOUD_MIRROR_BACKUP_KEY ||
      key === CONNECTED_ACCOUNT_STORAGE_KEY ||
      key === CLOUD_DEVICE_ID_KEY ||
      key === CLOUD_TRUSTED_DEVICE_KEY ||
      key?.startsWith(RESUME_STORAGE_KEY_PREFIX) ||
      key?.startsWith(CLOUD_IMPORT_PREFIX)
    ) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => targetStorage.removeItem(key));
  targetSessionStorage?.removeItem(CLOUD_SESSION_ID_KEY);
}
