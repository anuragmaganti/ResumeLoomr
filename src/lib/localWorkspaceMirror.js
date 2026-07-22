import {
  normalizeDraftState,
  serializeDraftState,
} from './draftState.js';
import {
  LOCAL_WORKSPACE_PRESENT_KEY,
  WORKSPACE_INDEX_STORAGE_KEY,
  createResumeStorageKey,
} from './localWorkspaceKeys.js';
import { normalizeWorkspaceIndex } from './workspace.js';
import { createBlankDraftState, createFreshWorkspaceDraft } from './workspaceDraft.js';
import {
  getBrowserLocalStorage,
  readJsonStorageItem,
  removeStorageItem,
  writeJsonStorageItem,
  writeStorageItem,
} from './browserStorage.js';

export function getLocalWorkspaceStorage() {
  return getBrowserLocalStorage();
}

export function markLocalWorkspacePresent() {
  return writeStorageItem(getLocalWorkspaceStorage(), LOCAL_WORKSPACE_PRESENT_KEY, 'true');
}

export function writeLocalStorageWorkspace(workspace) {
  const written = writeJsonStorageItem(
    getLocalWorkspaceStorage(),
    WORKSPACE_INDEX_STORAGE_KEY,
    normalizeWorkspaceIndex(workspace),
  );

  if (written) {
    markLocalWorkspacePresent();
  }

  return written;
}

export function writeLocalStorageDraft(resumeId, draft) {
  if (!resumeId) {
    return false;
  }

  const written = writeJsonStorageItem(
    getLocalWorkspaceStorage(),
    createResumeStorageKey(resumeId),
    serializeDraftState(draft),
  );

  if (written) {
    markLocalWorkspacePresent();
  }

  return written;
}

export function removeLocalStorageDraft(resumeId) {
  if (!resumeId) {
    return false;
  }

  return removeStorageItem(getLocalWorkspaceStorage(), createResumeStorageKey(resumeId));
}

export function readLegacyDraftFromLocalStorage(resumeId) {
  if (!resumeId) {
    return null;
  }

  const draft = readJsonStorageItem(getLocalWorkspaceStorage(), createResumeStorageKey(resumeId));

  return draft ? normalizeDraftState(draft) : null;
}

function readLegacyWorkspaceFromLocalStorage() {
  const fresh = createFreshWorkspaceDraft();
  const rawWorkspace = readJsonStorageItem(getLocalWorkspaceStorage(), WORKSPACE_INDEX_STORAGE_KEY);

  if (!rawWorkspace) {
    return fresh;
  }

  const workspace = normalizeWorkspaceIndex(rawWorkspace);

  if (workspace.resumeIds.length === 0) {
    return fresh;
  }

  const activeResumeId = workspace.activeResumeId || workspace.resumeIds[0];
  const draft = readLegacyDraftFromLocalStorage(activeResumeId) || createBlankDraftState();

  return {
    workspace,
    activeResumeId,
    draft,
  };
}

export function readLegacyWorkspaceSnapshot() {
  const legacy = readLegacyWorkspaceFromLocalStorage();

  return {
    workspace: normalizeWorkspaceIndex(legacy.workspace),
    activeResumeId: legacy.activeResumeId || legacy.workspace.activeResumeId,
    draft: normalizeDraftState(legacy.draft),
  };
}
