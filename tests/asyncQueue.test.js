import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createSerialTaskQueue,
  runWithOptionalWebLock,
} from '../src/lib/asyncQueue.js';

test('serial task queue preserves order and continues after a rejection', async () => {
  const runTask = createSerialTaskQueue();
  const calls = [];
  let releaseFirst;

  const first = runTask(async () => {
    calls.push('first:start');
    await new Promise((resolve) => {
      releaseFirst = resolve;
    });
    calls.push('first:end');
    throw new Error('Expected failure.');
  });
  const second = runTask(async () => {
    calls.push('second');
    return 'complete';
  });

  await Promise.resolve();
  assert.deepEqual(calls, ['first:start']);
  releaseFirst();
  await assert.rejects(first, /Expected failure/);
  assert.equal(await second, 'complete');
  assert.deepEqual(calls, ['first:start', 'first:end', 'second']);
});

test('optional web lock uses one named exclusive lock when available', async () => {
  const originalDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const requests = [];

  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      locks: {
        request(name, options, task) {
          requests.push({ name, options });
          return task();
        },
      },
    },
  });

  try {
    assert.equal(await runWithOptionalWebLock('workspace-sync', async () => 'locked'), 'locked');
    assert.deepEqual(requests, [{ name: 'workspace-sync', options: { mode: 'exclusive' } }]);
  } finally {
    if (originalDescriptor) {
      Object.defineProperty(globalThis, 'navigator', originalDescriptor);
    } else {
      delete globalThis.navigator;
    }
  }
});
