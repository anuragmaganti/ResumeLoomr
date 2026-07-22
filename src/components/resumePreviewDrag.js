import {
  closestCenter,
  pointerWithin,
} from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';

const DRAG_ID_SEPARATOR = '::';

export function sectionDragId(sectionId) {
    return ['section', sectionId].join(DRAG_ID_SEPARATOR);
}

export function sectionHeadingDragId(sectionId, alignment) {
    return ['sectionHeading', sectionId, alignment].join(DRAG_ID_SEPARATOR);
}

export function personalContactDragId(field) {
    return ['personalContact', field].join(DRAG_ID_SEPARATOR);
}

export function personalHeaderDragId(rowId) {
    return ['personalHeader', rowId].join(DRAG_ID_SEPARATOR);
}

export function entryDragId(sectionId, entryId) {
    return ['entry', sectionId, entryId].join(DRAG_ID_SEPARATOR);
}

export function bulletDragId(sectionId, entryId, field, itemIndex) {
    return ['bullet', sectionId, entryId, field, itemIndex].join(DRAG_ID_SEPARATOR);
}

export function headerSlotDragId(sectionId, entryId, lineIndex, side, slotIndex) {
    return ['headerSlot', sectionId, entryId, lineIndex, side, slotIndex].join(DRAG_ID_SEPARATOR);
}

export function parsePreviewDragId(id) {
    const parts = String(id || '').split(DRAG_ID_SEPARATOR);
    const [type, sectionId, entryId, field, itemIndex] = parts;

    if (type === 'personalContact' && sectionId) {
        return { type, field: sectionId };
    }

    if (type === 'personalHeader' && sectionId) {
        return { type, rowId: sectionId };
    }

    if (type === 'section' && sectionId) {
        return { type, sectionId };
    }

    if (type === 'sectionHeading' && sectionId && ['left', 'center'].includes(entryId)) {
        return { type, sectionId, alignment: entryId };
    }

    if (type === 'entry' && sectionId && entryId) {
        return { type, sectionId, entryId };
    }

    if (type === 'bullet' && sectionId && entryId && field && itemIndex !== undefined) {
        return {
            type,
            sectionId,
            entryId,
            field,
            itemIndex: Number(itemIndex),
        };
    }

    if (type === 'headerSlot' && sectionId && entryId && field !== undefined && itemIndex && parts[5] !== undefined) {
        const lineIndex = Number(field);
        const slotIndex = Number(parts[5]);
        const side = itemIndex === 'right' ? 'right' : 'left';

        if (Number.isInteger(lineIndex) && Number.isInteger(slotIndex)) {
            return {
                type,
                sectionId,
                entryId,
                lineIndex,
                side,
                slotIndex,
            };
        }
    }

    return { type: '' };
}

export function areCompatiblePreviewDragItems(activeMeta, overMeta) {
    if (!activeMeta?.type || activeMeta.type !== overMeta?.type) {
        return false;
    }

    if (activeMeta.type === 'section') {
        return true;
    }

    if (activeMeta.type === 'sectionHeading') {
        return activeMeta.sectionId === overMeta.sectionId;
    }

    if (activeMeta.type === 'personalContact') {
        return true;
    }

    if (activeMeta.type === 'personalHeader') {
        return true;
    }

    if (activeMeta.type === 'entry') {
        return activeMeta.sectionId === overMeta.sectionId;
    }

    if (activeMeta.type === 'bullet') {
        return (
            activeMeta.sectionId === overMeta.sectionId &&
            activeMeta.entryId === overMeta.entryId &&
            activeMeta.field === overMeta.field
        );
    }

    if (activeMeta.type === 'headerSlot') {
        return activeMeta.sectionId === overMeta.sectionId && activeMeta.entryId === overMeta.entryId;
    }

    return false;
}

