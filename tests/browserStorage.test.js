import assert from 'node:assert/strict';
import test from 'node:test';

import {
  listStorageKeys,
  readStorageItem,
  removeStorageItem,
  writeStorageItem,
} from '../src/lib/browserStorage.js';
import {
  clearBrowserResumeConnectionData,
  clearConnectedAccount,
  readConnectedAccount,
  readSignedOutEditingPreference,
  writeConnectedAccount,
  writeSignedOutEditingPreference,
} from '../src/lib/browserConnection.js';

function createUnavailableStorage() {
  return {
    get length() {
      throw new Error('Storage access is blocked.');
    },
    getItem() {
      throw new Error('Storage access is blocked.');
    },
    key() {
      throw new Error('Storage access is blocked.');
    },
    removeItem() {
      throw new Error('Storage access is blocked.');
    },
    setItem() {
      throw new Error('Storage access is blocked.');
    },
  };
}

test('best-effort browser storage operations never throw', () => {
  const storage = createUnavailableStorage();

  assert.equal(readStorageItem(storage, 'key'), null);
  assert.equal(writeStorageItem(storage, 'key', 'value'), false);
  assert.equal(removeStorageItem(storage, 'key'), false);
  assert.deepEqual(listStorageKeys(storage), { keys: [], succeeded: false });
});

test('browser account hints and preferences tolerate unavailable localStorage', () => {
  const storage = createUnavailableStorage();

  assert.equal(readConnectedAccount(storage), null);
  assert.equal(writeConnectedAccount({ uid: 'account-a', email: 'a@example.com' }, storage), null);
  assert.doesNotThrow(() => clearConnectedAccount(storage));
  assert.deepEqual(readSignedOutEditingPreference(storage), {
    allow: true,
    skipPrompt: false,
  });
  assert.deepEqual(writeSignedOutEditingPreference({
    allow: false,
    skipPrompt: true,
  }, storage), {
    allow: false,
    skipPrompt: true,
  });
});

test('storage key enumeration returns a stable snapshot', () => {
  const values = new Map([
    ['one', '1'],
    ['two', '2'],
  ]);
  const storage = {
    get length() {
      return values.size;
    },
    key(index) {
      return [...values.keys()][index] || null;
    },
  };

  assert.deepEqual(listStorageKeys(storage), {
    keys: ['one', 'two'],
    succeeded: true,
  });
});

test('browser cleanup preserves the account marker when workspace cleanup fails', async () => {
  const accountKey = 'resumeloomr:connected-account:v1';
  const preferenceKey = 'resumeloomr:signed-out-editing-preference:v1';
  const workspaceKey = 'resumeloomr:index:v1';
  const values = new Map([
    [accountKey, JSON.stringify({ uid: 'account-a' })],
    [preferenceKey, JSON.stringify({ allow: true, skipPrompt: false })],
    [workspaceKey, '{}'],
  ]);
  const storage = {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] || null; },
    getItem(key) { return values.get(key) ?? null; },
    removeItem(key) {
      if (key === workspaceKey) {
        throw new Error('Workspace storage is blocked.');
      }

      values.delete(key);
    },
  };

  await assert.rejects(
    clearBrowserResumeConnectionData({ storage }),
    /Browser resume storage could not be cleared completely/,
  );
  assert.notEqual(storage.getItem(accountKey), null);
  assert.notEqual(storage.getItem(preferenceKey), null);
});
