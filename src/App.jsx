import { useCallback, useEffect, useRef, useState } from 'react';
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
import { useResumeBuilder } from './hooks/useResumeBuilder.js';
import { useFirebaseAuth } from './hooks/useFirebaseAuth.js';
import { importResumeFile } from './lib/importResume.js';
import { clearResumeSyncSession } from './lib/backgroundSync.js';
import {
  clearBrowserResumeConnectionData,
  clearLocalResumeWorkspaceData,
  hasLocalResumeWorkspaceData,
  readConnectedAccount,
  readSignedOutEditingPreference,
  writeSignedOutEditingPreference,
} from './lib/browserConnection.js';

const THEME_STORAGE_KEY = 'resumeloomr:theme';

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
  const [previewEditTarget, setPreviewEditTarget] = useState(null);
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
    reorderSection,
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
    saveLabel,
    syncState,
    conflict,
    resolveConflictWithCloud,
    resolveConflictWithLocal,
    saveConflictAsCopy,
    retryCloudSync,
    flushActiveCloudDraft,
    templateOptions,
    resumeList,
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
    reorderResumes,
    deleteActiveResume,
  } = useResumeBuilder({
    user: builderUser,
    authReady: auth.authReady,
    trustedDevice: auth.trustedDevice,
  });
  const isImportingResume = importState.status === 'processing';

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
  }, [template, previewModel]);

  useEffect(() => {
    function restoreDocumentTitle() {
      document.title = documentTitleRef.current;
    }

    window.addEventListener('afterprint', restoreDocumentTitle);

    return () => {
      window.removeEventListener('afterprint', restoreDocumentTitle);
    };
  }, []);

  function handlePrint() {
    document.title = activeResumeName || 'Resume';
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
        clearLocalResumeWorkspaceData();
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
    clearBrowserResumeConnectionData();
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

  function handleAccountSwitchClear() {
    if (!auth.user) {
      return;
    }

    clearLocalResumeWorkspaceData();
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
          onImportResume={handleImportResumeClick}
          isImportingResume={isImportingResume}
          resumeList={resumeList}
          activeResumeId={activeResumeId}
          activeResumeName={activeResumeName}
          canAddResume={canAddResume}
          canDeleteActiveResume={canDeleteActiveResume}
          onSetActiveResume={setActiveResume}
          onCreateResume={createResume}
          onDuplicateResume={duplicateActiveResume}
          onRenameResume={renameActiveResume}
          onReorderResumes={reorderResumes}
          onDeleteResume={deleteActiveResume}
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
          trustedDevice={auth.trustedDevice}
          trustedDeviceLocked={auth.trustedDeviceLocked}
          onTrustedDeviceChange={auth.setTrustedDevice}
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
          saveLabel={saveLabel}
          theme={theme}
          authUser={auth.user}
          connectedAccount={auth.connectedAccount}
          firebaseEnabled={auth.firebaseEnabled}
          trustedDevice={auth.trustedDevice}
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
          <div className={`noticeBanner noticeBanner--${notice.tone}`} role="status">
            <span>{notice.message}</span>
            <div className="noticeActions">
              {syncState === 'error' ? (
                <button type="button" className="noticeDismiss" onClick={retryCloudSync}>
                  Retry sync
                </button>
              ) : null}
              <button type="button" className="noticeDismiss" onClick={dismissNotice} aria-label="Dismiss message">
                Dismiss
              </button>
            </div>
          </div>
        )}

        {conflict && (
          <div className="conflictBanner" role="alert">
            <div>
              <strong>This resume changed on another device.</strong>
              <span>Choose which version to keep before continuing sync.</span>
            </div>
            <div className="conflictActions">
              <button type="button" className="button buttonSecondary" onClick={resolveConflictWithCloud}>
                Use cloud version
              </button>
              <button type="button" className="button buttonSecondary" onClick={resolveConflictWithLocal}>
                Keep this device
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

        <main className="workspace">
          <div className={`workspaceColumn workspaceColumnEditor ${mobileView === 'preview' ? 'isMobileHidden' : ''}`}>
            <EditorPanel
              activeTab={activeTab}
              setActiveTab={setActiveTab}
              onMoveSection={moveSection}
              onReorderSection={reorderSection}
              onReorderSections={reorderSections}
              template={template}
              templateOptions={templateOptions}
              onTemplateChange={setTemplate}
              resume={resume}
              actions={actions}
              getFieldError={getFieldError}
              markTouched={markTouched}
              maxHeight={editorStageMaxHeight}
              previewEditTarget={previewEditTarget}
              onClearPreviewEditTarget={clearPreviewEditTarget}
            />
          </div>

          <div className={`workspaceColumn workspaceColumnPreview ${mobileView === 'editor' ? 'isMobileHidden' : ''}`}>
            <ResumePreview
              previewModel={previewModel}
              template={template}
              settings={resume.settings}
              panelRef={previewPanelRef}
              onEditTarget={handlePreviewEditTarget}
            />
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
