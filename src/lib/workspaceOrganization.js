import { stableJson } from './stableJson.js';

export const RESUME_RAIL_INSERT_AFTER_RATIO = 0.68;

function cloneOrganization(organization) {
  return {
    ...organization,
    rootItems: organization.rootItems.map((item) => ({ ...item })),
    folders: Object.fromEntries(Object.entries(organization.folders).map(([folderId, folder]) => [folderId, {
      ...folder,
      resumeIds: [...folder.resumeIds],
    }])),
    removedFolderIds: [...organization.removedFolderIds],
  };
}

export function createWorkspaceItemId(type, id) {
  return `${type}:${id}`;
}

export function parseWorkspaceItemId(value) {
  const text = String(value || '');
  const separatorIndex = text.indexOf(':');

  if (separatorIndex < 0) {
    return { type: '', id: '' };
  }

  return {
    type: text.slice(0, separatorIndex),
    id: text.slice(separatorIndex + 1),
  };
}

export function getOrganizationVisualResumeIds(organization) {
  return organization.rootItems.flatMap((item) => (
    item.type === 'resume' ? [item.id] : organization.folders[item.id]?.resumeIds || []
  ));
}

export function getOrganizationResumePlacement(organization, resumeId) {
  for (const [folderId, folder] of Object.entries(organization.folders)) {
    const index = folder.resumeIds.indexOf(resumeId);

    if (index >= 0) {
      return { containerId: folderId, index };
    }
  }

  const index = organization.rootItems.findIndex((item) => item.type === 'resume' && item.id === resumeId);
  return index >= 0 ? { containerId: 'root', index } : null;
}

export function getFolderResumeDropIntent(pointer, rect) {
  if (
    !pointer
    || !rect
    || !Number.isFinite(pointer.x)
    || !Number.isFinite(pointer.y)
    || !Number.isFinite(rect.left)
    || !Number.isFinite(rect.right)
    || !Number.isFinite(rect.top)
    || !Number.isFinite(rect.bottom)
  ) {
    return 'inside';
  }

  if (pointer.y < rect.top) return 'before';
  if (pointer.y > rect.bottom) return 'after';

  const width = Math.max(0, rect.right - rect.left);
  const edgeWidth = Math.min(28, Math.max(18, width * 0.18));

  if (pointer.x <= rect.left + edgeWidth) return 'before';
  if (pointer.x >= rect.right - edgeWidth) return 'after';
  return 'inside';
}

export function isPointerWithinFolderPlacementSurface(
  pointer,
  rect,
  placement,
  { rowHeight = 38, gap = 7, includeGaps = false } = {},
) {
  if (
    !pointer
    || !rect
    || !placement?.isOpen
    || !Array.isArray(placement.surfaceRows)
    || placement.surfaceRows.length === 0
    || !Number.isFinite(pointer.x)
    || !Number.isFinite(pointer.y)
    || !Number.isFinite(rect.left)
    || !Number.isFinite(rect.top)
    || !Number.isFinite(rect.width)
    || !Number.isFinite(rect.height)
  ) {
    return false;
  }

  const columns = Math.max(1, Number(placement.width) || 1);
  const cellWidth = (rect.width - gap * Math.max(0, columns - 1)) / columns;
  const columnStride = cellWidth + gap;
  const rowStride = rowHeight + gap;
  const localX = pointer.x - rect.left;
  const localY = pointer.y - rect.top;

  if (localX < 0 || localY < 0 || localX > rect.width || localY > rect.height) {
    return false;
  }

  if (includeGaps) {
    const gapInset = gap / 2;

    return placement.surfaceRows.some((surfaceRow) => {
      const rowLeft = surfaceRow.column * columnStride - gapInset;
      const rowRight = (
        surfaceRow.column * columnStride
        + surfaceRow.span * cellWidth
        + Math.max(0, surfaceRow.span - 1) * gap
        + gapInset
      );
      const rowTop = surfaceRow.row * rowStride - gapInset;
      const rowBottom = surfaceRow.row * rowStride + rowHeight + gapInset;

      return localX >= rowLeft
        && localX <= rowRight
        && localY >= rowTop
        && localY <= rowBottom;
    });
  }

  const column = Math.floor(localX / columnStride);
  const row = Math.floor(localY / rowStride);
  const insideCell = (
    column >= 0
    && column < columns
    && localX - column * columnStride <= cellWidth
    && localY - row * rowStride <= rowHeight
  );

  return insideCell && placement.surfaceRows.some((surfaceRow) => (
    surfaceRow.row === row
    && column >= surfaceRow.column
    && column < surfaceRow.column + surfaceRow.span
  ));
}

