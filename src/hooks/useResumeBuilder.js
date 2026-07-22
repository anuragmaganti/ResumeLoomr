import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  DEFAULT_TEMPLATE,
  TEMPLATE_OPTIONS,
  addResumeSectionBlock,
  addSectionBlockEducationCustomSection,
  addSectionBlockEducationProgram,
  addSectionBlockEntry,
  addSectionBlockTextListItem,
  commitSectionTitle,
  createEmptyResume,
  dismissSampleInformation,
  getPreviewModel,
  moveResumeSectionBlock,
  moveSectionBlockEducationCustomSection,
  moveSectionBlockEducationProgram,
  moveSectionBlockEntry,
  moveSectionBlockTextListItem,
  materializeAndReorderSectionBlockEntries,
  normalizeDraftPayload,
  projectTransientSampleEntry,
  removeResumeSectionBlock,
  removeSectionBlockEducationCustomSection,
  removeSectionBlockEducationProgram,
  removeSectionBlockEntry,
  removeSectionBlockTextListItem,
  reorderSectionBlockEntriesToMatch,
  reorderSectionBlockTextListItem,
  reorderResumeSectionBlocksToMatch,
  resolveTransientSampleEntry,
  setPersonalContactOrder,
  setSampleTextListOrder,
  setResumeSettingValue,
  setResumeSummaryWidthPercent,
  setSectionEntryHeaderLayout,
  updatePersonalField,
  updateResumeSetting as updateResumeSettingValue,
  updateSampleDisplay,
  updateSectionBlockEducationCustomSection,
  updateSectionBlockEducationProgram,
  updateSectionBlockEntry,
  updateSectionBlockTextList,
  updateSectionTitle,
  validateResume,
} from '../lib/resume.js';
import {
  MAX_WORKSPACE_RESUMES,
  createDuplicateResumeName,
  createNextResumeName,
  createWorkspaceFolderFromResumes,
  createWorkspaceResumeId,
  createWorkspaceResumeMeta,
  normalizeWorkspaceIndex,
  placeWorkspaceResumeAfter,
  removeWorkspaceFolders,
  removeWorkspaceResumes,
  renameWorkspaceFolder,
  sanitizeWorkspaceResumeName,
  updateWorkspaceOrganization as applyWorkspaceOrganization,
} from '../lib/workspace.js';
import {
  createSavedDraftState,
  createUnsyncedDraftCopyState,
} from '../lib/draftState.js';
import {
  mergeLocalAndCloudWorkspaces,
} from '../lib/workspaceReconciliation.js';
import {
  initializeLocalWorkspace,
  persistLocalDraftSnapshot,
  persistLocalResumeBatchDelete,
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

function normalizeCloudSnapshot(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const workspace = normalizeWorkspaceIndex(payload.workspace);
  const rawDrafts = payload.drafts && typeof payload.drafts === 'object' ? payload.drafts : {};
  const tombstones = Array.isArray(payload.tombstones) ? payload.tombstones : [];
  const draftsByResumeId = new Map();

  workspace.resumeIds.forEach((resumeId) => {
    const draft = rawDrafts[resumeId];

    if (draft) {
      const normalizedDraft = normalizeDraftPayload(draft);
      draftsByResumeId.set(resumeId, {
        resume: normalizedDraft.resume,
        template: normalizedDraft.template,
        savedAt: draft.savedAt || null,
        cloudVersion: Math.max(0, Number(draft.cloudVersion || 0) || 0),
      });
    }
  });

  if (workspace.resumeIds.length === 0 && tombstones.length === 0) {
    return null;
  }

  return {
    workspace,
    draftsByResumeId,
    activeResumeId: workspace.activeResumeId || workspace.resumeIds[0],
    tombstones,
    workspaceCloudVersion: Math.max(0, Number(payload.workspaceVersion || 0) || 0),
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
  const [cloudReconcileRequest, setCloudReconcileRequest] = useState(0);
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
  const workspaceSaveQueueRef = useRef(Promise.resolve());
  const workspaceMutationVersionRef = useRef(0);
  const cloudReconcileRetryTimerRef = useRef(null);
  const cloudReconcileRetryCountRef = useRef(0);
  const cloudReconcileRetryAccountRef = useRef('');
  const draftRevisionByResumeIdRef = useRef(new Map([
    [initialWorkspaceState.workspace.activeResumeId, initialWorkspaceState.draft.localRevision || ''],
  ]));
  const conflictRef = useRef(null);
  const transientSampleEntryRef = useRef(null);
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
    const persistableResume = resolveTransientSampleEntry(resume, transientSampleEntryRef.current);

    currentDraftRef.current = {
      resume: persistableResume,
      template,
      savedAt,
      localRevision,
      cloudVersion: currentDraftRef.current.cloudVersion || 0,
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

    if (cloudReconcileRetryAccountRef.current !== (user?.uid || '')) {
      cloudReconcileRetryAccountRef.current = user?.uid || '';
      cloudReconcileRetryCountRef.current = 0;
    }

    if (cloudReconcileRetryTimerRef.current) {
      window.clearTimeout(cloudReconcileRetryTimerRef.current);
      cloudReconcileRetryTimerRef.current = null;
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

        const localTombstones = localBundle.tombstones.filter((record) => (
          !record?.accountUid || record.accountUid === user.uid
        ));
        const localPendingOutbox = localBundle.pendingOutbox.filter((operation) => (
          !operation?.accountUid || operation.accountUid === user.uid
        ));
        const localOutboxRecords = (localBundle.outboxRecords || localBundle.pendingOutbox).filter((operation) => (
          !operation?.accountUid || operation.accountUid === user.uid
        ));
        const mergeResult = mergeLocalAndCloudWorkspaces({
          localWorkspace: localBundle.workspace,
          localDraftsByResumeId: localBundle.draftsByResumeId,
          cloudWorkspace: cloudSnapshot?.workspace,
          cloudDraftsByResumeId: cloudSnapshot?.draftsByResumeId,
          tombstones: localTombstones,
          cloudTombstones: cloudSnapshot?.tombstones,
          pendingOutbox: localPendingOutbox,
          outboxRecords: localOutboxRecords,
          workspaceCloudVersion: cloudSnapshot?.workspaceCloudVersion,
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
        cloudReconcileRetryCountRef.current = 0;

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

          if (isOnline() && userRef.current?.uid === user.uid) {
            const retryCount = cloudReconcileRetryCountRef.current;
            const retryDelay = Math.min(30_000, 2_000 * (2 ** retryCount));

            cloudReconcileRetryCountRef.current = Math.min(retryCount + 1, 4);
            cloudReconcileRetryTimerRef.current = window.setTimeout(() => {
              cloudReconcileRetryTimerRef.current = null;
              setCloudReconcileRequest((request) => request + 1);
            }, retryDelay);
          }
        }
      }
    }

    bootstrapSignedInSync();

    return () => {
      if (cloudReconcileRetryTimerRef.current) {
        window.clearTimeout(cloudReconcileRetryTimerRef.current);
        cloudReconcileRetryTimerRef.current = null;
      }
    };
  // Reconnect and version conflicts rerun the same no-loss login merge.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authReady, cloudReconcileRequest, localReady, user?.uid]);

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
      if (userRef.current?.uid) {
        setCloudReconcileRequest((request) => request + 1);
      } else {
        requestResumeBackgroundSync();
      }
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
      cloudVersion: Math.max(0, Number(nextDraft?.cloudVersion || 0) || 0),
    };
    const nextSectionIds = getDraftEditorSectionIds(draftState);

    skipNextAutosaveRef.current = true;
    transientSampleEntryRef.current = null;
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

  function applyWorkspaceState(nextWorkspace) {
    const normalizedWorkspace = normalizeWorkspaceIndex(nextWorkspace);
    workspaceRef.current = normalizedWorkspace;
    activeResumeIdRef.current = normalizedWorkspace.activeResumeId;
    setWorkspace(normalizedWorkspace);

    return normalizedWorkspace;
  }

  function commitWorkspace(nextWorkspace, { persist = true, enqueueSync = true, reason = 'workspace' } = {}) {
    const previousWorkspace = workspaceRef.current;
    const normalizedWorkspace = applyWorkspaceState(nextWorkspace);
    const mutationVersion = workspaceMutationVersionRef.current + 1;

    workspaceMutationVersionRef.current = mutationVersion;

    if (!persist) {
      return Promise.resolve(normalizedWorkspace);
    }

    const persistOperation = workspaceSaveQueueRef.current.then(() => (
      persistLocalWorkspaceSnapshot({
        workspace: normalizedWorkspace,
        accountUid: userRef.current?.uid || '',
        enqueueSync,
        reason,
      })
    )).then((persistedWorkspace) => {
      if (workspaceMutationVersionRef.current === mutationVersion) {
        applyWorkspaceState(persistedWorkspace);
      }

      if (enqueueSync) {
        scheduleCloudSync(reason);
      }

      return persistedWorkspace;
    }).catch(() => {
      if (workspaceMutationVersionRef.current === mutationVersion) {
        applyWorkspaceState(previousWorkspace);
      }
      setSaveState('error');
      setNotice({ tone: 'error', message: 'Local autosave failed in this browser.' });
      return null;
    });

    workspaceSaveQueueRef.current = persistOperation.then(() => undefined, () => undefined);
    return persistOperation;
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
      let oversizedResumeDetected = false;

      for (let pass = 0; pass < 5; pass += 1) {
        result = await syncLocalOutbox({ idToken, accountUid: currentUser.uid });
        const editorResumeId = editorDraftResumeIdRef.current;

        if (editorResumeId) {
          const storedDraft = await readLocalDraft(editorResumeId);

          if (storedDraft.localRevision === editorDraftRevisionRef.current) {
            currentDraftRef.current = {
              ...currentDraftRef.current,
              cloudVersion: storedDraft.cloudVersion || 0,
            };
          }
        }

        if (result.oversizedCount > 0) {
          oversizedResumeDetected = true;
          setSyncState('stale');
          setNotice({
            tone: 'warning',
            message: 'One resume is too large for cloud sync. It remains saved in this browser.',
          });

          if (
            result.pendingCount > 0
            && result.staleCount === 0
            && result.rejectedCount === result.oversizedCount
          ) {
            continue;
          }

          return false;
        }

        if (result.staleCount > 0 || result.status === 'stale') {
          setSyncState('stale');
          setNotice({
            tone: 'warning',
            message: 'Some cloud changes were skipped because a newer version already exists. Your local draft is still saved.',
          });

          if (result.requiresReconcile) {
            setCloudReconcileRequest((request) => request + 1);
          }
          return false;
        }

        if (result.pendingCount === 0) {
          if (oversizedResumeDetected) {
            setSyncState('stale');
            return false;
          }

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

  function saveEditorDraftFromRefs({
    reason = 'manual',
    scheduleSync = true,
    persistWorkspace = true,
    enqueueWorkspaceSync = false,
    allowStaleOverwrite = false,
  } = {}) {
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
          enqueueWorkspaceSync,
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

        if (result?.deleted) {
          await commitWorkspace(result.workspace, { persist: false });

          if (editorDraftResumeIdRef.current === resumeId) {
            const nextResumeId = result.workspace.activeResumeId;

            if (nextResumeId && nextResumeId !== resumeId) {
              loadDraftIntoEditor(await readLocalDraft(nextResumeId), { resumeId: nextResumeId });
            }

            setNotice({
              tone: 'warning',
              message: 'This resume was deleted in another tab, so this stale edit was not saved.',
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
      const transient = transientSampleEntryRef.current;
      const persistableResume = resolveTransientSampleEntry(nextResume, transient);

      currentDraftRef.current = {
        ...currentDraftRef.current,
        resume: persistableResume,
      };

      return nextResume;
    });
  }

  function prepareTransientSampleEntry(sectionId, previewEntry, previewEntryOrder) {
    let projectedResume = null;

    flushSync(() => {
      skipNextAutosaveRef.current = true;
      setResume((currentResume) => {
        const canonicalResume = resolveTransientSampleEntry(currentResume, transientSampleEntryRef.current);
        const result = projectTransientSampleEntry(
          canonicalResume,
          sectionId,
          previewEntry,
          previewEntryOrder,
        );

        transientSampleEntryRef.current = result.transient
          ? { ...result.transient, resumeId: activeResumeIdRef.current }
          : null;
        projectedResume = result.resume;
        currentDraftRef.current = {
          ...currentDraftRef.current,
          resume: resolveTransientSampleEntry(result.resume, transientSampleEntryRef.current),
        };

        return result.resume;
      });
    });

    return projectedResume;
  }

  function endTransientSampleEntry({ sectionId = '', entryId = '' } = {}) {
    const transient = transientSampleEntryRef.current;

    if (
      !transient ||
      (sectionId && transient.sectionId !== sectionId) ||
      (entryId && transient.entryId !== entryId)
    ) {
      return false;
    }

    flushSync(() => {
      setResume((currentResume) => {
        const canonicalResume = resolveTransientSampleEntry(currentResume, transient);

        if (canonicalResume !== currentResume) {
          skipNextAutosaveRef.current = true;
        }

        currentDraftRef.current = {
          ...currentDraftRef.current,
          resume: canonicalResume,
        };
        transientSampleEntryRef.current = null;

        return canonicalResume;
      });
    });

    return true;
  }

  function endTransientSampleEntryUnless(sectionId = '', entryId = '') {
    const transient = transientSampleEntryRef.current;

    if (!transient || (transient.sectionId === sectionId && transient.entryId === entryId)) {
      return false;
    }

    return endTransientSampleEntry();
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
    endTransientSampleEntry();
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

    const persistedWorkspace = await commitWorkspace(nextWorkspace, { reason: 'switch-resume' });

    if (!persistedWorkspace?.resumeIds.includes(nextResumeId)) {
      return;
    }
    const nextDraft = await readLocalDraft(nextResumeId);

    if (activeResumeIdRef.current !== nextResumeId || resumeLoadRunIdRef.current !== loadRequestId) {
      return;
    }

    loadDraftIntoEditor(nextDraft, { resumeId: nextResumeId, loadRequestId });
  }

  async function createResume() {
    if (!canAddResume || conflictRef.current) {
      if (conflictRef.current) {
        setNotice({ tone: 'warning', message: 'Resolve the current save conflict before creating another resume.' });
      }
      return null;
    }

    const saveResult = await persistCurrentEditorDraft({ reason: 'create-resume', persistWorkspace: false });

    if (saveResult?.conflict || saveResult?.error || saveResult?.skipped) {
      return null;
    }

    const currentWorkspace = workspaceRef.current;

    if (currentWorkspace.resumeIds.length >= MAX_WORKSPACE_RESUMES) {
      return null;
    }
    const existingNames = currentWorkspace.resumeIds.map((resumeId) => currentWorkspace.meta[resumeId]?.name || '');
    const nextResumeId = createWorkspaceResumeId();
    const nextResumeName = createNextResumeName(existingNames);
    const nextDraft = createSavedDraftState(createBlankDraftState());
    const workspaceWithResume = normalizeWorkspaceIndex({
      ...currentWorkspace,
      activeResumeId: nextResumeId,
      resumeIds: [...currentWorkspace.resumeIds, nextResumeId],
      meta: {
        ...currentWorkspace.meta,
        [nextResumeId]: createWorkspaceResumeMeta(nextResumeName, nextDraft.savedAt),
      },
    });
    const nextWorkspace = applyWorkspaceOrganization(workspaceWithResume, workspaceWithResume.organization);

    try {
      const persisted = await persistLocalDraftSnapshot({
        resumeId: nextResumeId,
        workspace: nextWorkspace,
        draft: nextDraft,
        accountUid: userRef.current?.uid || '',
        enqueueWorkspaceSync: true,
        reason: 'create-resume',
      });

      await commitWorkspace(persisted.workspace, { persist: false });
      loadDraftIntoEditor(persisted.draft, { focusPersonal: true, resumeId: nextResumeId });
      scheduleCloudSync('create-resume');
      return nextResumeId;
    } catch {
      setSaveState('error');
      setNotice({ tone: 'error', message: 'The new resume could not be saved in this browser.' });
      return null;
    }
  }

  async function createImportPlaceholderResume({ sourceFileName = '' } = {}) {
    if (!canAddResume || conflictRef.current) {
      setNotice({
        tone: conflictRef.current ? 'warning' : 'error',
        message: conflictRef.current
          ? 'Resolve the current save conflict before importing another resume.'
          : `You can keep up to ${MAX_WORKSPACE_RESUMES} resumes in this browser.`,
      });
      return null;
    }

    const saveResult = await persistCurrentEditorDraft({ reason: 'import-placeholder', persistWorkspace: false });

    if (saveResult?.conflict || saveResult?.error || saveResult?.skipped) {
      return null;
    }

    const currentWorkspace = workspaceRef.current;

    if (currentWorkspace.resumeIds.length >= MAX_WORKSPACE_RESUMES) {
      return null;
    }
    const existingNames = currentWorkspace.resumeIds.map((resumeId) => currentWorkspace.meta[resumeId]?.name || '');
    const sourceName = sourceFileName.replace(/\.[^.]+$/, '');
    const nextResumeId = createWorkspaceResumeId();
    const nextResumeName = sanitizeWorkspaceResumeName(sourceName, createNextResumeName(existingNames));
    const nextDraft = createSavedDraftState(createBlankDraftState());
    const workspaceWithResume = normalizeWorkspaceIndex({
      ...currentWorkspace,
      activeResumeId: nextResumeId,
      resumeIds: [...currentWorkspace.resumeIds, nextResumeId],
      meta: {
        ...currentWorkspace.meta,
        [nextResumeId]: createWorkspaceResumeMeta(nextResumeName, nextDraft.savedAt),
      },
    });
    const nextWorkspace = applyWorkspaceOrganization(workspaceWithResume, workspaceWithResume.organization);

    try {
      const persisted = await persistLocalDraftSnapshot({
        resumeId: nextResumeId,
        workspace: nextWorkspace,
        draft: nextDraft,
        accountUid: userRef.current?.uid || '',
        enqueueWorkspaceSync: true,
        reason: 'import-placeholder',
      });

      await commitWorkspace(persisted.workspace, { persist: false });
      loadDraftIntoEditor(persisted.draft, { focusPersonal: true, resumeId: nextResumeId });
      scheduleCloudSync('import-placeholder');
      return nextResumeId;
    } catch {
      setSaveState('error');
      setNotice({ tone: 'error', message: 'The imported resume could not be prepared in this browser.' });
      return null;
    }
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

    const persistedDraft = await persistLocalDraftSnapshot({
      resumeId,
      workspace: nextWorkspace,
      draft: nextDraft,
      accountUid: userRef.current?.uid || '',
      enqueueWorkspaceSync: true,
      reason: 'import-replace',
    });
    await commitWorkspace(persistedDraft.workspace, { persist: false });
    scheduleCloudSync('import-replace', 500);
    loadDraftIntoEditor(persistedDraft.draft, { focusPersonal: true, resumeId });
    return true;
  }

  async function duplicateActiveResume() {
    if (!canAddResume || !activeResumeIdRef.current || conflictRef.current) {
      if (conflictRef.current) {
        setNotice({ tone: 'warning', message: 'Resolve the current save conflict before duplicating this resume.' });
      }
      return null;
    }

    const saveResult = await persistCurrentEditorDraft({ reason: 'duplicate-resume', persistWorkspace: false });

    if (saveResult?.conflict || saveResult?.error || saveResult?.skipped) {
      return null;
    }

    const currentWorkspace = workspaceRef.current;

    if (currentWorkspace.resumeIds.length >= MAX_WORKSPACE_RESUMES) {
      return null;
    }
    const sourceResumeId = activeResumeIdRef.current;
    const nextResumeId = createWorkspaceResumeId();
    const existingNames = currentWorkspace.resumeIds.map((resumeId) => currentWorkspace.meta[resumeId]?.name || '');
    const sourceName = currentWorkspace.meta[sourceResumeId]?.name || '';
    const duplicateName = createDuplicateResumeName(sourceName, existingNames);
    const duplicateDraft = createUnsyncedDraftCopyState(currentDraftRef.current);
    const nextWorkspace = placeWorkspaceResumeAfter(normalizeWorkspaceIndex({
      ...currentWorkspace,
      activeResumeId: nextResumeId,
      resumeIds: [...currentWorkspace.resumeIds, nextResumeId],
      meta: {
        ...currentWorkspace.meta,
        [nextResumeId]: createWorkspaceResumeMeta(duplicateName, duplicateDraft.savedAt),
      },
    }), nextResumeId, sourceResumeId);

    try {
      const persisted = await persistLocalDraftSnapshot({
        resumeId: nextResumeId,
        workspace: nextWorkspace,
        draft: duplicateDraft,
        accountUid: userRef.current?.uid || '',
        enqueueWorkspaceSync: true,
        reason: 'duplicate-resume',
      });

      await commitWorkspace(persisted.workspace, { persist: false });
      loadDraftIntoEditor(persisted.draft, { resumeId: nextResumeId });
      scheduleCloudSync('duplicate-resume');
      return nextResumeId;
    } catch {
      setSaveState('error');
      setNotice({ tone: 'error', message: 'This resume could not be duplicated in this browser.' });
      return null;
    }
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
    const persistedWorkspace = await commitWorkspace(nextWorkspace, {
      enqueueSync: true,
      reason: 'rename-resume',
    });

    if (!persistedWorkspace) {
      return false;
    }

    scheduleCloudSync('rename-resume', 500);
    return true;
  }

  async function createResumeFolder(resumeIds) {
    if (conflictRef.current) {
      setNotice({ tone: 'warning', message: 'Resolve the current save conflict before organizing resumes.' });
      return '';
    }

    const result = createWorkspaceFolderFromResumes(workspaceRef.current, resumeIds);

    if (!result.folderId) {
      return '';
    }

    commitWorkspace(result.workspace, { reason: 'create-resume-folder' });
    return result.folderId;
  }

  function renameResumeFolder(folderId, name) {
    if (conflictRef.current) {
      setNotice({ tone: 'warning', message: 'Resolve the current save conflict before renaming a folder.' });
      return false;
    }

    const currentWorkspace = workspaceRef.current;
    const nextWorkspace = renameWorkspaceFolder(currentWorkspace, folderId, name);

    if (nextWorkspace === currentWorkspace) {
      return false;
    }

    commitWorkspace(nextWorkspace, { reason: 'rename-resume-folder' });
    return true;
  }

  function setResumeOrganization(nextOrganization, reason = 'organize-resumes') {
    if (conflictRef.current) {
      setNotice({ tone: 'warning', message: 'Resolve the current save conflict before organizing resumes.' });
      return false;
    }

    const nextWorkspace = applyWorkspaceOrganization(workspaceRef.current, nextOrganization);
    commitWorkspace(nextWorkspace, { reason });
    return true;
  }

  async function deleteResumes(requestedResumeIds = null, requestedFolderIds = []) {
    const currentWorkspace = workspaceRef.current;
    const resumeIdsToDelete = Array.isArray(requestedResumeIds)
      ? requestedResumeIds
      : [currentWorkspace.activeResumeId];
    const folderIdsToRemove = Array.isArray(requestedFolderIds) ? requestedFolderIds : [];
    const buildDeletion = (sourceWorkspace) => {
      const folderRemoval = removeWorkspaceFolders(sourceWorkspace, folderIdsToRemove);

      if (resumeIdsToDelete.length === 0) {
        return {
          workspace: folderRemoval.workspace,
          deletedResumeIds: [],
          removedFolderIds: folderRemoval.removedFolderIds,
          rejectedReason: '',
        };
      }

      return {
        ...removeWorkspaceResumes(folderRemoval.workspace, resumeIdsToDelete),
        removedFolderIds: folderRemoval.removedFolderIds,
      };
    };
    let deletion = buildDeletion(currentWorkspace);

    if (
      deletion.rejectedReason === 'all'
      || (deletion.rejectedReason && deletion.removedFolderIds.length === 0)
      || conflictRef.current
    ) {
      if (conflictRef.current) {
        setNotice({ tone: 'warning', message: 'Resolve the current save conflict before deleting a resume.' });
      } else if (deletion.rejectedReason === 'all') {
        setNotice({ tone: 'warning', message: 'Keep at least one resume in this browser.' });
      }
      return false;
    }

    if (deletion.deletedResumeIds.length === 0 && deletion.removedFolderIds.length > 0) {
      commitWorkspace(deletion.workspace, { reason: 'remove-resume-folders' });
      return true;
    }

    const deletedIds = new Set(deletion.deletedResumeIds);
    const deletesActiveResume = deletedIds.has(currentWorkspace.activeResumeId);
    const deletedActiveResumeId = deletesActiveResume ? editorDraftResumeIdRef.current : '';

    if (!deletesActiveResume) {
      const saveResult = await persistCurrentEditorDraft({
        reason: 'batch-delete',
        persistWorkspace: false,
      });

      if (saveResult?.conflict || saveResult?.error) {
        return false;
      }

      deletion = buildDeletion(saveResult?.workspace || workspaceRef.current);

      if (deletion.rejectedReason) {
        return false;
      }
    }

    if (deletesActiveResume) {
      // Prevent exit/visibility handlers from recreating the draft while its delete is queued.
      editorDraftResumeIdRef.current = '';
    }

    let persistedWorkspace = null;

    try {
      persistedWorkspace = await persistLocalResumeBatchDelete({
        resumeIds: deletion.deletedResumeIds,
        workspace: deletion.workspace,
        accountUid: userRef.current?.uid || '',
        reason: deletion.deletedResumeIds.length === 1 ? 'delete-resume' : 'batch-delete-resumes',
      });
    } catch {
      if (deletesActiveResume) {
        editorDraftResumeIdRef.current = deletedActiveResumeId;
      }
      setSaveState('error');
      setNotice({ tone: 'error', message: 'These resumes could not be removed from this browser.' });
      return false;
    }

    await commitWorkspace(persistedWorkspace, { persist: false });
    scheduleCloudSync('delete-resumes', 500);

    if (deletesActiveResume) {
      const nextResumeId = persistedWorkspace.activeResumeId;
      const nextDraft = await readLocalDraft(nextResumeId);
      loadDraftIntoEditor(nextDraft, { resumeId: nextResumeId });
    }

    return true;
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
    const copyDraft = createUnsyncedDraftCopyState(currentDraftRef.current);
    const nextWorkspace = placeWorkspaceResumeAfter(normalizeWorkspaceIndex({
      ...currentWorkspace,
      activeResumeId: nextResumeId,
      resumeIds: [...currentWorkspace.resumeIds, nextResumeId],
      meta: {
        ...currentWorkspace.meta,
        [nextResumeId]: createWorkspaceResumeMeta(copyName, copyDraft.savedAt),
      },
    }), nextResumeId, currentConflict.resumeId);

    try {
      const persistedCopy = await persistLocalDraftSnapshot({
        resumeId: nextResumeId,
        workspace: nextWorkspace,
        draft: copyDraft,
        accountUid: userRef.current?.uid || '',
        enqueueWorkspaceSync: true,
        reason: 'conflict-copy',
      });

      conflictRef.current = null;
      setConflict(null);
      await commitWorkspace(persistedCopy.workspace, { persist: false });
      scheduleCloudSync('conflict-copy', 500);
      loadDraftIntoEditor(persistedCopy.draft, { resumeId: nextResumeId });
      setNotice({ tone: 'warning', message: 'Your edits were preserved as a separate resume copy.' });
      return true;
    } catch {
      setNotice({ tone: 'error', message: 'The conflict copy could not be saved in this browser.' });
      return false;
    }
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
      endTransientSampleEntry();
      updateResume((currentResume) => updateSampleDisplay(currentResume, {
        hasStarted: true,
        showInformation,
      }));
    },
    dismissSampleInformation() {
      endTransientSampleEntry();
      updateResume((currentResume) => dismissSampleInformation(currentResume));
    },
    setSampleTextListOrder(orderKey, orderedSourceIndexes) {
      updateResume((currentResume) => setSampleTextListOrder(currentResume, orderKey, orderedSourceIndexes));
    },
    addResumeSection(templateId) {
      let nextSectionId = '';

      endTransientSampleEntry();

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
      endTransientSampleEntry();
      updateResume((currentResume) => removeResumeSectionBlock(currentResume, sectionId));
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
      endTransientSampleEntry();
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
    prepareTransientSampleEntry,
    endTransientSampleEntry,
    endTransientSampleEntryUnless,
  };

  return {
    resume,
    template,
    setTemplate: changeTemplate,
    activeTab,
    setActiveTab,
    moveSection,
    reorderSections,
    mobileView,
    setMobileView,
    previewModel,
    getFieldError,
    markTouched,
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
    syncState,
    localReady,
    templateOptions: TEMPLATE_OPTIONS,
    resumeList,
    workspaceOrganization: workspace.organization,
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
    createResumeFolder,
    renameResumeFolder,
    setResumeOrganization,
    deleteResumes,
  };
}
