import { useEffect, useState } from "react";
import { MAX_WORKSPACE_RESUME_NAME_LENGTH, sanitizeWorkspaceResumeName } from "../lib/resume.js";
import BrandMark from "./brandMark";
import EntryActionMenu from "./forms/entryActionMenu";

const RESUME_DRAG_MIME_TYPE = "application/x-resumeloomr-resume";
let transparentDragImageElement = null;

function getTransparentDragImage() {
  if (typeof document === "undefined") {
    return null;
  }

  if (transparentDragImageElement?.isConnected) {
    return transparentDragImageElement;
  }

  const element = document.createElement("div");
  element.setAttribute("aria-hidden", "true");
  element.style.position = "fixed";
  element.style.top = "0";
  element.style.left = "0";
  element.style.width = "1px";
  element.style.height = "1px";
  element.style.opacity = "0";
  element.style.pointerEvents = "none";
  element.style.zIndex = "-1";

  document.body.appendChild(element);
  transparentDragImageElement = element;
  return transparentDragImageElement;
}

export default function Header({
  saveState,
  saveLabel,
  theme,
  onToggleTheme,
  onPrint,
  onImportResume,
  isImportingResume,
  resumeList,
  activeResumeId,
  activeResumeName,
  canAddResume,
  canDeleteActiveResume,
  onSetActiveResume,
  onCreateResume,
  onDuplicateResume,
  onRenameResume,
  onReorderResume,
  onDeleteResume,
  authUser,
  authReady,
  firebaseEnabled,
  trustedDevice,
  isCloudMode,
  syncState,
  onOpenAuth,
  onSignOut,
}) {
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [draggedResumeId, setDraggedResumeId] = useState(null);

  useEffect(() => {
    getTransparentDragImage();
  }, []);

  function startRenamingActiveResume() {
    setRenamingId(activeResumeId);
    setRenameValue(sanitizeWorkspaceResumeName(activeResumeName));
  }

  function startRenamingResume(resume) {
    if (!resume?.id) {
      return;
    }

    cancelRename();
    onSetActiveResume(resume.id);
    setRenamingId(resume.id);
    setRenameValue(sanitizeWorkspaceResumeName(resume.name));
  }

  function cancelRename() {
    setRenamingId(null);
    setRenameValue('');
  }

  function commitRename() {
    const trimmedValue = renameValue.trim();

    if (trimmedValue && renamingId) {
      onRenameResume(renamingId, trimmedValue);
    }

    cancelRename();
  }

  function handleDeleteResume() {
    if (!canDeleteActiveResume) {
      return;
    }

    if (window.confirm(`Delete "${activeResumeName}"?`)) {
      onDeleteResume();
    }
  }

  function clearDragState() {
    setDraggedResumeId(null);
  }

  function shouldIgnoreDragStart(event) {
    const target = event.target instanceof Element ? event.target : event.target?.parentElement;

    return Boolean(
      target?.closest('.entryMenu, .resumePillRenameForm, .resumePillRenameInput')
    );
  }

  function handleDragStart(event, resumeId) {
    if (!onReorderResume || renamingId || shouldIgnoreDragStart(event)) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(RESUME_DRAG_MIME_TYPE, resumeId);
    event.dataTransfer.setData('text/plain', resumeId);
    const dragImage = getTransparentDragImage();

    if (dragImage) {
      event.dataTransfer.setDragImage(dragImage, 0, 0);
    }

    setDraggedResumeId(resumeId);
  }

  function getResumeDropPlacement(event) {
    const { left, top, width, height } = event.currentTarget.getBoundingClientRect();
    const pointerX = event.clientX - left;
    const pointerY = event.clientY - top;

    if (pointerY > height * 0.62) {
      return 'after';
    }

    if (pointerY < height * 0.38) {
      return 'before';
    }

    return pointerX > width * 0.5 ? 'after' : 'before';
  }

  function handleDragOver(event, targetResumeId) {
    if (!draggedResumeId || draggedResumeId === targetResumeId || !onReorderResume) {
      return;
    }

    const draggedIndex = resumeList.findIndex((resume) => resume.id === draggedResumeId);
    const targetIndex = resumeList.findIndex((resume) => resume.id === targetResumeId);

    if (draggedIndex < 0 || targetIndex < 0) {
      return;
    }

    const placement = getResumeDropPlacement(event);

    if (draggedIndex < targetIndex && placement !== 'after') {
      return;
    }

    if (draggedIndex > targetIndex && placement !== 'before') {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    onReorderResume(draggedResumeId, targetResumeId, placement);
  }

  function handleDrop(event) {
    if (draggedResumeId) {
      event.preventDefault();
    }

    clearDragState();
  }

  const resumeWorkspaceControls = (
    <section className="resumeSubbar panel" aria-label="Resume versions">
      <div className="resumeWorkspaceBar" aria-label="Resumes">
        <div className="resumePillStrip">
          {resumeList.map((resume) => {
            const isActive = resume.id === activeResumeId;
            const isRenaming = resume.id === renamingId;

            return (
              <div
                key={resume.id}
                className={[
                  'resumePill',
                  isActive ? 'isActive' : '',
                  isRenaming ? 'isEditing' : '',
                  draggedResumeId === resume.id ? 'isDragging' : '',
                ].filter(Boolean).join(' ')}
                draggable={!isRenaming && Boolean(onReorderResume)}
                onDragStart={(event) => handleDragStart(event, resume.id)}
                onDragOver={(event) => handleDragOver(event, resume.id)}
                onDrop={handleDrop}
                onDragEnd={clearDragState}
              >
                {isRenaming ? (
                  <form
                    className="resumePillRenameForm"
                    onSubmit={(event) => {
                      event.preventDefault();
                      commitRename();
                    }}
                  >
                    <input
                      className="resumePillRenameInput"
                      value={renameValue}
                      onChange={(event) => setRenameValue(event.target.value)}
                      onBlur={commitRename}
                      maxLength={MAX_WORKSPACE_RESUME_NAME_LENGTH}
                      onKeyDown={(event) => {
                        if (event.key === 'Escape') {
                          event.preventDefault();
                          cancelRename();
                        }
                      }}
                      aria-label="Rename active resume"
                      autoFocus
                    />
                  </form>
                ) : (
                  <>
                    <button
                      type="button"
                      className="resumePillButton"
                      onClick={() => {
                        cancelRename();
                        onSetActiveResume(resume.id);
                      }}
                      onDoubleClick={() => {
                        startRenamingResume(resume);
                      }}
                      aria-pressed={isActive}
                    >
                      <span className="resumePillLabel">{resume.name}</span>
                    </button>

                    {isActive ? (
                      <EntryActionMenu
                        menuLabel={`${resume.name} actions`}
                        extraItems={[
                          {
                            label: 'Rename',
                            onSelect: startRenamingActiveResume,
                          },
                          {
                            label: 'Duplicate',
                            onSelect: onDuplicateResume,
                            disabled: !canAddResume,
                          },
                          {
                            label: 'Delete',
                            onSelect: handleDeleteResume,
                            tone: 'danger',
                            disabled: !canDeleteActiveResume,
                          },
                        ]}
                        buttonClassName="resumePillMenuButton"
                      />
                    ) : null}
                  </>
                )}
              </div>
            );
          })}

          <button
            type="button"
            className="button buttonSecondary resumeNewButton"
            disabled={!canAddResume}
            onClick={() => {
              cancelRename();
              onCreateResume();
            }}
          >
            + New
          </button>
        </div>
      </div>
    </section>
  );

  return (
    <div className="headerStack">
      <header className="topbar panel">
        <div className="brand">
          <div className="brandMark" aria-hidden="true">
            <BrandMark />
          </div>
          <div className="brandCopy">
            <h1>ResumeLoomr</h1>
            <p className="brandSubcopy">The only resume tool you'll need for the rest of your career.</p>
          </div>
        </div>

        <div className="topbarSide">
          <div className="topbarMeta">
            <span className={`statusBadge statusBadge--${saveState}`}>
              {saveLabel}
            </span>
            {isCloudMode ? (
              <span className={`statusBadge statusBadge--${syncState === 'error' ? 'error' : 'info'}`}>
                {trustedDevice ? 'Trusted device' : 'Cloud'}
              </span>
            ) : null}
            <button
              type="button"
              className="button buttonSecondary themeToggle"
              onClick={onToggleTheme}
              aria-pressed={theme === 'dark'}
              aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              <span className={`themeToggleKnob themeToggleKnob--${theme}`} aria-hidden="true" />
              <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>
            <button
              type="button"
              className="button buttonSecondary importResumeButton"
              onClick={onImportResume}
              disabled={isImportingResume}
            >
              {isImportingResume ? (
                <span className="buttonSpinner" aria-hidden="true" />
              ) : null}
              {isImportingResume ? 'Processing...' : 'Import Existing Resume'}
            </button>
            <button type="button" className="button buttonPrimary printButton" onClick={onPrint}>
              Print resume
            </button>
            {authUser ? (
              <button type="button" className="button buttonSecondary accountButton" onClick={onSignOut}>
                Sign out
              </button>
            ) : (
              <button
                type="button"
                className="button buttonSecondary accountButton"
                onClick={onOpenAuth}
                disabled={!authReady || !firebaseEnabled}
                title={firebaseEnabled ? 'Sign in to sync resumes' : 'Firebase is not configured yet'}
              >
                Sign in
              </button>
            )}
          </div>
        </div>
      </header>

      {resumeWorkspaceControls}
    </div>
  );
}