export function previewCollisionDetection(args, activeInitialRect = null, activePointer = null) {
    const activeMeta = parsePreviewDragId(args.active.id);
    const droppableContainers = args.droppableContainers.filter((container) => (
        areCompatiblePreviewDragItems(activeMeta, parsePreviewDragId(container.id))
    ));

    if (activeMeta.type === 'sectionHeading') {
        return getSectionHeadingPointerCollision(args, droppableContainers, activePointer);
    }

    if (activeMeta.type === 'section' || activeMeta.type === 'entry' || activeMeta.type === 'personalHeader') {
        const edgeCollision = getActivePreviewCollisionIfPointerOutsideListBounds(args, droppableContainers, activeInitialRect);

        if (edgeCollision) {
            return [edgeCollision];
        }

        const activeCollision = getActivePreviewCollisionIfPointerWithin(args, droppableContainers, activeInitialRect);

        if (activeCollision) {
            return [activeCollision];
        }

        const sortableDroppableContainers = droppableContainers.filter((container) => (
            String(container.id) !== String(args.active.id)
        ));
        const pointerY = args.pointerCoordinates?.y;
        const pointerX = args.pointerCoordinates?.x;

        if (sortableDroppableContainers.length === 0) {
            return [];
        }

        if (Number.isFinite(pointerY)) {
            const collisions = sortableDroppableContainers
                .map((droppableContainer) => {
                    const rect = args.droppableRects.get(droppableContainer.id);

                    if (!rect) {
                        return null;
                    }

                    const verticalDistance = Math.abs(pointerY - (rect.top + (rect.height / 2)));
                    const horizontalDistance = Number.isFinite(pointerX)
                        ? Math.abs(pointerX - (rect.left + (rect.width / 2)))
                        : 0;

                    return {
                        id: droppableContainer.id,
                        data: {
                            droppableContainer,
                            value: verticalDistance + (horizontalDistance * 0.01),
                        },
                    };
                })
                .filter(Boolean)
                .sort((firstCollision, secondCollision) => firstCollision.data.value - secondCollision.data.value);

            if (collisions.length > 0) {
                return collisions;
            }
        }

        return closestCenter({ ...args, droppableContainers: sortableDroppableContainers });
    }

    const pointerCollisions = pointerWithin({ ...args, droppableContainers });

    if (pointerCollisions.length > 0) {
        return pointerCollisions;
    }

    return closestCenter({ ...args, droppableContainers });
}

function getSectionHeadingPointerCollision(args, droppableContainers, activePointer) {
    const target = activePointer ? droppableContainers.find((container) => {
        const element = getPreviewSortableElement(container.id);
        const rect = element?.getBoundingClientRect() || args.droppableRects.get(container.id);

        return isPreviewPointWithinRect(activePointer, rect);
    }) : null;

    return target
        ? [{
            id: target.id,
            data: {
                droppableContainer: target,
                value: 0,
            },
        }]
        : [];
}

function getActivePreviewCollision(args, droppableContainers) {
    const activeContainer = droppableContainers.find((container) => (
        String(container.id) === String(args.active.id)
    ));

    if (!activeContainer) {
        return null;
    }

    return {
        id: activeContainer.id,
        data: {
            droppableContainer: activeContainer,
            value: 0,
        },
    };
}

function getPreviewDroppableRect(args, droppableContainer, activeInitialRect = null) {
    if (String(droppableContainer.id) === String(args.active.id) && activeInitialRect) {
        return activeInitialRect;
    }

    return args.droppableRects.get(droppableContainer.id);
}

function getActivePreviewCollisionIfPointerOutsideListBounds(args, droppableContainers, activeInitialRect = null) {
    const pointerY = args.pointerCoordinates?.y;

    if (!Number.isFinite(pointerY)) {
        return null;
    }

    const orderedContainers = droppableContainers
        .map((droppableContainer) => ({
            droppableContainer,
            rect: getPreviewDroppableRect(args, droppableContainer, activeInitialRect),
        }))
        .filter(({ rect }) => rect && Number.isFinite(rect.top) && Number.isFinite(rect.height))
        .sort((first, second) => first.rect.top - second.rect.top);
    const activeIndex = orderedContainers.findIndex(({ droppableContainer }) => (
        String(droppableContainer.id) === String(args.active.id)
    ));

    if (activeIndex < 0) {
        return null;
    }

    const activeRect = orderedContainers[activeIndex].rect;

    if (
        (activeIndex === 0 && pointerY < activeRect.top) ||
        (activeIndex === orderedContainers.length - 1 && pointerY > activeRect.top + activeRect.height)
    ) {
        return getActivePreviewCollision(args, droppableContainers);
    }

    return null;
}

