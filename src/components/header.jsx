import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
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

const RESUME_SELECTION_LONG_PRESS_MS = 520;
const RESUME_SELECTION_LONG_PRESS_MOVE_TOLERANCE_PX = 5;

function ResumeSelectionControl({ resume, isSelected, onToggle, interactive = true }) {
  return (
    <span
      className="resumePillSelectionSlot"
      data-dnd-no-drag="true"
      onPointerDown={interactive ? (event) => event.stopPropagation() : undefined}
      onClick={interactive ? (event) => event.stopPropagation() : undefined}
    >
      {interactive ? (
        <label
          className="resumePillSelectionControl"
          title={`${isSelected ? 'Deselect' : 'Select'} ${resume.name}`}
        >
          <input
            className="resumePillSelectionInput"
            type="checkbox"
            checked={isSelected}
            onChange={() => onToggle(resume.id)}
            aria-label={`${isSelected ? 'Deselect' : 'Select'} ${resume.name}`}
          />
          <span className="resumePillSelectionMark" aria-hidden="true">
            <svg viewBox="0 0 16 16" focusable="false">
              <path d="m3.5 8.2 2.7 2.7 6.3-6.3" />
            </svg>
          </span>
        </label>
      ) : (
        <span className="resumePillSelectionControl" aria-hidden="true">
          <span className="resumePillSelectionMark isChecked">
            <svg viewBox="0 0 16 16" focusable="false">
              <path d="m3.5 8.2 2.7 2.7 6.3-6.3" />
            </svg>
          </span>
        </span>
      )}
    </span>
  );
}

function ResumeMenuIcon() {
  return (
    <svg className="resumePillMenuIcon" aria-hidden="true" viewBox="0 0 18 18" focusable="false">
      <circle cx="4" cy="9" r="1.25" />
      <circle cx="9" cy="9" r="1.25" />
      <circle cx="14" cy="9" r="1.25" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg className="resumeSelectionDeleteIcon" aria-hidden="true" viewBox="0 0 18 18" focusable="false">
      <path d="M3.75 5.25h10.5M7 5.25V3.5h4v1.75M5.25 5.25l.6 9.25h6.3l.6-9.25M7.4 7.5v4.75M10.6 7.5v4.75" />
    </svg>
  );
}

