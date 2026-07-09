import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    closestCenter,
    DndContext,
    DragOverlay,
    MeasuringFrequency,
    MeasuringStrategy,
    pointerWithin,
    useDraggable,
    useDroppable,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    horizontalListSortingStrategy,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    ENTRY_HEADER_LAYOUT_FIELDS,
    PERSONAL_ALIGNMENT_OPTIONS,
    PERSONAL_CONTACT_FIELDS,
    getDefaultEntryHeaderLayout,
    getEffectivePersonalAlignment,
    getResumePresentationVars,
    getResumePrintPageRule,
    moveSectionHeaderField,
    normalizeEntryHeaderLayout,
    normalizePersonalContactOrder,
    normalizePersonalHeaderOrder,
} from '../lib/resume.js';
import {
    CSS_PIXELS_PER_INCH,
    PRINT_PAGE_HEIGHT_PX,
    PRINT_PAGE_WIDTH_PX,
    calculatePreviewPageBreaks,
} from '../lib/previewPagination.js';
import {
    createPreviewEditAttributes,
    personalEditorPath,
    sectionEntryEditorPath,
    sectionEntryListEditorPath,
    sectionEntryNestedEditorPath,
    sectionTitleEditorPath,
} from '../lib/editorTargets.js';
import { ResumeLoomrKeyboardSensor, ResumeLoomrPointerSensor } from '../lib/sortableSensors.js';

function templateClassName(template) {
    return `resumePage--${template}`;
}

const personalLinkFieldMap = {
    linkedin: 'linkedinUrl',
    portfolio: 'portfolioUrl',
    github: 'githubUrl',
    custom: 'customField',
};

const DRAG_ID_SEPARATOR = '::';
const DEFAULT_PREVIEW_PAGE_MIN_HEIGHT = PRINT_PAGE_HEIGHT_PX;
const FIRST_SECTION_ENTRY_SNAP_DISTANCE_PX = 144;
const SUMMARY_WIDTH_MIN_PERCENT = 75;
const SUMMARY_WIDTH_MAX_PERCENT = 100;
const HEADER_LAYOUT_DOUBLE_CLICK_MS = 420;
const HEADER_LAYOUT_DOUBLE_CLICK_TOLERANCE_PX = 8;
const HEADER_LAYOUT_LONG_PRESS_MS = 520;
const HEADER_LAYOUT_LONG_PRESS_MOVE_TOLERANCE_PX = 8;

const ENTRY_HEADER_FIELD_META = {
    education: {
        school: { label: 'Institution', className: 'school' },
        degree: { label: 'Degree', className: 'degree' },
        location: { label: 'Location', className: 'eduLocation previewEntryLocation' },
        yearsEdu: { label: 'Dates', className: 'yearsEdu' },
        gpa: { label: 'GPA', className: 'educationMeta educationGpaInline' },
        honors: { label: 'Honors', className: 'educationMeta' },
    },
    roles: {
        company: { label: 'Organization', className: 'company' },
        role: { label: 'Role', className: 'role' },
        location: { label: 'Location', className: 'previewEntryLocation' },
        yearsExp: { label: 'Dates', className: 'yearsExp' },
    },
    custom: {
        title: { label: 'Title', className: 'previewEntryTitle' },
        subtitle: { label: 'Subtitle', className: 'previewEntrySubtitle' },
        location: { label: 'Location', className: 'previewEntryLocation' },
        years: { label: 'Date', className: 'previewEntryMeta' },
    },
};

function parseCssPixelValue(value, fallback = 0) {
    const parsed = Number.parseFloat(value);

    return Number.isFinite(parsed) ? parsed : fallback;
}

function clampSummaryWidthPercent(value) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
        return 100;
    }

    return Math.max(SUMMARY_WIDTH_MIN_PERCENT, Math.min(SUMMARY_WIDTH_MAX_PERCENT, Math.round(numericValue)));
}

function parseCssLengthToPixels(value, fallback = 0) {
    const text = String(value || '').trim().toLowerCase();
    const parsed = Number.parseFloat(text);

    if (!Number.isFinite(parsed)) {
        return fallback;
    }

    if (text.endsWith('in')) {
        return parsed * CSS_PIXELS_PER_INCH;
    }

    return parsed;
}

function getPreviewStickyTop(frameElement) {
    const frameStyles = window.getComputedStyle(frameElement);
    const stickyTop = parseCssPixelValue(frameStyles.top, 0);

    return Number.isFinite(stickyTop) ? stickyTop : 0;
}

function metricsAreEqual(current, next) {
    return (
        current.pageWidth === next.pageWidth &&
        current.pageHeight === next.pageHeight &&
        current.contentHeight === next.contentHeight &&
        current.pageCount === next.pageCount &&
        current.layoutWidth === next.layoutWidth &&
        Math.abs(current.scale - next.scale) < 0.001 &&
        current.pageBreaks.length === next.pageBreaks.length &&
        current.pageBreaks.every((pageBreak, index) => pageBreak === next.pageBreaks[index])
    );
}

function sectionDragId(sectionId) {
    return ['section', sectionId].join(DRAG_ID_SEPARATOR);
}

function personalContactDragId(field) {
    return ['personalContact', field].join(DRAG_ID_SEPARATOR);
}

function personalHeaderDragId(rowId) {
    return ['personalHeader', rowId].join(DRAG_ID_SEPARATOR);
}

function entryDragId(sectionId, entryId) {
    return ['entry', sectionId, entryId].join(DRAG_ID_SEPARATOR);
}

function bulletDragId(sectionId, entryId, field, itemIndex) {
    return ['bullet', sectionId, entryId, field, itemIndex].join(DRAG_ID_SEPARATOR);
}

function headerSlotDragId(sectionId, entryId, lineIndex, side, slotIndex) {
    return ['headerSlot', sectionId, entryId, lineIndex, side, slotIndex].join(DRAG_ID_SEPARATOR);
}

function getEntryHeaderFieldMeta(sectionKind, field) {
    return ENTRY_HEADER_FIELD_META[sectionKind]?.[field] || { label: field, className: 'previewEntryTitle' };
}

function getEntryHeaderLayoutSlotField(layout, slot) {
    const lineIndex = Number(slot?.lineIndex);
    const slotIndex = Number(slot?.slotIndex);
    const side = slot?.side === 'right' ? 'right' : 'left';
    const slots = layout?.lines?.[lineIndex]?.[side];

    if (
        !Number.isInteger(lineIndex) ||
        !Number.isInteger(slotIndex) ||
        lineIndex < 0 ||
        lineIndex > 1 ||
        !Array.isArray(slots) ||
        slotIndex < 0 ||
        slotIndex >= slots.length
    ) {
        return null;
    }

    return slots[slotIndex] || null;
}

function parsePreviewDragId(id) {
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

function areCompatiblePreviewDragItems(activeMeta, overMeta) {
    if (!activeMeta?.type || activeMeta.type !== overMeta?.type) {
        return false;
    }

    if (activeMeta.type === 'section') {
        return true;
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

function previewCollisionDetection(args, activeInitialRect = null) {
    const activeMeta = parsePreviewDragId(args.active.id);
    const droppableContainers = args.droppableContainers.filter((container) => (
        areCompatiblePreviewDragItems(activeMeta, parsePreviewDragId(container.id))
    ));

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

function isPointWithinRect(point, rect) {
    const rectRight = Number.isFinite(rect?.right) ? rect.right : rect?.left + rect?.width;
    const rectBottom = Number.isFinite(rect?.bottom) ? rect.bottom : rect?.top + rect?.height;

    return (
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
            !isPointWithinRect(args.pointerCoordinates, activeInitialRect) &&
            !isPointWithinRect(args.pointerCoordinates, activeRect)
        )
    ) {
        return null;
    }

    return activeCollision;
}

function getPreviewSortableElement(sortableId) {
    if (typeof document === 'undefined') {
        return null;
    }

    return [...document.querySelectorAll('[data-preview-sortable-id]')]
        .find((element) => element.dataset.previewSortableId === String(sortableId));
}

function normalizePreviewSortableTransform(transform, previewScale) {
    if (!transform || !Number.isFinite(previewScale) || previewScale <= 0 || Math.abs(previewScale - 1) < 0.001) {
        return transform;
    }

    return {
        ...transform,
        x: transform.x / previewScale,
        y: transform.y / previewScale,
    };
}

function previewSectionClassName(className, showSeparator) {
    return `${className}${showSeparator ? '' : ' resumeSection--lastVisible'}`;
}

function renderSectionSeparatorControl({ blockId, onSeparatorSettingsOpen, position = 'aboveSectionName' }) {
    if (position === 'belowSectionName') {
        return (
            <span
                className="sectionSeparatorBelowHeading"
                data-separator-scope="section"
                data-separator-section-id={blockId}
            >
                <span className="sectionSeparatorPrintLine" aria-hidden="true" />
                <button
                    type="button"
                    className="sectionSeparatorControl sectionSeparatorControl--belowHeading"
                    data-separator-scope="section"
                    data-separator-section-id={blockId}
                    aria-label="Section separator settings"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => openSeparatorSettings(event, onSeparatorSettingsOpen, 'section', blockId)}
                />
            </span>
        );
    }

    return (
        <button
            type="button"
            className="sectionSeparatorControl"
            data-separator-scope="section"
            data-separator-section-id={blockId}
            aria-label="Section separator settings"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => openSeparatorSettings(event, onSeparatorSettingsOpen, 'section', blockId)}
        />
    );
}

function openSeparatorSettings(event, onSeparatorSettingsOpen, scope, sectionId) {
    event.preventDefault();
    event.stopPropagation();
    onSeparatorSettingsOpen?.({
        scope,
        sectionId,
        x: event.clientX,
        y: event.clientY,
        triggerElement: event.currentTarget,
    });
}

function SortablePreviewSection({
    blockId,
    className,
    previewScale,
    showSeparator = true,
    separatorPosition = 'aboveSectionName',
    onSeparatorSettingsOpen,
    children,
}) {
    const sortableId = sectionDragId(blockId);
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: sortableId });
    const style = {
        transform: CSS.Translate.toString(normalizePreviewSortableTransform(transform, previewScale)),
        transition,
    };
    const handleProps = {
        ...attributes,
        ...listeners,
        'data-preview-drag-handle': 'true',
        'data-preview-drag-scope': 'section',
    };

    return (
        <div
            ref={setNodeRef}
            data-preview-sortable-id={sortableId}
            data-page-break-kind="section"
            className={`${previewSectionClassName(className, showSeparator)}${separatorPosition === 'belowSectionName' ? ' resumeSection--separatorBelowHeading' : ''} previewSortableItem previewSortableSection ${isDragging ? 'isPreviewSortingPlaceholder' : ''}`}
            style={style}
        >
            {children(
                handleProps,
                separatorPosition === 'belowSectionName'
                    ? renderSectionSeparatorControl({ blockId, onSeparatorSettingsOpen, position: separatorPosition })
                    : null,
            )}
            {showSeparator && separatorPosition !== 'belowSectionName' && renderSectionSeparatorControl({ blockId, onSeparatorSettingsOpen, position: separatorPosition })}
        </div>
    );
}

function StaticPreviewSection({
    blockId,
    className,
    showSeparator = true,
    separatorPosition = 'aboveSectionName',
    onSeparatorSettingsOpen,
    children,
}) {
    return (
        <div
            className={`${previewSectionClassName(className, showSeparator)}${separatorPosition === 'belowSectionName' ? ' resumeSection--separatorBelowHeading' : ''}`}
            data-page-break-kind="section"
        >
            {children(
                {},
                blockId && separatorPosition === 'belowSectionName'
                    ? renderSectionSeparatorControl({ blockId, onSeparatorSettingsOpen, position: separatorPosition })
                    : null,
            )}
            {blockId && showSeparator && separatorPosition !== 'belowSectionName' && renderSectionSeparatorControl({ blockId, onSeparatorSettingsOpen, position: separatorPosition })}
        </div>
    );
}

function SortablePreviewEntry({ sectionId, entryId, className, previewScale, entryEditProps = {}, preferEntryDrag = false, children }) {
    const sortableId = entryDragId(sectionId, entryId);
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: sortableId });
    const style = {
        transform: CSS.Translate.toString(normalizePreviewSortableTransform(transform, previewScale)),
        transition,
    };
    const handleProps = {
        ...attributes,
        ...listeners,
        'data-preview-drag-handle': 'true',
        'data-preview-drag-scope': 'entry',
    };
    const containerEntryDragProps = {
        ...attributes,
        'data-preview-drag-handle': 'true',
        'data-preview-drag-scope': 'entry-empty-space',
        onPointerDown: (event) => {
            const childInteractiveTarget = event.target.closest(
                '[data-edit-section-id], [data-preview-drag-scope="header-layout"], [data-preview-drag-scope="bullet"], [data-header-hover-slot], button, input, textarea, select, a',
            );
            const shouldLetChildHandleDrag = childInteractiveTarget && childInteractiveTarget !== event.currentTarget;

            if (
                shouldLetChildHandleDrag &&
                !(preferEntryDrag && !event.target.closest('[data-preview-drag-scope="header-layout"], [data-header-hover-slot], input, textarea, select'))
            ) {
                return;
            }

            listeners?.onPointerDown?.(event);
        },
    };

    return (
        <div
            ref={setNodeRef}
            data-preview-sortable-id={sortableId}
            data-page-break-kind="entry"
            className={`${className} previewSortableItem previewSortableEntry ${isDragging ? 'isPreviewSortingPlaceholder' : ''}`}
            style={style}
            {...entryEditProps}
            {...containerEntryDragProps}
        >
            {children(handleProps)}
        </div>
    );
}

