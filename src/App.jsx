import { useCallback, useMemo, useRef, useState } from 'react';
import './App.css'
import './styles/buttons.css'
import './styles/forms.css'
import './styles/preview.css'
import './styles/cover-letter.css'
import Header from './components/header';
import AuthModal from './components/authModal';
import ImportResumeModal from './components/importResumeModal';
import AccountSettings from './components/accountSettings';
import SignedOutEditingPrompt from './components/signedOutEditingPrompt';
import AccountSwitchPrompt from './components/accountSwitchPrompt';
import ResumePreview from './components/resumePreview';
import EditorPanel from './components/editorPanel';
import CoverLetterEditorPanel from './components/coverLetterEditorPanel.jsx';
import CoverLetterPreview from './components/coverLetterPreview.jsx';
import {
  CoverLetterDeleteDialog,
  CoverLetterTemplateDialog,
} from './components/coverLetterDialogs.jsx';
import SeparatorSettingsPopup from './components/separatorSettingsPopup';
import NoticeToast from './components/noticeToast.jsx';
import ResumeConflictBanner from './components/resumeConflictBanner.jsx';
import ResumeTailoringDialog from './components/resumeTailoringDialog.jsx';
import { TailoringChangePopover } from './components/resumeTailoringReview.jsx';
import { useResumeBuilder } from './hooks/useResumeBuilder.js';
import { useFirebaseAuth } from './hooks/useFirebaseAuth.js';
import { useAccountSwitchGate } from './hooks/useAccountSwitchGate.js';
import { usePreviewEditorController } from './hooks/usePreviewEditorController.js';
import { useCoverLetterPreviewEditorController } from './hooks/useCoverLetterPreviewEditorController.js';
import { useSeparatorSettingsController } from './hooks/useSeparatorSettingsController.js';
import { useSignOutController } from './hooks/useSignOutController.js';
import { useResumeImportController } from './hooks/useResumeImportController.js';
import { useResumeTailoringController } from './hooks/useResumeTailoringController.js';
import { useAppTheme } from './hooks/useAppTheme.js';
import { useEditorStageMaxHeight } from './hooks/useEditorStageMaxHeight.js';
import { useResumePrint } from './hooks/useResumePrint.js';
import {
  createMixedSamplePreviewModel,
  createSamplePlaceholderResolver,
} from './lib/sampleResumes.js';
import {
  coverLetterHasContent,
  resolveCoverLetterSender,
} from './lib/coverLetter.js';
import {
  createMixedSampleCoverLetterModel,
  createSampleCoverLetterPlaceholderResolver,
} from './lib/sampleCoverLetters.js';
import { createTailoringPreviewModel } from './lib/resumeTailoring.js';

const EMPTY_SAMPLE_ORDER_OVERRIDES = {};

