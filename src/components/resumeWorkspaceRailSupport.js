import {
  WORKSPACE_FOLDER_TONE_COUNT,
} from '../lib/workspace.js';
import { WORKSPACE_OPEN_FOLDERS_STORAGE_KEY } from '../lib/localWorkspaceKeys.js';
import { readLocalStorageJsonItem } from '../lib/browserStorage.js';

export const FOLDER_AUTO_OPEN_DELAY_MS = 320;
export const FOLDER_AUTO_CLOSE_DELAY_MS = 140;
const FOLDER_MOTION_DURATION_SECONDS = 0.18;
export const RAIL_ROW_HEIGHT_PX = 38;
export const RAIL_ROW_GAP_PX = 7;
export const RAIL_PADDING_BLOCK_PX = 8;
export const ROOT_RELEASE_CONTAINER_ID = 'root-release';
export const MOTION_EASE = [0.22, 1, 0.36, 1];
export const FOLDER_MOTION_TRANSITION = {
  duration: FOLDER_MOTION_DURATION_SECONDS,
  ease: MOTION_EASE,
};
export const RAIL_LAYOUT_TRANSITION = { duration: 0.28, ease: MOTION_EASE };
export const RAIL_DRAG_LAYOUT_TRANSITION = {
  type: 'spring',
  stiffness: 700,
  damping: 52,
  mass: 0.45,
};
export const railSortingStrategy = () => null;
export const disableSortableLayoutAnimation = () => false;

const FOLDER_MAX_STAGGER_SPAN_SECONDS = 0.1;

export function getFolderItemStaggerSeconds(itemCount) {
  return itemCount > 1
    ? Math.min(0.045, FOLDER_MAX_STAGGER_SPAN_SECONDS / (itemCount - 1))
    : 0;
}

export function getFolderCloseDurationMs(itemCount, surfaceRowCount = 1) {
  const itemDuration = (
    getFolderItemStaggerSeconds(itemCount) * Math.max(0, itemCount - 1)
  ) + FOLDER_MOTION_DURATION_SECONDS;
  const surfaceDuration = (
    getFolderItemStaggerSeconds(surfaceRowCount) * Math.max(0, surfaceRowCount - 1)
  ) + FOLDER_MOTION_DURATION_SECONDS;
  return Math.ceil(Math.max(itemDuration, surfaceDuration) * 1000);
}

export function getFolderItemOrigin(tile, cell) {
  const columnDelta = tile.column - cell.column;
  const rowDelta = tile.row - cell.row;
  const percentDelta = columnDelta * 100;
  const pixelDelta = columnDelta * 7;
  const x = pixelDelta === 0
    ? `${percentDelta}%`
    : `calc(${percentDelta}% ${pixelDelta > 0 ? '+' : '-'} ${Math.abs(pixelDelta)}px)`;

  return { x, y: rowDelta * 45 };
}

export function getFolderToneClass(toneIndex = 0) {
  const normalizedIndex = Math.abs(Number(toneIndex) || 0) % WORKSPACE_FOLDER_TONE_COUNT;
  return `resumeFolderTone${normalizedIndex}`;
}

export function setRootInsertTargetIfChanged(setTarget, folderId = '', position = '') {
  setTarget((current) => (
    current.folderId === folderId && current.position === position
      ? current
      : { folderId, position }
  ));
}

export function pointIsWithinRect(point, rect) {
  return Boolean(
    point
    && rect
    && point.x >= rect.left
    && point.x <= rect.right
    && point.y >= rect.top
    && point.y <= rect.bottom
  );
}

export function loadOpenFolderIds() {
  if (typeof window === 'undefined') {
    return new Set();
  }

  const value = readLocalStorageJsonItem(WORKSPACE_OPEN_FOLDERS_STORAGE_KEY);
  return new Set(Array.isArray(value) ? value.filter((id) => typeof id === 'string').slice(-100) : []);
}
