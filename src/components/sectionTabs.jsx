import { useState } from "react";

const defaultSections = [
    { id: "personal", navLabel: "Personal", navHint: "Name, contact, summary" },
    { id: "education", navLabel: "Education", navHint: "Schools, degree, dates" },
    { id: "experience", navLabel: "Experience", navHint: "Roles and highlights" }
];

function createTransparentDragImage() {
    if (typeof Image === "undefined") {
        return null;
    }

    const image = new Image();
    image.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
    return image;
}

export default function SectionTabs({
    activeTab,
    setActiveTab,
    sections = defaultSections,
    onReorderSection
}) {
    const [draggedSectionId, setDraggedSectionId] = useState(null);

    function clearDragState() {
        setDraggedSectionId(null);
    }

    function handleDragStart(event, sectionId) {
        if (sectionId === "personal" || !onReorderSection) {
            event.preventDefault();
            return;
        }

        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", sectionId);
        const dragImage = createTransparentDragImage();

        if (dragImage) {
            event.dataTransfer.setDragImage(dragImage, 0, 0);
        }

        setDraggedSectionId(sectionId);
    }

    function handleDragOver(event, sectionId) {
        if (!draggedSectionId || draggedSectionId === sectionId || sectionId === "personal") {
            return;
        }

        const draggedIndex = sections.findIndex((section) => section.id === draggedSectionId);
        const targetIndex = sections.findIndex((section) => section.id === sectionId);

        if (draggedIndex < 1 || targetIndex < 1) {
            return;
        }

        event.preventDefault();
        event.dataTransfer.dropEffect = "move";

        const { top, height } = event.currentTarget.getBoundingClientRect();
        const pointerY = event.clientY - top;

        if (draggedIndex < targetIndex && pointerY < height * 0.55) {
            return;
        }

        if (draggedIndex > targetIndex && pointerY > height * 0.45) {
            return;
        }

        onReorderSection?.(
            draggedSectionId,
            sectionId,
            draggedIndex < targetIndex ? "after" : "before"
        );
    }

    function handleDrop(event) {
        event.preventDefault();
        if (draggedSectionId) {
            setActiveTab(draggedSectionId);
        }
        clearDragState();
    }

    return(
        <div className="tabs" role="tablist" aria-label="Resume sections">
            {sections.map((section, index) => (
                <button
                    key={section.id}
                    className={[
                        "tabButton",
                        activeTab === section.id ? "isActive" : "",
                        draggedSectionId === section.id ? "isDragging" : "",
                        section.id === "personal" ? "isLocked" : ""
                    ].filter(Boolean).join(" ")}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === section.id}
                    draggable={section.id !== "personal" && Boolean(onReorderSection)}
                    onClick={() => setActiveTab(section.id)}
                    onDragStart={(event) => handleDragStart(event, section.id)}
                    onDragOver={(event) => handleDragOver(event, section.id)}
                    onDrop={handleDrop}
                    onDragEnd={clearDragState}
                >
                    <span className="tabIndex" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
                    <span className="tabCopy">
                        <span className="tabLabel">{section.navLabel}</span>
                        <span className="tabHint">{section.navHint}</span>
                    </span>
                </button>
            ))}
        </div>
    )
}
