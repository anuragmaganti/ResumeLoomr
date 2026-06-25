import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromCache,
  onSnapshot,
  setDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  createDraftPayload,
  createDuplicateResumeName,
  createWorkspaceResumeMeta,
  normalizeDraftPayload,
  normalizeWorkspaceIndex,
} from './resume.js';
import { getFirebaseDb } from './firebaseClient.js';

export const CLOUD_WORKSPACE_RESUME_LIMIT = 50;
export const CLOUD_WORKSPACE_SCHEMA_VERSION = 1;
export const CLOUD_IMPORT_PREFIX = 'resumeloomr:firebase-imported:';
export const CLOUD_TRUSTED_DEVICE_KEY = 'resumeloomr:firebase-trusted-device';
export const CLOUD_DEVICE_ID_KEY = 'resumeloomr:firebase-device-id';
export const CLOUD_SESSION_ID_KEY = 'resumeloomr:firebase-session-id';
export const CLOUD_DRAFT_MAX_BYTES = 850_000;
export const CLOUD_COLLECTION_ENTRY_LIMIT = 100;
export const CLOUD_TEXT_LIST_LIMIT = 150;

const RESUME_COLLECTION_KEYS = [
  'education',
  'experience',
  'skills',
  'projects',
  'certifications',
  'volunteering',
  'leadership',
  'languages',
  'awards',
  'publications',
];

