import {
  MAX_WORKSPACE_RESUMES,
  WORKSPACE_INDEX_STORAGE_KEY,
  createResumeStorageKey,
  normalizeSectionOrder,
  normalizeWorkspaceIndex,
} from './resume.js';

export const GUEST_WORKSPACE_CLOUD_MIRROR_BACKUP_KEY = 'resumeloomr:guest-backup-before-cloud-mirror:v1';

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
  const defaultResumeIds = normalizedWorkspace.resumeIds.slice(0, limit);
  const resumeIds = normalizedWorkspace.activeResumeId && !defaultResumeIds.includes(normalizedWorkspace.activeResumeId)
    ? [
        normalizedWorkspace.activeResumeId,
        ...defaultResumeIds.filter((resumeId) => resumeId !== normalizedWorkspace.activeResumeId).slice(0, limit - 1),
      ]
    : defaultResumeIds;
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

export function persistCloudWorkspaceMirror({ workspace, readDraft, storage } = {}) {
  const targetStorage = getDefaultStorage(storage);

  if (!targetStorage || !workspace) {
    return null;
  }

  backupGuestWorkspaceBeforeCloudMirror(targetStorage);
  const mirrorWorkspace = createGuestMirrorWorkspace(workspace);

  targetStorage.setItem(WORKSPACE_INDEX_STORAGE_KEY, JSON.stringify(mirrorWorkspace));

  mirrorWorkspace.resumeIds.forEach((resumeId) => {
    const draft = readDraft?.(resumeId);

    if (!draft) {
      return;
    }

    targetStorage.setItem(createResumeStorageKey(resumeId), JSON.stringify(serializeDraftState(draft)));
  });

  return mirrorWorkspace;
}

export function persistCloudDraftMirror({ resumeId, workspace, draft, storage } = {}) {
  const targetStorage = getDefaultStorage(storage);

  if (!targetStorage || !resumeId || !workspace) {
    return null;
  }

  backupGuestWorkspaceBeforeCloudMirror(targetStorage);
  const mirrorWorkspace = createGuestMirrorWorkspace(workspace);

  targetStorage.setItem(WORKSPACE_INDEX_STORAGE_KEY, JSON.stringify(mirrorWorkspace));

  if (draft && mirrorWorkspace.resumeIds.includes(resumeId)) {
    targetStorage.setItem(createResumeStorageKey(resumeId), JSON.stringify(serializeDraftState(draft)));
  }

  return mirrorWorkspace;
}
