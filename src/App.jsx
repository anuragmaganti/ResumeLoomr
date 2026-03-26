import { useEffect, useRef, useState } from 'react';
import './App.css'
import './styles/buttons.css'
import './styles/forms.css'
import './styles/preview.css'
import Header from './components/header';
import ResumePreview from './components/resumePreview';
import EditorPanel from './components/editorPanel';
import { useResumeBuilder } from './hooks/useResumeBuilder.js';

const THEME_STORAGE_KEY = 'resumeloomr:theme';

function App() {
  const previewPanelRef = useRef(null);
  const [editorStageMaxHeight, setEditorStageMaxHeight] = useState(null);
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
    templateOptions,
    resumeList,
    activeResumeId,
    activeResumeName,
    canDeleteActiveResume,
    setActiveResume,
    createResume,
    duplicateActiveResume,
    renameActiveResume,
    deleteActiveResume,
  } = useResumeBuilder();

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

  return (
    <div className="app">
      <div className="appShell">
        <Header
          saveState={saveState}
          saveLabel={saveLabel}
          theme={theme}
          onToggleTheme={() => setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))}
          template={template}
          templateOptions={templateOptions}
          onTemplateChange={setTemplate}
          onPrint={printResume}
          resumeList={resumeList}
          activeResumeId={activeResumeId}
          activeResumeName={activeResumeName}
          canDeleteActiveResume={canDeleteActiveResume}
          onSetActiveResume={setActiveResume}
          onCreateResume={createResume}
          onDuplicateResume={duplicateActiveResume}
          onRenameResume={renameActiveResume}
          onDeleteResume={deleteActiveResume}
        />

        {notice && (
          <div className={`noticeBanner noticeBanner--${notice.tone}`} role="status">
            <span>{notice.message}</span>
            <button type="button" className="noticeDismiss" onClick={dismissNotice} aria-label="Dismiss message">
              Dismiss
            </button>
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
