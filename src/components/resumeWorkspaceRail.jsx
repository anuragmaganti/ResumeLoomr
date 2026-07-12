import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  closestCenter,
  DndContext,
  DragOverlay,
  pointerWithin,
  useDndContext,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AnimatePresence, LayoutGroup, motion as Motion, useReducedMotion } from 'motion/react';
import {
  MAX_WORKSPACE_FOLDERS,
  MAX_WORKSPACE_FOLDER_NAME_LENGTH,
  MAX_WORKSPACE_RESUME_NAME_LENGTH,
  WORKSPACE_FOLDER_TONE_COUNT,
  WORKSPACE_OPEN_FOLDERS_STORAGE_KEY,
  createNextWorkspaceFolderName,
  sanitizeWorkspaceFolderName,
  sanitizeWorkspaceResumeName,
} from '../lib/resume.js';
import { ResumeLoomrKeyboardSensor, ResumeLoomrPointerSensor } from '../lib/sortableSensors.js';
import {
  buildResumeRailLayout,
  createWorkspaceItemId,
  getFolderPlacementCellRect,
  getFolderResumeInsertionIndex,
  getFolderResumeDropIntent,
  getOrganizationResumePlacement,
  getOrganizationVisualResumeIds,
  moveOrganizationResumeBundle,
  moveOrganizationRootItem,
  moveOrganizationRootItemToIndex,
  parseWorkspaceItemId,
  isPointerWithinFolderPlacementSurface,
  workspaceOrganizationsEqual,
} from '../lib/workspaceOrganization.js';
import EntryActionMenu from './forms/entryActionMenu';

const FOLDER_AUTO_OPEN_DELAY_MS = 320;
const FOLDER_AUTO_CLOSE_DELAY_MS = 140;
const FOLDER_MOTION_DURATION_SECONDS = 0.18;
const FOLDER_MAX_STAGGER_SPAN_SECONDS = 0.1;
const RAIL_LAYOUT_DURATION_SECONDS = 0.28;
const RAIL_ROW_HEIGHT_PX = 38;
const RAIL_ROW_GAP_PX = 7;
const RAIL_PADDING_BLOCK_PX = 8;
const ROOT_RELEASE_CONTAINER_ID = 'root-release';
const MOTION_EASE = [0.22, 1, 0.36, 1];
const FOLDER_MOTION_TRANSITION = { duration: FOLDER_MOTION_DURATION_SECONDS, ease: MOTION_EASE };
const RAIL_LAYOUT_TRANSITION = { duration: RAIL_LAYOUT_DURATION_SECONDS, ease: MOTION_EASE };
const RAIL_DRAG_LAYOUT_TRANSITION = {
  type: 'spring',
  stiffness: 700,
  damping: 52,
  mass: 0.45,
};
const railSortingStrategy = () => null;
const disableSortableLayoutAnimation = () => false;

function getFolderItemStaggerSeconds(itemCount) {
  return itemCount > 1
    ? Math.min(0.045, FOLDER_MAX_STAGGER_SPAN_SECONDS / (itemCount - 1))
    : 0;
}

function getFolderCloseDurationMs(itemCount, surfaceRowCount = 1) {
  const itemDuration = (
    getFolderItemStaggerSeconds(itemCount) * Math.max(0, itemCount - 1)
  ) + FOLDER_MOTION_DURATION_SECONDS;
  const surfaceDuration = (
    getFolderItemStaggerSeconds(surfaceRowCount) * Math.max(0, surfaceRowCount - 1)
  ) + FOLDER_MOTION_DURATION_SECONDS;
  return Math.ceil(Math.max(itemDuration, surfaceDuration) * 1000);
}

function getFolderItemOrigin(tile, cell) {
  const columnDelta = tile.column - cell.column;
  const rowDelta = tile.row - cell.row;
  const percentDelta = columnDelta * 100;
  const pixelDelta = columnDelta * 7;
  const x = pixelDelta === 0
    ? `${percentDelta}%`
    : `calc(${percentDelta}% ${pixelDelta > 0 ? '+' : '-'} ${Math.abs(pixelDelta)}px)`;

  return { x, y: rowDelta * 45 };
}

function getFolderToneClass(toneIndex = 0) {
  const normalizedIndex = Math.abs(Number(toneIndex) || 0) % WORKSPACE_FOLDER_TONE_COUNT;
  return `resumeFolderTone${normalizedIndex}`;
}

function setRootInsertTargetIfChanged(setTarget, folderId = '', position = '') {
  setTarget((current) => (
    current.folderId === folderId && current.position === position
      ? current
      : { folderId, position }
  ));
}

function pointIsWithinRect(point, rect) {
  return Boolean(
    point
    && rect
    && point.x >= rect.left
    && point.x <= rect.right
    && point.y >= rect.top
    && point.y <= rect.bottom
  );
}

function loadOpenFolderIds() {
  if (typeof window === 'undefined') {
    return new Set();
  }

  try {
    const value = JSON.parse(window.localStorage.getItem(WORKSPACE_OPEN_FOLDERS_STORAGE_KEY) || '[]');
    return new Set(Array.isArray(value) ? value.filter((id) => typeof id === 'string').slice(-100) : []);
  } catch {
    return new Set();
  }
}

function SelectionControl({ item, isSelected, onToggle }) {
  return (
    <span
      className="resumePillSelectionSlot"
      data-dnd-no-drag="true"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <label className="resumePillSelectionControl" title={`${isSelected ? 'Deselect' : 'Select'} ${item.name}`}>
        <input
          className="resumePillSelectionInput"
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggle(item.type, item.id)}
          aria-label={`${isSelected ? 'Deselect' : 'Select'} ${item.name}`}
        />
        <span className="resumePillSelectionMark" aria-hidden="true">
          <svg viewBox="0 0 16 16" focusable="false"><path d="m3.5 8.2 2.7 2.7 6.3-6.3" /></svg>
        </span>
      </label>
    </span>
  );
}

function MenuIcon() {
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

function FolderAddIcon() {
  return (
    <svg className="resumeSelectionFolderIcon" aria-hidden="true" viewBox="0 0 18 18" focusable="false">
      <path d="M2.75 5.25h4l1.25 1.5h7.25v7.5H2.75z" />
      <path d="M9 8.5v3.75M7.125 10.375h3.75" />
    </svg>
  );
}

function FolderShape() {
  return (
    <svg
      className="resumeFolderShape"
      aria-hidden="true"
      viewBox="0 0 200 38"
      preserveAspectRatio="none"
      focusable="false"
    >
      <path
        className="resumeFolderShapeBack"
        d="M12 1H61C68 1 72 8 81 8H188C194 8 199 13 199 19V27C199 33 194 37 188 37H12C6 37 1 32 1 26V12C1 6 6 1 12 1Z"
      />
      <path
        className="resumeFolderShapeFace"
        d="M12 8H188C194 8 199 13 199 19V27C199 33 194 37 188 37H12C6 37 1 32 1 26V19C1 13 6 8 12 8Z"
      />
      <path
        className="resumeFolderShapeOutline"
        d="M12 1H61C68 1 72 8 81 8H188C194 8 199 13 199 19V27C199 33 194 37 188 37H12C6 37 1 32 1 26V12C1 6 6 1 12 1Z"
        vectorEffect="non-scaling-stroke"
      />
      <path
        className="resumeFolderShapeEdge"
        d="M1 19C1 13 6 8 12 8H81"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function BatchDeleteDialog({ resumeCount, folderCount, isDeleting, isSignedIn, onCancel, onConfirm }) {
  const dialogRef = useRef(null);
  const cancelButtonRef = useRef(null);
  const totalCount = resumeCount + folderCount;
  const titleParts = [
    resumeCount ? `${resumeCount} ${resumeCount === 1 ? 'resume' : 'resumes'}` : '',
    folderCount ? `${folderCount} ${folderCount === 1 ? 'folder' : 'folders'}` : '',
  ].filter(Boolean);

  useEffect(() => {
    cancelButtonRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === 'Escape' && !isDeleting) {
        event.preventDefault();
        onCancel();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusable = [...dialogRef.current?.querySelectorAll('button:not(:disabled)') || []];
      const first = focusable[0];
      const last = focusable.at(-1);

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isDeleting, onCancel]);

  return createPortal(
    <div className="resumeDeleteDialogBackdrop" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !isDeleting) {
        onCancel();
      }
    }}>
      <section
        ref={dialogRef}
        className="resumeDeleteDialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-delete-dialog-title"
        aria-describedby="workspace-delete-dialog-description"
      >
        <span className="resumeDeleteDialogIcon" aria-hidden="true"><DeleteIcon /></span>
        <div className="resumeDeleteDialogCopy">
          <h2 id="workspace-delete-dialog-title">Remove {titleParts.join(' and ')}?</h2>
          <p id="workspace-delete-dialog-description">
            {resumeCount ? `Selected resumes will be deleted from this browser${isSignedIn ? ' and your synced account' : ''}. ` : ''}
            {folderCount ? 'Selected folders will be removed, but their remaining resumes will stay.' : ''}
          </p>
        </div>
        <div className="resumeDeleteDialogActions">
          <button ref={cancelButtonRef} type="button" className="button buttonSecondary" onClick={onCancel} disabled={isDeleting}>
            Cancel
          </button>
          <button type="button" className="button buttonDanger resumeDeleteDialogConfirm" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? 'Removing…' : `Remove ${totalCount}`}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function SortableCell({
  id,
  data,
  disabled = false,
  dragDisabled = disabled,
  row,
  column,
  motion = null,
  children,
}) {
  const shouldReduceMotion = useReducedMotion();
  const { active } = useDndContext();
  const sortableData = useMemo(() => ({
    type: data.type,
    id: data.id,
    containerId: data.containerId,
  }), [data.containerId, data.id, data.type]);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({
    id,
    data: sortableData,
    disabled,
    animateLayoutChanges: disableSortableLayoutAnimation,
  });
  const layoutTransition = shouldReduceMotion
    ? { duration: 0 }
    : (active ? RAIL_DRAG_LAYOUT_TRANSITION : RAIL_LAYOUT_TRANSITION);

  return (
    <Motion.div
      className="resumeRailCell"
      layout="position"
      initial={motion?.initial}
      animate={motion?.animate}
      transition={{ layout: layoutTransition, ...motion?.transition }}
      style={{ gridRow: row, gridColumn: column + 1, ...motion?.style }}
    >
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Transform.toString(transform), transition }}
      >
        {children(isDragging, dragDisabled ? {} : { ...attributes, ...listeners }, isOver)}
      </div>
    </Motion.div>
  );
}

