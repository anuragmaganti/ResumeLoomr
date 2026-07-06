import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    closestCenter,
    DndContext,
    DragOverlay,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getResumePresentationVars, getResumePrintPageRule } from '../lib/resume.js';
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

function entryDragId(sectionId, entryId) {
    return ['entry', sectionId, entryId].join(DRAG_ID_SEPARATOR);
}

function bulletDragId(sectionId, entryId, field, itemIndex) {
    return ['bullet', sectionId, entryId, field, itemIndex].join(DRAG_ID_SEPARATOR);
}

function parsePreviewDragId(id) {
    const [type, sectionId, entryId, field, itemIndex] = String(id || '').split(DRAG_ID_SEPARATOR);

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

    return { type: '' };
}

function areCompatiblePreviewDragItems(activeMeta, overMeta) {
    if (!activeMeta?.type || activeMeta.type !== overMeta?.type) {
        return false;
    }

    if (activeMeta.type === 'section') {
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

    return false;
}

function previewCollisionDetection(args) {
    const activeMeta = parsePreviewDragId(args.active.id);
    const droppableContainers = args.droppableContainers.filter((container) => (
        areCompatiblePreviewDragItems(activeMeta, parsePreviewDragId(container.id))
    ));

    return closestCenter({ ...args, droppableContainers });
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

function SortablePreviewEntry({ sectionId, entryId, className, previewScale, children }) {
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

    return (
        <div
            ref={setNodeRef}
            data-preview-sortable-id={sortableId}
            data-page-break-kind="entry"
            className={`${className} previewSortableItem previewSortableEntry ${isDragging ? 'isPreviewSortingPlaceholder' : ''}`}
            style={style}
        >
            {children(handleProps)}
        </div>
    );
}

function StaticPreviewEntry({ className, children }) {
    return (
        <div className={className} data-page-break-kind="entry">
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

function StaticPreviewBullet({ editProps, children }) {
    return <li data-page-break-kind="item" {...editProps}>{children}</li>;
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
    const summaryWidthDragRef = useRef(null);
    const [activeDragMeta, setActiveDragMeta] = useState(null);
    const [activeDragRect, setActiveDragRect] = useState(null);
    const [summaryWidthDrag, setSummaryWidthDrag] = useState(null);
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
    const personalDetails = useMemo(() => (
        [
            { text: previewModel.personal.location, field: 'location' },
            { text: previewModel.personal.phone, field: 'phone' },
            { text: previewModel.personal.email, field: 'email' },
            ...previewModel.personal.links.map((link) => ({
                text: link.text,
                field: personalLinkFieldMap[link.id] || 'customField'
            }))
        ].filter((item) => item.text)
    ), [previewModel.personal]);

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

    function handlePreviewClick(event) {
        if (suppressPreviewClickRef.current) {
            return;
        }

        if (!onEditTarget) {
            return;
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
        const activeElement = getPreviewSortableElement(event.active.id);
        const rect = activeElement?.getBoundingClientRect() || event.active.rect.current.initial;
        setActiveDragRect(rect ? { width: rect.width, height: rect.height } : null);
    }

    function handlePreviewDragCancel() {
        setActiveDragMeta(null);
        setActiveDragRect(null);
        activeDragScrollRef.current = { x: 0, y: 0, captured: false };
    }

    function handlePreviewDragEnd(event) {
        const activeMeta = parsePreviewDragId(event.active.id);
        const overMeta = event.over ? parsePreviewDragId(event.over.id) : null;
        const scrollTarget = getPreviewDragScrollTarget();
        setActiveDragMeta(null);
        setActiveDragRect(null);
        activeDragScrollRef.current = { x: 0, y: 0, captured: false };

        if (!overMeta || !areCompatiblePreviewDragItems(activeMeta, overMeta)) {
            return;
        }

        suppressNextPreviewClick();

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
            <SortableContext items={bulletIds} strategy={verticalListSortingStrategy}>
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
                            <SortableContext items={entryItems} strategy={verticalListSortingStrategy}>
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

        return (
            <div className={previewSectionClassName('resumeSection personalSection', showSeparator)} key="personal">
                <h1 {...personalTarget('name')}>
                    {renderTextWithCaret(previewModel.personal.name, personalEditorPath('name'), { fallback: "Your Name" })}
                </h1>

                {previewModel.personal.headline && (
                    <div className="personalHeadline" {...personalTarget('headline')}>
                        {renderTextWithCaret(previewModel.personal.headline, personalEditorPath('headline'))}
                    </div>
                )}

                {personalDetails.length > 0 && (
                    <div className={`personalDetails ${personalDetails.length >= 4 ? 'personalDetails--wrap' : ''}`}>
                        {personalDetails.map((detail, index) => (
                            <span key={`${detail.text}-${index}`} {...personalTarget(detail.field)}>
                                {renderTextWithCaret(detail.text, personalEditorPath(detail.field))}
                            </span>
                        ))}
                    </div>
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
            >
                {(entryHandleProps) => (
                    <>
                        {(institution.school || institution.location) && (
                            <div className="degreeYearsEduFlex">
                                {institution.school && (
                                    <div className="schoolLocation">
                                        <span
                                            className="school"
                                            {...entryTarget(block.id, institution.id, 'school')}
                                            {...entryHandleProps}
                                        >
                                            {renderTextWithCaret(institution.school, sectionEntryEditorPath(block.id, institution.id, 'school'))}
                                        </span>
                                    </div>
                                )}
                                {institution.location && (
                                    <div className="eduLocation previewEntryLocation" {...entryTarget(block.id, institution.id, 'location')}>
                                        {renderTextWithCaret(institution.location, sectionEntryEditorPath(block.id, institution.id, 'location'))}
                                    </div>
                                )}
                            </div>
                        )}
                        {institution.programs?.length > 0 ? (
                            institution.programs.map((program, programIndex) => {
                                const programYears = program.yearsEdu || (institution.programs.length === 1 ? institution.yearsEdu : '');
                                const programYearsTarget = program.yearsEdu
                                    ? nestedTarget(block.id, institution.id, `programs.${programIndex}.yearsEdu`)
                                    : entryTarget(block.id, institution.id, 'yearsEdu');
                                const programYearsPath = program.yearsEdu
                                    ? sectionEntryNestedEditorPath(block.id, institution.id, `programs.${programIndex}.yearsEdu`)
                                    : sectionEntryEditorPath(block.id, institution.id, 'yearsEdu');
                                const programGpa = program.gpa || (institution.programs.length === 1 ? institution.gpa : '');
                                const programGpaTarget = program.gpa
                                    ? nestedTarget(block.id, institution.id, `programs.${programIndex}.gpa`)
                                    : entryTarget(block.id, institution.id, 'gpa');
                                const programGpaPath = program.gpa
                                    ? sectionEntryNestedEditorPath(block.id, institution.id, `programs.${programIndex}.gpa`)
                                    : sectionEntryEditorPath(block.id, institution.id, 'gpa');

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
                        ) : (
                            (institution.degree || institution.honors || institution.gpa || institution.yearsEdu) && (
                                <div className="schoolLocationRow">
                                    <div className="educationDegreeRow">
                                        {institution.degree && (
                                            <span className="degree" {...entryTarget(block.id, institution.id, 'degree')}>
                                                {renderTextWithCaret(institution.degree, sectionEntryEditorPath(block.id, institution.id, 'degree'))}
                                            </span>
                                        )}
                                        {institution.gpa && (
                                            <span className="educationMeta educationGpaInline" {...entryTarget(block.id, institution.id, 'gpa')}>
                                                {renderTextWithCaret(institution.gpa, sectionEntryEditorPath(block.id, institution.id, 'gpa'), {
                                                    prefix: institution.degree ? ', GPA: ' : 'GPA: ',
                                                })}
                                            </span>
                                        )}
                                        {institution.honors && (
                                            <span className="educationMeta" {...entryTarget(block.id, institution.id, 'honors')}>
                                                {renderTextWithCaret(institution.honors, sectionEntryEditorPath(block.id, institution.id, 'honors'), {
                                                    prefix: (institution.degree || institution.gpa) ? ', ' : '',
                                                })}
                                            </span>
                                        )}
                                    </div>
                                    {institution.yearsEdu && (
                                        <div className="yearsEdu" {...entryTarget(block.id, institution.id, 'yearsEdu')}>
                                            {renderTextWithCaret(institution.yearsEdu, sectionEntryEditorPath(block.id, institution.id, 'yearsEdu'))}
                                        </div>
                                    )}
                                </div>
                            )
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
                            <SortableContext items={entryItems} strategy={verticalListSortingStrategy}>
                                {entries}
                            </SortableContext>
                        ) : entries}
                    </>
                )}
            </SectionShell>
        );
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
                className="experienceSection"
                previewScale={pageMetrics.scale}
            >
                {(entryHandleProps) => (
                    <>
                        {(job.company || job.location) && (
                            <div className="companyYearsExpFlex">
                                {job.company && (
                                    <div className="companyRoleLine">
                                        <span
                                            className="company"
                                            {...entryTarget(block.id, job.id, 'company')}
                                            {...entryHandleProps}
                                        >
                                            {renderTextWithCaret(job.company, sectionEntryEditorPath(block.id, job.id, 'company'))}
                                        </span>
                                    </div>
                                )}
                                {job.location && (
                                    <div className="previewEntryLocation" {...entryTarget(block.id, job.id, 'location')}>
                                        {renderTextWithCaret(job.location, sectionEntryEditorPath(block.id, job.id, 'location'))}
                                    </div>
                                )}
                            </div>
                        )}
                        {(job.role || job.yearsExp || (!job.company && !job.location)) && (
                            <div className="companyYearsExpFlex roleYearsExpFlex">
                                {job.role && (
                                    <div className="companyRoleLine">
                                        <span
                                            className="role"
                                            {...entryTarget(block.id, job.id, 'role')}
                                            {...(!job.company ? entryHandleProps : {})}
                                        >
                                            {renderTextWithCaret(job.role, sectionEntryEditorPath(block.id, job.id, 'role'))}
                                        </span>
                                    </div>
                                )}
                                {job.yearsExp && (
                                    <div className="yearsExp" {...entryTarget(block.id, job.id, 'yearsExp')}>
                                        {renderTextWithCaret(job.yearsExp, sectionEntryEditorPath(block.id, job.id, 'yearsExp'))}
                                    </div>
                                )}
                            </div>
                        )}
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
                            <SortableContext items={entryItems} strategy={verticalListSortingStrategy}>
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
                            <SortableContext items={entryItems} strategy={verticalListSortingStrategy}>
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
                className="previewEntry"
                previewScale={pageMetrics.scale}
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
                            <SortableContext items={entryItems} strategy={verticalListSortingStrategy}>
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
                            <SortableContext items={entryItems} strategy={verticalListSortingStrategy}>
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
            >
                {(entryHandleProps) => (
                    <>
                        <div className="previewEntryHeader">
                            <div className="previewEntryTitleLine">
                                <span
                                    className="previewEntryTitle"
                                    {...entryTarget(block.id, entry.id, 'title')}
                                    {...entryHandleProps}
                                >
                                    {renderTextWithCaret(entry.title, sectionEntryEditorPath(block.id, entry.id, 'title'))}
                                </span>
                            </div>
                            {entry.location && (
                                <div className="previewEntryLocation" {...entryTarget(block.id, entry.id, 'location')}>
                                    {renderTextWithCaret(entry.location, sectionEntryEditorPath(block.id, entry.id, 'location'))}
                                </div>
                            )}
                        </div>
                        {(entry.subtitle || entry.years) && (
                            <div className="previewEntryHeader customSubtitleYearsRow">
                                {entry.subtitle && (
                                    <div className="previewEntryTitleLine">
                                        <span
                                            className="previewEntrySubtitle"
                                            {...entryTarget(block.id, entry.id, 'subtitle')}
                                            {...(!entry.title ? entryHandleProps : {})}
                                        >
                                            {renderTextWithCaret(entry.subtitle, sectionEntryEditorPath(block.id, entry.id, 'subtitle'))}
                                        </span>
                                    </div>
                                )}
                                {entry.years && (
                                    <div className="previewEntryMeta" {...entryTarget(block.id, entry.id, 'years')}>
                                        {renderTextWithCaret(entry.years, sectionEntryEditorPath(block.id, entry.id, 'years'))}
                                    </div>
                                )}
                            </div>
                        )}
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
                            <SortableContext items={entryItems} strategy={verticalListSortingStrategy}>
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
    const previewDragOverlay = (
        <DragOverlay adjustScale={false} dropAnimation={null} zIndex={1000}>
            <div className={`previewDragOverlayFrame ${templateClassName(template)}`} style={dragOverlayStyle}>
                <div className="previewDragOverlayScaleLayer" style={dragOverlayContentStyle}>
                    {renderPreviewDragOverlay()}
                </div>
            </div>
        </DragOverlay>
    );
    const visibleSectionBlocks = previewModel.sectionBlocks;
    const orderedSections = [
        renderPersonalSection({ showSeparator: visibleSectionBlocks.length > 0 }),
        (
            <SortableContext key="preview-sections" items={sectionDragItems} strategy={verticalListSortingStrategy}>
                {visibleSectionBlocks.map((block, index) => (
                    renderSectionBlock(block, { showSeparator: index < visibleSectionBlocks.length - 1 })
                ))}
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
            <style media="print">{printPageRule}</style>
            <section ref={panelRef} className="previewPanel">
                <div ref={previewFrameRef} className="previewFrame">
                    {previewModel.hasContent && (
                        <div className="previewToolbar">
                            <span className="previewPageCount">{pageLabel}</span>
                        </div>
                    )}

                    <div className="previewPageViewport">
                        <div className="previewPageScaleShell" style={pageShellStyle}>
                            <div className="previewPageScaleLayer">
                                <div
                                    ref={resumeRef}
                                    className={`resumePage ${templateClassName(template)}${isSamplePreview ? ' resumePage--sample' : ''}`}
                                    style={presentationVars}
                                    onClick={handlePreviewClick}
                                    onPointerDownCapture={handlePreviewDragHandleCapture}
                                    onKeyDownCapture={handlePreviewDragHandleCapture}
                                >
                                    {previewModel.hasContent ? (
                                        <DndContext
                                            sensors={sensors}
                                            collisionDetection={previewCollisionDetection}
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
