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

export function readJsonStorageItem(storage, key) {
  const rawValue = readStorageItem(storage, key);

  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
}

export function writeJsonStorageItem(storage, key, value) {
  try {
    const serializedValue = JSON.stringify(value);

    return serializedValue === undefined
      ? false
      : writeStorageItem(storage, key, serializedValue);
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

export function readLocalStorageJsonItem(key, storage = null) {
  return readJsonStorageItem(getBrowserLocalStorage(storage), key);
}

export function writeLocalStorageJsonItem(key, value, storage = null) {
  return writeJsonStorageItem(getBrowserLocalStorage(storage), key, value);
}
