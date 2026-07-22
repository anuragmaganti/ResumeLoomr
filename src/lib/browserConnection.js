import {
  LEGACY_DRAFT_STORAGE_KEY,
  LOCAL_SYNC_CLIENT_ID_KEY,
  LOCAL_SYNC_SEQUENCE_KEY,
  LOCAL_WORKSPACE_PRESENT_KEY,
  RESUME_STORAGE_KEY_PREFIX,
  WORKSPACE_INDEX_STORAGE_KEY,
  WORKSPACE_OPEN_FOLDERS_STORAGE_KEY,
} from './localWorkspaceKeys.js';
import {
  deleteLocalWorkspaceDatabase,
} from './localWorkspaceDb.js';
import {
  getBrowserLocalStorage,
  getBrowserSessionStorage,
  listStorageKeys,
  readStorageItem,
  removeStorageItem,
  writeStorageItem,
} from './browserStorage.js';

const CONNECTED_ACCOUNT_STORAGE_KEY = 'resumeloomr:connected-account:v1';
const SIGNED_OUT_EDITING_PREFERENCE_KEY = 'resumeloomr:signed-out-editing-preference:v1';
const DEFAULT_SIGNED_OUT_EDITING_PREFERENCE = {
  allow: true,
  skipPrompt: false,
};

export function getSignOutStorageMode(preference) {
  if (!preference?.skipPrompt) {
    return 'ask';
  }

  return preference.allow ? 'keep' : 'clear';
}

export function createSignOutStoragePreference(mode, currentPreference = DEFAULT_SIGNED_OUT_EDITING_PREFERENCE) {
  if (mode === 'keep') {
    return { allow: true, skipPrompt: true };
  }

  if (mode === 'clear') {
    return { allow: false, skipPrompt: true };
  }

  return {
    allow: typeof currentPreference?.allow === 'boolean'
      ? currentPreference.allow
      : DEFAULT_SIGNED_OUT_EDITING_PREFERENCE.allow,
    skipPrompt: false,
  };
}
const WORKSPACE_LOCAL_STORAGE_KEYS = [
  WORKSPACE_INDEX_STORAGE_KEY,
  WORKSPACE_OPEN_FOLDERS_STORAGE_KEY,
  LOCAL_WORKSPACE_PRESENT_KEY,
  LOCAL_SYNC_CLIENT_ID_KEY,
  LOCAL_SYNC_SEQUENCE_KEY,
];
const OBSOLETE_LOCAL_STORAGE_KEYS = [
  LEGACY_DRAFT_STORAGE_KEY,
  'resumeloomr:guest-backup-before-cloud-mirror:v1',
  'resumeloomr:cloud-mirror-manifest:v1',
  'resumeloomr:firebase-device-id',
  'resumeloomr:firebase-trusted-device',
];
const OBSOLETE_SESSION_STORAGE_KEYS = [
  'resumeloomr:firebase-session-id',
];
const OBSOLETE_LOCAL_STORAGE_PREFIXES = [
  'resumeloomr:firebase-imported:',
];

function getStorage(storage) {
  return getBrowserLocalStorage(storage);
}

function getSessionStorage(storage) {
  return getBrowserSessionStorage(storage);
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

  const account = safeParse(readStorageItem(targetStorage, CONNECTED_ACCOUNT_STORAGE_KEY));

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

export function writeConnectedAccount(user, storage) {
  const targetStorage = getStorage(storage);

  if (!targetStorage || !user?.uid) {
    return null;
  }

  const account = {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || '',
    lastConnectedAt: new Date().toISOString(),
  };

  return writeStorageItem(targetStorage, CONNECTED_ACCOUNT_STORAGE_KEY, JSON.stringify(account))
    ? account
    : null;
}

export function clearConnectedAccount(storage) {
  const targetStorage = getStorage(storage);

  if (!targetStorage) {
    return;
  }

  removeStorageItem(targetStorage, CONNECTED_ACCOUNT_STORAGE_KEY);
}

export function readSignedOutEditingPreference(storage) {
  const targetStorage = getStorage(storage);

  if (!targetStorage) {
    return DEFAULT_SIGNED_OUT_EDITING_PREFERENCE;
  }

  const preference = safeParse(readStorageItem(targetStorage, SIGNED_OUT_EDITING_PREFERENCE_KEY));

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
    writeStorageItem(targetStorage, SIGNED_OUT_EDITING_PREFERENCE_KEY, JSON.stringify(nextPreference));
  }

  return nextPreference;
}

export async function clearLocalResumeWorkspaceData(storage) {
  const targetStorage = getStorage(storage);

  const storageKeyResult = listStorageKeys(targetStorage);
  const keysToRemove = storageKeyResult.keys.filter((key) => (
    WORKSPACE_LOCAL_STORAGE_KEYS.includes(key) ||
    OBSOLETE_LOCAL_STORAGE_KEYS.includes(key) ||
    key?.startsWith(RESUME_STORAGE_KEY_PREFIX) ||
    OBSOLETE_LOCAL_STORAGE_PREFIXES.some((prefix) => key?.startsWith(prefix))
  ));
  const mirrorCleanupResults = keysToRemove.map((key) => removeStorageItem(targetStorage, key));
  const mirrorCleanupSucceeded = storageKeyResult.succeeded && mirrorCleanupResults.every(Boolean);

  if (typeof indexedDB !== 'undefined') {
    await deleteLocalWorkspaceDatabase();
  }

  if (!mirrorCleanupSucceeded) {
    throw new Error('Browser resume storage could not be cleared completely.');
  }
}

export async function clearBrowserResumeConnectionData({ storage, sessionStorage } = {}) {
  const targetStorage = getStorage(storage);
  const targetSessionStorage = getSessionStorage(sessionStorage);

  // Keep the account marker until every earlier cleanup step succeeds. If
  // storage is partially unavailable, that marker keeps the removal action
  // visible so the user can retry after signing out.
  await clearLocalResumeWorkspaceData(targetStorage);

  const sessionMetadataResults = !targetSessionStorage ? [] : OBSOLETE_SESSION_STORAGE_KEYS.map((key) => (
    removeStorageItem(targetSessionStorage, key)
  ));

  if (!sessionMetadataResults.every(Boolean)) {
    throw new Error('Browser connection data could not be cleared completely.');
  }

  if (targetStorage && !removeStorageItem(targetStorage, SIGNED_OUT_EDITING_PREFERENCE_KEY)) {
    throw new Error('Browser connection data could not be cleared completely.');
  }

  if (targetStorage && !removeStorageItem(targetStorage, CONNECTED_ACCOUNT_STORAGE_KEY)) {
    throw new Error('Browser connection data could not be cleared completely.');
  }
}
