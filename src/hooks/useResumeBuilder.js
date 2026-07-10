import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  DEFAULT_TEMPLATE,
  MAX_WORKSPACE_RESUMES,
  TEMPLATE_OPTIONS,
  addResumeSectionBlock,
  addRoleBlockActivity,
  addRoleBlockEntry,
  addSectionBlockEducationCustomSection,
  addSectionBlockEducationProgram,
  addSectionBlockEntry,
  addSectionBlockTextListItem,
  commitSectionTitle,
  createDuplicateResumeName,
  createEmptyResume,
  createNextResumeName,
  createWorkspaceResumeId,
  createWorkspaceResumeMeta,
  getPreviewModel,
  moveResumeSectionBlock,
  moveRoleBlockActivity,
  moveRoleBlockEntry,
  moveSectionBlockEducationCustomSection,
  moveSectionBlockEducationProgram,
  moveSectionBlockEntry,
  moveSectionBlockTextListItem,
  materializeAndReorderSectionBlockEntries,
  normalizeDraftPayload,
  normalizeWorkspaceIndex,
  removeResumeSectionBlock,
  removeRoleBlockActivity,
  removeRoleBlockEntry,
  removeSectionBlockEducationCustomSection,
  removeSectionBlockEducationProgram,
  removeSectionBlockEntry,
  removeSectionBlockTextListItem,
  reorderSectionBlockEntriesToMatch,
  reorderSectionBlockTextListItem,
  reorderResumeSectionBlock,
  reorderResumeSectionBlocksToMatch,
  reorderWorkspaceResumes,
  reorderWorkspaceResumesToMatch,
  sanitizeWorkspaceResumeName,
  setPersonalContactOrder,
  setSampleTextListOrder,
  setResumeSettingValue,
  setResumeSummaryWidthPercent,
  setSectionEntryHeaderLayout,
  updatePersonalField,
  updateResumeSetting as updateResumeSettingValue,
  updateSampleDisplay,
  updateRoleBlockActivity,
  updateRoleBlockEntry,
  updateSectionBlockEducationCustomSection,
  updateSectionBlockEducationProgram,
  updateSectionBlockEntry,
  updateSectionBlockTextList,
  updateSectionTitle,
  validateResume,
} from '../lib/resume.js';
import {
  createSavedDraftState,
  initializeLocalWorkspace,
  mergeLocalAndCloudWorkspaces,
  persistLocalDraftSnapshot,
  persistLocalResumeDelete,
  persistLocalWorkspaceSnapshot,
  persistLoginMergedWorkspace,
  readLocalWorkspaceBundle,
  readLocalDraft,
  readLegacyWorkspaceSnapshot,
} from '../lib/localWorkspaceDb.js';
import {
  createResumeSyncSession,
  pullCloudWorkspaceSnapshot,
  registerResumeSyncWorker,
  requestResumeBackgroundSync,
  syncLocalOutbox,
} from '../lib/backgroundSync.js';

function createBlankDraftState() {
  return {
    resume: createEmptyResume(),
    template: DEFAULT_TEMPLATE,
    savedAt: null,
  };
}

function getDraftEditorSectionIds(draft) {
  const blockIds = Array.isArray(draft?.resume?.sections)
    ? draft.resume.sections.map((section) => section.id).filter(Boolean)
    : [];

  return ['personal', ...blockIds];
}

