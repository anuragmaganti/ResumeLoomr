import { useEffect, useRef, useState } from 'react';
import './App.css'
import './styles/buttons.css'
import './styles/forms.css'
import './styles/preview.css'
import Header from './components/header';
import ResumePreview from './components/resumePreview';
import EditorPanel from './components/editorPanel';
import { useResumeBuilder } from './hooks/useResumeBuilder.js';

function App() {
  const previewPanelRef = useRef(null);
  const [editorStageMaxHeight, setEditorStageMaxHeight] = useState(null);
  const {
    resume,
    template,
    setTemplate,
    activeTab,
    setActiveTab,
    mobileView,
    setMobileView,
    previewModel,
    errors,
    getFieldError,
    markTouched,
    actions,
    printResume,
    notice,
    dismissNotice,
    saveState,
    saveLabel,
    templateOptions,
  } = useResumeBuilder();

  const issueCount = Object.keys(errors).length;

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
          issueCount={issueCount}
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
              resume={resume}
              actions={actions}
              getFieldError={getFieldError}
              markTouched={markTouched}
              issueCount={issueCount}
              maxHeight={editorStageMaxHeight}
            />
          </div>

          <div className={`workspaceColumn workspaceColumnPreview ${mobileView === 'editor' ? 'isMobileHidden' : ''}`}>
            <ResumePreview
              previewModel={previewModel}
              template={template}
              templateOptions={templateOptions}
              onTemplateChange={setTemplate}
              onPrint={printResume}
              panelRef={previewPanelRef}
            />
          </div>
        </main>
      </div>
    </div>
  )
}

export default App
