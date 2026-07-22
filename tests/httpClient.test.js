import assert from 'node:assert/strict';
import test from 'node:test';

import { fetchWithTimeout } from '../src/lib/httpClient.js';

async function withFetch(fetchImplementation, callback) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fetchImplementation;

  try {
    return await callback();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

test('fetch timeout aborts a request that does not settle', async () => {
  await withFetch((_input, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => {
      const error = new Error('Aborted');
      error.name = 'AbortError';
      reject(error);
    }, { once: true });
  }), async () => {
    await assert.rejects(fetchWithTimeout('/slow', {}, 5), { name: 'AbortError' });
  });
});

test('fetch timeout forwards an existing abort signal', async () => {
  const sourceController = new AbortController();

  await withFetch((_input, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => {
      const error = new Error('Aborted');
      error.name = 'AbortError';
      reject(error);
    }, { once: true });
  }), async () => {
    const request = fetchWithTimeout('/cancelled', { signal: sourceController.signal }, 1000);
    sourceController.abort();
    await assert.rejects(request, { name: 'AbortError' });
  });
});

test('fetch timeout preserves successful responses', async () => {
  const expectedResponse = { ok: true };

  await withFetch(async () => expectedResponse, async () => {
    assert.equal(await fetchWithTimeout('/ready', {}, 1000), expectedResponse);
  });
});
