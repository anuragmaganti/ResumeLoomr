import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useAccountSwitchGate } from './hooks/useAccountSwitchGate.js';
import { usePreviewEditorController } from './hooks/usePreviewEditorController.js';
import { useSeparatorSettingsController } from './hooks/useSeparatorSettingsController.js';
import { useSignOutController } from './hooks/useSignOutController.js';
import { importResumeFile } from './lib/importResume.js';
import {
  createMixedSamplePreviewModel,
  createSamplePlaceholderResolver,
} from './lib/sampleResumes.js';

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

function App() {
  const previewPanelRef = useRef(null);
  const documentTitleRef = useRef('ResumeLoomr | Professional Resume Builder');
  const authUserRef = useRef(null);
  const [editorStageMaxHeight, setEditorStageMaxHeight] = useState(null);
  const auth = useFirebaseAuth();
  const [isAccountSettingsOpen, setIsAccountSettingsOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importState, setImportState] = useState({ status: 'idle' });
  const [previewLayout, setPreviewLayout] = useState({ mode: 'fitPage', width: 0 });
  const [emptyChoiceNudgeCount, setEmptyChoiceNudgeCount] = useState(0);
  const [isPrintRendering, setIsPrintRendering] = useState(false);
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
  const {
    builderUser,
    clearLocalData: clearAccountSwitchLocalData,
    importLocalData: importAccountSwitchLocalData,
    isClearing: isClearingAccountSwitchData,
    isSwitchPending: isAccountSwitchPending,
    previousAccount: pendingAccountSwitchAccount,
  } = useAccountSwitchGate({
    user: auth.user,
    authReady: auth.authReady,
    connectedAccount: auth.connectedAccount,
  });
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
    localReady,
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
  const {
    cancelSignOut: handleSignOutPromptCancel,
    chooseSignOutBehavior: handleSignedOutPromptChoice,
    disconnectBrowser: handleDisconnectBrowser,
    editingPreference: signedOutEditingPreference,
    isDisconnecting,
    isPromptOpen: isSignedOutPromptOpen,
    isSigningOut: isSignOutInProgress,
    requestSignOut: handleSignOut,
    updateEditingPreference: updateSignedOutEditingPreference,
  } = useSignOutController({
    auth,
    flushActiveCloudDraft,
    showNotice,
    syncState,
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
  const {
    clearPreviewEditTarget,
    editorCaretTarget,
    handleEditorEntryExit,
    handleEditorEntryFocus,
    handlePreviewEditTarget,
    handlePreviewEditorHandoff,
    handlePreviewPulseTarget,
    handlePreviewReorderSectionEntries,
    handlePreviewReorderSections,
    handlePreviewReorderSectionTextList,
    handlePreviewValueChange,
    handlePreviewValueCommit,
    previewEditTarget,
    previewPulseTarget,
    updateEditorCaretTarget,
  } = usePreviewEditorController({
    actions,
    activeResumeId,
    displayPreviewModel,
    isSamplePreview,
    markTouched,
    reorderSections,
    resume,
    setActiveTab,
    setMobileView,
  });
  const {
    anchor: separatorSettingsAnchor,
    close: closeSeparatorSettings,
    handleSettingChange: handleSeparatorSettingChange,
    open: handleSeparatorSettingsOpen,
  } = useSeparatorSettingsController({
    activeResumeId,
    onSettingChange: actions.setResumeSettingValue,
  });

  useEffect(() => {
    if (typeof document !== 'undefined') {
      documentTitleRef.current = document.title || documentTitleRef.current;
    }
  }, []);

  useEffect(() => {
    authUserRef.current = auth.user;
  }, [auth.user]);

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

  function handleImportResumeClick() {
    actions.endTransientSampleEntry();

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
      placeholderResumeId = await createImportPlaceholderResume({ sourceFileName: file.name });

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

  function handleAccountSwitchImport() {
    if (!importAccountSwitchLocalData()) {
      return;
    }

    showNotice({
      tone: 'warning',
      message: 'Browser resumes will be imported into this signed-in account.',
    });
  }

  async function handleAccountSwitchClear() {
    if (!await clearAccountSwitchLocalData()) {
      showNotice({
        tone: 'error',
        message: 'Browser resumes could not be cleared. Reload and try again.',
      });
    }
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
          workspaceReady={localReady}
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
          busy={auth.authBusy || isClearingAccountSwitchData}
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
          busy={auth.authBusy || isDisconnecting}
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
              onEditorEntryFocus={handleEditorEntryFocus}
              onEditorEntryExit={handleEditorEntryExit}
            />
          </div>

          <div className={`workspaceColumn workspaceColumnPreview ${mobileView === 'editor' ? 'isMobileHidden' : ''}`}>
            <ResumePreview
              resume={resume}
              resumeId={activeResumeId}
              previewModel={displayPreviewModel}
              template={template}
              settings={resume.settings}
              isSamplePreview={isSamplePreview}
              panelRef={previewPanelRef}
              onEditTarget={handlePreviewEditTarget}
              onPreviewValueChange={handlePreviewValueChange}
              onPreviewValueCommit={handlePreviewValueCommit}
              onPreviewCaretChange={updateEditorCaretTarget}
              onPreviewEditorHandoff={handlePreviewEditorHandoff}
              onPreviewInteractionStart={actions.endTransientSampleEntry}
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
              isPrintRendering={isPrintRendering}
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
