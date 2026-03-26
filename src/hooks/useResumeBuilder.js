import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  DRAFT_STORAGE_KEY,
  DEFAULT_TEMPLATE,
  SECTION_IDS,
  TEMPLATE_OPTIONS,
  WORKSPACE_INDEX_STORAGE_KEY,
  addCollectionEntry,
  addCollectionTextListItem,
  addActivity,
  addEducationCustomSection,
  addEducation,
  addExperience,
  createDraftPayload,
  createDuplicateResumeName,
  createEmptyResume,
  createFreshWorkspaceDraft,
  createResumeStorageKey,
  createWorkspaceFromLegacyDraft,
  createWorkspaceResumeId,
  createWorkspaceResumeMeta,
  createNextResumeName,
  getPreviewModel,
  moveCollectionEntry,
  moveCollectionTextListItem,
  moveActivity,
  moveEducationCustomSection,
  moveEducation,
  moveExperience,
  moveSectionOrder,
  normalizeDraftPayload,
  normalizeSectionOrder,
  normalizeWorkspaceIndex,
  removeCollectionEntry,
  removeCollectionTextListItem,
  removeActivity,
  removeEducationCustomSection,
  removeEducation,
  removeExperience,
  updateCollectionEntry,
  updateCollectionTextList,
  updateActivity,
  updateEducationCustomSection,
  updateEducationField,
  updateExperienceField,
  updatePersonalField,
  updateResumeSetting as updateResumeSettingValue,
  updateSectionTitle,
  validateResume,
} from '../lib/resume.js';

function createBlankDraftState() {
  return {
    resume: createEmptyResume(),
    template: DEFAULT_TEMPLATE,
    sectionOrder: SECTION_IDS,
    savedAt: null,
  };
}

function serializeDraftState(draft) {
  return {
    version: 2,
    savedAt: draft.savedAt ?? null,
    template: draft.template,
    sectionOrder: normalizeSectionOrder(draft.sectionOrder),
    resume: draft.resume,
  };
}

function persistWorkspaceIndex(workspace) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(WORKSPACE_INDEX_STORAGE_KEY, JSON.stringify(workspace));
}

function persistExistingDraftState(resumeId, draft) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(createResumeStorageKey(resumeId), JSON.stringify(serializeDraftState(draft)));
}

