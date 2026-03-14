import SectionTabs from "./sectionTabs";
import PersonalForm from "./forms/personalForm";
import EducationForm from "./forms/educationForm";
import ExperienceForm from "./forms/experienceForm";

const sectionMeta = {
    personal: {
        navLabel: "Personal",
        navHint: "Name, contact, summary",
        label: "Personal details",
        description: "Add your name, contact details, and summary with clear validation and polished defaults."
    },
    education: {
        navLabel: "Education",
        navHint: "Schools, degree, dates",
        label: "Education",
        description: "Organize institutions, degrees, and dates in a structure that stays easy to scan."
    },
    experience: {
        navLabel: "Experience",
        navHint: "Roles and highlights",
        label: "Experience",
        description: "Shape concise, high-signal role entries with reorderable highlights for stronger storytelling."
    }
};

export default function EditorPanel({
    activeTab,
    setActiveTab,
    sectionOrder,
    onMoveSection,
    resume,
    actions,
    getFieldError,
    markTouched,
    issueCount,
    maxHeight
}) {
    const currentSection = sectionMeta[activeTab];
    const sections = sectionOrder.map((id) => ({
        id,
        navLabel: sectionMeta[id].navLabel,
        navHint: sectionMeta[id].navHint
    }));
    const activeSectionIndex = sectionOrder.indexOf(activeTab);
    const canMoveSectionUp = activeTab !== "personal" && activeSectionIndex > 1;
    const canMoveSectionDown = activeTab !== "personal" && activeSectionIndex < sectionOrder.length - 1;
    const editorWorkspaceStyle = maxHeight
        ? {
            minHeight: `${maxHeight}px`,
            '--editor-stage-max-height': `${maxHeight}px`
        }
        : undefined;

    return (
        <section className="editorPanel">
            <div className="editorWorkspace" style={editorWorkspaceStyle}>
                <aside className="editorRail panel">
                    <div className="editorRailHeader">
                        <p className="kicker">Editor</p>
                        <h2>Sections</h2>
                    </div>

                    <SectionTabs
                        activeTab={activeTab}
                        setActiveTab={setActiveTab}
                        sections={sections}
                    />
                </aside>

                <div className="editorStage panel">
                    <div className="editorPanelHeader">
                        <div className="editorPanelHeading">
                            <p className="kicker">Current section</p>
                            <h3>{currentSection.label}</h3>
                        </div>

                        <div className="editorPanelMeta">
                            <div className="sectionOrderControl">
                                <span className="sectionOrderLabel">Section order</span>
                                <div className="sectionOrderActions">
                                    <button
                                        className="button buttonSecondary iconButton"
                                        type="button"
                                        onClick={() => onMoveSection(activeTab, -1)}
                                        disabled={!canMoveSectionUp}
                                        aria-label={`Move ${currentSection.label} up in the resume order`}
                                    >
                                        ↑
                                    </button>
                                    <button
                                        className="button buttonSecondary iconButton"
                                        type="button"
                                        onClick={() => onMoveSection(activeTab, 1)}
                                        disabled={!canMoveSectionDown}
                                        aria-label={`Move ${currentSection.label} down in the resume order`}
                                    >
                                        ↓
                                    </button>
                                </div>
                            </div>

                            <span className={`statusBadge ${issueCount > 0 ? 'statusBadge--warning' : 'statusBadge--success'}`}>
                                {issueCount > 0 ? `${issueCount} thing${issueCount === 1 ? '' : 's'} to review` : 'All key fields look good'}
                            </span>
                        </div>
                    </div>

                    <div className="formContainer">
                        {activeTab === "personal" && (
                            <PersonalForm
                                personal={resume.personal}
                                actions={actions}
                                getFieldError={getFieldError}
                                markTouched={markTouched}
                            />
                        )}
                        {activeTab === "education" && (
                            <EducationForm
                                education={resume.education}
                                actions={actions}
                                getFieldError={getFieldError}
                                markTouched={markTouched}
                            />
                        )}
                        {activeTab === "experience" && (
                            <ExperienceForm
                                experience={resume.experience}
                                actions={actions}
                                getFieldError={getFieldError}
                                markTouched={markTouched}
                            />
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