export function getFolderPlacementCellRect(
  rect,
  placement,
  cell,
  { rowHeight = 38, gap = 7 } = {},
) {
  if (
    !rect
    || !placement?.isOpen
    || !cell
    || !Number.isFinite(rect.left)
    || !Number.isFinite(rect.top)
    || !Number.isFinite(rect.width)
    || !Number.isFinite(cell.row)
    || !Number.isFinite(cell.column)
  ) {
    return null;
  }

  const columns = Math.max(1, Number(placement.width) || 1);
  const cellWidth = (rect.width - gap * Math.max(0, columns - 1)) / columns;
  const left = rect.left + cell.column * (cellWidth + gap);
  const top = rect.top + cell.row * (rowHeight + gap);

  return {
    x: left,
    y: top,
    top,
    right: left + cellWidth,
    bottom: top + rowHeight,
    left,
    width: cellWidth,
    height: rowHeight,
  };
}

export function getFolderResumeInsertionIndex(
  pointer,
  rect,
  placement,
  resumeCount,
  { rowHeight = 38, gap = 7 } = {},
) {
  if (
    !pointer
    || !rect
    || !placement?.isOpen
    || !placement.tile
    || !Number.isFinite(pointer.x)
    || !Number.isFinite(pointer.y)
    || !Number.isFinite(rect.left)
    || !Number.isFinite(rect.top)
    || !Number.isFinite(rect.width)
  ) {
    return null;
  }

  const targetCount = Math.max(0, Math.floor(Number(resumeCount) || 0));
  if (targetCount === 0) return 0;

  const columns = Math.max(1, Number(placement.width) || 1);
  const cellWidth = (rect.width - gap * Math.max(0, columns - 1)) / columns;
  if (!(cellWidth > 0)) return null;

  const columnStride = cellWidth + gap;
  const rowStride = rowHeight + gap;
  const localX = pointer.x - rect.left;
  const localY = pointer.y - rect.top;
  const pointerColumn = Math.max(0, Math.min(
    columns - 1,
    Math.floor((localX + gap / 2) / columnStride),
  ));
  const pointerRow = Math.max(0, Math.floor((localY + gap / 2) / rowStride));
  const firstChildLinearIndex = placement.tile.row * columns + placement.tile.column + 1;
  const pointerLinearIndex = pointerRow * columns + pointerColumn;
  const targetIndex = Math.max(0, Math.min(
    targetCount - 1,
    pointerLinearIndex - firstChildLinearIndex,
  ));
  const targetLinearIndex = firstChildLinearIndex + targetIndex;
  const targetRow = Math.floor(targetLinearIndex / columns);
  const targetColumn = targetLinearIndex % columns;
  if (pointerRow !== targetRow) {
    return pointerRow > targetRow ? targetIndex + 1 : targetIndex;
  }

  if (targetIndex === targetCount - 1) {
    const trailingThreshold = targetColumn * columnStride + cellWidth * RESUME_RAIL_INSERT_AFTER_RATIO;
    return localX >= trailingThreshold ? targetCount : targetIndex;
  }

  return targetIndex;
}

export function moveOrganizationResumeBundle(organization, resumeIds, destination) {
  const movedIds = [...new Set(resumeIds)].filter(Boolean);

  if (movedIds.length === 0) {
    return organization;
  }

  const movedSet = new Set(movedIds);
  const next = cloneOrganization(organization);
  next.rootItems = next.rootItems.filter((item) => !(item.type === 'resume' && movedSet.has(item.id)));
  Object.values(next.folders).forEach((folder) => {
    folder.resumeIds = folder.resumeIds.filter((resumeId) => !movedSet.has(resumeId));
  });

  if (destination.containerId !== 'root' && next.folders[destination.containerId]) {
    const target = next.folders[destination.containerId].resumeIds;
    const overIndex = destination.overResumeId ? target.indexOf(destination.overResumeId) : -1;
    const insertIndex = overIndex >= 0
      ? overIndex + (destination.after ? 1 : 0)
      : target.length;
    target.splice(insertIndex, 0, ...movedIds);
    return next;
  }

  const overIndex = destination.overResumeId
    ? next.rootItems.findIndex((item) => item.type === 'resume' && item.id === destination.overResumeId)
    : -1;
  const anchorIndex = destination.afterRootItem
    ? next.rootItems.findIndex((item) => (
      item.type === destination.afterRootItem.type && item.id === destination.afterRootItem.id
    ))
    : -1;
  const rootItemIndex = destination.overRootItem
    ? next.rootItems.findIndex((item) => (
      item.type === destination.overRootItem.type && item.id === destination.overRootItem.id
    ))
    : -1;
  const requestedRootIndex = Number.isInteger(destination.rootIndex)
    ? Math.max(0, Math.min(next.rootItems.length, destination.rootIndex))
    : null;
  const insertIndex = requestedRootIndex ?? (
    overIndex >= 0
      ? overIndex + (destination.after ? 1 : 0)
      : (
          rootItemIndex >= 0
            ? rootItemIndex + (destination.after ? 1 : 0)
            : (anchorIndex >= 0 ? anchorIndex + 1 : next.rootItems.length)
        )
  );
  next.rootItems.splice(insertIndex, 0, ...movedIds.map((id) => ({ type: 'resume', id })));
  return next;
}

