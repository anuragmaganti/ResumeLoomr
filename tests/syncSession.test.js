import test, { afterEach, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';

import { deleteLocalWorkspaceDatabase } from '../src/lib/localWorkspaceDb.js';
import {
  clearResumeSyncSession,
  ensureResumeSyncSession,
  resetResumeSyncSessionState,
} from '../src/lib/syncSession.js';

const originalFetch = globalThis.fetch;

beforeEach(async () => {
  resetResumeSyncSessionState();
  await deleteLocalWorkspaceDatabase().catch(() => null);
});

afterEach(async () => {
  resetResumeSyncSessionState();
  await deleteLocalWorkspaceDatabase().catch(() => null);
  globalThis.fetch = originalFetch;
});

test('concurrent session requests for one account share a single network call', async () => {
  let postCount = 0;
  let resolveRequest;

  globalThis.fetch = async (_url, options) => {
    postCount += 1;
    assert.equal(options.method, 'POST');

    return new Promise((resolve) => {
      resolveRequest = () => resolve({ ok: true });
    });
  };

  const firstRequest = ensureResumeSyncSession({
    idToken: 'token-a',
    accountUid: 'account-a',
  });
  const secondRequest = ensureResumeSyncSession({
    idToken: 'token-a',
    accountUid: 'account-a',
  });

  assert.equal(firstRequest, secondRequest);

  while (!resolveRequest) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  resolveRequest();
  assert.equal(await firstRequest, true);
  assert.equal(await secondRequest, true);
  assert.equal(await ensureResumeSyncSession({
    idToken: 'new-token-a',
    accountUid: 'account-a',
  }), true);
  assert.equal(postCount, 1);
});

test('switching accounts aborts the previous session request', async () => {
  const signals = [];

  globalThis.fetch = async (_url, options) => {
    signals.push(options.signal);

    if (signals.length > 1) {
      return { ok: true };
    }

    return new Promise((resolve, reject) => {
      const abortRequest = () => {
        const error = new Error('The request was aborted.');
        error.name = 'AbortError';
        reject(error);
      };

      if (options.signal.aborted) {
        abortRequest();
        return;
      }

      options.signal.addEventListener('abort', abortRequest, { once: true });
    });
  };

  const firstRequest = ensureResumeSyncSession({
    idToken: 'token-a',
    accountUid: 'account-a',
  });

  while (signals.length === 0) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  const secondRequest = ensureResumeSyncSession({
    idToken: 'token-b',
    accountUid: 'account-b',
  });

  await assert.rejects(firstRequest, { name: 'AbortError' });
  assert.equal(signals[0].aborted, true);
  assert.equal(await secondRequest, true);
  assert.equal(signals.length, 2);
});

test('clearing a session invalidates the local memo and allows recreation', async () => {
  const methods = [];

  globalThis.fetch = async (_url, options) => {
    methods.push(options.method);
    return { ok: true };
  };

  assert.equal(await ensureResumeSyncSession({
    idToken: 'token-a',
    accountUid: 'account-a',
  }), true);
  assert.equal(await clearResumeSyncSession(), true);
  assert.equal(await ensureResumeSyncSession({
    idToken: 'token-a-2',
    accountUid: 'account-a',
  }), true);

  assert.deepEqual(methods, ['POST', 'DELETE', 'POST']);
});

test('a failed session request is not cached', async () => {
  let postCount = 0;

  globalThis.fetch = async () => {
    postCount += 1;
    return { ok: postCount > 1 };
  };

  await assert.rejects(
    ensureResumeSyncSession({ idToken: 'token-a', accountUid: 'account-a' }),
    /Could not start browser sync session/,
  );
  assert.equal(await ensureResumeSyncSession({
    idToken: 'token-a-2',
    accountUid: 'account-a',
  }), true);
  assert.equal(postCount, 2);
});
