import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  DRAFT_STORAGE_KEY,
  DEFAULT_TEMPLATE,
  TEMPLATE_OPTIONS,
  addActivity,
  addEducation,
  addExperience,
  createDraftPayload,
  createEmptyResume,
  getPreviewModel,
  moveActivity,
  moveEducation,
  moveExperience,
  normalizeDraftPayload,
  removeActivity,
  removeEducation,
  removeExperience,
  updateActivity,
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
      recoveredDraft: false,
    };
  }

  try {
    const rawDraft = window.localStorage.getItem(DRAFT_STORAGE_KEY);

    if (!rawDraft) {
      return {
        resume: createEmptyResume(),
        template: DEFAULT_TEMPLATE,
        savedAt: null,
        recoveredDraft: false,
      };
    }

    const parsedDraft = JSON.parse(rawDraft);
    const normalizedDraft = normalizeDraftPayload(parsedDraft);

    return {
      resume: normalizedDraft.resume,
      template: normalizedDraft.template,
      savedAt: parsedDraft.savedAt || null,
      recoveredDraft: true,
    };
  } catch {
    return {
      resume: createEmptyResume(),
      template: DEFAULT_TEMPLATE,
      savedAt: null,
      recoveredDraft: false,
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
  const [saveState, setSaveState] = useState(initialDraft.recoveredDraft ? 'restored' : 'idle');
  const [savedAt, setSavedAt] = useState(initialDraft.savedAt);
  const [notice, setNotice] = useState(
    initialDraft.recoveredDraft
      ? { tone: 'info', message: 'Recovered your last autosaved draft.' }
      : null
  );
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

  async function importDraftFile(file) {
    if (!file) {
      return;
    }

    try {
      const rawDraft = await file.text();
      const parsedDraft = JSON.parse(rawDraft);
      const normalizedDraft = normalizeDraftPayload(parsedDraft);

      setResume(normalizedDraft.resume);
      setTemplate(normalizedDraft.template);
      setTouched({});
      setShowAllErrors(false);
      setSaveState('saving');
      setNotice({ tone: 'success', message: 'Draft imported successfully.' });
      setMobileView('editor');
    } catch {
      setNotice({ tone: 'error', message: 'Import failed. Use a valid ResumeLoomr JSON file.' });
    }
  }

  function exportDraft() {
    const payload = createDraftPayload({ resume, template });
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);

    link.href = url;
    link.download = `resumeloomr-${stamp}.json`;
    link.click();
    window.URL.revokeObjectURL(url);
    setNotice({ tone: 'success', message: 'JSON export downloaded.' });
  }

  function resetDraft() {
    const nextResume = createEmptyResume();

    setResume(nextResume);
    setTemplate(DEFAULT_TEMPLATE);
    setActiveTab('personal');
    setMobileView('editor');
    setTouched({});
    setShowAllErrors(false);
    setSaveState('saving');
    setNotice({ tone: 'info', message: 'Started a fresh draft.' });

    try {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // Ignore storage cleanup failures; the new draft will be autosaved on the next change.
    }
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
    importDraftFile,
    exportDraft,
    resetDraft,
    notice,
    dismissNotice() {
      setNotice(null);
    },
    saveState,
    saveLabel: saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Autosave unavailable' : formatSavedAt(savedAt),
    templateOptions: TEMPLATE_OPTIONS,
  };
}
