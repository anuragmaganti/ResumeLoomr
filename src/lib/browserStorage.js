function getWindowStorage(storageName) {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window[storageName];
  } catch {
    return null;
  }
}

export function getBrowserLocalStorage(storage = null) {
  return storage || getWindowStorage('localStorage');
}

export function getBrowserSessionStorage(storage = null) {
  return storage || getWindowStorage('sessionStorage');
}

export function readStorageItem(storage, key) {
  if (!storage) {
    return null;
  }

  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStorageItem(storage, key, value) {
  if (!storage) {
    return false;
  }

  try {
    storage.setItem(key, String(value));
    return true;
  } catch {
    return false;
  }
}

export function removeStorageItem(storage, key) {
  if (!storage) {
    return false;
  }

  try {
    storage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function listStorageKeys(storage) {
  if (!storage) {
    return { keys: [], succeeded: true };
  }

  try {
    const keys = [];

    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);

      if (typeof key === 'string') {
        keys.push(key);
      }
    }

    return { keys, succeeded: true };
  } catch {
    return { keys: [], succeeded: false };
  }
}

export function readLocalStorageItem(key, storage = null) {
  return readStorageItem(getBrowserLocalStorage(storage), key);
}

export function writeLocalStorageItem(key, value, storage = null) {
  return writeStorageItem(getBrowserLocalStorage(storage), key, value);
}