function StaticPreviewEntry({ className, entryEditProps = {}, children }) {
    return (
        <div className={className} data-page-break-kind="entry" {...entryEditProps}>
            {children({})}
        </div>
    );
}

function SortablePreviewBullet({ sectionId, entryId, field, itemIndex, editProps, previewScale, children }) {
    const sortableId = bulletDragId(sectionId, entryId, field, itemIndex);
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: sortableId });
    const style = {
        transform: CSS.Translate.toString(normalizePreviewSortableTransform(transform, previewScale)),
        transition,
    };
    const handleProps = {
        ...attributes,
        ...listeners,
        'data-preview-drag-handle': 'true',
        'data-preview-drag-scope': 'bullet',
    };

    return (
        <li
            ref={setNodeRef}
            data-preview-sortable-id={sortableId}
            data-page-break-kind="item"
            className={`previewSortableItem previewSortableBullet ${isDragging ? 'isPreviewSortingPlaceholder' : ''}`}
            style={style}
            {...editProps}
            {...handleProps}
        >
            {children}
        </li>
    );
}

function SortablePersonalContact({ field, editProps, previewScale, children }) {
    const sortableId = personalContactDragId(field);
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: sortableId });
    const style = {
        transform: CSS.Translate.toString(normalizePreviewSortableTransform(transform, previewScale)),
        transition,
    };
    const handleProps = {
        ...attributes,
        ...listeners,
        'data-preview-drag-handle': 'true',
        'data-preview-drag-scope': 'personal-contact',
    };

    return (
        <span
            ref={setNodeRef}
            data-preview-sortable-id={sortableId}
            className={`previewSortableItem previewSortablePersonalContact ${isDragging ? 'isPreviewSortingPlaceholder' : ''}`}
            style={style}
            {...editProps}
            {...handleProps}
        >
            {children}
        </span>
    );
}

function PersonalAlignmentControls({ activeAlignment, onAlignmentChange }) {
    const labels = {
        left: 'Align personal section left',
        center: 'Align personal section center',
    };
    const iconBars = {
        left: [
            { x: 3, width: 14 },
            { x: 3, width: 10 },
            { x: 3, width: 13 },
            { x: 3, width: 8 },
        ],
        center: [
            { x: 3, width: 14 },
            { x: 5, width: 10 },
            { x: 3.5, width: 13 },
            { x: 6, width: 8 },
        ],
    };

    function stopControlEvent(event) {
        event.preventDefault();
        event.stopPropagation();
    }

    function renderAlignmentIcon(alignment) {
        return (
            <svg
                className="personalAlignmentIcon"
                viewBox="0 0 20 18"
                aria-hidden="true"
                focusable="false"
            >
                {iconBars[alignment].map((bar, index) => (
                    <rect
                        key={`${alignment}-${index}`}
                        x={bar.x}
                        y={3 + (index * 3.4)}
                        width={bar.width}
                        height="1.8"
                        rx="0.9"
                    />
                ))}
            </svg>
        );
    }

    return (
        <div
            className="personalAlignmentMenu"
            data-personal-alignment-menu="true"
            aria-label="Personal section alignment"
            onPointerDown={stopControlEvent}
            onMouseDown={stopControlEvent}
            onClick={(event) => event.stopPropagation()}
        >
            {PERSONAL_ALIGNMENT_OPTIONS.map((alignment) => (
                <button
                    key={alignment}
                    type="button"
                    className="personalAlignmentButton"
                    aria-label={labels[alignment]}
                    aria-pressed={activeAlignment === alignment}
                    data-personal-alignment-option={alignment}
                    onClick={(event) => {
                        stopControlEvent(event);
                        onAlignmentChange?.(alignment);
                    }}
                >
                    {renderAlignmentIcon(alignment)}
                </button>
            ))}
        </div>
    );
}

function SortablePersonalHeaderRow({
    rowId,
    previewScale,
    children,
}) {
    const sortableId = personalHeaderDragId(rowId);
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: sortableId });
    const style = {
        transform: CSS.Translate.toString(normalizePreviewSortableTransform(transform, previewScale)),
        transition,
    };
    const handleProps = {
        ...attributes,
        'data-preview-drag-handle': 'true',
        'data-preview-drag-scope': 'personal-header',
        onPointerDown: (event) => {
            if (
                event.target.closest(
                    '[data-personal-alignment-menu], [data-preview-drag-scope="personal-contact"], .summaryResizeHandle, .summaryResizeEdge, button, input, textarea, select, a',
                )
            ) {
                return;
            }

            listeners?.onPointerDown?.(event);
        },
        onKeyDown: listeners?.onKeyDown,
    };

    return (
        <div
            ref={setNodeRef}
            data-preview-sortable-id={sortableId}
            className={`personalHeaderRow personalHeaderRow--${rowId} previewSortableItem previewSortablePersonalHeader ${isDragging ? 'isPreviewSortingPlaceholder' : ''}`}
            style={style}
            data-personal-header-row={rowId}
            {...handleProps}
        >
            {children}
        </div>
    );
}

function StaticPreviewBullet({ editProps, children }) {
    return <li data-page-break-kind="item" {...editProps}>{children}</li>;
}

function HeaderLayoutSlot({
    id,
    field,
    label,
    renderChip,
}) {
    const {
        setNodeRef: setDroppableNodeRef,
        isOver,
    } = useDroppable({ id });
    const {
        attributes,
        listeners,
        setNodeRef: setDraggableNodeRef,
        isDragging,
    } = useDraggable({ id, disabled: !field });
    const dragProps = field
        ? {
            ...attributes,
            ...listeners,
            'data-preview-drag-handle': 'true',
            'data-preview-drag-scope': 'header-layout',
        }
        : {};

    return (
        <div
            ref={setDroppableNodeRef}
            className={`entryHeaderLayoutSlot${field ? ' entryHeaderLayoutSlot--filled' : ' entryHeaderLayoutSlot--empty'}${isDragging ? ' isHeaderLayoutSource' : ''}${isOver && !isDragging ? ' isHeaderLayoutDropTarget' : ''}`}
            data-header-layout-slot="true"
        >
            {field ? (
                <span
                    ref={setDraggableNodeRef}
                    className="entryHeaderLayoutChip"
                    data-preview-sortable-id={id}
                    {...dragProps}
                >
                    {renderChip(field)}
                </span>
            ) : (
                <span className="entryHeaderLayoutEmpty" aria-label={label} />
            )}
        </div>
    );
}

function composeEventHandlers(primaryHandler, secondaryHandler) {
    return (event) => {
        primaryHandler?.(event);

        if (!event.defaultPrevented) {
            secondaryHandler?.(event);
        }
    };
}

function HeaderLayoutField({
    id,
    className,
    editProps,
    children,
    dragEnabled = false,
    onFieldHover,
    onFieldLeave,
}) {
    const {
        setNodeRef: setDroppableNodeRef,
        isOver,
    } = useDroppable({ id, disabled: !dragEnabled });
    const {
        listeners,
        setNodeRef: setDraggableNodeRef,
        isDragging,
    } = useDraggable({ id, disabled: !dragEnabled });
    const setNodeRef = (node) => {
        setDroppableNodeRef(node);
        setDraggableNodeRef(node);
    };
    const dragProps = dragEnabled
        ? {
            'data-preview-sortable-id': id,
            'data-preview-drag-handle': 'true',
            'data-preview-drag-scope': 'header-layout',
        }
        : {};

    return (
        <span
            ref={setNodeRef}
            className={`${className} entryHeaderLayoutField${dragEnabled ? ' entryHeaderLayoutField--draggable' : ''}${isDragging ? ' isHeaderLayoutSource' : ''}${isOver && !isDragging ? ' isHeaderLayoutDropTarget' : ''}`}
            {...dragProps}
            {...editProps}
            onPointerEnter={onFieldHover}
            onPointerLeave={onFieldLeave}
            onFocus={onFieldHover}
            onBlur={onFieldLeave}
            onPointerDown={dragEnabled
                ? composeEventHandlers(editProps?.onPointerDown, listeners?.onPointerDown)
                : editProps?.onPointerDown}
            onKeyDown={editProps?.onKeyDown}
        >
            {children}
        </span>
    );
}

function HeaderLayoutHoverSlot({ id, label }) {
    const {
        setNodeRef,
        isOver,
    } = useDroppable({ id });

    return (
        <span
            ref={setNodeRef}
            className={`entryHeaderHoverSlot${isOver ? ' isHeaderLayoutDropTarget' : ''}`}
            aria-label={label}
            data-header-hover-slot="true"
        />
    );
}

function getPrimaryEntryField(block, entry) {
    if (block.kind === 'education') {
        return entry.school ? 'school' : 'degree';
    }

    if (block.kind === 'roles') {
        return entry.company ? 'company' : 'role';
    }

    if (block.kind === 'skills') {
        return entry.category ? 'category' : 'items';
    }

    if (block.kind === 'projects') {
        return entry.name ? 'name' : 'summary';
    }

    if (block.kind === 'certifications') {
        return entry.name ? 'name' : 'issuer';
    }

    if (block.kind === 'languages') {
        return entry.language ? 'language' : 'proficiency';
    }

    if (block.kind === 'awards' || block.kind === 'publications' || block.kind === 'custom') {
        return entry.title ? 'title' : 'details';
    }

    return 'title';
}

