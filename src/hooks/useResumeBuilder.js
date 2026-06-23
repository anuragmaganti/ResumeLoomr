import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  CLOUD_WORKSPACE_RESUME_LIMIT,
  appendWorkspaceToCloud,
  deleteCloudResume,
  getCloudDeviceId,
  hasImportedGuestWorkspace,
  importWorkspaceToCloud,
  markGuestWorkspaceImported,
  readCloudDraft,
  readCloudWorkspace,
  subscribeCloudDraft,
  subscribeCloudWorkspace,
  writeCloudDraft,
  writeCloudWorkspace,
} from '../lib/firebaseWorkspace.js';
import {
  DRAFT_STORAGE_KEY,
  DEFAULT_TEMPLATE,
  MAX_WORKSPACE_RESUMES,
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
  sanitizeWorkspaceResumeName,
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

function readStoredWorkspaceSnapshot() {
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

function formatSavedAt(savedAt, { cloudMode = false, syncState = 'idle' } = {}) {
  if (cloudMode && syncState === 'syncing') {
    return 'Syncing…';
  }

  if (cloudMode && syncState === 'offline') {
    return 'Saved locally';
  }

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

function shouldReadFirestoreCache(trustedDevice) {
  return trustedDevice && typeof navigator !== 'undefined' && !navigator.onLine;
}

export function useResumeBuilder({ user = null, authReady = true, trustedDevice = false } = {}) {
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
  const [cloudReady, setCloudReady] = useState(false);
  const [syncState, setSyncState] = useState('idle');
  const [conflict, setConflict] = useState(null);
  const hasMounted = useRef(false);
  const skipNextAutosaveRef = useRef(false);
  const skipNextCloudSnapshotRef = useRef(false);
  const localDirtyRef = useRef(false);
  const currentDraftRef = useRef(initialWorkspaceState.draft);
  const workspaceRef = useRef(initialWorkspaceState.workspace);
  const activeResumeIdRef = useRef(initialWorkspaceState.workspace.activeResumeId);
  const cloudSaveTimeoutRef = useRef(null);
  const cloudForceSaveRef = useRef(null);
  const userRef = useRef(user);
  const printViewRef = useRef(null);
  const cloudDeviceIdRef = useRef(getCloudDeviceId());
  const isCloudMode = Boolean(authReady && user);
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
  const maxResumeCount = isCloudMode ? CLOUD_WORKSPACE_RESUME_LIMIT : MAX_WORKSPACE_RESUMES;
  const canAddResume = workspace.resumeIds.length < maxResumeCount;

  useEffect(() => {
    currentDraftRef.current = {
      resume,
      template,
      sectionOrder,
      savedAt,
    };
  }, [resume, savedAt, sectionOrder, template]);

  useEffect(() => {
    workspaceRef.current = workspace;
  }, [workspace]);

  useEffect(() => {
    activeResumeIdRef.current = activeResumeId;
  }, [activeResumeId]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    if (!initialWorkspaceState.needsInitialCommit || !activeResumeId) {
      return;
    }

    persistWorkspaceIndex(initialWorkspaceState.workspace);
    persistExistingDraftState(activeResumeId, initialWorkspaceState.draft);
  }, [activeResumeId, initialWorkspaceState]);

  useEffect(() => {
    if (!authReady) {
      return undefined;
    }

    if (!user) {
      setCloudReady(false);
      setSyncState('idle');
      setConflict(null);
      localDirtyRef.current = false;
      return undefined;
    }

    let cancelled = false;
    const uid = user.uid;

    async function bootstrapCloudWorkspace() {
      setSaveState('saving');
      setSyncState('syncing');

      try {
        persistActiveDraftImmediately({ localOnly: true });
        const localSnapshot = readStoredWorkspaceSnapshot();
        const remoteWorkspace = await readCloudWorkspace(uid, trustedDevice, {
          cacheOnly: shouldReadFirestoreCache(trustedDevice),
        });
        let nextWorkspace = remoteWorkspace;

        if (!nextWorkspace) {
          nextWorkspace = await importWorkspaceToCloud(
            uid,
            localSnapshot.workspace,
            localSnapshot.readDraft,
            trustedDevice,
            cloudDeviceIdRef.current,
          );
          markGuestWorkspaceImported(uid);
        } else if (!hasImportedGuestWorkspace(uid)) {
          nextWorkspace = await appendWorkspaceToCloud(
            uid,
            nextWorkspace,
            localSnapshot.workspace,
            localSnapshot.readDraft,
            trustedDevice,
            cloudDeviceIdRef.current,
          );
          markGuestWorkspaceImported(uid);
        }

        if (cancelled || !nextWorkspace) {
          return;
        }

        const normalizedWorkspace = normalizeWorkspaceIndex(nextWorkspace);
        const nextResumeId = normalizedWorkspace.activeResumeId || normalizedWorkspace.resumeIds[0];
        const cloudDraft = nextResumeId
          ? await readCloudDraft(uid, nextResumeId, trustedDevice, {
            cacheOnly: shouldReadFirestoreCache(trustedDevice),
          })
          : null;
        const nextDraft = cloudDraft || localSnapshot.draft;

        if (cancelled) {
          return;
        }

        skipNextAutosaveRef.current = true;
        setWorkspace(normalizedWorkspace);
        loadDraftIntoEditor(nextDraft);
        localDirtyRef.current = false;
        setCloudReady(true);
        setSyncState('saved');
      } catch {
        if (!cancelled) {
          setCloudReady(false);
          setSaveState('error');
          setSyncState('error');
          setNotice({ tone: 'error', message: 'Cloud sync is unavailable. Your local draft is still editable.' });
        }
      }
    }

    bootstrapCloudWorkspace();

    return () => {
      cancelled = true;
    };
  // The bootstrap intentionally runs only when the authenticated account or cache policy changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, trustedDevice, user]);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }

    if (skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }

    if (isCloudMode && !cloudReady) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      try {
        const payload = createDraftPayload({ resume, template, sectionOrder });

        if (!isCloudMode) {
          window.localStorage.setItem(createResumeStorageKey(activeResumeId), JSON.stringify(payload));
        }

        setSavedAt(payload.savedAt);
        setSaveState('saved');
        setWorkspace((currentWorkspace) => {
          const nextWorkspace = withWorkspaceResumeMeta(currentWorkspace, activeResumeId, { updatedAt: payload.savedAt });

          if (!isCloudMode) {
            persistWorkspaceIndex(nextWorkspace);
          } else {
            localDirtyRef.current = true;
            setSyncState(navigator.onLine ? 'syncing' : 'offline');

            scheduleCloudSave(activeResumeId, nextWorkspace, {
              resume,
              template,
              sectionOrder,
              savedAt: payload.savedAt,
            });
          }

          return nextWorkspace;
        });
      } catch {
        setSaveState('error');
        setNotice({ tone: 'error', message: 'Autosave failed in this browser session.' });
      }
    }, 180);

    return () => window.clearTimeout(timeoutId);
  // Autosave is driven by editor data changes; scheduleCloudSave reads current refs to avoid resubscribing timers.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeResumeId, cloudReady, isCloudMode, resume, sectionOrder, template, trustedDevice, user]);

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

  useEffect(() => {
    if (!isCloudMode || !cloudReady || !user?.uid) {
      return undefined;
    }

    return subscribeCloudWorkspace(
      user.uid,
      trustedDevice,
      (remoteWorkspace, rawWorkspace) => {
        if (rawWorkspace?.deviceId === cloudDeviceIdRef.current || localDirtyRef.current) {
          return;
        }

        setWorkspace(remoteWorkspace);
      },
      () => {
        setSyncState('error');
      },
    );
  }, [cloudReady, isCloudMode, trustedDevice, user]);

  useEffect(() => {
    if (!isCloudMode || !cloudReady || !user?.uid || !activeResumeId) {
      return undefined;
    }

    return subscribeCloudDraft(
      user.uid,
      activeResumeId,
      trustedDevice,
      (remoteDraft, rawDraft) => {
        if (skipNextCloudSnapshotRef.current) {
          skipNextCloudSnapshotRef.current = false;
          return;
        }

        if (rawDraft?.deviceId === cloudDeviceIdRef.current) {
          return;
        }

        if (localDirtyRef.current) {
          setConflict({
            remoteDraft,
            rawDraft,
            resumeId: activeResumeId,
          });
          return;
        }

        skipNextAutosaveRef.current = true;
        loadDraftIntoEditor(remoteDraft);
        setSavedAt(remoteDraft.savedAt);
        setSyncState('saved');
      },
      () => {
        setSyncState('error');
      },
    );
  // The active resume listener should restart only when the subscribed document changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeResumeId, cloudReady, isCloudMode, trustedDevice, user]);

  useEffect(() => {
    if (!isCloudMode || !cloudReady) {
      return undefined;
    }

    function handleOnline() {
      flushCloudDraft();
    }

    function handlePageExit() {
      flushCloudDraft();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        flushCloudDraft();
      }
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('pagehide', handlePageExit);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('pagehide', handlePageExit);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  // Page-exit handlers flush the latest refs and should only bind while cloud sync is active.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloudReady, isCloudMode]);

  useEffect(() => () => {
    clearCloudSaveTimers();
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

  function persistActiveDraftImmediately({ localOnly = false, flushCloud = true, resumeId = activeResumeIdRef.current } = {}) {
    if (!resumeId || typeof window === 'undefined') {
      return null;
    }

    try {
      const payload = createDraftPayload({ resume, template, sectionOrder });

      if (!isCloudMode || localOnly) {
        window.localStorage.setItem(createResumeStorageKey(resumeId), JSON.stringify(payload));
      }

      setSavedAt(payload.savedAt);
      setSaveState('saved');

      if (isCloudMode && !localOnly && flushCloud) {
        const draft = {
          resume,
          template,
          sectionOrder,
          savedAt: payload.savedAt,
        };

        flushCloudDraft(resumeId, workspace, draft);
      }

      return payload;
    } catch {
      setSaveState('error');
      setNotice({ tone: 'error', message: 'Autosave failed in this browser session.' });
      return null;
    }
  }

  function commitWorkspace(nextWorkspace) {
    if (!isCloudMode) {
      persistWorkspaceIndex(nextWorkspace);
    }

    setWorkspace(nextWorkspace);
  }

  function clearCloudSaveTimers() {
    if (cloudSaveTimeoutRef.current) {
      window.clearTimeout(cloudSaveTimeoutRef.current);
      cloudSaveTimeoutRef.current = null;
    }

    if (cloudForceSaveRef.current) {
      window.clearTimeout(cloudForceSaveRef.current);
      cloudForceSaveRef.current = null;
    }
  }

  function logCloudError(error) {
    if (import.meta.env.DEV) {
      console.error('Cloud sync failed', {
        code: error?.code,
        message: error?.message,
      });
    }
  }

  function runCloudMutation(createMutation) {
    try {
      const mutation = createMutation();

      if (!navigator.onLine) {
        setSyncState('offline');
        mutation.catch(logCloudError);
        return Promise.resolve(false);
      }

      return mutation
        .then(() => true)
        .catch((error) => {
          logCloudError(error);
          setSyncState(navigator.onLine ? 'error' : 'offline');
          return false;
        });
    } catch (error) {
      logCloudError(error);
      setSyncState(navigator.onLine ? 'error' : 'offline');
      return Promise.resolve(false);
    }
  }

  function scheduleCloudSave(resumeId, nextWorkspace, draft) {
    if (!isCloudMode || !cloudReady || !user?.uid || !resumeId) {
      return;
    }

    if (cloudSaveTimeoutRef.current) {
      window.clearTimeout(cloudSaveTimeoutRef.current);
    }

    cloudSaveTimeoutRef.current = window.setTimeout(() => {
      flushCloudDraft(resumeId, nextWorkspace, draft);
    }, 2500);

    if (!cloudForceSaveRef.current) {
      cloudForceSaveRef.current = window.setTimeout(() => {
        flushCloudDraft(resumeId, nextWorkspace, draft);
      }, 25000);
    }
  }

  async function flushCloudDraft(
    resumeId = activeResumeIdRef.current,
    nextWorkspace = workspaceRef.current,
    draft = currentDraftRef.current,
  ) {
    const currentUser = userRef.current;

    if (!currentUser?.uid || !resumeId || !cloudReady) {
      return null;
    }

    clearCloudSaveTimers();
    setSyncState(navigator.onLine ? 'syncing' : 'offline');

    try {
      skipNextCloudSnapshotRef.current = true;
      const draftDoc = await writeCloudDraft(
        currentUser.uid,
        resumeId,
        nextWorkspace,
        draft,
        trustedDevice,
        cloudDeviceIdRef.current,
      );

      localDirtyRef.current = false;
      setSavedAt(draftDoc?.savedAt || draft.savedAt || new Date().toISOString());
      setSaveState('saved');
      setSyncState(navigator.onLine ? 'saved' : 'offline');
      return draftDoc;
    } catch (error) {
      logCloudError(error);
      setSyncState(navigator.onLine ? 'error' : 'offline');
      setSaveState('error');
      setNotice({
        tone: 'error',
        message: trustedDevice
          ? 'Cloud sync failed. Firestore will keep trying from this trusted device.'
          : 'Cloud sync failed. Your latest changes are still in this browser session.',
      });
      return null;
    }
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

  async function setActiveResume(nextResumeId) {
    if (!workspace.resumeIds.includes(nextResumeId) || nextResumeId === activeResumeId) {
      return;
    }

    const previousResumeId = activeResumeId;
    const persistedPayload = persistActiveDraftImmediately({ flushCloud: false, resumeId: previousResumeId });

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

    if (isCloudMode && user?.uid) {
      await flushCloudDraft(previousResumeId, nextWorkspaceBase, {
        resume,
        template,
        sectionOrder,
        savedAt: persistedPayload.savedAt,
      });
      await runCloudMutation(() => (
        writeCloudWorkspace(user.uid, nextWorkspace, trustedDevice, cloudDeviceIdRef.current)
      ));
      const cloudDraft = await readCloudDraft(user.uid, nextResumeId, trustedDevice, {
        cacheOnly: shouldReadFirestoreCache(trustedDevice),
      }).catch(() => null);
      loadDraftIntoEditor(cloudDraft || readStoredResumeDraft(nextResumeId));
      return;
    }

    loadDraftIntoEditor(readStoredResumeDraft(nextResumeId));
  }

  async function createResume() {
    if (!canAddResume) {
      return;
    }

    const previousResumeId = activeResumeId;
    const persistedPayload = persistActiveDraftImmediately({ flushCloud: false, resumeId: previousResumeId });

    if (!persistedPayload && activeResumeId) {
      return;
    }

    const existingNames = workspace.resumeIds.map((resumeId) => workspace.meta[resumeId]?.name || '');
    const nextResumeId = createWorkspaceResumeId();
    const nextResumeName = createNextResumeName(existingNames);
    const nextDraft = createBlankDraftState();

    if (!isCloudMode) {
      persistExistingDraftState(nextResumeId, nextDraft);
    }

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

    if (isCloudMode && user?.uid) {
      if (previousResumeId) {
        await flushCloudDraft(previousResumeId, nextWorkspace, {
          resume,
          template,
          sectionOrder,
          savedAt: persistedPayload.savedAt,
        });
      }

      await runCloudMutation(() => (
        writeCloudDraft(user.uid, nextResumeId, nextWorkspace, nextDraft, trustedDevice, cloudDeviceIdRef.current)
      ));
    }

    loadDraftIntoEditor(nextDraft, { focusPersonal: true });
  }

  async function duplicateActiveResume() {
    if (!canAddResume) {
      return;
    }

    const previousResumeId = activeResumeId;
    const persistedPayload = persistActiveDraftImmediately({ flushCloud: false, resumeId: previousResumeId });

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
    if (!isCloudMode) {
      window.localStorage.setItem(createResumeStorageKey(nextResumeId), JSON.stringify(duplicatePayload));
    }

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

    if (isCloudMode && user?.uid) {
      if (previousResumeId) {
        await flushCloudDraft(previousResumeId, nextWorkspace, {
          resume,
          template,
          sectionOrder,
          savedAt: persistedPayload.savedAt,
        });
      }

      await runCloudMutation(() => (
        writeCloudDraft(
          user.uid,
          nextResumeId,
          nextWorkspace,
          {
            resume: duplicatedDraft.resume,
            template: duplicatedDraft.template,
            sectionOrder: duplicatedDraft.sectionOrder,
            savedAt: duplicatePayload.savedAt,
          },
          trustedDevice,
          cloudDeviceIdRef.current,
        )
      ));
    }

    loadDraftIntoEditor({
      resume: duplicatedDraft.resume,
      template: duplicatedDraft.template,
      sectionOrder: duplicatedDraft.sectionOrder,
      savedAt: duplicatePayload.savedAt,
    });
  }

  function renameActiveResume(nextName) {
    const currentName = workspace.meta[activeResumeId]?.name || '';
    const trimmedName = sanitizeWorkspaceResumeName(nextName, currentName);

    if (!trimmedName || !activeResumeId || trimmedName === workspace.meta[activeResumeId]?.name) {
      return;
    }

    const nextWorkspace = withWorkspaceResumeMeta(workspace, activeResumeId, { name: trimmedName });
    commitWorkspace(nextWorkspace);

    if (isCloudMode && user?.uid) {
      runCloudMutation(() => (
        writeCloudWorkspace(user.uid, nextWorkspace, trustedDevice, cloudDeviceIdRef.current)
      ));
      scheduleCloudSave(activeResumeId, nextWorkspace, currentDraftRef.current);
    }
  }

  async function deleteActiveResume() {
    if (!activeResumeId || workspace.resumeIds.length <= 1) {
      return;
    }

    const deletedResumeId = activeResumeId;
    clearCloudSaveTimers();
    const persistedPayload = persistActiveDraftImmediately({
      flushCloud: false,
      resumeId: deletedResumeId,
    });

    if (!persistedPayload) {
      return;
    }

    const currentIndex = workspace.resumeIds.indexOf(deletedResumeId);
    const nextVisibleWorkspace = withoutWorkspaceResume(
      withWorkspaceResumeMeta(workspace, deletedResumeId, { updatedAt: persistedPayload.savedAt }),
      deletedResumeId,
    );
    const nextResumeId = nextVisibleWorkspace.resumeIds[Math.max(0, currentIndex - 1)] || nextVisibleWorkspace.resumeIds[0];
    const nextWorkspace = {
      ...nextVisibleWorkspace,
      activeResumeId: nextResumeId,
    };

    window.localStorage.removeItem(createResumeStorageKey(deletedResumeId));
    commitWorkspace(nextWorkspace);

    if (isCloudMode && user?.uid) {
      const cloudDeleteSucceeded = await runCloudMutation(() => (
        deleteCloudResume(user.uid, deletedResumeId, nextWorkspace, trustedDevice, cloudDeviceIdRef.current)
      ));

      if (!cloudDeleteSucceeded && navigator.onLine) {
        setSaveState('error');
        setNotice({
          tone: 'error',
          message: trustedDevice
            ? 'Cloud sync failed. Firestore will keep trying from this trusted device.'
            : 'Cloud sync failed. Your latest changes are still in this browser session.',
        });
      }
    }

    loadDraftIntoEditor(readStoredResumeDraft(nextResumeId));

    if (isCloudMode && user?.uid) {
      const cloudDraft = await readCloudDraft(user.uid, nextResumeId, trustedDevice, {
        cacheOnly: shouldReadFirestoreCache(trustedDevice),
      }).catch(() => null);
      loadDraftIntoEditor(cloudDraft || readStoredResumeDraft(nextResumeId));
    }
  }

  function useCloudConflictVersion() {
    if (!conflict?.remoteDraft) {
      return;
    }

    skipNextAutosaveRef.current = true;
    loadDraftIntoEditor(conflict.remoteDraft);
    localDirtyRef.current = false;
    setConflict(null);
    setSyncState('saved');
  }

  function keepLocalConflictVersion() {
    setConflict(null);
    localDirtyRef.current = true;
    flushCloudDraft();
  }

  async function saveConflictAsCopy() {
    if (!conflict || !canAddResume) {
      return;
    }

    const nextResumeId = createWorkspaceResumeId();
    const existingNames = workspace.resumeIds.map((resumeId) => workspace.meta[resumeId]?.name || '');
    const sourceName = workspace.meta[activeResumeId]?.name || '';
    const duplicateName = createDuplicateResumeName(sourceName, existingNames);
    const localDraft = currentDraftRef.current;
    const duplicatePayload = createDraftPayload({
      resume: localDraft.resume,
      template: localDraft.template,
      sectionOrder: localDraft.sectionOrder,
    });
    const nextWorkspace = {
      ...workspace,
      activeResumeId: nextResumeId,
      resumeIds: [...workspace.resumeIds, nextResumeId],
      meta: {
        ...workspace.meta,
        [nextResumeId]: createWorkspaceResumeMeta(duplicateName, duplicatePayload.savedAt),
      },
    };

    commitWorkspace(nextWorkspace);

    if (user?.uid) {
      await runCloudMutation(() => (
        writeCloudDraft(
          user.uid,
          nextResumeId,
          nextWorkspace,
          {
            resume: localDraft.resume,
            template: localDraft.template,
            sectionOrder: localDraft.sectionOrder,
            savedAt: duplicatePayload.savedAt,
          },
          trustedDevice,
          cloudDeviceIdRef.current,
        )
      ));
    }

    skipNextAutosaveRef.current = true;
    loadDraftIntoEditor(conflict.remoteDraft);
    localDirtyRef.current = false;
    setConflict(null);
    setNotice({ tone: 'success', message: 'Saved this device’s version as a copy.' });
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
    conflict,
    resolveConflictWithCloud: useCloudConflictVersion,
    resolveConflictWithLocal: keepLocalConflictVersion,
    saveConflictAsCopy,
    saveState,
    saveLabel: saveState === 'saving'
      ? 'Saving…'
      : saveState === 'error'
        ? isCloudMode && syncState === 'offline' ? 'Saved locally' : 'Autosave unavailable'
        : formatSavedAt(savedAt, { cloudMode: isCloudMode, syncState }),
    syncState,
    isCloudMode,
    templateOptions: TEMPLATE_OPTIONS,
    resumeList,
    activeResumeId,
    activeResumeName: workspace.meta[activeResumeId]?.name || '',
    canAddResume,
    canDeleteActiveResume: workspace.resumeIds.length > 1,
    setActiveResume,
    createResume,
    duplicateActiveResume,
    renameActiveResume,
    deleteActiveResume,
  };
}
