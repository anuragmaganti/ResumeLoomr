import { useDraggable, useDroppable } from '@dnd-kit/core';
import { sectionHeadingDragId } from './resumePreviewDrag.js';

export default function ResumePreviewSectionHeading({
    alignment = 'left',
    alignmentDragEnabled = true,
    children,
    editProps = {},
    isAlignmentDragging = false,
    sectionHandleProps = {},
    sectionId,
    title,
}) {
    const nextAlignment = alignment === 'center' ? 'left' : 'center';
    const sourceId = sectionHeadingDragId(sectionId, alignment);
    const targetId = sectionHeadingDragId(sectionId, nextAlignment);
    const {
        attributes,
        listeners,
        setNodeRef: setDraggableNodeRef,
        isDragging,
    } = useDraggable({ id: sourceId, disabled: !alignmentDragEnabled });
    const {
        setNodeRef: setDroppableNodeRef,
        isOver,
    } = useDroppable({ id: targetId, disabled: !alignmentDragEnabled });
    const sourceDragProps = alignmentDragEnabled
        ? {
            ...attributes,
            'data-preview-drag-handle': 'true',
            'data-preview-drag-scope': 'section-heading',
            'data-preview-sortable-id': sourceId,
            onPointerDown: listeners?.onPointerDown,
            onKeyDown: listeners?.onKeyDown,
        }
        : {};
    const hasSectionReorderHandle = typeof sectionHandleProps.onPointerDown === 'function';

    return (
        <div
            className={`previewSectionHeadingLine previewSectionHeadingLine--${alignment}${isAlignmentDragging ? ' isAlignmentDragging' : ''}`}
            data-page-break-kind="heading"
            data-section-heading-alignment={alignment}
        >
            {hasSectionReorderHandle ? (
                <div
                    {...sectionHandleProps}
                    className="previewSectionReorderSurface"
                    aria-label={`Move ${title} section`}
                />
            ) : null}
            <h2
                ref={setDraggableNodeRef}
                className={`previewSectionHeadingSource${isDragging ? ' isAlignmentSource' : ''}`}
                {...editProps}
                {...sourceDragProps}
            >
                {children}
            </h2>
            {alignmentDragEnabled ? (
                <span
                    ref={setDroppableNodeRef}
                    className={`previewSectionHeadingDropSlot previewSectionHeadingDropSlot--${nextAlignment}${isOver ? ' isAlignmentDropTarget' : ''}`}
                    aria-label={`Move all section names to ${nextAlignment}`}
                    data-section-heading-drop-alignment={nextAlignment}
                    data-preview-sortable-id={targetId}
                    onPointerDown={(event) => event.stopPropagation()}
                >
                    <span aria-hidden="true">{title}</span>
                </span>
            ) : null}
        </div>
    );
}