function createCloudId(prefix) {
  return globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Math.random().toString(36).slice(2)}`;
}

export function getCloudDeviceId() {
  if (typeof window === 'undefined') {
    return 'server';
  }

  const existingDeviceId = window.localStorage.getItem(CLOUD_DEVICE_ID_KEY);

  if (existingDeviceId) {
    return existingDeviceId;
  }

  const nextDeviceId = createCloudId('device');
  window.localStorage.setItem(CLOUD_DEVICE_ID_KEY, nextDeviceId);
  return nextDeviceId;
}

export function getCloudSessionId() {
  if (typeof window === 'undefined') {
    return 'server';
  }

  const existingSessionId = window.sessionStorage.getItem(CLOUD_SESSION_ID_KEY);

  if (existingSessionId) {
    return existingSessionId;
  }

  const nextSessionId = createCloudId('session');
  window.sessionStorage.setItem(CLOUD_SESSION_ID_KEY, nextSessionId);
  return nextSessionId;
}

function normalizeCloudIdentity(identity) {
  if (typeof identity === 'string') {
    return {
      deviceId: identity,
      sessionId: 'legacy-session',
    };
  }

  return {
    deviceId: identity?.deviceId || 'unknown-device',
    sessionId: identity?.sessionId || 'unknown-session',
  };
}

function getSerializedByteSize(value) {
  const serialized = JSON.stringify(value);

  if (typeof TextEncoder !== 'undefined') {
    return new TextEncoder().encode(serialized).length;
  }

  return serialized.length;
}

function getTimestamp(value) {
  const timestamp = Date.parse(value || '');
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function validateCloudDraftPayload(draftDoc) {
  const resume = draftDoc?.resume && typeof draftDoc.resume === 'object' ? draftDoc.resume : {};
  const oversizedCollection = RESUME_COLLECTION_KEYS.find((key) => (
    Array.isArray(resume[key]) && resume[key].length > CLOUD_COLLECTION_ENTRY_LIMIT
  ));

  if (oversizedCollection) {
    throw Object.assign(new Error(`Too many entries in ${oversizedCollection}.`), {
      code: 'resume/too-many-entries',
    });
  }

  if (Array.isArray(resume.experience)) {
    const oversizedHighlights = resume.experience.some((entry) => (
      Array.isArray(entry?.activities) && entry.activities.length > CLOUD_TEXT_LIST_LIMIT
    ));

    if (oversizedHighlights) {
      throw Object.assign(new Error('Too many experience highlights.'), {
        code: 'resume/too-many-highlights',
      });
    }
  }

  const payloadSize = getSerializedByteSize(draftDoc);

  if (payloadSize > CLOUD_DRAFT_MAX_BYTES) {
    throw Object.assign(new Error('Resume is too large to sync.'), {
      code: 'resume/payload-too-large',
      payloadSize,
    });
  }
}

export function getTrustedDevicePreference() {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(CLOUD_TRUSTED_DEVICE_KEY) === 'true';
}

export function setTrustedDevicePreference(value) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(CLOUD_TRUSTED_DEVICE_KEY, value ? 'true' : 'false');
}

export function getCloudImportKey(uid) {
  return `${CLOUD_IMPORT_PREFIX}${uid}`;
}

export function markGuestWorkspaceImported(uid) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(getCloudImportKey(uid), 'true');
  }
}

function getDb(trustedDevice) {
  return getFirebaseDb({ trustedDevice });
}

export function getWorkspaceDocRef(uid, trustedDevice) {
  const db = getDb(trustedDevice);
  return db ? doc(db, 'users', uid, 'workspace', 'main') : null;
}

export function getResumeDocRef(uid, resumeId, trustedDevice) {
  const db = getDb(trustedDevice);
  return db ? doc(db, 'users', uid, 'resumes', resumeId) : null;
}

function normalizeCloudWorkspace(data) {
  return normalizeWorkspaceIndex({
    activeResumeId: data?.activeResumeId,
    resumeIds: data?.resumeIds,
    meta: data?.meta,
  });
}

function createCloudWorkspaceDoc(workspace, identity, updatedAt = new Date().toISOString(), version = Date.now()) {
  const normalizedWorkspace = normalizeWorkspaceIndex(workspace);
  const cloudIdentity = normalizeCloudIdentity(identity);
  const defaultResumeIds = normalizedWorkspace.resumeIds.slice(0, CLOUD_WORKSPACE_RESUME_LIMIT);
  const resumeIds = normalizedWorkspace.activeResumeId && !defaultResumeIds.includes(normalizedWorkspace.activeResumeId)
    ? [
        normalizedWorkspace.activeResumeId,
        ...defaultResumeIds
          .filter((resumeId) => resumeId !== normalizedWorkspace.activeResumeId)
          .slice(0, CLOUD_WORKSPACE_RESUME_LIMIT - 1),
      ]
    : defaultResumeIds;

  return {
    schemaVersion: CLOUD_WORKSPACE_SCHEMA_VERSION,
    activeResumeId: resumeIds.includes(normalizedWorkspace.activeResumeId)
      ? normalizedWorkspace.activeResumeId
      : resumeIds[0] || '',
    resumeIds,
    meta: Object.fromEntries(
      resumeIds.map((resumeId) => [resumeId, normalizedWorkspace.meta[resumeId]]),
    ),
    updatedAt,
    version,
    deviceId: cloudIdentity.deviceId,
    sessionId: cloudIdentity.sessionId,
  };
}

export function createCloudDraftDoc({ resumeId, name, draft, identity, deviceId, deletedAt = null }) {
  const cloudIdentity = normalizeCloudIdentity(identity || deviceId);
  const payload = createDraftPayload({
    resume: draft.resume,
    template: draft.template,
    sectionOrder: draft.sectionOrder,
  });
  const savedAt = getTimestamp(draft?.savedAt) > 0 ? draft.savedAt : payload.savedAt;
  const version = getTimestamp(savedAt) || Date.now();

  return {
    schemaVersion: CLOUD_WORKSPACE_SCHEMA_VERSION,
    resumeId,
    name,
    template: payload.template,
    sectionOrder: payload.sectionOrder,
    resume: payload.resume,
    savedAt,
    updatedAt: savedAt,
    version,
    deviceId: cloudIdentity.deviceId,
    sessionId: cloudIdentity.sessionId,
    deletedAt,
  };
}

export function cloudDocToDraft(data) {
  const normalized = normalizeDraftPayload({
    template: data?.template,
    sectionOrder: data?.sectionOrder,
    resume: data?.resume,
  });

  return {
    resume: normalized.resume,
    template: normalized.template,
    sectionOrder: normalized.sectionOrder,
    savedAt: data?.savedAt || data?.updatedAt || null,
  };
}

async function readDocumentSnapshot(ref, { cacheOnly = false } = {}) {
  return cacheOnly ? getDocFromCache(ref) : getDoc(ref);
}

export async function readCloudWorkspace(uid, trustedDevice, options = {}) {
  const workspaceRef = getWorkspaceDocRef(uid, trustedDevice);

  if (!workspaceRef) {
    return null;
  }

  const snapshot = await readDocumentSnapshot(workspaceRef, options);

  if (!snapshot.exists()) {
    return null;
  }

  return normalizeCloudWorkspace(snapshot.data());
}

export async function readCloudDraft(uid, resumeId, trustedDevice, options = {}) {
  const draftRef = getResumeDocRef(uid, resumeId, trustedDevice);

  if (!draftRef) {
    return null;
  }

  const snapshot = await readDocumentSnapshot(draftRef, options);

  if (!snapshot.exists() || snapshot.data()?.deletedAt) {
    return null;
  }

  return cloudDocToDraft(snapshot.data());
}

export async function writeCloudWorkspace(uid, workspace, trustedDevice, identity) {
  const workspaceRef = getWorkspaceDocRef(uid, trustedDevice);

  if (!workspaceRef) {
    return null;
  }

  const now = new Date().toISOString();
  const normalizedWorkspace = normalizeWorkspaceIndex(workspace);

  await setDoc(workspaceRef, createCloudWorkspaceDoc(normalizedWorkspace, identity, now));

  return {
    ...normalizedWorkspace,
    updatedAt: now,
  };
}

export async function renameCloudResume(uid, resumeId, workspace, trustedDevice, identity) {
  const workspaceRef = getWorkspaceDocRef(uid, trustedDevice);
  const draftRef = getResumeDocRef(uid, resumeId, trustedDevice);

  if (!workspaceRef || !draftRef) {
    return null;
  }

  const normalizedWorkspace = normalizeWorkspaceIndex(workspace);
  const name = normalizedWorkspace.meta[resumeId]?.name || 'Resume';
  const cloudIdentity = normalizeCloudIdentity(identity);
  const now = new Date().toISOString();
  const version = Date.now();
  const batch = writeBatch(workspaceRef.firestore);

  batch.set(workspaceRef, createCloudWorkspaceDoc(normalizedWorkspace, cloudIdentity, now, version));
  batch.set(
    draftRef,
    {
      name,
      updatedAt: now,
      version,
      deviceId: cloudIdentity.deviceId,
      sessionId: cloudIdentity.sessionId,
    },
    { merge: true },
  );

  await batch.commit();
  return {
    name,
    updatedAt: now,
    version,
  };
}

export async function writeCloudDraft(uid, resumeId, workspace, draft, trustedDevice, identity) {
  const workspaceRef = getWorkspaceDocRef(uid, trustedDevice);
  const draftRef = getResumeDocRef(uid, resumeId, trustedDevice);

  if (!workspaceRef || !draftRef) {
    return null;
  }

  const normalizedWorkspace = normalizeWorkspaceIndex(workspace);
  const name = normalizedWorkspace.meta[resumeId]?.name || 'Resume';
  const cloudIdentity = normalizeCloudIdentity(identity);
  const draftDoc = createCloudDraftDoc({ resumeId, name, draft, identity: cloudIdentity });

  validateCloudDraftPayload(draftDoc);

  const batch = writeBatch(workspaceRef.firestore);
  batch.set(draftRef, draftDoc, { merge: true });
  batch.set(
    workspaceRef,
    createCloudWorkspaceDoc({
      ...normalizedWorkspace,
      meta: {
        ...normalizedWorkspace.meta,
        [resumeId]: createWorkspaceResumeMeta(name, draftDoc.updatedAt),
      },
    }, cloudIdentity, draftDoc.updatedAt, draftDoc.version),
  );

  await batch.commit();
  return draftDoc;
}

export async function deleteCloudResume(uid, resumeId, workspace, trustedDevice, identity) {
  const workspaceRef = getWorkspaceDocRef(uid, trustedDevice);
  const draftRef = getResumeDocRef(uid, resumeId, trustedDevice);

  if (!workspaceRef || !draftRef) {
    return null;
  }

  const now = new Date().toISOString();
  const normalizedWorkspace = normalizeWorkspaceIndex(workspace);
  const batch = writeBatch(workspaceRef.firestore);

  batch.delete(draftRef);
  batch.set(workspaceRef, createCloudWorkspaceDoc(normalizedWorkspace, identity, now));

  await batch.commit();
  return now;
}

export async function importWorkspaceToCloud(uid, workspace, readDraft, trustedDevice, identity) {
  const workspaceRef = getWorkspaceDocRef(uid, trustedDevice);

  if (!workspaceRef) {
    return null;
  }

  const normalizedWorkspace = normalizeWorkspaceIndex(workspace);
  const cloudIdentity = normalizeCloudIdentity(identity);
  const cappedResumeIds = normalizedWorkspace.resumeIds.slice(0, CLOUD_WORKSPACE_RESUME_LIMIT);
  const now = new Date().toISOString();
  const batch = writeBatch(workspaceRef.firestore);
  const nextMeta = {};

  for (const resumeId of cappedResumeIds) {
    const draft = readDraft(resumeId);
    const name = normalizedWorkspace.meta[resumeId]?.name || 'Resume';
    const draftDoc = createCloudDraftDoc({
      resumeId,
      name,
      draft,
      identity: cloudIdentity,
    });

    validateCloudDraftPayload(draftDoc);
    nextMeta[resumeId] = createWorkspaceResumeMeta(name, draftDoc.updatedAt);
    batch.set(doc(collection(workspaceRef.firestore, 'users', uid, 'resumes'), resumeId), draftDoc, { merge: true });
  }

  const nextWorkspace = {
    activeResumeId: cappedResumeIds.includes(normalizedWorkspace.activeResumeId)
      ? normalizedWorkspace.activeResumeId
      : cappedResumeIds[0],
    resumeIds: cappedResumeIds,
    meta: nextMeta,
  };

  batch.set(workspaceRef, createCloudWorkspaceDoc(nextWorkspace, cloudIdentity, now));

  await batch.commit();
  return nextWorkspace;
}

export async function syncLocalWorkspaceToCloud(
  uid,
  cloudWorkspace,
  localWorkspace,
  readDraft,
  trustedDevice,
  identity,
  { mirroredResumeIds = [] } = {},
) {
  const workspaceRef = getWorkspaceDocRef(uid, trustedDevice);

  if (!workspaceRef) {
    return null;
  }

  const normalizedCloudWorkspace = normalizeWorkspaceIndex(cloudWorkspace);
  const normalizedLocalWorkspace = normalizeWorkspaceIndex(localWorkspace);
  const cloudIdentity = normalizeCloudIdentity(identity);
  const localResumeIds = new Set(normalizedLocalWorkspace.resumeIds);
  const safeDeletedIds = mirroredResumeIds.filter((resumeId) => (
    normalizedCloudWorkspace.resumeIds.includes(resumeId) && !localResumeIds.has(resumeId)
  ));
  const batch = writeBatch(workspaceRef.firestore);
  const nextWorkspace = {
    ...normalizedCloudWorkspace,
    resumeIds: normalizedCloudWorkspace.resumeIds.filter((resumeId) => !safeDeletedIds.includes(resumeId)),
    meta: { ...normalizedCloudWorkspace.meta },
  };
  let hasChanges = false;

  safeDeletedIds.forEach((resumeId) => {
    delete nextWorkspace.meta[resumeId];
    batch.delete(doc(collection(workspaceRef.firestore, 'users', uid, 'resumes'), resumeId));
    hasChanges = true;
  });

  const existingNames = nextWorkspace.resumeIds.map((resumeId) => nextWorkspace.meta[resumeId]?.name || '');

  for (const resumeId of normalizedLocalWorkspace.resumeIds) {
    const draft = readDraft(resumeId);

    if (!draft) {
      continue;
    }

    const localName = normalizedLocalWorkspace.meta[resumeId]?.name || 'Resume';
    const localUpdatedAt = Math.max(
      getTimestamp(draft.savedAt),
      getTimestamp(normalizedLocalWorkspace.meta[resumeId]?.updatedAt),
    );
    const cloudUpdatedAt = getTimestamp(normalizedCloudWorkspace.meta[resumeId]?.updatedAt);

    if (nextWorkspace.resumeIds.includes(resumeId)) {
      if (localUpdatedAt <= cloudUpdatedAt) {
        continue;
      }

      const draftDoc = createCloudDraftDoc({ resumeId, name: localName, draft, identity: cloudIdentity });
      validateCloudDraftPayload(draftDoc);
      batch.set(
        doc(collection(workspaceRef.firestore, 'users', uid, 'resumes'), resumeId),
        draftDoc,
        { merge: true },
      );
      nextWorkspace.meta[resumeId] = createWorkspaceResumeMeta(localName, draftDoc.updatedAt);
      hasChanges = true;
      continue;
    }

    if (nextWorkspace.resumeIds.length >= CLOUD_WORKSPACE_RESUME_LIMIT) {
      continue;
    }

    const nextName = existingNames.includes(localName)
      ? createDuplicateResumeName(localName, existingNames)
      : localName;
    const draftDoc = createCloudDraftDoc({ resumeId, name: nextName, draft, identity: cloudIdentity });

    validateCloudDraftPayload(draftDoc);
    existingNames.push(nextName);
    nextWorkspace.resumeIds.push(resumeId);
    nextWorkspace.meta[resumeId] = createWorkspaceResumeMeta(nextName, draftDoc.updatedAt);
    batch.set(
      doc(collection(workspaceRef.firestore, 'users', uid, 'resumes'), resumeId),
      draftDoc,
      { merge: true },
    );
    hasChanges = true;
  }

  nextWorkspace.activeResumeId = nextWorkspace.resumeIds.includes(normalizedLocalWorkspace.activeResumeId)
    ? normalizedLocalWorkspace.activeResumeId
    : nextWorkspace.resumeIds.includes(normalizedCloudWorkspace.activeResumeId)
      ? normalizedCloudWorkspace.activeResumeId
      : nextWorkspace.resumeIds[0] || '';

  const normalizedNextWorkspace = normalizeWorkspaceIndex(nextWorkspace);

  if (!hasChanges && normalizedNextWorkspace.activeResumeId === normalizedCloudWorkspace.activeResumeId) {
    return normalizedCloudWorkspace;
  }

  batch.set(workspaceRef, createCloudWorkspaceDoc(normalizedNextWorkspace, cloudIdentity));
  await batch.commit();
  return normalizedNextWorkspace;
}

export function subscribeCloudWorkspace(uid, trustedDevice, onNext, onError) {
  const workspaceRef = getWorkspaceDocRef(uid, trustedDevice);

  if (!workspaceRef) {
    return () => {};
  }

  return onSnapshot(
    workspaceRef,
    (snapshot) => {
      if (!snapshot.exists() || snapshot.metadata.hasPendingWrites) {
        return;
      }

      onNext(normalizeCloudWorkspace(snapshot.data()), snapshot.data());
    },
    onError,
  );
}

export function subscribeCloudDraft(uid, resumeId, trustedDevice, onNext, onError) {
  const draftRef = getResumeDocRef(uid, resumeId, trustedDevice);

  if (!draftRef) {
    return () => {};
  }

  return onSnapshot(
    draftRef,
    (snapshot) => {
      if (!snapshot.exists() || snapshot.metadata.hasPendingWrites || snapshot.data()?.deletedAt) {
        return;
      }

      onNext(cloudDocToDraft(snapshot.data()), snapshot.data());
    },
    onError,
  );
}

export async function removeCloudDraft(uid, resumeId, trustedDevice) {
  const draftRef = getResumeDocRef(uid, resumeId, trustedDevice);

  if (draftRef) {
    await deleteDoc(draftRef);
  }
}