function ResumeTile({
  resume,
  containerId,
  row,
  column,
  isActive,
  isSelected,
  isRenaming,
  renameValue,
  canAddResume,
  canDeleteActiveResume,
  onSetActiveResume,
  onStartRename,
  onRenameValueChange,
  onCommitRename,
  onCancelRename,
  onDuplicateResume,
  onDeleteResume,
  onMoveResumeToRoot,
  onToggleSelected,
  motion,
}) {
  const sortableId = createWorkspaceItemId('resume', resume.id);
  return (
    <SortableCell
      id={sortableId}
      data={{ type: 'resume', id: resume.id, containerId }}
      disabled={isRenaming}
      row={row}
      column={column}
      motion={motion}
    >
      {(isDragging, dragProps) => (
        <div className={[
          'resumePill',
          isActive ? 'isActive' : '',
          isSelected ? 'isSelected' : '',
          isRenaming ? 'isEditing' : '',
          isDragging ? 'isSortingPlaceholder' : '',
        ].filter(Boolean).join(' ')}>
          {isRenaming ? (
            <form className="resumePillRenameForm" data-dnd-no-drag="true" onSubmit={(event) => {
              event.preventDefault();
              onCommitRename();
            }}>
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
                aria-label={`Rename ${resume.name}`}
                autoFocus
              />
            </form>
          ) : (
            <button
              type="button"
              className="resumePillButton"
              {...dragProps}
              onClick={() => {
                if (!isDragging) onSetActiveResume(resume.id);
              }}
              onDoubleClick={() => onStartRename(resume)}
              aria-pressed={isActive}
            >
              <span className="resumePillLabel">{resume.name}</span>
            </button>
          )}
          <span className="resumePillActions">
            <SelectionControl item={{ ...resume, type: 'resume' }} isSelected={isSelected} onToggle={onToggleSelected} />
            <span className="resumePillMenuHost" data-dnd-no-drag="true" aria-hidden={!isActive}>
              {isActive ? (
                <EntryActionMenu
                  menuLabel={`${resume.name} actions`}
                  triggerContent={<MenuIcon />}
                  extraItems={[
                    { label: 'Rename', onSelect: () => onStartRename(resume) },
                    { label: 'Duplicate', onSelect: onDuplicateResume, disabled: !canAddResume },
                    ...(containerId !== 'root' ? [{
                      label: 'Move out of folder',
                      onSelect: () => onMoveResumeToRoot(resume.id),
                    }] : []),
                    { label: 'Delete', onSelect: () => onDeleteResume([resume.id], []), tone: 'danger', disabled: !canDeleteActiveResume },
                  ]}
                  buttonClassName="resumePillMenuButton"
                />
              ) : <span className="resumePillMenuPlaceholder" />}
            </span>
          </span>
        </div>
      )}
    </SortableCell>
  );
}

function FolderTile({
  folder,
  toneIndex,
  row,
  column,
  isOpen,
  isTransitioning = false,
  isDropTarget,
  rootInsertPosition,
  containsActiveResume,
  isSelected,
  isRenaming,
  renameValue,
  onToggleOpen,
  onToggleSelected,
  onStartRename,
  onRenameValueChange,
  onCommitRename,
  onCancelRename,
  onRemoveFolder,
}) {
  const sortableId = createWorkspaceItemId('folder', folder.id);

  return (
    <SortableCell
      id={sortableId}
      data={{ type: 'folder', id: folder.id, containerId: 'root' }}
      disabled={isRenaming}
      dragDisabled={isRenaming || isOpen || isTransitioning}
      row={row}
      column={column}
    >
      {(isDragging, dragProps, isOver) => (
        <div className={[
          'resumeFolderTile',
          getFolderToneClass(toneIndex),
          isOpen ? 'isOpen' : '',
          isOver || isDropTarget ? 'isDropTarget' : '',
          rootInsertPosition ? `isRootInsert${rootInsertPosition === 'before' ? 'Before' : 'After'}` : '',
          containsActiveResume ? 'containsActiveResume' : '',
          isSelected ? 'isSelected' : '',
          isRenaming ? 'isEditing' : '',
          isDragging ? 'isSortingPlaceholder' : '',
        ].filter(Boolean).join(' ')}>
          <FolderShape />
          {isRenaming ? (
            <form className="resumeFolderRenameForm" data-dnd-no-drag="true" onSubmit={(event) => {
              event.preventDefault();
              onCommitRename();
            }}>
              <input
                className="resumeFolderRenameInput"
                value={renameValue}
                onChange={(event) => onRenameValueChange(event.target.value)}
                onBlur={onCommitRename}
                maxLength={MAX_WORKSPACE_FOLDER_NAME_LENGTH}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    onCancelRename();
                  }
                }}
                aria-label={`Rename ${folder.name}`}
                autoFocus
              />
            </form>
          ) : (
            <button
              type="button"
              className="resumeFolderButton"
              {...dragProps}
              aria-expanded={isOpen}
              aria-controls={`resume-folder-contents-${folder.id}`}
              onClick={() => {
                if (!isDragging) onToggleOpen(folder.id);
              }}
            >
              <span className="resumeFolderName">{folder.name}</span>
              <span className="resumeFolderCount">{folder.resumeIds.length}</span>
            </button>
          )}
          <span className="resumeFolderActions">
            <SelectionControl item={{ ...folder, type: 'folder' }} isSelected={isSelected} onToggle={onToggleSelected} />
            <span className="resumeFolderMenuHost" data-dnd-no-drag="true">
              <EntryActionMenu
                menuLabel={`${folder.name} actions`}
                triggerContent={<MenuIcon />}
                extraItems={[
                  { label: 'Rename', onSelect: () => onStartRename(folder) },
                  { label: 'Remove folder', onSelect: () => onRemoveFolder(folder.id), tone: 'danger' },
                ]}
                buttonClassName="resumePillMenuButton"
              />
            </span>
          </span>
        </div>
      )}
    </SortableCell>
  );
}

