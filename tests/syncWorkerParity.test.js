import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import { indexedDB } from 'fake-indexeddb';

import {
  getOperationAcksFromResponse,
  partitionClientSyncOperations,
} from '../src/lib/backgroundSync.js';
import {
  createOutboxAckDescriptor,
  outboxOperationBelongsToAccount,
  outboxOperationMatchesAck,
} from '../src/lib/outboxProtocol.js';

const workerSource = fs.readFileSync('public/sync-worker.js', 'utf8');

function normalizeRealmValue(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadWorkerContext({ database = indexedDB } = {}) {
  const listeners = new Map();
  const context = vm.createContext({
    TextEncoder,
    indexedDB: database,
    fetch: async () => ({ ok: true }),
    self: {
      registration: {},
      clients: { claim() {} },
      skipWaiting() {},
      addEventListener(type, callback) {
        listeners.set(type, callback);
      },
    },
  });

  vm.runInContext(workerSource, context, { filename: 'public/sync-worker.js' });
  return { context, listeners };
}

async function readWorkerRecord(context, db, storeName, key) {
  const transaction = db.transaction(storeName, 'readonly');
  return context.getRecord(transaction.objectStore(storeName), key);
}

test('sync worker and page normalize acknowledgement descriptors identically', () => {
  const { context } = loadWorkerContext();
  const operation = {
    id: 'account-a:upsertDraft:resume-1',
    accountUid: 'account-a',
    operationVersion: 12,
    localRevision: 'revision-12',
    cloudVersion: 4,
    reason: 'version-conflict',
  };

  assert.deepEqual(
    normalizeRealmValue(context.normalizeAckDescriptor(operation)),
    createOutboxAckDescriptor(operation),
  );
  assert.equal(
    context.operationMatchesAck(operation, operation),
    outboxOperationMatchesAck(operation, operation),
  );
  assert.equal(
    context.operationBelongsToAccount(operation, 'account-a'),
    outboxOperationBelongsToAccount(operation, 'account-a'),
  );
});

test('sync worker and page partition request payloads identically', () => {
  const { context } = loadWorkerContext();
  const operations = [
    {
      id: 'account-a:workspace',
      type: 'workspace',
      operationVersion: 1,
      localRevision: 'workspace-1',
      accountUid: 'account-a',
      workspace: { resumeIds: ['resume-1'] },
    },
    {
      id: 'account-a:upsertDraft:resume-1',
      type: 'upsertDraft',
      operationVersion: 2,
      localRevision: 'draft-2',
      accountUid: 'account-a',
      draft: { resume: { personal: { name: 'Example' } } },
    },
  ];

  assert.deepEqual(
    normalizeRealmValue(context.partitionClientSyncOperations(operations)),
    partitionClientSyncOperations(operations),
  );
});

test('sync worker and page map descriptor and legacy responses identically', () => {
  const { context } = loadWorkerContext();
  const operations = [{
    id: 'account-a:workspace',
    operationVersion: 8,
    localRevision: 'workspace-8',
  }];
  const descriptorPayload = {
    syncedOperations: [{ ...operations[0], cloudVersion: 3 }],
  };
  const legacyPayload = { syncedOperationIds: [operations[0].id] };

  assert.deepEqual(
    normalizeRealmValue(context.getOperationAcksFromResponse(
      descriptorPayload,
      operations,
      'syncedOperations',
      'syncedOperationIds',
    )),
    getOperationAcksFromResponse(
      descriptorPayload,
      operations,
      'syncedOperations',
      'syncedOperationIds',
    ),
  );
  assert.deepEqual(
    normalizeRealmValue(context.getOperationAcksFromResponse(
      legacyPayload,
      operations,
      'syncedOperations',
      'syncedOperationIds',
    )),
    getOperationAcksFromResponse(
      legacyPayload,
      operations,
      'syncedOperations',
      'syncedOperationIds',
    ),
  );
});

test('sync worker creates the same indexed outbox shape as the page database', async () => {
  const databaseName = `resumeloomr-worker-test-${Date.now()}`;
  const isolatedIndexedDb = {
    open(name, version) {
      return indexedDB.open(name === 'resumeloomr-local-workspace' ? databaseName : name, version);
    },
  };
  const { context, listeners } = loadWorkerContext({ database: isolatedIndexedDb });
  const db = await context.openWorkspaceDb();
  const transaction = db.transaction('outbox', 'readonly');
  const indexNames = Array.from(transaction.objectStore('outbox').indexNames).sort();

  assert.deepEqual(indexNames, ['resumeId', 'status', 'updatedAt']);
  assert.deepEqual([...listeners.keys()], ['install', 'activate', 'message', 'sync']);

  db.close();
  indexedDB.deleteDatabase(databaseName);
});

test('sync worker acknowledgements cannot clear or fail a newer outbox replacement', async () => {
  const databaseName = `resumeloomr-worker-ack-test-${Date.now()}`;
  const isolatedIndexedDb = {
    open(name, version) {
      return indexedDB.open(name === 'resumeloomr-local-workspace' ? databaseName : name, version);
    },
  };
  const { context } = loadWorkerContext({ database: isolatedIndexedDb });
  const db = await context.openWorkspaceDb();
  const operationId = 'account-a:upsertDraft:resume-1';
  const seedTransaction = db.transaction([
    'drafts',
    'outbox',
    'accountBinding',
  ], 'readwrite');
  const seedDone = context.transactionDone(seedTransaction);

  await context.putRecord(seedTransaction.objectStore('accountBinding'), {
    id: 'current',
    uid: 'account-a',
  });
  await context.putRecord(seedTransaction.objectStore('drafts'), {
    resumeId: 'resume-1',
    cloudVersion: 1,
    draft: { cloudVersion: 1 },
  });
  await context.putRecord(seedTransaction.objectStore('outbox'), {
    id: operationId,
    type: 'upsertDraft',
    resumeId: 'resume-1',
    accountUid: 'account-a',
    operationVersion: 2,
    localRevision: 'revision-2',
    baseCloudVersion: 1,
    attempts: 0,
    status: 'pending',
  });
  await seedDone;

  const oldAck = {
    id: operationId,
    operationVersion: 1,
    localRevision: 'revision-1',
    cloudVersion: 5,
  };

  await context.markSynced(db, [oldAck]);
  await context.markFailed(db, [oldAck], 'old request failed');
  await context.markStale(db, [oldAck], 'old request was stale');

  const pendingReplacement = await readWorkerRecord(context, db, 'outbox', operationId);
  const updatedDraft = await readWorkerRecord(context, db, 'drafts', 'resume-1');

  assert.equal(pendingReplacement.operationVersion, 2);
  assert.equal(pendingReplacement.localRevision, 'revision-2');
  assert.equal(pendingReplacement.baseCloudVersion, 5);
  assert.equal(pendingReplacement.attempts, 0);
  assert.equal(pendingReplacement.status, 'pending');
  assert.equal(updatedDraft.cloudVersion, 5);

  await context.markSynced(db, [{
    id: operationId,
    operationVersion: 2,
    localRevision: 'revision-2',
    cloudVersion: 6,
  }]);

  assert.equal(await readWorkerRecord(context, db, 'outbox', operationId), null);
  assert.equal((await readWorkerRecord(context, db, 'drafts', 'resume-1')).cloudVersion, 6);

  db.close();
  indexedDB.deleteDatabase(databaseName);
});
