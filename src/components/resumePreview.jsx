import { useMemo, useRef, useState } from 'react';
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

function SortablePreviewSection({ blockId, className, children }) {
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
        transform: CSS.Translate.toString(transform),
        transition,
    };
    const handleProps = {
        ...attributes,
        ...listeners,
        'data-preview-drag-handle': 'true',
    };

    return (
        <div
            ref={setNodeRef}
            data-preview-sortable-id={sortableId}
            className={`${className} previewSortableItem previewSortableSection ${isDragging ? 'isPreviewSortingPlaceholder' : ''}`}
            style={style}
        >
            {children(handleProps)}
        </div>
    );
}

function StaticPreviewSection({ className, children }) {
    return (
        <div className={className}>
            {children({})}
        </div>
    );
}

function SortablePreviewEntry({ sectionId, entryId, className, children }) {
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
        transform: CSS.Translate.toString(transform),
        transition,
    };
    const handleProps = {
        ...attributes,
        ...listeners,
        'data-preview-drag-handle': 'true',
    };

    return (
        <div
            ref={setNodeRef}
            data-preview-sortable-id={sortableId}
            className={`${className} previewSortableItem previewSortableEntry ${isDragging ? 'isPreviewSortingPlaceholder' : ''}`}
            style={style}
        >
            {children(handleProps)}
        </div>
    );
}

function StaticPreviewEntry({ className, children }) {
    return (
        <div className={className}>
            {children({})}
        </div>
    );
}