export function collapseResumeBundleForDragPreview(
  organization,
  resumeIds,
  representativeResumeId,
  anchorResumeId = representativeResumeId,
) {
  const movedIds = [...new Set(resumeIds)].filter(Boolean);
  if (movedIds.length <= 1 || !movedIds.includes(representativeResumeId)) {
    return organization;
  }

  const movedSet = new Set(movedIds);
  const anchorPlacement = getOrganizationResumePlacement(organization, anchorResumeId);
  if (!anchorPlacement) return organization;

  const removedBeforeAnchor = movedIds.reduce((count, resumeId) => {
    const placement = getOrganizationResumePlacement(organization, resumeId);
    return count + Number(
      placement?.containerId === anchorPlacement.containerId
      && placement.index < anchorPlacement.index,
    );
  }, 0);
  const insertionIndex = Math.max(0, anchorPlacement.index - removedBeforeAnchor);
  const next = cloneOrganization(organization);

  next.rootItems = next.rootItems.filter((item) => (
    item.type !== 'resume' || !movedSet.has(item.id)
  ));
  Object.values(next.folders).forEach((folder) => {
    folder.resumeIds = folder.resumeIds.filter((resumeId) => !movedSet.has(resumeId));
  });

  if (anchorPlacement.containerId !== 'root' && next.folders[anchorPlacement.containerId]) {
    const targetResumeIds = next.folders[anchorPlacement.containerId].resumeIds;
    targetResumeIds.splice(
      Math.min(insertionIndex, targetResumeIds.length),
      0,
      representativeResumeId,
    );
  } else {
    next.rootItems.splice(
      Math.min(insertionIndex, next.rootItems.length),
      0,
      { type: 'resume', id: representativeResumeId },
    );
  }

  return next;
}

const RESUME_BUNDLE_SOURCE_PLACEHOLDER_PREFIX = '__resume-bundle-source__:';

function createResumeBundleSourcePlaceholderId(resumeId) {
  return `${RESUME_BUNDLE_SOURCE_PLACEHOLDER_PREFIX}${resumeId}`;
}

export function isResumeBundleSourcePlaceholder(resumeId) {
  return typeof resumeId === 'string' && resumeId.startsWith(RESUME_BUNDLE_SOURCE_PLACEHOLDER_PREFIX);
}

export function createResumeBundleSourcePreview(organization, resumeIds, activeResumeId) {
  const movedSet = new Set(resumeIds);
  const next = cloneOrganization(organization);
  const replaceSourceId = (resumeId) => (
    movedSet.has(resumeId) && resumeId !== activeResumeId
      ? createResumeBundleSourcePlaceholderId(resumeId)
      : resumeId
  );

  next.rootItems = next.rootItems.map((item) => (
    item.type === 'resume' && movedSet.has(item.id) && item.id !== activeResumeId
      ? { type: 'resume', id: createResumeBundleSourcePlaceholderId(item.id) }
      : item
  ));
  Object.values(next.folders).forEach((folder) => {
    folder.resumeIds = folder.resumeIds.map(replaceSourceId);
  });
  return next;
}

export function createResumeBundleDragPreview(
  sourceOrganization,
  movedOrganization,
  resumeIds,
  activeResumeId,
) {
  const movedIds = [...new Set(resumeIds)].filter(Boolean);
  if (movedIds.length <= 1 || !movedIds.includes(activeResumeId)) {
    return movedOrganization;
  }

  if (workspaceOrganizationsEqual(sourceOrganization, movedOrganization)) {
    return createResumeBundleSourcePreview(sourceOrganization, movedIds, activeResumeId);
  }

  const collapsedTarget = collapseResumeBundleForDragPreview(
    movedOrganization,
    movedIds,
    activeResumeId,
    movedIds[0],
  );
  const next = cloneOrganization(collapsedTarget);
  const sourcePlacements = movedIds
    .map((resumeId) => ({
      resumeId,
      placement: getOrganizationResumePlacement(sourceOrganization, resumeId),
    }))
    .filter(({ placement }) => placement)
    .sort((first, second) => first.placement.index - second.placement.index);

  sourcePlacements.forEach(({ resumeId, placement }) => {
    const placeholderId = createResumeBundleSourcePlaceholderId(resumeId);
    if (placement.containerId === 'root') {
      next.rootItems.splice(
        Math.min(placement.index, next.rootItems.length),
        0,
        { type: 'resume', id: placeholderId },
      );
      return;
    }

    const folder = next.folders[placement.containerId];
    if (folder) {
      folder.resumeIds.splice(
        Math.min(placement.index, folder.resumeIds.length),
        0,
        placeholderId,
      );
    }
  });

  return next;
}

