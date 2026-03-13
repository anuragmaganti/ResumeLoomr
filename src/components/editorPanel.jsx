import SectionTabs from "./sectionTabs"
import PersonalForm from "./forms/personalForm";
import EducationForm from "./forms/educationForm";
import ExperienceForm from "./forms/experienceForm";

const sectionMeta = {
    personal: {
        label: "Personal details",
        description: "Add your name, contact details, and summary with clear validation and polished defaults."
    },
    education: {
        label: "Education",
        description: "Organize institutions, degrees, and dates in a structure that stays easy to scan."
    },
    experience: {
        label: "Experience",
        description: "Shape concise, high-signal role entries with reorderable highlights for stronger storytelling."
    }
};

export default function EditorPanel({ activeTab, setActiveTab, resume, actions, getFieldError, markTouched, issueCount }) {
    const currentSection = sectionMeta[activeTab];

    return (
        <section className="editorPanel panel">
            <div className="editorPanelHeader">
                <p className="kicker">Editor</p>
                <h2>{currentSection.label}</h2>
                <p className="panelDescription editorPanelDescription">{currentSection.description}</p>
                <div className="editorPanelMeta">
                    <span className={`statusBadge ${issueCount > 0 ? 'statusBadge--warning' : 'statusBadge--success'}`}>
                        {issueCount > 0 ? `${issueCount} thing${issueCount === 1 ? '' : 's'} to review` : 'All key fields look good'}
                    </span>
                </div>
            </div>

            <SectionTabs activeTab={activeTab} setActiveTab={setActiveTab}></SectionTabs>

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
        </section>
    );
};
