import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  CLOUD_WORKSPACE_RESUME_LIMIT,
  deleteCloudResume,
  getCloudDeviceId,
  getCloudSessionId,
  importWorkspaceToCloud,
  markGuestWorkspaceImported,
  readCloudDraft,
  readCloudWorkspace,
  renameCloudResume,
  subscribeCloudDraft,
  subscribeCloudWorkspace,
  syncLocalWorkspaceToCloud,
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
  moveResumeSectionBlock,
  moveRoleBlockActivity,
  moveRoleBlockEntry,
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
  removeResumeSectionBlock,
  removeRoleBlockActivity,
  removeRoleBlockEntry,
  removeSectionBlockEducationCustomSection,
  removeSectionBlockEducationProgram,
  removeSectionBlockEntry,
  removeSectionBlockTextListItem,
  reorderSectionOrder,
  reorderResumeSectionBlock,
  sanitizeWorkspaceResumeName,
  updateCollectionEntry,
  updateCollectionTextList,
  updateActivity,
  updateEducationCustomSection,
  updateEducationField,
  updateExperienceField,
  updatePersonalField,
  updateResumeSetting as updateResumeSettingValue,
  updateRoleBlockActivity,
  updateRoleBlockEntry,
  updateSectionBlockEducationCustomSection,
  updateSectionBlockEducationProgram,
  updateSectionBlockEntry,
  updateSectionBlockTextList,
  updateSectionTitle,
  addRoleBlockActivity,
  addRoleBlockEntry,
  addSectionBlockEducationCustomSection,
  addSectionBlockEducationProgram,
  addSectionBlockEntry,
  addSectionBlockTextListItem,
  moveSectionBlockEducationCustomSection,
  moveSectionBlockEducationProgram,
  moveSectionBlockEntry,
  moveSectionBlockTextListItem,
  validateResume,
} from '../lib/resume.js';
import {
  createGuestMirrorWorkspace,
  persistCloudDraftMirror,
  persistCloudWorkspaceMirror,
  readCloudMirrorManifest,
  refreshCloudMirrorManifest,
} from '../lib/localWorkspaceMirror.js';

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

