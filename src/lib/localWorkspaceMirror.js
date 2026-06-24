import {
  MAX_WORKSPACE_RESUMES,
  WORKSPACE_INDEX_STORAGE_KEY,
  createResumeStorageKey,
  normalizeSectionOrder,
  normalizeWorkspaceIndex,
} from './resume.js';

export const GUEST_WORKSPACE_CLOUD_MIRROR_BACKUP_KEY = 'resumeloomr:guest-backup-before-cloud-mirror:v1';
export const GUEST_WORKSPACE_CLOUD_MIRROR_MANIFEST_KEY = 'resumeloomr:cloud-mirror-manifest:v1';

function serializeDraftState(draft) {
  return {
    version: 2,
    savedAt: draft?.savedAt ?? null,
    template: draft?.template,
    sectionOrder: normalizeSectionOrder(draft?.sectionOrder),
    resume: draft?.resume,
  };
}

function getDefaultStorage(storage) {
  if (storage) {
    return storage;
  }

  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
}

function safeJsonParse(rawValue) {
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
}

export function createGuestMirrorWorkspace(workspace, limit = MAX_WORKSPACE_RESUMES) {
  const normalizedWorkspace = normalizeWorkspaceIndex(workspace);
  const resumeIds = normalizedWorkspace.resumeIds.slice(0, limit);
  const activeResumeId = resumeIds.includes(normalizedWorkspace.activeResumeId)
    ? normalizedWorkspace.activeResumeId
    : resumeIds[0] || '';

  return normalizeWorkspaceIndex({
    activeResumeId,
    resumeIds,
    meta: Object.fromEntries(
      resumeIds.map((resumeId) => [resumeId, normalizedWorkspace.meta[resumeId]]),
    ),
  });
}

function writeCloudMirrorManifest({ uid, workspace, storage }) {
  const targetStorage = getDefaultStorage(storage);

  if (!targetStorage || !uid || !workspace) {
    return null;
  }

  const normalizedWorkspace = normalizeWorkspaceIndex(workspace);
  const manifest = {
    uid,
    activeResumeId: normalizedWorkspace.activeResumeId,
    resumeIds: normalizedWorkspace.resumeIds,
    updatedAt: new Date().toISOString(),
  };

  targetStorage.setItem(GUEST_WORKSPACE_CLOUD_MIRROR_MANIFEST_KEY, JSON.stringify(manifest));
  return manifest;
}

export function readCloudMirrorManifest(uid, storage) {
  const targetStorage = getDefaultStorage(storage);

  if (!targetStorage || !uid) {
    return null;
  }

  const manifest = safeJsonParse(targetStorage.getItem(GUEST_WORKSPACE_CLOUD_MIRROR_MANIFEST_KEY));

  if (manifest?.uid !== uid || !Array.isArray(manifest.resumeIds)) {
    return null;
  }

  return {
    uid: manifest.uid,
    activeResumeId: typeof manifest.activeResumeId === 'string' ? manifest.activeResumeId : '',
    resumeIds: manifest.resumeIds.filter((resumeId) => typeof resumeId === 'string' && resumeId.trim() !== ''),
    updatedAt: typeof manifest.updatedAt === 'string' ? manifest.updatedAt : '',
  };
}

export function backupGuestWorkspaceBeforeCloudMirror(storage) {
  const targetStorage = getDefaultStorage(storage);

  if (!targetStorage || targetStorage.getItem(GUEST_WORKSPACE_CLOUD_MIRROR_BACKUP_KEY)) {
    return null;
  }

  const workspaceRaw = targetStorage.getItem(WORKSPACE_INDEX_STORAGE_KEY);
  const workspace = normalizeWorkspaceIndex(safeJsonParse(workspaceRaw));
  const drafts = Object.fromEntries(
    workspace.resumeIds.map((resumeId) => [
      resumeId,
      targetStorage.getItem(createResumeStorageKey(resumeId)),
    ]),
  );
  const backup = {
    createdAt: new Date().toISOString(),
    workspaceRaw,
    drafts,
  };

  targetStorage.setItem(GUEST_WORKSPACE_CLOUD_MIRROR_BACKUP_KEY, JSON.stringify(backup));
  return backup;
}

export function persistCloudWorkspaceMirror({ uid, workspace, readDraft, storage } = {}) {
  const targetStorage = getDefaultStorage(storage);

  if (!targetStorage || !workspace) {
    return null;
  }

  backupGuestWorkspaceBeforeCloudMirror(targetStorage);
  const mirrorWorkspace = createGuestMirrorWorkspace(workspace);

  targetStorage.setItem(WORKSPACE_INDEX_STORAGE_KEY, JSON.stringify(mirrorWorkspace));
  writeCloudMirrorManifest({ uid, workspace: mirrorWorkspace, storage: targetStorage });

  mirrorWorkspace.resumeIds.forEach((resumeId) => {
    const draft = readDraft?.(resumeId);

    if (!draft) {
      return;
    }

    targetStorage.setItem(createResumeStorageKey(resumeId), JSON.stringify(serializeDraftState(draft)));
  });

  return mirrorWorkspace;
}

export function persistCloudDraftMirror({ uid, resumeId, workspace, draft, storage } = {}) {
  const targetStorage = getDefaultStorage(storage);

  if (!targetStorage || !resumeId || !workspace) {
    return null;
  }

  backupGuestWorkspaceBeforeCloudMirror(targetStorage);
  const mirrorWorkspace = createGuestMirrorWorkspace(workspace);

  targetStorage.setItem(WORKSPACE_INDEX_STORAGE_KEY, JSON.stringify(mirrorWorkspace));
  writeCloudMirrorManifest({ uid, workspace: mirrorWorkspace, storage: targetStorage });

  if (draft && mirrorWorkspace.resumeIds.includes(resumeId)) {
    targetStorage.setItem(createResumeStorageKey(resumeId), JSON.stringify(serializeDraftState(draft)));
  }

  return mirrorWorkspace;
}
