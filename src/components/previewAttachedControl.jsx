export default function PreviewAttachedControl({
    active = false,
    children,
    className = '',
    onInteraction,
}) {
    function stopInteraction(event) {
        event.stopPropagation();
        onInteraction?.();
    }

    return (
        <div
            className={`previewAttachedControl${active ? ' isActive' : ''}${className ? ` ${className}` : ''}`}
            data-dnd-no-drag="true"
            onClick={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
            onPointerDown={stopInteraction}
        >
            {children}
        </div>
    );
}
