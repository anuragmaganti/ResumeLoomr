import test from 'node:test';
import assert from 'node:assert/strict';

import {
  registerResumeSyncWorker,
  requestResumeBackgroundSync,
} from '../src/lib/backgroundSync.js';

async function withNavigator(serviceWorker, callback) {
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { serviceWorker },
  });

  try {
    return await callback();
  } finally {
    if (originalDescriptor) {
      Object.defineProperty(globalThis, 'navigator', originalDescriptor);
    } else {
      delete globalThis.navigator;
    }
  }
}

test('background sync uses an existing registration without waiting for ready', async () => {
  const messages = [];
  const registration = {
    active: {
      postMessage(message) {
        messages.push(message);
      },
    },
  };

  const requested = await withNavigator({
    get ready() {
      throw new Error('The unbounded ready promise must not be read.');
    },
    async getRegistration() {
      return registration;
    },
  }, () => requestResumeBackgroundSync());

  assert.equal(requested, true);
  assert.deepEqual(messages, [{ type: 'SYNC_RESUME_OUTBOX' }]);
});

test('background sync fails promptly when registration is unavailable', async () => {
  const requested = await withNavigator({
    async getRegistration() {
      return null;
    },
    async register() {
      throw new Error('Service workers are disabled.');
    },
  }, () => requestResumeBackgroundSync());

  assert.equal(requested, false);
});

test('sync worker registration bypasses the HTTP cache', async () => {
  let registrationRequest = null;

  await withNavigator({
    async register(url, options) {
      registrationRequest = { url, options };
      return { active: null };
    },
  }, () => registerResumeSyncWorker());

  assert.deepEqual(registrationRequest, {
    url: '/sync-worker.js',
    options: { updateViaCache: 'none' },
  });
});
