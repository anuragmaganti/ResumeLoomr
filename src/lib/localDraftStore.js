import {
  DRAFT_STORAGE_KEY,
  DEFAULT_TEMPLATE,
  SECTION_IDS,
  WORKSPACE_INDEX_STORAGE_KEY,
  createEmptyResume,
  createFreshWorkspaceDraft,
  createResumeStorageKey,
  createWorkspaceFromLegacyDraft,
  normalizeDraftPayload,
  normalizeSectionOrder,
  normalizeWorkspaceIndex,
} from './resume.js';
import {
  createGuestMirrorWorkspace,
  refreshCloudMirrorManifest,
} from './localWorkspaceMirror.js';

export function createBlankDraftState() {
  return {
    resume: createEmptyResume(),
    template: DEFAULT_TEMPLATE,
    sectionOrder: SECTION_IDS,
    savedAt: null,
  };
}

export function serializeDraftState(draft) {
  return {
    version: 2,
    savedAt: draft.savedAt ?? null,
    template: draft.template,
    sectionOrder: normalizeSectionOrder(draft.sectionOrder),
    resume: draft.resume,
  };
}

export function persistWorkspaceIndex(workspace) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(WORKSPACE_INDEX_STORAGE_KEY, JSON.stringify(workspace));
}

export function persistExistingDraftState(resumeId, draft) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(createResumeStorageKey(resumeId), JSON.stringify(serializeDraftState(draft)));
}

export function readStoredResumeDraft(resumeId) {
  return readStoredResumeDraftOrNull(resumeId) || createBlankDraftState();
}

export function readStoredResumeDraftOrNull(resumeId) {
  if (typeof window === 'undefined' || !resumeId) {
    return null;
  }

  try {
    const rawDraft = window.localStorage.getItem(createResumeStorageKey(resumeId));

    if (!rawDraft) {
      return null;
    }

    const parsedDraft = JSON.parse(rawDraft);
    const normalizedDraft = normalizeDraftPayload(parsedDraft);

    return {
      resume: normalizedDraft.resume,
      template: normalizedDraft.template,
      sectionOrder: normalizedDraft.sectionOrder,
      savedAt: parsedDraft.savedAt || null,
    };
  } catch {
    return null;
  }
}

export function readStoredWorkspaceSnapshot() {
  const storedWorkspace = loadStoredWorkspace();
  const workspace = normalizeWorkspaceIndex(storedWorkspace.workspace);

  return {
    workspace,
    activeResumeId: workspace.activeResumeId,
    draft: storedWorkspace.draft,
    readDraft(resumeId) {
      return readStoredResumeDraft(resumeId);
    },
  };
}

export function getDraftEditorSectionIds(draft) {
  const blockIds = Array.isArray(draft?.resume?.sections)
    ? draft.resume.sections.map((section) => section.id).filter(Boolean)
    : SECTION_IDS.filter((sectionId) => sectionId !== 'personal');

  return ['personal', ...blockIds];
}

export function loadStoredWorkspace() {
  if (typeof window === 'undefined') {
    return {
      ...createFreshWorkspaceDraft(),
      needsInitialCommit: false,
    };
  }

  try {
    const rawWorkspace = window.localStorage.getItem(WORKSPACE_INDEX_STORAGE_KEY);

    if (rawWorkspace) {
      const normalizedWorkspace = normalizeWorkspaceIndex(JSON.parse(rawWorkspace));

      if (normalizedWorkspace.resumeIds.length === 0) {
        return {
          ...createFreshWorkspaceDraft(),
          needsInitialCommit: true,
        };
      }

      const localWorkspace = createGuestMirrorWorkspace(normalizedWorkspace);
      const activeResumeId = localWorkspace.activeResumeId || localWorkspace.resumeIds[0];

      if (
        localWorkspace.resumeIds.length !== normalizedWorkspace.resumeIds.length ||
        localWorkspace.activeResumeId !== normalizedWorkspace.activeResumeId ||
        localWorkspace.resumeIds.some((resumeId, index) => resumeId !== normalizedWorkspace.resumeIds[index])
      ) {
        persistWorkspaceIndex(localWorkspace);
      }

      refreshCloudMirrorManifest(localWorkspace);

      return {
        workspace: localWorkspace,
        activeResumeId,
        draft: readStoredResumeDraft(activeResumeId),
        needsInitialCommit: false,
      };
    }

    const rawLegacyDraft = window.localStorage.getItem(DRAFT_STORAGE_KEY);

    if (rawLegacyDraft) {
      return {
        ...createWorkspaceFromLegacyDraft(JSON.parse(rawLegacyDraft)),
        needsInitialCommit: true,
      };
    }
  } catch {
    return {
      ...createFreshWorkspaceDraft(),
      needsInitialCommit: true,
    };
  }

  return {
    ...createFreshWorkspaceDraft(),
    needsInitialCommit: true,
  };
}
