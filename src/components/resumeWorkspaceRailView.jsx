import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useDndContext, useDroppable } from '@dnd-kit/core';
import { SortableContext, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AnimatePresence, motion as Motion, useReducedMotion } from 'motion/react';
import {
  MAX_WORKSPACE_FOLDER_NAME_LENGTH,
  MAX_WORKSPACE_RESUME_NAME_LENGTH,
} from '../lib/resume.js';
import { createWorkspaceItemId } from '../lib/workspaceOrganization.js';
import EntryActionMenu from './forms/entryActionMenu';
import {
  FOLDER_MOTION_TRANSITION,
  MOTION_EASE,
  RAIL_DRAG_LAYOUT_TRANSITION,
  RAIL_LAYOUT_TRANSITION,
  ROOT_RELEASE_CONTAINER_ID,
  disableSortableLayoutAnimation,
  getFolderItemOrigin,
  getFolderItemStaggerSeconds,
  getFolderToneClass,
  railSortingStrategy,
} from './resumeWorkspaceRailSupport.js';

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

export function DeleteIcon() {
  return (
    <svg className="resumeSelectionDeleteIcon" aria-hidden="true" viewBox="0 0 18 18" focusable="false">
      <path d="M3.75 5.25h10.5M7 5.25V3.5h4v1.75M5.25 5.25l.6 9.25h6.3l.6-9.25M7.4 7.5v4.75M10.6 7.5v4.75" />
    </svg>
  );
}

export function FolderAddIcon() {
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

export function BatchDeleteDialog({ resumeCount, folderCount, isDeleting, isSignedIn, onCancel, onConfirm }) {
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

export function ResumeTile({
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

export function FolderCluster({
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

export function ClosingFolderLayer({ folderId, placement, toneIndex, resumeById, activeResumeId }) {
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

export function DragPreview({ activeItem, resumeById, organization, folderToneById, groupCount, activeResumeId }) {
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

export function RootReleaseDropZone({ isVisible }) {
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
