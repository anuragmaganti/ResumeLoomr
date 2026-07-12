import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import './App.css'
import './styles/buttons.css'
import './styles/forms.css'
import './styles/preview.css'
import Header from './components/header';
import AuthModal from './components/authModal';
import ImportResumeModal from './components/importResumeModal';
import AccountSettings from './components/accountSettings';
import SignedOutEditingPrompt from './components/signedOutEditingPrompt';
import AccountSwitchPrompt from './components/accountSwitchPrompt';
import ResumePreview from './components/resumePreview';
import EditorPanel from './components/editorPanel';
import SeparatorSettingsPopup from './components/separatorSettingsPopup';
import { useResumeBuilder } from './hooks/useResumeBuilder.js';
import { useFirebaseAuth } from './hooks/useFirebaseAuth.js';
import { importResumeFile } from './lib/importResume.js';
import { clearResumeSyncSession } from './lib/backgroundSync.js';
import {
  createMixedSamplePreviewModel,
  createSamplePlaceholderResolver,
  getPersistableSampleTextListMove,
} from './lib/sampleResumes.js';
import {
  clearBrowserResumeConnectionData,
  clearLocalResumeWorkspaceData,
  hasLocalResumeWorkspaceData,
  readConnectedAccount,
  readSignedOutEditingPreference,
  writeSignedOutEditingPreference,
} from './lib/browserConnection.js';

const THEME_STORAGE_KEY = 'resumeloomr:theme';
const EMPTY_SAMPLE_ORDER_OVERRIDES = {};

function NoticeToastIcon({ isSyncError }) {
  if (isSyncError) {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
        <path d="M7.2 17.5H5.8a3.3 3.3 0 0 1-.45-6.57A6.5 6.5 0 0 1 18 9.65a4 4 0 0 1 .2 7.85h-1.4" />
        <path d="m9 15 6 6M15 15l-6 6" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M12 3.5 21 20H3z" />
      <path d="M12 9v4.5M12 17h.01" />
    </svg>
  );
}

function NoticeDismissIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 18 18" focusable="false">
      <path d="m5 5 8 8M13 5l-8 8" />
    </svg>
  );
}

function getNoticeToastPresentation(notice, syncState) {
  const isSyncError = syncState === 'error';
  const isCloudUnavailable = isSyncError && notice?.message === 'Cloud sync is unavailable. Your local draft is still editable.';

  return {
    isSyncError,
    title: isCloudUnavailable ? 'Cloud sync unavailable' : '',
    message: isCloudUnavailable ? 'Your work is saved locally and remains editable.' : notice?.message,
  };
}

function getPreviewEntryOrder(previewModel, sectionId) {
  const block = previewModel?.sectionBlocks?.find((section) => section.id === sectionId);
  const entries = Array.isArray(block?.entries) ? block.entries : [];

  return entries.map((entry) => entry.id).filter(Boolean);
}

function getPreviewEntrySampleBindings(previewModel, sectionId) {
  const block = previewModel?.sectionBlocks?.find((section) => section.id === sectionId);
  const entries = Array.isArray(block?.entries) ? block.entries : [];

  return Object.fromEntries(
    entries
      .map((entry) => [
        entry.id,
        Number.isInteger(entry.sampleSourceIndex) ? entry.sampleSourceIndex : null,
      ])
      .filter(([entryId, sourceIndex]) => entryId && Number.isInteger(sourceIndex)),
  );
}

function getPreviewSectionOrder(previewModel) {
  if (Array.isArray(previewModel?.sectionOrder) && previewModel.sectionOrder.length > 0) {
    return previewModel.sectionOrder.filter(Boolean);
  }

  return Array.isArray(previewModel?.sectionBlocks)
    ? previewModel.sectionBlocks.map((section) => section.id).filter(Boolean)
    : [];
}

function getPreviewTextListOrder(previewModel, sectionId, entryId, field) {
  const block = previewModel?.sectionBlocks?.find((section) => section.id === sectionId);
  const entry = block?.entries?.find((sectionEntry) => sectionEntry.id === entryId);
  const items = Array.isArray(entry?.[field]) ? entry[field] : [];

  return items.map((item, index) => (
    Number.isFinite(item?.sourceIndex) ? item.sourceIndex : index
  ));
}