function readStoredResumeDraft(resumeId) {
  if (typeof window === 'undefined' || !resumeId) {
    return createBlankDraftState();
  }

  try {
    const rawDraft = window.localStorage.getItem(createResumeStorageKey(resumeId));

    if (!rawDraft) {
      return createBlankDraftState();
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
    return createBlankDraftState();
  }
}

function loadStoredWorkspace() {
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

      const activeResumeId = normalizedWorkspace.activeResumeId || normalizedWorkspace.resumeIds[0];

      return {
        workspace: {
          ...normalizedWorkspace,
          activeResumeId,
        },
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

function formatSavedAt(savedAt) {
  if (!savedAt) {
    return 'Autosave ready';
  }

  const date = new Date(savedAt);

  if (Number.isNaN(date.getTime())) {
    return 'Autosave ready';
  }

  return `Saved ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

function withWorkspaceResumeMeta(workspace, resumeId, updates) {
  if (!workspace.meta[resumeId]) {
    return workspace;
  }

  return {
    ...workspace,
    meta: {
      ...workspace.meta,
      [resumeId]: {
        ...workspace.meta[resumeId],
        ...updates,
      },
    },
  };
}

function withoutWorkspaceResume(workspace, resumeId) {
  const nextResumeIds = workspace.resumeIds.filter((id) => id !== resumeId);
  const nextMeta = { ...workspace.meta };
  delete nextMeta[resumeId];

  return {
    activeResumeId: nextResumeIds[0] || '',
    resumeIds: nextResumeIds,
    meta: nextMeta,
  };
}

export function useResumeBuilder() {
  const initialWorkspaceState = useMemo(() => loadStoredWorkspace(), []);
  const [workspace, setWorkspace] = useState(initialWorkspaceState.workspace);
  const [resume, setResume] = useState(initialWorkspaceState.draft.resume);
  const [template, setTemplate] = useState(initialWorkspaceState.draft.template);
  const [sectionOrder, setSectionOrder] = useState(initialWorkspaceState.draft.sectionOrder);
  const [activeTab, setActiveTab] = useState('personal');
  const [mobileView, setMobileView] = useState('editor');
  const [touched, setTouched] = useState({});
  const [showAllErrors, setShowAllErrors] = useState(false);
  const [saveState, setSaveState] = useState('idle');
  const [savedAt, setSavedAt] = useState(initialWorkspaceState.draft.savedAt);
  const [notice, setNotice] = useState(null);
  const hasMounted = useRef(false);
  const skipNextAutosaveRef = useRef(false);
  const printViewRef = useRef(null);
  const activeResumeId = workspace.activeResumeId;
  const errors = useMemo(() => validateResume(resume), [resume]);
  const previewModel = useMemo(() => getPreviewModel(resume), [resume]);
  const resumeList = useMemo(() => (
    workspace.resumeIds.map((resumeId) => ({
      id: resumeId,
      name: workspace.meta[resumeId]?.name || '',
      updatedAt: workspace.meta[resumeId]?.updatedAt || '',
    }))
  ), [workspace]);

  useEffect(() => {
    if (!initialWorkspaceState.needsInitialCommit || !activeResumeId) {
      return;
    }

    persistWorkspaceIndex(initialWorkspaceState.workspace);
    persistExistingDraftState(activeResumeId, initialWorkspaceState.draft);
  }, [activeResumeId, initialWorkspaceState]);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }

    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }

    const timeoutId = window.setTimeout(() => {
      try {
        const payload = createDraftPayload({ resume, template, sectionOrder });
        window.localStorage.setItem(createResumeStorageKey(activeResumeId), JSON.stringify(payload));
        setSavedAt(payload.savedAt);
        setSaveState('saved');
        setWorkspace((currentWorkspace) => {
          const nextWorkspace = withWorkspaceResumeMeta(currentWorkspace, activeResumeId, { updatedAt: payload.savedAt });
          persistWorkspaceIndex(nextWorkspace);
          return nextWorkspace;
        });
      } catch {
        setSaveState('error');
        setNotice({ tone: 'error', message: 'Autosave failed in this browser session.' });
      }
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [activeResumeId, resume, sectionOrder, template]);

  useEffect(() => {
    function handleAfterPrint() {
      if (printViewRef.current !== null) {
        const previousView = printViewRef.current;
        printViewRef.current = null;
        setMobileView(previousView);
      }
    }

    window.addEventListener('afterprint', handleAfterPrint);

    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  function resetValidationState() {
    setTouched({});
    setShowAllErrors(false);
  }

  function loadDraftIntoEditor(nextDraft, { focusPersonal = false } = {}) {
    skipNextAutosaveRef.current = true;
    setResume(nextDraft.resume);
    setTemplate(nextDraft.template);
    setSectionOrder(nextDraft.sectionOrder);
    setSavedAt(nextDraft.savedAt);
    setSaveState(nextDraft.savedAt ? 'saved' : 'idle');
    resetValidationState();

    if (focusPersonal) {
      setActiveTab('personal');
    }
  }

  function persistActiveDraftImmediately() {
    if (!activeResumeId || typeof window === 'undefined') {
      return null;
    }

    try {
      const payload = createDraftPayload({ resume, template, sectionOrder });
      window.localStorage.setItem(createResumeStorageKey(activeResumeId), JSON.stringify(payload));
      setSavedAt(payload.savedAt);
      setSaveState('saved');
      return payload;
    } catch {
      setSaveState('error');
      setNotice({ tone: 'error', message: 'Autosave failed in this browser session.' });
      return null;
    }
  }

  function commitWorkspace(nextWorkspace) {
    persistWorkspaceIndex(nextWorkspace);
    setWorkspace(nextWorkspace);
  }

  function updateResume(transform) {
    setSaveState('saving');
    setResume((currentResume) => transform(currentResume));
  }

  function changeTemplate(nextTemplate) {
    setSaveState('saving');
    setTemplate(nextTemplate);
  }

  function moveSection(sectionId, direction) {
    setSaveState('saving');
    setSectionOrder((currentOrder) => moveSectionOrder(currentOrder, sectionId, direction));
  }

  function markTouched(path) {
    setTouched((currentTouched) => (
      currentTouched[path]
        ? currentTouched
        : { ...currentTouched, [path]: true }
    ));
  }

  function revealAllErrors() {
    setShowAllErrors(true);
    setTouched((currentTouched) => {
      const nextTouched = { ...currentTouched };
      Object.keys(errors).forEach((path) => {
        nextTouched[path] = true;
      });
      return nextTouched;
    });
  }

  function getFieldError(path) {
    return errors[path] && (showAllErrors || touched[path]) ? errors[path] : '';
  }

  function printResume() {
    revealAllErrors();
    printViewRef.current = mobileView;

    flushSync(() => {
      setMobileView('preview');
    });

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.print();
      });
    });
  }

  function setActiveResume(nextResumeId) {
    if (!workspace.resumeIds.includes(nextResumeId) || nextResumeId === activeResumeId) {
      return;
    }

    const persistedPayload = persistActiveDraftImmediately();

    if (!persistedPayload && activeResumeId) {
      return;
    }

    const nextWorkspaceBase = persistedPayload
      ? withWorkspaceResumeMeta(workspace, activeResumeId, { updatedAt: persistedPayload.savedAt })
      : workspace;
    const nextWorkspace = {
      ...nextWorkspaceBase,
      activeResumeId: nextResumeId,
    };

    commitWorkspace(nextWorkspace);
    loadDraftIntoEditor(readStoredResumeDraft(nextResumeId));
  }

  function createResume() {
    const persistedPayload = persistActiveDraftImmediately();

    if (!persistedPayload && activeResumeId) {
      return;
    }

    const existingNames = workspace.resumeIds.map((resumeId) => workspace.meta[resumeId]?.name || '');
    const nextResumeId = createWorkspaceResumeId();
    const nextResumeName = createNextResumeName(existingNames);
    const nextDraft = createBlankDraftState();

    persistExistingDraftState(nextResumeId, nextDraft);

    const nextWorkspace = {
      ...(persistedPayload
        ? withWorkspaceResumeMeta(workspace, activeResumeId, { updatedAt: persistedPayload.savedAt })
        : workspace),
      activeResumeId: nextResumeId,
      resumeIds: [...workspace.resumeIds, nextResumeId],
      meta: {
        ...workspace.meta,
        [nextResumeId]: createWorkspaceResumeMeta(nextResumeName),
      },
    };

    commitWorkspace(nextWorkspace);
    loadDraftIntoEditor(nextDraft, { focusPersonal: true });
  }

  function duplicateActiveResume() {
    const persistedPayload = persistActiveDraftImmediately();

    if (!persistedPayload && activeResumeId) {
      return;
    }

    const nextResumeId = createWorkspaceResumeId();
    const existingNames = workspace.resumeIds.map((resumeId) => workspace.meta[resumeId]?.name || '');
    const sourceName = workspace.meta[activeResumeId]?.name || '';
    const duplicateName = createDuplicateResumeName(sourceName, existingNames);
    const duplicatedDraft = {
      resume,
      template,
      sectionOrder,
      savedAt: null,
    };

    const duplicatePayload = createDraftPayload({
      resume: duplicatedDraft.resume,
      template: duplicatedDraft.template,
      sectionOrder: duplicatedDraft.sectionOrder,
    });
    window.localStorage.setItem(createResumeStorageKey(nextResumeId), JSON.stringify(duplicatePayload));

    const nextWorkspace = {
      ...(persistedPayload
        ? withWorkspaceResumeMeta(workspace, activeResumeId, { updatedAt: persistedPayload.savedAt })
        : workspace),
      activeResumeId: nextResumeId,
      resumeIds: [...workspace.resumeIds, nextResumeId],
      meta: {
        ...workspace.meta,
        [nextResumeId]: createWorkspaceResumeMeta(duplicateName, duplicatePayload.savedAt),
      },
    };

    commitWorkspace(nextWorkspace);
    loadDraftIntoEditor({
      resume: duplicatedDraft.resume,
      template: duplicatedDraft.template,
      sectionOrder: duplicatedDraft.sectionOrder,
      savedAt: duplicatePayload.savedAt,
    });
  }

  function renameActiveResume(nextName) {
    const trimmedName = nextName.trim();

    if (!trimmedName || !activeResumeId || trimmedName === workspace.meta[activeResumeId]?.name) {
      return;
    }

    commitWorkspace(withWorkspaceResumeMeta(workspace, activeResumeId, { name: trimmedName }));
  }

  function deleteActiveResume() {
    if (!activeResumeId || workspace.resumeIds.length <= 1) {
      return;
    }

    const persistedPayload = persistActiveDraftImmediately();

    if (!persistedPayload) {
      return;
    }

    const currentIndex = workspace.resumeIds.indexOf(activeResumeId);
    const nextVisibleWorkspace = withoutWorkspaceResume(
      withWorkspaceResumeMeta(workspace, activeResumeId, { updatedAt: persistedPayload.savedAt }),
      activeResumeId,
    );
    const nextResumeId = nextVisibleWorkspace.resumeIds[Math.max(0, currentIndex - 1)] || nextVisibleWorkspace.resumeIds[0];
    const nextWorkspace = {
      ...nextVisibleWorkspace,
      activeResumeId: nextResumeId,
    };

    window.localStorage.removeItem(createResumeStorageKey(activeResumeId));
    commitWorkspace(nextWorkspace);
    loadDraftIntoEditor(readStoredResumeDraft(nextResumeId));
  }

  const actions = {
    updatePersonalField(field, value) {
      updateResume((currentResume) => updatePersonalField(currentResume, field, value));
    },
    updateSectionTitle(sectionId, value) {
      updateResume((currentResume) => updateSectionTitle(currentResume, sectionId, value));
    },
    updateResumeSetting(settingId, delta) {
      updateResume((currentResume) => updateResumeSettingValue(currentResume, settingId, delta));
    },
    updateEducationField(entryId, field, value) {
      updateResume((currentResume) => updateEducationField(currentResume, entryId, field, value));
    },
    addEducation() {
      updateResume((currentResume) => addEducation(currentResume));
    },
    moveEducation(entryId, direction) {
      updateResume((currentResume) => moveEducation(currentResume, entryId, direction));
    },
    removeEducation(entryId) {
      updateResume((currentResume) => removeEducation(currentResume, entryId));
    },
    updateEducationCustomSection(entryId, sectionIndex, field, value) {
      updateResume((currentResume) => updateEducationCustomSection(currentResume, entryId, sectionIndex, field, value));
    },
    addEducationCustomSection(entryId) {
      updateResume((currentResume) => addEducationCustomSection(currentResume, entryId));
    },
    moveEducationCustomSection(entryId, sectionIndex, direction) {
      updateResume((currentResume) => moveEducationCustomSection(currentResume, entryId, sectionIndex, direction));
    },
    removeEducationCustomSection(entryId, sectionIndex) {
      updateResume((currentResume) => removeEducationCustomSection(currentResume, entryId, sectionIndex));
    },
    updateExperienceField(entryId, field, value) {
      updateResume((currentResume) => updateExperienceField(currentResume, entryId, field, value));
    },
    addExperience() {
      updateResume((currentResume) => addExperience(currentResume));
    },
    moveExperience(entryId, direction) {
      updateResume((currentResume) => moveExperience(currentResume, entryId, direction));
    },
    removeExperience(entryId) {
      updateResume((currentResume) => removeExperience(currentResume, entryId));
    },
    updateActivity(entryId, activityIndex, value) {
      updateResume((currentResume) => updateActivity(currentResume, entryId, activityIndex, value));
    },
    addActivity(entryId) {
      updateResume((currentResume) => addActivity(currentResume, entryId));
    },
    moveActivity(entryId, activityIndex, direction) {
      updateResume((currentResume) => moveActivity(currentResume, entryId, activityIndex, direction));
    },
    removeActivity(entryId, activityIndex) {
      updateResume((currentResume) => removeActivity(currentResume, entryId, activityIndex));
    },
    updateCollectionEntry(sectionKey, entryId, field, value) {
      updateResume((currentResume) => updateCollectionEntry(currentResume, sectionKey, entryId, field, value));
    },
    addCollectionEntry(sectionKey) {
      updateResume((currentResume) => addCollectionEntry(currentResume, sectionKey));
    },
    moveCollectionEntry(sectionKey, entryId, direction) {
      updateResume((currentResume) => moveCollectionEntry(currentResume, sectionKey, entryId, direction));
    },
    removeCollectionEntry(sectionKey, entryId) {
      updateResume((currentResume) => removeCollectionEntry(currentResume, sectionKey, entryId));
    },
    updateCollectionTextList(sectionKey, entryId, field, itemIndex, value) {
      updateResume((currentResume) => updateCollectionTextList(currentResume, sectionKey, entryId, field, itemIndex, value));
    },
    addCollectionTextListItem(sectionKey, entryId, field) {
      updateResume((currentResume) => addCollectionTextListItem(currentResume, sectionKey, entryId, field));
    },
    moveCollectionTextListItem(sectionKey, entryId, field, itemIndex, direction) {
      updateResume((currentResume) => moveCollectionTextListItem(currentResume, sectionKey, entryId, field, itemIndex, direction));
    },
    removeCollectionTextListItem(sectionKey, entryId, field, itemIndex) {
      updateResume((currentResume) => removeCollectionTextListItem(currentResume, sectionKey, entryId, field, itemIndex));
    },
  };

  return {
    resume,
    template,
    setTemplate: changeTemplate,
    activeTab,
    setActiveTab,
    sectionOrder,
    moveSection,
    mobileView,
    setMobileView,
    previewModel,
    errors,
    getFieldError,
    markTouched,
    revealAllErrors,
    showAllErrors,
    actions,
    printResume,
    notice,
    dismissNotice() {
      setNotice(null);
    },
    saveState,
    saveLabel: saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Autosave unavailable' : formatSavedAt(savedAt),
    templateOptions: TEMPLATE_OPTIONS,
    resumeList,
    activeResumeId,
    activeResumeName: workspace.meta[activeResumeId]?.name || '',
    canDeleteActiveResume: workspace.resumeIds.length > 1,
    setActiveResume,
    createResume,
    duplicateActiveResume,
    renameActiveResume,
    deleteActiveResume,
  };
}
