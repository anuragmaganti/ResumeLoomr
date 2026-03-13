const sections = [
    { id: "personal", label: "Personal" },
    { id: "education", label: "Education" },
    { id: "experience", label: "Experience" }
];

export default function SectionTabs({ activeTab, setActiveTab }) {
    return(
        <div className="tabs" role="tablist" aria-label="Resume sections">
            {sections.map((section) => (
                <button
                    key={section.id}
                    className={`tabButton ${activeTab === section.id ? "isActive" : ""}`}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === section.id}
                    onClick={() => setActiveTab(section.id)}
                >
                    {section.label}
                </button>
            ))}
        </div>
    )
}
