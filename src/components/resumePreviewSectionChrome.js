export function previewSectionClassName(className, showSeparator) {
    return `${className}${showSeparator ? '' : ' resumeSection--lastVisible'}`;
}

export function openSeparatorSettings(event, onSeparatorSettingsOpen, scope, sectionId) {
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
