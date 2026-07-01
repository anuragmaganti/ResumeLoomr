import {
  DRAFT_STORAGE_KEY,
  RESUME_STORAGE_KEY_PREFIX,
  WORKSPACE_INDEX_STORAGE_KEY,
} from './resume.js';
import {
  LOCAL_WORKSPACE_DB_NAME,
  LOCAL_WORKSPACE_PRESENT_KEY,
} from './localWorkspaceDb.js';

export const CONNECTED_ACCOUNT_STORAGE_KEY = 'resumeloomr:connected-account:v1';
export const SIGNED_OUT_EDITING_PREFERENCE_KEY = 'resumeloomr:signed-out-editing-preference:v1';
export const DEFAULT_SIGNED_OUT_EDITING_PREFERENCE = {
  allow: true,
  skipPrompt: false,
};
const STALE_LOCAL_STORAGE_KEYS = [
  'resumeloomr:guest-backup-before-cloud-mirror:v1',
  'resumeloomr:cloud-mirror-manifest:v1',
  'resumeloomr:firebase-device-id',
  'resumeloomr:firebase-trusted-device',
];
const STALE_SESSION_STORAGE_KEYS = [
  'resumeloomr:firebase-session-id',
];
const STALE_LOCAL_STORAGE_PREFIXES = [
  'resumeloomr:firebase-imported:',
];

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

function isStorageLike(value) {
  return Boolean(
    value &&
      typeof value.getItem === 'function' &&
      typeof value.setItem === 'function' &&
      typeof value.removeItem === 'function',
  );
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
  };
}

export function writeConnectedAccount(user, optionsOrStorage, storage) {
  const targetStorage = getStorage(storage || (isStorageLike(optionsOrStorage) ? optionsOrStorage : null));

  if (!targetStorage || !user?.uid) {
    return null;
  }

  const account = {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || '',
    lastConnectedAt: new Date().toISOString(),
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
      key === LOCAL_WORKSPACE_PRESENT_KEY ||
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
      key === LOCAL_WORKSPACE_PRESENT_KEY ||
      STALE_LOCAL_STORAGE_KEYS.includes(key) ||
      key?.startsWith(RESUME_STORAGE_KEY_PREFIX) ||
      STALE_LOCAL_STORAGE_PREFIXES.some((prefix) => key?.startsWith(prefix))
    ) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => targetStorage.removeItem(key));

  if (typeof indexedDB !== 'undefined') {
    indexedDB.deleteDatabase(LOCAL_WORKSPACE_DB_NAME);
  }
}

export function clearBrowserResumeConnectionData({ storage, sessionStorage } = {}) {
  const targetStorage = getStorage(storage);
  const targetSessionStorage = getSessionStorage(sessionStorage);

  if (!targetStorage) {
    return;
  }

  clearLocalResumeWorkspaceData(targetStorage);
  targetStorage.removeItem(CONNECTED_ACCOUNT_STORAGE_KEY);
  targetStorage.removeItem(SIGNED_OUT_EDITING_PREFERENCE_KEY);
  STALE_LOCAL_STORAGE_KEYS.forEach((key) => targetStorage.removeItem(key));
  STALE_SESSION_STORAGE_KEYS.forEach((key) => targetSessionStorage?.removeItem(key));
}