function FolderCluster({
  folder,
  placement,
  isClosing,
  toneIndex,
  sortableResumeIds,
  resumeById,
  activeResumeId,
  selectedResumeIds,
  isFolderSelected,
  renamingResumeId,
  isRenamingFolder,
  renameValue,
  canAddResume,
  canDeleteActiveResume,
  resumeTileProps,
  onToggleOpen,
  onToggleSelected,
  onStartRename,
  onRenameValueChange,
  onCommitRename,
  onCancelRename,
  onRemoveFolder,
  isDropTarget,
  rootInsertPosition,
}) {
  const shouldReduceMotion = useReducedMotion();
  const { active } = useDndContext();
  const { setNodeRef, isOver } = useDroppable({
    id: createWorkspaceItemId('container', folder.id),
    data: { type: 'container', id: folder.id, containerId: folder.id },
    disabled: !placement.isOpen,
  });
  const childIds = useMemo(
    () => sortableResumeIds.map((resumeId) => createWorkspaceItemId('resume', resumeId)),
    [sortableResumeIds],
  );
  const expansionTransition = shouldReduceMotion ? { duration: 0 } : FOLDER_MOTION_TRANSITION;
  const layoutTransition = shouldReduceMotion
    ? { duration: 0 }
    : (active ? RAIL_DRAG_LAYOUT_TRANSITION : RAIL_LAYOUT_TRANSITION);
  const itemStagger = getFolderItemStaggerSeconds(placement.children.length);
  const surfaceStagger = getFolderItemStaggerSeconds(placement.surfaceRows.length);

  return (
    <Motion.div
      ref={setNodeRef}
      id={placement.isOpen ? `resume-folder-contents-${folder.id}` : undefined}
      className={[
        'resumeFolderCluster',
        getFolderToneClass(toneIndex),
        placement.isOpen ? 'isOpen' : '',
        isClosing ? 'isClosing' : '',
        isOver || isDropTarget ? 'isDropTarget' : '',
      ].filter(Boolean).join(' ')}
      style={{
        gridRow: `${placement.row + 1} / span ${placement.height}`,
        gridColumn: `${placement.column + 1} / span ${placement.width}`,
        '--folder-cluster-columns': placement.width,
        '--folder-cluster-rows': placement.height,
      }}
      layout="position"
      transition={{ layout: layoutTransition }}
    >
      <div className="resumeFolderClusterGrid">
        {placement.isOpen ? placement.surfaceRows.map((surfaceRow, index) => (
          <Motion.div
            key={`surface:${folder.id}:${surfaceRow.row}`}
            className="resumeFolderClusterSurface"
            style={{
              gridRow: surfaceRow.row + 1,
              gridColumn: `${surfaceRow.column + 1} / span ${surfaceRow.span}`,
            }}
            initial={shouldReduceMotion ? false : {
              opacity: 0,
              clipPath: 'inset(0% 100% 0% 0% round 14px)',
            }}
            animate={{
              opacity: 1,
              clipPath: 'inset(0% 0% 0% 0% round 14px)',
            }}
            transition={{
              ...expansionTransition,
              delay: shouldReduceMotion ? 0 : index * surfaceStagger,
            }}
            aria-hidden="true"
          />
        )) : null}
        <FolderTile
          folder={folder}
          toneIndex={toneIndex}
          row={placement.tile.row + 1}
          column={placement.tile.column}
          isOpen={placement.isOpen}
          isTransitioning={isClosing}
          isDropTarget={isDropTarget}
          rootInsertPosition={rootInsertPosition}
          containsActiveResume={folder.resumeIds.includes(activeResumeId)}
          isSelected={isFolderSelected}
          isRenaming={isRenamingFolder}
          renameValue={renameValue}
          onToggleOpen={onToggleOpen}
          onToggleSelected={onToggleSelected}
          onStartRename={onStartRename}
          onRenameValueChange={onRenameValueChange}
          onCommitRename={onCommitRename}
          onCancelRename={onCancelRename}
          onRemoveFolder={onRemoveFolder}
        />
        {placement.isOpen ? (
          <SortableContext items={childIds} strategy={railSortingStrategy}>
            {placement.children.map((cell, index) => {
              const resume = resumeById.get(cell.resumeId);

              if (!resume) {
                return null;
              }

              const origin = getFolderItemOrigin(placement.tile, cell);
              const animationOrder = placement.children.length - index - 1;
              const foldedState = {
                opacity: 0,
                x: origin.x,
                y: origin.y,
              };

              return (
                <ResumeTile
                  key={cell.resumeId}
                  {...resumeTileProps}
                  resume={resume}
                  containerId={folder.id}
                  row={cell.row + 1}
                  column={cell.column}
                  isActive={cell.resumeId === activeResumeId}
                  isSelected={selectedResumeIds.has(cell.resumeId)}
                  isRenaming={renamingResumeId === cell.resumeId}
                  renameValue={renameValue}
                  canAddResume={canAddResume}
                  canDeleteActiveResume={canDeleteActiveResume}
                  motion={{
                    initial: shouldReduceMotion ? false : foldedState,
                    animate: { opacity: 1, x: 0, y: 0 },
                    transition: shouldReduceMotion ? { duration: 0 } : {
                      ...FOLDER_MOTION_TRANSITION,
                      delay: animationOrder * itemStagger,
                    },
                    style: {
                      pointerEvents: 'auto',
                      zIndex: index + 2,
                    },
                  }}
                />
              );
            })}
          </SortableContext>
        ) : null}
        {placement.isOpen && placement.emptyCell ? (
          <Motion.span
            className="resumeFolderEmptyLabel"
            initial={shouldReduceMotion ? false : {
              opacity: 0,
              ...getFolderItemOrigin(placement.tile, placement.emptyCell),
            }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            transition={shouldReduceMotion ? { duration: 0 } : FOLDER_MOTION_TRANSITION}
            style={{
              gridRow: placement.emptyCell.row + 1,
              gridColumn: placement.emptyCell.column + 1,
            }}
          >
            Drop resumes here
          </Motion.span>
        ) : null}
      </div>
    </Motion.div>
  );
}

function ClosingFolderLayer({ folderId, placement, toneIndex, resumeById, activeResumeId }) {
  const shouldReduceMotion = useReducedMotion();
  const itemStagger = getFolderItemStaggerSeconds(placement.children.length);
  const surfaceStagger = getFolderItemStaggerSeconds(placement.surfaceRows.length);
  const transitionBase = shouldReduceMotion ? { duration: 0 } : FOLDER_MOTION_TRANSITION;

  return (
    <div
      className={`resumeFolderClosingLayer ${getFolderToneClass(toneIndex)}`}
      style={{ '--folder-cluster-columns': placement.width }}
      aria-hidden="true"
    >
      {placement.surfaceRows.map((surfaceRow, index) => (
        <Motion.div
          key={`closing-surface:${folderId}:${surfaceRow.row}`}
          className="resumeFolderClusterSurface"
          style={{
            gridRow: placement.row + surfaceRow.row + 1,
            gridColumn: `${surfaceRow.column + 1} / span ${surfaceRow.span}`,
          }}
          initial={shouldReduceMotion ? false : {
            opacity: 1,
            clipPath: 'inset(0% 0% 0% 0% round 14px)',
          }}
          animate={{
            opacity: 0,
            clipPath: 'inset(0% 100% 0% 0% round 14px)',
          }}
          transition={{
            ...transitionBase,
            delay: shouldReduceMotion
              ? 0
              : (placement.surfaceRows.length - index - 1) * surfaceStagger,
          }}
        />
      ))}
      {placement.children.map((cell, index) => {
        const resume = resumeById.get(cell.resumeId);

        if (!resume) {
          return null;
        }

        return (
          <Motion.div
            key={`closing-resume:${folderId}:${cell.resumeId}`}
            className="resumeRailCell resumeFolderClosingResume"
            style={{
              gridRow: placement.row + cell.row + 1,
              gridColumn: cell.column + 1,
              zIndex: index + 20,
            }}
            initial={shouldReduceMotion ? false : { opacity: 1, x: 0, y: 0 }}
            animate={{
              opacity: 0,
              ...getFolderItemOrigin(placement.tile, cell),
            }}
            transition={{
              ...transitionBase,
              delay: shouldReduceMotion ? 0 : index * itemStagger,
            }}
          >
            <div>
              <div className={`resumePill${cell.resumeId === activeResumeId ? ' isActive' : ''}`}>
                <span className="resumePillButton">
                  <span className="resumePillLabel">{resume.name}</span>
                </span>
              </div>
            </div>
          </Motion.div>
        );
      })}
    </div>
  );
}

function DragPreview({ activeItem, resumeById, organization, folderToneById, groupCount, activeResumeId }) {
  if (!activeItem?.id) {
    return null;
  }

  if (activeItem.type === 'folder') {
    const folder = organization.folders[activeItem.id];
    return folder ? (
      <div className={`resumeFolderTile resumeFolderTileOverlay ${getFolderToneClass(folderToneById.get(folder.id))}`}>
        <FolderShape />
        <span className="resumeFolderButton">
          <span className="resumeFolderName">{folder.name}</span>
          <span className="resumeFolderCount">{folder.resumeIds.length}</span>
        </span>
      </div>
    ) : null;
  }

  const resume = resumeById.get(activeItem.id);
  return resume ? (
    <div className={`resumePill resumePillOverlay${activeResumeId === resume.id ? ' isActive' : ''}`}>
      <span className="resumePillButton"><span className="resumePillLabel">{resume.name}</span></span>
      {groupCount > 1 ? <span className="resumeDragCount">{groupCount}</span> : null}
    </div>
  ) : null;
}

function RootReleaseDropZone({ isVisible }) {
  const shouldReduceMotion = useReducedMotion();
  const { setNodeRef, isOver } = useDroppable({
    id: createWorkspaceItemId('container', ROOT_RELEASE_CONTAINER_ID),
    data: { type: 'container', id: ROOT_RELEASE_CONTAINER_ID, containerId: 'root' },
    disabled: !isVisible,
  });
  const transition = shouldReduceMotion
    ? { duration: 0 }
    : { duration: 0.22, ease: MOTION_EASE };

  return (
    <AnimatePresence initial={false}>
      {isVisible ? (
        <Motion.div
          key="root-release-zone"
          className="resumeRootReleaseSlot"
          initial={shouldReduceMotion ? false : { height: 0, opacity: 0, y: -4 }}
          animate={{ height: 38, opacity: 1, y: 0 }}
          exit={{ height: 0, opacity: 0, y: -4 }}
          transition={transition}
        >
          <div
            ref={setNodeRef}
            className={`resumeRootReleaseTarget${isOver ? ' isOver' : ''}`}
            aria-label="Move dragged resumes out of their folder"
          >
            Drop here to move out of folder
          </div>
        </Motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export default function ResumeWorkspaceRail({
  resumeList,
  organization,
  activeResumeId,
  canAddResume,
  canDeleteActiveResume,
  onSetActiveResume,
  onCreateResume,
  onDuplicateResume,
  onRenameResume,
  onCreateResumeFolder,
  onRenameResumeFolder,
  onSetResumeOrganization,
  onDeleteResume,
  authUser,
}) {
  const shouldReduceMotion = useReducedMotion();
  const railRef = useRef(null);
  const folderHoverTimerRef = useRef(null);
  const autoFolderCloseTimersRef = useRef(new Map());
  const autoOpenedFolderIdsRef = useRef(new Set());
  const hoveredFolderIdRef = useRef('');
  const folderCloseTimersRef = useRef(new Map());
  const deleteDialogTriggerRef = useRef(null);
  const selectionScopeRef = useRef(authUser?.uid || 'guest');
  const skipRenameCommitRef = useRef(false);
  const dragOpenFolderIdsRef = useRef(new Set());
  const activeDragItemRef = useRef(null);
  const dragResumeIdsRef = useRef([]);
  const dragOrganizationRef = useRef(null);
  const dragBaseOrganizationRef = useRef(null);
  const dragCollisionRectsRef = useRef(new Map());
  const dragPointerCoordinatesRef = useRef(null);
  const dragRenderFrameRef = useRef(null);
  const pendingDragOrganizationRef = useRef(null);
  const activeResumePlacementKeyRef = useRef('');
  const [columns, setColumns] = useState(2);
  const [openFolderIds, setOpenFolderIds] = useState(loadOpenFolderIds);
  const [closingFolderSnapshots, setClosingFolderSnapshots] = useState(new Map());
  const [selectionKeys, setSelectionKeys] = useState(new Set());
  const [renamingItem, setRenamingItem] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [activeDragItem, setActiveDragItem] = useState(null);
  const [dragResumeIds, setDragResumeIds] = useState([]);
  const [dragOrganization, setDragOrganization] = useState(null);
  const [dropTargetFolderId, setDropTargetFolderId] = useState('');
  const [rootInsertTarget, setRootInsertTarget] = useState({ folderId: '', position: '' });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const resumeById = useMemo(() => new Map(resumeList.map((resume) => [resume.id, resume])), [resumeList]);
  const folderToneById = useMemo(() => new Map(
    organization.rootItems
      .filter((item) => item.type === 'folder')
      .map((item) => [item.id, organization.folders[item.id]?.toneIndex || 0]),
  ), [organization.folders, organization.rootItems]);
  const validFolderIds = useMemo(() => new Set(Object.keys(organization.folders)), [organization.folders]);
  const validSelectionKeys = useMemo(() => new Set([
    ...resumeList.map((resume) => createWorkspaceItemId('resume', resume.id)),
    ...Object.keys(organization.folders).map((folderId) => createWorkspaceItemId('folder', folderId)),
  ]), [organization.folders, resumeList]);
  const selectedResumeIds = useMemo(() => new Set(
    [...selectionKeys]
      .map(parseWorkspaceItemId)
      .filter((item) => item.type === 'resume' && resumeById.has(item.id))
      .map((item) => item.id),
  ), [resumeById, selectionKeys]);
  const selectedFolderIds = useMemo(() => new Set(
    [...selectionKeys]
      .map(parseWorkspaceItemId)
      .filter((item) => item.type === 'folder' && validFolderIds.has(item.id))
      .map((item) => item.id),
  ), [selectionKeys, validFolderIds]);
  const selectionCount = selectedResumeIds.size + selectedFolderIds.size;
  const isAtFolderLimit = validFolderIds.size >= MAX_WORKSPACE_FOLDERS;
  const visibleOrganization = dragOrganization || organization;
  const displayedOpenFolderIds = useMemo(() => {
    const next = new Set(
      [...openFolderIds].filter((folderId) => validFolderIds.has(folderId)),
    );

    if (activeDragItem?.type === 'folder') {
      next.delete(activeDragItem.id);
    }

    return next;
  }, [activeDragItem, openFolderIds, validFolderIds]);
  const layoutOrganization = useMemo(() => ({
    ...visibleOrganization,
    rootItems: [...visibleOrganization.rootItems, { type: 'new', id: 'new' }],
  }), [visibleOrganization]);
  const railLayout = useMemo(
    () => buildResumeRailLayout(layoutOrganization, displayedOpenFolderIds, columns),
    [columns, displayedOpenFolderIds, layoutOrganization],
  );
  const railHeight = (
    Math.max(1, railLayout.rowCount) * RAIL_ROW_HEIGHT_PX
    + Math.max(0, railLayout.rowCount - 1) * RAIL_ROW_GAP_PX
    + RAIL_PADDING_BLOCK_PX
  );
  const showRootReleaseZone = activeDragItem?.type === 'resume' && dragResumeIds.some((resumeId) => (
    getOrganizationResumePlacement(organization, resumeId)?.containerId !== 'root'
  ));
  const rootSortableIds = useMemo(
    () => organization.rootItems.map((item) => createWorkspaceItemId(item.type, item.id)),
    [organization.rootItems],
  );
  const wouldDeleteEveryResume = selectedResumeIds.size >= resumeList.length;
  const sensors = useSensors(
    useSensor(ResumeLoomrPointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(ResumeLoomrKeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: {
        start: ['Space'],
        cancel: ['Escape'],
        end: ['Space'],
      },
    }),
  );
  const { setNodeRef: setRootDropRef, isOver: isRootDropTarget } = useDroppable({
    id: createWorkspaceItemId('container', 'root'),
    data: { type: 'container', id: 'root', containerId: 'root' },
  });

  const setRailNode = useCallback((node) => {
    railRef.current = node;
    setRootDropRef(node);
  }, [setRootDropRef]);

  useEffect(() => {
    const node = railRef.current;

    if (!node || typeof ResizeObserver === 'undefined') {
      return undefined;
    }

    const updateColumns = () => {
      const value = Number.parseInt(getComputedStyle(node).getPropertyValue('--resume-rail-columns'), 10);
      setColumns(Number.isFinite(value) ? value : 2);
    };
    const observer = new ResizeObserver(updateColumns);
    observer.observe(node);
    updateColumns();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setSelectionKeys((current) => new Set([...current].filter((key) => validSelectionKeys.has(key))));
    setOpenFolderIds((current) => new Set([...current].filter((folderId) => validFolderIds.has(folderId))));
    setClosingFolderSnapshots((current) => new Map(
      [...current].filter(([folderId]) => validFolderIds.has(folderId)),
    ));
    autoOpenedFolderIdsRef.current = new Set(
      [...autoOpenedFolderIdsRef.current].filter((folderId) => validFolderIds.has(folderId)),
    );
    autoFolderCloseTimersRef.current.forEach((timerId, folderId) => {
      if (!validFolderIds.has(folderId)) {
        window.clearTimeout(timerId);
        autoFolderCloseTimersRef.current.delete(folderId);
      }
    });
  }, [validFolderIds, validSelectionKeys]);

  useEffect(() => {
    const nextScope = authUser?.uid || 'guest';

    if (selectionScopeRef.current !== nextScope) {
      selectionScopeRef.current = nextScope;
      setSelectionKeys(new Set());
      setDeleteDialogOpen(false);
      folderCloseTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      folderCloseTimersRef.current.clear();
      setClosingFolderSnapshots(new Map());
      resetDragState({ restoreOpenFolders: true });
    }
  }, [authUser?.uid]);

  useEffect(() => {
    if (
      activeDragItemRef.current
      && dragBaseOrganizationRef.current
      && !workspaceOrganizationsEqual(organization, dragBaseOrganizationRef.current)
    ) {
      resetDragState({ restoreOpenFolders: true });
    }
  }, [organization]);

  useEffect(() => {
    const placement = getOrganizationResumePlacement(organization, activeResumeId);
    const placementKey = `${activeResumeId}:${placement?.containerId || ''}`;

    if (activeResumePlacementKeyRef.current === placementKey) {
      return;
    }

    activeResumePlacementKeyRef.current = placementKey;

    if (placement?.containerId && placement.containerId !== 'root') {
      window.clearTimeout(folderCloseTimersRef.current.get(placement.containerId));
      folderCloseTimersRef.current.delete(placement.containerId);
      setClosingFolderSnapshots((current) => {
        const next = new Map(current);
        next.delete(placement.containerId);
        return next;
      });
      setOpenFolderIds((current) => new Set(current).add(placement.containerId));
    }
  }, [activeResumeId, organization]);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        WORKSPACE_OPEN_FOLDERS_STORAGE_KEY,
        JSON.stringify([...openFolderIds].filter((folderId) => validFolderIds.has(folderId)).slice(-100)),
      );
    } catch {
      // Folder state is a local preference; organization remains persisted in the workspace.
    }
  }, [openFolderIds, validFolderIds]);

  useEffect(() => () => {
    window.clearTimeout(folderHoverTimerRef.current);
    window.cancelAnimationFrame(dragRenderFrameRef.current);
    autoFolderCloseTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    autoFolderCloseTimersRef.current.clear();
    folderCloseTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    folderCloseTimersRef.current.clear();
  }, []);

  function toggleSelection(type, id) {
    const key = createWorkspaceItemId(type, id);
    setSelectionKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function clearSelection() {
    setSelectionKeys(new Set());
  }

  function openFolder(folderId) {
    window.clearTimeout(folderCloseTimersRef.current.get(folderId));
    folderCloseTimersRef.current.delete(folderId);
    setClosingFolderSnapshots((current) => {
      const next = new Map(current);
      next.delete(folderId);
      return next;
    });
    setOpenFolderIds((current) => new Set(current).add(folderId));
  }

  function closeFolder(folderId, { clearHiddenSelection = true } = {}) {
    const folderPlacement = railLayout.placements.find((placement) => placement.folderId === folderId);

    if (folderPlacement?.isOpen && organization.folders[folderId]) {
      setClosingFolderSnapshots((current) => new Map(current).set(folderId, {
        folderId,
        placement: {
          row: folderPlacement.row,
          width: folderPlacement.width,
          tile: { ...folderPlacement.tile },
          children: folderPlacement.children.map((cell) => ({ ...cell })),
          surfaceRows: folderPlacement.surfaceRows.map((row) => ({ ...row })),
        },
        toneIndex: folderToneById.get(folderId),
      }));
    }

    setOpenFolderIds((current) => {
      const next = new Set(current);
      next.delete(folderId);
      return next;
    });

    const childIds = new Set(folderPlacement?.children.map((cell) => cell.resumeId) || []);
    if (clearHiddenSelection) {
      setSelectionKeys((selected) => new Set([...selected].filter((key) => {
        const item = parseWorkspaceItemId(key);
        return item.type !== 'resume' || !childIds.has(item.id);
      })));
    }

    const closeTimer = window.setTimeout(() => {
      folderCloseTimersRef.current.delete(folderId);
      setClosingFolderSnapshots((current) => {
        const next = new Map(current);
        next.delete(folderId);
        return next;
      });
    }, shouldReduceMotion
      ? 0
      : getFolderCloseDurationMs(childIds.size, folderPlacement?.surfaceRows.length || 1));
    folderCloseTimersRef.current.set(folderId, closeTimer);
  }

  function toggleFolder(folderId) {
    if (openFolderIds.has(folderId)) {
      closeFolder(folderId);
    } else {
      openFolder(folderId);
    }
  }

  function startRename(type, item) {
    skipRenameCommitRef.current = false;
    setRenamingItem({ type, id: item.id });
    setRenameValue(type === 'folder'
      ? sanitizeWorkspaceFolderName(item.name)
      : sanitizeWorkspaceResumeName(item.name));
  }

  function cancelRename() {
    skipRenameCommitRef.current = true;
    setRenamingItem(null);
    setRenameValue('');
  }

  function commitRename() {
    if (skipRenameCommitRef.current) {
      skipRenameCommitRef.current = false;
      return;
    }

    if (!renamingItem) {
      return;
    }

    if (renamingItem.type === 'folder') {
      onRenameResumeFolder(renamingItem.id, renameValue);
    } else {
      onRenameResume(renamingItem.id, renameValue);
    }
    cancelRename();
  }

  async function createFolderFromSelection() {
    if (selectedResumeIds.size === 0 || isCreatingFolder) {
      return;
    }

    setIsCreatingFolder(true);
    try {
      const folderName = createNextWorkspaceFolderName(organization.folders);
      const folderId = await onCreateResumeFolder([...selectedResumeIds]);
      if (folderId) {
        setOpenFolderIds((current) => new Set(current).add(folderId));
        skipRenameCommitRef.current = false;
        setRenamingItem({ type: 'folder', id: folderId });
        setRenameValue(folderName);
        clearSelection();
      }
    } finally {
      setIsCreatingFolder(false);
    }
  }

  async function removeFolder(folderId) {
    const removed = await onDeleteResume([], [folderId]);
    if (removed) {
      window.clearTimeout(folderCloseTimersRef.current.get(folderId));
      folderCloseTimersRef.current.delete(folderId);
      setClosingFolderSnapshots((current) => {
        const next = new Map(current);
        next.delete(folderId);
        return next;
      });
      setOpenFolderIds((current) => {
        const next = new Set(current);
        next.delete(folderId);
        return next;
      });
      setSelectionKeys((current) => {
        const next = new Set(current);
        next.delete(createWorkspaceItemId('folder', folderId));
        return next;
      });
    }
  }

  function moveResumeToRoot(resumeId) {
    const placement = getOrganizationResumePlacement(organization, resumeId);

    if (!placement || placement.containerId === 'root') {
      return;
    }

    const nextOrganization = moveOrganizationResumeBundle(organization, [resumeId], {
      containerId: 'root',
      afterRootItem: { type: 'folder', id: placement.containerId },
    });

    if (!workspaceOrganizationsEqual(nextOrganization, organization)) {
      onSetResumeOrganization(nextOrganization, 'organize-resumes');
    }
  }

  function getCollisionDetection(args) {
    dragPointerCoordinatesRef.current = args.pointerCoordinates || null;
    const activeType = args.active.data.current?.type;
    const eligibleContainers = args.droppableContainers.filter((container) => {
      const data = container.data.current;

      if (String(container.id) === String(args.active.id)) {
        return false;
      }

      if (data?.type === 'resume' && dragResumeIdsRef.current.includes(data.id)) {
        return false;
      }

      if (activeType === 'folder') {
        return data?.containerId === 'root' && (data?.type === 'resume' || data?.type === 'folder');
      }
      return data?.type === 'resume' || data?.type === 'folder' || data?.type === 'container';
    });
    const eligibleContainerById = new Map(
      eligibleContainers.map((container) => [String(container.id), container]),
    );
    const liveDroppableRects = new Map(args.droppableRects);
    const collisionRects = new Map();
    const setCollisionRect = (containerId, rect) => {
      const container = eligibleContainerById.get(String(containerId));
      if (!container || !rect) return;

      liveDroppableRects.set(container.id, rect);
      collisionRects.set(String(container.id), {
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        left: rect.left,
        width: rect.width,
        height: rect.height,
      });
    };
    eligibleContainers.forEach((container) => {
      const rect = container.node.current?.getBoundingClientRect?.() || container.rect.current;
      setCollisionRect(container.id, rect);
    });
    dragCollisionRectsRef.current = collisionRects;
    const collisionArgs = { ...args, droppableContainers: eligibleContainers, droppableRects: liveDroppableRects };

    if (activeType === 'resume' && args.pointerCoordinates) {
      const openFolderDestination = getOpenFolderPointerDestination(args.pointerCoordinates);

      if (openFolderDestination) {
        const containerId = createWorkspaceItemId('container', openFolderDestination.folderId);
        const container = eligibleContainerById.get(containerId);
        if (container) {
          return [{ id: container.id, data: { droppableContainer: container, value: 0 } }];
        }
      }
    }

    const pointerCollisions = pointerWithin(collisionArgs).filter(
      (collision) => {
        const item = parseWorkspaceItemId(collision.id);
        if (
          !args.pointerCoordinates
          || item.type !== 'container'
          || item.id === 'root'
          || item.id === ROOT_RELEASE_CONTAINER_ID
        ) {
          return true;
        }

        const placement = railLayout.placements.find((candidate) => candidate.folderId === item.id);
        const rect = liveDroppableRects.get(eligibleContainerById.get(String(collision.id))?.id);
        return isPointerWithinFolderPlacementSurface(args.pointerCoordinates, rect, placement);
      },
    );
    const specificPointerCollisions = pointerCollisions.filter(
      (collision) => String(collision.id) !== createWorkspaceItemId('container', 'root'),
    );

    if (specificPointerCollisions.length) {
      const sortedCollisions = specificPointerCollisions.sort((first, second) => {
        const getPriority = (collision) => {
          const item = parseWorkspaceItemId(collision.id);
          if (item.type === 'resume') return 0;
          if (item.type === 'folder') return 1;
          return item.type === 'container' && item.id !== 'root' ? 2 : 3;
        };

        return getPriority(first) - getPriority(second);
      });
      return sortedCollisions;
    }

    if (pointerCollisions.length) {
      const initialRect = args.active.rect.current.initial;
      const pointer = args.pointerCoordinates;
      const isStillOverSource = Boolean(
        initialRect
        && pointer
        && pointer.x >= initialRect.left
        && pointer.x <= initialRect.right
        && pointer.y >= initialRect.top
        && pointer.y <= initialRect.bottom
      );

      if (isStillOverSource && pointerCollisions.every(
        (collision) => String(collision.id) === createWorkspaceItemId('container', 'root'),
      )) {
        return [];
      }

      const itemContainers = eligibleContainers.filter((container) => (
        container.data.current?.type === 'resume' || container.data.current?.type === 'folder'
      ));
      const nearestItem = closestCenter({ ...collisionArgs, droppableContainers: itemContainers });
      return nearestItem.length ? nearestItem : pointerCollisions;
    }

    if (args.pointerCoordinates) {
      return [];
    }

    const itemContainers = eligibleContainers.filter((container) => (
      container.data.current?.type === 'resume' || container.data.current?.type === 'folder'
    ));
    const itemCollisions = closestCenter({ ...collisionArgs, droppableContainers: itemContainers });

    if (itemCollisions.length) {
      return itemCollisions;
    }

    return closestCenter(collisionArgs);
  }

  function updateDragOrganization(updater) {
    const current = dragOrganizationRef.current;
    const base = dragBaseOrganizationRef.current;

    if (!current || !base) {
      return;
    }

    const next = updater(base);

    if (next === current || workspaceOrganizationsEqual(next, current)) {
      return;
    }

    dragOrganizationRef.current = next;
    pendingDragOrganizationRef.current = next;

    if (dragRenderFrameRef.current !== null) {
      return;
    }

    dragRenderFrameRef.current = window.requestAnimationFrame(() => {
      dragRenderFrameRef.current = null;
      const pendingOrganization = pendingDragOrganizationRef.current;
      pendingDragOrganizationRef.current = null;

      if (!activeDragItemRef.current || !pendingOrganization) {
        return;
      }

      setDragOrganization((renderedOrganization) => (
        renderedOrganization
        && workspaceOrganizationsEqual(renderedOrganization, pendingOrganization)
          ? renderedOrganization
          : pendingOrganization
      ));
    });
  }

  function handleDragStart(event) {
    cancelRename();
    window.clearTimeout(folderHoverTimerRef.current);
    autoFolderCloseTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    autoFolderCloseTimersRef.current.clear();
    window.cancelAnimationFrame(dragRenderFrameRef.current);
    dragRenderFrameRef.current = null;
    pendingDragOrganizationRef.current = null;
    autoOpenedFolderIdsRef.current.clear();
    hoveredFolderIdRef.current = '';
    const item = parseWorkspaceItemId(event.active.id);
    const nextDragResumeIds = item.type === 'resume' && selectedResumeIds.has(item.id) && selectedFolderIds.size === 0
      ? getOrganizationVisualResumeIds(organization).filter((resumeId) => selectedResumeIds.has(resumeId))
      : (item.type === 'resume' ? [item.id] : []);

    activeDragItemRef.current = item;
    dragResumeIdsRef.current = nextDragResumeIds;
    dragOrganizationRef.current = organization;
    dragBaseOrganizationRef.current = organization;
    dragCollisionRectsRef.current = new Map();
    setActiveDragItem(item);
    setDragOrganization(organization);
    setDragResumeIds(nextDragResumeIds);
    setDropTargetFolderId('');
    setRootInsertTargetIfChanged(setRootInsertTarget);
    dragOpenFolderIdsRef.current = new Set(openFolderIds);
  }

  function getAfterPosition(event) {
    const overId = String(event.over?.id || '');
    const pointer = dragPointerCoordinatesRef.current;
    const overRect = dragCollisionRectsRef.current.get(overId) || event.over?.rect;
    if (!pointer || !overRect) return false;
    const overCenterX = overRect.left + overRect.width / 2;
    const overCenterY = overRect.top + overRect.height / 2;
    const rowThreshold = overRect.height * 0.45;

    return Math.abs(pointer.y - overCenterY) > rowThreshold
      ? pointer.y > overCenterY
      : pointer.x > overCenterX;
  }

  function moveResumeBundleToFolderIndex(baseOrganization, draggedResumeIds, folderId, insertionIndex) {
    const draggedSet = new Set(draggedResumeIds);
    const targetResumeIds = (baseOrganization.folders[folderId]?.resumeIds || [])
      .filter((resumeId) => !draggedSet.has(resumeId));
    const boundedIndex = Math.max(0, Math.min(targetResumeIds.length, insertionIndex));

    return moveOrganizationResumeBundle(baseOrganization, draggedResumeIds, {
      containerId: folderId,
      ...(boundedIndex < targetResumeIds.length ? {
        overResumeId: targetResumeIds[boundedIndex],
      } : {}),
    });
  }

  function getCurrentDragRailLayout() {
    const currentOrganization = dragOrganizationRef.current || organization;
    return buildResumeRailLayout({
      ...currentOrganization,
      rootItems: [...currentOrganization.rootItems, { type: 'new', id: 'new' }],
    }, openFolderIds, columns);
  }

  function getFinalRailGridMetrics() {
    const railRect = railRef.current?.getBoundingClientRect?.();
    if (!railRect) return null;

    const padding = RAIL_PADDING_BLOCK_PX / 2;
    const contentWidth = railRect.width - padding * 2;
    const cellWidth = (
      contentWidth - RAIL_ROW_GAP_PX * Math.max(0, columns - 1)
    ) / columns;

    return {
      left: railRect.left + padding,
      top: railRect.top + padding,
      width: contentWidth,
      cellWidth,
      columnStride: cellWidth + RAIL_ROW_GAP_PX,
      rowStride: RAIL_ROW_HEIGHT_PX + RAIL_ROW_GAP_PX,
    };
  }

  function getFinalRailCellRect(row, column) {
    const metrics = getFinalRailGridMetrics();
    if (!metrics) return null;

    const left = metrics.left + column * metrics.columnStride;
    const top = metrics.top + row * metrics.rowStride;
    return {
      top,
      right: left + metrics.cellWidth,
      bottom: top + RAIL_ROW_HEIGHT_PX,
      left,
      width: metrics.cellWidth,
      height: RAIL_ROW_HEIGHT_PX,
    };
  }

  function getFinalFolderPlacementRect(placement) {
    const metrics = getFinalRailGridMetrics();
    if (!metrics || !placement?.isOpen) return null;

    const left = metrics.left + placement.column * metrics.columnStride;
    const top = metrics.top + placement.row * metrics.rowStride;
    const width = (
      placement.width * metrics.cellWidth
      + Math.max(0, placement.width - 1) * RAIL_ROW_GAP_PX
    );
    const height = (
      placement.height * RAIL_ROW_HEIGHT_PX
      + Math.max(0, placement.height - 1) * RAIL_ROW_GAP_PX
    );

    return {
      top,
      right: left + width,
      bottom: top + height,
      left,
      width,
      height,
    };
  }

  function getRootPointerDestination(pointer = dragPointerCoordinatesRef.current) {
    const baseOrganization = dragBaseOrganizationRef.current;
    const draggedItem = activeDragItemRef.current;
    const metrics = getFinalRailGridMetrics();
    if (!pointer || !baseOrganization || !draggedItem || !metrics) return null;

    const draggedResumeSet = new Set(dragResumeIdsRef.current);
    const targetRootItems = baseOrganization.rootItems.filter((item) => (
      !(draggedItem.type === 'folder' && item.type === 'folder' && item.id === draggedItem.id)
      && !(item.type === 'resume' && draggedResumeSet.has(item.id))
    ));
    const targetOrganization = {
      ...baseOrganization,
      rootItems: targetRootItems,
      folders: Object.fromEntries(Object.entries(baseOrganization.folders).map(([folderId, folder]) => [
        folderId,
        {
          ...folder,
          resumeIds: folder.resumeIds.filter((resumeId) => !draggedResumeSet.has(resumeId)),
        },
      ])),
    };
    const targetLayout = buildResumeRailLayout({
      ...targetOrganization,
      rootItems: [...targetRootItems, { type: 'new', id: 'new' }],
    }, openFolderIds, columns);
    const maxBottom = (
      metrics.top
      + Math.max(1, targetLayout.rowCount) * RAIL_ROW_HEIGHT_PX
      + Math.max(0, targetLayout.rowCount - 1) * RAIL_ROW_GAP_PX
    );
    if (
      pointer.x < metrics.left - RAIL_ROW_GAP_PX / 2
      || pointer.x > metrics.left + metrics.width + RAIL_ROW_GAP_PX / 2
      || pointer.y < metrics.top - RAIL_ROW_GAP_PX / 2
      || pointer.y > maxBottom + RAIL_ROW_GAP_PX / 2
    ) {
      return null;
    }

    const rootPlacements = targetLayout.placements.filter((placement) => placement.item.type !== 'new');
    if (rootPlacements.length === 0) {
      return { type: 'root', insertionIndex: 0, targetItem: null, position: 'before' };
    }

    let nearest = null;
    rootPlacements.forEach((placement, index) => {
      const tile = placement.tile || { row: 0, column: placement.column };
      const rect = getFinalRailCellRect(placement.row + tile.row, tile.column);
      if (!rect) return;

      const dx = Math.max(rect.left - pointer.x, 0, pointer.x - rect.right);
      const dy = Math.max(rect.top - pointer.y, 0, pointer.y - rect.bottom);
      const centerDx = pointer.x - (rect.left + rect.width / 2);
      const centerDy = pointer.y - (rect.top + rect.height / 2);
      const score = dx * dx + dy * dy;
      const centerScore = centerDx * centerDx + centerDy * centerDy;
      if (!nearest || score < nearest.score || (score === nearest.score && centerScore < nearest.centerScore)) {
        nearest = { index, placement, rect, score, centerScore };
      }
    });
    if (!nearest) return null;

    const targetItem = nearest.placement.item;
    const pointerIsAfter = pointer.y > nearest.rect.bottom
      || (
        pointer.y >= nearest.rect.top
        && pointer.x > nearest.rect.left + nearest.rect.width / 2
      );
    const position = pointerIsAfter ? 'after' : 'before';

    if (
      draggedItem.type === 'resume'
      && targetItem.type === 'folder'
      && !openFolderIds.has(targetItem.id)
      && pointIsWithinRect(pointer, nearest.rect)
      && getFolderResumeDropIntent(pointer, nearest.rect) === 'inside'
    ) {
      return { type: 'closed-folder', folderId: targetItem.id };
    }

    return {
      type: 'root',
      insertionIndex: nearest.index + (pointerIsAfter ? 1 : 0),
      targetItem,
      position,
    };
  }

  function applyRootPointerDestination(baseOrganization, draggedItem, draggedResumeIds, destination) {
    if (destination.type === 'closed-folder') {
      return moveOrganizationResumeBundle(baseOrganization, draggedResumeIds, {
        containerId: destination.folderId,
      });
    }

    return draggedItem.type === 'folder'
      ? moveOrganizationRootItemToIndex(baseOrganization, draggedItem, destination.insertionIndex)
      : moveOrganizationResumeBundle(baseOrganization, draggedResumeIds, {
        containerId: 'root',
        rootIndex: destination.insertionIndex,
      });
  }

  function getOpenFolderPointerDestination(pointer = dragPointerCoordinatesRef.current) {
    const baseOrganization = dragBaseOrganizationRef.current;
    if (!pointer || !baseOrganization) return null;

    const currentRailLayout = getCurrentDragRailLayout();
    for (const placement of currentRailLayout.placements) {
      if (!placement.isOpen || !placement.folderId) continue;

      const rect = getFinalFolderPlacementRect(placement);
      if (!isPointerWithinFolderPlacementSurface(pointer, rect, placement, { includeGaps: true })) {
        continue;
      }

      const tileRect = getFolderPlacementCellRect(rect, placement, placement.tile);
      if (pointIsWithinRect(pointer, tileRect)) {
        const intent = getFolderResumeDropIntent(pointer, tileRect);
        if (intent !== 'inside') {
          return { type: 'root-folder', folderId: placement.folderId, position: intent };
        }
      }

      const draggedSet = new Set(dragResumeIdsRef.current);
      const targetCount = (baseOrganization.folders[placement.folderId]?.resumeIds || [])
        .filter((resumeId) => !draggedSet.has(resumeId))
        .length;
      const insertionIndex = pointIsWithinRect(pointer, tileRect)
        ? targetCount
        : getFolderResumeInsertionIndex(pointer, rect, placement, targetCount);

      return {
        type: 'folder',
        folderId: placement.folderId,
        insertionIndex: insertionIndex ?? targetCount,
      };
    }

    return null;
  }

  function applyOpenFolderPointerDestination(baseOrganization, draggedResumeIds, destination) {
    if (destination.type === 'folder') {
      return moveResumeBundleToFolderIndex(
        baseOrganization,
        draggedResumeIds,
        destination.folderId,
        destination.insertionIndex,
      );
    }

    return moveOrganizationResumeBundle(baseOrganization, draggedResumeIds, {
      containerId: 'root',
      overRootItem: { type: 'folder', id: destination.folderId },
      after: destination.position === 'after',
    });
  }

  function resolveResumeDragOrganization(event, draggedResumeIds) {
    const baseOrganization = dragBaseOrganizationRef.current;
    if (!baseOrganization) return dragOrganizationRef.current;

    const openFolderDestination = getOpenFolderPointerDestination();
    if (openFolderDestination) {
      return applyOpenFolderPointerDestination(baseOrganization, draggedResumeIds, openFolderDestination);
    }

    const rootDestination = getRootPointerDestination();
    if (rootDestination) {
      return applyRootPointerDestination(
        baseOrganization,
        activeDragItemRef.current,
        draggedResumeIds,
        rootDestination,
      );
    }

    if (!event.over) return dragOrganizationRef.current;

    const overItem = parseWorkspaceItemId(event.over.id);

    if (overItem.type === 'folder') {
      const intent = getFolderResumeDropIntent(
        dragPointerCoordinatesRef.current,
        dragCollisionRectsRef.current.get(String(event.over.id)) || event.over.rect,
      );

      return intent === 'inside'
        ? moveOrganizationResumeBundle(baseOrganization, draggedResumeIds, {
          containerId: overItem.id,
        })
        : moveOrganizationResumeBundle(baseOrganization, draggedResumeIds, {
          containerId: 'root',
          overRootItem: { type: 'folder', id: overItem.id },
          after: intent === 'after',
        });
    }

    if (overItem.type === 'container') {
      const isRootRelease = overItem.id === ROOT_RELEASE_CONTAINER_ID;
      const destinationContainerId = isRootRelease ? 'root' : overItem.id;
      const sourcePlacements = draggedResumeIds.map((resumeId) => (
        getOrganizationResumePlacement(baseOrganization, resumeId)
      ));
      const sourceFolderId = sourcePlacements.length > 0
        && sourcePlacements.every((placement) => (
          placement?.containerId && placement.containerId === sourcePlacements[0]?.containerId
        ))
        && sourcePlacements[0]?.containerId !== 'root'
        ? sourcePlacements[0].containerId
        : '';

      return moveOrganizationResumeBundle(baseOrganization, draggedResumeIds, {
        containerId: destinationContainerId,
        ...(isRootRelease && sourceFolderId ? {
          afterRootItem: { type: 'folder', id: sourceFolderId },
        } : {}),
      });
    }

    if (overItem.type === 'resume' && !draggedResumeIds.includes(overItem.id)) {
      const placement = getOrganizationResumePlacement(baseOrganization, overItem.id);

      return placement
        ? moveOrganizationResumeBundle(baseOrganization, draggedResumeIds, {
          containerId: placement.containerId,
          overResumeId: overItem.id,
          after: getAfterPosition(event),
        })
        : dragOrganizationRef.current;
    }

    return dragOrganizationRef.current;
  }

  function getAutoOpenedFolderAtPointer(pointer = dragPointerCoordinatesRef.current) {
    const destination = getOpenFolderPointerDestination(pointer);
    return destination && autoOpenedFolderIdsRef.current.has(destination.folderId)
      ? destination.folderId
      : '';
  }

  function scheduleFolderOpen(folderId) {
    if (
      !folderId
      || openFolderIds.has(folderId)
      || autoOpenedFolderIdsRef.current.has(folderId)
    ) {
      window.clearTimeout(folderHoverTimerRef.current);
      return;
    }

    window.clearTimeout(folderHoverTimerRef.current);
    folderHoverTimerRef.current = window.setTimeout(() => {
      if (
        activeDragItemRef.current?.type !== 'resume'
        || hoveredFolderIdRef.current !== folderId
      ) {
        return;
      }

      if (!dragOpenFolderIdsRef.current.has(folderId)) {
        autoOpenedFolderIdsRef.current.add(folderId);
      }
      openFolder(folderId);
      updateDragOrganization((baseOrganization) => moveOrganizationResumeBundle(
        baseOrganization,
        dragResumeIdsRef.current,
        { containerId: folderId },
      ));
    }, FOLDER_AUTO_OPEN_DELAY_MS);
  }

  function cancelAutoFolderClose(folderId) {
    window.clearTimeout(autoFolderCloseTimersRef.current.get(folderId));
    autoFolderCloseTimersRef.current.delete(folderId);
  }

  function scheduleAutoFolderClose(folderId) {
    if (
      !folderId
      || !autoOpenedFolderIdsRef.current.has(folderId)
      || autoFolderCloseTimersRef.current.has(folderId)
    ) {
      return;
    }

    const timerId = window.setTimeout(() => {
      autoFolderCloseTimersRef.current.delete(folderId);
      if (
        hoveredFolderIdRef.current === folderId
        || !autoOpenedFolderIdsRef.current.has(folderId)
      ) {
        return;
      }

      autoOpenedFolderIdsRef.current.delete(folderId);
      closeFolder(folderId, { clearHiddenSelection: false });
    }, FOLDER_AUTO_CLOSE_DELAY_MS);
    autoFolderCloseTimersRef.current.set(folderId, timerId);
  }

  function updateAutoFolderHover(folderId) {
    hoveredFolderIdRef.current = folderId;
    autoOpenedFolderIdsRef.current.forEach((autoFolderId) => {
      if (autoFolderId === folderId) {
        cancelAutoFolderClose(autoFolderId);
      } else {
        scheduleAutoFolderClose(autoFolderId);
      }
    });
  }

  function getHoveredFolderId(event, overItem) {
    const pointerFolderId = getAutoOpenedFolderAtPointer();
    if (pointerFolderId) return pointerFolderId;

    if (overItem.type === 'folder') return overItem.id;
    if (
      overItem.type === 'container'
      && overItem.id !== 'root'
      && overItem.id !== ROOT_RELEASE_CONTAINER_ID
    ) {
      return overItem.id;
    }
    if (overItem.type !== 'resume') return '';

    const registeredContainerId = event.over?.data.current?.containerId;
    if (registeredContainerId && registeredContainerId !== 'root') {
      return registeredContainerId;
    }

    const placement = getOrganizationResumePlacement(
      dragOrganizationRef.current || organization,
      overItem.id,
    );
    return placement?.containerId && placement.containerId !== 'root'
      ? placement.containerId
      : '';
  }

  function handleDragMove(event) {
    const draggedItem = activeDragItemRef.current;
    const draggedResumeIds = dragResumeIdsRef.current;

    if (!draggedItem || !dragOrganizationRef.current) {
      return;
    }

    if (draggedItem.type === 'resume') {
      const openFolderDestination = getOpenFolderPointerDestination();
      if (openFolderDestination) {
        window.clearTimeout(folderHoverTimerRef.current);
        updateAutoFolderHover(openFolderDestination.folderId);

        if (openFolderDestination.type === 'folder') {
          setRootInsertTargetIfChanged(setRootInsertTarget);
          setDropTargetFolderId(openFolderDestination.folderId);
        } else {
          setDropTargetFolderId('');
          setRootInsertTargetIfChanged(
            setRootInsertTarget,
            openFolderDestination.folderId,
            openFolderDestination.position,
          );
        }

        updateDragOrganization((baseOrganization) => applyOpenFolderPointerDestination(
          baseOrganization,
          draggedResumeIds,
          openFolderDestination,
        ));
        return;
      }
    }

    const rootDestination = getRootPointerDestination();
    if (rootDestination) {
      if (rootDestination.type === 'closed-folder') {
        updateAutoFolderHover(rootDestination.folderId);
        setRootInsertTargetIfChanged(setRootInsertTarget);
        setDropTargetFolderId(rootDestination.folderId);
        scheduleFolderOpen(rootDestination.folderId);
      } else {
        window.clearTimeout(folderHoverTimerRef.current);
        updateAutoFolderHover('');
        setDropTargetFolderId('');
        setRootInsertTargetIfChanged(
          setRootInsertTarget,
          rootDestination.targetItem?.type === 'folder' ? rootDestination.targetItem.id : '',
          rootDestination.targetItem?.type === 'folder' ? rootDestination.position : '',
        );
        updateDragOrganization((baseOrganization) => applyRootPointerDestination(
          baseOrganization,
          draggedItem,
          draggedResumeIds,
          rootDestination,
        ));
      }
      return;
    }

    if (!event.over) {
      window.clearTimeout(folderHoverTimerRef.current);
      updateAutoFolderHover(getAutoOpenedFolderAtPointer());
      return;
    }

    const overItem = parseWorkspaceItemId(event.over.id);
    updateAutoFolderHover(getHoveredFolderId(event, overItem));
    if (draggedItem.type === 'folder') {
      setDropTargetFolderId('');
      setRootInsertTargetIfChanged(setRootInsertTarget);
      if ((overItem.type === 'folder' || overItem.type === 'resume') && event.over.data.current?.containerId === 'root') {
        updateDragOrganization((current) => moveOrganizationRootItem(current, draggedItem, overItem, getAfterPosition(event)));
      }
      return;
    }

    if (overItem.type === 'folder') {
      const intent = getFolderResumeDropIntent(
        dragPointerCoordinatesRef.current,
        dragCollisionRectsRef.current.get(String(event.over.id)) || event.over.rect,
      );

      if (intent === 'inside') {
        setRootInsertTargetIfChanged(setRootInsertTarget);
        setDropTargetFolderId(overItem.id);
        scheduleFolderOpen(overItem.id);
      } else {
        window.clearTimeout(folderHoverTimerRef.current);
        setDropTargetFolderId('');
        setRootInsertTargetIfChanged(setRootInsertTarget, overItem.id, intent);
        updateDragOrganization((current) => moveOrganizationResumeBundle(current, draggedResumeIds, {
          containerId: 'root',
          overRootItem: { type: 'folder', id: overItem.id },
          after: intent === 'after',
        }));
      }
      return;
    }

    window.clearTimeout(folderHoverTimerRef.current);
    setRootInsertTargetIfChanged(setRootInsertTarget);
    if (overItem.type === 'container') {
      const isRootRelease = overItem.id === ROOT_RELEASE_CONTAINER_ID;
      const destinationContainerId = isRootRelease ? 'root' : overItem.id;
      const sourcePlacements = draggedResumeIds.map((resumeId) => (
        getOrganizationResumePlacement(dragBaseOrganizationRef.current, resumeId)
      ));
      const sourceFolderId = sourcePlacements.length > 0
        && sourcePlacements.every((placement) => (
          placement?.containerId && placement.containerId === sourcePlacements[0]?.containerId
        ))
        && sourcePlacements[0]?.containerId !== 'root'
        ? sourcePlacements[0].containerId
        : '';

      setDropTargetFolderId(destinationContainerId === 'root' ? '' : destinationContainerId);
      updateDragOrganization((current) => moveOrganizationResumeBundle(current, draggedResumeIds, {
        containerId: destinationContainerId,
        ...(isRootRelease && sourceFolderId ? {
          afterRootItem: { type: 'folder', id: sourceFolderId },
        } : {}),
      }));
      return;
    }

    if (overItem.type === 'resume' && !draggedResumeIds.includes(overItem.id)) {
      updateDragOrganization((current) => {
        const placement = getOrganizationResumePlacement(current, overItem.id);

        setDropTargetFolderId(placement?.containerId && placement.containerId !== 'root' ? placement.containerId : '');

        return placement
          ? moveOrganizationResumeBundle(current, draggedResumeIds, {
            containerId: placement.containerId,
            overResumeId: overItem.id,
            after: getAfterPosition(event),
          })
          : current;
      });
      return;
    }

    setDropTargetFolderId('');
  }

  function resetDragState({ restoreOpenFolders = false } = {}) {
    window.clearTimeout(folderHoverTimerRef.current);
    window.cancelAnimationFrame(dragRenderFrameRef.current);
    dragRenderFrameRef.current = null;
    pendingDragOrganizationRef.current = null;
    autoFolderCloseTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    autoFolderCloseTimersRef.current.clear();
    autoOpenedFolderIdsRef.current.clear();
    hoveredFolderIdRef.current = '';
    if (restoreOpenFolders) {
      setOpenFolderIds(new Set(dragOpenFolderIdsRef.current));
    }
    activeDragItemRef.current = null;
    dragResumeIdsRef.current = [];
    dragOrganizationRef.current = null;
    dragBaseOrganizationRef.current = null;
    dragCollisionRectsRef.current = new Map();
    dragPointerCoordinatesRef.current = null;
    setActiveDragItem(null);
    setDragResumeIds([]);
    setDragOrganization(null);
    setDropTargetFolderId('');
    setRootInsertTargetIfChanged(setRootInsertTarget);
  }

  function handleDragEnd(event) {
    window.clearTimeout(folderHoverTimerRef.current);
    const overItem = event.over ? parseWorkspaceItemId(event.over.id) : null;
    const baseOrganization = dragBaseOrganizationRef.current;
    const draggedItem = activeDragItemRef.current;
    const openFolderDestination = draggedItem?.type === 'resume'
      ? getOpenFolderPointerDestination()
      : null;
    const rootDestination = openFolderDestination ? null : getRootPointerDestination();
    const hasValidDestination = Boolean(openFolderDestination || rootDestination || event.over);
    const finalOrganization = draggedItem?.type === 'resume'
      ? resolveResumeDragOrganization(event, dragResumeIdsRef.current)
      : (
          baseOrganization && rootDestination
            ? applyRootPointerDestination(baseOrganization, draggedItem, [], rootDestination)
            : dragOrganizationRef.current
        );
    dragOrganizationRef.current = finalOrganization;
    const finalResumePlacement = draggedItem?.type === 'resume' && finalOrganization
      ? getOrganizationResumePlacement(finalOrganization, draggedItem.id)
      : null;
    let destinationFolderId = '';
    if (draggedItem?.type === 'resume') {
      if (openFolderDestination?.type === 'folder') {
        destinationFolderId = openFolderDestination.folderId;
      } else if (rootDestination?.type === 'closed-folder') {
        destinationFolderId = rootDestination.folderId;
      } else if (finalResumePlacement?.containerId !== 'root') {
        destinationFolderId = finalResumePlacement?.containerId || '';
      } else if (overItem?.type === 'folder') {
        destinationFolderId = overItem.id;
      } else if (
        overItem?.type === 'container'
        && overItem.id !== 'root'
        && overItem.id !== ROOT_RELEASE_CONTAINER_ID
      ) {
        destinationFolderId = overItem.id;
      }
    }
    const baseStillCurrent = Boolean(
      baseOrganization
      && workspaceOrganizationsEqual(organization, baseOrganization),
    );
    const changed = Boolean(
      hasValidDestination
      && finalOrganization
      && baseStillCurrent
      && !workspaceOrganizationsEqual(finalOrganization, organization),
    );

    if (changed) {
      onSetResumeOrganization(finalOrganization, 'organize-resumes');
      setOpenFolderIds(() => {
        const next = new Set(dragOpenFolderIdsRef.current);
        if (destinationFolderId) next.add(destinationFolderId);
        return next;
      });
      clearSelection();
    }
    resetDragState({ restoreOpenFolders: !changed || !hasValidDestination || !baseStillCurrent });
  }

  function handleDragCancel() {
    resetDragState({ restoreOpenFolders: true });
  }

  function openDeleteDialog() {
    if (selectionCount === 0 || wouldDeleteEveryResume) {
      return;
    }
    deleteDialogTriggerRef.current = document.activeElement;
    setDeleteDialogOpen(true);
  }

  function closeDeleteDialog() {
    setDeleteDialogOpen(false);
    setIsDeleting(false);
    window.requestAnimationFrame(() => deleteDialogTriggerRef.current?.focus?.());
  }

  async function confirmDeleteSelection() {
    setIsDeleting(true);
    const deleted = await onDeleteResume([...selectedResumeIds], [...selectedFolderIds]);
    if (deleted) {
      clearSelection();
    }
    closeDeleteDialog();
  }

  const resumeTileProps = {
    onSetActiveResume,
    onStartRename: (resume) => startRename('resume', resume),
    onRenameValueChange: setRenameValue,
    onCommitRename: commitRename,
    onCancelRename: cancelRename,
    onDuplicateResume,
    onDeleteResume,
    onMoveResumeToRoot: moveResumeToRoot,
    onToggleSelected: toggleSelection,
  };

  return (
    <section className="resumeSubbar panel" aria-label="Resume versions">
      <div className="resumeWorkspaceBar" aria-label="Resumes">
        <LayoutGroup id="resume-workspace-rail">
          <DndContext
            sensors={sensors}
            collisionDetection={getCollisionDetection}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext items={rootSortableIds} strategy={railSortingStrategy}>
              <Motion.div
                ref={setRailNode}
                className={[
                  'resumePillStrip',
                  isRootDropTarget ? 'isRootDropTarget' : '',
                ].filter(Boolean).join(' ')}
                initial={false}
                animate={{ height: railHeight }}
                transition={shouldReduceMotion ? { duration: 0 } : {
                  height: activeDragItem ? RAIL_DRAG_LAYOUT_TRANSITION : RAIL_LAYOUT_TRANSITION,
                }}
              >
                {railLayout.placements.map((placement) => {
                    const item = placement.item;
                    if (item.type === 'new') {
                      return (
                        <Motion.div
                          key="new-resume"
                          className="resumeRailCell"
                          layout="position"
                          style={{ gridRow: placement.row + 1, gridColumn: placement.column + 1 }}
                          transition={shouldReduceMotion ? { duration: 0 } : {
                            layout: activeDragItem ? RAIL_DRAG_LAYOUT_TRANSITION : RAIL_LAYOUT_TRANSITION,
                          }}
                        >
                          <button type="button" className="button buttonSecondary resumeNewButton" disabled={!canAddResume} onClick={onCreateResume}>
                            <span className="resumeNewButtonIcon" aria-hidden="true" /><span>New</span>
                          </button>
                        </Motion.div>
                      );
                    }

                    if (item.type === 'folder') {
                      const folder = visibleOrganization.folders[item.id];
                      if (!folder) return null;
                      return (
                        <FolderCluster
                          key={`folder:${folder.id}`}
                          folder={folder}
                          placement={placement}
                          isClosing={closingFolderSnapshots.has(folder.id)}
                          toneIndex={folderToneById.get(folder.id)}
                          sortableResumeIds={organization.folders[folder.id]?.resumeIds || folder.resumeIds}
                          resumeById={resumeById}
                          activeResumeId={activeResumeId}
                          selectedResumeIds={selectedResumeIds}
                          isFolderSelected={selectedFolderIds.has(folder.id)}
                          renamingResumeId={renamingItem?.type === 'resume' ? renamingItem.id : ''}
                          isRenamingFolder={renamingItem?.type === 'folder' && renamingItem.id === folder.id}
                          renameValue={renameValue}
                          canAddResume={canAddResume}
                          canDeleteActiveResume={canDeleteActiveResume}
                          resumeTileProps={resumeTileProps}
                          onToggleOpen={toggleFolder}
                          onToggleSelected={toggleSelection}
                          onStartRename={(nextFolder) => startRename('folder', nextFolder)}
                          onRenameValueChange={setRenameValue}
                          onCommitRename={commitRename}
                          onCancelRename={cancelRename}
                          onRemoveFolder={removeFolder}
                          isDropTarget={dropTargetFolderId === folder.id}
                          rootInsertPosition={rootInsertTarget.folderId === folder.id ? rootInsertTarget.position : ''}
                        />
                      );
                    }

                    const resume = resumeById.get(item.id);
                    if (!resume) return null;
                    return (
                      <ResumeTile
                        key={`resume:${resume.id}`}
                        {...resumeTileProps}
                        resume={resume}
                        containerId="root"
                        row={placement.row + 1}
                        column={placement.column}
                        isActive={resume.id === activeResumeId}
                        isSelected={selectedResumeIds.has(resume.id)}
                        isRenaming={renamingItem?.type === 'resume' && renamingItem.id === resume.id}
                        renameValue={renameValue}
                        canAddResume={canAddResume}
                        canDeleteActiveResume={canDeleteActiveResume}
                      />
                    );
                })}
                {[...closingFolderSnapshots.values()].map((snapshot) => (
                  <ClosingFolderLayer
                    key={`closing-folder:${snapshot.folderId}`}
                    folderId={snapshot.folderId}
                    placement={snapshot.placement}
                    toneIndex={snapshot.toneIndex}
                    resumeById={resumeById}
                    activeResumeId={activeResumeId}
                  />
                ))}
              </Motion.div>
            </SortableContext>
            <RootReleaseDropZone isVisible={showRootReleaseZone} />
            {typeof document !== 'undefined' ? createPortal(
              <DragOverlay adjustScale={false} zIndex={1000}>
                <DragPreview
                  activeItem={activeDragItem}
                  resumeById={resumeById}
                  organization={visibleOrganization}
                  folderToneById={folderToneById}
                  groupCount={dragResumeIds.length}
                  activeResumeId={activeResumeId}
                />
              </DragOverlay>,
              document.body,
            ) : null}
          </DndContext>
        </LayoutGroup>
      </div>

      <div className={`resumeSelectionFooter${selectionCount ? ' isVisible' : ''}`} aria-hidden={!selectionCount}>
        <div className="resumeSelectionFooterClip">
          <div className="resumeSelectionToolbar">
            <span className="resumeSelectionCount">
              <span className="resumeSelectionCountDot" aria-hidden="true" />
              {selectionCount} selected
            </span>
            <div className="resumeSelectionActions">
              <button
                type="button"
                className="button buttonSecondary resumeSelectionFolder"
                onClick={createFolderFromSelection}
                disabled={!selectedResumeIds.size || isCreatingFolder || isAtFolderLimit}
                tabIndex={selectionCount ? 0 : -1}
                title={isAtFolderLimit ? `A workspace can contain up to ${MAX_WORKSPACE_FOLDERS} folders.` : ''}
              >
                <FolderAddIcon />
                Add to new folder
              </button>
              <button
                type="button"
                className="button buttonDanger resumeSelectionDelete"
                onClick={openDeleteDialog}
                disabled={!selectionCount || wouldDeleteEveryResume}
                tabIndex={selectionCount ? 0 : -1}
                title={wouldDeleteEveryResume ? 'Keep at least one resume. Deselect one to continue.' : 'Remove selected items'}
              >
                <DeleteIcon />
                Delete
              </button>
              <button type="button" className="button buttonSecondary resumeSelectionClear" onClick={clearSelection} disabled={!selectionCount} tabIndex={selectionCount ? 0 : -1}>
                Clear
              </button>
            </div>
          </div>
        </div>
      </div>
      <span className="visuallyHidden" aria-live="polite" aria-atomic="true">
        {selectionCount ? `${selectionCount} workspace ${selectionCount === 1 ? 'item' : 'items'} selected` : 'Workspace selection cleared'}
      </span>
      {deleteDialogOpen ? (
        <BatchDeleteDialog
          resumeCount={selectedResumeIds.size}
          folderCount={selectedFolderIds.size}
          isDeleting={isDeleting}
          isSignedIn={Boolean(authUser)}
          onCancel={closeDeleteDialog}
          onConfirm={confirmDeleteSelection}
        />
      ) : null}
    </section>
  );
}