function moveIdWithinOrder(ids, activeId, overId) {
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

function previewVerticalListSortingStrategy({
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

function getPreviewBulletText(item) {
    if (item && typeof item === 'object') {
        return item.text || '';
    }

    return item === undefined || item === null ? '' : String(item);
}

function getPreviewBulletSourceIndex(item, fallbackIndex) {
    if (item && typeof item === 'object' && Number.isInteger(item.sourceIndex)) {
        return item.sourceIndex;
    }

    return fallbackIndex;
}

function getPreviewScaleFromElement(resumeElement) {
    const shellElement = resumeElement.closest('.previewPageScaleShell');
    const shellStyles = shellElement ? window.getComputedStyle(shellElement) : null;
    const scale = parseCssPixelValue(shellStyles?.getPropertyValue('--preview-page-scale'), 1);

    return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function getCandidateBounds(element, resumeRect, previewScale, paddingTop) {
    const rect = element.getBoundingClientRect();
    const top = ((rect.top - resumeRect.top) / previewScale) - paddingTop;
    const bottom = ((rect.bottom - resumeRect.top) / previewScale) - paddingTop;

    return { top, bottom };
}

function collectPreviewBreakCandidates(resumeElement, paddingTop) {
    const resumeRect = resumeElement.getBoundingClientRect();
    const previewScale = getPreviewScaleFromElement(resumeElement);
    const candidates = [];

    resumeElement.querySelectorAll('[data-page-break-kind="entry"]').forEach((entryElement) => {
        const sectionElement = entryElement.closest('[data-page-break-kind="section"]');
        const firstSectionEntry = sectionElement?.querySelector('[data-page-break-kind="entry"]');
        const isFirstSectionEntry = firstSectionEntry === entryElement;

        candidates.push({
            ...getCandidateBounds(entryElement, resumeRect, previewScale, paddingTop),
            priority: 2,
            snapDistance: isFirstSectionEntry ? FIRST_SECTION_ENTRY_SNAP_DISTANCE_PX : undefined,
        });
    });

    resumeElement.querySelectorAll('[data-page-break-kind="item"]').forEach((itemElement) => {
        candidates.push({
            ...getCandidateBounds(itemElement, resumeRect, previewScale, paddingTop),
            priority: 3,
        });
    });

    return candidates;
}

export default function ResumePreview({
    previewModel,
    template,
    settings,
    isSamplePreview = false,
    panelRef,
    onEditTarget,
    onLayoutChange,
    onReorderSections,
    onReorderSectionEntries,
    onReorderSectionTextList,
    onReorderPersonalContact,
    onPersonalAlignmentChange,
    onPersonalHeaderOrderChange,
    onSetSectionEntryHeaderLayout,
    onSummaryWidthChange,
    onSeparatorSettingsOpen,
    activeEditorCaret,
    previewPulseTarget,
    showEmptyResumeChoice = false,
    emptyChoiceNudgeCount = 0,
    isImportingResume = false,
    showSampleInformationToggle = false,
    showSampleInformation = true,
    onImportResume,
    onStartFromScratch,
    onToggleSampleInformation,
}) {
    const resumeRef = useRef(null);
    const previewFrameRef = useRef(null);
    const suppressPreviewClickRef = useRef(false);
    const activeDragScrollRef = useRef({ x: 0, y: 0, captured: false });
    const activeDragInitialRectRef = useRef(null);
    const summaryWidthDragRef = useRef(null);
    const headerLayoutDoubleClickRef = useRef(null);
    const headerLayoutLongPressRef = useRef(null);
    const [activeDragMeta, setActiveDragMeta] = useState(null);
    const [activeDragRect, setActiveDragRect] = useState(null);
    const [activeHeaderLayout, setActiveHeaderLayout] = useState(null);
    const [hoverHeaderLayout, setHoverHeaderLayout] = useState(null);
    const [summaryWidthDrag, setSummaryWidthDrag] = useState(null);
    const isPreviewDragActive = Boolean(activeDragMeta?.type);
    const canShowHeaderLayoutHover = !activeDragMeta?.type || activeDragMeta.type === 'headerSlot';
    const [pageMetrics, setPageMetrics] = useState({
        pageWidth: 0,
        pageHeight: 0,
        contentHeight: 0,
        pageCount: 1,
        pageBreaks: [],
        scale: 1,
        layoutWidth: 0,
    });
    const presentationVars = useMemo(() => getResumePresentationVars(settings, template), [settings, template]);
    const printPageRule = useMemo(() => getResumePrintPageRule(settings, template), [settings, template]);
    const personalAlignment = useMemo(() => getEffectivePersonalAlignment(settings, template), [settings, template]);
    const personalHeaderOrder = useMemo(() => normalizePersonalHeaderOrder(settings?.personalHeaderOrder), [settings?.personalHeaderOrder]);
    const summaryWidthPercent = clampSummaryWidthPercent(settings?.summaryWidthPercent);
    const renderedSummaryWidthPercent = summaryWidthDrag?.percent || summaryWidthPercent;
    const canResizeSummary = template !== 'executive' && typeof onSummaryWidthChange === 'function';
    const sectionSeparatorPosition = settings?.sectionSeparatorPosition === 'belowSectionName'
        ? 'belowSectionName'
        : 'aboveSectionName';
    const sensors = useSensors(
        useSensor(ResumeLoomrPointerSensor, { activationConstraint: { distance: 6 } }),
        useSensor(ResumeLoomrKeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    );
    const previewDragMeasuring = useMemo(() => ({
        droppable: {
            strategy: MeasuringStrategy.Always,
            frequency: MeasuringFrequency.Optimized,
        },
    }), []);
    const personalDetails = useMemo(() => {
        const detailByField = new Map(
            [
                { text: previewModel.personal.location, field: 'location' },
                { text: previewModel.personal.phone, field: 'phone' },
                { text: previewModel.personal.email, field: 'email' },
                ...previewModel.personal.links.map((link) => ({
                    text: link.text,
                    field: personalLinkFieldMap[link.id] || 'customField'
                }))
            ].filter((item) => PERSONAL_CONTACT_FIELDS.includes(item.field) && item.text)
                .map((item) => [item.field, item]),
        );
        const orderedFields = normalizePersonalContactOrder(settings?.personalContactOrder);

        return orderedFields.map((field) => detailByField.get(field)).filter(Boolean);
    }, [previewModel.personal, settings?.personalContactOrder]);
    const visiblePersonalHeaderRows = useMemo(() => (
        personalHeaderOrder.filter((rowId) => (
            rowId === 'headline'
                ? Boolean(previewModel.personal.headline)
                : personalDetails.length > 0
        ))
    ), [personalDetails.length, personalHeaderOrder, previewModel.personal.headline]);

    useEffect(() => {
        if (!activeHeaderLayout?.sectionId || typeof document === 'undefined') {
            return undefined;
        }

        function handleDocumentPointerDown(event) {
            if (
                event.target.closest('[data-header-layout-mode="true"]') ||
                event.target.closest('[data-header-layout-trigger="true"]')
            ) {
                return;
            }

            setActiveHeaderLayout(null);
        }

        function handleDocumentKeyDown(event) {
            if (event.key === 'Escape') {
                setActiveHeaderLayout(null);
            }
        }

        document.addEventListener('pointerdown', handleDocumentPointerDown, true);
        document.addEventListener('keydown', handleDocumentKeyDown);

        return () => {
            document.removeEventListener('pointerdown', handleDocumentPointerDown, true);
            document.removeEventListener('keydown', handleDocumentKeyDown);
        };
    }, [activeHeaderLayout]);

    useLayoutEffect(() => {
        if (typeof window === 'undefined') {
            return undefined;
        }

        let frameId = 0;

        function updateWrappedHeaderSeparators() {
            const root = resumeRef.current;

            if (!root) {
                return;
            }

            root.querySelectorAll('[data-entry-header-side="true"]').forEach((sideElement) => {
                const items = Array.from(sideElement.querySelectorAll('[data-entry-header-item="true"]'));

                items.forEach((item, index) => {
                    const separator = item.querySelector('.entryHeaderFieldSeparator');

                    if (!separator) {
                        return;
                    }

                    const previousItem = items[index - 1];
                    const shouldHideSeparator = previousItem
                        ? item.getBoundingClientRect().top > previousItem.getBoundingClientRect().top + 1
                        : false;

                    separator.classList.toggle('entryHeaderFieldSeparator--wrapped', shouldHideSeparator);
                });
            });
        }

        function scheduleUpdate() {
            window.cancelAnimationFrame(frameId);
            frameId = window.requestAnimationFrame(updateWrappedHeaderSeparators);
        }

        scheduleUpdate();
        window.addEventListener('resize', scheduleUpdate);

        let resizeObserver;

        if (typeof ResizeObserver !== 'undefined' && resumeRef.current) {
            resizeObserver = new ResizeObserver(scheduleUpdate);
            resizeObserver.observe(resumeRef.current);
        }

        return () => {
            window.cancelAnimationFrame(frameId);
            window.removeEventListener('resize', scheduleUpdate);
            resizeObserver?.disconnect();
        };
    }, [previewModel, presentationVars, activeHeaderLayout]);

    function previewPulseAttributes(path) {
        return previewPulseTarget?.path === path && previewPulseTarget?.requestId
            ? { 'data-preview-pulse': previewPulseTarget.requestId % 2 === 0 ? 'even' : 'odd' }
            : {};
    }

    useEffect(() => {
        if (typeof window === 'undefined') {
            return undefined;
        }

        let frameId = 0;

        function readPageMetrics() {
            const resumeElement = resumeRef.current;
            const frameElement = previewFrameRef.current;

            if (!resumeElement || !frameElement) {
                setPageMetrics((current) => {
                    const next = {
                        pageWidth: 0,
                        pageHeight: 0,
                        contentHeight: 0,
                        pageCount: 1,
                        pageBreaks: [],
                        scale: 1,
                        layoutWidth: 0,
                    };

                    return metricsAreEqual(current, next) ? current : next;
                });
                return;
            }

            const styles = window.getComputedStyle(resumeElement);
            const frameRect = frameElement.getBoundingClientRect();
            const availableWidth = Math.max(240, frameElement.clientWidth || frameRect.width);
            const pageWidth = PRINT_PAGE_WIDTH_PX;
            const pageHeight = PRINT_PAGE_HEIGHT_PX;
            const paddingTop = parseCssLengthToPixels(styles.paddingTop);
            const paddingBottom = parseCssLengthToPixels(styles.paddingBottom);
            const printableHeight = Math.max(1, pageHeight - paddingTop - paddingBottom);
            const contentFlowHeight = previewModel.hasContent
                ? Math.max(printableHeight, resumeElement.scrollHeight - paddingTop - paddingBottom)
                : printableHeight;
            const pageBreaks = previewModel.hasContent
                ? calculatePreviewPageBreaks({
                    contentHeight: contentFlowHeight,
                    printableHeight,
                    breakCandidates: collectPreviewBreakCandidates(resumeElement, paddingTop),
                })
                : [];
            const markerBreaks = pageBreaks.map((pageBreak) => Math.round(paddingTop + pageBreak));
            const pageCount = markerBreaks.length + 1;
            const contentHeight = Math.max(pageHeight, paddingTop + contentFlowHeight + paddingBottom);
            const availableHeight = Math.max(
                320,
                window.innerHeight - getPreviewStickyTop(frameElement) - 24,
            );
            const fitPageHeightScale = Math.min(availableHeight / pageHeight, 1);
            const widthScale = Math.min(availableWidth / pageWidth, 1);
            const fullPageScale = Math.min(widthScale, fitPageHeightScale, 1);
            const scale = Math.max(0.35, fullPageScale);
            const layoutScale = Math.max(0.35, fitPageHeightScale);
            const nextMetrics = {
                pageWidth: Math.round(pageWidth),
                pageHeight: Math.round(pageHeight),
                contentHeight: Math.round(contentHeight),
                pageCount,
                pageBreaks: markerBreaks,
                scale: Number(scale.toFixed(4)),
                layoutWidth: Math.round(pageWidth * layoutScale),
            };

            setPageMetrics((current) => (metricsAreEqual(current, nextMetrics) ? current : nextMetrics));
        }

        function scheduleRead() {
            window.cancelAnimationFrame(frameId);
            frameId = window.requestAnimationFrame(readPageMetrics);
        }

        scheduleRead();
        window.addEventListener('resize', scheduleRead);

        let resizeObserver;

        if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(scheduleRead);

            if (resumeRef.current) {
                resizeObserver.observe(resumeRef.current);
            }

            if (previewFrameRef.current) {
                resizeObserver.observe(previewFrameRef.current);
            }
        }

        return () => {
            window.cancelAnimationFrame(frameId);
            window.removeEventListener('resize', scheduleRead);
            resizeObserver?.disconnect();
        };
    }, [previewModel, presentationVars]);

    useLayoutEffect(() => {
        if (typeof document === 'undefined') {
            return undefined;
        }

        const styleId = 'resumeloomr-print-page-rule';
        let styleElement = document.getElementById(styleId);

        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = styleId;
            styleElement.media = 'print';
            document.head.appendChild(styleElement);
        }

        styleElement.textContent = printPageRule;

        return () => {
            if (styleElement?.parentNode && styleElement.textContent === printPageRule) {
                styleElement.parentNode.removeChild(styleElement);
            }
        };
    }, [printPageRule]);

    useEffect(() => {
        if (!onLayoutChange) {
            return undefined;
        }

        const isFitPageLayout = pageMetrics.pageWidth > 0
            && pageMetrics.layoutWidth > 0;
        const nextLayout = isFitPageLayout
            ? {
                mode: 'fitPage',
                width: pageMetrics.layoutWidth,
            }
            : {
                mode: 'fitPage',
                width: 0,
            };

        onLayoutChange(nextLayout);

        return undefined;
    }, [onLayoutChange, pageMetrics.layoutWidth, pageMetrics.pageWidth, previewModel.hasContent]);

    function personalTarget(field) {
        const path = personalEditorPath(field);

        return {
            ...createPreviewEditAttributes({
                sectionId: 'personal',
                field,
                path,
            }),
            ...previewPulseAttributes(path),
        };
    }

    function personalContactRowTarget() {
        const field = personalDetails[0]?.field || 'location';

        return personalTarget(field);
    }

    function handlePersonalAlignmentChange(alignment) {
        onPersonalAlignmentChange?.(alignment);
    }

    function sectionTitleTarget(sectionId) {
        const path = sectionTitleEditorPath(sectionId);

        return {
            ...createPreviewEditAttributes({
                sectionId,
                field: '__title',
                path,
            }),
            ...previewPulseAttributes(path),
        };
    }

    function entryTarget(sectionId, entryId, field) {
        const path = sectionEntryEditorPath(sectionId, entryId, field);

        return {
            ...createPreviewEditAttributes({
                sectionId,
                entryId,
                field,
                path,
            }),
            ...previewPulseAttributes(path),
        };
    }

    function listTarget(sectionId, entryId, field, itemIndex) {
        const path = sectionEntryListEditorPath(sectionId, entryId, field, itemIndex);

        return {
            ...createPreviewEditAttributes({
                sectionId,
                entryId,
                field,
                itemIndex,
                path,
            }),
            ...previewPulseAttributes(path),
        };
    }

    function nestedTarget(sectionId, entryId, nestedPath) {
        const pathParts = nestedPath.split('.');
        const path = sectionEntryNestedEditorPath(sectionId, entryId, nestedPath);

        return {
            ...createPreviewEditAttributes({
                sectionId,
                entryId,
                field: pathParts[pathParts.length - 1] || nestedPath,
                nestedPath,
                path,
            }),
            ...previewPulseAttributes(path),
        };
    }

    function getEntryContainerField(block, entry, fallbackField = 'title') {
        if (block.kind === 'education' || block.kind === 'roles' || block.kind === 'custom') {
            return getEntryHeaderPrimaryDragField(block, entry) || fallbackField;
        }

        if (block.kind === 'skills') {
            return entry.category ? 'category' : 'items';
        }

        if (block.kind === 'projects') {
            return 'name';
        }

        if (block.kind === 'languages') {
            return 'language';
        }

        if (block.kind === 'certifications') {
            return 'name';
        }

        return fallbackField;
    }

    function entryContainerTarget(block, entry, fallbackField = 'title') {
        return entryTarget(block.id, entry.id, getEntryContainerField(block, entry, fallbackField));
    }

    function renderTextWithCaret(value, path, { prefix = '', suffix = '', fallback = '' } = {}) {
        const text = value === undefined || value === null ? '' : String(value);
        const displayText = text || fallback;
        const hasUserCaretValue = typeof activeEditorCaret?.value === 'string' && activeEditorCaret.value.length > 0;
        const shouldShowCaret = (
            (!isSamplePreview || hasUserCaretValue) &&
            !activeDragMeta?.type &&
            activeEditorCaret?.path === path &&
            Number.isFinite(activeEditorCaret.offset)
        );

        if (!shouldShowCaret) {
            return `${prefix}${displayText}${suffix}`;
        }

        const caretText = typeof activeEditorCaret.value === 'string'
            ? activeEditorCaret.value
            : text;
        const caretOffset = Math.max(0, Math.min(activeEditorCaret.offset, caretText.length));
        const beforeCaret = caretText.slice(0, caretOffset);
        const afterCaret = caretText.slice(caretOffset);

        return (
            <>
                {prefix}
                {beforeCaret && (
                    <span className="previewTextCaretSegment">{beforeCaret}</span>
                )}
                <span className="previewTextCaret" aria-hidden="true" />
                {afterCaret ? (
                    <span className="previewTextCaretSegment">{afterCaret}</span>
                ) : (
                    caretText ? '' : fallback
                )}
                {suffix}
            </>
        );
    }

    function clearHeaderLayoutLongPress() {
        if (headerLayoutLongPressRef.current?.timerId) {
            window.clearTimeout(headerLayoutLongPressRef.current.timerId);
        }

        headerLayoutLongPressRef.current = null;
    }

    function clearHeaderLayoutDoubleClick() {
        headerLayoutDoubleClickRef.current = null;
    }

    function openHeaderLayoutMode(event, sectionId, entryId) {
        event.preventDefault();
        event.stopPropagation();
        suppressNextPreviewClick();
        clearHeaderLayoutLongPress();
        clearHeaderLayoutDoubleClick();
        setActiveHeaderLayout({ sectionId, entryId });
    }

    function handleHeaderLayoutPointerDown(event, sectionId, entryId) {
        if (event.pointerType === 'mouse') {
            const previousClick = headerLayoutDoubleClickRef.current;
            const clickTarget = { sectionId, entryId };
            const isSameEntry = previousClick?.sectionId === sectionId && previousClick?.entryId === entryId;
            const isFastEnough = previousClick
                ? event.timeStamp - previousClick.timeStamp <= HEADER_LAYOUT_DOUBLE_CLICK_MS
                : false;
            const isCloseEnough = previousClick
                ? Math.hypot(event.clientX - previousClick.x, event.clientY - previousClick.y) <= HEADER_LAYOUT_DOUBLE_CLICK_TOLERANCE_PX
                : false;

            if (isSameEntry && isFastEnough && isCloseEnough) {
                openHeaderLayoutMode(event, sectionId, entryId);
                return true;
            }

            headerLayoutDoubleClickRef.current = {
                ...clickTarget,
                pointerId: event.pointerId,
                x: event.clientX,
                y: event.clientY,
                timeStamp: event.timeStamp,
            };
            return false;
        }

        clearHeaderLayoutLongPress();
        headerLayoutLongPressRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            timerId: window.setTimeout(() => {
                suppressNextPreviewClick();
                setActiveHeaderLayout({ sectionId, entryId });
                headerLayoutLongPressRef.current = null;
            }, HEADER_LAYOUT_LONG_PRESS_MS),
        };
        return false;
    }

    function handleHeaderLayoutPointerMove(event) {
        const doubleClick = headerLayoutDoubleClickRef.current;

        if (doubleClick?.pointerId === event.pointerId) {
            const distance = Math.hypot(event.clientX - doubleClick.x, event.clientY - doubleClick.y);

            if (distance > HEADER_LAYOUT_DOUBLE_CLICK_TOLERANCE_PX) {
                clearHeaderLayoutDoubleClick();
            }
        }

        const longPress = headerLayoutLongPressRef.current;

        if (!longPress || longPress.pointerId !== event.pointerId) {
            return;
        }

        const distance = Math.hypot(event.clientX - longPress.startX, event.clientY - longPress.startY);

        if (distance > HEADER_LAYOUT_LONG_PRESS_MOVE_TOLERANCE_PX) {
            clearHeaderLayoutLongPress();
        }
    }

    function handlePreviewClick(event) {
        if (suppressPreviewClickRef.current) {
            return;
        }

        if (!onEditTarget) {
            return;
        }

        if (activeHeaderLayout?.sectionId) {
            if (event.target.closest('[data-header-layout-mode="true"]')) {
                event.preventDefault();
                return;
            }

            setActiveHeaderLayout(null);
        }

        const targetElement = event.target.closest('[data-edit-section-id][data-edit-path]');

        if (!targetElement || !resumeRef.current?.contains(targetElement)) {
            return;
        }

        event.preventDefault();

        onEditTarget({
            sectionId: targetElement.dataset.editSectionId,
            field: targetElement.dataset.editField || '',
            entryId: targetElement.dataset.editEntryId || '',
            itemIndex: targetElement.dataset.editItemIndex ? Number(targetElement.dataset.editItemIndex) : undefined,
            nestedPath: targetElement.dataset.editNestedPath || '',
            path: targetElement.dataset.editPath,
            scrollX: window.scrollX,
            scrollY: window.scrollY,
        });
    }

    function suppressNextPreviewClick() {
        suppressPreviewClickRef.current = true;
        window.setTimeout(() => {
            suppressPreviewClickRef.current = false;
        }, 200);
    }

    function handleSummaryResizePointerDown(event, side) {
        if (!canResizeSummary) {
            return;
        }

        const summaryElement = event.currentTarget.closest('.aboutMe');
        const containerElement = summaryElement?.parentElement;
        const containerWidth = containerElement?.getBoundingClientRect().width || 0;

        if (!summaryElement || containerWidth <= 0) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.setPointerCapture?.(event.pointerId);
        suppressNextPreviewClick();

        const startPercent = clampSummaryWidthPercent(summaryWidthDrag?.percent || summaryWidthPercent);
        summaryWidthDragRef.current = {
            pointerId: event.pointerId,
            side,
            startX: event.clientX,
            startPercent,
            currentPercent: startPercent,
            containerWidth,
        };
        setSummaryWidthDrag({ percent: startPercent });
    }

    function handleSummaryResizePointerMove(event) {
        const drag = summaryWidthDragRef.current;

        if (!drag || drag.pointerId !== event.pointerId) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        const direction = drag.side === 'left' ? -1 : 1;
        const deltaPercent = ((event.clientX - drag.startX) * direction * 2 * 100) / drag.containerWidth;
        const nextPercent = clampSummaryWidthPercent(drag.startPercent + deltaPercent);

        drag.currentPercent = nextPercent;
        setSummaryWidthDrag((current) => (current?.percent === nextPercent ? current : { percent: nextPercent }));
    }

    function finishSummaryResize(event) {
        const drag = summaryWidthDragRef.current;

        if (!drag || drag.pointerId !== event.pointerId) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        event.currentTarget.releasePointerCapture?.(event.pointerId);
        suppressNextPreviewClick();
        summaryWidthDragRef.current = null;
        setSummaryWidthDrag(null);
        onSummaryWidthChange?.(drag.currentPercent);
    }

    function renderSummaryResizeHandle(corner, side) {
        return (
            <span
                aria-hidden="true"
                className={`summaryResizeHandle summaryResizeHandle--${corner}`}
                onPointerDown={(event) => handleSummaryResizePointerDown(event, side)}
                onPointerMove={handleSummaryResizePointerMove}
                onPointerUp={finishSummaryResize}
                onPointerCancel={finishSummaryResize}
            />
        );
    }

    function renderSummaryResizeEdge(side) {
        return (
            <span
                aria-hidden="true"
                className={`summaryResizeEdge summaryResizeEdge--${side}`}
                onPointerDown={(event) => handleSummaryResizePointerDown(event, side)}
                onPointerMove={handleSummaryResizePointerMove}
                onPointerUp={finishSummaryResize}
                onPointerCancel={finishSummaryResize}
            />
        );
    }

    function capturePreviewDragScroll() {
        activeDragScrollRef.current = {
            x: window.scrollX,
            y: window.scrollY,
            captured: true,
        };
    }

    function handlePreviewDragHandleCapture(event) {
        if (event.target.closest('[data-preview-drag-handle]')) {
            capturePreviewDragScroll();
        }
    }

    function getPreviewDragScrollTarget() {
        return activeDragScrollRef.current.captured
            ? {
                scrollX: activeDragScrollRef.current.x,
                scrollY: activeDragScrollRef.current.y,
            }
            : {
                scrollX: window.scrollX,
                scrollY: window.scrollY,
            };
    }

    function openPreviewEditTarget(target, scrollTarget = getPreviewDragScrollTarget()) {
        if (target?.path) {
            onEditTarget?.({
                ...target,
                ...scrollTarget,
            });
        }
    }

    function findBlock(sectionId) {
        return previewModel.sectionBlocks.find((block) => block.id === sectionId);
    }

    function findEntry(block, entryId) {
        return block?.entries.find((entry) => entry.id === entryId);
    }

    function handlePreviewDragStart(event) {
        if (!activeDragScrollRef.current.captured) {
            capturePreviewDragScroll();
        }

        setActiveDragMeta(parsePreviewDragId(event.active.id));
        setHoverHeaderLayout(null);
        const activeElement = getPreviewSortableElement(event.active.id);
        const rect = activeElement?.getBoundingClientRect() || event.active.rect.current.initial;
        activeDragInitialRectRef.current = rect
            ? {
                top: rect.top,
                right: rect.right,
                bottom: rect.bottom,
                left: rect.left,
                width: rect.width,
                height: rect.height,
            }
            : null;
        setActiveDragRect(rect ? { width: rect.width, height: rect.height } : null);
    }

    function handlePreviewDragCancel() {
        setActiveDragMeta(null);
        setActiveDragRect(null);
        setHoverHeaderLayout(null);
        activeDragInitialRectRef.current = null;
        activeDragScrollRef.current = { x: 0, y: 0, captured: false };
    }

    function handlePreviewDragEnd(event) {
        const activeMeta = parsePreviewDragId(event.active.id);
        const overMeta = event.over ? parsePreviewDragId(event.over.id) : null;
        const keepHeaderLayoutModeOpen = (
            activeMeta.type === 'headerSlot' &&
            activeHeaderLayout?.sectionId === activeMeta.sectionId &&
            activeHeaderLayout?.entryId === activeMeta.entryId
        );
        const scrollTarget = getPreviewDragScrollTarget();
        setActiveDragMeta(null);
        setActiveDragRect(null);
        setHoverHeaderLayout(null);
        activeDragInitialRectRef.current = null;
        activeDragScrollRef.current = { x: 0, y: 0, captured: false };

        if (!overMeta || !areCompatiblePreviewDragItems(activeMeta, overMeta)) {
            return;
        }

        suppressNextPreviewClick();

        if (activeMeta.type === 'personalContact') {
            const contactFields = personalDetails.map((detail) => detail.field);
            const nextContactFields = moveIdWithinOrder(contactFields, activeMeta.field, overMeta.field);

            if (nextContactFields !== contactFields) {
                onReorderPersonalContact?.(nextContactFields);
            }

            openPreviewEditTarget({
                sectionId: 'personal',
                field: activeMeta.field,
                path: personalEditorPath(activeMeta.field),
            }, scrollTarget);
            return;
        }

        if (activeMeta.type === 'personalHeader') {
            const nextVisibleOrder = moveIdWithinOrder(visiblePersonalHeaderRows, activeMeta.rowId, overMeta.rowId);

            if (nextVisibleOrder !== visiblePersonalHeaderRows) {
                onPersonalHeaderOrderChange?.(normalizePersonalHeaderOrder([
                    ...nextVisibleOrder,
                    ...personalHeaderOrder.filter((rowId) => !nextVisibleOrder.includes(rowId)),
                ]));
            }

            const field = activeMeta.rowId === 'headline'
                ? 'headline'
                : personalDetails[0]?.field || 'location';

            openPreviewEditTarget({
                sectionId: 'personal',
                field,
                path: personalEditorPath(field),
            }, scrollTarget);
            return;
        }

        if (activeMeta.type === 'headerSlot') {
            const block = findBlock(activeMeta.sectionId);
            const layout = block ? getEntryHeaderLayout(block) : null;
            const nextLayout = layout ? moveSectionHeaderField(layout, activeMeta, overMeta) : null;

            if (nextLayout) {
                onSetSectionEntryHeaderLayout?.(activeMeta.sectionId, nextLayout);

                if (keepHeaderLayoutModeOpen) {
                    setActiveHeaderLayout({
                        sectionId: activeMeta.sectionId,
                        entryId: activeMeta.entryId,
                    });
                }
            }

            return;
        }

        if (activeMeta.type === 'section') {
            const sectionIds = Array.isArray(previewModel.sectionOrder) && previewModel.sectionOrder.length > 0
                ? previewModel.sectionOrder
                : previewModel.sectionBlocks.map((block) => block.id);
            const nextSectionIds = moveIdWithinOrder(sectionIds, activeMeta.sectionId, overMeta.sectionId);

            if (nextSectionIds !== sectionIds) {
                onReorderSections?.(nextSectionIds);
            }

            openPreviewEditTarget({
                sectionId: activeMeta.sectionId,
                field: '__title',
                path: sectionTitleEditorPath(activeMeta.sectionId),
            }, scrollTarget);
            return;
        }

        if (activeMeta.type === 'entry') {
            const block = findBlock(activeMeta.sectionId);
            const entry = findEntry(block, activeMeta.entryId);

            if (!block || !entry) {
                return;
            }

            const entryIds = Array.isArray(block.entryOrder) && block.entryOrder.length > 0
                ? block.entryOrder
                : block.entries.map((blockEntry) => blockEntry.id);
            const nextEntryIds = moveIdWithinOrder(entryIds, activeMeta.entryId, overMeta.entryId);

            if (nextEntryIds !== entryIds) {
                onReorderSectionEntries?.(activeMeta.sectionId, nextEntryIds);
            }

            const field = getPrimaryEntryField(block, entry);
            openPreviewEditTarget({
                sectionId: activeMeta.sectionId,
                entryId: activeMeta.entryId,
                field,
                path: sectionEntryEditorPath(activeMeta.sectionId, activeMeta.entryId, field),
            }, scrollTarget);
            return;
        }

        if (activeMeta.type === 'bullet' && activeMeta.itemIndex !== overMeta.itemIndex) {
            onReorderSectionTextList?.(
                activeMeta.sectionId,
                activeMeta.entryId,
                activeMeta.field,
                activeMeta.itemIndex,
                overMeta.itemIndex,
            );

            openPreviewEditTarget({
                sectionId: activeMeta.sectionId,
                entryId: activeMeta.entryId,
                field: activeMeta.field,
                itemIndex: overMeta.itemIndex,
                path: sectionEntryListEditorPath(activeMeta.sectionId, activeMeta.entryId, activeMeta.field, overMeta.itemIndex),
            }, scrollTarget);
        }
    }

    function renderBulletEntries(items, { sectionId, entryId, field, createTarget, sortable = true } = {}) {
        if (items.length === 0) {
            return null;
        }

        const normalizedItems = items.map((item, index) => ({
            text: getPreviewBulletText(item),
            sourceIndex: getPreviewBulletSourceIndex(item, index),
        }));
        const bulletIds = normalizedItems.map((item) => bulletDragId(sectionId, entryId, field, item.sourceIndex));
        const bulletList = (
            <ul className="previewEntryList">
                {normalizedItems.map((item) => {
                    const bulletPath = sectionEntryListEditorPath(sectionId, entryId, field, item.sourceIndex);

                    return sortable ? (
                            <SortablePreviewBullet
                                key={`${entryId}-${field}-${item.sourceIndex}`}
                                sectionId={sectionId}
                                entryId={entryId}
                                field={field}
                                itemIndex={item.sourceIndex}
                                editProps={createTarget ? createTarget(item.sourceIndex) : {}}
                                previewScale={pageMetrics.scale}
                            >
                                {renderTextWithCaret(item.text, bulletPath)}
                            </SortablePreviewBullet>
                        ) : (
                            <StaticPreviewBullet
                                key={`${entryId}-${field}-${item.sourceIndex}`}
                                editProps={createTarget ? createTarget(item.sourceIndex) : {}}
                            >
                                {renderTextWithCaret(item.text, bulletPath)}
                            </StaticPreviewBullet>
                        );
                })}
            </ul>
        );

        if (!sortable) {
            return bulletList;
        }

        return (
            <SortableContext items={bulletIds} strategy={previewVerticalListSortingStrategy}>
                {bulletList}
            </SortableContext>
        );
    }

    function renderSimpleMetaSection({
        block,
        sectionClassName,
        detailLabel,
        detailKey,
        secondaryKey,
        dateKey = 'years',
        titleKey = 'title',
        sortable = true,
        showSeparator = true,
    }) {
        const entries = block.entries;
        const SectionShell = sortable ? SortablePreviewSection : StaticPreviewSection;
        const EntryShell = sortable ? SortablePreviewEntry : StaticPreviewEntry;

        if (entries.length === 0) {
            return null;
        }

        const entryItems = entries.map((entry) => entryDragId(block.id, entry.id));
        const entryList = entries.map((entry) => (
            <EntryShell
                key={entry.id}
                sectionId={block.id}
                entryId={entry.id}
                className="previewEntry"
                previewScale={pageMetrics.scale}
                entryEditProps={entryContainerTarget(block, entry, titleKey)}
            >
                {(entryHandleProps) => (
                    <>
                        <div className="previewEntryHeader">
                            <div
                                className="previewEntryTitle"
                                {...entryTarget(block.id, entry.id, titleKey)}
                                {...entryHandleProps}
                            >
                                {renderTextWithCaret(entry[titleKey], sectionEntryEditorPath(block.id, entry.id, titleKey))}
                            </div>
                            {entry[dateKey] && (
                                <div className="previewEntryMeta" {...entryTarget(block.id, entry.id, dateKey)}>
                                    {renderTextWithCaret(entry[dateKey], sectionEntryEditorPath(block.id, entry.id, dateKey))}
                                </div>
                            )}
                        </div>
                        {entry[secondaryKey] && (
                            <div className="previewEntrySubtitle" {...entryTarget(block.id, entry.id, secondaryKey)}>
                                {renderTextWithCaret(entry[secondaryKey], sectionEntryEditorPath(block.id, entry.id, secondaryKey))}
                            </div>
                        )}
                        {entry[detailKey] && (
                            <div className="previewEntryDetail" {...entryTarget(block.id, entry.id, detailKey)}>
                                {detailLabel ? <span className="educationDetailLabel">{detailLabel}:</span> : null}{detailLabel ? ' ' : null}
                                {renderTextWithCaret(entry[detailKey], sectionEntryEditorPath(block.id, entry.id, detailKey))}
                            </div>
                        )}
                    </>
                )}
            </EntryShell>
        ));

        return (
            <SectionShell
                key={block.id}
                blockId={block.id}
                className={`resumeSection ${sectionClassName}`}
                previewScale={pageMetrics.scale}
                showSeparator={showSeparator}
                onSeparatorSettingsOpen={onSeparatorSettingsOpen}
                separatorPosition={sectionSeparatorPosition}
            >
                {(sectionHandleProps, sectionSeparatorElement) => (
                    <>
                        <h2 data-page-break-kind="heading" {...sectionTitleTarget(block.id)} {...sectionHandleProps}>
                            {renderTextWithCaret(block.title, sectionTitleEditorPath(block.id))}
                        </h2>
                        {sectionSeparatorElement}
                        {sortable ? (
                            <SortableContext items={entryItems} strategy={previewVerticalListSortingStrategy}>
                                {entryList}
                            </SortableContext>
                        ) : entryList}
                    </>
                )}
            </SectionShell>
        );
    }

    function renderPersonalSection({ showSeparator = true } = {}) {
        if (!previewModel.showPersonal) {
            return null;
        }

        function renderPersonalHeadlineRow() {
            return (
                <div className="personalHeadline" {...personalTarget('headline')}>
                    {renderTextWithCaret(previewModel.personal.headline, personalEditorPath('headline'))}
                </div>
            );
        }

        function renderPersonalContactRow() {
            return (
                <div
                    className={`personalDetails ${personalDetails.length >= 4 ? 'personalDetails--wrap' : ''}`}
                    {...personalContactRowTarget()}
                >
                    <SortableContext
                        items={personalDetails.map((detail) => personalContactDragId(detail.field))}
                        strategy={horizontalListSortingStrategy}
                    >
                        {personalDetails.map((detail, index) => (
                            <SortablePersonalContact
                                key={`${detail.field}-${detail.text}-${index}`}
                                field={detail.field}
                                editProps={personalTarget(detail.field)}
                                previewScale={pageMetrics.scale}
                            >
                                {renderTextWithCaret(detail.text, personalEditorPath(detail.field))}
                            </SortablePersonalContact>
                        ))}
                    </SortableContext>
                </div>
            );
        }

        function renderPersonalHeaderRow(rowId) {
            const rowContent = rowId === 'headline'
                ? renderPersonalHeadlineRow()
                : renderPersonalContactRow();

            return (
                <SortablePersonalHeaderRow
                    key={rowId}
                    rowId={rowId}
                    previewScale={pageMetrics.scale}
                >
                    {rowContent}
                </SortablePersonalHeaderRow>
            );
        }

        return (
            <div className={previewSectionClassName('resumeSection personalSection', showSeparator)} key="personal">
                <PersonalAlignmentControls
                    activeAlignment={personalAlignment}
                    onAlignmentChange={handlePersonalAlignmentChange}
                />
                <h1 {...personalTarget('name')}>
                    {renderTextWithCaret(previewModel.personal.name, personalEditorPath('name'), { fallback: "Your Name" })}
                </h1>

                {visiblePersonalHeaderRows.length > 0 && (
                    <SortableContext
                        items={visiblePersonalHeaderRows.map((rowId) => personalHeaderDragId(rowId))}
                        strategy={previewVerticalListSortingStrategy}
                    >
                        {visiblePersonalHeaderRows.map(renderPersonalHeaderRow)}
                    </SortableContext>
                )}

                {previewModel.personal.aboutMe && (
                    <div
                        className={`aboutMe${summaryWidthDrag ? ' isSummaryWidthDragging' : ''}`}
                        style={canResizeSummary ? { '--resume-summary-active-width': `${renderedSummaryWidthPercent}%` } : undefined}
                        {...personalTarget('aboutMe')}
                    >
                        {renderTextWithCaret(previewModel.personal.aboutMe, personalEditorPath('aboutMe'))}
                        {canResizeSummary && (
                            <>
                                {renderSummaryResizeEdge('left')}
                                {renderSummaryResizeEdge('right')}
                                {renderSummaryResizeHandle('topLeft', 'left')}
                                {renderSummaryResizeHandle('topRight', 'right')}
                                {renderSummaryResizeHandle('bottomLeft', 'left')}
                                {renderSummaryResizeHandle('bottomRight', 'right')}
                            </>
                        )}
                    </div>
                )}
                {showSeparator && (
                    <button
                        type="button"
                        className="sectionSeparatorControl"
                        data-separator-scope="personal"
                        data-separator-section-id="personal"
                        aria-label="Personal separator settings"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={(event) => openSeparatorSettings(event, onSeparatorSettingsOpen, 'personal', 'personal')}
                    />
                )}
            </div>
        );
    }

    function renderEducationSection(block, { sortable = true, showSeparator = true } = {}) {
        const SectionShell = sortable ? SortablePreviewSection : StaticPreviewSection;
        const EntryShell = sortable ? SortablePreviewEntry : StaticPreviewEntry;
        const entryItems = block.entries.map((entry) => entryDragId(block.id, entry.id));
        const entries = block.entries.map((institution) => (
            <EntryShell
                key={institution.id}
                sectionId={block.id}
                entryId={institution.id}
                className="educationSection"
                previewScale={pageMetrics.scale}
                entryEditProps={entryContainerTarget(block, institution, 'school')}
                preferEntryDrag={institution.isSamplePlaceholderEntry}
            >
                {(entryHandleProps) => (
                    <>
                        {renderEntryHeader(block, institution, entryHandleProps)}
                        {institution.programs?.length > 0 && (
                            institution.programs.map((program, programIndex) => {
                                const programYears = program.yearsEdu || '';
                                const programYearsTarget = nestedTarget(block.id, institution.id, `programs.${programIndex}.yearsEdu`);
                                const programYearsPath = sectionEntryNestedEditorPath(block.id, institution.id, `programs.${programIndex}.yearsEdu`);
                                const programGpa = program.gpa || '';
                                const programGpaTarget = nestedTarget(block.id, institution.id, `programs.${programIndex}.gpa`);
                                const programGpaPath = sectionEntryNestedEditorPath(block.id, institution.id, `programs.${programIndex}.gpa`);

                                return (
                                    <div className="schoolLocationRow" key={program.id}>
                                        <div className="educationDegreeRow">
                                            {program.degree && (
                                                <span
                                                    className="degree"
                                                    {...nestedTarget(block.id, institution.id, `programs.${programIndex}.degree`)}
                                                >
                                                    {renderTextWithCaret(program.degree, sectionEntryNestedEditorPath(block.id, institution.id, `programs.${programIndex}.degree`))}
                                                </span>
                                            )}
                                            {programGpa && (
                                                <span
                                                    className="educationMeta educationGpaInline"
                                                    {...programGpaTarget}
                                                >
                                                    {renderTextWithCaret(programGpa, programGpaPath, {
                                                        prefix: program.degree ? ', GPA: ' : 'GPA: ',
                                                    })}
                                                </span>
                                            )}
                                            {program.honors && (
                                                <span
                                                    className="educationMeta"
                                                    {...nestedTarget(block.id, institution.id, `programs.${programIndex}.honors`)}
                                                >
                                                    {renderTextWithCaret(program.honors, sectionEntryNestedEditorPath(block.id, institution.id, `programs.${programIndex}.honors`), {
                                                        prefix: (program.degree || programGpa) ? ', ' : '',
                                                    })}
                                                </span>
                                            )}
                                        </div>
                                        {programYears && (
                                            <div className="yearsEdu" {...programYearsTarget}>
                                                {renderTextWithCaret(programYears, programYearsPath)}
                                            </div>
                                        )}
                                    </div>
                                );
                            })
                        )}
                        {institution.coursework && (
                            <div className="educationDetail" {...entryTarget(block.id, institution.id, 'coursework')}>
                                <span className="educationDetailLabel">Relevant coursework:</span>{' '}
                                {renderTextWithCaret(institution.coursework, sectionEntryEditorPath(block.id, institution.id, 'coursework'))}
                            </div>
                        )}
                        {institution.awards && (
                            <div className="educationDescription" {...entryTarget(block.id, institution.id, 'awards')}>
                                <span className="educationDetailLabel">Awards:</span>{' '}
                                {renderTextWithCaret(institution.awards, sectionEntryEditorPath(block.id, institution.id, 'awards'))}
                            </div>
                        )}
                        {institution.customSections.map((section, customSectionIndex) => (
                            <div className="educationDescription" key={section.id}>
                                <span
                                    className="educationDetailLabel"
                                    {...nestedTarget(block.id, institution.id, `customSections.${customSectionIndex}.label`)}
                                >
                                    {renderTextWithCaret(section.label, sectionEntryNestedEditorPath(block.id, institution.id, `customSections.${customSectionIndex}.label`), {
                                        fallback: 'Custom section',
                                        suffix: ':',
                                    })}
                                </span>
                                {' '}
                                <span {...nestedTarget(block.id, institution.id, `customSections.${customSectionIndex}.content`)}>
                                    {renderTextWithCaret(section.content, sectionEntryNestedEditorPath(block.id, institution.id, `customSections.${customSectionIndex}.content`))}
                                </span>
                            </div>
                        ))}
                    </>
                )}
            </EntryShell>
        ));

        return (
            <SectionShell
                key={block.id}
                blockId={block.id}
                className="resumeSection educationDiv"
                previewScale={pageMetrics.scale}
                showSeparator={showSeparator}
                onSeparatorSettingsOpen={onSeparatorSettingsOpen}
                separatorPosition={sectionSeparatorPosition}
            >
                {(sectionHandleProps, sectionSeparatorElement) => (
                    <>
                        <h2 data-page-break-kind="heading" {...sectionTitleTarget(block.id)} {...sectionHandleProps}>
                            {renderTextWithCaret(block.title, sectionTitleEditorPath(block.id))}
                        </h2>
                        {sectionSeparatorElement}
                        {sortable ? (
                            <SortableContext items={entryItems} strategy={previewVerticalListSortingStrategy}>
                                {entries}
                            </SortableContext>
                        ) : entries}
                    </>
                )}
            </SectionShell>
        );
    }

    function getEntryHeaderLayout(block) {
        return normalizeEntryHeaderLayout(block.kind, block.entryHeaderLayout) || getDefaultEntryHeaderLayout(block.kind);
    }

    function getEntryHeaderFields(block) {
        return ENTRY_HEADER_LAYOUT_FIELDS[block.kind] || [];
    }

    function getEntryHeaderPrimaryDragField(block, entry) {
        return getEntryHeaderFields(block).find((field) => entry[field]) || getEntryHeaderFields(block)[0];
    }

    function renderHeaderFieldText(block, entry, field) {
        const path = sectionEntryEditorPath(block.id, entry.id, field);
        const value = entry[field] || '';
        const caretOptions = block.kind === 'education' && field === 'gpa' && value
            ? { prefix: 'GPA: ' }
            : {};

        return renderTextWithCaret(value, path, caretOptions);
    }

    function getHeaderFieldDisplayValue(block, entry, field) {
        const value = entry[field] || '';

        if (block.kind === 'education' && field === 'gpa' && value) {
            return `GPA: ${value}`;
        }

        return value;
    }

    function entryHeaderFieldProps(block, entry, field, entryHandleProps = {}, useEntryDragHandle = true) {
        const path = sectionEntryEditorPath(block.id, entry.id, field);
        const dragProps = useEntryDragHandle && getEntryHeaderPrimaryDragField(block, entry) === field && !activeHeaderLayout?.sectionId
            ? entryHandleProps
            : {};

        return {
            ...entryTarget(block.id, entry.id, field),
            ...dragProps,
            'data-header-layout-trigger': 'true',
            onDoubleClick: (event) => openHeaderLayoutMode(event, block.id, entry.id),
            onPointerDown: (event) => {
                const openedLayoutMode = handleHeaderLayoutPointerDown(event, block.id, entry.id);

                if (openedLayoutMode) {
                    return;
                }

                dragProps.onPointerDown?.(event);
            },
            onPointerMove: (event) => {
                handleHeaderLayoutPointerMove(event);
                dragProps.onPointerMove?.(event);
            },
            onPointerUp: (event) => {
                clearHeaderLayoutLongPress();
                dragProps.onPointerUp?.(event);
            },
            onPointerCancel: (event) => {
                clearHeaderLayoutLongPress();
                clearHeaderLayoutDoubleClick();
                dragProps.onPointerCancel?.(event);
            },
            'data-entry-header-path': path,
        };
    }

    function renderNormalHeaderField(block, entry, field, slot, entryHandleProps = {}, headerDragEnabled = false) {
        if (!entry[field]) {
            return null;
        }

        const meta = getEntryHeaderFieldMeta(block.kind, field);
        const slotId = headerSlotDragId(block.id, entry.id, slot.lineIndex, slot.side, slot.slotIndex);

        return (
            <HeaderLayoutField
                key={field}
                id={slotId}
                className={meta.className}
                editProps={entryHeaderFieldProps(block, entry, field, entryHandleProps, !headerDragEnabled)}
                dragEnabled={headerDragEnabled}
                onFieldHover={() => {
                    if (canShowHeaderLayoutHover) {
                        setHoverHeaderLayout({
                            sectionId: block.id,
                            entryId: entry.id,
                            field,
                            ...slot,
                        });
                    }
                }}
                onFieldLeave={(event) => {
                    if (event?.buttons === 0 && !isHeaderSlotDragActiveForEntry(block.id, entry.id)) {
                        clearHoverHeaderLayout(block.id, entry.id);
                    }
                }}
            >
                {renderHeaderFieldText(block, entry, field)}
            </HeaderLayoutField>
        );
    }

    function renderHeaderSide(nodes) {
        const visibleNodes = nodes.filter(Boolean);

        if (visibleNodes.length === 0) {
            return null;
        }

        return visibleNodes.map((node, index) => (
            <span className="entryHeaderFieldGroupItem" data-entry-header-item="true" key={node.key || index}>
                {index > 0 && <span className="entryHeaderFieldSeparator">,</span>}
                {node}
            </span>
        ));
    }

    function renderEntryHeaderLine(block, entry, layout, lineIndex, entryHandleProps, headerDragEnabled) {
        const line = layout?.lines?.[lineIndex];
        const leftNodes = renderHeaderSide((line?.left || []).map((field, slotIndex) => (
            field ? renderNormalHeaderField(block, entry, field, { lineIndex, side: 'left', slotIndex }, entryHandleProps, headerDragEnabled) : null
        )));
        const rightNodes = renderHeaderSide((line?.right || []).map((field, slotIndex) => (
            field ? renderNormalHeaderField(block, entry, field, { lineIndex, side: 'right', slotIndex }, entryHandleProps, headerDragEnabled) : null
        )));

        if (!leftNodes && !rightNodes) {
            return null;
        }

        return (
            <div className={`entryHeaderLayoutLine ${lineIndex === 1 ? 'entryHeaderLayoutLine--secondary' : ''}`} key={`header-line-${lineIndex}`}>
                <div className="entryHeaderLayoutSide entryHeaderLayoutSide--left" data-entry-header-side="true">{leftNodes}</div>
                <div className="entryHeaderLayoutSide entryHeaderLayoutSide--right" data-entry-header-side="true">{rightNodes}</div>
            </div>
        );
    }

    function isHeaderSlotDragActiveForEntry(blockId, entryId) {
        return activeDragMeta?.type === 'headerSlot' && activeDragMeta.sectionId === blockId && activeDragMeta.entryId === entryId;
    }

    function getActiveHeaderSlotSource(blockId, entryId) {
        if (isHeaderSlotDragActiveForEntry(blockId, entryId)) {
            return activeDragMeta;
        }

        if (
            canShowHeaderLayoutHover &&
            hoverHeaderLayout?.sectionId === blockId &&
            hoverHeaderLayout?.entryId === entryId &&
            Number.isInteger(hoverHeaderLayout.lineIndex) &&
            Number.isInteger(hoverHeaderLayout.slotIndex)
        ) {
            return hoverHeaderLayout;
        }

        return null;
    }

    function getVisibleHeaderLayoutSignature(layout, entry) {
        return (layout?.lines || []).map((line) => (
            ['left', 'right'].map((side) => (
                (line[side] || [])
                    .filter((field) => field && entry[field])
                    .join('|')
            )).join('>')
        )).join('//');
    }

    function isSameHeaderLayoutSlot(firstSlot, secondSlot) {
        return (
            firstSlot?.lineIndex === secondSlot?.lineIndex &&
            firstSlot?.side === secondSlot?.side &&
            firstSlot?.slotIndex === secondSlot?.slotIndex
        );
    }

    function isMeaningfulHeaderLayoutTarget(layout, entry, sourceSlot, targetSlot) {
        if (!sourceSlot || isSameHeaderLayoutSlot(sourceSlot, targetSlot)) {
            return false;
        }

        const sourceField = getEntryHeaderLayoutSlotField(layout, sourceSlot);

        if (!sourceField || !entry[sourceField]) {
            return false;
        }

        const nextLayout = moveSectionHeaderField(layout, sourceSlot, targetSlot);

        return getVisibleHeaderLayoutSignature(nextLayout, entry) !== getVisibleHeaderLayoutSignature(layout, entry);
    }

    function clearHoverHeaderLayout(blockId, entryId) {
        setHoverHeaderLayout((current) => (
            current?.sectionId === blockId && current?.entryId === entryId
                ? null
                : current
        ));
    }

    function renderHoverHeaderSlotPlaceholder(block, entry, field) {
        const meta = getEntryHeaderFieldMeta(block.kind, field);
        const displayValue = getHeaderFieldDisplayValue(block, entry, field);

        return (
            <span className={`entryHeaderHoverSlotPlaceholder ${meta.className}`}>
                {displayValue}
            </span>
        );
    }

    function renderHoverHeaderSlotItem(block, entry, layout, sourceSlot, lineIndex, side, slotIndex, field) {
        const slotId = headerSlotDragId(block.id, entry.id, lineIndex, side, slotIndex);
        const meta = field
            ? getEntryHeaderFieldMeta(block.kind, field)
            : { label: 'Layout slot' };

        return field && entry[field] ? (
            <span className="entryHeaderHoverSlotPlaceholderWrap" key={slotId}>
                {renderHoverHeaderSlotPlaceholder(block, entry, field)}
            </span>
        ) : isMeaningfulHeaderLayoutTarget(layout, entry, sourceSlot, { lineIndex, side, slotIndex }) ? (
            <HeaderLayoutHoverSlot
                key={slotId}
                id={slotId}
                label={meta.label}
            />
        ) : null;
    }

    function renderHoverHeaderSlotSide(block, entry, layout, sourceSlot, line, lineIndex, side) {
        const slots = line[side] || [];
        const filledSlots = [];
        const emptySlots = [];

        slots.forEach((field, slotIndex) => {
            const slotItem = renderHoverHeaderSlotItem(block, entry, layout, sourceSlot, lineIndex, side, slotIndex, field);

            if (!slotItem) {
                return;
            }

            if (field && entry[field]) {
                filledSlots.push(slotItem);
            } else {
                emptySlots.push(slotItem);
            }
        });

        return side === 'right'
            ? [...emptySlots, ...filledSlots]
            : [...filledSlots, ...emptySlots];
    }

    function renderHoverHeaderSlotLayer(block, entry, layout, sourceSlot) {
        return (
            <div className={`entryHeaderHoverSlotLayer entryHeaderHoverSlotLayer--${block.kind}`} aria-hidden="true">
                {layout.lines.map((line, lineIndex) => (
                    <div className="entryHeaderHoverSlotLine" key={`hover-slot-line-${lineIndex}`}>
                        {['left', 'right'].map((side) => (
                            <div className={`entryHeaderHoverSlotSide entryHeaderHoverSlotSide--${side}`} key={`${lineIndex}-${side}`}>
                                {renderHoverHeaderSlotSide(block, entry, layout, sourceSlot, line, lineIndex, side)}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        );
    }

    function renderEntryHeaderNormal(block, entry, entryHandleProps) {
        const layout = getEntryHeaderLayout(block);
        const activeHeaderSlotSource = getActiveHeaderSlotSource(block.id, entry.id);
        const showHoverSlots = (
            canShowHeaderLayoutHover &&
            !activeHeaderLayout?.sectionId &&
            Boolean(activeHeaderSlotSource)
        );
        const headerDragEnabled = showHoverSlots;
        const lines = layout?.lines
            ?.map((_, lineIndex) => renderEntryHeaderLine(block, entry, layout, lineIndex, entryHandleProps, headerDragEnabled))
            .filter(Boolean);

        return (
            <div
                className={`entryHeaderLayoutInteractive${showHoverSlots ? ' entryHeaderLayoutInteractive--showSlots' : ''}`}
                onPointerEnter={() => {
                    if (canShowHeaderLayoutHover) {
                        setHoverHeaderLayout({ sectionId: block.id, entryId: entry.id });
                    }
                }}
                onPointerLeave={(event) => {
                    if (event.buttons === 0 && !isHeaderSlotDragActiveForEntry(block.id, entry.id)) {
                        clearHoverHeaderLayout(block.id, entry.id);
                    }
                }}
                onFocus={() => {
                    if (canShowHeaderLayoutHover) {
                        setHoverHeaderLayout({ sectionId: block.id, entryId: entry.id });
                    }
                }}
                onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) {
                        clearHoverHeaderLayout(block.id, entry.id);
                    }
                }}
            >
                {lines}
                {showHoverSlots ? renderHoverHeaderSlotLayer(block, entry, layout, activeHeaderSlotSource) : null}
            </div>
        );
    }

    function renderHeaderLayoutSlotChip(block, entry, field) {
        const meta = getEntryHeaderFieldMeta(block.kind, field);
        const displayValue = getHeaderFieldDisplayValue(block, entry, field);

        return (
            <span className={`entryHeaderLayoutChipText ${meta.className}${displayValue ? '' : ' entryHeaderLayoutChipText--empty'}`}>
                {displayValue || meta.label}
            </span>
        );
    }

    function renderHeaderLayoutMode(block, entry) {
        const layout = getEntryHeaderLayout(block);

        return (
            <div className="entryHeaderLayoutMode" data-header-layout-mode="true">
                <div className="entryHeaderLayoutModeBar">
                    <span>Drag fields to rearrange this section.</span>
                    <button
                        type="button"
                        className="entryHeaderLayoutReset"
                        onClick={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            onSetSectionEntryHeaderLayout?.(block.id, getDefaultEntryHeaderLayout(block.kind));
                        }}
                    >
                        Reset layout
                    </button>
                </div>
                <div className="entryHeaderLayoutGrid">
                    {layout.lines.map((line, lineIndex) => (
                        <div className="entryHeaderLayoutGridLine" key={`layout-mode-line-${lineIndex}`}>
                            {['left', 'right'].map((side) => (
                                <div className={`entryHeaderLayoutGridSide entryHeaderLayoutGridSide--${side}`} key={`${lineIndex}-${side}`}>
                                    {(line[side] || []).map((_, slotIndex) => {
                                        const field = line[side][slotIndex];
                                        const meta = field
                                            ? getEntryHeaderFieldMeta(block.kind, field)
                                            : { label: 'Empty slot' };

                                        return (
                                            <HeaderLayoutSlot
                                                key={headerSlotDragId(block.id, entry.id, lineIndex, side, slotIndex)}
                                                id={headerSlotDragId(block.id, entry.id, lineIndex, side, slotIndex)}
                                                field={field}
                                                label={meta.label}
                                                renderChip={(slotField) => renderHeaderLayoutSlotChip(block, entry, slotField)}
                                            />
                                        );
                                    })}
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    function renderEntryHeader(block, entry, entryHandleProps) {
        const isLayoutMode = activeHeaderLayout?.sectionId === block.id && activeHeaderLayout?.entryId === entry.id;

        if (isLayoutMode) {
            return renderHeaderLayoutMode(block, entry);
        }

        return renderEntryHeaderNormal(block, entry, entryHandleProps);
    }

    function renderRolesSection(block, { sortable = true, showSeparator = true } = {}) {
        const SectionShell = sortable ? SortablePreviewSection : StaticPreviewSection;
        const EntryShell = sortable ? SortablePreviewEntry : StaticPreviewEntry;
        const entryItems = block.entries.map((entry) => entryDragId(block.id, entry.id));
        const entries = block.entries.map((job) => (
            <EntryShell
                key={job.id}
                sectionId={block.id}
                entryId={job.id}
                className={`experienceSection${activeHeaderLayout?.sectionId === block.id ? ' experienceSection--layoutActiveSection' : ''}${activeHeaderLayout?.sectionId === block.id && activeHeaderLayout?.entryId === job.id ? ' experienceSection--layoutActiveEntry' : ''}`}
                previewScale={pageMetrics.scale}
                entryEditProps={entryContainerTarget(block, job, 'company')}
                preferEntryDrag={job.isSamplePlaceholderEntry}
            >
                {(entryHandleProps) => (
                    <>
                        {renderEntryHeader(block, job, entryHandleProps)}
                        {renderBulletEntries(job.activities, {
                            sectionId: block.id,
                            entryId: job.id,
                            field: 'activities',
                            createTarget: (activityIndex) => listTarget(block.id, job.id, 'activities', activityIndex),
                            sortable,
                        })}
                    </>
                )}
            </EntryShell>
        ));

        return (
            <SectionShell
                key={block.id}
                blockId={block.id}
                className="resumeSection experienceDiv"
                previewScale={pageMetrics.scale}
                showSeparator={showSeparator}
                onSeparatorSettingsOpen={onSeparatorSettingsOpen}
                separatorPosition={sectionSeparatorPosition}
            >
                {(sectionHandleProps, sectionSeparatorElement) => (
                    <>
                        <h2 data-page-break-kind="heading" {...sectionTitleTarget(block.id)} {...sectionHandleProps}>
                            {renderTextWithCaret(block.title, sectionTitleEditorPath(block.id))}
                        </h2>
                        {sectionSeparatorElement}
                        {sortable ? (
                            <SortableContext items={entryItems} strategy={previewVerticalListSortingStrategy}>
                                {entries}
                            </SortableContext>
                        ) : entries}
                    </>
                )}
            </SectionShell>
        );
    }

    function renderSkillsSection(block, { sortable = true, showSeparator = true } = {}) {
        const SectionShell = sortable ? SortablePreviewSection : StaticPreviewSection;
        const EntryShell = sortable ? SortablePreviewEntry : StaticPreviewEntry;
        const entryItems = block.entries.map((entry) => entryDragId(block.id, entry.id));
        const entries = block.entries.map((entry) => (
            <EntryShell
                key={entry.id}
                sectionId={block.id}
                entryId={entry.id}
                className="skillGroup"
                previewScale={pageMetrics.scale}
                entryEditProps={entryContainerTarget(block, entry, 'items')}
                preferEntryDrag={entry.isSamplePlaceholderEntry}
            >
                {(entryHandleProps) => (
                    <>
                        {entry.category && (
                            <>
                                <span
                                    className="skillGroupTitle"
                                    {...entryTarget(block.id, entry.id, 'category')}
                                    {...entryHandleProps}
                                >
                                    {renderTextWithCaret(entry.category, sectionEntryEditorPath(block.id, entry.id, 'category'))}
                                </span>
                                {entry.items && <span className="skillGroupSeparator">: </span>}
                            </>
                        )}
                        {entry.items && (
                            <span
                                className="skillGroupItems"
                                {...entryTarget(block.id, entry.id, 'items')}
                                {...(!entry.category ? entryHandleProps : {})}
                            >
                                {renderTextWithCaret(entry.items, sectionEntryEditorPath(block.id, entry.id, 'items'))}
                            </span>
                        )}
                    </>
                )}
            </EntryShell>
        ));

        return (
            <SectionShell
                key={block.id}
                blockId={block.id}
                className="resumeSection skillsDiv"
                previewScale={pageMetrics.scale}
                showSeparator={showSeparator}
                onSeparatorSettingsOpen={onSeparatorSettingsOpen}
                separatorPosition={sectionSeparatorPosition}
            >
                {(sectionHandleProps, sectionSeparatorElement) => (
                    <>
                        <h2 data-page-break-kind="heading" {...sectionTitleTarget(block.id)} {...sectionHandleProps}>
                            {renderTextWithCaret(block.title, sectionTitleEditorPath(block.id))}
                        </h2>
                        {sectionSeparatorElement}
                        {sortable ? (
                            <SortableContext items={entryItems} strategy={previewVerticalListSortingStrategy}>
                                {entries}
                            </SortableContext>
                        ) : entries}
                    </>
                )}
            </SectionShell>
        );
    }

    function renderProjectsSection(block, { sortable = true, showSeparator = true } = {}) {
        const SectionShell = sortable ? SortablePreviewSection : StaticPreviewSection;
        const EntryShell = sortable ? SortablePreviewEntry : StaticPreviewEntry;
        const entryItems = block.entries.map((entry) => entryDragId(block.id, entry.id));
        const entries = block.entries.map((entry) => (
            <EntryShell
                key={entry.id}
                sectionId={block.id}
                entryId={entry.id}
                className={`previewEntry${activeHeaderLayout?.sectionId === block.id ? ' previewEntry--layoutActiveSection' : ''}${activeHeaderLayout?.sectionId === block.id && activeHeaderLayout?.entryId === entry.id ? ' previewEntry--layoutActiveEntry' : ''}`}
                previewScale={pageMetrics.scale}
                entryEditProps={entryContainerTarget(block, entry, 'name')}
                preferEntryDrag={entry.isSamplePlaceholderEntry}
            >
                {(entryHandleProps) => (
                    <>
                        <div className="previewEntryHeader">
                            <div
                                className="previewEntryTitle"
                                {...entryTarget(block.id, entry.id, 'name')}
                                {...entryHandleProps}
                            >
                                {renderTextWithCaret(entry.name, sectionEntryEditorPath(block.id, entry.id, 'name'))}
                            </div>
                            {entry.years && (
                                <div className="previewEntryMeta" {...entryTarget(block.id, entry.id, 'years')}>
                                    {renderTextWithCaret(entry.years, sectionEntryEditorPath(block.id, entry.id, 'years'))}
                                </div>
                            )}
                        </div>
                        {entry.subtitle && (
                            <div className="previewEntrySubtitle" {...entryTarget(block.id, entry.id, 'subtitle')}>
                                {renderTextWithCaret(entry.subtitle, sectionEntryEditorPath(block.id, entry.id, 'subtitle'))}
                            </div>
                        )}
                        {entry.summary && (
                            <div className="previewEntryDetail" {...entryTarget(block.id, entry.id, 'summary')}>
                                {renderTextWithCaret(entry.summary, sectionEntryEditorPath(block.id, entry.id, 'summary'))}
                            </div>
                        )}
                        {renderBulletEntries(entry.highlights, {
                            sectionId: block.id,
                            entryId: entry.id,
                            field: 'highlights',
                            createTarget: (highlightIndex) => listTarget(block.id, entry.id, 'highlights', highlightIndex),
                            sortable,
                        })}
                    </>
                )}
            </EntryShell>
        ));

        return (
            <SectionShell
                key={block.id}
                blockId={block.id}
                className="resumeSection projectsDiv"
                previewScale={pageMetrics.scale}
                showSeparator={showSeparator}
                onSeparatorSettingsOpen={onSeparatorSettingsOpen}
                separatorPosition={sectionSeparatorPosition}
            >
                {(sectionHandleProps, sectionSeparatorElement) => (
                    <>
                        <h2 data-page-break-kind="heading" {...sectionTitleTarget(block.id)} {...sectionHandleProps}>
                            {renderTextWithCaret(block.title, sectionTitleEditorPath(block.id))}
                        </h2>
                        {sectionSeparatorElement}
                        {sortable ? (
                            <SortableContext items={entryItems} strategy={previewVerticalListSortingStrategy}>
                                {entries}
                            </SortableContext>
                        ) : entries}
                    </>
                )}
            </SectionShell>
        );
    }

    function renderLanguagesSection(block, { sortable = true, showSeparator = true } = {}) {
        const SectionShell = sortable ? SortablePreviewSection : StaticPreviewSection;
        const EntryShell = sortable ? SortablePreviewEntry : StaticPreviewEntry;
        const entryItems = block.entries.map((entry) => entryDragId(block.id, entry.id));
        const entries = block.entries.map((entry) => (
            <EntryShell
                key={entry.id}
                sectionId={block.id}
                entryId={entry.id}
                className="previewEntry previewEntry--tight"
                previewScale={pageMetrics.scale}
                entryEditProps={entryContainerTarget(block, entry, 'language')}
                preferEntryDrag={entry.isSamplePlaceholderEntry}
            >
                {(entryHandleProps) => (
                    <div className="previewInlineHeader">
                        <div
                        className="previewEntryTitle"
                        {...entryTarget(block.id, entry.id, 'language')}
                        {...entryHandleProps}
                    >
                            {renderTextWithCaret(entry.language, sectionEntryEditorPath(block.id, entry.id, 'language'))}
                        </div>
                        {entry.proficiency && (
                            <div className="previewEntryMeta" {...entryTarget(block.id, entry.id, 'proficiency')}>
                                {renderTextWithCaret(entry.proficiency, sectionEntryEditorPath(block.id, entry.id, 'proficiency'))}
                            </div>
                        )}
                    </div>
                )}
            </EntryShell>
        ));

        return (
            <SectionShell
                key={block.id}
                blockId={block.id}
                className="resumeSection languagesDiv"
                previewScale={pageMetrics.scale}
                showSeparator={showSeparator}
                onSeparatorSettingsOpen={onSeparatorSettingsOpen}
                separatorPosition={sectionSeparatorPosition}
            >
                {(sectionHandleProps, sectionSeparatorElement) => (
                    <>
                        <h2 data-page-break-kind="heading" {...sectionTitleTarget(block.id)} {...sectionHandleProps}>
                            {renderTextWithCaret(block.title, sectionTitleEditorPath(block.id))}
                        </h2>
                        {sectionSeparatorElement}
                        {sortable ? (
                            <SortableContext items={entryItems} strategy={previewVerticalListSortingStrategy}>
                                {entries}
                            </SortableContext>
                        ) : entries}
                    </>
                )}
            </SectionShell>
        );
    }

    function renderCustomSection(block, { sortable = true, showSeparator = true } = {}) {
        const SectionShell = sortable ? SortablePreviewSection : StaticPreviewSection;
        const EntryShell = sortable ? SortablePreviewEntry : StaticPreviewEntry;
        const entryItems = block.entries.map((entry) => entryDragId(block.id, entry.id));
        const entries = block.entries.map((entry) => (
            <EntryShell
                key={entry.id}
                sectionId={block.id}
                entryId={entry.id}
                className="previewEntry"
                previewScale={pageMetrics.scale}
                entryEditProps={entryContainerTarget(block, entry, 'title')}
                preferEntryDrag={entry.isSamplePlaceholderEntry}
            >
                {(entryHandleProps) => (
                    <>
                        {renderEntryHeader(block, entry, entryHandleProps)}
                        {entry.details && (
                            <div className="previewEntryDetail" {...entryTarget(block.id, entry.id, 'details')}>
                                {renderTextWithCaret(entry.details, sectionEntryEditorPath(block.id, entry.id, 'details'))}
                            </div>
                        )}
                        {renderBulletEntries(entry.highlights, {
                            sectionId: block.id,
                            entryId: entry.id,
                            field: 'highlights',
                            createTarget: (highlightIndex) => listTarget(block.id, entry.id, 'highlights', highlightIndex),
                            sortable,
                        })}
                    </>
                )}
            </EntryShell>
        ));

        return (
            <SectionShell
                key={block.id}
                blockId={block.id}
                className="resumeSection customDiv"
                previewScale={pageMetrics.scale}
                showSeparator={showSeparator}
                onSeparatorSettingsOpen={onSeparatorSettingsOpen}
                separatorPosition={sectionSeparatorPosition}
            >
                {(sectionHandleProps, sectionSeparatorElement) => (
                    <>
                        <h2 data-page-break-kind="heading" {...sectionTitleTarget(block.id)} {...sectionHandleProps}>
                            {renderTextWithCaret(block.title, sectionTitleEditorPath(block.id))}
                        </h2>
                        {sectionSeparatorElement}
                        {sortable ? (
                            <SortableContext items={entryItems} strategy={previewVerticalListSortingStrategy}>
                                {entries}
                            </SortableContext>
                        ) : entries}
                    </>
                )}
            </SectionShell>
        );
    }

    function renderSectionBlock(block, options = {}) {
        if (block.kind === "education") {
            return renderEducationSection(block, options);
        }

        if (block.kind === "roles") {
            return renderRolesSection(block, options);
        }

        if (block.kind === "skills") {
            return renderSkillsSection(block, options);
        }

        if (block.kind === "projects") {
            return renderProjectsSection(block, options);
        }

        if (block.kind === "certifications") {
            return renderSimpleMetaSection({
                block,
                sectionClassName: `certificationsDiv ${block.id}`,
                detailKey: 'details',
                secondaryKey: 'issuer',
                titleKey: 'name',
                ...options,
            });
        }

        if (block.kind === "languages") {
            return renderLanguagesSection(block, options);
        }

        if (block.kind === "awards") {
            return renderSimpleMetaSection({
                block,
                sectionClassName: `awardsDiv ${block.id}`,
                detailKey: 'details',
                secondaryKey: 'issuer',
                ...options,
            });
        }

        if (block.kind === "publications") {
            return renderSimpleMetaSection({
                block,
                sectionClassName: `publicationsDiv ${block.id}`,
                detailKey: 'details',
                secondaryKey: 'publisher',
                ...options,
            });
        }

        return renderCustomSection(block, options);
    }

    function renderPreviewDragOverlay() {
        if (!activeDragMeta?.type) {
            return null;
        }

        if (activeDragMeta.type === 'section') {
            const block = findBlock(activeDragMeta.sectionId);

            return block ? (
                <div className="previewDragOverlay previewDragOverlay--section">
                    {renderSectionBlock(block, { sortable: false, showSeparator: false })}
                </div>
            ) : null;
        }

        if (activeDragMeta.type === 'entry') {
            const block = findBlock(activeDragMeta.sectionId);
            const entry = findEntry(block, activeDragMeta.entryId);

            return block && entry ? (
                <div className="previewDragOverlay previewDragOverlay--entry">
                    {renderSectionBlock({ ...block, entries: [entry] }, { sortable: false, showSeparator: false })}
                </div>
            ) : null;
        }

        if (activeDragMeta.type === 'bullet') {
            const block = findBlock(activeDragMeta.sectionId);
            const entry = findEntry(block, activeDragMeta.entryId);
            const bullet = entry?.[activeDragMeta.field]?.find((item, index) => (
                getPreviewBulletSourceIndex(item, index) === activeDragMeta.itemIndex
            ));
            const text = getPreviewBulletText(bullet);

            return text ? (
                <ul className="previewEntryList previewDragOverlay previewDragOverlay--bullet">
                    <li>{text}</li>
                </ul>
            ) : null;
        }

        if (activeDragMeta.type === 'personalContact') {
            const detail = personalDetails.find((item) => item.field === activeDragMeta.field);

            return detail?.text ? (
                <div className="previewDragOverlay previewDragOverlay--personalContact">
                    {detail.text}
                </div>
            ) : null;
        }

        if (activeDragMeta.type === 'personalHeader') {
            if (activeDragMeta.rowId === 'headline' && previewModel.personal.headline) {
                return (
                    <div className="previewDragOverlay previewDragOverlay--personalHeader">
                        <div className="personalHeadline">
                            {previewModel.personal.headline}
                        </div>
                    </div>
                );
            }

            if (activeDragMeta.rowId === 'contact' && personalDetails.length > 0) {
                return (
                    <div className="previewDragOverlay previewDragOverlay--personalHeader">
                        <div className={`personalDetails ${personalDetails.length >= 4 ? 'personalDetails--wrap' : ''}`}>
                            {personalDetails.map((detail, index) => (
                                <span key={`${detail.field}-${index}`}>{detail.text}</span>
                            ))}
                        </div>
                    </div>
                );
            }
        }

        if (activeDragMeta.type === 'headerSlot') {
            const block = findBlock(activeDragMeta.sectionId);
            const entry = findEntry(block, activeDragMeta.entryId);
            const layout = block ? getEntryHeaderLayout(block) : null;
            const field = layout ? getEntryHeaderLayoutSlotField(layout, activeDragMeta) : null;

            return block && entry && field ? (
                <div className="previewDragOverlay previewDragOverlay--headerField">
                    {renderHeaderLayoutSlotChip(block, entry, field)}
                </div>
            ) : null;
        }

        return null;
    }

    const sectionDragItems = previewModel.sectionBlocks.map((block) => sectionDragId(block.id));
    const emptyPageHeight = parseCssPixelValue(
        presentationVars['--resume-page-min-height'],
        DEFAULT_PREVIEW_PAGE_MIN_HEIGHT,
    );
    const scaledPageHeight = Math.max(pageMetrics.pageHeight, pageMetrics.contentHeight) * pageMetrics.scale;
    const pageShellStyle = pageMetrics.pageWidth > 0
        ? {
            '--preview-page-scale': pageMetrics.scale,
            '--preview-page-width': `${pageMetrics.pageWidth}px`,
            width: `${pageMetrics.pageWidth * pageMetrics.scale}px`,
            height: `${scaledPageHeight}px`,
        }
        : {
            '--preview-page-scale': 1,
            '--preview-page-width': '100%',
            width: '100%',
            height: `${emptyPageHeight}px`,
        };
    const dragOverlayStyle = {
        ...presentationVars,
        ...(activeDragRect ? {
            width: `${activeDragRect.width}px`,
            height: `${activeDragRect.height}px`,
        } : {}),
    };
    const dragOverlayScale = Number.isFinite(pageMetrics.scale) && pageMetrics.scale > 0
        ? pageMetrics.scale
        : 1;
    const dragOverlayContentStyle = activeDragRect
        ? {
            width: `${activeDragRect.width / dragOverlayScale}px`,
            height: `${activeDragRect.height / dragOverlayScale}px`,
            transform: `scale(${dragOverlayScale})`,
        }
        : undefined;
    const visibleSectionBlocks = previewModel.sectionBlocks;
    const isHeaderLayoutModeActive = Boolean(
        activeHeaderLayout?.sectionId &&
        visibleSectionBlocks.some((block) => block.id === activeHeaderLayout.sectionId),
    );
    const previewDragOverlay = (
        <DragOverlay
            adjustScale={false}
            dropAnimation={activeDragMeta?.type === 'bullet' || activeDragMeta?.type === 'personalHeader'
                ? { duration: 180, easing: 'cubic-bezier(0.2, 0, 0, 1)' }
                : null}
            zIndex={1000}
        >
            <div className={`previewDragOverlayFrame ${templateClassName(template)}`} style={dragOverlayStyle}>
                <div className="previewDragOverlayScaleLayer" style={dragOverlayContentStyle}>
                    {renderPreviewDragOverlay()}
                </div>
            </div>
        </DragOverlay>
    );
    const orderedSections = [
        renderPersonalSection({ showSeparator: visibleSectionBlocks.length > 0 }),
        isHeaderLayoutModeActive ? (
            visibleSectionBlocks.map((block, index) => {
                const showSeparator = sectionSeparatorPosition === 'belowSectionName'
                    ? true
                    : index < visibleSectionBlocks.length - 1;

                return renderSectionBlock(block, { sortable: false, showSeparator });
            })
        ) : (
            <SortableContext key="preview-sections" items={sectionDragItems} strategy={previewVerticalListSortingStrategy}>
                {visibleSectionBlocks.map((block, index) => {
                    const showSeparator = sectionSeparatorPosition === 'belowSectionName'
                        ? true
                        : index < visibleSectionBlocks.length - 1;

                    return renderSectionBlock(block, { showSeparator });
                })}
            </SortableContext>
        ),
    ].filter(Boolean);
    const pageLabel = pageMetrics.pageCount === 1 ? '1 page' : `${pageMetrics.pageCount} pages`;

    function renderPageMarkers() {
        if (!previewModel.hasContent || pageMetrics.pageBreaks.length === 0) {
            return null;
        }

        return (
            <div className="resumePageMarkers" aria-hidden="true">
                {pageMetrics.pageBreaks.map((pageBreak, index) => {
                    const pageNumber = index + 2;

                    return (
                        <div
                            className="resumePageMarker"
                            key={`page-marker-${pageNumber}`}
                            style={{ top: `${pageBreak}px` }}
                        >
                            <span>Page {pageNumber}</span>
                        </div>
                    );
                })}
            </div>
        );
    }

    function renderSampleInformationToggle() {
        if (!showSampleInformationToggle || !onToggleSampleInformation) {
            return null;
        }

        return (
            <label className={`sampleInformationToggle${showSampleInformation ? "" : " sampleInformationToggle--hiddenUntilHover"}`}>
                <input
                    type="checkbox"
                    checked={showSampleInformation}
                    onChange={(event) => onToggleSampleInformation(event.target.checked)}
                />
                <span aria-hidden="true" className="sampleInformationSwitch" />
                <span>Show sample information</span>
            </label>
        );
    }

    function renderEmptyChoice() {
        if (!showEmptyResumeChoice) {
            return <div className="resumeEmptyState resumeEmptyState--blank" aria-hidden="true" />;
        }

        const nudgeAttributes = emptyChoiceNudgeCount > 0
            ? { 'data-empty-choice-nudge': emptyChoiceNudgeCount % 2 === 0 ? 'even' : 'odd' }
            : {};

        return (
            <div className="resumeEmptyState resumeEmptyState--choice">
                <div
                    className="resumeEmptyActions"
                    aria-label="Choose how to start this resume"
                    {...nudgeAttributes}
                >
                    <button
                        type="button"
                        className="button buttonPrimary emptyImportButton"
                        onClick={onImportResume}
                        disabled={isImportingResume}
                    >
                        {isImportingResume ? <span className="buttonSpinner" aria-hidden="true" /> : null}
                        {isImportingResume ? 'Processing...' : 'Import your resume'}
                    </button>
                    <span className="resumeEmptyOr">or</span>
                    <button
                        type="button"
                        className="button buttonSecondary emptyScratchButton"
                        onClick={onStartFromScratch}
                        disabled={isImportingResume}
                    >
                        Start from scratch
                    </button>
                </div>
            </div>
        );
    }

    return (
        <>
            <section ref={panelRef} className="previewPanel">
                <div ref={previewFrameRef} className="previewFrame">
                    {previewModel.hasContent && (
                        <div className="previewToolbar">
                            <span className="previewPageCount">{pageLabel}</span>
                        </div>
                    )}

                    <div className="previewPageViewport" style={presentationVars}>
                        <div className="previewPageScaleShell" style={pageShellStyle}>
                            <div className="previewPageScaleLayer">
                                <div
                                    ref={resumeRef}
                                    className={`resumePage ${templateClassName(template)}${isSamplePreview ? ' resumePage--sample' : ''}${isHeaderLayoutModeActive ? ' resumePage--headerLayoutMode' : ''}${isPreviewDragActive ? ' resumePage--dragging' : ''}`}
                                    style={presentationVars}
                                    onClick={handlePreviewClick}
                                    onPointerDownCapture={handlePreviewDragHandleCapture}
                                    onKeyDownCapture={handlePreviewDragHandleCapture}
                                >
                                    {previewModel.hasContent ? (
                                        <DndContext
                                            sensors={sensors}
                                            measuring={previewDragMeasuring}
                                            collisionDetection={(args) => previewCollisionDetection(args, activeDragInitialRectRef.current)}
                                            onDragStart={handlePreviewDragStart}
                                            onDragCancel={handlePreviewDragCancel}
                                            onDragEnd={handlePreviewDragEnd}
                                        >
                                            {renderSampleInformationToggle()}
                                            {orderedSections}
                                            {typeof document === 'undefined' ? previewDragOverlay : createPortal(previewDragOverlay, document.body)}
                                        </DndContext>
                                    ) : (
                                        <>
                                            {!showEmptyResumeChoice ? renderSampleInformationToggle() : null}
                                            {renderEmptyChoice()}
                                        </>
                                    )}
                                </div>
                                {renderPageMarkers()}
                            </div>
                        </div>
                    </div>
                </div>
            </section>
        </>
    )
}
