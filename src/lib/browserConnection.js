import {
  CLOUD_DEVICE_ID_KEY,
  CLOUD_SESSION_ID_KEY,
  CLOUD_TRUSTED_DEVICE_KEY,
} from './firebaseWorkspace.js';
import {
  DRAFT_STORAGE_KEY,
  RESUME_STORAGE_KEY_PREFIX,
  WORKSPACE_INDEX_STORAGE_KEY,
} from './resume.js';
import {
  GUEST_WORKSPACE_CLOUD_MIRROR_BACKUP_KEY,
  GUEST_WORKSPACE_CLOUD_MIRROR_MANIFEST_KEY,
} from './localWorkspaceMirror.js';

export const CONNECTED_ACCOUNT_STORAGE_KEY = 'resumeloomr:connected-account:v1';
export const SIGNED_OUT_EDITING_PREFERENCE_KEY = 'resumeloomr:signed-out-editing-preference:v1';
const LEGACY_CLOUD_IMPORT_PREFIX = 'resumeloomr:firebase-imported:';
export const DEFAULT_SIGNED_OUT_EDITING_PREFERENCE = {
  allow: true,
  skipPrompt: false,
};

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

export function readSignedOutEditingPreference(storage) {
  const targetStorage = getStorage(storage);

  if (!targetStorage) {
    return DEFAULT_SIGNED_OUT_EDITING_PREFERENCE;
  }

  const preference = safeParse(targetStorage.getItem(SIGNED_OUT_EDITING_PREFERENCE_KEY));

  return {
    allow: typeof preference?.allow === 'boolean'
      ? preference.allow
      : DEFAULT_SIGNED_OUT_EDITING_PREFERENCE.allow,
    skipPrompt: typeof preference?.skipPrompt === 'boolean'
      ? preference.skipPrompt
      : DEFAULT_SIGNED_OUT_EDITING_PREFERENCE.skipPrompt,
  };
}

export function writeSignedOutEditingPreference(preference, storage) {
  const targetStorage = getStorage(storage);
  const nextPreference = {
    allow: typeof preference?.allow === 'boolean'
      ? preference.allow
      : DEFAULT_SIGNED_OUT_EDITING_PREFERENCE.allow,
    skipPrompt: typeof preference?.skipPrompt === 'boolean'
      ? preference.skipPrompt
      : DEFAULT_SIGNED_OUT_EDITING_PREFERENCE.skipPrompt,
  };

  if (targetStorage) {
    targetStorage.setItem(SIGNED_OUT_EDITING_PREFERENCE_KEY, JSON.stringify(nextPreference));
  }

  return nextPreference;
}

export function hasLocalResumeWorkspaceData(storage) {
  const targetStorage = getStorage(storage);

  if (!targetStorage) {
    return false;
  }

  for (let index = 0; index < targetStorage.length; index += 1) {
    const key = targetStorage.key(index);

    if (
      key === WORKSPACE_INDEX_STORAGE_KEY ||
      key === DRAFT_STORAGE_KEY ||
      key?.startsWith(RESUME_STORAGE_KEY_PREFIX)
    ) {
      return true;
    }
  }

  return false;
}

export function clearLocalResumeWorkspaceData(storage) {
  const targetStorage = getStorage(storage);

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
      key === GUEST_WORKSPACE_CLOUD_MIRROR_MANIFEST_KEY ||
      key?.startsWith(RESUME_STORAGE_KEY_PREFIX) ||
      key?.startsWith(LEGACY_CLOUD_IMPORT_PREFIX)
    ) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => targetStorage.removeItem(key));
}

export function clearBrowserResumeConnectionData({ storage, sessionStorage } = {}) {
  const targetStorage = getStorage(storage);
  const targetSessionStorage = getSessionStorage(sessionStorage);

  if (!targetStorage) {
    return;
  }

  clearLocalResumeWorkspaceData(targetStorage);
  targetStorage.removeItem(CONNECTED_ACCOUNT_STORAGE_KEY);
  targetStorage.removeItem(CLOUD_DEVICE_ID_KEY);
  targetStorage.removeItem(CLOUD_TRUSTED_DEVICE_KEY);
  targetStorage.removeItem(SIGNED_OUT_EDITING_PREFERENCE_KEY);
  targetSessionStorage?.removeItem(CLOUD_SESSION_ID_KEY);
}
