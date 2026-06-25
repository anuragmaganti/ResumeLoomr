import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  closestCenter,
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { MAX_WORKSPACE_RESUME_NAME_LENGTH, sanitizeWorkspaceResumeName } from "../lib/resume.js";
import { ResumeLoomrKeyboardSensor, ResumeLoomrPointerSensor } from "../lib/sortableSensors.js";
import EntryActionMenu from "./forms/entryActionMenu";

function getResumeIds(resumeList) {
  return resumeList.map((resume) => resume.id);
}

function ResumePillContents({
  resume,
  isActive,
  isRenaming,
  renameValue,
  canAddResume,
  canDeleteActiveResume,
  onSetActiveResume,
  onStartRename,
  onRenameValueChange,
  onCommitRename,
  onCancelRename,
  onStartRenamingActiveResume,
  onDuplicateResume,
  onDeleteResume,
}) {
  if (isRenaming) {
    return (
      <form
        className="resumePillRenameForm"
        data-dnd-no-drag="true"
        onSubmit={(event) => {
          event.preventDefault();
          onCommitRename();
        }}
      >
        <input
          className="resumePillRenameInput"
          value={renameValue}
          onChange={(event) => onRenameValueChange(event.target.value)}
          onBlur={onCommitRename}
          maxLength={MAX_WORKSPACE_RESUME_NAME_LENGTH}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              onCancelRename();
            }
          }}
          aria-label="Rename active resume"
          autoFocus
        />
      </form>
    );
  }

  return (
    <>
      <button
        type="button"
        className="resumePillButton"
        onClick={() => onSetActiveResume(resume.id)}
        onDoubleClick={() => onStartRename(resume)}
        aria-pressed={isActive}
      >
        <span className="resumePillLabel">{resume.name}</span>
      </button>

      {isActive ? (
        <span className="resumePillMenuHost" data-dnd-no-drag="true">
          <EntryActionMenu
            menuLabel={`${resume.name} actions`}
            extraItems={[
              {
                label: 'Rename',
                onSelect: onStartRenamingActiveResume,
              },
              {
                label: 'Duplicate',
                onSelect: onDuplicateResume,
                disabled: !canAddResume,
              },
              {
                label: 'Delete',
                onSelect: onDeleteResume,
                tone: 'danger',
                disabled: !canDeleteActiveResume,
              },
            ]}
            buttonClassName="resumePillMenuButton"
          />
        </span>
      ) : null}
    </>
  );
}

function SortableResumePill({
  resume,
  isActive,
  isRenaming,
  children,
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: resume.id,
    disabled: isRenaming,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      className={[
        'resumePill',
        isActive ? 'isActive' : '',
        isRenaming ? 'isEditing' : '',
        isDragging ? 'isSortingPlaceholder' : '',
      ].filter(Boolean).join(' ')}
      style={style}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  );
}

function ResumePillOverlay({ resume, isActive, style }) {
  if (!resume) {
    return null;
  }

  return (
    <div className={`resumePill resumePillOverlay${isActive ? ' isActive' : ''}`} style={style}>
      <span className="resumePillButton">
        <span className="resumePillLabel">{resume.name}</span>
      </span>
      {isActive ? <span className="button resumePillMenuButton">•••</span> : null}
    </div>
  );
}

