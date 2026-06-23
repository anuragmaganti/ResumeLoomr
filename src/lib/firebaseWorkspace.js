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

export const CLOUD_WORKSPACE_RESUME_LIMIT = 25;
export const CLOUD_WORKSPACE_SCHEMA_VERSION = 1;
export const CLOUD_IMPORT_PREFIX = 'resumeloomr:firebase-imported:';
export const CLOUD_TRUSTED_DEVICE_KEY = 'resumeloomr:firebase-trusted-device';
export const CLOUD_DEVICE_ID_KEY = 'resumeloomr:firebase-device-id';

export function getCloudDeviceId() {
  if (typeof window === 'undefined') {
    return 'server';
  }

  const existingDeviceId = window.localStorage.getItem(CLOUD_DEVICE_ID_KEY);

  if (existingDeviceId) {
    return existingDeviceId;
  }

  const nextDeviceId = globalThis.crypto?.randomUUID?.() ?? `device-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(CLOUD_DEVICE_ID_KEY, nextDeviceId);
  return nextDeviceId;
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

export function hasImportedGuestWorkspace(uid) {
  return typeof window !== 'undefined' && window.localStorage.getItem(getCloudImportKey(uid)) === 'true';
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

export function createCloudDraftDoc({ resumeId, name, draft, deviceId, deletedAt = null }) {
  const payload = createDraftPayload({
    resume: draft.resume,
    template: draft.template,
    sectionOrder: draft.sectionOrder,
  });

  return {
    schemaVersion: CLOUD_WORKSPACE_SCHEMA_VERSION,
    resumeId,
    name,
    template: payload.template,
    sectionOrder: payload.sectionOrder,
    resume: payload.resume,
    savedAt: payload.savedAt,
    updatedAt: payload.savedAt,
    version: Date.now(),
    deviceId,
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

export async function writeCloudWorkspace(uid, workspace, trustedDevice, deviceId) {
  const workspaceRef = getWorkspaceDocRef(uid, trustedDevice);

  if (!workspaceRef) {
    return null;
  }

  const now = new Date().toISOString();
  const normalizedWorkspace = normalizeWorkspaceIndex(workspace);

  await setDoc(workspaceRef, {
    schemaVersion: CLOUD_WORKSPACE_SCHEMA_VERSION,
    activeResumeId: normalizedWorkspace.activeResumeId,
    resumeIds: normalizedWorkspace.resumeIds.slice(0, CLOUD_WORKSPACE_RESUME_LIMIT),
    meta: normalizedWorkspace.meta,
    updatedAt: now,
    version: Date.now(),
    deviceId,
  }, { merge: true });

  return {
    ...normalizedWorkspace,
    updatedAt: now,
  };
}

export async function writeCloudDraft(uid, resumeId, workspace, draft, trustedDevice, deviceId) {
  const workspaceRef = getWorkspaceDocRef(uid, trustedDevice);
  const draftRef = getResumeDocRef(uid, resumeId, trustedDevice);

  if (!workspaceRef || !draftRef) {
    return null;
  }

  const normalizedWorkspace = normalizeWorkspaceIndex(workspace);
  const name = normalizedWorkspace.meta[resumeId]?.name || 'Resume';
  const draftDoc = createCloudDraftDoc({ resumeId, name, draft, deviceId });

  const batch = writeBatch(workspaceRef.firestore);
  batch.set(draftRef, draftDoc, { merge: true });
  batch.set(workspaceRef, {
    schemaVersion: CLOUD_WORKSPACE_SCHEMA_VERSION,
    activeResumeId: normalizedWorkspace.activeResumeId,
    resumeIds: normalizedWorkspace.resumeIds.slice(0, CLOUD_WORKSPACE_RESUME_LIMIT),
    meta: {
      ...normalizedWorkspace.meta,
      [resumeId]: createWorkspaceResumeMeta(name, draftDoc.updatedAt),
    },
    updatedAt: draftDoc.updatedAt,
    version: draftDoc.version,
    deviceId,
  }, { merge: true });

  await batch.commit();
  return draftDoc;
}

export async function deleteCloudResume(uid, resumeId, workspace, trustedDevice, deviceId) {
  const workspaceRef = getWorkspaceDocRef(uid, trustedDevice);
  const draftRef = getResumeDocRef(uid, resumeId, trustedDevice);

  if (!workspaceRef || !draftRef) {
    return null;
  }

  const now = new Date().toISOString();
  const normalizedWorkspace = normalizeWorkspaceIndex(workspace);
  const batch = writeBatch(workspaceRef.firestore);

  batch.set(draftRef, {
    deletedAt: now,
    updatedAt: now,
    version: Date.now(),
    deviceId,
  }, { merge: true });
  batch.set(workspaceRef, {
    schemaVersion: CLOUD_WORKSPACE_SCHEMA_VERSION,
    activeResumeId: normalizedWorkspace.activeResumeId,
    resumeIds: normalizedWorkspace.resumeIds,
    meta: normalizedWorkspace.meta,
    updatedAt: now,
    version: Date.now(),
    deviceId,
  }, { merge: true });

  await batch.commit();
  return now;
}

export async function importWorkspaceToCloud(uid, workspace, readDraft, trustedDevice, deviceId) {
  const workspaceRef = getWorkspaceDocRef(uid, trustedDevice);

  if (!workspaceRef) {
    return null;
  }

  const normalizedWorkspace = normalizeWorkspaceIndex(workspace);
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
      deviceId,
    });

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

  batch.set(workspaceRef, {
    schemaVersion: CLOUD_WORKSPACE_SCHEMA_VERSION,
    ...nextWorkspace,
    updatedAt: now,
    version: Date.now(),
    deviceId,
  }, { merge: true });

  await batch.commit();
  return nextWorkspace;
}

export async function appendWorkspaceToCloud(uid, cloudWorkspace, localWorkspace, readDraft, trustedDevice, deviceId) {
  const workspaceRef = getWorkspaceDocRef(uid, trustedDevice);

  if (!workspaceRef) {
    return null;
  }

  const normalizedCloudWorkspace = normalizeWorkspaceIndex(cloudWorkspace);
  const normalizedLocalWorkspace = normalizeWorkspaceIndex(localWorkspace);
  const remainingSlots = CLOUD_WORKSPACE_RESUME_LIMIT - normalizedCloudWorkspace.resumeIds.length;

  if (remainingSlots <= 0) {
    return normalizedCloudWorkspace;
  }

  const existingNames = normalizedCloudWorkspace.resumeIds.map((resumeId) => normalizedCloudWorkspace.meta[resumeId]?.name || '');
  const importedIds = normalizedLocalWorkspace.resumeIds.slice(0, remainingSlots);
  const batch = writeBatch(workspaceRef.firestore);
  const nextWorkspace = {
    ...normalizedCloudWorkspace,
    resumeIds: [...normalizedCloudWorkspace.resumeIds],
    meta: { ...normalizedCloudWorkspace.meta },
  };

  for (const resumeId of importedIds) {
    const draft = readDraft(resumeId);
    const sourceName = normalizedLocalWorkspace.meta[resumeId]?.name || 'Resume';
    const nextName = existingNames.includes(sourceName)
      ? createDuplicateResumeName(sourceName, existingNames)
      : sourceName;

    existingNames.push(nextName);
    nextWorkspace.resumeIds.push(resumeId);
    nextWorkspace.meta[resumeId] = createWorkspaceResumeMeta(nextName, new Date().toISOString());
    batch.set(
      doc(collection(workspaceRef.firestore, 'users', uid, 'resumes'), resumeId),
      createCloudDraftDoc({ resumeId, name: nextName, draft, deviceId }),
      { merge: true },
    );
  }

  batch.set(workspaceRef, {
    schemaVersion: CLOUD_WORKSPACE_SCHEMA_VERSION,
    ...nextWorkspace,
    updatedAt: new Date().toISOString(),
    version: Date.now(),
    deviceId,
  }, { merge: true });

  await batch.commit();
  return nextWorkspace;
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
