import test from 'node:test';
import assert from 'node:assert/strict';

import { getSaveStatusPresentation } from '../src/lib/saveStatus.js';
import {
  clearLocalResumeWorkspaceData,
  createSignOutStoragePreference,
  getSignOutStorageMode,
  hasLocalResumeWorkspaceData,
} from '../src/lib/browserConnection.js';

test('save status presentation prioritizes local writes before cloud state', () => {
  assert.deepEqual(
    getSaveStatusPresentation({ saveState: 'saving', syncState: 'saved', cloudMode: true }),
    { id: 'saving-local', label: 'Saving locally' },
  );
  assert.deepEqual(
    getSaveStatusPresentation({ saveState: 'error', syncState: 'syncing', cloudMode: true }),
    { id: 'local-error', label: 'Local save unavailable' },
  );
});

test('save status presentation distinguishes local and cloud completion states', () => {
  assert.deepEqual(
    getSaveStatusPresentation({ saveState: 'saved', syncState: 'idle', cloudMode: false }),
    { id: 'saved-local', label: 'Saved locally' },
  );
  assert.deepEqual(
    getSaveStatusPresentation({ saveState: 'saved', syncState: 'syncing', cloudMode: true }),
    { id: 'syncing', label: 'Syncing' },
  );
  assert.deepEqual(
    getSaveStatusPresentation({ saveState: 'saved', syncState: 'saved', cloudMode: true }),
    { id: 'synced', label: 'Synced' },
  );
  assert.deepEqual(
    getSaveStatusPresentation({ saveState: 'saved', syncState: 'offline', cloudMode: true }),
    { id: 'queued', label: 'Queued' },
  );
});

test('account settings maps sign-out choices to the existing browser storage preference', () => {
  assert.equal(getSignOutStorageMode({ allow: true, skipPrompt: false }), 'ask');
  assert.equal(getSignOutStorageMode({ allow: true, skipPrompt: true }), 'keep');
  assert.equal(getSignOutStorageMode({ allow: false, skipPrompt: true }), 'clear');

  assert.deepEqual(createSignOutStoragePreference('ask', { allow: false, skipPrompt: true }), {
    allow: false,
    skipPrompt: false,
  });
  assert.deepEqual(createSignOutStoragePreference('keep'), {
    allow: true,
    skipPrompt: true,
  });
  assert.deepEqual(createSignOutStoragePreference('clear'), {
    allow: false,
    skipPrompt: true,
  });
});

test('folder open state is cleared with browser resume data but is not itself resume data', async () => {
  const values = new Map([
    ['resumeloomr:open-folders:v1', JSON.stringify(['folder-1'])],
    ['unrelated', 'keep'],
  ]);
  const storage = {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] || null; },
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };

  assert.equal(hasLocalResumeWorkspaceData(storage), false);
  await clearLocalResumeWorkspaceData(storage);
  assert.equal(storage.getItem('resumeloomr:open-folders:v1'), null);
  assert.equal(storage.getItem('unrelated'), 'keep');
});

