import { useEffect, useRef, useState } from 'react';
import './App.css'
import './styles/buttons.css'
import './styles/forms.css'
import './styles/preview.css'
import Header from './components/header';
import AuthModal from './components/authModal';
import ResumePreview from './components/resumePreview';
import EditorPanel from './components/editorPanel';
import { useResumeBuilder } from './hooks/useResumeBuilder.js';
import { useFirebaseAuth } from './hooks/useFirebaseAuth.js';

const THEME_STORAGE_KEY = 'resumeloomr:theme';

function App() {
  const previewPanelRef = useRef(null);
  const documentTitleRef = useRef('ResumeLoomr | Professional Resume Builder');
  const [editorStageMaxHeight, setEditorStageMaxHeight] = useState(null);
  const auth = useFirebaseAuth();
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
    resume,
    template,
    setTemplate,
    activeTab,
    setActiveTab,
    sectionOrder,
    moveSection,
    mobileView,
    setMobileView,
    previewModel,
    getFieldError,
    markTouched,
    actions,
    printResume,
    notice,
    dismissNotice,
    saveState,
    saveLabel,
    syncState,
    isCloudMode,
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
    duplicateActiveResume,
    renameActiveResume,
    deleteActiveResume,
  } = useResumeBuilder({
    user: auth.user,
    authReady: auth.authReady,
    trustedDevice: auth.trustedDevice,
  });

  useEffect(() => {
    if (typeof document !== 'undefined') {
      documentTitleRef.current = document.title || documentTitleRef.current;
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);

    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) {
      themeColor.setAttribute('content', theme === 'dark' ? '#0f1726' : '#3158d5');
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

  async function handleSignOut() {
    await flushActiveCloudDraft({ reason: 'signout' });
    await auth.signOut();
  }

  return (
    <div className="app">
      <div className="appShell">
        <Header
          saveState={saveState}
          saveLabel={saveLabel}
          theme={theme}
          onToggleTheme={() => setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))}
          onPrint={handlePrint}
          resumeList={resumeList}
          activeResumeId={activeResumeId}
          activeResumeName={activeResumeName}
          canAddResume={canAddResume}
          canDeleteActiveResume={canDeleteActiveResume}
          onSetActiveResume={setActiveResume}
          onCreateResume={createResume}
          onDuplicateResume={duplicateActiveResume}
          onRenameResume={renameActiveResume}
          onDeleteResume={deleteActiveResume}
          authUser={auth.user}
          authReady={auth.authReady}
          firebaseEnabled={auth.firebaseEnabled}
          trustedDevice={auth.trustedDevice}
          isCloudMode={isCloudMode}
          syncState={syncState}
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
              sectionOrder={sectionOrder}
              onMoveSection={moveSection}
              template={template}
              templateOptions={templateOptions}
              onTemplateChange={setTemplate}
              resume={resume}
              actions={actions}
              getFieldError={getFieldError}
              markTouched={markTouched}
              maxHeight={editorStageMaxHeight}
            />
          </div>

          <div className={`workspaceColumn workspaceColumnPreview ${mobileView === 'editor' ? 'isMobileHidden' : ''}`}>
            <ResumePreview
              previewModel={previewModel}
              sectionOrder={sectionOrder}
              template={template}
              settings={resume.settings}
              panelRef={previewPanelRef}
            />
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