export function isPreviewPointWithinRect(point, rect) {
    const rectRight = Number.isFinite(rect?.right) ? rect.right : rect?.left + rect?.width;
    const rectBottom = Number.isFinite(rect?.bottom) ? rect.bottom : rect?.top + rect?.height;

    return Boolean(
        point &&
        rect &&
        Number.isFinite(point.x) &&
        Number.isFinite(point.y) &&
        Number.isFinite(rect.left) &&
        Number.isFinite(rect.top) &&
        Number.isFinite(rectRight) &&
        Number.isFinite(rectBottom) &&
        point.x >= rect.left &&
        point.x <= rectRight &&
        point.y >= rect.top &&
        point.y <= rectBottom
    );
}

function getActivePreviewCollisionIfPointerWithin(args, droppableContainers, activeInitialRect = null) {
    const activeCollision = getActivePreviewCollision(args, droppableContainers);
    const activeContainer = activeCollision?.data?.droppableContainer;
    const activeRect = activeContainer ? args.droppableRects.get(activeContainer.id) : null;

    if (
        !activeContainer ||
        (
            !isPreviewPointWithinRect(args.pointerCoordinates, activeInitialRect) &&
            !isPreviewPointWithinRect(args.pointerCoordinates, activeRect)
        )
    ) {
        return null;
    }

    return activeCollision;
}

export function getPreviewSortableElement(sortableId) {
    if (typeof document === 'undefined') {
        return null;
    }

    return [...document.querySelectorAll('[data-preview-sortable-id]')]
        .find((element) => element.dataset.previewSortableId === String(sortableId));
}

export function normalizePreviewSortableTransform(transform, previewScale) {
    if (!transform || !Number.isFinite(previewScale) || previewScale <= 0 || Math.abs(previewScale - 1) < 0.001) {
        return transform;
    }

    return {
        ...transform,
        x: transform.x / previewScale,
        y: transform.y / previewScale,
    };
}

export function moveIdWithinOrder(ids, activeId, overId) {
    const fromIndex = ids.indexOf(activeId);
    const toIndex = ids.indexOf(overId);

    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
        return ids;
    }

    return arrayMove(ids, fromIndex, toIndex);
}

function getPreviewVerticalItemGap(rects, index, activeIndex) {
    const currentRect = rects[index];
    const previousRect = rects[index - 1];
    const nextRect = rects[index + 1];

    if (!currentRect) {
        return 0;
    }

    if (activeIndex < index) {
        return previousRect
            ? currentRect.top - (previousRect.top + previousRect.height)
            : nextRect
                ? nextRect.top - (currentRect.top + currentRect.height)
                : 0;
    }

    return nextRect
        ? nextRect.top - (currentRect.top + currentRect.height)
        : previousRect
            ? currentRect.top - (previousRect.top + previousRect.height)
            : 0;
}

export function previewVerticalListSortingStrategy({
    activeIndex,
    activeNodeRect: fallbackActiveRect,
    index,
    rects,
    overIndex,
}) {
    const activeNodeRect = rects[activeIndex] || fallbackActiveRect;

    if (!activeNodeRect || overIndex < 0) {
        return null;
    }

    if (index === activeIndex) {
        const overIndexRect = rects[overIndex];

        if (!overIndexRect) {
            return null;
        }

        return {
            x: 0,
            y: activeIndex < overIndex
                ? overIndexRect.top + overIndexRect.height - (activeNodeRect.top + activeNodeRect.height)
                : overIndexRect.top - activeNodeRect.top,
            scaleX: 1,
            scaleY: 1,
        };
    }

    const itemGap = getPreviewVerticalItemGap(rects, index, activeIndex);

    if (index > activeIndex && index <= overIndex) {
        return {
            x: 0,
            y: -activeNodeRect.height - itemGap,
            scaleX: 1,
            scaleY: 1,
        };
    }

    if (index < activeIndex && index >= overIndex) {
        return {
            x: 0,
            y: activeNodeRect.height + itemGap,
            scaleX: 1,
            scaleY: 1,
        };
    }

    return {
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
    };
}
