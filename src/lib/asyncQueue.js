export function createSerialTaskQueue() {
  let tail = Promise.resolve();

  return function runSerialTask(task) {
    if (typeof task !== 'function') {
      return Promise.reject(new TypeError('A queued task must be a function.'));
    }

    const result = tail.then(task, task);
    tail = result.then(() => undefined, () => undefined);
    return result;
  };
}

export function runWithOptionalWebLock(lockName, task) {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : null;

  if (!locks?.request) {
    return task();
  }

  return locks.request(lockName, { mode: 'exclusive' }, task);
}
