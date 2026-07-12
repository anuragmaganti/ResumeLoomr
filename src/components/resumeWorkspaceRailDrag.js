import {
  buildResumeRailLayout,
  createResumeBundleSourcePreview,
  getFolderPlacementCellRect,
  getFolderResumeDropIntent,
  getFolderResumeInsertionIndex,
  isResumeBundleSourcePlaceholder,
  isPointerWithinFolderPlacementSurface,
  moveOrganizationResumeBundle,
  moveOrganizationRootItemToIndex,
  RESUME_RAIL_INSERT_AFTER_RATIO,
} from '../lib/workspaceOrganization.js';
import {
  RAIL_PADDING_BLOCK_PX,
  RAIL_ROW_GAP_PX,
  RAIL_ROW_HEIGHT_PX,
  pointIsWithinRect,
} from './resumeWorkspaceRailSupport.js';

export function isPointerAfterItem(pointer, rect) {
  if (!pointer || !rect) return false;

  const afterThresholdX = rect.left + rect.width * RESUME_RAIL_INSERT_AFTER_RATIO;
  const centerY = rect.top + rect.height / 2;
  const rowThreshold = rect.height * 0.45;

  return Math.abs(pointer.y - centerY) > rowThreshold
    ? pointer.y > centerY
    : pointer.x > afterThresholdX;
}