function moveSourceIndexWithinOrder(order, fromIndex, toIndex) {
  const fromPosition = order.indexOf(fromIndex);
  const toPosition = order.indexOf(toIndex);

  if (fromPosition < 0 || toPosition < 0 || fromPosition === toPosition) {
    return order;
  }

  const nextOrder = [...order];
  const [item] = nextOrder.splice(fromPosition, 1);
  nextOrder.splice(toPosition, 0, item);
  return nextOrder;
}

function App() {
  const previewPanelRef = useRef(null);
  const documentTitleRef = useRef('ResumeLoomr | Professional Resume Builder');
  const authUserRef = useRef(null);
  const preSignInConnectedAccountRef = useRef(readConnectedAccount());
  const [editorStageMaxHeight, setEditorStageMaxHeight] = useState(null);
  const auth = useFirebaseAuth();
  const [isAccountSettingsOpen, setIsAccountSettingsOpen] = useState(false);
  const [isSignedOutPromptOpen, setIsSignedOutPromptOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importState, setImportState] = useState({ status: 'idle' });
  const [isSignOutInProgress, setIsSignOutInProgress] = useState(false);
  const [accountSwitchResolutionUid, setAccountSwitchResolutionUid] = useState('');
  const [signedOutEditingPreference, setSignedOutEditingPreference] = useState(() => readSignedOutEditingPreference());
  const previewEditRequestIdRef = useRef(0);
  const previewPulseRequestIdRef = useRef(0);
  const [previewEditTarget, setPreviewEditTarget] = useState(null);
  const [previewPulseTarget, setPreviewPulseTarget] = useState(null);
  const [editorCaretTarget, setEditorCaretTarget] = useState(null);
  const [previewLayout, setPreviewLayout] = useState({ mode: 'fitPage', width: 0 });
  const [emptyChoiceNudgeCount, setEmptyChoiceNudgeCount] = useState(0);
  const [isPrintRendering, setIsPrintRendering] = useState(false);
  const [separatorSettingsAnchor, setSeparatorSettingsAnchor] = useState(null);
  const separatorPointerExitTimerRef = useRef(null);
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') {
      return 'light';
    }

    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme;
    }

    return 'light';
  });
  const pendingAccountSwitchAccount = auth.user && preSignInConnectedAccountRef.current?.uid !== auth.user.uid
    ? preSignInConnectedAccountRef.current
    : null;
  const isAccountSwitchPending = Boolean(
    auth.user &&
    pendingAccountSwitchAccount?.uid &&
    accountSwitchResolutionUid !== auth.user.uid &&
    hasLocalResumeWorkspaceData()
  );
  const builderUser = isAccountSwitchPending ? null : auth.user;
  const {
    resume,
    template,
    setTemplate,
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
    showNotice,
    dismissNotice,
    saveState,
    syncState,
    conflict,
    resolveConflictWithCloud,
    resolveConflictWithLocal,
    saveConflictAsCopy,
    retryCloudSync,
    flushActiveCloudDraft,
    templateOptions,
    resumeList,
    workspaceOrganization,
    activeResumeId,
    activeResumeName,
    canAddResume,
    canDeleteActiveResume,
    setActiveResume,
    createResume,
    createImportPlaceholderResume,
    replaceResumeDraft,
    duplicateActiveResume,
    renameActiveResume,
    createResumeFolder,
    renameResumeFolder,
    setResumeOrganization,
    deleteResumes,
  } = useResumeBuilder({
    user: builderUser,
    authReady: auth.authReady,
  });
  const sampleOrderOverrides = resume.sampleDisplay?.textListOrders || EMPTY_SAMPLE_ORDER_OVERRIDES;
  const sampleDisplay = resume.sampleDisplay || {};
  const shouldShowEmptyResumeChoice = !previewModel.hasContent && !sampleDisplay.hasStarted;
  const canUseSampleInformation = Boolean(sampleDisplay.hasStarted && !sampleDisplay.isDismissed);
  const shouldShowSampleInformation = Boolean(canUseSampleInformation && sampleDisplay.showInformation);
  const samplePreviewModel = useMemo(
    () => (shouldShowSampleInformation
      ? createMixedSamplePreviewModel(resume, activeResumeId, previewModel, sampleOrderOverrides, {
        activeSectionId: activeTab,
      })
      : null),
    [activeResumeId, activeTab, previewModel, resume, sampleOrderOverrides, shouldShowSampleInformation],
  );
  const samplePlaceholderFor = useMemo(
    () => createSamplePlaceholderResolver(resume, samplePreviewModel),
    [resume, samplePreviewModel],
  );
  const displayPreviewModel = isPrintRendering ? previewModel : (samplePreviewModel || previewModel);
  const isSamplePreview = Boolean(samplePreviewModel) && !isPrintRendering;
  const isImportingResume = importState.status === 'processing';
  const noticePresentation = getNoticeToastPresentation(notice, syncState);

  const closeSeparatorSettings = useCallback(({ restoreFocus = true } = {}) => {
    const triggerElement = separatorSettingsAnchor?.triggerElement;

    if (separatorPointerExitTimerRef.current) {
      window.clearTimeout(separatorPointerExitTimerRef.current);
      separatorPointerExitTimerRef.current = null;
    }

    setSeparatorSettingsAnchor(null);

    if (restoreFocus) {
      window.requestAnimationFrame(() => {
        triggerElement?.focus?.();
      });
    }
  }, [separatorSettingsAnchor]);

  const handleSeparatorSettingsOpen = useCallback((anchor) => {
    if (separatorPointerExitTimerRef.current) {
      window.clearTimeout(separatorPointerExitTimerRef.current);
      separatorPointerExitTimerRef.current = null;
    }

    setSeparatorSettingsAnchor(anchor);
  }, []);

  const cancelSeparatorPointerExit = useCallback(() => {
    if (separatorPointerExitTimerRef.current) {
      window.clearTimeout(separatorPointerExitTimerRef.current);
      separatorPointerExitTimerRef.current = null;
    }
  }, []);

  const scheduleSeparatorPointerExit = useCallback(() => {
    cancelSeparatorPointerExit();
    separatorPointerExitTimerRef.current = window.setTimeout(() => {
      separatorPointerExitTimerRef.current = null;

      if (document.querySelector('.resumePage:hover, .separatorSettingsPopup:hover')) {
        return;
      }

      closeSeparatorSettings({ restoreFocus: false });
    }, 120);
  }, [cancelSeparatorPointerExit, closeSeparatorSettings]);

  const handleSeparatorSettingChange = useCallback((settingId, value) => {
    actions.setResumeSettingValue(settingId, value);
  }, [actions]);

  useEffect(() => {
    setSeparatorSettingsAnchor(null);
  }, [activeResumeId]);

  useEffect(() => {
    if (!separatorSettingsAnchor) {
      return undefined;
    }

    function handleSeparatorRegionMouseMove(event) {
      const target = event.target;
      const isInsideInteractiveRegion = target instanceof Element && (
        target.closest('.resumePage') || target.closest('.separatorSettingsPopup')
      );

      if (isInsideInteractiveRegion) {
        cancelSeparatorPointerExit();
        return;
      }

      scheduleSeparatorPointerExit();
    }

    document.addEventListener('mousemove', handleSeparatorRegionMouseMove, { passive: true });
    document.addEventListener('mouseleave', scheduleSeparatorPointerExit);

    return () => {
      document.removeEventListener('mousemove', handleSeparatorRegionMouseMove);
      document.removeEventListener('mouseleave', scheduleSeparatorPointerExit);
    };
  }, [cancelSeparatorPointerExit, scheduleSeparatorPointerExit, separatorSettingsAnchor]);

  useEffect(() => () => {
    if (separatorPointerExitTimerRef.current) {
      window.clearTimeout(separatorPointerExitTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      documentTitleRef.current = document.title || documentTitleRef.current;
    }
  }, []);

  useEffect(() => {
    authUserRef.current = auth.user;
  }, [auth.user]);

  useEffect(() => {
    if (!auth.user) {
      preSignInConnectedAccountRef.current = auth.connectedAccount;
      setAccountSwitchResolutionUid('');
    }
  }, [auth.connectedAccount, auth.user]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);

    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) {
      themeColor.setAttribute('content', theme === 'dark' ? '#0f1726' : '#3158d5');
    }

    const favicon = document.querySelector('#app-favicon');
    if (favicon) {
      favicon.setAttribute('href', theme === 'dark' ? '/favicon-dark.png' : '/favicon-light.png');
    }
  }, [theme]);

  useEffect(() => {
    function syncEditorHeight() {
      if (window.innerWidth <= 980) {
        setEditorStageMaxHeight(null);
        return;
      }

      const previewPanelHeight = previewPanelRef.current?.offsetHeight ?? 0;
      setEditorStageMaxHeight(previewPanelHeight > 0 ? previewPanelHeight : null);
    }

    syncEditorHeight();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', syncEditorHeight);
      return () => window.removeEventListener('resize', syncEditorHeight);
    }

    const observer = new ResizeObserver(() => {
      syncEditorHeight();
    });

    if (previewPanelRef.current) {
      observer.observe(previewPanelRef.current);
    }

    window.addEventListener('resize', syncEditorHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', syncEditorHeight);
    };
  }, [template, displayPreviewModel]);

  useEffect(() => {
    function preparePrintPreview() {
      flushSync(() => setIsPrintRendering(true));
    }

    function restoreDocumentTitle() {
      document.title = documentTitleRef.current;
      setIsPrintRendering(false);
    }

    window.addEventListener('beforeprint', preparePrintPreview);
    window.addEventListener('afterprint', restoreDocumentTitle);

    return () => {
      window.removeEventListener('beforeprint', preparePrintPreview);
      window.removeEventListener('afterprint', restoreDocumentTitle);
    };
  }, []);

  function handlePrint() {
    document.title = activeResumeName || 'Resume';
    flushSync(() => setIsPrintRendering(true));
    printResume();
  }

  function handlePreviewEditTarget(target) {
    if (!target?.sectionId || !target?.path) {
      return;
    }

    previewEditRequestIdRef.current += 1;
    setPreviewEditTarget({
      ...target,
      requestId: previewEditRequestIdRef.current,
    });
    setActiveTab(target.sectionId);
    setMobileView('editor');
  }

  const handlePreviewPulseTarget = useCallback((target) => {
    if (!target?.path) {
      return;
    }

    previewPulseRequestIdRef.current += 1;
    setPreviewPulseTarget({
      path: target.path,
      requestId: previewPulseRequestIdRef.current,
    });
  }, []);

  const updateEditorCaretTarget = useCallback((target) => {
    if (!target?.path) {
      startTransition(() => {
        setEditorCaretTarget(null);
      });
      return;
    }

    const offset = Number.isFinite(target.offset) ? Math.max(0, target.offset) : 0;
    const value = typeof target.value === 'string' ? target.value : undefined;

    startTransition(() => {
      setEditorCaretTarget((currentTarget) => (
        currentTarget?.path === target.path &&
        currentTarget?.offset === offset &&
        currentTarget?.value === value
          ? currentTarget
          : { path: target.path, offset, value }
      ));
    });
  }, []);

  const handlePreviewReorderSectionTextList = useCallback((sectionId, entryId, field, fromIndex, toIndex) => {
    if (!isSamplePreview) {
      actions.reorderSectionTextList(sectionId, entryId, field, fromIndex, toIndex);
      return;
    }

    const orderKey = `${sectionId}.${entryId}.${field}`;
    const persistableMove = getPersistableSampleTextListMove(resume, sectionId, entryId, field, fromIndex, toIndex);

    if (persistableMove) {
      actions.reorderSectionTextList(sectionId, entryId, field, persistableMove.fromIndex, persistableMove.toIndex);

      actions.setSampleTextListOrder(orderKey, null);

      return;
    }

    const currentOrder = getPreviewTextListOrder(displayPreviewModel, sectionId, entryId, field);
    const nextOrder = moveSourceIndexWithinOrder(currentOrder, fromIndex, toIndex);

    if (nextOrder === currentOrder) {
      return;
    }

    actions.setSampleTextListOrder(orderKey, nextOrder);
  }, [actions, displayPreviewModel, isSamplePreview, resume]);

  const handlePreviewReorderSectionEntries = useCallback((sectionId, nextEntryIds) => {
    if (!isSamplePreview) {
      actions.reorderSectionEntries(sectionId, nextEntryIds);
      return;
    }

    const currentOrder = getPreviewEntryOrder(displayPreviewModel, sectionId);
    const nextOrder = Array.isArray(nextEntryIds) ? nextEntryIds.filter(Boolean) : [];

    if (
      !activeResumeId ||
      currentOrder.length !== nextOrder.length ||
      currentOrder.every((entryId, index) => entryId === nextOrder[index])
    ) {
      return;
    }

    const currentIdSet = new Set(currentOrder);
    if (!nextOrder.every((entryId) => currentIdSet.has(entryId))) {
      return;
    }

    actions.materializeAndReorderSectionEntries(
      sectionId,
      nextOrder,
      getPreviewEntrySampleBindings(displayPreviewModel, sectionId),
    );
  }, [actions, activeResumeId, displayPreviewModel, isSamplePreview]);

  const handlePreviewReorderSections = useCallback((nextSectionIds) => {
    if (!isSamplePreview) {
      reorderSections(nextSectionIds);
      return;
    }

    const currentOrder = getPreviewSectionOrder(displayPreviewModel);
    const nextOrder = Array.isArray(nextSectionIds) ? nextSectionIds.filter(Boolean) : [];

    if (
      currentOrder.length === 0 ||
      currentOrder.length !== nextOrder.length ||
      currentOrder.every((sectionId, index) => sectionId === nextOrder[index])
    ) {
      return;
    }

    const currentIdSet = new Set(currentOrder);
    if (!nextOrder.every((sectionId) => currentIdSet.has(sectionId))) {
      return;
    }

    reorderSections(nextOrder);
  }, [displayPreviewModel, isSamplePreview, reorderSections]);

  const handlePreviewLayoutChange = useCallback((nextLayout) => {
    setPreviewLayout((currentLayout) => (
      currentLayout.mode === nextLayout.mode && currentLayout.width === nextLayout.width
        ? currentLayout
        : nextLayout
    ));
  }, []);
  const handleStartPendingInteraction = useCallback(() => {
    setEmptyChoiceNudgeCount((count) => count + 1);
  }, []);

  const clearPreviewEditTarget = useCallback((requestId) => {
    setPreviewEditTarget((currentTarget) => {
      if (requestId && currentTarget?.requestId !== requestId) {
        return currentTarget;
      }

      return null;
    });
  }, []);

  function handleImportResumeClick() {
    if (!auth.user) {
      auth.openAuthModal();
      return;
    }

    setIsImportModalOpen(true);
  }

  async function handleImportResumeUpload(file) {
    if (!auth.user) {
      setIsImportModalOpen(false);
      auth.openAuthModal();
      return;
    }

    const importUser = auth.user;
    let placeholderResumeId = null;

    setIsImportModalOpen(false);
    setImportState({ status: 'processing', fileName: file.name });

    try {
      placeholderResumeId = createImportPlaceholderResume({ sourceFileName: file.name });

      if (!placeholderResumeId) {
        throw new Error('Create or delete a resume before importing another file.');
      }

      setImportState({ status: 'processing', fileName: file.name, resumeId: placeholderResumeId });

      const idToken = await importUser.getIdToken();
      const importedDraft = await importResumeFile({ file, idToken });

      if (authUserRef.current?.uid !== importUser.uid) {
        showNotice({
          tone: 'error',
          message: 'The import finished after your account changed, so it was not applied.',
        });
        return;
      }

      await replaceResumeDraft(placeholderResumeId, importedDraft.draft, {
        name: importedDraft.suggestedName || file.name,
      });

      if (importedDraft.draft?.importWarnings?.length > 0) {
        showNotice({
          tone: 'warning',
          message: 'Imported resume added. Some sections may need review.',
        });
      }
    } catch (error) {
      showNotice({
        tone: 'error',
        message: error?.message || 'Resume import failed. The blank resume is still editable.',
      });
    } finally {
      setImportState({ status: 'idle' });
    }
  }

  useEffect(() => {
    if (!auth.user || signedOutEditingPreference.allow) {
      return undefined;
    }

    function handleBeforeUnload(event) {
      if (syncState !== 'syncing' && syncState !== 'error' && syncState !== 'offline') {
        return;
      }

      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [auth.user, signedOutEditingPreference.allow, syncState]);

  function updateSignedOutEditingPreference(nextPreference) {
    setSignedOutEditingPreference(writeSignedOutEditingPreference(nextPreference));
  }

  async function completeSignOut({ allowSignedOutEditing }) {
    setIsSignOutInProgress(true);

    try {
      if (!allowSignedOutEditing) {
        const flushedDraft = await flushActiveCloudDraft({ reason: 'signout' });

        if (auth.user && !flushedDraft) {
          showNotice({
            tone: 'error',
            message: 'Cloud sync did not finish, so this browser was not cleared. Reconnect and try again.',
          });
          return;
        }
      } else {
        await flushActiveCloudDraft({ reason: 'signout' });
      }

      const signedOut = await auth.signOut();

      if (!signedOut) {
        return;
      }

      if (!allowSignedOutEditing) {
        await clearResumeSyncSession();
        await clearLocalResumeWorkspaceData();
        window.location.reload();
      }
    } finally {
      setIsSignOutInProgress(false);
      setIsSignedOutPromptOpen(false);
    }
  }

  async function handleSignOut() {
    if (signedOutEditingPreference.skipPrompt) {
      await completeSignOut({ allowSignedOutEditing: signedOutEditingPreference.allow });
      return;
    }

    setIsSignedOutPromptOpen(true);
  }

  async function handleSignedOutPromptChoice(choice) {
    if (choice.skipPrompt) {
      updateSignedOutEditingPreference(choice);
    } else {
      updateSignedOutEditingPreference({
        ...signedOutEditingPreference,
        allow: choice.allow,
      });
    }

    await completeSignOut({ allowSignedOutEditing: choice.allow });
  }

  async function handleSignOutPromptCancel() {
    if (isSignOutInProgress) {
      return;
    }

    setIsSignedOutPromptOpen(false);
  }

  async function handleDisconnectBrowser() {
    if (auth.user) {
      const flushedDraft = await flushActiveCloudDraft({ reason: 'disconnect-browser' });

      if (!flushedDraft) {
        showNotice({
          tone: 'error',
          message: 'Cloud sync did not finish, so this browser was not cleared. Reconnect and try again.',
        });
        return;
      }
    }

    await auth.clearBrowserConnection();
    await clearBrowserResumeConnectionData();
    window.location.reload();
  }

  function handleAccountSwitchImport() {
    if (!auth.user) {
      return;
    }

    preSignInConnectedAccountRef.current = {
      uid: auth.user.uid,
      email: auth.user.email || '',
      displayName: auth.user.displayName || '',
    };
    setAccountSwitchResolutionUid(auth.user.uid);
    showNotice({
      tone: 'warning',
      message: 'Browser resumes will be imported into this signed-in account.',
    });
  }

  async function handleAccountSwitchClear() {
    if (!auth.user) {
      return;
    }

    await clearLocalResumeWorkspaceData();
    preSignInConnectedAccountRef.current = {
      uid: auth.user.uid,
      email: auth.user.email || '',
      displayName: auth.user.displayName || '',
    };
    setAccountSwitchResolutionUid(auth.user.uid);
    window.location.reload();
  }

  function handleOpenAuthFromSettings() {
    setIsAccountSettingsOpen(false);
    auth.openAuthModal();
  }

  return (
    <div className="app">
      <div className="appShell">
        <Header
          onPrint={handlePrint}
          resumeList={resumeList}
          workspaceOrganization={workspaceOrganization}
          activeResumeId={activeResumeId}
          activeResumeName={activeResumeName}
          canAddResume={canAddResume}
          canDeleteActiveResume={canDeleteActiveResume}
          onSetActiveResume={setActiveResume}
          onCreateResume={createResume}
          onDuplicateResume={duplicateActiveResume}
          onRenameResume={renameActiveResume}
          onCreateResumeFolder={createResumeFolder}
          onRenameResumeFolder={renameResumeFolder}
          onSetResumeOrganization={setResumeOrganization}
          onDeleteResume={deleteResumes}
          authUser={auth.user}
          authReady={auth.authReady}
          firebaseEnabled={auth.firebaseEnabled}
          onOpenAuth={auth.openAuthModal}
          onSignOut={handleSignOut}
        />

        <AuthModal
          isOpen={auth.isAuthModalOpen}
          busy={auth.authBusy}
          error={auth.authError}
          onClose={auth.closeAuthModal}
          onGoogleSignIn={auth.signInWithGoogle}
          onEmailSignIn={auth.signInWithEmail}
          onEmailSignUp={auth.signUpWithEmail}
        />

        <ImportResumeModal
          isOpen={isImportModalOpen}
          busy={isImportingResume}
          onClose={() => setIsImportModalOpen(false)}
          onUpload={handleImportResumeUpload}
        />

        {separatorSettingsAnchor && (
          <SeparatorSettingsPopup
            anchor={separatorSettingsAnchor}
            settings={resume.settings}
            onChange={handleSeparatorSettingChange}
            onClose={closeSeparatorSettings}
          />
        )}

        <SignedOutEditingPrompt
          isOpen={isSignedOutPromptOpen}
          busy={auth.authBusy || isSignOutInProgress}
          onCancel={handleSignOutPromptCancel}
          onChoose={handleSignedOutPromptChoice}
        />

        <AccountSwitchPrompt
          isOpen={isAccountSwitchPending}
          previousAccount={pendingAccountSwitchAccount}
          nextAccount={auth.user}
          busy={auth.authBusy}
          onImportLocalData={handleAccountSwitchImport}
          onClearLocalData={handleAccountSwitchClear}
        />

        <AccountSettings
          isOpen={isAccountSettingsOpen}
          saveState={saveState}
          syncState={syncState}
          theme={theme}
          authUser={auth.user}
          connectedAccount={auth.connectedAccount}
          firebaseEnabled={auth.firebaseEnabled}
          signedOutEditingPreference={signedOutEditingPreference}
          busy={auth.authBusy}
          onOpen={() => setIsAccountSettingsOpen(true)}
          onClose={() => setIsAccountSettingsOpen(false)}
          onToggleTheme={() => setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))}
          onOpenAuth={handleOpenAuthFromSettings}
          onDisconnectBrowser={handleDisconnectBrowser}
          onSignedOutEditingPreferenceChange={updateSignedOutEditingPreference}
        />

        {notice && (
          <div
            className={`noticeToast noticeToast--${notice.tone}`}
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            <span className="noticeToastIcon">
              <NoticeToastIcon isSyncError={noticePresentation.isSyncError} />
            </span>
            <span className="noticeToastCopy">
              {noticePresentation.title ? <strong>{noticePresentation.title}</strong> : null}
              <span>{noticePresentation.message}</span>
            </span>
            <span className="noticeToastActions">
              {noticePresentation.isSyncError ? (
                <button type="button" className="noticeToastRetry" onClick={retryCloudSync}>
                  Retry
                </button>
              ) : null}
              <button
                type="button"
                className="noticeToastDismiss"
                onClick={dismissNotice}
                aria-label="Dismiss message"
              >
                <NoticeDismissIcon />
              </button>
            </span>
          </div>
        )}

        {conflict && (
          <div className="conflictBanner" role="alert">
            <div>
              <strong>This resume changed in another tab or device.</strong>
              <span>Choose which version to keep before continuing.</span>
            </div>
            <div className="conflictActions">
              <button type="button" className="button buttonSecondary" onClick={resolveConflictWithCloud}>
                Use saved version
              </button>
              <button type="button" className="button buttonSecondary" onClick={resolveConflictWithLocal}>
                Keep my edits
              </button>
              <button type="button" className="button buttonPrimary" onClick={saveConflictAsCopy}>
                Save as copy
              </button>
            </div>
          </div>
        )}

        <div className="mobileWorkspaceToggle" role="tablist" aria-label="Workspace view">
          <button
            type="button"
            className={`mobileWorkspaceButton ${mobileView === 'editor' ? 'isActive' : ''}`}
            aria-selected={mobileView === 'editor'}
            onClick={() => setMobileView('editor')}
          >
            Editor
          </button>
          <button
            type="button"
            className={`mobileWorkspaceButton ${mobileView === 'preview' ? 'isActive' : ''}`}
            aria-selected={mobileView === 'preview'}
            onClick={() => setMobileView('preview')}
          >
            Preview
          </button>
        </div>

        <main
          className={`workspace ${previewLayout.mode === 'fitPage' && previewLayout.width > 0 ? 'isPreviewFitPageLayout' : ''}`}
          style={previewLayout.mode === 'fitPage' && previewLayout.width > 0
            ? { '--workspace-fit-page-width': `${previewLayout.width}px` }
            : undefined}
        >
          <div className={`workspaceColumn workspaceColumnEditor ${mobileView === 'preview' ? 'isMobileHidden' : ''}`}>
            <EditorPanel
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              onMoveSection={moveSection}
              onReorderSections={reorderSections}
              template={template}
              templateOptions={templateOptions}
              onTemplateChange={setTemplate}
              resume={resume}
              actions={actions}
              getFieldError={getFieldError}
              markTouched={markTouched}
              maxHeight={editorStageMaxHeight}
              isStartPending={shouldShowEmptyResumeChoice}
              onStartPendingInteraction={handleStartPendingInteraction}
              previewEditTarget={previewEditTarget}
              placeholderFor={samplePlaceholderFor}
              onClearPreviewEditTarget={clearPreviewEditTarget}
              onPreviewPulseTarget={handlePreviewPulseTarget}
              onEditorCaretChange={updateEditorCaretTarget}
            />
          </div>

          <div className={`workspaceColumn workspaceColumnPreview ${mobileView === 'editor' ? 'isMobileHidden' : ''}`}>
            <ResumePreview
              previewModel={displayPreviewModel}
              template={template}
              settings={resume.settings}
              isSamplePreview={isSamplePreview}
              panelRef={previewPanelRef}
              onEditTarget={handlePreviewEditTarget}
              onLayoutChange={handlePreviewLayoutChange}
              onReorderSections={handlePreviewReorderSections}
              onReorderSectionEntries={handlePreviewReorderSectionEntries}
              onReorderSectionTextList={handlePreviewReorderSectionTextList}
              onReorderPersonalContact={actions.setPersonalContactOrder}
              onPersonalAlignmentChange={(alignment) => actions.setResumeSettingValue('personalAlignment', alignment)}
              onPersonalHeaderOrderChange={(order) => actions.setResumeSettingValue('personalHeaderOrder', order)}
              onSetSectionEntryHeaderLayout={actions.setSectionEntryHeaderLayout}
              onAdjustSetting={actions.updateResumeSetting}
              onSummaryWidthChange={actions.setSummaryWidthPercent}
              onSeparatorSettingsOpen={handleSeparatorSettingsOpen}
              activeEditorCaret={editorCaretTarget}
              previewPulseTarget={previewPulseTarget}
              showEmptyResumeChoice={shouldShowEmptyResumeChoice}
              emptyChoiceNudgeCount={emptyChoiceNudgeCount}
              isImportingResume={isImportingResume}
              showSampleInformationToggle={canUseSampleInformation}
              showSampleInformation={shouldShowSampleInformation}
              onImportResume={handleImportResumeClick}
              onStartFromScratch={actions.startFromScratch}
              onToggleSampleInformation={actions.setSampleInformationVisible}
              onDismissSampleInformation={actions.dismissSampleInformation}
            />
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
