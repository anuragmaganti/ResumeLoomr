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
  readStorageItem,
  removeStorageItem,
  writeStorageItem,
} from './browserStorage.js';

export function getLocalWorkspaceStorage() {
  return getBrowserLocalStorage();
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

function readLocalWorkspaceStorageValue(key) {
  return readStorageItem(getLocalWorkspaceStorage(), key);
}

export function markLocalWorkspacePresent() {
  return writeStorageItem(getLocalWorkspaceStorage(), LOCAL_WORKSPACE_PRESENT_KEY, 'true');
}

export function writeLocalStorageWorkspace(workspace) {
  const written = writeStorageItem(
    getLocalWorkspaceStorage(),
    WORKSPACE_INDEX_STORAGE_KEY,
    JSON.stringify(normalizeWorkspaceIndex(workspace)),
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

  const written = writeStorageItem(
    getLocalWorkspaceStorage(),
    createResumeStorageKey(resumeId),
    JSON.stringify(serializeDraftState(draft)),
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

  const draft = safeJsonParse(readLocalWorkspaceStorageValue(createResumeStorageKey(resumeId)));

  return draft ? normalizeDraftState(draft) : null;
}

function readLegacyWorkspaceFromLocalStorage() {
  const fresh = createFreshWorkspaceDraft();
  const rawWorkspace = safeJsonParse(readLocalWorkspaceStorageValue(WORKSPACE_INDEX_STORAGE_KEY));

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
