import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { MAX_WORKSPACE_RESUME_NAME_LENGTH, sanitizeWorkspaceResumeName } from "../lib/resume.js";
import BrandMark from "./brandMark";
import EntryActionMenu from "./forms/entryActionMenu";

const DEFAULT_VISIBLE_RESUME_CAPACITY = 4;
const RESUME_ROW_GAP = 8;
const RESUME_ROW_PADDING = 4;
const FALLBACK_RESUME_PILL_WIDTH = 158;
const FALLBACK_MORE_BUTTON_WIDTH = 58;
const FALLBACK_NEW_BUTTON_WIDTH = 70;

function getVisibleResumeIds(resumeList, activeResumeId, visibleCapacity) {
  const boundedCapacity = Math.max(1, Math.min(visibleCapacity, resumeList.length));
  const visibleIds = new Set(resumeList.slice(0, boundedCapacity).map((resume) => resume.id));

  if (!visibleIds.has(activeResumeId) && activeResumeId && resumeList.length > boundedCapacity) {
    visibleIds.delete(resumeList[boundedCapacity - 1]?.id);
    visibleIds.add(activeResumeId);
  }

  return visibleIds;
}

function getMeasuredResumeWidths(measureElement) {
  const widths = new Map();

  measureElement
    ?.querySelectorAll('[data-resume-measure-id]')
    .forEach((element) => {
      widths.set(element.dataset.resumeMeasureId, element.getBoundingClientRect().width);
    });

  return widths;
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
  const resumeWorkspaceRef = useRef(null);
  const resumeMeasureRef = useRef(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [visibleResumeCapacity, setVisibleResumeCapacity] = useState(DEFAULT_VISIBLE_RESUME_CAPACITY);

  useLayoutEffect(() => {
    const workspaceElement = resumeWorkspaceRef.current;
    const measureElement = resumeMeasureRef.current;

    if (!workspaceElement || !measureElement || resumeList.length === 0) {
      return undefined;
    }

    let animationFrameId = null;

    function measureCapacity() {
      const availableWidth = workspaceElement.getBoundingClientRect().width;
      const measuredResumeWidths = getMeasuredResumeWidths(measureElement);
      const moreButtonWidth =
        measureElement.querySelector('[data-resume-measure-more]')?.getBoundingClientRect().width
        ?? FALLBACK_MORE_BUTTON_WIDTH;
      const newButtonWidth =
        measureElement.querySelector('[data-resume-measure-new]')?.getBoundingClientRect().width
        ?? FALLBACK_NEW_BUTTON_WIDTH;

      for (let capacity = resumeList.length; capacity >= 1; capacity -= 1) {
        const visibleIds = getVisibleResumeIds(resumeList, activeResumeId, capacity);
        const hasOverflow = visibleIds.size < resumeList.length;
        const visibleWidth = resumeList.reduce((total, resume) => {
          if (!visibleIds.has(resume.id)) {
            return total;
          }

          return total + (measuredResumeWidths.get(resume.id) ?? FALLBACK_RESUME_PILL_WIDTH);
        }, 0);
        const itemCount = visibleIds.size + 1 + (hasOverflow ? 1 : 0);
        const requiredWidth =
          visibleWidth
          + newButtonWidth
          + (hasOverflow ? moreButtonWidth : 0)
          + Math.max(0, itemCount - 1) * RESUME_ROW_GAP
          + RESUME_ROW_PADDING;

        if (requiredWidth <= availableWidth || capacity === 1) {
          setVisibleResumeCapacity((currentCapacity) => (
            currentCapacity === capacity ? currentCapacity : capacity
          ));
          return;
        }
      }
    }

    function scheduleMeasure() {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }

      animationFrameId = requestAnimationFrame(measureCapacity);
    }

    scheduleMeasure();

    const resizeObserver = new ResizeObserver(scheduleMeasure);
    resizeObserver.observe(workspaceElement);
    resizeObserver.observe(measureElement);
    window.addEventListener('resize', scheduleMeasure);

    return () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
      }

      resizeObserver.disconnect();
      window.removeEventListener('resize', scheduleMeasure);
    };
  }, [activeResumeId, resumeList]);

  const visibleResumeIds = useMemo(
    () => getVisibleResumeIds(resumeList, activeResumeId, visibleResumeCapacity),
    [activeResumeId, resumeList, visibleResumeCapacity],
  );
  const visibleResumes = useMemo(
    () => resumeList.filter((resume) => visibleResumeIds.has(resume.id)),
    [resumeList, visibleResumeIds],
  );
  const overflowResumes = useMemo(
    () => resumeList.filter((resume) => !visibleResumeIds.has(resume.id)),
    [resumeList, visibleResumeIds],
  );

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

  const resumeWorkspaceControls = (
    <section className="resumeSubbar panel" aria-label="Resume versions">
      <div className="resumeWorkspaceBar" ref={resumeWorkspaceRef} aria-label="Resumes">
        <div className="resumePillStrip">
          {visibleResumes.map((resume) => {
            const isActive = resume.id === activeResumeId;
            const isRenaming = resume.id === renamingId;

            return (
              <div
                key={resume.id}
                className={`resumePill${isActive ? ' isActive' : ''}${isRenaming ? ' isEditing' : ''}`}
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

          {overflowResumes.length > 0 ? (
            <EntryActionMenu
              menuLabel="More resumes"
              triggerContent="More"
              buttonClassName="resumeOverflowButton"
              extraItems={overflowResumes.map((resume) => ({
                key: resume.id,
                label: resume.name,
                onSelect: () => {
                  cancelRename();
                  onSetActiveResume(resume.id);
                },
              }))}
            />
          ) : null}

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

        <div className="resumeMeasureStrip" ref={resumeMeasureRef} aria-hidden="true">
          {resumeList.map((resume) => (
            <div
              key={resume.id}
              className={`resumePill${resume.id === activeResumeId ? ' isActive' : ''}`}
              data-resume-measure-id={resume.id}
            >
              <span className="resumePillButton">
                <span className="resumePillLabel">{resume.name}</span>
              </span>
              {resume.id === activeResumeId ? (
                <span className="button resumePillMenuButton">•••</span>
              ) : null}
            </div>
          ))}
          <span className="button entryMenuButton resumeOverflowButton" data-resume-measure-more>
            More
          </span>
          <span className="button buttonSecondary resumeNewButton" data-resume-measure-new>
            + New
          </span>
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
