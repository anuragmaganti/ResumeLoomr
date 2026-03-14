import SectionTabs from "./sectionTabs"
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

export default function EditorPanel({ activeTab, setActiveTab, resume, actions, getFieldError, markTouched, issueCount, maxHeight }) {
    const currentSection = sectionMeta[activeTab];
    const sections = Object.entries(sectionMeta).map(([id, meta]) => ({
        id,
        navLabel: meta.navLabel,
        navHint: meta.navHint
    }));
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
                        <p className="kicker">Current section</p>
                        <h3>{currentSection.label}</h3>
                        <div className="editorPanelMeta">
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
};
