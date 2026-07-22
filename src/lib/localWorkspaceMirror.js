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

export function getLocalWorkspaceStorage() {
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

export function markLocalWorkspacePresent() {
  try {
    getLocalWorkspaceStorage()?.setItem(LOCAL_WORKSPACE_PRESENT_KEY, 'true');
  } catch {
    // IndexedDB remains the durable source of truth if localStorage is full.
  }
}

export function writeLocalStorageWorkspace(workspace) {
  try {
    getLocalWorkspaceStorage()?.setItem(
      WORKSPACE_INDEX_STORAGE_KEY,
      JSON.stringify(normalizeWorkspaceIndex(workspace)),
    );
    markLocalWorkspacePresent();
  } catch {
    markLocalWorkspacePresent();
  }
}

export function writeLocalStorageDraft(resumeId, draft) {
  try {
    getLocalWorkspaceStorage()?.setItem(
      createResumeStorageKey(resumeId),
      JSON.stringify(serializeDraftState(draft)),
    );
    markLocalWorkspacePresent();
  } catch {
    markLocalWorkspacePresent();
  }
}

export function removeLocalStorageDraft(resumeId) {
  try {
    getLocalWorkspaceStorage()?.removeItem(createResumeStorageKey(resumeId));
  } catch {
    // Best effort only.
  }
}

export function readLegacyDraftFromLocalStorage(resumeId) {
  const storage = getLocalWorkspaceStorage();

  if (!storage || !resumeId) {
    return null;
  }

  return normalizeDraftState(safeJsonParse(storage.getItem(createResumeStorageKey(resumeId))));
}

function readLegacyWorkspaceFromLocalStorage() {
  const storage = getLocalWorkspaceStorage();
  const fresh = createFreshWorkspaceDraft();

  if (!storage) {
    return fresh;
  }

  const rawWorkspace = safeJsonParse(storage.getItem(WORKSPACE_INDEX_STORAGE_KEY));

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
