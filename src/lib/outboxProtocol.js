import { trimText } from './text.js';

function normalizeOutboxAckDescriptor(operation) {
  if (!operation || typeof operation !== 'object') {
    return null;
  }

  const id = trimText(operation.id);

  if (!id) {
    return null;
  }

  const rawCloudVersion = Number(operation.cloudVersion);
  const descriptor = {
    id,
    operationVersion: Number(operation.operationVersion || 0) || 0,
    localRevision: trimText(operation.localRevision),
  };

  if (Number.isSafeInteger(rawCloudVersion) && rawCloudVersion >= 0) {
    descriptor.cloudVersion = rawCloudVersion;
  }

  if (trimText(operation.reason)) {
    descriptor.reason = trimText(operation.reason);
  }

  return descriptor;
}

export function createOutboxAckDescriptor(operation) {
  return normalizeOutboxAckDescriptor(operation);
}

export function normalizeOutboxAckList(operations) {
  return Array.isArray(operations)
    ? operations.map(normalizeOutboxAckDescriptor).filter(Boolean)
    : [];
}

export function outboxOperationMatchesAck(operation, ack) {
  const normalizedAck = normalizeOutboxAckDescriptor(ack);

  if (!operation || !normalizedAck || operation.id !== normalizedAck.id) {
    return false;
  }

  const operationVersion = Number(operation.operationVersion || 0) || 0;
  const operationRevision = trimText(operation.localRevision);

  return (
    operationVersion === normalizedAck.operationVersion
    && operationRevision === normalizedAck.localRevision
  );
}

export function outboxOperationBelongsToAccount(operation, accountUid) {
  const normalizedAccountUid = trimText(accountUid);

  return Boolean(normalizedAccountUid) && trimText(operation?.accountUid) === normalizedAccountUid;
}

export function filterOutboxOperationsForAccount(operations, accountUid) {
  if (!Array.isArray(operations)) {
    return [];
  }

  return operations.filter((operation) => outboxOperationBelongsToAccount(operation, accountUid));
}