function App() {
  const previewPanelRef = useRef(null);
  const auth = useFirebaseAuth();
  const [isAccountSettingsOpen, setIsAccountSettingsOpen] = useState(false);
  const [previewLayout, setPreviewLayout] = useState({ mode: 'fitPage', width: 0 });
  const [emptyChoiceNudgeCount, setEmptyChoiceNudgeCount] = useState(0);
  const [coverLetterCreateRequest, setCoverLetterCreateRequest] = useState(null);
  const [coverLetterDeleteRequest, setCoverLetterDeleteRequest] = useState(null);
  const [isCreatingCoverLetter, setIsCreatingCoverLetter] = useState(false);
  const [isDeletingCoverLetter, setIsDeletingCoverLetter] = useState(false);
  const { theme, toggleTheme } = useAppTheme();
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
    activeDocumentType,
    activeCoverLetterId,
    activeCoverLetterGroup,
    setActiveCoverLetterGroup,
    coverLetter,
    coverLetterTemplate,
    setCoverLetterTemplate,
    coverLetterActions,
    activeResumeCoverLetters,
    openCoverLetter,
    openResumeDocument,
    getResumeTemplateForCoverLetter,
    createCoverLetter,
    deleteCoverLetter,
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
    importDocuments,
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
  const activeCoverLetterName = activeResumeCoverLetters.find((item) => item.id === activeCoverLetterId)?.name || 'Cover letter';
  const activeDocumentName = activeDocumentType === 'coverLetter' ? activeCoverLetterName : activeResumeName;
  const { handlePrint, isPrintRendering } = useResumePrint({
    activeResumeName: activeDocumentName,
    printResume,
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
  const shouldShowEmptyResumeChoice = activeDocumentType === 'resume'
    && !previewModel.hasContent
    && !sampleDisplay.hasStarted;
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
  const resolvedCoverLetterSender = useMemo(
    () => resolveCoverLetterSender(coverLetter, resume),
    [coverLetter, resume],
  );
  const canUseCoverLetterSample = Boolean(
    !resume.sampleDisplay?.isDismissed
    && !coverLetter.sampleDisplay?.isDismissed
    && (resume.sampleDisplay?.hasStarted || !previewModel.hasContent),
  );
  const shouldShowCoverLetterSample = Boolean(
    canUseCoverLetterSample && coverLetter.sampleDisplay?.showInformation,
  );
  const coverLetterSampleModel = useMemo(
    () => (shouldShowCoverLetterSample
      ? createMixedSampleCoverLetterModel({
        coverLetter,
        resolvedSender: resolvedCoverLetterSender,
        resumeId: activeResumeId,
      })
      : null),
    [activeResumeId, coverLetter, resolvedCoverLetterSender, shouldShowCoverLetterSample],
  );
  const coverLetterPlaceholderFor = useMemo(
    () => createSampleCoverLetterPlaceholderResolver(coverLetter, coverLetterSampleModel),
    [coverLetter, coverLetterSampleModel],
  );
  const displayCoverLetterSampleModel = isPrintRendering ? null : coverLetterSampleModel;
  const isCoverLetterSamplePreview = Boolean(displayCoverLetterSampleModel?.usesSampleText);
  const coverLetterPreviewModel = useMemo(
    () => ({ hasContent: coverLetterHasContent(coverLetter) || isCoverLetterSamplePreview }),
    [coverLetter, isCoverLetterSamplePreview],
  );
  const editorStageMaxHeight = useEditorStageMaxHeight({
    panelRef: previewPanelRef,
    previewModel: activeDocumentType === 'coverLetter' ? coverLetterPreviewModel : displayPreviewModel,
    template: activeDocumentType === 'coverLetter' ? coverLetterTemplate : template,
  });
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
    clearPreviewEditTarget: clearCoverLetterPreviewEditTarget,
    editorCaretTarget: coverLetterEditorCaretTarget,
    handlePreviewEditTarget: handleCoverLetterPreviewEditTarget,
    handlePreviewEditorHandoff: handleCoverLetterPreviewEditorHandoff,
    handlePreviewValueChange: handleCoverLetterPreviewValueChange,
    previewEditTarget: coverLetterPreviewEditTarget,
    previewPulseTarget: coverLetterPreviewPulseTarget,
    pulsePreviewTarget: handleCoverLetterPreviewPulseTarget,
    updateEditorCaretTarget: updateCoverLetterEditorCaretTarget,
  } = useCoverLetterPreviewEditorController({
    actions: coverLetterActions,
    coverLetter,
    resolvedSender: resolvedCoverLetterSender,
    setActiveGroup: setActiveCoverLetterGroup,
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
  const {
    closeImport: closeImportResume,
    importState,
    importSuccessfulDocument,
    isImporting: isImportingResume,
    isModalOpen: isImportModalOpen,
    openImport: handleImportResumeClick,
    uploadDocuments: handleImportResumeUpload,
  } = useResumeImportController({
    authUser: auth.user,
    openAuthModal: auth.openAuthModal,
    endTransientSampleEntry: actions.endTransientSampleEntry,
    importDocuments,
    showNotice,
  });
  const tailoring = useResumeTailoringController({
    actions,
    activeDocumentType,
    activeResumeId,
    authUser: auth.user,
    openAuthModal: auth.openAuthModal,
    resume,
    showNotice,
  });
  const tailoringPreview = useMemo(
    () => createTailoringPreviewModel(displayPreviewModel, tailoring.review),
    [displayPreviewModel, tailoring.review],
  );
  const resumePreviewModel = isPrintRendering
    ? displayPreviewModel
    : tailoringPreview.previewModel;

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

  const handleRequestCoverLetter = useCallback(async (resumeId = activeResumeId) => {
    const targetResume = resumeList.find((item) => item.id === resumeId);
    const primaryLetter = targetResume?.coverLetters?.[0];
    if (primaryLetter) {
      await openCoverLetter(primaryLetter.id);
      return;
    }

    const initialTemplate = await getResumeTemplateForCoverLetter(resumeId);
    if (!initialTemplate) return;
    setCoverLetterCreateRequest({ resumeId, initialTemplate });
  }, [activeResumeId, getResumeTemplateForCoverLetter, openCoverLetter, resumeList]);

  const handleCreateCoverLetter = useCallback(async (selectedTemplate) => {
    if (!coverLetterCreateRequest || isCreatingCoverLetter) return;
    setIsCreatingCoverLetter(true);
    try {
      const createdId = await createCoverLetter({
        resumeId: coverLetterCreateRequest.resumeId,
        template: selectedTemplate,
      });
      if (createdId) setCoverLetterCreateRequest(null);
    } finally {
      setIsCreatingCoverLetter(false);
    }
  }, [coverLetterCreateRequest, createCoverLetter, isCreatingCoverLetter]);

  const handleConfirmCoverLetterDelete = useCallback(async () => {
    if (!coverLetterDeleteRequest || isDeletingCoverLetter) return;
    setIsDeletingCoverLetter(true);
    try {
      const deleted = await deleteCoverLetter(coverLetterDeleteRequest.id);
      if (deleted) setCoverLetterDeleteRequest(null);
    } finally {
      setIsDeletingCoverLetter(false);
    }
  }, [coverLetterDeleteRequest, deleteCoverLetter, isDeletingCoverLetter]);

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
          activeDocumentType={activeDocumentType}
          activeCoverLetterId={activeCoverLetterId}
          onOpenCoverLetter={openCoverLetter}
          onOpenResumeDocument={openResumeDocument}
          onRequestCoverLetter={handleRequestCoverLetter}
          onRequestDeleteCoverLetter={setCoverLetterDeleteRequest}
          workspaceReady={localReady}
          authUser={auth.user}
          authReady={auth.authReady}
          firebaseEnabled={auth.firebaseEnabled}
          canTailorResume={tailoring.canTailor}
          isTailoringResume={tailoring.isGenerating}
          onTailorResume={tailoring.openDialog}
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
          importState={importState}
          resumeOptions={resumeList}
          activeResumeId={activeResumeId}
          onClose={closeImportResume}
          onUpload={handleImportResumeUpload}
          onImportSuccessful={importSuccessfulDocument}
        />

        {tailoring.isDialogOpen ? (
          <ResumeTailoringDialog
            busy={tailoring.isGenerating}
            error={tailoring.error}
            onClose={tailoring.closeDialog}
            onSubmit={tailoring.generateSuggestions}
          />
        ) : null}

        <TailoringChangePopover
          review={tailoring.review}
          activeChange={tailoring.activeChange}
          onDecision={tailoring.setDecision}
          onClose={tailoring.closeChange}
        />

        {coverLetterCreateRequest ? (
          <CoverLetterTemplateDialog
            key={`${coverLetterCreateRequest.resumeId}:${coverLetterCreateRequest.initialTemplate}`}
            isOpen
            initialTemplate={coverLetterCreateRequest.initialTemplate}
            busy={isCreatingCoverLetter}
            onClose={() => setCoverLetterCreateRequest(null)}
            onCreate={handleCreateCoverLetter}
          />
        ) : null}

        <CoverLetterDeleteDialog
          letter={coverLetterDeleteRequest}
          busy={isDeletingCoverLetter}
          onCancel={() => setCoverLetterDeleteRequest(null)}
          onConfirm={handleConfirmCoverLetterDelete}
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
          onToggleTheme={toggleTheme}
          onOpenAuth={handleOpenAuthFromSettings}
          onDisconnectBrowser={handleDisconnectBrowser}
          onSignedOutEditingPreferenceChange={updateSignedOutEditingPreference}
        />

        <NoticeToast
          notice={notice}
          syncState={syncState}
          onRetry={retryCloudSync}
          onDismiss={dismissNotice}
        />

        <ResumeConflictBanner
          conflict={conflict}
          onUseSavedVersion={resolveConflictWithCloud}
          onKeepLocalEdits={resolveConflictWithLocal}
          onSaveAsCopy={saveConflictAsCopy}
        />

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
            {activeDocumentType === 'coverLetter' ? (
              <CoverLetterEditorPanel
                activeGroup={activeCoverLetterGroup}
                setActiveGroup={setActiveCoverLetterGroup}
                coverLetter={coverLetter}
                resolvedSender={resolvedCoverLetterSender}
                template={coverLetterTemplate}
                onTemplateChange={setCoverLetterTemplate}
                actions={coverLetterActions}
                maxHeight={editorStageMaxHeight}
                previewEditTarget={coverLetterPreviewEditTarget}
                onClearPreviewEditTarget={clearCoverLetterPreviewEditTarget}
                onPreviewPulseTarget={handleCoverLetterPreviewPulseTarget}
                onEditorCaretChange={updateCoverLetterEditorCaretTarget}
                placeholderFor={coverLetterPlaceholderFor}
              />
            ) : (
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
            )}
          </div>

          <div className={`workspaceColumn workspaceColumnPreview ${mobileView === 'editor' ? 'isMobileHidden' : ''}`}>
            {activeDocumentType === 'coverLetter' ? (
              <CoverLetterPreview
                coverLetter={coverLetter}
                coverLetterId={activeCoverLetterId}
                template={coverLetterTemplate}
                resolvedSender={resolvedCoverLetterSender}
                panelRef={previewPanelRef}
                activeEditorCaret={coverLetterEditorCaretTarget}
                previewPulseTarget={coverLetterPreviewPulseTarget}
                isPrintRendering={isPrintRendering}
                onEditTarget={handleCoverLetterPreviewEditTarget}
                onPreviewValueChange={handleCoverLetterPreviewValueChange}
                onPreviewCaretChange={updateCoverLetterEditorCaretTarget}
                onPreviewEditorHandoff={handleCoverLetterPreviewEditorHandoff}
                onReorderBodyBlocks={coverLetterActions.reorderBodyBlocks}
                onReorderBullets={coverLetterActions.reorderBullets}
                onAdjustSetting={coverLetterActions.updateSetting}
                onLayoutChange={handlePreviewLayoutChange}
                sampleModel={displayCoverLetterSampleModel}
                isSamplePreview={isCoverLetterSamplePreview}
                showSampleInformationToggle={canUseCoverLetterSample}
                showSampleInformation={shouldShowCoverLetterSample}
                onToggleSampleInformation={coverLetterActions.setSampleInformationVisible}
                onDismissSampleInformation={coverLetterActions.dismissSampleInformation}
              />
            ) : (
              <ResumePreview
              resume={resume}
              resumeId={activeResumeId}
              previewModel={resumePreviewModel}
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
              onSectionHeadingAlignmentChange={(alignment) => actions.setResumeSettingValue('sectionHeadingAlignment', alignment)}
              onSetSectionEntryHeaderLayout={actions.setSectionEntryHeaderLayout}
              onAdjustSetting={actions.updateResumeSetting}
              onSummaryWidthChange={actions.setSummaryWidthPercent}
              onSummaryTitleVisibilityChange={actions.setSummaryTitleVisibility}
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
              onAddCoverLetter={() => handleRequestCoverLetter(activeResumeId)}
              onToggleSampleInformation={actions.setSampleInformationVisible}
              onDismissSampleInformation={actions.dismissSampleInformation}
              tailoringReview={tailoring.review}
              tailoringChangeByPath={tailoringPreview.changeByPath}
              onTailoringChangeOpen={tailoring.openChange}
              onTailoringApproveAll={() => tailoring.setAllDecisions('approved')}
              onTailoringRejectAll={() => tailoring.setAllDecisions('rejected')}
              onTailoringApply={tailoring.applyReview}
              onTailoringCancel={tailoring.cancelReview}
              />
            )}
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
