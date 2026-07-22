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

  try {
    return window.localStorage;
  } catch {
    return null;
  }
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
    const storage = getLocalWorkspaceStorage();

    if (!storage) {
      return false;
    }

    storage.setItem(LOCAL_WORKSPACE_PRESENT_KEY, 'true');
    return true;
  } catch {
    // IndexedDB remains the durable source of truth if localStorage is full.
    return false;
  }
}

export function writeLocalStorageWorkspace(workspace) {
  try {
    const storage = getLocalWorkspaceStorage();

    if (!storage) {
      return false;
    }

    storage.setItem(
      WORKSPACE_INDEX_STORAGE_KEY,
      JSON.stringify(normalizeWorkspaceIndex(workspace)),
    );
    markLocalWorkspacePresent();
    return true;
  } catch {
    return false;
  }
}

export function writeLocalStorageDraft(resumeId, draft) {
  if (!resumeId) {
    return false;
  }

  try {
    const storage = getLocalWorkspaceStorage();

    if (!storage) {
      return false;
    }

    storage.setItem(
      createResumeStorageKey(resumeId),
      JSON.stringify(serializeDraftState(draft)),
    );
    markLocalWorkspacePresent();
    return true;
  } catch {
    return false;
  }
}

export function removeLocalStorageDraft(resumeId) {
  if (!resumeId) {
    return false;
  }

  try {
    const storage = getLocalWorkspaceStorage();

    if (!storage) {
      return false;
    }

    storage.removeItem(createResumeStorageKey(resumeId));
    return true;
  } catch {
    return false;
  }
}

export function readLegacyDraftFromLocalStorage(resumeId) {
  const storage = getLocalWorkspaceStorage();

  if (!storage || !resumeId) {
    return null;
  }

  try {
    const draft = safeJsonParse(storage.getItem(createResumeStorageKey(resumeId)));

    return draft ? normalizeDraftState(draft) : null;
  } catch {
    return null;
  }
}

function readLegacyWorkspaceFromLocalStorage() {
  const storage = getLocalWorkspaceStorage();
  const fresh = createFreshWorkspaceDraft();

  if (!storage) {
    return fresh;
  }

  let rawWorkspace = null;

  try {
    rawWorkspace = safeJsonParse(storage.getItem(WORKSPACE_INDEX_STORAGE_KEY));
  } catch {
    return fresh;
  }

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
