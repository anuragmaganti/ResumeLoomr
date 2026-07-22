import { useDraggable, useDroppable } from '@dnd-kit/core';

export function HeaderLayoutSlot({ id, field, label, renderChip }) {
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

export function HeaderLayoutField({
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

export function HeaderLayoutHoverSlot({ id, label }) {
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
