const DB_NAME = 'resumeloomr-local-workspace';
const DB_VERSION = 1;
const OUTBOX_STORE = 'outbox';
const TOMBSTONES_STORE = 'tombstones';
const ACCOUNT_BINDING_STORE = 'accountBinding';
const ACCOUNT_BINDING_ID = 'current';
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

      if (!db.objectStoreNames.contains(ACCOUNT_BINDING_STORE)) {
        db.createObjectStore(ACCOUNT_BINDING_STORE, { keyPath: 'id' });
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

function normalizeAckDescriptor(operation) {
  if (!operation || typeof operation !== 'object' || typeof operation.id !== 'string' || operation.id === '') {
    return null;
  }

  return {
    id: operation.id,
    operationVersion: Number(operation.operationVersion || 0) || 0,
    localRevision: typeof operation.localRevision === 'string' ? operation.localRevision : '',
  };
}

function operationMatchesAck(operation, ack) {
  const normalizedAck = normalizeAckDescriptor(ack);

  if (!operation || !normalizedAck || operation.id !== normalizedAck.id) {
    return false;
  }

  return (
    (Number(operation.operationVersion || 0) || 0) === normalizedAck.operationVersion &&
    (typeof operation.localRevision === 'string' ? operation.localRevision : '') === normalizedAck.localRevision
  );
}

function operationBelongsToAccount(operation, accountUid) {
  return Boolean(accountUid) && String(operation?.accountUid || '').trim() === accountUid;
}

function getOperationAcksFromResponse(payload, operations, descriptorKey, legacyIdKey) {
  if (Array.isArray(payload?.[descriptorKey])) {
    return payload[descriptorKey].map(normalizeAckDescriptor).filter(Boolean);
  }

  if (!Array.isArray(payload?.[legacyIdKey])) {
    return [];
  }

  const operationById = new Map(operations.map((operation) => [operation.id, operation]));

  return payload[legacyIdKey]
    .map((operationId) => normalizeAckDescriptor(operationById.get(operationId)))
    .filter(Boolean);
}

async function readCurrentAccountUid(db) {
  const tx = db.transaction(ACCOUNT_BINDING_STORE, 'readonly');
  const account = await getRecord(tx.objectStore(ACCOUNT_BINDING_STORE), ACCOUNT_BINDING_ID);

  return String(account?.uid || '').trim();
}

async function markSynced(db, operations) {
  const tx = db.transaction([OUTBOX_STORE, TOMBSTONES_STORE], 'readwrite');
  const outboxStore = tx.objectStore(OUTBOX_STORE);
  const tombstoneStore = tx.objectStore(TOMBSTONES_STORE);
  const acks = Array.isArray(operations) ? operations.map(normalizeAckDescriptor).filter(Boolean) : [];

  await Promise.all(acks.map(async (ack) => {
    const record = await getRecord(outboxStore, ack.id);

    if (!operationMatchesAck(record, ack)) {
      return;
    }

    await deleteRecord(outboxStore, ack.id);

    if (record?.type === 'deleteDraft' && record.resumeId) {
      await deleteRecord(tombstoneStore, record.resumeId);
    }
  }));
}

async function markFailed(db, operations, errorMessage) {
  const tx = db.transaction(OUTBOX_STORE, 'readwrite');
  const outboxStore = tx.objectStore(OUTBOX_STORE);
  const now = new Date().toISOString();
  const acks = Array.isArray(operations) ? operations.map(normalizeAckDescriptor).filter(Boolean) : [];

  await Promise.all(acks.map(async (ack) => {
    const operation = await getRecord(outboxStore, ack.id);

    if (!operationMatchesAck(operation, ack)) {
      return;
    }

    await putRecord(outboxStore, {
      ...operation,
      attempts: Number(operation.attempts || 0) + 1,
      lastError: errorMessage,
      updatedAt: now,
      status: 'pending',
    });
  }));
}

async function markStale(db, operations, errorMessage = 'Skipped stale cloud write.') {
  const tx = db.transaction(OUTBOX_STORE, 'readwrite');
  const outboxStore = tx.objectStore(OUTBOX_STORE);
  const now = new Date().toISOString();
  const acks = Array.isArray(operations) ? operations.map(normalizeAckDescriptor).filter(Boolean) : [];

  await Promise.all(acks.map(async (ack) => {
    const operation = await getRecord(outboxStore, ack.id);

    if (!operationMatchesAck(operation, ack)) {
      return;
    }

    await putRecord(outboxStore, {
      ...operation,
      lastError: errorMessage,
      updatedAt: now,
      status: 'stale',
    });
  }));
}

async function syncOutbox() {
  const db = await openWorkspaceDb();
  const accountUid = await readCurrentAccountUid(db);

  if (!accountUid) {
    return;
  }

  const tx = db.transaction(OUTBOX_STORE, 'readonly');
  const operations = (await getAll(tx.objectStore(OUTBOX_STORE)))
    .filter((operation) => operation?.status === 'pending' && operationBelongsToAccount(operation, accountUid))
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
      body: JSON.stringify({ accountUid, operations }),
    });

    if (response.status === 409) {
      return;
    }

    if (!response.ok) {
      throw new Error(`Cloud sync failed with ${response.status}`);
    }

    const payload = await response.json();
    const syncedOperations = getOperationAcksFromResponse(payload, operations, 'syncedOperations', 'syncedOperationIds');
    const staleOperations = getOperationAcksFromResponse(payload, operations, 'staleOperations', 'staleOperationIds');
    const rejectedOperations = getOperationAcksFromResponse(payload, operations, 'rejectedOperations', 'rejectedOperationIds');

    await markSynced(db, syncedOperations);
    await markStale(db, staleOperations);
    await markStale(db, rejectedOperations, 'Skipped cloud sync because these changes belong to another account.');
  } catch (error) {
    await markFailed(db, operations.map(normalizeAckDescriptor).filter(Boolean), error?.message || 'Cloud sync failed.');
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