export default function Header({
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
  onReorderResumes,
  onDeleteResume,
  authUser,
  authReady,
  firebaseEnabled,
  onOpenAuth,
  onSignOut,
}) {
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [activeDragId, setActiveDragId] = useState(null);
  const [activeDragRect, setActiveDragRect] = useState(null);
  const resumeIds = useMemo(() => getResumeIds(resumeList), [resumeList]);
  const resumeById = useMemo(
    () => new Map(resumeList.map((resume) => [resume.id, resume])),
    [resumeList],
  );
  const activeDragResume = activeDragId ? resumeById.get(activeDragId) : null;
  const sensors = useSensors(
    useSensor(ResumeLoomrPointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(ResumeLoomrKeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
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

  function handleResumeDragStart(event) {
    if (!onReorderResumes) {
      return;
    }

    cancelRename();
    setActiveDragId(String(event.active.id));
    const rect = event.active.rect.current.initial;
    setActiveDragRect(rect ? { width: rect.width, height: rect.height } : null);
  }

  function resetResumeDragState() {
    setActiveDragId(null);
    setActiveDragRect(null);
  }

  function handleResumeDragEnd(event) {
    const activeId = String(event.active.id);
    const overId = event.over?.id ? String(event.over.id) : '';

    setActiveDragId(null);
    setActiveDragRect(null);

    if (!overId || activeId === overId || !onReorderResumes) {
      return;
    }

    const oldIndex = resumeIds.indexOf(activeId);
    const newIndex = resumeIds.indexOf(overId);

    if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
      const nextResumeIds = arrayMove(resumeIds, oldIndex, newIndex);
      onReorderResumes(nextResumeIds);
    }
  }

  const resumeDragOverlay = (
    <DragOverlay adjustScale={false} zIndex={1000}>
      <ResumePillOverlay
        resume={activeDragResume}
        isActive={activeDragId === activeResumeId}
        style={activeDragRect ? {
          width: `${activeDragRect.width}px`,
          height: `${activeDragRect.height}px`,
        } : undefined}
      />
    </DragOverlay>
  );

  const resumeWorkspaceControls = (
    <section className="resumeSubbar panel" aria-label="Resume versions">
      <div className="resumeWorkspaceBar" aria-label="Resumes">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleResumeDragStart}
          onDragEnd={handleResumeDragEnd}
          onDragCancel={resetResumeDragState}
        >
          <SortableContext items={resumeIds} strategy={rectSortingStrategy}>
            <div className="resumePillStrip">
              {resumeList.map((resume) => {
                const isActive = resume.id === activeResumeId;
                const isRenaming = resume.id === renamingId;

                return (
                  <SortableResumePill
                    key={resume.id}
                    resume={resume}
                    isActive={isActive}
                    isRenaming={isRenaming}
                  >
                    <ResumePillContents
                      resume={resume}
                      isActive={isActive}
                      isRenaming={isRenaming}
                      renameValue={renameValue}
                      canAddResume={canAddResume}
                      canDeleteActiveResume={canDeleteActiveResume}
                      onSetActiveResume={(resumeId) => {
                        cancelRename();
                        onSetActiveResume(resumeId);
                      }}
                      onStartRename={startRenamingResume}
                      onRenameValueChange={setRenameValue}
                      onCommitRename={commitRename}
                      onCancelRename={cancelRename}
                      onStartRenamingActiveResume={startRenamingActiveResume}
                      onDuplicateResume={onDuplicateResume}
                      onDeleteResume={handleDeleteResume}
                    />
                  </SortableResumePill>
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
          </SortableContext>

          {typeof document === 'undefined' ? resumeDragOverlay : createPortal(resumeDragOverlay, document.body)}
        </DndContext>
      </div>
    </section>
  );

  return (
    <div className="headerStack">
      <header className="topbar panel">
        <div className="brand">
          <span className="visuallyHidden">ResumeLoomr</span>
          <img
            className="brandLogo brandLogo--light"
            src="/loomr-logo-light.png"
            alt=""
            aria-hidden="true"
          />
          <img
            className="brandLogo brandLogo--dark"
            src="/loomr-logo-dark.png"
            alt=""
            aria-hidden="true"
          />
        </div>

        <div className="topbarSide">
          <div className="topbarMeta">
            <button
              type="button"
              className="button buttonPrimary importResumeButton"
              onClick={onImportResume}
              disabled={isImportingResume}
            >
              {isImportingResume ? (
                <span className="buttonSpinner" aria-hidden="true" />
              ) : null}
              {isImportingResume ? 'Processing...' : 'Import your resume'}
            </button>
            <button type="button" className="button buttonSecondary printButton" onClick={onPrint}>
              Print/Save
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