function ResumeBatchDeleteDialog({ count, isDeleting, isSignedIn, onCancel, onConfirm }) {
  const dialogRef = useRef(null);
  const cancelButtonRef = useRef(null);
  const label = `${count} ${count === 1 ? 'resume' : 'resumes'}`;

  const handleDialogKeyDown = useEffectEvent((event) => {
    if (event.key === 'Escape') {
      event.preventDefault();

      if (!isDeleting) {
        onCancel();
      }

      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const focusable = [...dialogRef.current?.querySelectorAll('button:not(:disabled)') || []];

    if (focusable.length === 0) {
      return;
    }

    const first = focusable[0];
    const last = focusable.at(-1);

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  useEffect(() => {
    cancelButtonRef.current?.focus();

    function handleKeyDown(event) {
      handleDialogKeyDown(event);
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return createPortal(
    <div
      className="resumeDeleteDialogBackdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isDeleting) {
          onCancel();
        }
      }}
    >
      <section
        ref={dialogRef}
        className="resumeDeleteDialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="resume-delete-dialog-title"
        aria-describedby="resume-delete-dialog-description"
      >
        <span className="resumeDeleteDialogIcon" aria-hidden="true"><DeleteIcon /></span>
        <div className="resumeDeleteDialogCopy">
          <h2 id="resume-delete-dialog-title">Delete {label}?</h2>
          <p id="resume-delete-dialog-description">
            {count === 1 ? 'This resume' : 'These resumes'} will be removed from this browser
            {isSignedIn ? ' and your synced account.' : '.'}
          </p>
        </div>
        <div className="resumeDeleteDialogActions">
          <button
            ref={cancelButtonRef}
            type="button"
            className="button buttonSecondary"
            onClick={() => onCancel()}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="button buttonDanger resumeDeleteDialogConfirm"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting…' : `Delete ${count}`}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function PrintIcon() {
  return (
    <svg className="topbarActionIcon" aria-hidden="true" viewBox="0 0 20 20" focusable="false">
      <path d="M6 7V3.75h8V7M6 14H4.75A1.75 1.75 0 0 1 3 12.25v-3.5A1.75 1.75 0 0 1 4.75 7h10.5A1.75 1.75 0 0 1 17 8.75v3.5A1.75 1.75 0 0 1 15.25 14H14" />
      <path d="M6 11.5h8v4.75H6z" />
      <path d="M14.75 9.5h.01" />
    </svg>
  );
}

function AccountIcon({ signedIn }) {
  return (
    <svg className="topbarActionIcon" aria-hidden="true" viewBox="0 0 20 20" focusable="false">
      {signedIn ? (
        <>
          <path d="M8.5 4.25h-3A1.75 1.75 0 0 0 3.75 6v8a1.75 1.75 0 0 0 1.75 1.75h3" />
          <path d="M11.75 6.5 15.25 10l-3.5 3.5M7.5 10h7.25" />
        </>
      ) : (
        <>
          <circle cx="10" cy="7" r="3" />
          <path d="M4.75 16c.65-2.55 2.4-3.75 5.25-3.75s4.6 1.2 5.25 3.75" />
        </>
      )}
    </svg>
  );
}

function ResumeMenuPlaceholder() {
  return (
    <span className="button resumePillMenuButton resumePillMenuPlaceholder" aria-hidden="true">
      <ResumeMenuIcon />
    </span>
  );
}

function ResumePillContents({
  resume,
  isActive,
  isRenaming,
  isSelected,
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
  onToggleSelected,
}) {
  if (isRenaming) {
    return (
      <>
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
        <span className="resumePillActions">
          <ResumeSelectionControl
            resume={resume}
            isSelected={isSelected}
            onToggle={onToggleSelected}
          />
          <span className="resumePillMenuHost" data-dnd-no-drag="true" aria-hidden="true">
            <ResumeMenuPlaceholder />
          </span>
        </span>
      </>
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

      <span className="resumePillActions">
        <ResumeSelectionControl
          resume={resume}
          isSelected={isSelected}
          onToggle={onToggleSelected}
        />

        <span
          className="resumePillMenuHost"
          data-dnd-no-drag="true"
          aria-hidden={!isActive}
        >
          {isActive ? (
            <EntryActionMenu
              menuLabel={`${resume.name} actions`}
              triggerContent={<ResumeMenuIcon />}
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
          ) : (
            <ResumeMenuPlaceholder />
          )}
        </span>
      </span>
    </>
  );
}

function SortableResumePill({
  resume,
  isActive,
  isRenaming,
  isSelected,
  onToggleSelected,
  children,
}) {
  const longPressTimerRef = useRef(null);
  const longPressOriginRef = useRef(null);
  const suppressNextClickRef = useRef(false);
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

  function clearLongPress() {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    longPressOriginRef.current = null;
  }

  function handlePointerDown(event) {
    listeners?.onPointerDown?.(event);

    if (
      event.pointerType !== 'touch' ||
      event.button !== 0 ||
      event.target.closest('.resumePillActions, .resumePillRenameForm')
    ) {
      return;
    }

    clearLongPress();
    longPressOriginRef.current = { x: event.clientX, y: event.clientY };
    longPressTimerRef.current = window.setTimeout(() => {
      suppressNextClickRef.current = true;
      longPressTimerRef.current = null;
      longPressOriginRef.current = null;
      onToggleSelected(resume.id);
    }, RESUME_SELECTION_LONG_PRESS_MS);
  }

  function handlePointerMove(event) {
    const origin = longPressOriginRef.current;

    if (!origin) {
      return;
    }

    if (
      Math.abs(event.clientX - origin.x) > RESUME_SELECTION_LONG_PRESS_MOVE_TOLERANCE_PX ||
      Math.abs(event.clientY - origin.y) > RESUME_SELECTION_LONG_PRESS_MOVE_TOLERANCE_PX
    ) {
      clearLongPress();
    }
  }

  useEffect(() => () => clearLongPress(), []);

  useEffect(() => {
    if (isDragging) {
      clearLongPress();
    }
  }, [isDragging]);

  return (
    <div
      ref={setNodeRef}
      className={[
        'resumePill',
        isActive ? 'isActive' : '',
        isSelected ? 'isSelected' : '',
        isRenaming ? 'isEditing' : '',
        isDragging ? 'isSortingPlaceholder' : '',
      ].filter(Boolean).join(' ')}
      style={style}
      {...attributes}
      {...listeners}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={clearLongPress}
      onPointerCancel={clearLongPress}
      onPointerLeave={clearLongPress}
      onClickCapture={(event) => {
        if (suppressNextClickRef.current) {
          suppressNextClickRef.current = false;
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      {children}
    </div>
  );
}

function ResumePillOverlay({ resume, isActive, isSelected, style }) {
  if (!resume) {
    return null;
  }

  return (
    <div
      className={[
        'resumePill',
        'resumePillOverlay',
        isActive ? 'isActive' : '',
        isSelected ? 'isSelected' : '',
      ].filter(Boolean).join(' ')}
      style={style}
    >
      <span className="resumePillButton">
        <span className="resumePillLabel">{resume.name}</span>
      </span>
      <span className="resumePillActions">
        {isSelected ? (
          <ResumeSelectionControl resume={resume} isSelected interactive={false} />
        ) : (
          <span className="resumePillSelectionSlot" />
        )}
        {isActive ? (
          <span className="resumePillMenuHost">
            <ResumeMenuPlaceholder />
          </span>
        ) : null}
      </span>
    </div>
  );
}

export default function Header({
  onPrint,
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
  const [deleteDialogRequest, setDeleteDialogRequest] = useState(null);
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);
  const deleteDialogTriggerRef = useRef(null);
  const selectionAccountKey = authUser?.uid || 'signed-out';
  const [selectionState, setSelectionState] = useState(() => ({
    accountKey: selectionAccountKey,
    ids: new Set(),
  }));
  const resumeIds = useMemo(() => resumeList.map((resume) => resume.id), [resumeList]);
  const resumeById = useMemo(
    () => new Map(resumeList.map((resume) => [resume.id, resume])),
    [resumeList],
  );
  const selectedResumeIds = useMemo(() => {
    if (selectionState.accountKey !== selectionAccountKey) {
      return new Set();
    }

    return new Set([...selectionState.ids].filter((resumeId) => resumeById.has(resumeId)));
  }, [resumeById, selectionAccountKey, selectionState]);
  const activeDragResume = activeDragId ? resumeById.get(activeDragId) : null;
  const selectedResumeCount = selectedResumeIds.size;
  const hasSelectedResumes = selectedResumeCount > 0;
  const wouldDeleteEveryResume = hasSelectedResumes && selectedResumeCount >= resumeList.length;
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

  function toggleResumeSelection(resumeId) {
    if (!resumeById.has(resumeId)) {
      return;
    }

    setSelectionState((currentState) => {
      const nextIds = currentState.accountKey === selectionAccountKey
        ? new Set([...currentState.ids].filter((selectedId) => resumeById.has(selectedId)))
        : new Set();

      if (nextIds.has(resumeId)) {
        nextIds.delete(resumeId);
      } else {
        nextIds.add(resumeId);
      }

      return { accountKey: selectionAccountKey, ids: nextIds };
    });
  }

  function clearResumeSelection() {
    setSelectionState({ accountKey: selectionAccountKey, ids: new Set() });
  }

  function openDeleteDialog(resumeIdsToDelete, source) {
    const validResumeIds = [...new Set(resumeIdsToDelete)].filter((resumeId) => resumeById.has(resumeId));

    if (validResumeIds.length === 0 || validResumeIds.length >= resumeList.length) {
      return;
    }

    deleteDialogTriggerRef.current = document.activeElement;
    setDeleteDialogRequest({ ids: validResumeIds, source, accountKey: selectionAccountKey });
  }

  function closeDeleteDialog({ restoreFocus = true, preferActiveResume = false } = {}) {
    setDeleteDialogRequest(null);
    setIsDeletingSelected(false);

    if (restoreFocus) {
      window.requestAnimationFrame(() => {
        const previousTrigger = deleteDialogTriggerRef.current;
        const fallbackTrigger = document.querySelector('.resumePill.isActive .resumePillMenuButton');
        const activeResumeTrigger = document.querySelector('.resumePill.isActive .resumePillButton:not(:disabled)');
        const previousTriggerIsUsable = previousTrigger?.isConnected && !previousTrigger.disabled;
        const focusTarget = preferActiveResume
          ? (activeResumeTrigger || fallbackTrigger)
          : (previousTriggerIsUsable ? previousTrigger : fallbackTrigger || activeResumeTrigger);

        focusTarget?.focus();
      });
    }
  }

  async function confirmSelectedResumeDeletion() {
    if (isDeletingSelected || !deleteDialogRequest?.ids?.length) {
      return;
    }

    if (deleteDialogRequest.accountKey !== selectionAccountKey) {
      closeDeleteDialog({ restoreFocus: false });
      return;
    }

    const accountKeyAtStart = selectionAccountKey;
    const { ids: resumeIdsToDelete, source } = deleteDialogRequest;
    let deleted = false;
    setIsDeletingSelected(true);

    try {
      deleted = await onDeleteResume(resumeIdsToDelete);

      if (deleted && source === 'selection' && accountKeyAtStart === selectionAccountKey) {
        clearResumeSelection();
      }
    } finally {
      closeDeleteDialog({ preferActiveResume: deleted });
    }
  }

  useEffect(() => {
    if (deleteDialogRequest && (
      deleteDialogRequest.accountKey !== selectionAccountKey ||
      (!hasSelectedResumes && deleteDialogRequest.source === 'selection')
    )) {
      setDeleteDialogRequest(null);
      setIsDeletingSelected(false);
    }
  }, [deleteDialogRequest, hasSelectedResumes, selectionAccountKey]);

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

    openDeleteDialog([activeResumeId], 'active');
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
        isSelected={Boolean(activeDragId && selectedResumeIds.has(activeDragId))}
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
                const isSelected = selectedResumeIds.has(resume.id);

                return (
                  <SortableResumePill
                    key={resume.id}
                    resume={resume}
                    isActive={isActive}
                    isRenaming={isRenaming}
                    isSelected={isSelected}
                    onToggleSelected={toggleResumeSelection}
                  >
                    <ResumePillContents
                      resume={resume}
                      isActive={isActive}
                      isRenaming={isRenaming}
                      isSelected={isSelected}
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
                      onToggleSelected={toggleResumeSelection}
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
                <span className="resumeNewButtonIcon" aria-hidden="true" />
                <span>New</span>
              </button>
            </div>
          </SortableContext>

          {typeof document === 'undefined' ? resumeDragOverlay : createPortal(resumeDragOverlay, document.body)}
        </DndContext>
      </div>

      <div
        className={`resumeSelectionFooter${hasSelectedResumes ? ' isVisible' : ''}`}
        aria-hidden={!hasSelectedResumes}
      >
        <div className="resumeSelectionFooterClip">
          <div className="resumeSelectionToolbar">
            <span className="resumeSelectionCount">
              <span className="resumeSelectionCountDot" aria-hidden="true" />
              {selectedResumeCount} selected
            </span>
            <div className="resumeSelectionActions">
              <button
                type="button"
                className="button buttonDanger resumeSelectionDelete"
                onClick={() => openDeleteDialog([...selectedResumeIds], 'selection')}
                disabled={!hasSelectedResumes || wouldDeleteEveryResume}
                tabIndex={hasSelectedResumes ? 0 : -1}
                title={wouldDeleteEveryResume ? 'Keep at least one resume. Deselect one to continue.' : 'Delete selected resumes'}
                aria-describedby={wouldDeleteEveryResume ? 'resume-selection-delete-limit' : undefined}
              >
                <DeleteIcon />
                Delete
              </button>
              <button
                type="button"
                className="button buttonSecondary resumeSelectionClear"
                onClick={clearResumeSelection}
                disabled={!hasSelectedResumes}
                tabIndex={hasSelectedResumes ? 0 : -1}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>
      <span id="resume-selection-delete-limit" className="visuallyHidden">
        Batch deletion is unavailable because a workspace must keep at least one resume.
      </span>
      <span className="visuallyHidden" aria-live="polite" aria-atomic="true">
        {hasSelectedResumes
          ? `${selectedResumeCount} ${selectedResumeCount === 1 ? 'resume' : 'resumes'} selected`
          : 'Resume selection cleared'}
      </span>
      {deleteDialogRequest && typeof document !== 'undefined' ? (
        <ResumeBatchDeleteDialog
          count={deleteDialogRequest.ids.length}
          isDeleting={isDeletingSelected}
          isSignedIn={Boolean(authUser)}
          onCancel={closeDeleteDialog}
          onConfirm={confirmSelectedResumeDeletion}
        />
      ) : null}
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
            <button type="button" className="button buttonSecondary printButton" onClick={onPrint}>
              <PrintIcon />
              Print/Save
            </button>
            {authUser ? (
              <button type="button" className="button buttonSecondary accountButton" onClick={onSignOut}>
                <AccountIcon signedIn />
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
                <AccountIcon signedIn={false} />
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
