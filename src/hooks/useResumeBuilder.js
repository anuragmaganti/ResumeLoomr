import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  DRAFT_STORAGE_KEY,
  DEFAULT_TEMPLATE,
  TEMPLATE_OPTIONS,
  addActivity,
  addEducationCustomSection,
  addEducation,
  addExperience,
  createDraftPayload,
  createEmptyResume,
  getPreviewModel,
  moveActivity,
  moveEducationCustomSection,
  moveEducation,
  moveExperience,
  normalizeDraftPayload,
  removeActivity,
  removeEducationCustomSection,
  removeEducation,
  removeExperience,
  updateActivity,
  updateEducationCustomSection,
  updateEducationField,
  updateExperienceField,
  updatePersonalField,
  validateResume,
} from '../lib/resume.js';

function loadStoredDraft() {
  if (typeof window === 'undefined') {
    return {
      resume: createEmptyResume(),
      template: DEFAULT_TEMPLATE,
      savedAt: null,
    };
  }

  try {
    const rawDraft = window.localStorage.getItem(DRAFT_STORAGE_KEY);

    if (!rawDraft) {
      return {
        resume: createEmptyResume(),
        template: DEFAULT_TEMPLATE,
        savedAt: null,
      };
    }

    const parsedDraft = JSON.parse(rawDraft);
    const normalizedDraft = normalizeDraftPayload(parsedDraft);

    return {
      resume: normalizedDraft.resume,
      template: normalizedDraft.template,
      savedAt: parsedDraft.savedAt || null,
    };
  } catch {
    return {
      resume: createEmptyResume(),
      template: DEFAULT_TEMPLATE,
      savedAt: null,
    };
  }
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

export function useResumeBuilder() {
  const initialDraft = useMemo(() => loadStoredDraft(), []);
  const [resume, setResume] = useState(initialDraft.resume);
  const [template, setTemplate] = useState(initialDraft.template);
  const [activeTab, setActiveTab] = useState('personal');
  const [mobileView, setMobileView] = useState('editor');
  const [touched, setTouched] = useState({});
  const [showAllErrors, setShowAllErrors] = useState(false);
  const [saveState, setSaveState] = useState('idle');
  const [savedAt, setSavedAt] = useState(initialDraft.savedAt);
  const [notice, setNotice] = useState(null);
  const hasMounted = useRef(false);
  const printViewRef = useRef(null);
  const errors = useMemo(() => validateResume(resume), [resume]);
  const previewModel = useMemo(() => getPreviewModel(resume), [resume]);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }

    const timeoutId = window.setTimeout(() => {
      try {
        const payload = createDraftPayload({ resume, template });
        window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(payload));
        setSavedAt(payload.savedAt);
        setSaveState('saved');
      } catch {
        setSaveState('error');
        setNotice({ tone: 'error', message: 'Autosave failed in this browser session.' });
      }
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [resume, template]);

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

  function updateResume(transform) {
    setSaveState('saving');
    setResume((currentResume) => transform(currentResume));
  }

  function changeTemplate(nextTemplate) {
    setSaveState('saving');
    setTemplate(nextTemplate);
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

  const actions = {
    updatePersonalField(field, value) {
      updateResume((currentResume) => updatePersonalField(currentResume, field, value));
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
  };

  return {
    resume,
    template,
    setTemplate: changeTemplate,
    activeTab,
    setActiveTab,
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
  };
}
