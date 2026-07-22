import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  closestCenter,
  DndContext,
  DragOverlay,
  pointerWithin,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { LayoutGroup, motion as Motion, useReducedMotion } from 'motion/react';
import {
  MAX_WORKSPACE_FOLDERS,
  WORKSPACE_OPEN_FOLDERS_STORAGE_KEY,
  createNextWorkspaceFolderName,
} from '../lib/workspace.js';
import { ResumeLoomrKeyboardSensor, ResumeLoomrPointerSensor } from '../lib/sortableSensors.js';
import {
  buildResumeRailLayout,
  createResumeBundleDragPreview,
  createWorkspaceItemId,
  getFolderResumeDropIntent,
  getOrganizationResumePlacement,
  getOrganizationVisualResumeIds,
  isResumeBundleSourcePlaceholder,
  moveOrganizationResumeBundle,
  moveOrganizationRootItem,
  parseWorkspaceItemId,
  isPointerWithinFolderPlacementSurface,
  workspaceOrganizationsEqual,
} from '../lib/workspaceOrganization.js';

import {
  FOLDER_AUTO_CLOSE_DELAY_MS,
  FOLDER_AUTO_OPEN_DELAY_MS,
  RAIL_DRAG_LAYOUT_TRANSITION,
  RAIL_LAYOUT_TRANSITION,
  RAIL_PADDING_BLOCK_PX,
  RAIL_ROW_GAP_PX,
  RAIL_ROW_HEIGHT_PX,
  ROOT_RELEASE_CONTAINER_ID,
  getFolderCloseDurationMs,
  loadOpenFolderIds,
  railSortingStrategy,
  setRootInsertTargetIfChanged,
} from './resumeWorkspaceRailSupport.js';
import {
  applyOpenFolderPointerDestination,
  applyRootPointerDestination,
  chooseResumePointerDestination,
  getOpenFolderPointerDestination as resolveOpenFolderPointerDestination,
  getRailGridMetrics,
  getRootPointerDestination as resolveRootPointerDestination,
  isPointerAfterItem,
} from './resumeWorkspaceRailDrag.js';
import {
  BatchDeleteDialog,
  ClosingFolderLayer,
  DeleteIcon,
  DragPreview,
  FolderAddIcon,
  FolderCluster,
  ResumeBundleSourcePlaceholder,
  ResumeTile,
  RootReleaseDropZone,
} from './resumeWorkspaceRailView.jsx';
import { useWorkspaceRailRename } from './useWorkspaceRailRename.js';
import { useWorkspaceRailLayout } from './useWorkspaceRailLayout.js';

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
  workspaceReady,
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
  const dragOpenFolderIdsRef = useRef(new Set());
  const activeDragItemRef = useRef(null);
  const dragResumeIdsRef = useRef([]);
  const dragOrganizationRef = useRef(null);
  const dragVisualOrganizationRef = useRef(null);
  const dragBaseOrganizationRef = useRef(null);
  const dragCollisionRectsRef = useRef(new Map());
  const dragPointerCoordinatesRef = useRef(null);
  const dragRenderFrameRef = useRef(null);
  const dragLayoutRectsRef = useRef(null);
  const dragLayoutAnimationsRef = useRef(new Map());
  const isDropLayoutSettlingRef = useRef(false);
  const pendingDragOrganizationRef = useRef(null);
  const activeResumePlacementKeyRef = useRef('');
  const [openFolderIds, setOpenFolderIds] = useState(loadOpenFolderIds);
  const [closingFolderSnapshots, setClosingFolderSnapshots] = useState(new Map());
  const [selectionKeys, setSelectionKeys] = useState(new Set());
  const [activeDragItem, setActiveDragItem] = useState(null);
  const [dragResumeIds, setDragResumeIds] = useState([]);
  const [isDragOutsideRail, setIsDragOutsideRail] = useState(false);
  const [dragOrganization, setDragOrganization] = useState(null);
  const [dropTargetFolderId, setDropTargetFolderId] = useState('');
  const [rootInsertTarget, setRootInsertTarget] = useState({ folderId: '', position: '' });
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const {
    columns,
    motionReady,
  } = useWorkspaceRailLayout({ railRef, workspaceReady });
  const {
    cancelRename,
    commitRename,
    renameValue,
    renamingItem,
    setRenameValue,
    startRename,
  } = useWorkspaceRailRename({
    onRenameResume,
    onRenameResumeFolder,
  });
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
    if (!workspaceReady) {
      return;
    }

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
  }, [validFolderIds, validSelectionKeys, workspaceReady]);

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
    document.documentElement.classList.toggle('isWorkspaceDropInvalid', isDragOutsideRail);
    return () => document.documentElement.classList.remove('isWorkspaceDropInvalid');
  }, [isDragOutsideRail]);

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
    if (!workspaceReady) {
      return;
    }

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
  }, [activeResumeId, organization, workspaceReady]);

  useEffect(() => {
    if (!workspaceReady) {
      return;
    }

    try {
      window.localStorage.setItem(
        WORKSPACE_OPEN_FOLDERS_STORAGE_KEY,
        JSON.stringify([...openFolderIds].filter((folderId) => validFolderIds.has(folderId)).slice(-100)),
      );
    } catch {
      // Folder state is a local preference; organization remains persisted in the workspace.
    }
  }, [openFolderIds, validFolderIds, workspaceReady]);

  useEffect(() => () => {
    window.clearTimeout(folderHoverTimerRef.current);
    window.cancelAnimationFrame(dragRenderFrameRef.current);
    autoFolderCloseTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    autoFolderCloseTimersRef.current.clear();
    folderCloseTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    folderCloseTimersRef.current.clear();
    dragLayoutAnimationsRef.current.forEach((animation) => animation.cancel());
    dragLayoutAnimationsRef.current.clear();
  }, []);

  useLayoutEffect(() => {
    const previousRects = dragLayoutRectsRef.current;
    dragLayoutRectsRef.current = null;
    const isDropLayoutSettling = isDropLayoutSettlingRef.current;
    isDropLayoutSettlingRef.current = false;

    if (
      (!activeDragItemRef.current && !isDropLayoutSettling)
      || !previousRects
      || shouldReduceMotion
    ) {
      return;
    }

    railRef.current?.querySelectorAll('[data-rail-motion-key]').forEach((node) => {
      const key = node.dataset.railMotionKey;
      const previousRect = previousRects.get(key);
      if (!previousRect || typeof node.animate !== 'function') return;

      dragLayoutAnimationsRef.current.get(key)?.cancel();
      dragLayoutAnimationsRef.current.delete(key);
      const nextRect = node.getBoundingClientRect();
      const deltaX = previousRect.left - nextRect.left;
      const deltaY = previousRect.top - nextRect.top;

      if (Math.abs(deltaX) < 0.5 && Math.abs(deltaY) < 0.5) return;

      const animation = node.animate([
        { transform: `translate(${deltaX}px, ${deltaY}px)` },
        { transform: 'translate(0, 0)' },
      ], {
        duration: 190,
        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
      });
      dragLayoutAnimationsRef.current.set(key, animation);
      animation.finished.catch(() => {}).finally(() => {
        if (dragLayoutAnimationsRef.current.get(key) === animation) {
          dragLayoutAnimationsRef.current.delete(key);
        }
      });
    });
  }, [dragOrganization, shouldReduceMotion]);

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
        startRename('folder', { id: folderId, name: folderName });
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

  function queueDragVisualOrganization(nextOrganization) {
    if (
      dragVisualOrganizationRef.current
      && workspaceOrganizationsEqual(nextOrganization, dragVisualOrganizationRef.current)
    ) return;

    dragVisualOrganizationRef.current = nextOrganization;
    pendingDragOrganizationRef.current = nextOrganization;

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

      dragLayoutRectsRef.current = captureRailLayoutRects();

      setDragOrganization((renderedOrganization) => (
        renderedOrganization
        && workspaceOrganizationsEqual(renderedOrganization, pendingOrganization)
          ? renderedOrganization
          : pendingOrganization
      ));
    });
  }

  function captureRailLayoutRects() {
    return new Map(
      [...(railRef.current?.querySelectorAll('[data-rail-motion-key]') || [])].map((node) => [
        node.dataset.railMotionKey,
        node.getBoundingClientRect(),
      ]),
    );
  }

  function updateDragOrganization(updater) {
    const base = dragBaseOrganizationRef.current;
    if (!dragVisualOrganizationRef.current || !base) return;

    const next = updater(base);
    const activeItem = activeDragItemRef.current;
    const previewOrganization = activeItem?.type === 'resume' && dragResumeIdsRef.current.length > 1
      ? createResumeBundleDragPreview(
          base,
          next,
          dragResumeIdsRef.current,
          activeItem.id,
        )
      : next;

    dragOrganizationRef.current = next;
    queueDragVisualOrganization(previewOrganization);
  }

  function pointerIsInsideRailDropArea(pointer) {
    if (!pointer) return true;

    const dropNodes = [
      railRef.current,
      document.querySelector('.resumeRootReleaseTarget'),
    ].filter(Boolean);

    return dropNodes.some((node) => {
      const rect = node.getBoundingClientRect();
      return pointer.x >= rect.left - RAIL_ROW_GAP_PX / 2
        && pointer.x <= rect.right + RAIL_ROW_GAP_PX / 2
        && pointer.y >= rect.top - RAIL_ROW_GAP_PX / 2
        && pointer.y <= rect.bottom + RAIL_ROW_GAP_PX / 2;
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
    // Keep the grabbed node in its real source cell until DragOverlay captures its origin.
    const initialPreviewOrganization = organization;
    dragVisualOrganizationRef.current = initialPreviewOrganization;
    dragBaseOrganizationRef.current = organization;
    dragCollisionRectsRef.current = new Map();
    setActiveDragItem(item);
    setDragOrganization(initialPreviewOrganization);
    setDragResumeIds(nextDragResumeIds);
    setIsDragOutsideRail(false);
    setDropTargetFolderId('');
    setRootInsertTargetIfChanged(setRootInsertTarget);
    dragOpenFolderIdsRef.current = new Set(openFolderIds);
  }

  function getAfterPosition(event) {
    const overId = String(event.over?.id || '');
    const pointer = dragPointerCoordinatesRef.current;
    const overRect = dragCollisionRectsRef.current.get(overId) || event.over?.rect;
    return isPointerAfterItem(pointer, overRect);
  }

  function getFinalRailGridMetrics() {
    return getRailGridMetrics(railRef.current?.getBoundingClientRect?.(), columns);
  }

  function getRootPointerDestination(pointer = dragPointerCoordinatesRef.current) {
    const preserveSourceSlots = dragResumeIdsRef.current.length > 1;
    const rootLayoutOpenFolderIds = activeDragItemRef.current
      ? dragOpenFolderIdsRef.current
      : openFolderIds;
    return resolveRootPointerDestination({
      pointer,
      baseOrganization: dragBaseOrganizationRef.current,
      draggedItem: activeDragItemRef.current,
      draggedResumeIds: dragResumeIdsRef.current,
      openFolderIds: rootLayoutOpenFolderIds,
      columns,
      metrics: getFinalRailGridMetrics(),
      preserveSourceSlots,
    });
  }

  function getOpenFolderPointerDestination(pointer = dragPointerCoordinatesRef.current) {
    const preserveSourceSlots = dragResumeIdsRef.current.length > 1;
    return resolveOpenFolderPointerDestination({
      pointer,
      baseOrganization: dragBaseOrganizationRef.current,
      currentOrganization: dragVisualOrganizationRef.current || organization,
      draggedResumeIds: dragResumeIdsRef.current,
      openFolderIds,
      columns,
      metrics: getFinalRailGridMetrics(),
      preserveSourceSlots,
      activeResumeId: activeDragItemRef.current?.id || '',
    });
  }

  function getResumePointerDestinations(pointer = dragPointerCoordinatesRef.current) {
    return chooseResumePointerDestination(
      getRootPointerDestination(pointer),
      getOpenFolderPointerDestination(pointer),
    );
  }

  function resolveResumeDragOrganization(
    event,
    draggedResumeIds,
    destinations = getResumePointerDestinations(),
  ) {
    const baseOrganization = dragBaseOrganizationRef.current;
    if (!baseOrganization) return dragOrganizationRef.current;

    const { openFolderDestination, rootDestination } = destinations;
    if (openFolderDestination) {
      return applyOpenFolderPointerDestination(baseOrganization, draggedResumeIds, openFolderDestination);
    }

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
      dragVisualOrganizationRef.current || organization,
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

    if (!pointerIsInsideRailDropArea(dragPointerCoordinatesRef.current)) {
      window.clearTimeout(folderHoverTimerRef.current);
      updateAutoFolderHover('');
      setDropTargetFolderId('');
      setRootInsertTargetIfChanged(setRootInsertTarget);
      setIsDragOutsideRail(true);

      const baseOrganization = dragBaseOrganizationRef.current;
      const sourcePreview = draggedItem.type === 'resume' && draggedResumeIds.length > 1
        ? createResumeBundleDragPreview(
            baseOrganization,
            baseOrganization,
            draggedResumeIds,
            draggedItem.id,
          )
        : baseOrganization;
      queueDragVisualOrganization(sourcePreview);
      return;
    }

    setIsDragOutsideRail(false);

    const resumePointerDestinations = draggedItem.type === 'resume'
      ? getResumePointerDestinations()
      : null;
    if (draggedItem.type === 'resume') {
      const { openFolderDestination } = resumePointerDestinations;
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

    const rootDestination = resumePointerDestinations?.rootDestination
      || (draggedItem.type === 'folder' ? getRootPointerDestination() : null);
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

  function resetDragState({ restoreOpenFolders = false, settleLayout = false } = {}) {
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
    dragVisualOrganizationRef.current = null;
    dragBaseOrganizationRef.current = null;
    dragCollisionRectsRef.current = new Map();
    dragPointerCoordinatesRef.current = null;
    if (!settleLayout) {
      dragLayoutRectsRef.current = null;
      isDropLayoutSettlingRef.current = false;
    }
    dragLayoutAnimationsRef.current.forEach((animation) => animation.cancel());
    dragLayoutAnimationsRef.current.clear();
    setActiveDragItem(null);
    setDragResumeIds([]);
    setIsDragOutsideRail(false);
    setDragOrganization(null);
    setDropTargetFolderId('');
    setRootInsertTargetIfChanged(setRootInsertTarget);
  }

  function handleDragEnd(event) {
    window.clearTimeout(folderHoverTimerRef.current);
    const overItem = event.over ? parseWorkspaceItemId(event.over.id) : null;
    const baseOrganization = dragBaseOrganizationRef.current;
    const draggedItem = activeDragItemRef.current;
    const droppedOutside = !pointerIsInsideRailDropArea(dragPointerCoordinatesRef.current);
    const resumePointerDestinations = !droppedOutside && draggedItem?.type === 'resume'
      ? getResumePointerDestinations()
      : { openFolderDestination: null, rootDestination: null };
    const openFolderDestination = resumePointerDestinations.openFolderDestination;
    const rootDestination = droppedOutside || openFolderDestination
      ? null
      : (resumePointerDestinations.rootDestination || getRootPointerDestination());
    const hasValidDestination = !droppedOutside && Boolean(openFolderDestination || rootDestination || event.over);
    const finalOrganization = droppedOutside
      ? baseOrganization
      : (draggedItem?.type === 'resume'
      ? resolveResumeDragOrganization(
          event,
          dragResumeIdsRef.current,
          resumePointerDestinations,
        )
      : (
          baseOrganization && rootDestination
            ? applyRootPointerDestination(baseOrganization, draggedItem, [], rootDestination)
            : dragOrganizationRef.current
        ));
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
      } else if (rootDestination?.type === 'root') {
        destinationFolderId = '';
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
      dragLayoutRectsRef.current = captureRailLayoutRects();
      isDropLayoutSettlingRef.current = true;
      onSetResumeOrganization(finalOrganization, 'organize-resumes');
      setOpenFolderIds(() => {
        const next = new Set(dragOpenFolderIdsRef.current);
        if (destinationFolderId) next.add(destinationFolderId);
        return next;
      });
      clearSelection();
    }
    resetDragState({
      restoreOpenFolders: !changed || !hasValidDestination || !baseStillCurrent,
      settleLayout: changed,
    });
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
    motionReady,
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
                transition={shouldReduceMotion || !motionReady ? { duration: 0 } : {
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
                          data-rail-motion-key="new"
                          layout={motionReady && !activeDragItem ? 'position' : false}
                          style={{ gridRow: placement.row + 1, gridColumn: placement.column + 1 }}
                          transition={shouldReduceMotion || !motionReady ? { duration: 0 } : {
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
                          motionReady={motionReady}
                        />
                      );
                    }

                    const resume = resumeById.get(item.id);
                    if (!resume) {
                      return isResumeBundleSourcePlaceholder(item.id) ? (
                        <ResumeBundleSourcePlaceholder
                          key={`source:${item.id}`}
                          id={item.id}
                          row={placement.row + 1}
                          column={placement.column}
                          motionReady={motionReady}
                        />
                      ) : null;
                    }
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
                  isDropInvalid={isDragOutsideRail}
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
            <div className="resumeSelectionPrimary">
              <span className="resumeSelectionCount">
                <span className="resumeSelectionCountDot" aria-hidden="true" />
                {selectionCount} selected
              </span>
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
            </div>
            <div className="resumeSelectionActions">
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
