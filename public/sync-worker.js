const DB_NAME = 'resumeloomr-local-workspace';
const DB_VERSION = 1;
const WORKSPACE_STORE = 'workspace';
const DRAFTS_STORE = 'drafts';
const OUTBOX_STORE = 'outbox';
const TOMBSTONES_STORE = 'tombstones';
const ACCOUNT_BINDING_STORE = 'accountBinding';
const ACCOUNT_BINDING_ID = 'current';
const SYNC_TAG = 'resumeloomr-sync-outbox';
const MAX_SYNC_REQUEST_BYTES = 3_000_000;
const MAX_SYNC_OPERATION_BYTES = 1_000_000;

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

      if (!db.objectStoreNames.contains(ACCOUNT_BINDING_STORE)) {
        db.createObjectStore(ACCOUNT_BINDING_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
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

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

function normalizeCloudVersion(value) {
  const version = Number(value);

  return Number.isSafeInteger(version) && version >= 0 ? version : 0;
}

function getSerializedByteSize(value) {
  return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function partitionClientSyncOperations(operations) {
  const oversizedOperations = [];
  const eligibleOperations = [];

  operations.forEach((operation) => {
    if (getSerializedByteSize(operation) > MAX_SYNC_OPERATION_BYTES) {
      oversizedOperations.push(normalizeAckDescriptor({
        ...operation,
        reason: 'payload-too-large',
      }));
    } else {
      eligibleOperations.push(operation);
    }
  });

  const selectedOperations = [];
  let selectedBytes = 256;

  for (const operation of eligibleOperations) {
    const operationBytes = getSerializedByteSize(operation) + 1;

    if (selectedOperations.length > 0 && selectedBytes + operationBytes > MAX_SYNC_REQUEST_BYTES) {
      break;
    }

    selectedOperations.push(operation);
    selectedBytes += operationBytes;
  }

  return {
    operations: selectedOperations,
    oversizedOperations: oversizedOperations.filter(Boolean),
  };
}

function normalizeAckDescriptor(operation) {
  if (!operation || typeof operation !== 'object' || typeof operation.id !== 'string' || operation.id === '') {
    return null;
  }

  const cloudVersion = Number(operation.cloudVersion);

  const descriptor = {
    id: operation.id,
    operationVersion: Number(operation.operationVersion || 0) || 0,
    localRevision: typeof operation.localRevision === 'string' ? operation.localRevision : '',
  };

  if (Number.isSafeInteger(cloudVersion) && cloudVersion >= 0) {
    descriptor.cloudVersion = cloudVersion;
  }

  if (typeof operation.reason === 'string' && operation.reason) {
    descriptor.reason = operation.reason;
  }

  return descriptor;
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

async function clearSessionWhenReady(db, accountUid, pendingCount) {
  if (pendingCount !== 0) {
    return;
  }

  const readTx = db.transaction(ACCOUNT_BINDING_STORE, 'readonly');
  const account = await getRecord(readTx.objectStore(ACCOUNT_BINDING_STORE), ACCOUNT_BINDING_ID);

  if (account?.uid !== accountUid || account?.clearSessionWhenSynced !== true) {
    return;
  }

  const response = await fetch('/api/sync-session', {
    method: 'DELETE',
    credentials: 'include',
  });

  if (!response.ok) {
    return;
  }

  const writeTx = db.transaction(ACCOUNT_BINDING_STORE, 'readwrite');
  const done = transactionDone(writeTx);
  await putRecord(writeTx.objectStore(ACCOUNT_BINDING_STORE), {
    ...account,
    clearSessionWhenSynced: false,
    updatedAt: new Date().toISOString(),
  });
  await done;
}

async function markSynced(db, operations) {
  const tx = db.transaction([
    WORKSPACE_STORE,
    DRAFTS_STORE,
    OUTBOX_STORE,
    TOMBSTONES_STORE,
    ACCOUNT_BINDING_STORE,
  ], 'readwrite');
  const done = transactionDone(tx);
  const workspaceStore = tx.objectStore(WORKSPACE_STORE);
  const draftsStore = tx.objectStore(DRAFTS_STORE);
  const outboxStore = tx.objectStore(OUTBOX_STORE);
  const tombstoneStore = tx.objectStore(TOMBSTONES_STORE);
  const accountBinding = await getRecord(
    tx.objectStore(ACCOUNT_BINDING_STORE),
    ACCOUNT_BINDING_ID,
  );
  const boundAccountUid = String(accountBinding?.uid || '').trim();
  const acks = Array.isArray(operations) ? operations.map(normalizeAckDescriptor).filter(Boolean) : [];

  for (const ack of acks) {
    const record = await getRecord(outboxStore, ack.id);

    if (!record) {
      continue;
    }

    const exactMatch = operationMatchesAck(record, ack);
    const recordAccountUid = String(record.accountUid || '').trim();
    const recordOwnsCurrentWorkspace = Boolean(
      recordAccountUid
      && boundAccountUid
      && recordAccountUid === boundAccountUid
    );

    if (recordOwnsCurrentWorkspace && Number.isSafeInteger(ack.cloudVersion) && ack.cloudVersion >= 0) {
      if (record.type === 'workspace') {
        const workspaceRecord = await getRecord(workspaceStore, 'main');

        if (workspaceRecord) {
          await putRecord(workspaceStore, {
            ...workspaceRecord,
            cloudVersion: Math.max(normalizeCloudVersion(workspaceRecord.cloudVersion), ack.cloudVersion),
          });
        }
      } else if (record.type === 'upsertDraft' && record.resumeId) {
        const draftRecord = await getRecord(draftsStore, record.resumeId);

        if (draftRecord) {
          const cloudVersion = Math.max(
            normalizeCloudVersion(draftRecord.cloudVersion ?? draftRecord.draft?.cloudVersion),
            ack.cloudVersion,
          );
          await putRecord(draftsStore, {
            ...draftRecord,
            cloudVersion,
            draft: { ...draftRecord.draft, cloudVersion },
          });
        }
      }

      if (!exactMatch && record.status === 'pending') {
        await putRecord(outboxStore, {
          ...record,
          baseCloudVersion: Math.max(normalizeCloudVersion(record.baseCloudVersion), ack.cloudVersion),
        });
      }
    }

    if (!exactMatch) {
      continue;
    }

    await deleteRecord(outboxStore, ack.id);

    if (record?.type === 'deleteDraft' && record.resumeId) {
      const tombstone = await getRecord(tombstoneStore, record.resumeId);

      if (
        tombstone
        && (
          !String(tombstone.accountUid || '').trim()
          || String(tombstone.accountUid || '').trim() === recordAccountUid
        )
      ) {
        await putRecord(tombstoneStore, {
          ...tombstone,
          syncedAt: new Date().toISOString(),
        });
      }
    }
  }

  await done;
}

async function markFailed(db, operations, errorMessage) {
  const tx = db.transaction(OUTBOX_STORE, 'readwrite');
  const done = transactionDone(tx);
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
  await done;
}

async function markStale(db, operations, errorMessage = 'Skipped stale cloud write.') {
  const tx = db.transaction(OUTBOX_STORE, 'readwrite');
  const done = transactionDone(tx);
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
  await done;
}

async function syncOutbox() {
  const db = await openWorkspaceDb();
  try {
    const accountUid = await readCurrentAccountUid(db);

    if (!accountUid) {
      return;
    }

    for (let pass = 0; pass < 5; pass += 1) {
      const tx = db.transaction(OUTBOX_STORE, 'readonly');
      const pendingOperations = (await getAll(tx.objectStore(OUTBOX_STORE)))
        .filter((operation) => operation?.status === 'pending' && operationBelongsToAccount(operation, accountUid))
        .sort((a, b) => String(a.updatedAt).localeCompare(String(b.updatedAt)))
        .slice(0, 150);

      if (pendingOperations.length === 0) {
        await clearSessionWhenReady(db, accountUid, 0);
        return;
      }

      const clientPartition = partitionClientSyncOperations(pendingOperations);
      const operations = clientPartition.operations;

      await markStale(
        db,
        clientPartition.oversizedOperations,
        'This resume is too large to sync, but it remains saved in this browser.',
      );

      if (operations.length === 0) {
        continue;
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
        const oversizedOperations = rejectedOperations.filter((operation) => operation.reason === 'payload-too-large');
        const accountRejectedOperations = rejectedOperations.filter((operation) => operation.reason !== 'payload-too-large');

        await markSynced(db, syncedOperations);
        await markStale(db, staleOperations);
        await markStale(db, oversizedOperations, 'This resume is too large to sync, but it remains saved in this browser.');
        await markStale(db, accountRejectedOperations, 'Skipped cloud sync because these changes belong to another account.');
      } catch (error) {
        await markFailed(db, operations.map(normalizeAckDescriptor).filter(Boolean), error?.message || 'Cloud sync failed.');
        throw error;
      }
    }

    const remainingTx = db.transaction(OUTBOX_STORE, 'readonly');
    const remainingOperations = (await getAll(remainingTx.objectStore(OUTBOX_STORE)))
      .filter((operation) => operation?.status === 'pending' && operationBelongsToAccount(operation, accountUid));

    if (remainingOperations.length === 0) {
      await clearSessionWhenReady(db, accountUid, 0);
    } else if ('sync' in self.registration) {
      await self.registration.sync.register(SYNC_TAG);
    }
  } finally {
    db.close();
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