function getDraftEditorSectionIds(draft) {
  const blockIds = Array.isArray(draft?.resume?.sections)
    ? draft.resume.sections.map((section) => section.id).filter(Boolean)
    : SECTION_IDS.filter((sectionId) => sectionId !== 'personal');

  return ['personal', ...blockIds];
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

function formatSavedAt(savedAt, { cloudMode = false, syncState = 'idle', trustedDevice = false } = {}) {
  if (cloudMode && syncState === 'syncing') {
    return 'Syncing…';
  }

  if (cloudMode && syncState === 'offline') {
    return trustedDevice ? 'Saved offline' : 'Unsynced in this tab';
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

function isOnline() {
  return typeof navigator === 'undefined' || navigator.onLine;
}

async function resolveReadableCloudWorkspace({ uid, workspace, trustedDevice }) {
  const normalizedWorkspace = normalizeWorkspaceIndex(workspace);
  const orderedResumeIds = [
    normalizedWorkspace.activeResumeId,
    ...normalizedWorkspace.resumeIds.filter((resumeId) => resumeId !== normalizedWorkspace.activeResumeId),
  ].filter(Boolean);
  const readableDrafts = new Map();

  for (const resumeId of orderedResumeIds) {
    const draft = await readCloudDraft(uid, resumeId, trustedDevice, {
      cacheOnly: shouldReadFirestoreCache(trustedDevice),
    }).catch(() => null);

    if (draft) {
      readableDrafts.set(resumeId, draft);
    }
  }

  const readableResumeIds = normalizedWorkspace.resumeIds.filter((resumeId) => readableDrafts.has(resumeId));
  const activeResumeId = readableDrafts.has(normalizedWorkspace.activeResumeId)
    ? normalizedWorkspace.activeResumeId
    : readableResumeIds[0];

  if (!activeResumeId) {
    return {
      workspace: normalizedWorkspace,
      draft: null,
      draftsByResumeId: readableDrafts,
      removedCount: 0,
    };
  }

  const repairedWorkspace = normalizeWorkspaceIndex({
    ...normalizedWorkspace,
    activeResumeId,
    resumeIds: readableResumeIds,
    meta: Object.fromEntries(
      readableResumeIds.map((resumeId) => [resumeId, normalizedWorkspace.meta[resumeId]]),
    ),
  });

  return {
    workspace: repairedWorkspace,
    draft: readableDrafts.get(activeResumeId),
    draftsByResumeId: readableDrafts,
    removedCount: normalizedWorkspace.resumeIds.length - repairedWorkspace.resumeIds.length,
  };
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
  const localDirtyResumeIdsRef = useRef(new Set());
  const currentDraftRef = useRef(initialWorkspaceState.draft);
  const workspaceRef = useRef(initialWorkspaceState.workspace);
  const activeResumeIdRef = useRef(initialWorkspaceState.workspace.activeResumeId);
  const cloudSaveQueueRef = useRef(new Map());
  const userRef = useRef(user);
  const printViewRef = useRef(null);
  const wasCloudModeRef = useRef(false);
  const cloudDeviceIdRef = useRef(getCloudDeviceId());
  const cloudSessionIdRef = useRef(getCloudSessionId());
  const cloudIdentityRef = useRef({
    deviceId: cloudDeviceIdRef.current,
    sessionId: cloudSessionIdRef.current,
  });
  const lastRemoteVersionByResumeRef = useRef(new Map());
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
      if (wasCloudModeRef.current) {
        const storedWorkspace = loadStoredWorkspace();

        setWorkspace(storedWorkspace.workspace);
        loadDraftIntoEditor(storedWorkspace.draft);
      }

      wasCloudModeRef.current = false;
      setCloudReady(false);
      setSyncState('idle');
      setConflict(null);
      clearLocalDirtyState();
      return undefined;
    }

    wasCloudModeRef.current = true;
    let cancelled = false;
    const uid = user.uid;

    async function bootstrapCloudWorkspace() {
      setSaveState('saving');
      setSyncState('syncing');

      try {
        persistActiveDraftImmediately({ localOnly: true });
        const localSnapshot = readStoredWorkspaceSnapshot();
        const localMirrorManifest = readCloudMirrorManifest(uid);
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
            cloudIdentityRef.current,
          );
          markGuestWorkspaceImported(uid);
        } else {
          nextWorkspace = await syncLocalWorkspaceToCloud(
            uid,
            nextWorkspace,
            localSnapshot.workspace,
            localSnapshot.readDraft,
            trustedDevice,
            cloudIdentityRef.current,
            { mirroredResumeIds: localMirrorManifest?.resumeIds || [] },
          );
          markGuestWorkspaceImported(uid);
        }

        if (cancelled || !nextWorkspace) {
          return;
        }

        const resolvedCloudWorkspace = await resolveReadableCloudWorkspace({
          uid,
          workspace: nextWorkspace,
          trustedDevice,
        });

        if (!resolvedCloudWorkspace.draft) {
          throw new Error('Cloud workspace has no readable resumes.');
        }

        const normalizedWorkspace = resolvedCloudWorkspace.workspace;
        const nextDraft = resolvedCloudWorkspace.draft;
        mirrorCloudWorkspaceLocally(
          normalizedWorkspace,
          (resumeId) => resolvedCloudWorkspace.draftsByResumeId.get(resumeId),
        );

        if (resolvedCloudWorkspace.removedCount > 0) {
          await writeCloudWorkspace(uid, normalizedWorkspace, trustedDevice, cloudIdentityRef.current);
          setNotice({
            tone: 'success',
            message: 'Removed unavailable cloud resumes from this workspace.',
          });
        }

        if (cancelled) {
          return;
        }

        skipNextAutosaveRef.current = true;
        setWorkspace(normalizedWorkspace);
        loadDraftIntoEditor(nextDraft);
        clearLocalDirtyState();
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
            const draft = {
              resume,
              template,
              sectionOrder,
              savedAt: payload.savedAt,
            };

            markResumeDirty(activeResumeId);
            setSyncState(isOnline() ? 'syncing' : 'offline');
            mirrorCloudDraftLocally(activeResumeId, nextWorkspace, draft);

            if (!trustedDevice && !isOnline()) {
              setNotice({
                tone: 'error',
                message: 'You are offline on an untrusted device. Reconnect before closing or refreshing this tab.',
              });
            }

            scheduleCloudSave(activeResumeId, nextWorkspace, draft);
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
        if (rawWorkspace?.sessionId === cloudSessionIdRef.current || hasAnyLocalDirty()) {
          return;
        }

        mirrorCloudWorkspaceLocally(remoteWorkspace);
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

        if (rawDraft?.sessionId === cloudSessionIdRef.current) {
          lastRemoteVersionByResumeRef.current.set(activeResumeId, rawDraft?.version || 0);
          return;
        }

        const lastRemoteVersion = lastRemoteVersionByResumeRef.current.get(activeResumeId) || 0;
        const nextRemoteVersion = rawDraft?.version || 0;

        if (nextRemoteVersion && nextRemoteVersion <= lastRemoteVersion) {
          return;
        }

        if (hasLocalDirty(activeResumeId)) {
          setConflict({
            remoteDraft,
            rawDraft,
            resumeId: activeResumeId,
          });
          return;
        }

        skipNextAutosaveRef.current = true;
        mirrorCloudDraftLocally(activeResumeId, workspaceRef.current, remoteDraft);
        loadDraftIntoEditor(remoteDraft);
        setSavedAt(remoteDraft.savedAt);
        lastRemoteVersionByResumeRef.current.set(activeResumeId, nextRemoteVersion);
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
      flushPendingCloudSaves({ reason: 'online' });
    }

    function handlePageExit() {
      flushPendingCloudSaves({ reason: 'pagehide' });
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        flushPendingCloudSaves({ reason: 'visibilitychange' });
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
    const nextSectionIds = getDraftEditorSectionIds(nextDraft);

    skipNextAutosaveRef.current = true;
    currentDraftRef.current = nextDraft;
    setResume(nextDraft.resume);
    setTemplate(nextDraft.template);
    setSectionOrder(nextDraft.sectionOrder);
    setSavedAt(nextDraft.savedAt);
    setSaveState(nextDraft.savedAt ? 'saved' : 'idle');
    resetValidationState();

    if (focusPersonal || !nextSectionIds.includes(activeTab)) {
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
    workspaceRef.current = nextWorkspace;
    activeResumeIdRef.current = nextWorkspace.activeResumeId;

    if (!isCloudMode) {
      persistWorkspaceIndex(nextWorkspace);
    }

    setWorkspace(nextWorkspace);
  }

  function clearCloudSaveTimers(resumeId) {
    if (resumeId) {
      const pendingSave = cloudSaveQueueRef.current.get(resumeId);

      if (pendingSave?.debounceTimer) {
        window.clearTimeout(pendingSave.debounceTimer);
      }

      if (pendingSave?.forceTimer) {
        window.clearTimeout(pendingSave.forceTimer);
      }

      cloudSaveQueueRef.current.delete(resumeId);
      return;
    }

    cloudSaveQueueRef.current.forEach((pendingSave) => {
      if (pendingSave.debounceTimer) {
        window.clearTimeout(pendingSave.debounceTimer);
      }

      if (pendingSave.forceTimer) {
        window.clearTimeout(pendingSave.forceTimer);
      }
    });
    cloudSaveQueueRef.current.clear();
  }

  function syncGlobalDirtyFlag() {
    localDirtyRef.current = localDirtyResumeIdsRef.current.size > 0;
  }

  function markResumeDirty(resumeId) {
    if (resumeId) {
      localDirtyResumeIdsRef.current.add(resumeId);
    }

    syncGlobalDirtyFlag();
  }

  function clearResumeDirty(resumeId) {
    if (resumeId) {
      localDirtyResumeIdsRef.current.delete(resumeId);
    }

    syncGlobalDirtyFlag();
  }

  function clearLocalDirtyState() {
    localDirtyResumeIdsRef.current.clear();
    syncGlobalDirtyFlag();
  }

  function hasLocalDirty(resumeId) {
    return Boolean(resumeId && localDirtyResumeIdsRef.current.has(resumeId));
  }

  function hasAnyLocalDirty() {
    return localDirtyResumeIdsRef.current.size > 0;
  }

  function settleCloudSyncState() {
    if (!isOnline()) {
      setSyncState('offline');
      return;
    }

    if (cloudSaveQueueRef.current.size > 0 || hasAnyLocalDirty()) {
      setSyncState('syncing');
      return;
    }

    setSaveState('saved');
    setSyncState('saved');
  }

  function logCloudError(error) {
    if (import.meta.env.DEV) {
      console.error('Cloud sync failed', {
        code: error?.code,
        message: error?.message,
      });
    }
  }

  function getCloudSyncErrorMessage(error) {
    if (error?.code === 'resume/payload-too-large') {
      return 'This resume is too large to sync. Reduce extra entries or long pasted content and try again.';
    }

    if (error?.code === 'resume/too-many-entries' || error?.code === 'resume/too-many-highlights') {
      return 'This resume has too many entries to sync. Reduce this section and try again.';
    }

    return trustedDevice
      ? 'Cloud sync failed. Firestore will keep trying from this trusted device.'
      : 'Cloud sync failed. Your latest changes are still in this browser session.';
  }

  function runCloudMutation(createMutation) {
    try {
      const mutation = createMutation();

      if (!isOnline()) {
        setSyncState('offline');
        mutation.catch(logCloudError);
        return Promise.resolve(false);
      }

      setSyncState('syncing');
      return mutation
        .then(() => {
          setNotice((currentNotice) => (currentNotice?.tone === 'error' ? null : currentNotice));
          settleCloudSyncState();
          return true;
        })
        .catch((error) => {
          logCloudError(error);
          setSyncState(isOnline() ? 'error' : 'offline');
          setSaveState('error');
          setNotice({
            tone: 'error',
            message: getCloudSyncErrorMessage(error),
          });
          return false;
        });
    } catch (error) {
      logCloudError(error);
      setSyncState(isOnline() ? 'error' : 'offline');
      setSaveState('error');
      setNotice({
        tone: 'error',
        message: getCloudSyncErrorMessage(error),
      });
      return Promise.resolve(false);
    }
  }

  function mirrorCloudWorkspaceLocally(nextWorkspace, readDraft) {
    persistCloudWorkspaceMirror({
      uid: userRef.current?.uid,
      workspace: nextWorkspace,
      readDraft,
    });
  }

  function mirrorCloudDraftLocally(resumeId, nextWorkspace, draft) {
    persistCloudDraftMirror({
      uid: userRef.current?.uid,
      resumeId,
      workspace: nextWorkspace,
      draft,
    });
  }

  function scheduleCloudSave(resumeId, nextWorkspace, draft, reason = 'autosave') {
    if (!isCloudMode || !cloudReady || !user?.uid || !resumeId) {
      return;
    }

    const existingSave = cloudSaveQueueRef.current.get(resumeId);

    if (existingSave?.debounceTimer) {
      window.clearTimeout(existingSave.debounceTimer);
    }

    const pendingSave = {
      resumeId,
      workspace: nextWorkspace,
      draft,
      reason,
      debounceTimer: window.setTimeout(() => {
        flushCloudDraft(resumeId, nextWorkspace, draft);
      }, 2500),
      forceTimer: existingSave?.forceTimer || null,
    };

    if (!pendingSave.forceTimer) {
      pendingSave.forceTimer = window.setTimeout(() => {
        flushCloudDraft(resumeId, nextWorkspace, draft);
      }, 25000);
    }

    cloudSaveQueueRef.current.set(resumeId, pendingSave);
  }

  async function flushPendingCloudSaves({ reason = 'manual' } = {}) {
    const pendingSaves = Array.from(cloudSaveQueueRef.current.values());

    if (pendingSaves.length === 0) {
      return null;
    }

    const results = await Promise.all(pendingSaves.map((pendingSave) => (
      flushCloudDraft(pendingSave.resumeId, pendingSave.workspace, pendingSave.draft, { reason })
    )));

    return results;
  }

  async function flushActiveCloudDraft({ reason = 'manual' } = {}) {
    if (!isCloudMode || !userRef.current?.uid || !activeResumeIdRef.current) {
      return null;
    }

    const payload = persistActiveDraftImmediately({
      flushCloud: false,
      resumeId: activeResumeIdRef.current,
    });

    if (!payload) {
      return null;
    }

    const nextWorkspace = withWorkspaceResumeMeta(workspaceRef.current, activeResumeIdRef.current, {
      updatedAt: payload.savedAt,
    });
    const draft = {
      ...currentDraftRef.current,
      savedAt: payload.savedAt,
    };

    return flushCloudDraft(activeResumeIdRef.current, nextWorkspace, draft, { reason });
  }

  async function retryCloudSync() {
    await flushPendingCloudSaves({ reason: 'retry' });
    return flushActiveCloudDraft({ reason: 'retry' });
  }

  async function flushCloudDraft(
    resumeId = activeResumeIdRef.current,
    nextWorkspace = workspaceRef.current,
    draft = currentDraftRef.current,
    { reason = 'manual' } = {},
  ) {
    const currentUser = userRef.current;
    const shouldClearErrorNotice = reason !== 'pagehide';

    if (!currentUser?.uid || !resumeId || !cloudReady) {
      return null;
    }

    clearCloudSaveTimers(resumeId);
    setSyncState(isOnline() ? 'syncing' : 'offline');

    try {
      skipNextCloudSnapshotRef.current = true;
      const draftDoc = await writeCloudDraft(
        currentUser.uid,
        resumeId,
        nextWorkspace,
        draft,
        trustedDevice,
        cloudIdentityRef.current,
      );
      const mirroredDraft = {
        ...draft,
        savedAt: draftDoc?.savedAt || draft.savedAt || new Date().toISOString(),
      };

      clearResumeDirty(resumeId);
      lastRemoteVersionByResumeRef.current.set(resumeId, draftDoc?.version || 0);
      mirrorCloudDraftLocally(resumeId, nextWorkspace, mirroredDraft);
      setSavedAt(mirroredDraft.savedAt);
      setSaveState('saved');
      setSyncState(isOnline() ? 'saved' : 'offline');
      setNotice((currentNotice) => (
        currentNotice?.tone === 'error' && shouldClearErrorNotice
          ? null
          : currentNotice
      ));
      return draftDoc;
    } catch (error) {
      logCloudError(error);
      mirrorCloudDraftLocally(resumeId, nextWorkspace, draft);
      setSyncState(isOnline() ? 'error' : 'offline');
      setSaveState('error');
      setNotice({
        tone: 'error',
        message: getCloudSyncErrorMessage(error),
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
    if (resume.sections?.some((section) => section.id === sectionId)) {
      updateResume((currentResume) => moveResumeSectionBlock(currentResume, sectionId, direction));
      return;
    }

    setSectionOrder((currentOrder) => moveSectionOrder(currentOrder, sectionId, direction));
  }

  function reorderSection(sectionId, targetSectionId, placement) {
    setSaveState('saving');
    if (
      resume.sections?.some((section) => section.id === sectionId) &&
      resume.sections?.some((section) => section.id === targetSectionId)
    ) {
      updateResume((currentResume) => reorderResumeSectionBlock(currentResume, sectionId, targetSectionId, placement));
      return;
    }

    setSectionOrder((currentOrder) => reorderSectionOrder(currentOrder, sectionId, targetSectionId, placement));
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
    flushActiveCloudDraft({ reason: 'print' });

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
      mirrorCloudWorkspaceLocally(nextWorkspace);
      await flushCloudDraft(previousResumeId, nextWorkspaceBase, {
        resume,
        template,
        sectionOrder,
        savedAt: persistedPayload.savedAt,
      });
      await runCloudMutation(() => (
        writeCloudWorkspace(user.uid, nextWorkspace, trustedDevice, cloudIdentityRef.current)
      ));
      const cloudDraft = await readCloudDraft(user.uid, nextResumeId, trustedDevice, {
        cacheOnly: shouldReadFirestoreCache(trustedDevice),
      }).catch(() => null);
      const nextDraft = cloudDraft || readStoredResumeDraft(nextResumeId);
      mirrorCloudDraftLocally(nextResumeId, nextWorkspace, nextDraft);
      loadDraftIntoEditor(nextDraft);
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
    const nextPayload = createDraftPayload({
      resume: nextDraft.resume,
      template: nextDraft.template,
      sectionOrder: nextDraft.sectionOrder,
    });
    const nextPersistedDraft = {
      ...nextDraft,
      savedAt: nextPayload.savedAt,
    };

    if (!isCloudMode) {
      persistExistingDraftState(nextResumeId, nextPersistedDraft);
    }

    const nextWorkspace = {
      ...(persistedPayload
        ? withWorkspaceResumeMeta(workspace, activeResumeId, { updatedAt: persistedPayload.savedAt })
        : workspace),
      activeResumeId: nextResumeId,
      resumeIds: [...workspace.resumeIds, nextResumeId],
      meta: {
        ...workspace.meta,
        [nextResumeId]: createWorkspaceResumeMeta(nextResumeName, nextPayload.savedAt),
      },
    };

    commitWorkspace(nextWorkspace);

    if (isCloudMode && user?.uid) {
      mirrorCloudDraftLocally(nextResumeId, nextWorkspace, nextPersistedDraft);

      if (previousResumeId) {
        await flushCloudDraft(previousResumeId, nextWorkspace, {
          resume,
          template,
          sectionOrder,
          savedAt: persistedPayload.savedAt,
        });
      }

      await runCloudMutation(() => (
        writeCloudDraft(user.uid, nextResumeId, nextWorkspace, nextPersistedDraft, trustedDevice, cloudIdentityRef.current)
      ));
    }

    loadDraftIntoEditor(nextPersistedDraft, { focusPersonal: true });
  }

  function createImportPlaceholderResume({ sourceFileName = '' } = {}) {
    if (!canAddResume) {
      setNotice({
        tone: 'error',
        message: isCloudMode
          ? `You can keep up to ${CLOUD_WORKSPACE_RESUME_LIMIT} cloud resumes.`
          : `Guests can keep up to ${MAX_WORKSPACE_RESUMES} local resumes.`,
      });
      return null;
    }

    const previousResumeId = activeResumeId;
    const persistedPayload = persistActiveDraftImmediately({ flushCloud: false, resumeId: previousResumeId });

    if (!persistedPayload && activeResumeId) {
      return null;
    }

    const existingNames = workspace.resumeIds.map((resumeId) => workspace.meta[resumeId]?.name || '');
    const sourceName = sourceFileName.replace(/\.[^.]+$/, '');
    const nextResumeId = createWorkspaceResumeId();
    const nextResumeName = sanitizeWorkspaceResumeName(sourceName, createNextResumeName(existingNames));
    const nextDraft = createBlankDraftState();
    const nextPayload = createDraftPayload({
      resume: nextDraft.resume,
      template: nextDraft.template,
      sectionOrder: nextDraft.sectionOrder,
    });
    const nextPersistedDraft = {
      ...nextDraft,
      savedAt: nextPayload.savedAt,
    };
    const nextWorkspace = {
      ...(persistedPayload
        ? withWorkspaceResumeMeta(workspace, activeResumeId, { updatedAt: persistedPayload.savedAt })
        : workspace),
      activeResumeId: nextResumeId,
      resumeIds: [...workspace.resumeIds, nextResumeId],
      meta: {
        ...workspace.meta,
        [nextResumeId]: createWorkspaceResumeMeta(nextResumeName, nextPayload.savedAt),
      },
    };

    if (!isCloudMode) {
      persistExistingDraftState(nextResumeId, nextPersistedDraft);
    }

    commitWorkspace(nextWorkspace);

    if (isCloudMode && user?.uid) {
      mirrorCloudDraftLocally(nextResumeId, nextWorkspace, nextPersistedDraft);

      if (previousResumeId) {
        runCloudMutation(() => (
          writeCloudDraft(
            user.uid,
            previousResumeId,
            nextWorkspace,
            {
              resume,
              template,
              sectionOrder,
              savedAt: persistedPayload.savedAt,
            },
            trustedDevice,
            cloudIdentityRef.current,
          )
        ));
      }

      flushCloudDraft(nextResumeId, nextWorkspace, nextPersistedDraft, { reason: 'import-placeholder' });
    }

    loadDraftIntoEditor(nextPersistedDraft, { focusPersonal: true });
    return nextResumeId;
  }

  async function replaceResumeDraft(resumeId, importedDraft, { name } = {}) {
    const currentWorkspace = workspaceRef.current;

    if (!resumeId || !currentWorkspace.resumeIds.includes(resumeId)) {
      setNotice({
        tone: 'error',
        message: 'The import finished, but the new resume was removed before it could be filled.',
      });
      return false;
    }

    const normalizedDraft = normalizeDraftPayload(importedDraft);
    const payload = createDraftPayload({
      resume: normalizedDraft.resume,
      template: normalizedDraft.template,
      sectionOrder: normalizedDraft.sectionOrder,
    });
    const nextDraft = {
      resume: payload.resume,
      template: payload.template,
      sectionOrder: payload.sectionOrder,
      savedAt: payload.savedAt,
    };
    const existingName = currentWorkspace.meta[resumeId]?.name || 'Imported resume';
    const nextName = sanitizeWorkspaceResumeName(name, existingName);
    const nextWorkspace = {
      ...withWorkspaceResumeMeta(currentWorkspace, resumeId, {
        name: nextName,
        updatedAt: payload.savedAt,
      }),
      activeResumeId: resumeId,
    };

    clearCloudSaveTimers(resumeId);

    if (!isCloudMode) {
      persistExistingDraftState(resumeId, nextDraft);
    }

    commitWorkspace(nextWorkspace);

    if (isCloudMode && userRef.current?.uid) {
      mirrorCloudDraftLocally(resumeId, nextWorkspace, nextDraft);
    }

    loadDraftIntoEditor(nextDraft, { focusPersonal: true });

    if (isCloudMode && userRef.current?.uid) {
      const savedDraft = await flushCloudDraft(resumeId, nextWorkspace, nextDraft, { reason: 'import-replace' });

      if (!savedDraft && isOnline()) {
        return true;
      }
    }

    return true;
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
      mirrorCloudDraftLocally(nextResumeId, nextWorkspace, {
        resume: duplicatedDraft.resume,
        template: duplicatedDraft.template,
        sectionOrder: duplicatedDraft.sectionOrder,
        savedAt: duplicatePayload.savedAt,
      });

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
          cloudIdentityRef.current,
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

  function renameResume(resumeId, nextName) {
    const targetResumeId = resumeId || activeResumeId;
    const currentName = workspace.meta[targetResumeId]?.name || '';
    const trimmedName = sanitizeWorkspaceResumeName(nextName, currentName);

    if (!trimmedName || !targetResumeId || trimmedName === workspace.meta[targetResumeId]?.name) {
      return;
    }

    const renamedAt = new Date().toISOString();
    const nextWorkspace = withWorkspaceResumeMeta(workspace, targetResumeId, {
      name: trimmedName,
      updatedAt: renamedAt,
    });
    commitWorkspace(nextWorkspace);

    if (isCloudMode && user?.uid) {
      mirrorCloudWorkspaceLocally(nextWorkspace);

      if (targetResumeId === activeResumeId) {
        mirrorCloudDraftLocally(targetResumeId, nextWorkspace, currentDraftRef.current);
      }

      runCloudMutation(() => (
        renameCloudResume(user.uid, targetResumeId, nextWorkspace, trustedDevice, cloudIdentityRef.current)
      ));
    }
  }

  async function deleteActiveResume() {
    if (!activeResumeId || workspace.resumeIds.length <= 1) {
      return;
    }

    if (isCloudMode && !trustedDevice && !isOnline()) {
      setSyncState('offline');
      setNotice({
        tone: 'error',
        message: 'Reconnect before deleting cloud resumes from an untrusted device.',
      });
      return;
    }

    const deletedResumeId = activeResumeId;
    clearCloudSaveTimers(deletedResumeId);
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

    if (isCloudMode && user?.uid) {
      const cloudDeleteSucceeded = await runCloudMutation(() => (
        deleteCloudResume(user.uid, deletedResumeId, nextWorkspace, trustedDevice, cloudIdentityRef.current)
      ));

      if (!cloudDeleteSucceeded && isOnline()) {
        return;
      }
    }

    clearResumeDirty(deletedResumeId);
    setConflict((currentConflict) => (
      currentConflict?.resumeId === deletedResumeId ? null : currentConflict
    ));
    window.localStorage.removeItem(createResumeStorageKey(deletedResumeId));
    commitWorkspace(nextWorkspace);

    if (isCloudMode && user?.uid) {
      mirrorCloudWorkspaceLocally(nextWorkspace);
    }

    loadDraftIntoEditor(readStoredResumeDraft(nextResumeId));
    settleCloudSyncState();

    if (isCloudMode && user?.uid) {
      const cloudDraft = await readCloudDraft(user.uid, nextResumeId, trustedDevice, {
        cacheOnly: shouldReadFirestoreCache(trustedDevice),
      }).catch(() => null);
      const nextDraft = cloudDraft || readStoredResumeDraft(nextResumeId);
      mirrorCloudDraftLocally(nextResumeId, nextWorkspace, nextDraft);
      loadDraftIntoEditor(nextDraft);
      settleCloudSyncState();
    }
  }

  function useCloudConflictVersion() {
    if (!conflict?.remoteDraft) {
      return;
    }

    skipNextAutosaveRef.current = true;
    mirrorCloudDraftLocally(conflict.resumeId || activeResumeId, workspace, conflict.remoteDraft);
    loadDraftIntoEditor(conflict.remoteDraft);
    clearResumeDirty(conflict.resumeId || activeResumeId);
    setConflict(null);
    setSyncState('saved');
  }

  function keepLocalConflictVersion() {
    setConflict(null);
    markResumeDirty(conflict?.resumeId || activeResumeId);
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
    const originalResumeId = conflict.resumeId || activeResumeId;
    const nextWorkspace = {
      ...workspace,
      activeResumeId: originalResumeId,
      resumeIds: [...workspace.resumeIds, nextResumeId],
      meta: {
        ...workspace.meta,
        [nextResumeId]: createWorkspaceResumeMeta(duplicateName, duplicatePayload.savedAt),
      },
    };

    commitWorkspace(nextWorkspace);

    if (user?.uid) {
      mirrorCloudDraftLocally(nextResumeId, nextWorkspace, {
        resume: localDraft.resume,
        template: localDraft.template,
        sectionOrder: localDraft.sectionOrder,
        savedAt: duplicatePayload.savedAt,
      });

      const copySaved = await runCloudMutation(() => (
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
          cloudIdentityRef.current,
        )
      ));

      if (!copySaved && isOnline()) {
        return;
      }
    }

    skipNextAutosaveRef.current = true;
    loadDraftIntoEditor(conflict.remoteDraft);
    clearResumeDirty(originalResumeId);
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
    removeResumeSection(sectionId) {
      updateResume((currentResume) => removeResumeSectionBlock(currentResume, sectionId));
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
    updateRoleBlockEntry(sectionId, entryId, field, value) {
      updateResume((currentResume) => updateRoleBlockEntry(currentResume, sectionId, entryId, field, value));
    },
    addRoleBlockEntry(sectionId) {
      updateResume((currentResume) => addRoleBlockEntry(currentResume, sectionId));
    },
    moveRoleBlockEntry(sectionId, entryId, direction) {
      updateResume((currentResume) => moveRoleBlockEntry(currentResume, sectionId, entryId, direction));
    },
    removeRoleBlockEntry(sectionId, entryId) {
      updateResume((currentResume) => removeRoleBlockEntry(currentResume, sectionId, entryId));
    },
    updateRoleBlockActivity(sectionId, entryId, activityIndex, value) {
      updateResume((currentResume) => updateRoleBlockActivity(currentResume, sectionId, entryId, activityIndex, value));
    },
    addRoleBlockActivity(sectionId, entryId) {
      updateResume((currentResume) => addRoleBlockActivity(currentResume, sectionId, entryId));
    },
    moveRoleBlockActivity(sectionId, entryId, activityIndex, direction) {
      updateResume((currentResume) => moveRoleBlockActivity(currentResume, sectionId, entryId, activityIndex, direction));
    },
    removeRoleBlockActivity(sectionId, entryId, activityIndex) {
      updateResume((currentResume) => removeRoleBlockActivity(currentResume, sectionId, entryId, activityIndex));
    },
    updateSectionBlockEntry(sectionId, entryId, field, value) {
      updateResume((currentResume) => updateSectionBlockEntry(currentResume, sectionId, entryId, field, value));
    },
    addSectionBlockEntry(sectionId) {
      updateResume((currentResume) => addSectionBlockEntry(currentResume, sectionId));
    },
    moveSectionBlockEntry(sectionId, entryId, direction) {
      updateResume((currentResume) => moveSectionBlockEntry(currentResume, sectionId, entryId, direction));
    },
    removeSectionBlockEntry(sectionId, entryId) {
      updateResume((currentResume) => removeSectionBlockEntry(currentResume, sectionId, entryId));
    },
    updateSectionBlockTextList(sectionId, entryId, field, itemIndex, value) {
      updateResume((currentResume) => updateSectionBlockTextList(currentResume, sectionId, entryId, field, itemIndex, value));
    },
    addSectionBlockTextListItem(sectionId, entryId, field) {
      updateResume((currentResume) => addSectionBlockTextListItem(currentResume, sectionId, entryId, field));
    },
    moveSectionBlockTextListItem(sectionId, entryId, field, itemIndex, direction) {
      updateResume((currentResume) => moveSectionBlockTextListItem(currentResume, sectionId, entryId, field, itemIndex, direction));
    },
    removeSectionBlockTextListItem(sectionId, entryId, field, itemIndex) {
      updateResume((currentResume) => removeSectionBlockTextListItem(currentResume, sectionId, entryId, field, itemIndex));
    },
    updateSectionBlockEducationCustomSection(sectionId, entryId, sectionIndex, field, value) {
      updateResume((currentResume) => updateSectionBlockEducationCustomSection(currentResume, sectionId, entryId, sectionIndex, field, value));
    },
    addSectionBlockEducationCustomSection(sectionId, entryId) {
      updateResume((currentResume) => addSectionBlockEducationCustomSection(currentResume, sectionId, entryId));
    },
    moveSectionBlockEducationCustomSection(sectionId, entryId, sectionIndex, direction) {
      updateResume((currentResume) => moveSectionBlockEducationCustomSection(currentResume, sectionId, entryId, sectionIndex, direction));
    },
    removeSectionBlockEducationCustomSection(sectionId, entryId, sectionIndex) {
      updateResume((currentResume) => removeSectionBlockEducationCustomSection(currentResume, sectionId, entryId, sectionIndex));
    },
    updateSectionBlockEducationProgram(sectionId, entryId, programIndex, field, value) {
      updateResume((currentResume) => updateSectionBlockEducationProgram(currentResume, sectionId, entryId, programIndex, field, value));
    },
    addSectionBlockEducationProgram(sectionId, entryId) {
      updateResume((currentResume) => addSectionBlockEducationProgram(currentResume, sectionId, entryId));
    },
    moveSectionBlockEducationProgram(sectionId, entryId, programIndex, direction) {
      updateResume((currentResume) => moveSectionBlockEducationProgram(currentResume, sectionId, entryId, programIndex, direction));
    },
    removeSectionBlockEducationProgram(sectionId, entryId, programIndex) {
      updateResume((currentResume) => removeSectionBlockEducationProgram(currentResume, sectionId, entryId, programIndex));
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
    reorderSection,
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
    showNotice(nextNotice) {
      setNotice(nextNotice);
    },
    dismissNotice() {
      setNotice(null);
    },
    conflict,
    resolveConflictWithCloud: useCloudConflictVersion,
    resolveConflictWithLocal: keepLocalConflictVersion,
    saveConflictAsCopy,
    retryCloudSync,
    flushActiveCloudDraft,
    saveState,
    saveLabel: saveState === 'saving'
      ? 'Saving…'
      : saveState === 'error'
        ? isCloudMode && syncState === 'offline' ? formatSavedAt(savedAt, { cloudMode: isCloudMode, syncState, trustedDevice }) : 'Autosave unavailable'
        : formatSavedAt(savedAt, { cloudMode: isCloudMode, syncState, trustedDevice }),
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
    createImportPlaceholderResume,
    replaceResumeDraft,
    duplicateActiveResume,
    renameActiveResume: renameResume,
    deleteActiveResume,
  };
}
