import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    bulletDragId,
    entryDragId,
    normalizePreviewSortableTransform,
    personalContactDragId,
    personalHeaderDragId,
    sectionDragId,
} from './resumePreviewDrag.js';
import { openSeparatorSettings, previewSectionClassName } from './resumePreviewSectionChrome.js';

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

export function SortablePreviewSection({
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

export function StaticPreviewSection({
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

export function SortablePreviewEntry({ sectionId, entryId, className, previewScale, entryEditProps = {}, preferEntryDrag = false, children }) {
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

export function StaticPreviewEntry({ className, entryEditProps = {}, children }) {
    return (
        <div className={className} data-page-break-kind="entry" {...entryEditProps}>
            {children({})}
        </div>
    );
}

export function SortablePreviewBullet({ sectionId, entryId, field, itemIndex, editProps, previewScale, children }) {
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

export function StaticPreviewBullet({ editProps, children }) {
    return <li data-page-break-kind="item" {...editProps}>{children}</li>;
}

export function SortablePersonalContact({ field, editProps, previewScale, children }) {
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

export function SortablePersonalHeaderRow({ rowId, previewScale, children }) {
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
