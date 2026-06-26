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
    const addControlRef = useRef(null);
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

    useEffect(() => {
        if (!isAddMenuOpen) {
            return undefined;
        }

        function handlePointerDown(event) {
            if (addControlRef.current?.contains(event.target)) {
                return;
            }

            setIsAddMenuOpen(false);
        }

        function handleKeyDown(event) {
            if (event.key === "Escape") {
                setIsAddMenuOpen(false);
            }
        }

        document.addEventListener("pointerdown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("pointerdown", handlePointerDown);
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isAddMenuOpen]);

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
                    </div>
                </SortableContext>

                {typeof document === "undefined" ? sectionDragOverlay : createPortal(sectionDragOverlay, document.body)}
            </DndContext>

            {canAddSections ? (
                <div className="sectionAddControl" ref={addControlRef}>
                    <button
                        className="button buttonSecondary sectionAddButton"
                        type="button"
                        aria-label={canAddMoreSections ? "Add section" : "Section limit reached"}
                        aria-expanded={isAddMenuOpen}
                        aria-controls="section-add-menu"
                        disabled={!canAddMoreSections}
                        onClick={() => setIsAddMenuOpen((isOpen) => !isOpen)}
                    >
                        +
                    </button>

                    {isAddMenuOpen && canAddMoreSections ? (
                        <div className="sectionAddMenu" id="section-add-menu" role="menu" aria-label="Add resume section">
                            {sectionTemplateGroups.map((group) => (
                                <div className="sectionAddGroup" key={group.id}>
                                    <div className="sectionAddGroupLabel">{group.label}</div>
                                    <div className="sectionAddGroupList">
                                        {group.templates.map((template) => (
                                            <button
                                                className="sectionAddOption"
                                                type="button"
                                                role="menuitem"
                                                key={template.id}
                                                onClick={() => handleAddSection(template.id)}
                                            >
                                                {template.title}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : null}
                </div>
            ) : null}
        </>
    );
}