export function moveOrganizationRootItemToIndex(organization, activeItem, rootIndex) {
  if (!activeItem?.id || !Number.isInteger(rootIndex)) {
    return organization;
  }

  const next = cloneOrganization(organization);
  const activeIndex = next.rootItems.findIndex(
    (item) => item.type === activeItem.type && item.id === activeItem.id,
  );
  if (activeIndex < 0) return organization;

  const [movedItem] = next.rootItems.splice(activeIndex, 1);
  const insertIndex = Math.max(0, Math.min(next.rootItems.length, rootIndex));
  next.rootItems.splice(insertIndex, 0, movedItem);
  return next;
}

export function moveOrganizationRootItem(organization, activeItem, overItem, after = false) {
  if (
    !activeItem?.id
    || !overItem?.id
    || (activeItem.type === overItem.type && activeItem.id === overItem.id)
    || (activeItem.type !== overItem.type && activeItem.type !== 'folder')
  ) {
    return organization;
  }

  const next = cloneOrganization(organization);
  const activeIndex = next.rootItems.findIndex(
    (item) => item.type === activeItem.type && item.id === activeItem.id,
  );

  if (activeIndex < 0) {
    return organization;
  }

  const [movedItem] = next.rootItems.splice(activeIndex, 1);
  const overIndex = next.rootItems.findIndex(
    (item) => item.type === overItem.type && item.id === overItem.id,
  );

  if (overIndex < 0) {
    next.rootItems.push(movedItem);
  } else {
    next.rootItems.splice(overIndex + (after ? 1 : 0), 0, movedItem);
  }

  return next;
}

function createFolderClusterCells(folder, startColumn, columns) {
  const tile = { row: 0, column: startColumn };
  const toCell = (offset) => ({
    row: Math.floor((startColumn + offset) / columns),
    column: (startColumn + offset) % columns,
  });

  return {
    tile,
    children: folder.resumeIds.map((resumeId, index) => ({
      resumeId,
      ...toCell(index + 1),
    })),
    emptyCell: folder.resumeIds.length === 0 ? toCell(1) : null,
  };
}

function createFolderSurfaceRows(startColumn, requiredCells, columns) {
  const rows = [];
  let remainingCells = requiredCells;
  let row = 0;
  let column = startColumn;

  while (remainingCells > 0) {
    const span = Math.min(columns - column, remainingCells);
    rows.push({ row, column, span });
    remainingCells -= span;
    row += 1;
    column = 0;
  }

  return rows;
}

function createOpenFolderPlacement(item, folder, startIndex, columns) {
  const childSlotCount = Math.max(1, folder.resumeIds.length);
  const requiredCells = childSlotCount + 1;
  const startColumn = startIndex % columns;
  const height = Math.ceil((startColumn + requiredCells) / columns);
  const cells = createFolderClusterCells(folder, startColumn, columns);

  return {
    item,
    folderId: item.id,
    isOpen: true,
    row: Math.floor(startIndex / columns),
    column: 0,
    width: columns,
    height,
    tile: cells.tile,
    children: cells.children,
    emptyCell: cells.emptyCell,
    surfaceRows: createFolderSurfaceRows(startColumn, requiredCells, columns),
    endIndex: startIndex + requiredCells,
  };
}

function createSingleCellPlacement(item, index, columns) {
  const isFolder = item.type === 'folder';
  return {
    item,
    folderId: isFolder ? item.id : '',
    isOpen: false,
    row: Math.floor(index / columns),
    column: isFolder ? 0 : index % columns,
    width: isFolder ? columns : 1,
    height: 1,
    tile: isFolder ? { row: 0, column: index % columns } : null,
    children: [],
    emptyCell: null,
    surfaceRows: [],
    endIndex: index + 1,
  };
}

export function buildResumeRailLayout(organization, openFolderIds, columns) {
  const columnCount = Math.max(2, Math.min(6, Number(columns) || 2));
  const placements = [];
  let nextIndex = 0;

  organization.rootItems.forEach((item) => {
    const folder = item.type === 'folder' ? organization.folders[item.id] : null;
    const isOpenFolder = folder && openFolderIds.has(item.id);

    const placement = isOpenFolder
      ? createOpenFolderPlacement(item, folder, nextIndex, columnCount)
      : createSingleCellPlacement(item, nextIndex, columnCount);

    placements.push(placement);
    nextIndex = placement.endIndex;
  });

  const rowCount = Math.ceil(nextIndex / columnCount);
  return { columns: columnCount, placements, rowCount };
}

export function workspaceOrganizationsEqual(first, second) {
  return stableJson({ ...first, updatedAt: '' }) === stableJson({ ...second, updatedAt: '' });
}
