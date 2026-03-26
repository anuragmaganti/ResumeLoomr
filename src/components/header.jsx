import { useMemo, useState } from "react";
import BrandMark from "./brandMark";
import EntryActionMenu from "./forms/entryActionMenu";

const MAX_VISIBLE_RESUMES = 5;

function getVisibleResumeIds(resumeList, activeResumeId) {
  const visibleIds = new Set(resumeList.slice(0, MAX_VISIBLE_RESUMES).map((resume) => resume.id));

  if (!visibleIds.has(activeResumeId) && activeResumeId && resumeList.length >= MAX_VISIBLE_RESUMES) {
    visibleIds.delete(resumeList[MAX_VISIBLE_RESUMES - 1]?.id);
    visibleIds.add(activeResumeId);
  }

  return visibleIds;
}

export default function Header({
  saveState,
  saveLabel,
  theme,
  onToggleTheme,
  template,
  templateOptions,
  onTemplateChange,
  onPrint,
  resumeList,
  activeResumeId,
  activeResumeName,
  canDeleteActiveResume,
  onSetActiveResume,
  onCreateResume,
  onDuplicateResume,
  onRenameResume,
  onDeleteResume,
}) {
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const visibleResumeIds = useMemo(
    () => getVisibleResumeIds(resumeList, activeResumeId),
    [activeResumeId, resumeList],
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
    setRenameValue(activeResumeName);
  }

  function cancelRename() {
    setRenamingId(null);
    setRenameValue('');
  }

  function commitRename() {
    const trimmedValue = renameValue.trim();

    if (trimmedValue) {
      onRenameResume(trimmedValue);
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

  return (
    <header className="topbar panel">
      <div className="brand">
        <div className="brandMark" aria-hidden="true">
          <BrandMark />
        </div>
        <div className="brandCopy">
          <h1>ResumeLoomr</h1>
          <p className="brandSubcopy">Write your resume, review it live, and print a polished result in one place.</p>
        </div>
      </div>

      <div className="resumeWorkspaceBar" aria-label="Resumes">
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
            onClick={() => {
              cancelRename();
              onCreateResume();
            }}
          >
            + New
          </button>
        </div>
      </div>

      <div className="topbarSide">
        <div className="topbarMeta">
          <span className={`statusBadge statusBadge--${saveState}`}>
            {saveLabel}
          </span>
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
          <label className="visuallyHidden" htmlFor="header-template-select">
            Template
          </label>
          <select
            id="header-template-select"
            className="toolbarSelect topbarTemplateSelect"
            value={template}
            onChange={(event) => onTemplateChange(event.target.value)}
            aria-label="Choose resume template"
          >
            {templateOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <button type="button" className="button buttonPrimary printButton" onClick={onPrint}>
            Print resume
          </button>
        </div>
      </div>
    </header>
  );
}
