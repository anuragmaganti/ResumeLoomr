const DB_NAME = 'resumeloomr-local-workspace';
const DB_VERSION = 1;
const OUTBOX_STORE = 'outbox';
const TOMBSTONES_STORE = 'tombstones';
const SYNC_TAG = 'resumeloomr-sync-outbox';

function openWorkspaceDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains('workspace')) {
        db.createObjectStore('workspace', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('drafts')) {
        db.createObjectStore('drafts', { keyPath: 'resumeId' });
      }

      if (!db.objectStoreNames.contains(OUTBOX_STORE)) {
        db.createObjectStore(OUTBOX_STORE, { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains(TOMBSTONES_STORE)) {
        db.createObjectStore(TOMBSTONES_STORE, { keyPath: 'resumeId' });
      }

      if (!db.objectStoreNames.contains('syncMeta')) {
        db.createObjectStore('syncMeta', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('accountBinding')) {
        db.createObjectStore('accountBinding', { keyPath: 'id' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function getAll(store) {
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

function getRecord(store, key) {
  return new Promise((resolve, reject) => {
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

function deleteRecord(store, key) {
  return new Promise((resolve, reject) => {
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

function putRecord(store, record) {
  return new Promise((resolve, reject) => {
    const request = store.put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

async function markSynced(db, operationIds) {
  const tx = db.transaction([OUTBOX_STORE, TOMBSTONES_STORE], 'readwrite');
  const outboxStore = tx.objectStore(OUTBOX_STORE);
  const tombstoneStore = tx.objectStore(TOMBSTONES_STORE);

  await Promise.all(operationIds.map(async (operationId) => {
    const record = await getRecord(outboxStore, operationId);
    await deleteRecord(outboxStore, operationId);

    if (record?.type === 'deleteDraft' && record.resumeId) {
      await deleteRecord(tombstoneStore, record.resumeId);
    }
  }));
}

async function markFailed(db, operations, errorMessage) {
  const tx = db.transaction(OUTBOX_STORE, 'readwrite');
  const outboxStore = tx.objectStore(OUTBOX_STORE);
  const now = new Date().toISOString();

  await Promise.all(operations.map(async (operation) => {
    await putRecord(outboxStore, {
      ...operation,
      attempts: Number(operation.attempts || 0) + 1,
      lastError: errorMessage,
      updatedAt: now,
      status: 'pending',
    });
  }));
}

async function syncOutbox() {
  const db = await openWorkspaceDb();
  const tx = db.transaction(OUTBOX_STORE, 'readonly');
  const operations = (await getAll(tx.objectStore(OUTBOX_STORE)))
    .filter((operation) => operation?.status === 'pending')
    .sort((a, b) => String(a.updatedAt).localeCompare(String(b.updatedAt)))
    .slice(0, 150);

  if (operations.length === 0) {
    return;
  }

  try {
    const response = await fetch('/api/sync-workspace', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ operations }),
    });

    if (!response.ok) {
      throw new Error(`Cloud sync failed with ${response.status}`);
    }

    const payload = await response.json();
    const syncedOperationIds = Array.isArray(payload.syncedOperationIds)
      ? payload.syncedOperationIds
      : operations.map((operation) => operation.id);

    await markSynced(db, syncedOperationIds);
  } catch (error) {
    await markFailed(db, operations, error?.message || 'Cloud sync failed.');
    throw error;
  }
}

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SYNC_RESUME_OUTBOX') {
    const syncPromise = syncOutbox();

    if (typeof event.waitUntil === 'function') {
      event.waitUntil(syncPromise);
    } else {
      syncPromise.catch(() => {});
    }
  }
});

self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(syncOutbox());
  }
});