function formatSavedAt(savedAt, { cloudMode = false, syncState = 'idle' } = {}) {
  if (cloudMode && syncState === 'syncing') {
    return 'Saved locally • syncing';
  }

  if (cloudMode && syncState === 'offline') {
    return 'Saved locally • queued';
  }

  if (cloudMode && syncState === 'error') {
    return 'Saved locally • cloud unavailable';
  }

  if (cloudMode && syncState === 'stale') {
    return 'Saved locally • review sync';
  }

  if (!savedAt) {
    return 'Autosave ready';
  }

  const date = new Date(savedAt);

  if (Number.isNaN(date.getTime())) {
    return 'Saved locally';
  }

  return `Saved locally ${date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;
}

function isOnline() {
  return typeof navigator === 'undefined' || navigator.onLine;
}

function withWorkspaceResumeMeta(workspace, resumeId, updates) {
  if (!resumeId || !workspace.meta[resumeId]) {
    return normalizeWorkspaceIndex(workspace);
  }

  return normalizeWorkspaceIndex({
    ...workspace,
    meta: {
      ...workspace.meta,
      [resumeId]: {
        ...workspace.meta[resumeId],
        ...updates,
      },
    },
  });
}

function withoutWorkspaceResume(workspace, resumeId) {
  const normalizedWorkspace = normalizeWorkspaceIndex(workspace);
  const nextResumeIds = normalizedWorkspace.resumeIds.filter((id) => id !== resumeId);
  const nextMeta = { ...normalizedWorkspace.meta };
  delete nextMeta[resumeId];

  return normalizeWorkspaceIndex({
    activeResumeId: nextResumeIds[0] || '',
    resumeIds: nextResumeIds,
    meta: nextMeta,
  });
}

function normalizeCloudSnapshot(payload) {
  if (!payload?.workspace || !payload?.drafts || typeof payload.drafts !== 'object') {
    return null;
  }

  const workspace = normalizeWorkspaceIndex(payload.workspace);
  const draftsByResumeId = new Map();

  workspace.resumeIds.forEach((resumeId) => {
    const draft = payload.drafts[resumeId];

    if (draft) {
      const normalizedDraft = normalizeDraftPayload(draft);
      draftsByResumeId.set(resumeId, {
        resume: normalizedDraft.resume,
        template: normalizedDraft.template,
        savedAt: draft.savedAt || null,
      });
    }
  });

  if (workspace.resumeIds.length === 0 || draftsByResumeId.size === 0) {
    return null;
  }

  return {
    workspace,
    draftsByResumeId,
    activeResumeId: workspace.activeResumeId || workspace.resumeIds[0],
  };
}

export function useResumeBuilder({ user = null, authReady = true } = {}) {
  const initialWorkspaceState = useMemo(() => readLegacyWorkspaceSnapshot(), []);
  const [workspace, setWorkspace] = useState(initialWorkspaceState.workspace);
  const [resume, setResume] = useState(initialWorkspaceState.draft.resume);
  const [template, setTemplate] = useState(initialWorkspaceState.draft.template);
  const [activeTab, setActiveTab] = useState('personal');
  const [mobileView, setMobileView] = useState('editor');
  const [touched, setTouched] = useState({});
  const [showAllErrors, setShowAllErrors] = useState(false);
  const [saveState, setSaveState] = useState('idle');
  const [savedAt, setSavedAt] = useState(initialWorkspaceState.draft.savedAt);
  const [notice, setNotice] = useState(null);
  const [conflict, setConflict] = useState(null);
  const [syncState, setSyncState] = useState('idle');
  const [localReady, setLocalReady] = useState(false);
  const hasMounted = useRef(false);
  const skipNextAutosaveRef = useRef(false);
  const currentDraftRef = useRef(initialWorkspaceState.draft);
  const editorDraftResumeIdRef = useRef(initialWorkspaceState.workspace.activeResumeId);
  const editorDraftRevisionRef = useRef(initialWorkspaceState.draft.localRevision || '');
  const workspaceRef = useRef(initialWorkspaceState.workspace);
  const activeResumeIdRef = useRef(initialWorkspaceState.workspace.activeResumeId);
  const userRef = useRef(user);
  const printViewRef = useRef(null);
  const mobileViewRef = useRef('editor');
  const syncTimerRef = useRef(null);
  const bootstrapRunIdRef = useRef(0);
  const resumeLoadRunIdRef = useRef(0);
  const editorMutationVersionRef = useRef(0);
  const editorSaveQueueRef = useRef(Promise.resolve());
  const draftRevisionByResumeIdRef = useRef(new Map([
    [initialWorkspaceState.workspace.activeResumeId, initialWorkspaceState.draft.localRevision || ''],
  ]));
  const conflictRef = useRef(null);
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
  const canAddResume = workspace.resumeIds.length < MAX_WORKSPACE_RESUMES;

  useEffect(() => {
    const localRevision = editorDraftRevisionRef.current || currentDraftRef.current.localRevision || '';

    currentDraftRef.current = {
      resume,
      template,
      savedAt,
      localRevision,
    };
  }, [resume, savedAt, template]);

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
    conflictRef.current = conflict;
  }, [conflict]);

  useEffect(() => {
    mobileViewRef.current = mobileView;
  }, [mobileView]);

  useEffect(() => {
    registerResumeSyncWorker();
  }, []);

  useEffect(() => {
    let cancelled = false;

    initializeLocalWorkspace()
      .then((snapshot) => {
        if (cancelled) {
          return;
        }

        skipNextAutosaveRef.current = true;
        commitWorkspace(snapshot.workspace, { persist: false });
        loadDraftIntoEditor(snapshot.draft, { resumeId: snapshot.activeResumeId });
        setLocalReady(true);
      })
      .catch(() => {
        if (!cancelled) {
          setLocalReady(true);
          setNotice({ tone: 'error', message: 'Local storage is unavailable. Keep this tab open until your changes are saved.' });
        }
      });

    return () => {
      cancelled = true;
    };
  // Initial local database hydration should run once.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hasMounted.current) {
      hasMounted.current = true;
      return;
    }

    if (!localReady || skipNextAutosaveRef.current) {
      skipNextAutosaveRef.current = false;
      return;
    }

    if (!activeResumeId || editorDraftResumeIdRef.current !== activeResumeId) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      saveEditorDraftFromRefs({ reason: 'autosave' });
    }, 180);

    return () => window.clearTimeout(timeoutId);
  // Autosave should track editor content only; persistence helpers read current refs.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeResumeId, localReady, resume, template]);

  useEffect(() => {
    if (!authReady || !localReady) {
      return;
    }

    const runId = bootstrapRunIdRef.current + 1;
    bootstrapRunIdRef.current = runId;

    if (!user) {
      setSyncState('idle');
      return;
    }

    async function bootstrapSignedInSync() {
      try {
        setSyncState(isOnline() ? 'syncing' : 'offline');
        const idToken = await user.getIdToken();
        await createResumeSyncSession(idToken);
        const cloudSnapshot = normalizeCloudSnapshot(await pullCloudWorkspaceSnapshot(idToken));

        const preMergeSave = await saveEditorDraftFromRefs({
          reason: 'login-premerge',
          scheduleSync: false,
        });

        if (preMergeSave?.conflict || preMergeSave?.error) {
          return;
        }

        const editorVersionAtMerge = editorMutationVersionRef.current;
        const localBundle = await readLocalWorkspaceBundle();

        if (bootstrapRunIdRef.current !== runId) {
          return;
        }

        const mergeResult = mergeLocalAndCloudWorkspaces({
          localWorkspace: localBundle.workspace,
          localDraftsByResumeId: localBundle.draftsByResumeId,
          cloudWorkspace: cloudSnapshot?.workspace,
          cloudDraftsByResumeId: cloudSnapshot?.draftsByResumeId,
          tombstones: localBundle.tombstones,
          pendingOutbox: localBundle.pendingOutbox,
        });

        await persistLoginMergedWorkspace({
          mergeResult,
          account: user,
          accountUid: user.uid,
          reason: 'login-merge',
        });

        if (bootstrapRunIdRef.current !== runId) {
          return;
        }

        if (editorMutationVersionRef.current !== editorVersionAtMerge) {
          const currentEditorResumeId = editorDraftResumeIdRef.current;
          const preservesCurrentEditor = mergeResult.workspace.resumeIds.includes(currentEditorResumeId);
          const nextWorkspace = preservesCurrentEditor
            ? normalizeWorkspaceIndex({
              ...mergeResult.workspace,
              activeResumeId: currentEditorResumeId,
            })
            : mergeResult.workspace;

          commitWorkspace(nextWorkspace, { persist: false });

          if (preservesCurrentEditor) {
            const storedDraft = await readLocalDraft(currentEditorResumeId);
            editorDraftRevisionRef.current = storedDraft.localRevision || '';
            draftRevisionByResumeIdRef.current.set(currentEditorResumeId, storedDraft.localRevision || '');
            currentDraftRef.current = {
              ...currentDraftRef.current,
              localRevision: editorDraftRevisionRef.current,
            };
            await saveEditorDraftFromRefs({
              reason: 'login-concurrent-edit',
              scheduleSync: false,
            });
          }
        } else {
          const nextDraft = mergeResult.draftsByResumeId.get(mergeResult.activeResumeId);

          if (nextDraft) {
            skipNextAutosaveRef.current = true;
            commitWorkspace(mergeResult.workspace, { persist: false });
            loadDraftIntoEditor(nextDraft, { resumeId: mergeResult.activeResumeId });
          }
        }

        const mergeWarning = mergeResult.warnings[0] || '';

        await flushCloudQueue({ reason: 'login', immediate: true });

        if (mergeWarning && bootstrapRunIdRef.current === runId) {
          setNotice({
            tone: 'warning',
            message: mergeWarning,
          });
        }
      } catch {
        if (bootstrapRunIdRef.current === runId) {
          setSyncState(isOnline() ? 'error' : 'offline');
          setNotice({
            tone: 'error',
            message: 'Cloud sync is unavailable. Your local draft is still editable.',
          });
        }
      }
    }

    bootstrapSignedInSync();
  // Auth bootstrap should run only when the signed-in account or local readiness changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, localReady, user?.uid]);

  useEffect(() => {
    function handleBeforePrint() {
      preparePrintView();
    }

    function handleAfterPrint() {
      if (printViewRef.current !== null) {
        const previousView = printViewRef.current;
        printViewRef.current = null;
        setMobileView(previousView);
      }
    }

    window.addEventListener('beforeprint', handleBeforePrint);
    window.addEventListener('afterprint', handleAfterPrint);
    return () => {
      window.removeEventListener('beforeprint', handleBeforePrint);
      window.removeEventListener('afterprint', handleAfterPrint);
    };
  }, []);

  useEffect(() => {
    function handleOnline() {
      flushCloudQueue({ reason: 'online', immediate: true });
    }

    function handlePageExit() {
      saveEditorDraftFromRefs({ reason: 'pagehide', scheduleSync: false });
      requestResumeBackgroundSync();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        saveEditorDraftFromRefs({ reason: 'visibilitychange', scheduleSync: false });
        requestResumeBackgroundSync();
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
  // Handlers use refs and should bind once.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => {
    if (syncTimerRef.current) {
      window.clearTimeout(syncTimerRef.current);
    }
  }, []);

  function resetValidationState() {
    setTouched({});
    setShowAllErrors(false);
  }

  function loadDraftIntoEditor(nextDraft, {
    focusPersonal = false,
    resumeId = activeResumeIdRef.current,
    loadRequestId = null,
  } = {}) {
    if (loadRequestId !== null && loadRequestId !== resumeLoadRunIdRef.current) {
      return false;
    }

    if (loadRequestId === null) {
      resumeLoadRunIdRef.current += 1;
    }

    const normalizedDraft = normalizeDraftPayload(nextDraft);
    const draftState = {
      resume: normalizedDraft.resume,
      template: normalizedDraft.template,
      savedAt: nextDraft?.savedAt || null,
      localRevision: nextDraft?.localRevision || normalizedDraft.localRevision || '',
    };
    const nextSectionIds = getDraftEditorSectionIds(draftState);

    skipNextAutosaveRef.current = true;
    currentDraftRef.current = draftState;
    editorDraftResumeIdRef.current = resumeId;
    editorDraftRevisionRef.current = draftState.localRevision || '';
    draftRevisionByResumeIdRef.current.set(resumeId, draftState.localRevision || '');
    editorMutationVersionRef.current += 1;
    conflictRef.current = null;
    setConflict(null);
    setResume(draftState.resume);
    setTemplate(draftState.template);
    setSavedAt(draftState.savedAt);
    setSaveState(draftState.savedAt ? 'saved' : 'idle');
    resetValidationState();

    if (focusPersonal || !nextSectionIds.includes(activeTab)) {
      setActiveTab('personal');
    }

    return true;
  }

  function commitWorkspace(nextWorkspace, { persist = true, enqueueSync = true, reason = 'workspace' } = {}) {
    const normalizedWorkspace = normalizeWorkspaceIndex(nextWorkspace);
    workspaceRef.current = normalizedWorkspace;
    activeResumeIdRef.current = normalizedWorkspace.activeResumeId;
    setWorkspace(normalizedWorkspace);

    if (persist) {
      persistLocalWorkspaceSnapshot({
        workspace: normalizedWorkspace,
        accountUid: userRef.current?.uid || '',
        enqueueSync,
        reason,
      }).then(() => {
        if (enqueueSync) {
          scheduleCloudSync(reason);
        }
      }).catch(() => {
        setSaveState('error');
        setNotice({ tone: 'error', message: 'Local autosave failed in this browser.' });
      });
    }
  }

  function scheduleCloudSync(reason = 'autosave', delay = 2500) {
    if (!userRef.current?.uid) {
      return;
    }

    if (syncTimerRef.current) {
      window.clearTimeout(syncTimerRef.current);
    }

    setSyncState(isOnline() ? 'syncing' : 'offline');
    syncTimerRef.current = window.setTimeout(() => {
      flushCloudQueue({ reason });
    }, delay);
    requestResumeBackgroundSync();
  }

  async function flushCloudQueue({ immediate = false } = {}) {
    const currentUser = userRef.current;

    if (!currentUser?.uid) {
      return true;
    }

    if (!isOnline()) {
      setSyncState('offline');
      await requestResumeBackgroundSync();
      return false;
    }

    if (syncTimerRef.current) {
      window.clearTimeout(syncTimerRef.current);
      syncTimerRef.current = null;
    }

    try {
      setSyncState('syncing');
      const idToken = await currentUser.getIdToken();
      await createResumeSyncSession(idToken);
      let result = null;

      for (let pass = 0; pass < 5; pass += 1) {
        result = await syncLocalOutbox({ idToken, accountUid: currentUser.uid });

        if (result.staleCount > 0 || result.status === 'stale') {
          setSyncState('stale');
          setNotice({
            tone: 'warning',
            message: 'Some cloud changes were skipped because a newer version already exists. Your local draft is still saved.',
          });
          return false;
        }

        if (result.pendingCount === 0) {
          setSyncState('saved');
          setNotice((currentNotice) => (currentNotice?.tone === 'error' || currentNotice?.tone === 'warning' ? null : currentNotice));
          return true;
        }
      }

      setSyncState('syncing');
      return false;
    } catch {
      setSyncState(isOnline() ? 'error' : 'offline');

      if (immediate) {
        setNotice({
          tone: 'error',
          message: 'Cloud sync is unavailable. Your local draft is still editable.',
        });
      }

      return false;
    }
  }

  function saveEditorDraftFromRefs({ reason = 'manual', scheduleSync = true, persistWorkspace = true, allowStaleOverwrite = false } = {}) {
    const resumeId = editorDraftResumeIdRef.current;
    const draftSnapshot = currentDraftRef.current;
    const accountUid = userRef.current?.uid || '';

    if (!resumeId || !draftSnapshot) {
      return Promise.resolve({ skipped: true });
    }

    if (!allowStaleOverwrite && conflictRef.current?.resumeId === resumeId) {
      return Promise.resolve({
        conflict: true,
        draft: conflictRef.current.storedDraft,
      });
    }

    const nextDraft = createSavedDraftState(draftSnapshot);

    if (editorDraftResumeIdRef.current === resumeId) {
      setSavedAt(nextDraft.savedAt);
      setSaveState('saving');
      currentDraftRef.current = {
        ...currentDraftRef.current,
        savedAt: nextDraft.savedAt,
      };
    }

    const saveOperation = editorSaveQueueRef.current.then(async () => {
      if (!workspaceRef.current.resumeIds.includes(resumeId)) {
        return { skipped: true };
      }

      const expectedRevision = draftRevisionByResumeIdRef.current.get(resumeId)
        || draftSnapshot.localRevision
        || '';
      const nextWorkspace = withWorkspaceResumeMeta(workspaceRef.current, resumeId, {
        updatedAt: nextDraft.savedAt,
      });

      if (persistWorkspace) {
        workspaceRef.current = nextWorkspace;
        setWorkspace(nextWorkspace);
      }

      try {
        const result = await persistLocalDraftSnapshot({
          resumeId,
          workspace: nextWorkspace,
          draft: nextDraft,
          accountUid,
          enqueueSync: true,
          persistWorkspace,
          reason,
          expectedRevision,
          allowStaleOverwrite,
        });

        if (result?.conflict) {
          if (editorDraftResumeIdRef.current === resumeId) {
            const nextConflict = {
              resumeId,
              localDraft: nextDraft,
              storedDraft: result.draft,
            };

            conflictRef.current = nextConflict;
            setConflict(nextConflict);
            setSaveState('conflict');
            setNotice({
              tone: 'warning',
              message: 'This resume changed in another tab. Choose which version to keep.',
            });
          }

          return result;
        }

        if (result?.draft?.localRevision) {
          draftRevisionByResumeIdRef.current.set(resumeId, result.draft.localRevision);

          if (editorDraftResumeIdRef.current === resumeId) {
            editorDraftRevisionRef.current = result.draft.localRevision;
            currentDraftRef.current = {
              ...currentDraftRef.current,
              localRevision: result.draft.localRevision,
            };

            setSavedAt(result.draft.savedAt);
            setSaveState('saved');

            if (allowStaleOverwrite && conflictRef.current?.resumeId === resumeId) {
              conflictRef.current = null;
              setConflict(null);
            }
          }
        }

        if (scheduleSync) {
          scheduleCloudSync(reason);
        }

        return result;
      } catch (error) {
        if (editorDraftResumeIdRef.current === resumeId) {
          setSaveState('error');
          setNotice({ tone: 'error', message: 'Local autosave failed in this browser.' });
        }

        return { error: true, cause: error };
      }
    });

    editorSaveQueueRef.current = saveOperation.then(() => undefined, () => undefined);
    return saveOperation;
  }

  function persistCurrentEditorDraft(options = {}) {
    return saveEditorDraftFromRefs(options);
  }

  function updateResume(transform) {
    setSaveState('saving');
    editorMutationVersionRef.current += 1;
    setResume((currentResume) => {
      const nextResume = transform(currentResume);

      currentDraftRef.current = {
        ...currentDraftRef.current,
        resume: nextResume,
      };

      return nextResume;
    });
  }

  function changeTemplate(nextTemplate) {
    setSaveState('saving');
    editorMutationVersionRef.current += 1;
    currentDraftRef.current = {
      ...currentDraftRef.current,
      template: nextTemplate,
    };
    setTemplate(nextTemplate);
  }

  function moveSection(sectionId, direction) {
    setSaveState('saving');
    updateResume((currentResume) => moveResumeSectionBlock(currentResume, sectionId, direction));
  }

  function reorderSection(sectionId, targetSectionId, placement) {
    setSaveState('saving');
    updateResume((currentResume) => reorderResumeSectionBlock(currentResume, sectionId, targetSectionId, placement));
  }

  function reorderSections(nextSectionIds) {
    setSaveState('saving');
    updateResume((currentResume) => reorderResumeSectionBlocksToMatch(currentResume, nextSectionIds));
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

  function preparePrintView() {
    if (printViewRef.current === null) {
      printViewRef.current = mobileViewRef.current;
    }
    flushSync(() => {
      setMobileView('preview');
    });
  }

  function printResume() {
    revealAllErrors();
    printViewRef.current = mobileViewRef.current;
    persistCurrentEditorDraft({ reason: 'print' });
    flushCloudQueue({ reason: 'print' });
    preparePrintView();

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.print();
      });
    });
  }

  async function setActiveResume(nextResumeId) {
    const currentWorkspace = workspaceRef.current;

    if (!currentWorkspace.resumeIds.includes(nextResumeId)) {
      return;
    }

    if (nextResumeId === currentWorkspace.activeResumeId) {
      resumeLoadRunIdRef.current += 1;
      return;
    }

    if (conflictRef.current) {
      setNotice({ tone: 'warning', message: 'Resolve the current save conflict before switching resumes.' });
      return;
    }

    const loadRequestId = resumeLoadRunIdRef.current + 1;
    resumeLoadRunIdRef.current = loadRequestId;
    const saveResult = await persistCurrentEditorDraft({ reason: 'switch-resume', persistWorkspace: false });

    if (
      resumeLoadRunIdRef.current !== loadRequestId ||
      saveResult?.conflict ||
      saveResult?.error ||
      saveResult?.skipped
    ) {
      return;
    }

    const nextWorkspace = normalizeWorkspaceIndex({
      ...workspaceRef.current,
      activeResumeId: nextResumeId,
    });

    commitWorkspace(nextWorkspace, { reason: 'switch-resume' });
    const nextDraft = await readLocalDraft(nextResumeId);

    if (activeResumeIdRef.current !== nextResumeId || resumeLoadRunIdRef.current !== loadRequestId) {
      return;
    }

    loadDraftIntoEditor(nextDraft, { resumeId: nextResumeId, loadRequestId });
  }

  function createResume() {
    if (!canAddResume || conflictRef.current) {
      if (conflictRef.current) {
        setNotice({ tone: 'warning', message: 'Resolve the current save conflict before creating another resume.' });
      }
      return;
    }

    persistCurrentEditorDraft({ reason: 'create-resume', persistWorkspace: false });
    const currentWorkspace = workspaceRef.current;
    const existingNames = currentWorkspace.resumeIds.map((resumeId) => currentWorkspace.meta[resumeId]?.name || '');
    const nextResumeId = createWorkspaceResumeId();
    const nextResumeName = createNextResumeName(existingNames);
    const nextDraft = createSavedDraftState(createBlankDraftState());
    const nextWorkspace = normalizeWorkspaceIndex({
      ...currentWorkspace,
      activeResumeId: nextResumeId,
      resumeIds: [...currentWorkspace.resumeIds, nextResumeId],
      meta: {
        ...currentWorkspace.meta,
        [nextResumeId]: createWorkspaceResumeMeta(nextResumeName, nextDraft.savedAt),
      },
    });

    commitWorkspace(nextWorkspace, { persist: false });
    persistLocalDraftSnapshot({
      resumeId: nextResumeId,
      workspace: nextWorkspace,
      draft: nextDraft,
      accountUid: userRef.current?.uid || '',
      reason: 'create-resume',
    }).then(() => scheduleCloudSync('create-resume'));
    loadDraftIntoEditor(nextDraft, { focusPersonal: true, resumeId: nextResumeId });
  }

  function createImportPlaceholderResume({ sourceFileName = '' } = {}) {
    if (!canAddResume || conflictRef.current) {
      setNotice({
        tone: conflictRef.current ? 'warning' : 'error',
        message: conflictRef.current
          ? 'Resolve the current save conflict before importing another resume.'
          : `You can keep up to ${MAX_WORKSPACE_RESUMES} resumes in this browser.`,
      });
      return null;
    }

    persistCurrentEditorDraft({ reason: 'import-placeholder', persistWorkspace: false });
    const currentWorkspace = workspaceRef.current;
    const existingNames = currentWorkspace.resumeIds.map((resumeId) => currentWorkspace.meta[resumeId]?.name || '');
    const sourceName = sourceFileName.replace(/\.[^.]+$/, '');
    const nextResumeId = createWorkspaceResumeId();
    const nextResumeName = sanitizeWorkspaceResumeName(sourceName, createNextResumeName(existingNames));
    const nextDraft = createSavedDraftState(createBlankDraftState());
    const nextWorkspace = normalizeWorkspaceIndex({
      ...currentWorkspace,
      activeResumeId: nextResumeId,
      resumeIds: [...currentWorkspace.resumeIds, nextResumeId],
      meta: {
        ...currentWorkspace.meta,
        [nextResumeId]: createWorkspaceResumeMeta(nextResumeName, nextDraft.savedAt),
      },
    });

    commitWorkspace(nextWorkspace, { persist: false });
    persistLocalDraftSnapshot({
      resumeId: nextResumeId,
      workspace: nextWorkspace,
      draft: nextDraft,
      accountUid: userRef.current?.uid || '',
      reason: 'import-placeholder',
    }).then(() => scheduleCloudSync('import-placeholder'));
    loadDraftIntoEditor(nextDraft, { focusPersonal: true, resumeId: nextResumeId });
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
    const nextDraft = createSavedDraftState({
      resume: normalizedDraft.resume,
      template: normalizedDraft.template,
    });
    const existingName = currentWorkspace.meta[resumeId]?.name || 'Imported resume';
    const nextName = sanitizeWorkspaceResumeName(name, existingName);
    const nextWorkspace = normalizeWorkspaceIndex({
      ...withWorkspaceResumeMeta(currentWorkspace, resumeId, {
        name: nextName,
        updatedAt: nextDraft.savedAt,
      }),
      activeResumeId: resumeId,
    });

    commitWorkspace(nextWorkspace, { persist: false });
    const persistedDraft = await persistLocalDraftSnapshot({
      resumeId,
      workspace: nextWorkspace,
      draft: nextDraft,
      accountUid: userRef.current?.uid || '',
      reason: 'import-replace',
    });
    scheduleCloudSync('import-replace', 500);
    loadDraftIntoEditor(persistedDraft.draft, { focusPersonal: true, resumeId });
    return true;
  }

  function duplicateActiveResume() {
    if (!canAddResume || !activeResumeIdRef.current || conflictRef.current) {
      if (conflictRef.current) {
        setNotice({ tone: 'warning', message: 'Resolve the current save conflict before duplicating this resume.' });
      }
      return;
    }

    persistCurrentEditorDraft({ reason: 'duplicate-resume', persistWorkspace: false });
    const currentWorkspace = workspaceRef.current;
    const sourceResumeId = activeResumeIdRef.current;
    const nextResumeId = createWorkspaceResumeId();
    const existingNames = currentWorkspace.resumeIds.map((resumeId) => currentWorkspace.meta[resumeId]?.name || '');
    const sourceName = currentWorkspace.meta[sourceResumeId]?.name || '';
    const duplicateName = createDuplicateResumeName(sourceName, existingNames);
    const duplicateDraft = createSavedDraftState(currentDraftRef.current);
    const nextWorkspace = normalizeWorkspaceIndex({
      ...currentWorkspace,
      activeResumeId: nextResumeId,
      resumeIds: [...currentWorkspace.resumeIds, nextResumeId],
      meta: {
        ...currentWorkspace.meta,
        [nextResumeId]: createWorkspaceResumeMeta(duplicateName, duplicateDraft.savedAt),
      },
    });

    commitWorkspace(nextWorkspace, { persist: false });
    persistLocalDraftSnapshot({
      resumeId: nextResumeId,
      workspace: nextWorkspace,
      draft: duplicateDraft,
      accountUid: userRef.current?.uid || '',
      reason: 'duplicate-resume',
    }).then(() => scheduleCloudSync('duplicate-resume'));
    loadDraftIntoEditor(duplicateDraft, { resumeId: nextResumeId });
  }

  async function renameResume(resumeId, nextName) {
    const targetResumeId = resumeId || activeResumeIdRef.current;
    const currentWorkspace = workspaceRef.current;
    const currentName = currentWorkspace.meta[targetResumeId]?.name || '';
    const trimmedName = sanitizeWorkspaceResumeName(nextName, currentName);

    if (!trimmedName || !targetResumeId || trimmedName === currentName) {
      return;
    }

    if (conflictRef.current?.resumeId === targetResumeId) {
      setNotice({ tone: 'warning', message: 'Resolve the current save conflict before renaming this resume.' });
      return;
    }

    const renamedAt = new Date().toISOString();
    const nextWorkspace = withWorkspaceResumeMeta(currentWorkspace, targetResumeId, {
      name: trimmedName,
      updatedAt: renamedAt,
    });
    commitWorkspace(nextWorkspace, { persist: false });
    await persistLocalWorkspaceSnapshot({
      workspace: nextWorkspace,
      accountUid: userRef.current?.uid || '',
      enqueueSync: true,
      reason: 'rename-resume',
    });
    scheduleCloudSync('rename-resume', 500);
  }

  async function reorderResume(sourceResumeId, targetResumeId, placement = 'before') {
    const currentWorkspace = workspaceRef.current;

    if (!currentWorkspace.resumeIds.includes(sourceResumeId) || sourceResumeId === targetResumeId) {
      return;
    }

    const nextWorkspace = reorderWorkspaceResumes(currentWorkspace, sourceResumeId, targetResumeId, placement);

    if (nextWorkspace.resumeIds.join('\u0000') === currentWorkspace.resumeIds.join('\u0000')) {
      return;
    }

    persistCurrentEditorDraft({ reason: 'resume-reorder', persistWorkspace: false });
    commitWorkspace(nextWorkspace, { reason: 'resume-reorder' });
  }

  async function reorderResumes(nextResumeIds) {
    const currentWorkspace = workspaceRef.current;
    const nextWorkspace = reorderWorkspaceResumesToMatch(currentWorkspace, nextResumeIds);

    if (nextWorkspace.resumeIds.join('\u0000') === currentWorkspace.resumeIds.join('\u0000')) {
      return;
    }

    persistCurrentEditorDraft({ reason: 'resume-reorder', persistWorkspace: false });
    commitWorkspace(nextWorkspace, { reason: 'resume-reorder' });
  }

  async function deleteActiveResume() {
    const currentWorkspace = workspaceRef.current;
    const deletedResumeId = currentWorkspace.activeResumeId;

    if (!deletedResumeId || currentWorkspace.resumeIds.length <= 1 || conflictRef.current) {
      if (conflictRef.current) {
        setNotice({ tone: 'warning', message: 'Resolve the current save conflict before deleting a resume.' });
      }
      return;
    }

    const currentIndex = currentWorkspace.resumeIds.indexOf(deletedResumeId);
    const nextVisibleWorkspace = withoutWorkspaceResume(currentWorkspace, deletedResumeId);
    const nextResumeId = nextVisibleWorkspace.resumeIds[Math.max(0, currentIndex - 1)] || nextVisibleWorkspace.resumeIds[0];
    const nextWorkspace = normalizeWorkspaceIndex({
      ...nextVisibleWorkspace,
      activeResumeId: nextResumeId,
    });

    commitWorkspace(nextWorkspace, { persist: false });
    await persistLocalResumeDelete({
      resumeId: deletedResumeId,
      workspace: nextWorkspace,
      accountUid: userRef.current?.uid || '',
      reason: 'delete-resume',
    });
    scheduleCloudSync('delete-resume', 500);
    const nextDraft = await readLocalDraft(nextResumeId);
    loadDraftIntoEditor(nextDraft, { resumeId: nextResumeId });
  }

  async function retryCloudSync() {
    const saveResult = await persistCurrentEditorDraft({ reason: 'retry-sync' });

    if (saveResult?.conflict || saveResult?.error) {
      return false;
    }

    return flushCloudQueue({ reason: 'retry-sync', immediate: true });
  }

  async function flushActiveCloudDraft({ reason = 'manual' } = {}) {
    const saveResult = await persistCurrentEditorDraft({ reason });

    if (saveResult?.conflict || saveResult?.error || saveResult?.skipped) {
      return false;
    }

    return flushCloudQueue({ reason, immediate: true });
  }

  function resolveConflictWithCloud() {
    const currentConflict = conflictRef.current;

    if (!currentConflict?.storedDraft) {
      return;
    }

    conflictRef.current = null;
    setConflict(null);
    setNotice(null);
    loadDraftIntoEditor(currentConflict.storedDraft, { resumeId: currentConflict.resumeId });
  }

  async function resolveConflictWithLocal() {
    const currentConflict = conflictRef.current;

    if (!currentConflict || editorDraftResumeIdRef.current !== currentConflict.resumeId) {
      return false;
    }

    const result = await saveEditorDraftFromRefs({
      reason: 'resolve-local-conflict',
      allowStaleOverwrite: true,
    });

    if (!result?.conflict) {
      setNotice(null);
      return true;
    }

    return false;
  }

  async function saveConflictAsCopy() {
    const currentConflict = conflictRef.current;
    const currentWorkspace = workspaceRef.current;

    if (!currentConflict || currentWorkspace.resumeIds.length >= MAX_WORKSPACE_RESUMES) {
      return false;
    }

    const nextResumeId = createWorkspaceResumeId();
    const sourceName = currentWorkspace.meta[currentConflict.resumeId]?.name || 'Resume';
    const existingNames = currentWorkspace.resumeIds.map((resumeId) => currentWorkspace.meta[resumeId]?.name || '');
    const copyName = createDuplicateResumeName(sourceName, existingNames);
    const copyDraft = createSavedDraftState(currentDraftRef.current);
    const nextWorkspace = normalizeWorkspaceIndex({
      ...currentWorkspace,
      activeResumeId: nextResumeId,
      resumeIds: [...currentWorkspace.resumeIds, nextResumeId],
      meta: {
        ...currentWorkspace.meta,
        [nextResumeId]: createWorkspaceResumeMeta(copyName, copyDraft.savedAt),
      },
    });

    conflictRef.current = null;
    setConflict(null);
    commitWorkspace(nextWorkspace, { persist: false });
    const persistedCopy = await persistLocalDraftSnapshot({
      resumeId: nextResumeId,
      workspace: nextWorkspace,
      draft: copyDraft,
      accountUid: userRef.current?.uid || '',
      reason: 'conflict-copy',
    });
    scheduleCloudSync('conflict-copy', 500);
    loadDraftIntoEditor(persistedCopy.draft, { resumeId: nextResumeId });
    setNotice({ tone: 'warning', message: 'Your edits were preserved as a separate resume copy.' });
    return true;
  }

  const actions = {
    updatePersonalField(field, value) {
      updateResume((currentResume) => updatePersonalField(currentResume, field, value));
    },
    updateSectionTitle(sectionId, value) {
      updateResume((currentResume) => updateSectionTitle(currentResume, sectionId, value));
    },
    commitSectionTitle(sectionId) {
      updateResume((currentResume) => commitSectionTitle(currentResume, sectionId));
    },
    updateResumeSetting(settingId, delta) {
      updateResume((currentResume) => updateResumeSettingValue(currentResume, settingId, delta));
    },
    setSummaryWidthPercent(widthPercent) {
      updateResume((currentResume) => setResumeSummaryWidthPercent(currentResume, widthPercent));
    },
    setResumeSettingValue(settingId, value) {
      updateResume((currentResume) => setResumeSettingValue(currentResume, settingId, value));
    },
    setPersonalContactOrder(orderedFields) {
      updateResume((currentResume) => setPersonalContactOrder(currentResume, orderedFields));
    },
    setSectionEntryHeaderLayout(sectionId, layout) {
      updateResume((currentResume) => setSectionEntryHeaderLayout(currentResume, sectionId, layout));
    },
    startFromScratch() {
      updateResume((currentResume) => updateSampleDisplay(currentResume, { hasStarted: true }));
    },
    setSampleInformationVisible(showInformation) {
      updateResume((currentResume) => updateSampleDisplay(currentResume, {
        hasStarted: true,
        showInformation,
      }));
    },
    setSampleTextListOrder(orderKey, orderedSourceIndexes) {
      updateResume((currentResume) => setSampleTextListOrder(currentResume, orderKey, orderedSourceIndexes));
    },
    addResumeSection(templateId) {
      let nextSectionId = '';

      flushSync(() => {
        setSaveState('saving');
        setResume((currentResume) => {
          const sourceResume = currentDraftRef.current?.resume || currentResume;
          const result = addResumeSectionBlock(sourceResume, templateId);
          nextSectionId = result.sectionId;

          currentDraftRef.current = {
            ...currentDraftRef.current,
            resume: result.resume,
          };

          return result.resume;
        });
      });

      return nextSectionId;
    },
    removeResumeSection(sectionId) {
      updateResume((currentResume) => removeResumeSectionBlock(currentResume, sectionId));
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
    reorderSectionEntries(sectionId, nextEntryIds) {
      updateResume((currentResume) => reorderSectionBlockEntriesToMatch(currentResume, sectionId, nextEntryIds));
    },
    materializeAndReorderSectionEntries(sectionId, nextEntryIds, sampleEntryBindings) {
      updateResume((currentResume) => (
        materializeAndReorderSectionBlockEntries(currentResume, sectionId, nextEntryIds, sampleEntryBindings)
      ));
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
    reorderSectionTextList(sectionId, entryId, field, fromIndex, toIndex) {
      updateResume((currentResume) => reorderSectionBlockTextListItem(currentResume, sectionId, entryId, field, fromIndex, toIndex));
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
  };

  return {
    resume,
    template,
    setTemplate: changeTemplate,
    activeTab,
    setActiveTab,
    moveSection,
    reorderSection,
    reorderSections,
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
    resolveConflictWithCloud,
    resolveConflictWithLocal,
    saveConflictAsCopy,
    retryCloudSync,
    flushActiveCloudDraft,
    saveState,
    saveLabel: saveState === 'saving'
      ? 'Saving locally…'
      : saveState === 'error'
        ? 'Local autosave unavailable'
        : saveState === 'conflict'
          ? 'Save conflict'
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
    createImportPlaceholderResume,
    replaceResumeDraft,
    duplicateActiveResume,
    renameActiveResume: renameResume,
    reorderResume,
    reorderResumes,
    deleteActiveResume,
  };
}
