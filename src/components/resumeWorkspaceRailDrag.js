import {
  buildResumeRailLayout,
  getFolderPlacementCellRect,
  getFolderResumeDropIntent,
  getFolderResumeInsertionIndex,
  isPointerWithinFolderPlacementSurface,
  moveOrganizationResumeBundle,
  moveOrganizationRootItemToIndex,
} from '../lib/workspaceOrganization.js';
import {
  RAIL_PADDING_BLOCK_PX,
  RAIL_ROW_GAP_PX,
  RAIL_ROW_HEIGHT_PX,
  pointIsWithinRect,
} from './resumeWorkspaceRailSupport.js';

export function isPointerAfterItem(pointer, rect) {
  if (!pointer || !rect) return false;

  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const rowThreshold = rect.height * 0.45;

  return Math.abs(pointer.y - centerY) > rowThreshold
    ? pointer.y > centerY
    : pointer.x > centerX;
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
}) {
  if (!pointer || !baseOrganization || !draggedItem || !metrics) return null;

  const targetOrganization = organizationWithoutDraggedItems(
    baseOrganization,
    draggedItem,
    draggedResumeIds,
  );
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

  const rootPlacements = targetLayout.placements.filter((placement) => placement.item.type !== 'new');
  if (rootPlacements.length === 0) {
    return { type: 'root', insertionIndex: 0, targetItem: null, position: 'before' };
  }

  let nearest = null;
  rootPlacements.forEach((placement, index) => {
    const tile = placement.tile || { row: 0, column: placement.column };
    const rect = getRailCellRect(metrics, placement.row + tile.row, tile.column);
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

export function applyRootPointerDestination(baseOrganization, draggedItem, draggedResumeIds, destination) {
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

export function getOpenFolderPointerDestination({
  pointer,
  baseOrganization,
  currentOrganization,
  draggedResumeIds,
  openFolderIds,
  columns,
  metrics,
}) {
  if (!pointer || !baseOrganization || !metrics) return null;

  const currentRailLayout = buildResumeRailLayout({
    ...currentOrganization,
    rootItems: [...currentOrganization.rootItems, { type: 'new', id: 'new' }],
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
  const insertionIndex = Math.max(
    0,
    Math.min(targetResumeIds.length, destination.insertionIndex),
  );

  return moveOrganizationResumeBundle(baseOrganization, draggedResumeIds, {
    containerId: destination.folderId,
    ...(insertionIndex < targetResumeIds.length ? {
      overResumeId: targetResumeIds[insertionIndex],
    } : {}),
  });
}