export function getRailGridMetrics(railRect, columns) {
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

function getRailCellRect(metrics, row, column) {
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

function getFolderRootEdgeIntent(pointer, rect) {
  if (!pointer || !rect) return '';

  const gapInset = RAIL_ROW_GAP_PX / 2;
  const isInTileRow = (
    pointer.y >= rect.top - gapInset
    && pointer.y <= rect.bottom + gapInset
  );
  const isNearTile = (
    pointer.x >= rect.left - gapInset
    && pointer.x <= rect.right + gapInset
  );
  if (!isInTileRow || !isNearTile) return '';

  const intent = getFolderResumeDropIntent(pointer, rect);
  return intent === 'inside' ? '' : intent;
}

function getFolderPlacementRect(metrics, placement) {
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

function organizationWithoutDraggedItems(baseOrganization, draggedItem, draggedResumeIds) {
  const draggedResumeSet = new Set(draggedResumeIds);
  const rootItems = baseOrganization.rootItems.filter((item) => (
    !(draggedItem.type === 'folder' && item.type === 'folder' && item.id === draggedItem.id)
    && !(item.type === 'resume' && draggedResumeSet.has(item.id))
  ));

  return {
    ...baseOrganization,
    rootItems,
    folders: Object.fromEntries(Object.entries(baseOrganization.folders).map(([folderId, folder]) => [
      folderId,
      {
        ...folder,
        resumeIds: folder.resumeIds.filter((resumeId) => !draggedResumeSet.has(resumeId)),
      },
    ])),
  };
}

export function getRootPointerDestination({
  pointer,
  baseOrganization,
  draggedItem,
  draggedResumeIds,
  openFolderIds,
  columns,
  metrics,
  preserveSourceSlots = false,
}) {
  if (!pointer || !baseOrganization || !draggedItem || !metrics) return null;

  const targetOrganization = preserveSourceSlots && draggedItem.type === 'resume'
    ? createResumeBundleSourcePreview(baseOrganization, draggedResumeIds, draggedItem.id)
    : organizationWithoutDraggedItems(baseOrganization, draggedItem, draggedResumeIds);
  const targetLayout = buildResumeRailLayout({
    ...targetOrganization,
    rootItems: [...targetOrganization.rootItems, { type: 'new', id: 'new' }],
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

  const draggedResumeSet = new Set(draggedResumeIds);
  const rootPlacements = targetLayout.placements
    .map((placement, index) => ({ placement, index }))
    .filter(({ placement }) => (
      preserveSourceSlots
      || placement.item.type !== 'resume'
      || (
        !draggedResumeSet.has(placement.item.id)
        && !isResumeBundleSourcePlaceholder(placement.item.id)
      )
    ));
  if (rootPlacements.length === 0) {
    return {
      type: 'root',
      insertionIndex: 0,
      targetItem: null,
      position: 'before',
      preserveSourceSlots,
    };
  }

  let nearest = null;
  rootPlacements.forEach(({ placement, index }) => {
    const tile = placement.tile || { row: 0, column: placement.column };
    const rect = getRailCellRect(metrics, placement.row + tile.row, tile.column);
    const dx = Math.max(rect.left - pointer.x, 0, pointer.x - rect.right);
    const dy = Math.max(rect.top - pointer.y, 0, pointer.y - rect.bottom);
    const centerDx = pointer.x - (rect.left + rect.width / 2);
    const centerDy = pointer.y - (rect.top + rect.height / 2);
    const score = dx * dx + dy * dy;
    const centerScore = centerDx * centerDx + centerDy * centerDy;

    const containsPointer = pointIsWithinRect(pointer, rect);
    if (
      !nearest
      || (containsPointer && !nearest.containsPointer)
      || (
        containsPointer === nearest.containsPointer
        && (score < nearest.score || (score === nearest.score && centerScore < nearest.centerScore))
      )
    ) {
      nearest = { index, placement, rect, score, centerScore, containsPointer };
    }
  });

  const targetItem = nearest.placement.item;
  if (targetItem.type === 'new') {
    const finalIndex = targetOrganization.rootItems.length;
    const lastRootItem = targetOrganization.rootItems.at(-1) || null;

    return {
      type: 'root',
      insertionIndex: finalIndex,
      targetItem: lastRootItem,
      position: 'after',
      preserveSourceSlots,
    };
  }

  if (draggedItem.type === 'resume' && targetItem.type === 'folder') {
    const folderEdgeIntent = getFolderRootEdgeIntent(pointer, nearest.rect);
    if (folderEdgeIntent) {
      return {
        type: 'root',
        insertionIndex: nearest.index + (folderEdgeIntent === 'after' ? 1 : 0),
        targetItem,
        position: folderEdgeIntent,
        folderEdgeIntent,
        preserveSourceSlots,
      };
    }

    if (
      !openFolderIds.has(targetItem.id)
      && pointIsWithinRect(pointer, nearest.rect)
    ) {
      return { type: 'closed-folder', folderId: targetItem.id };
    }
  }

  return {
    type: 'root',
    insertionIndex: nearest.index,
    targetItem,
    position: 'before',
    preserveSourceSlots,
  };
}

export function chooseResumePointerDestination(rootDestination, openFolderDestination) {
  if (rootDestination?.folderEdgeIntent) {
    return { rootDestination, openFolderDestination: null };
  }

  if (openFolderDestination) {
    return { rootDestination: null, openFolderDestination };
  }

  return { rootDestination, openFolderDestination: null };
}

export function applyRootPointerDestination(baseOrganization, draggedItem, draggedResumeIds, destination) {
  if (destination.type === 'closed-folder') {
    return moveOrganizationResumeBundle(baseOrganization, draggedResumeIds, {
      containerId: destination.folderId,
    });
  }

  const draggedResumeSet = new Set(draggedResumeIds);
  const cleanRootIndex = destination.preserveSourceSlots
    ? baseOrganization.rootItems
        .slice(0, destination.insertionIndex)
        .filter((item) => item.type !== 'resume' || !draggedResumeSet.has(item.id))
        .length
    : destination.insertionIndex;

  return draggedItem.type === 'folder'
    ? moveOrganizationRootItemToIndex(baseOrganization, draggedItem, destination.insertionIndex)
    : moveOrganizationResumeBundle(baseOrganization, draggedResumeIds, {
      containerId: 'root',
      rootIndex: cleanRootIndex,
    });
}

export function getOpenFolderPointerDestination({
  pointer,
  baseOrganization,
  currentOrganization,
  draggedResumeIds,
  openFolderIds,
  columns,
  metrics,
  preserveSourceSlots = false,
  activeResumeId = '',
}) {
  if (!pointer || !baseOrganization || !metrics) return null;

  const hitTestOrganization = preserveSourceSlots
    ? createResumeBundleSourcePreview(baseOrganization, draggedResumeIds, activeResumeId)
    : currentOrganization;
  const currentRailLayout = buildResumeRailLayout({
    ...hitTestOrganization,
    rootItems: [...hitTestOrganization.rootItems, { type: 'new', id: 'new' }],
  }, openFolderIds, columns);

  for (const placement of currentRailLayout.placements) {
    if (!placement.isOpen || !placement.folderId) continue;

    const rect = getFolderPlacementRect(metrics, placement);
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

    const draggedSet = new Set(draggedResumeIds);
    const targetCount = preserveSourceSlots
      ? (hitTestOrganization.folders[placement.folderId]?.resumeIds || []).length
      : (baseOrganization.folders[placement.folderId]?.resumeIds || [])
          .filter((resumeId) => !draggedSet.has(resumeId))
          .length;
    const insertionIndex = pointIsWithinRect(pointer, tileRect)
      ? targetCount
      : getFolderResumeInsertionIndex(pointer, rect, placement, targetCount);

    return {
      type: 'folder',
      folderId: placement.folderId,
      insertionIndex: insertionIndex ?? targetCount,
      preserveSourceSlots,
    };
  }

  return null;
}

export function applyOpenFolderPointerDestination(
  baseOrganization,
  draggedResumeIds,
  destination,
) {
  if (destination.type !== 'folder') {
    return moveOrganizationResumeBundle(baseOrganization, draggedResumeIds, {
      containerId: 'root',
      overRootItem: { type: 'folder', id: destination.folderId },
      after: destination.position === 'after',
    });
  }

  const draggedSet = new Set(draggedResumeIds);
  const targetResumeIds = (baseOrganization.folders[destination.folderId]?.resumeIds || [])
    .filter((resumeId) => !draggedSet.has(resumeId));
  const visualInsertionIndex = Math.max(
    0,
    Math.min(targetResumeIds.length, destination.insertionIndex),
  );
  const insertionIndex = destination.preserveSourceSlots
    ? (baseOrganization.folders[destination.folderId]?.resumeIds || [])
        .slice(0, destination.insertionIndex)
        .filter((resumeId) => !draggedSet.has(resumeId))
        .length
    : visualInsertionIndex;

  return moveOrganizationResumeBundle(baseOrganization, draggedResumeIds, {
    containerId: destination.folderId,
    ...(insertionIndex < targetResumeIds.length ? {
      overResumeId: targetResumeIds[insertionIndex],
    } : {}),
  });
}
