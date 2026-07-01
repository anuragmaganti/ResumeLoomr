import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
    closestCenter,
    DndContext,
    DragOverlay,
    useSensor,
    useSensors
} from "@dnd-kit/core";
import {
    arrayMove,
    rectSortingStrategy,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ResumeLoomrKeyboardSensor, ResumeLoomrPointerSensor } from "../lib/sortableSensors.js";

const defaultSections = [
    { id: "personal", navLabel: "Personal", navHint: "Name, contact, summary" },
    { id: "education", navLabel: "Education", navHint: "Schools, degree, dates" },
    { id: "experience", navLabel: "Experience", navHint: "Roles and highlights" }
];

function getSectionIds(sections) {
    return sections.map((section) => section.id);
}

function SectionTabContent({ section, index }) {
    return (
        <>
            <span className="tabIndex" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
            <span className="tabCopy">
                <span className="tabLabel">{section.navLabel}</span>
                <span className="tabHint">{section.navHint}</span>
            </span>
        </>
    );
}

function SortableSectionTab({
    section,
    index,
    isActive,
    isLocked,
    setActiveTab
}) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({
        id: section.id,
        disabled: isLocked
    });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition
    };

    return (
        <button
            ref={setNodeRef}
            className={[
                "tabButton",
                isActive ? "isActive" : "",
                isDragging ? "isSortingPlaceholder" : "",
                isLocked ? "isLocked" : ""
            ].filter(Boolean).join(" ")}
            style={style}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => setActiveTab(section.id)}
            {...attributes}
            {...listeners}
        >
            <SectionTabContent section={section} index={index} />
        </button>
    );
}

function SectionTabOverlay({ section, index, isActive, style }) {
    if (!section) {
        return null;
    }

    return (
        <div className={`tabButton tabButtonOverlay${isActive ? " isActive" : ""}`} style={style}>
            <SectionTabContent section={section} index={index} />
        </div>
    );
}

