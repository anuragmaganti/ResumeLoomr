import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    DndContext,
    DragOverlay,
    MeasuringFrequency,
    MeasuringStrategy,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import {
    horizontalListSortingStrategy,
    SortableContext,
    sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import {
    ENTRY_HEADER_LAYOUT_FIELDS,
    getDefaultEntryHeaderLayout,
    moveSectionHeaderField,
    normalizeEntryHeaderLayout,
} from '../lib/resumeEntryLayout.js';
import {
    PERSONAL_CONTACT_FIELDS,
    getEffectivePersonalAlignment,
    getResumePresentationVars,
    getResumePrintPageRule,
    normalizePersonalContactOrder,
    normalizePersonalHeaderOrder,
} from '../lib/resumeSettings.js';
import {
    PRINT_PAGE_HEIGHT_PX,
} from '../lib/previewPagination.js';
import {
    createPreviewEditAttributes,
    getPreviewCaretOffsetFromPoint,
    personalEditorPath,
    sectionEntryEditorPath,
    sectionEntryListEditorPath,
    sectionEntryNestedEditorPath,
    sectionTitleEditorPath,
} from '../lib/editorTargets.js';
import { ResumeLoomrKeyboardSensor, ResumeLoomrPointerSensor } from '../lib/sortableSensors.js';
import MobilePreviewEditorProxy from './mobilePreviewEditorProxy.jsx';
import PersonalAlignmentControls from './personalAlignmentControls.jsx';
import {
    EmptyResumeChoice,
    PreviewMarginControls,
    PreviewPageMarkers,
    SampleInformationToggle,
} from './resumePreviewControls.jsx';
import {
    isMobilePreviewEditingViewport,
    parseCssPixelValue,
} from './resumePreviewGeometry.js';
import {
    areCompatiblePreviewDragItems,
    bulletDragId,
    entryDragId,
    getPreviewSortableElement,
    headerSlotDragId,
    moveIdWithinOrder,
    parsePreviewDragId,
    personalContactDragId,
    personalHeaderDragId,
    previewCollisionDetection,
    previewVerticalListSortingStrategy,
    sectionDragId,
} from './resumePreviewDrag.js';
import {
    HeaderLayoutField,
    HeaderLayoutHoverSlot,
    HeaderLayoutSlot,
} from './resumePreviewHeaderLayout.jsx';
import {
    SortablePersonalContact,
    SortablePersonalHeaderRow,
    SortablePreviewBullet,
    SortablePreviewEntry,
    SortablePreviewSection,
    StaticPreviewBullet,
    StaticPreviewEntry,
    StaticPreviewSection,
} from './resumePreviewSortables.jsx';
import {
    openSeparatorSettings,
    previewSectionClassName,
} from './resumePreviewSectionChrome.js';
import { useMobilePreviewEditor } from './useMobilePreviewEditor.js';
import {
    useResumePreviewPageMetrics,
    useResumePrintPageRule,
    useWrappedEntryHeaderSeparators,
} from './useResumePreviewLayout.js';

function templateClassName(template) {
    return `resumePage--${template}`;
}

const personalLinkFieldMap = {
    linkedin: 'linkedinUrl',
    portfolio: 'portfolioUrl',
    github: 'githubUrl',
    custom: 'customField',
};

const DEFAULT_PREVIEW_PAGE_MIN_HEIGHT = PRINT_PAGE_HEIGHT_PX;
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

function clampSummaryWidthPercent(value) {
    const numericValue = Number(value);

    if (!Number.isFinite(numericValue)) {
        return 100;
    }

    return Math.max(SUMMARY_WIDTH_MIN_PERCENT, Math.min(SUMMARY_WIDTH_MAX_PERCENT, Math.round(numericValue)));
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

export default function ResumePreview({
    resume,
    resumeId,
    previewModel,
    template,
    settings,
    isSamplePreview = false,
    panelRef,
    onEditTarget,
    onPreviewValueChange,
    onPreviewValueCommit,
    onPreviewCaretChange,
    onPreviewEditorHandoff,
    onPreviewInteractionStart,
    onLayoutChange,
    onReorderSections,
    onReorderSectionEntries,
    onReorderSectionTextList,
    onReorderPersonalContact,
    onPersonalAlignmentChange,
    onPersonalHeaderOrderChange,
    onSetSectionEntryHeaderLayout,
    onAdjustSetting,
    onSummaryWidthChange,
    onSeparatorSettingsOpen,
    activeEditorCaret,
    isPrintRendering = false,
    previewPulseTarget,
    showEmptyResumeChoice = false,
    emptyChoiceNudgeCount = 0,
    isImportingResume = false,
    showSampleInformationToggle = false,
    showSampleInformation = true,
    onImportResume,
    onStartFromScratch,
    onToggleSampleInformation,
    onDismissSampleInformation,
}) {
    const resumeRef = useRef(null);
    const previewFrameRef = useRef(null);
    const suppressPreviewClickRef = useRef(false);
    const activeDragScrollRef = useRef({ x: 0, y: 0, captured: false });
    const activeDragInitialRectRef = useRef(null);
    const summaryWidthDragRef = useRef(null);
    const headerLayoutDoubleClickRef = useRef(null);
    const headerLayoutLongPressRef = useRef(null);
    const personalChromeActiveRef = useRef(false);
    const [activeDragMeta, setActiveDragMeta] = useState(null);
    const [activeDragRect, setActiveDragRect] = useState(null);
    const [activeHeaderLayout, setActiveHeaderLayout] = useState(null);
    const [hoverHeaderLayout, setHoverHeaderLayout] = useState(null);
    const [isPersonalChromeActive, setIsPersonalChromeActive] = useState(false);
    const [summaryWidthDrag, setSummaryWidthDrag] = useState(null);
    const isPreviewDragActive = Boolean(activeDragMeta?.type);
    const canShowHeaderLayoutHover = !activeDragMeta?.type || activeDragMeta.type === 'headerSlot';
    const presentationVars = useMemo(() => getResumePresentationVars(settings, template), [settings, template]);
    const printPageRule = useMemo(() => getResumePrintPageRule(settings, template), [settings, template]);
    const pageMetrics = useResumePreviewPageMetrics({
        frameRef: previewFrameRef,
        presentationVars,
        previewModel,
        resumeRootRef: resumeRef,
    });
    const {
        closeSession: closeMobileEditSession,
        handleBlur: handleMobileEditorBlur,
        handleChange: handleMobileEditorChange,
        handleProxyTap: handleMobileProxyTap,
        inputRef: mobileEditorRef,
        openSession: openMobileEditSession,
        scheduleCaretSync: scheduleMobileCaretSync,
        session: mobileEditSession,
        sessionRef: mobileEditSessionRef,
    } = useMobilePreviewEditor({
        activeEditorCaret,
        isPrintRendering,
        onEditTarget,
        onPreviewCaretChange,
        onPreviewEditorHandoff,
        onPreviewValueChange,
        onPreviewValueCommit,
        pageScale: pageMetrics.scale,
        resume,
        resumeId,
        resumeRootRef: resumeRef,
    });
    useResumePrintPageRule(printPageRule);
    useWrappedEntryHeaderSeparators({
        activeHeaderLayout,
        presentationVars,
        previewModel,
        resumeRootRef: resumeRef,
    });
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

    function previewPulseAttributes(path) {
        return previewPulseTarget?.path === path && previewPulseTarget?.requestId
            ? { 'data-preview-pulse': previewPulseTarget.requestId % 2 === 0 ? 'even' : 'odd' }
            : {};
    }

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

        const caretText = typeof activeEditorCaret?.value === 'string'
            ? activeEditorCaret.value
            : text;
        const caretOffset = shouldShowCaret
            ? Math.max(0, Math.min(activeEditorCaret.offset, caretText.length))
            : 0;
        const beforeCaret = caretText.slice(0, caretOffset);
        const afterCaret = caretText.slice(caretOffset);
        const renderedText = shouldShowCaret
            ? (caretText || fallback)
            : displayText;

        return (
            <>
                {prefix ? (
                    <span data-preview-caret-decoration="prefix">{prefix}</span>
                ) : null}
                <span
                    data-preview-caret-text="true"
                    data-preview-caret-path={path}
                    data-preview-caret-display={renderedText}
                >
                    {shouldShowCaret ? (
                        <>
                            {beforeCaret && (
                                <span className="previewTextCaretSegment">{beforeCaret}</span>
                            )}
                            <span className="previewTextCaret" aria-hidden="true" />
                            {afterCaret ? (
                                <span className="previewTextCaretSegment">{afterCaret}</span>
                            ) : (
                                caretText ? '' : fallback
                            )}
                        </>
                    ) : displayText}
                </span>
                {suffix ? (
                    <span data-preview-caret-decoration="suffix">{suffix}</span>
                ) : null}
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

        const path = targetElement.dataset.editPath;
        const clickedValueElement = event.target.closest('[data-preview-caret-text="true"]');
        const valueElement = clickedValueElement?.dataset.previewCaretPath === path
            ? clickedValueElement
            : Array.from(targetElement.querySelectorAll('[data-preview-caret-text="true"]'))
                .find((element) => element.dataset.previewCaretPath === path);
        const displayText = valueElement?.dataset.previewCaretDisplay
            ?? valueElement?.textContent
            ?? '';
        const clickedDecoration = event.target.closest('[data-preview-caret-decoration]');
        let displayOffset = displayText.length;

        if (clickedDecoration?.dataset.previewCaretDecoration === 'prefix') {
            displayOffset = 0;
        } else if (clickedDecoration?.dataset.previewCaretDecoration === 'suffix') {
            displayOffset = displayText.length;
        } else if (valueElement) {
            const pointOffset = getPreviewCaretOffsetFromPoint(valueElement, event.clientX, event.clientY);

            if (Number.isFinite(pointOffset)) {
                displayOffset = pointOffset;
            } else {
                const valueRect = valueElement.getBoundingClientRect();
                const isBeforeValue = event.clientY < valueRect.top
                    || (event.clientY <= valueRect.bottom && event.clientX <= valueRect.left);

                displayOffset = isBeforeValue ? 0 : displayText.length;
            }
        }

        const editTarget = {
            sectionId: targetElement.dataset.editSectionId,
            field: targetElement.dataset.editField || '',
            entryId: targetElement.dataset.editEntryId || '',
            itemIndex: targetElement.dataset.editItemIndex ? Number(targetElement.dataset.editItemIndex) : undefined,
            nestedPath: targetElement.dataset.editNestedPath || '',
            path,
            displayText,
            displayOffset,
            scrollX: window.scrollX,
            scrollY: window.scrollY,
        };

        if (isMobilePreviewEditingViewport()) {
            if (
                mobileEditSessionRef.current
                && mobileEditSessionRef.current.target.path !== editTarget.path
            ) {
                closeMobileEditSession();
            }

            const targetResume = onEditTarget({ ...editTarget, stayInPreview: true });

            if (targetResume) {
                openMobileEditSession(editTarget, valueElement, targetResume);
            }
            return;
        }

        closeMobileEditSession();
        onEditTarget(editTarget);
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
        closeMobileEditSession();
        onPreviewInteractionStart?.();

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

    function renderSectionFrame({
        block,
        className,
        entries,
        entryItems,
        sortable,
        showSeparator,
    }) {
        const SectionFrame = sortable ? SortablePreviewSection : StaticPreviewSection;

        return (
            <SectionFrame
                key={block.id}
                blockId={block.id}
                className={className}
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
            </SectionFrame>
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

        return renderSectionFrame({
            block,
            className: `resumeSection ${sectionClassName}`,
            entries: entryList,
            entryItems,
            sortable,
            showSeparator,
        });
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

        return renderSectionFrame({
            block,
            className: "resumeSection educationDiv",
            entries,
            entryItems,
            sortable,
            showSeparator,
        });
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

        return renderSectionFrame({
            block,
            className: "resumeSection experienceDiv",
            entries,
            entryItems,
            sortable,
            showSeparator,
        });
    }

    function renderSkillsSection(block, { sortable = true, showSeparator = true } = {}) {
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

        return renderSectionFrame({
            block,
            className: "resumeSection skillsDiv",
            entries,
            entryItems,
            sortable,
            showSeparator,
        });
    }

    function renderProjectsSection(block, { sortable = true, showSeparator = true } = {}) {
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

        return renderSectionFrame({
            block,
            className: "resumeSection projectsDiv",
            entries,
            entryItems,
            sortable,
            showSeparator,
        });
    }

    function renderLanguagesSection(block, { sortable = true, showSeparator = true } = {}) {
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

        return renderSectionFrame({
            block,
            className: "resumeSection languagesDiv",
            entries,
            entryItems,
            sortable,
            showSeparator,
        });
    }

    function renderCustomSection(block, { sortable = true, showSeparator = true } = {}) {
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

        return renderSectionFrame({
            block,
            className: "resumeSection customDiv",
            entries,
            entryItems,
            sortable,
            showSeparator,
        });
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
                <div className="previewDragOverlay previewDragOverlay--bullet">
                    {text}
                </div>
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
    function setPersonalChromeActive(nextActive) {
        if (personalChromeActiveRef.current === nextActive) {
            return;
        }

        personalChromeActiveRef.current = nextActive;
        setIsPersonalChromeActive(nextActive);
    }

    function handleResumePagePointerMove(event) {
        if (!previewModel.hasContent || !previewModel.showPersonal) {
            setPersonalChromeActive(false);
            return;
        }

        const pageElement = resumeRef.current;
        const personalElement = pageElement?.querySelector('.personalSection');

        if (!pageElement || !personalElement) {
            setPersonalChromeActive(false);
            return;
        }

        const pageRect = pageElement.getBoundingClientRect();
        const personalRect = personalElement.getBoundingClientRect();
        const isInsidePageX = event.clientX >= pageRect.left && event.clientX <= pageRect.right;
        const isInsidePersonalBandY = event.clientY >= pageRect.top && event.clientY <= personalRect.bottom;

        setPersonalChromeActive(isInsidePageX && isInsidePersonalBandY);
    }

    return (
        <>
            <section ref={panelRef} className="previewPanel">
                <div ref={previewFrameRef} className="previewFrame">
                    <div className="previewPageViewport" style={presentationVars}>
                        <div className="previewPageScaleShell" style={pageShellStyle}>
                            <div className="previewPageScaleLayer">
                                <div
                                    ref={resumeRef}
                                    className={`resumePage ${templateClassName(template)}${isSamplePreview ? ' resumePage--sample' : ''}${isHeaderLayoutModeActive ? ' resumePage--headerLayoutMode' : ''}${isPreviewDragActive ? ' resumePage--dragging' : ''}${isPersonalChromeActive ? ' resumePage--personalChromeActive' : ''}`}
                                    style={presentationVars}
                                    onClick={handlePreviewClick}
                                    onPointerMove={handleResumePagePointerMove}
                                    onPointerLeave={() => setPersonalChromeActive(false)}
                                    onPointerDownCapture={handlePreviewDragHandleCapture}
                                    onKeyDownCapture={handlePreviewDragHandleCapture}
                                >
                                    {previewModel.showPersonal && previewModel.hasContent ? (
                                        <PersonalAlignmentControls
                                            activeAlignment={personalAlignment}
                                            onAlignmentChange={handlePersonalAlignmentChange}
                                        />
                                    ) : null}
                                    <PreviewMarginControls
                                        settings={settings}
                                        hidden={showEmptyResumeChoice}
                                        onAdjustSetting={onAdjustSetting}
                                        onInteraction={suppressNextPreviewClick}
                                    />
                                    {previewModel.hasContent ? (
                                        <DndContext
                                            sensors={sensors}
                                            measuring={previewDragMeasuring}
                                            collisionDetection={(args) => previewCollisionDetection(args, activeDragInitialRectRef.current)}
                                            onDragStart={handlePreviewDragStart}
                                            onDragCancel={handlePreviewDragCancel}
                                            onDragEnd={handlePreviewDragEnd}
                                        >
                                            <SampleInformationToggle
                                                enabled={showSampleInformationToggle}
                                                personalAlignment={personalAlignment}
                                                showSampleInformation={showSampleInformation}
                                                onToggleSampleInformation={onToggleSampleInformation}
                                                onDismissSampleInformation={onDismissSampleInformation}
                                            />
                                            <div className="resumePageContent" data-preview-page-content="true">
                                                {orderedSections}
                                            </div>
                                            {typeof document === 'undefined' ? previewDragOverlay : createPortal(previewDragOverlay, document.body)}
                                        </DndContext>
                                    ) : (
                                        <>
                                            {!showEmptyResumeChoice ? (
                                                <SampleInformationToggle
                                                    enabled={showSampleInformationToggle}
                                                    personalAlignment={personalAlignment}
                                                    showSampleInformation={showSampleInformation}
                                                    onToggleSampleInformation={onToggleSampleInformation}
                                                    onDismissSampleInformation={onDismissSampleInformation}
                                                />
                                            ) : null}
                                            <div className="resumeEmptyState resumeEmptyState--blank" aria-hidden="true" />
                                        </>
                                    )}
                                </div>
                                <PreviewPageMarkers
                                    hasContent={previewModel.hasContent}
                                    pageBreaks={pageMetrics.pageBreaks}
                                />
                            </div>
                            <EmptyResumeChoice
                                visible={showEmptyResumeChoice}
                                nudgeCount={emptyChoiceNudgeCount}
                                isImportingResume={isImportingResume}
                                onImportResume={onImportResume}
                                onStartFromScratch={onStartFromScratch}
                            />
                        </div>
                    </div>
                </div>
            </section>
            <MobilePreviewEditorProxy
                session={mobileEditSession}
                inputRef={mobileEditorRef}
                onBlur={handleMobileEditorBlur}
                onCaretEvent={(event) => scheduleMobileCaretSync(event.currentTarget)}
                onChange={handleMobileEditorChange}
                onCommit={() => closeMobileEditSession()}
                onProxyTap={handleMobileProxyTap}
            />
        </>
    )
}