function SortablePreviewBullet({ sectionId, entryId, field, itemIndex, editProps, children }) {
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
        transform: CSS.Translate.toString(transform),
        transition,
    };
    const handleProps = {
        ...attributes,
        ...listeners,
        'data-preview-drag-handle': 'true',
    };

    return (
        <li
            ref={setNodeRef}
            data-preview-sortable-id={sortableId}
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
    return <li {...editProps}>{children}</li>;
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

export default function ResumePreview({
    previewModel,
    template,
    settings,
    panelRef,
    onEditTarget,
    onReorderSections,
    onReorderSectionEntries,
    onReorderSectionTextList,
    activeEditorCaret,
}) {
    const resumeRef = useRef(null);
    const suppressPreviewClickRef = useRef(false);
    const activeDragScrollRef = useRef({ x: 0, y: 0, capturedAt: 0 });
    const [activeDragMeta, setActiveDragMeta] = useState(null);
    const [activeDragRect, setActiveDragRect] = useState(null);
    const presentationVars = useMemo(() => getResumePresentationVars(settings, template), [settings, template]);
    const printPageRule = useMemo(() => getResumePrintPageRule(settings, template), [settings, template]);
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

    function personalTarget(field) {
        return createPreviewEditAttributes({
            sectionId: 'personal',
            field,
            path: personalEditorPath(field),
        });
    }

    function sectionTitleTarget(sectionId) {
        return createPreviewEditAttributes({
            sectionId,
            field: '__title',
            path: sectionTitleEditorPath(sectionId),
        });
    }

    function entryTarget(sectionId, entryId, field) {
        return createPreviewEditAttributes({
            sectionId,
            entryId,
            field,
            path: sectionEntryEditorPath(sectionId, entryId, field),
        });
    }

    function listTarget(sectionId, entryId, field, itemIndex) {
        return createPreviewEditAttributes({
            sectionId,
            entryId,
            field,
            itemIndex,
            path: sectionEntryListEditorPath(sectionId, entryId, field, itemIndex),
        });
    }

    function nestedTarget(sectionId, entryId, nestedPath) {
        const pathParts = nestedPath.split('.');

        return createPreviewEditAttributes({
            sectionId,
            entryId,
            field: pathParts[pathParts.length - 1] || nestedPath,
            nestedPath,
            path: sectionEntryNestedEditorPath(sectionId, entryId, nestedPath),
        });
    }

    function renderTextWithCaret(value, path, { prefix = '', suffix = '', fallback = '' } = {}) {
        const text = value === undefined || value === null ? '' : String(value);
        const displayText = text || fallback;
        const shouldShowCaret = (
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

        onEditTarget({
            sectionId: targetElement.dataset.editSectionId,
            field: targetElement.dataset.editField || '',
            entryId: targetElement.dataset.editEntryId || '',
            itemIndex: targetElement.dataset.editItemIndex ? Number(targetElement.dataset.editItemIndex) : undefined,
            nestedPath: targetElement.dataset.editNestedPath || '',
            path: targetElement.dataset.editPath,
        });
    }

    function suppressNextPreviewClick() {
        suppressPreviewClickRef.current = true;
        window.setTimeout(() => {
            suppressPreviewClickRef.current = false;
        }, 200);
    }

    function capturePreviewDragScroll() {
        activeDragScrollRef.current = {
            x: window.scrollX,
            y: window.scrollY,
            capturedAt: Date.now(),
        };
    }

    function handlePreviewDragHandleCapture(event) {
        if (event.target.closest('[data-preview-drag-handle]')) {
            capturePreviewDragScroll();
        }
    }

    function openPreviewEditTarget(target) {
        if (target?.path) {
            onEditTarget?.({
                ...target,
                ...(target.preserveScroll ? {
                    scrollX: activeDragScrollRef.current.x,
                    scrollY: activeDragScrollRef.current.y,
                } : {}),
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
        const hasFreshScrollCapture = Date.now() - activeDragScrollRef.current.capturedAt < 1000;

        if (!hasFreshScrollCapture) {
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
        activeDragScrollRef.current = { x: 0, y: 0, capturedAt: 0 };
    }

    function handlePreviewDragEnd(event) {
        const activeMeta = parsePreviewDragId(event.active.id);
        const overMeta = event.over ? parsePreviewDragId(event.over.id) : null;
        setActiveDragMeta(null);
        setActiveDragRect(null);

        if (!overMeta || !areCompatiblePreviewDragItems(activeMeta, overMeta)) {
            return;
        }

        suppressNextPreviewClick();

        if (activeMeta.type === 'section') {
            const sectionIds = previewModel.sectionBlocks.map((block) => block.id);
            const fromIndex = sectionIds.indexOf(activeMeta.sectionId);
            const toIndex = sectionIds.indexOf(overMeta.sectionId);

            if (fromIndex >= 0 && toIndex >= 0 && fromIndex !== toIndex) {
                onReorderSections?.(arrayMove(sectionIds, fromIndex, toIndex));
            }

            openPreviewEditTarget({
                sectionId: activeMeta.sectionId,
                field: '__title',
                path: sectionTitleEditorPath(activeMeta.sectionId),
                preserveScroll: true,
            });
            return;
        }

        if (activeMeta.type === 'entry') {
            const block = findBlock(activeMeta.sectionId);
            const entry = findEntry(block, activeMeta.entryId);

            if (!block || !entry) {
                return;
            }

            const entryIds = block?.entries.map((blockEntry) => blockEntry.id) || [];
            const fromIndex = entryIds.indexOf(activeMeta.entryId);
            const toIndex = entryIds.indexOf(overMeta.entryId);

            if (fromIndex >= 0 && toIndex >= 0 && fromIndex !== toIndex) {
                onReorderSectionEntries?.(activeMeta.sectionId, arrayMove(entryIds, fromIndex, toIndex));
            }

            const field = getPrimaryEntryField(block, entry);
            openPreviewEditTarget({
                sectionId: activeMeta.sectionId,
                entryId: activeMeta.entryId,
                field,
                path: sectionEntryEditorPath(activeMeta.sectionId, activeMeta.entryId, field),
                preserveScroll: true,
            });
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
                preserveScroll: true,
            });
        }
    }

    function renderBulletEntries(items, { sectionId, entryId, field, createTarget, sortable = true } = {}) {
        if (items.length === 0) {
            return null;
        }

        const bulletIds = items.map((_, index) => bulletDragId(sectionId, entryId, field, index));
        const bulletList = (
            <ul className="previewEntryList">
                {items.map((item, index) => {
                    const bulletPath = sectionEntryListEditorPath(sectionId, entryId, field, index);

                    return sortable ? (
                            <SortablePreviewBullet
                                key={`${entryId}-${field}-${index}`}
                                sectionId={sectionId}
                                entryId={entryId}
                                field={field}
                                itemIndex={index}
                                editProps={createTarget ? createTarget(index) : {}}
                            >
                                {renderTextWithCaret(item, bulletPath)}
                            </SortablePreviewBullet>
                        ) : (
                            <StaticPreviewBullet
                                key={`${entryId}-${field}-${index}`}
                                editProps={createTarget ? createTarget(index) : {}}
                            >
                                {renderTextWithCaret(item, bulletPath)}
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
            <SectionShell key={block.id} blockId={block.id} className={`resumeSection ${sectionClassName}`}>
                {(sectionHandleProps) => (
                    <>
                        <h2 {...sectionTitleTarget(block.id)} {...sectionHandleProps}>
                            {renderTextWithCaret(block.title, sectionTitleEditorPath(block.id))}
                        </h2>
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

    function renderPersonalSection() {
        if (!previewModel.showPersonal) {
            return null;
        }

        return (
            <div className="resumeSection personalSection" key="personal">
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
                    <div className="aboutMe" {...personalTarget('aboutMe')}>
                        {renderTextWithCaret(previewModel.personal.aboutMe, personalEditorPath('aboutMe'))}
                    </div>
                )}
            </div>
        );
    }

    function renderEducationSection(block, { sortable = true } = {}) {
        const SectionShell = sortable ? SortablePreviewSection : StaticPreviewSection;
        const EntryShell = sortable ? SortablePreviewEntry : StaticPreviewEntry;
        const entryItems = block.entries.map((entry) => entryDragId(block.id, entry.id));
        const entries = block.entries.map((institution) => (
            <EntryShell
                key={institution.id}
                sectionId={block.id}
                entryId={institution.id}
                className="educationSection"
            >
                {(entryHandleProps) => (
                    <>
                        {(institution.school || institution.location || institution.yearsEdu) && (
                            <div className="degreeYearsEduFlex">
                                {(institution.school || institution.location) && (
                                    <div className="schoolLocation">
                                        {institution.school && (
                                            <span
                                                className="school"
                                                {...entryTarget(block.id, institution.id, 'school')}
                                                {...entryHandleProps}
                                            >
                                                {renderTextWithCaret(institution.school, sectionEntryEditorPath(block.id, institution.id, 'school'))}
                                            </span>
                                        )}
                                        {institution.location && (
                                            <span className="eduLocation" {...entryTarget(block.id, institution.id, 'location')}>
                                                {renderTextWithCaret(institution.location, sectionEntryEditorPath(block.id, institution.id, 'location'))}
                                            </span>
                                        )}
                                    </div>
                                )}
                                {institution.yearsEdu && (
                                    <div className="yearsEdu" {...entryTarget(block.id, institution.id, 'yearsEdu')}>
                                        {renderTextWithCaret(institution.yearsEdu, sectionEntryEditorPath(block.id, institution.id, 'yearsEdu'))}
                                    </div>
                                )}
                            </div>
                        )}
                        {institution.programs?.length > 0 ? (
                            institution.programs.map((program, programIndex) => (
                                <div className="schoolLocationRow" key={program.id}>
                                    <div className="educationDegreeRow">
                                        {program.degree && (
                                            <div
                                                className="degree"
                                                {...nestedTarget(block.id, institution.id, `programs.${programIndex}.degree`)}
                                            >
                                                {renderTextWithCaret(program.degree, sectionEntryNestedEditorPath(block.id, institution.id, `programs.${programIndex}.degree`))}
                                            </div>
                                        )}
                                        {program.honors && (
                                            <div
                                                className="educationMeta"
                                                {...nestedTarget(block.id, institution.id, `programs.${programIndex}.honors`)}
                                            >
                                                <span>
                                                    {renderTextWithCaret(program.honors, sectionEntryNestedEditorPath(block.id, institution.id, `programs.${programIndex}.honors`))}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    {(program.yearsEdu || program.gpa) && (
                                        <div className="yearsEdu educationGpa">
                                            {program.yearsEdu && (
                                                <span {...nestedTarget(block.id, institution.id, `programs.${programIndex}.yearsEdu`)}>
                                                    {renderTextWithCaret(program.yearsEdu, sectionEntryNestedEditorPath(block.id, institution.id, `programs.${programIndex}.yearsEdu`))}
                                                </span>
                                            )}
                                            {program.yearsEdu && program.gpa ? <span> | </span> : null}
                                            {program.gpa && (
                                                <span {...nestedTarget(block.id, institution.id, `programs.${programIndex}.gpa`)}>
                                                    {renderTextWithCaret(program.gpa, sectionEntryNestedEditorPath(block.id, institution.id, `programs.${programIndex}.gpa`), { prefix: 'GPA: ' })}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))
                        ) : (
                            (institution.degree || institution.honors || institution.gpa) && (
                                <div className="schoolLocationRow">
                                    <div className="educationDegreeRow">
                                        {institution.degree && (
                                            <div className="degree" {...entryTarget(block.id, institution.id, 'degree')}>
                                                {renderTextWithCaret(institution.degree, sectionEntryEditorPath(block.id, institution.id, 'degree'))}
                                            </div>
                                        )}
                                        {institution.honors && (
                                            <div className="educationMeta" {...entryTarget(block.id, institution.id, 'honors')}>
                                                <span>{renderTextWithCaret(institution.honors, sectionEntryEditorPath(block.id, institution.id, 'honors'))}</span>
                                            </div>
                                        )}
                                    </div>
                                    {institution.gpa && (
                                        <div className="yearsEdu educationGpa" {...entryTarget(block.id, institution.id, 'gpa')}>
                                            {renderTextWithCaret(institution.gpa, sectionEntryEditorPath(block.id, institution.id, 'gpa'), { prefix: 'GPA: ' })}
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
            <SectionShell key={block.id} blockId={block.id} className="resumeSection educationDiv">
                {(sectionHandleProps) => (
                    <>
                        <h2 {...sectionTitleTarget(block.id)} {...sectionHandleProps}>
                            {renderTextWithCaret(block.title, sectionTitleEditorPath(block.id))}
                        </h2>
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

    function renderRolesSection(block, { sortable = true } = {}) {
        const SectionShell = sortable ? SortablePreviewSection : StaticPreviewSection;
        const EntryShell = sortable ? SortablePreviewEntry : StaticPreviewEntry;
        const entryItems = block.entries.map((entry) => entryDragId(block.id, entry.id));
        const entries = block.entries.map((job) => (
            <EntryShell
                key={job.id}
                sectionId={block.id}
                entryId={job.id}
                className="experienceSection"
            >
                {(entryHandleProps) => (
                    <>
                        {(job.company || job.role || job.yearsExp) && (
                            <div className="companyYearsExpFlex">
                                {(job.company || job.role) && (
                                    <div className="companyRoleLine">
                                        {job.company && (
                                            <span
                                                className="company"
                                                {...entryTarget(block.id, job.id, 'company')}
                                                {...entryHandleProps}
                                            >
                                                {renderTextWithCaret(job.company, sectionEntryEditorPath(block.id, job.id, 'company'))}
                                            </span>
                                        )}
                                        {job.company && job.role && <span className="roleSeparator">, </span>}
                                        {job.role && (
                                            <span
                                                className="role"
                                                {...entryTarget(block.id, job.id, 'role')}
                                                {...(!job.company ? entryHandleProps : {})}
                                            >
                                                {renderTextWithCaret(job.role, sectionEntryEditorPath(block.id, job.id, 'role'))}
                                            </span>
                                        )}
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
            <SectionShell key={block.id} blockId={block.id} className="resumeSection experienceDiv">
                {(sectionHandleProps) => (
                    <>
                        <h2 {...sectionTitleTarget(block.id)} {...sectionHandleProps}>
                            {renderTextWithCaret(block.title, sectionTitleEditorPath(block.id))}
                        </h2>
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

    function renderSkillsSection(block, { sortable = true } = {}) {
        const SectionShell = sortable ? SortablePreviewSection : StaticPreviewSection;
        const EntryShell = sortable ? SortablePreviewEntry : StaticPreviewEntry;
        const entryItems = block.entries.map((entry) => entryDragId(block.id, entry.id));
        const entries = block.entries.map((entry) => (
            <EntryShell
                key={entry.id}
                sectionId={block.id}
                entryId={entry.id}
                className="skillGroup"
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
            <SectionShell key={block.id} blockId={block.id} className="resumeSection skillsDiv">
                {(sectionHandleProps) => (
                    <>
                        <h2 {...sectionTitleTarget(block.id)} {...sectionHandleProps}>
                            {renderTextWithCaret(block.title, sectionTitleEditorPath(block.id))}
                        </h2>
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

    function renderProjectsSection(block, { sortable = true } = {}) {
        const SectionShell = sortable ? SortablePreviewSection : StaticPreviewSection;
        const EntryShell = sortable ? SortablePreviewEntry : StaticPreviewEntry;
        const entryItems = block.entries.map((entry) => entryDragId(block.id, entry.id));
        const entries = block.entries.map((entry) => (
            <EntryShell
                key={entry.id}
                sectionId={block.id}
                entryId={entry.id}
                className="previewEntry"
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
            <SectionShell key={block.id} blockId={block.id} className="resumeSection projectsDiv">
                {(sectionHandleProps) => (
                    <>
                        <h2 {...sectionTitleTarget(block.id)} {...sectionHandleProps}>
                            {renderTextWithCaret(block.title, sectionTitleEditorPath(block.id))}
                        </h2>
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

    function renderLanguagesSection(block, { sortable = true } = {}) {
        const SectionShell = sortable ? SortablePreviewSection : StaticPreviewSection;
        const EntryShell = sortable ? SortablePreviewEntry : StaticPreviewEntry;
        const entryItems = block.entries.map((entry) => entryDragId(block.id, entry.id));
        const entries = block.entries.map((entry) => (
            <EntryShell
                key={entry.id}
                sectionId={block.id}
                entryId={entry.id}
                className="previewEntry previewEntry--tight"
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
            <SectionShell key={block.id} blockId={block.id} className="resumeSection languagesDiv">
                {(sectionHandleProps) => (
                    <>
                        <h2 {...sectionTitleTarget(block.id)} {...sectionHandleProps}>
                            {renderTextWithCaret(block.title, sectionTitleEditorPath(block.id))}
                        </h2>
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

    function renderCustomSection(block, { sortable = true } = {}) {
        const SectionShell = sortable ? SortablePreviewSection : StaticPreviewSection;
        const EntryShell = sortable ? SortablePreviewEntry : StaticPreviewEntry;
        const entryItems = block.entries.map((entry) => entryDragId(block.id, entry.id));
        const entries = block.entries.map((entry) => (
            <EntryShell
                key={entry.id}
                sectionId={block.id}
                entryId={entry.id}
                className="previewEntry"
            >
                {(entryHandleProps) => (
                    <>
                        <div className="previewEntryHeader">
                            <div
                                className="previewEntryTitle"
                                {...entryTarget(block.id, entry.id, 'title')}
                                {...entryHandleProps}
                            >
                                {renderTextWithCaret(entry.title, sectionEntryEditorPath(block.id, entry.id, 'title'))}
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
            <SectionShell key={block.id} blockId={block.id} className="resumeSection customDiv">
                {(sectionHandleProps) => (
                    <>
                        <h2 {...sectionTitleTarget(block.id)} {...sectionHandleProps}>
                            {renderTextWithCaret(block.title, sectionTitleEditorPath(block.id))}
                        </h2>
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
                    {renderSectionBlock(block, { sortable: false })}
                </div>
            ) : null;
        }

        if (activeDragMeta.type === 'entry') {
            const block = findBlock(activeDragMeta.sectionId);
            const entry = findEntry(block, activeDragMeta.entryId);

            return block && entry ? (
                <div className="previewDragOverlay previewDragOverlay--entry">
                    {renderSectionBlock({ ...block, entries: [entry] }, { sortable: false })}
                </div>
            ) : null;
        }

        if (activeDragMeta.type === 'bullet') {
            const block = findBlock(activeDragMeta.sectionId);
            const entry = findEntry(block, activeDragMeta.entryId);
            const text = entry?.[activeDragMeta.field]?.[activeDragMeta.itemIndex];

            return text ? (
                <ul className="previewEntryList previewDragOverlay previewDragOverlay--bullet">
                    <li>{text}</li>
                </ul>
            ) : null;
        }

        return null;
    }

    const sectionDragItems = previewModel.sectionBlocks.map((block) => sectionDragId(block.id));
    const dragOverlayStyle = {
        ...presentationVars,
        ...(activeDragRect ? {
            width: `${activeDragRect.width}px`,
            height: `${activeDragRect.height}px`,
        } : {}),
    };
    const previewDragOverlay = (
        <DragOverlay adjustScale={false} dropAnimation={null} zIndex={1000}>
            <div className={`previewDragOverlayFrame ${templateClassName(template)}`} style={dragOverlayStyle}>
                {renderPreviewDragOverlay()}
            </div>
        </DragOverlay>
    );
    const orderedSections = [
        renderPersonalSection(),
        (
            <SortableContext key="preview-sections" items={sectionDragItems} strategy={verticalListSortingStrategy}>
                {previewModel.sectionBlocks.map((block) => renderSectionBlock(block))}
            </SortableContext>
        ),
    ].filter(Boolean);

    return (
        <>
            <style media="print">{printPageRule}</style>
            <section ref={panelRef} className="previewPanel">
                <div className="previewFrame">
                    <div
                        ref={resumeRef}
                        className={`resumePage ${templateClassName(template)}`}
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
                                {orderedSections}
                                {typeof document === 'undefined' ? previewDragOverlay : createPortal(previewDragOverlay, document.body)}
                            </DndContext>
                        ) : (
                            <div className="resumeEmptyState">
                                <p className="resumeEmptyEyebrow">Live preview</p>
                                <h3>Your resume will appear here</h3>
                                <p>Start with your personal details, then add education and experience. Empty sections stay out of the final document until you add real content.</p>
                            </div>
                        )}
                    </div>
                </div>
            </section>
        </>
    )
}