function SectionAddDialog({
    isOpen,
    anchorRef,
    sectionTemplateGroups,
    onSelectTemplate,
    onClose
}) {
    const dialogRef = useRef(null);
    const firstOptionRef = useRef(null);
    const [anchorStyle, setAnchorStyle] = useState(null);

    useEffect(() => {
        if (!isOpen) {
            return undefined;
        }

        function updateAnchorStyle() {
            const anchorRect = anchorRef?.current?.getBoundingClientRect();

            if (!anchorRect || window.innerWidth <= 720) {
                setAnchorStyle(null);
                return;
            }

            const viewportPadding = 16;
            const dialogWidth = Math.min(820, window.innerWidth - viewportPadding * 2);
            const left = Math.min(
                Math.max(viewportPadding, anchorRect.left),
                window.innerWidth - dialogWidth - viewportPadding
            );
            const bottom = Math.max(viewportPadding, window.innerHeight - anchorRect.top + 10);

            setAnchorStyle({
                "--section-add-dialog-left": `${left}px`,
                "--section-add-dialog-bottom": `${bottom}px`,
                "--section-add-dialog-width": `${dialogWidth}px`
            });
        }

        updateAnchorStyle();

        const frameId = window.requestAnimationFrame(() => {
            firstOptionRef.current?.focus({ preventScroll: true });
        });

        function handleKeyDown(event) {
            if (event.key === "Escape") {
                event.preventDefault();
                onClose({ restoreFocus: true });
            }
        }

        window.addEventListener("resize", updateAnchorStyle);
        window.addEventListener("scroll", updateAnchorStyle, true);
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            window.cancelAnimationFrame(frameId);
            window.removeEventListener("resize", updateAnchorStyle);
            window.removeEventListener("scroll", updateAnchorStyle, true);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [anchorRef, isOpen, onClose]);

    if (!isOpen || typeof document === "undefined") {
        return null;
    }

    function handleDialogKeyDown(event) {
        if (event.key !== "Tab") {
            return;
        }

        const focusableElements = Array.from(dialogRef.current?.querySelectorAll("button:not(:disabled)") || []);

        if (focusableElements.length === 0) {
            return;
        }

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (event.shiftKey && document.activeElement === firstElement) {
            event.preventDefault();
            lastElement.focus();
            return;
        }

        if (!event.shiftKey && document.activeElement === lastElement) {
            event.preventDefault();
            firstElement.focus();
        }
    }

    const firstTemplateId = sectionTemplateGroups.find((group) => group.templates.length > 0)?.templates[0]?.id || "";
    const dialog = (
        <div
            className={`sectionAddDialogLayer${anchorStyle ? " sectionAddDialogLayer--anchored" : ""}`}
            style={anchorStyle || undefined}
        >
            <button
                type="button"
                className="sectionAddDialogBackdrop"
                tabIndex={-1}
                onClick={() => onClose({ restoreFocus: true })}
                aria-label="Close section selector"
            />

            <section
                id="section-add-dialog"
                className="sectionAddDialog panel"
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-label="Choose a section"
                onKeyDown={handleDialogKeyDown}
            >
                <div className="sectionAddDialogGroups">
                    {sectionTemplateGroups.map((group) => (
                        <div className={`sectionAddDialogGroup sectionAddDialogGroup--${group.id}`} key={group.id}>
                            <div className="sectionAddDialogGroupLabel">{group.label}</div>
                            <div className="sectionAddDialogOptionGrid">
                                {group.templates.map((template) => {
                                    return (
                                        <button
                                            className="sectionAddDialogOption"
                                            type="button"
                                            key={template.id}
                                            ref={template.id === firstTemplateId ? firstOptionRef : undefined}
                                            onClick={() => onSelectTemplate(template.id)}
                                        >
                                            {template.title}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );

    return createPortal(dialog, document.body);
}

export default function SectionTabs({
    activeTab,
    setActiveTab,
    sections = defaultSections,
    onReorderSections,
    onReorderSection,
    sectionTemplateGroups = [],
    onAddSection,
    canAddMoreSections = true
}) {
    const [activeDragId, setActiveDragId] = useState(null);
    const [activeDragRect, setActiveDragRect] = useState(null);
    const [isAddMenuOpen, setIsAddMenuOpen] = useState(false);
    const addButtonRef = useRef(null);
    const sectionIds = useMemo(() => getSectionIds(sections), [sections]);
    const sectionById = useMemo(
        () => new Map(sections.map((section) => [section.id, section])),
        [sections]
    );
    const orderedSections = useMemo(
        () => sectionIds.map((sectionId) => sectionById.get(sectionId)).filter(Boolean),
        [sectionIds, sectionById]
    );
    const activeDragSection = activeDragId ? sectionById.get(activeDragId) : null;
    const activeDragIndex = activeDragId ? sectionIds.indexOf(activeDragId) : -1;
    const canReorder = Boolean(onReorderSections || onReorderSection);
    const canAddSections = Boolean(onAddSection && sectionTemplateGroups.length > 0);
    const sensors = useSensors(
        useSensor(ResumeLoomrPointerSensor, {
            activationConstraint: {
                distance: 6
            }
        }),
        useSensor(ResumeLoomrKeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates
        })
    );

    function handleSectionDragStart(event) {
        const sectionId = String(event.active.id);

        if (sectionId === "personal" || !canReorder) {
            return;
        }

        setActiveDragId(sectionId);
        const rect = event.active.rect.current.initial;
        setActiveDragRect(rect ? { width: rect.width, height: rect.height } : null);
    }

    function resetSectionDragState() {
        setActiveDragId(null);
        setActiveDragRect(null);
    }

    function handleSectionDragEnd(event) {
        const activeId = String(event.active.id);
        const overId = event.over?.id ? String(event.over.id) : "";

        setActiveDragId(null);
        setActiveDragRect(null);

        if (!canReorder || activeId === "personal" || !overId || overId === "personal" || activeId === overId) {
            return;
        }

        const oldIndex = sectionIds.indexOf(activeId);
        const newIndex = sectionIds.indexOf(overId);

        if (oldIndex >= 1 && newIndex >= 1 && oldIndex !== newIndex) {
            const nextSectionIds = arrayMove(sectionIds, oldIndex, newIndex);

            if (onReorderSections) {
                onReorderSections(nextSectionIds);
            } else if (event.over?.id && onReorderSection) {
                onReorderSection(activeId, String(event.over.id), "before");
            }

            setActiveTab(activeId);
            return;
        }
    }

    function handleAddSection(templateId) {
        onAddSection?.(templateId);
        setIsAddMenuOpen(false);
    }

    function closeAddDialog({ restoreFocus = false } = {}) {
        setIsAddMenuOpen(false);

        if (restoreFocus) {
            window.requestAnimationFrame(() => {
                addButtonRef.current?.focus({ preventScroll: true });
            });
        }
    }

    const sectionDragOverlay = (
        <DragOverlay adjustScale={false} zIndex={1000}>
            <SectionTabOverlay
                section={activeDragSection}
                index={activeDragIndex}
                isActive={activeDragId === activeTab}
                style={activeDragRect ? {
                    width: `${activeDragRect.width}px`,
                    height: `${activeDragRect.height}px`
                } : undefined}
            />
        </DragOverlay>
    );

    return (
        <>
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleSectionDragStart}
                onDragEnd={handleSectionDragEnd}
                onDragCancel={resetSectionDragState}
            >
                <SortableContext items={sectionIds} strategy={rectSortingStrategy}>
                    <div className="tabs" role="tablist" aria-label="Resume sections">
                        {orderedSections.map((section, index) => (
                            <SortableSectionTab
                                key={section.id}
                                section={section}
                                index={index}
                                isActive={activeTab === section.id}
                                isLocked={section.id === "personal" || !canReorder}
                                setActiveTab={setActiveTab}
                            />
                        ))}

                        {canAddSections ? (
                            <div className="sectionAddControl">
                                <button
                                    ref={addButtonRef}
                                    className="tabButton sectionAddButton isLocked"
                                    type="button"
                                    aria-label={canAddMoreSections ? "Add section" : "Section limit reached"}
                                    aria-expanded={isAddMenuOpen}
                                    aria-haspopup="dialog"
                                    aria-controls="section-add-dialog"
                                    disabled={!canAddMoreSections}
                                    onClick={() => {
                                        if (isAddMenuOpen) {
                                            closeAddDialog();
                                            return;
                                        }

                                        setIsAddMenuOpen(true);
                                    }}
                                >
                                    <span className="sectionAddButtonIcon" aria-hidden="true">+</span>
                                </button>

                                <SectionAddDialog
                                    isOpen={isAddMenuOpen && canAddMoreSections}
                                    anchorRef={addButtonRef}
                                    sectionTemplateGroups={sectionTemplateGroups}
                                    onSelectTemplate={handleAddSection}
                                    onClose={closeAddDialog}
                                />
                            </div>
                        ) : null}
                    </div>
                </SortableContext>

                {typeof document === "undefined" ? sectionDragOverlay : createPortal(sectionDragOverlay, document.body)}
            </DndContext>
        </>
    );
}
