const defaultSections = [
    { id: "personal", navLabel: "Personal", navHint: "Name, contact, summary" },
    { id: "education", navLabel: "Education", navHint: "Schools, degree, dates" },
    { id: "experience", navLabel: "Experience", navHint: "Roles and highlights" }
];

export default function SectionTabs({ activeTab, setActiveTab, sections = defaultSections }) {
    return(
        <div className="tabs" role="tablist" aria-label="Resume sections">
            {sections.map((section, index) => (
                <button
                    key={section.id}
                    className={`tabButton ${activeTab === section.id ? "isActive" : ""}`}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === section.id}
                    onClick={() => setActiveTab(section.id)}
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
