import SectionTabs from "./sectionTabs";
import PersonalForm from "./forms/personalForm";
import EducationForm from "./forms/educationForm";
import ExperienceForm from "./forms/experienceForm";
import SkillsForm from "./forms/skillsForm";
import ProjectsForm from "./forms/projectsForm";
import CertificationsForm from "./forms/certificationsForm";
import VolunteeringForm from "./forms/volunteeringForm";
import LeadershipForm from "./forms/leadershipForm";
import LanguagesForm from "./forms/languagesForm";
import AwardsForm from "./forms/awardsForm";
import PublicationsForm from "./forms/publicationsForm";
import EntryActionMenu from "./forms/entryActionMenu";
import EditorSettingsRail from "./editorSettingsRail";
import { resolveSectionTitle } from "../lib/resume";

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
    },
    skills: {
        navLabel: "Skills",
        navHint: "Core strengths",
        label: "Skills",
        description: "Group skills into concise, scannable sets that support the rest of the resume."
    },
    projects: {
        navLabel: "Projects",
        navHint: "Builds and outcomes",
        label: "Projects",
        description: "Highlight portfolio-worthy work with concise summaries and measurable outcomes."
    },
    certifications: {
        navLabel: "Certifications",
        navHint: "Credentials",
        label: "Certifications",
        description: "Show certifications, issuers, and optional supporting detail without clutter."
    },
    volunteering: {
        navLabel: "Volunteer",
        navHint: "Service roles",
        label: "Volunteering",
        description: "Capture volunteer work with the same clarity as your professional experience."
    },
    leadership: {
        navLabel: "Leadership",
        navHint: "Teams and initiatives",
        label: "Leadership",
        description: "Surface leadership roles, scope, and outcomes in a direct, professional format."
    },
    languages: {
        navLabel: "Languages",
        navHint: "Language skills",
        label: "Languages",
        description: "List languages and proficiency clearly for fast recruiter scanning."
    },
    awards: {
        navLabel: "Awards",
        navHint: "Recognition",
        label: "Awards",
        description: "Separate major honors from education details so they can stand on their own."
    },
    publications: {
        navLabel: "Publications",
        navHint: "Articles and papers",
        label: "Publications",
        description: "Add writing, research, or speaking-related publication credits with context."
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
    maxHeight
}) {
    const currentSection = sectionMeta[activeTab];
    const currentSectionLabel = activeTab === "personal"
        ? currentSection.label
        : resolveSectionTitle(resume.sectionTitles, activeTab);
    const sections = sectionOrder.map((id) => ({
        id,
        navLabel: id === "personal" ? sectionMeta[id].navLabel : resolveSectionTitle(resume.sectionTitles, id),
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
                <div className="editorSidebar">
                    <aside className="settingsRail panel">
                        <EditorSettingsRail
                            settings={resume.settings}
                            onAdjustSetting={actions.updateResumeSetting}
                        />
                    </aside>

                    <aside className="editorRail panel">
                        <SectionTabs
                            activeTab={activeTab}
                            setActiveTab={setActiveTab}
                            sections={sections}
                        />
                    </aside>
                </div>

                <div className="editorStage panel">
                    <div className="editorPanelHeader">
                        <div className="editorPanelHeading">
                            <h3>{currentSectionLabel}</h3>
                        </div>

                        <div className="editorPanelMeta">
                            <div className="sectionOrderControl">
                                <span className="sectionOrderLabel">Section order</span>
                                <EntryActionMenu
                                    menuLabel={`${currentSectionLabel} section order actions`}
                                    moveUpLabel={`Move ${currentSectionLabel} up in the resume order`}
                                    moveDownLabel={`Move ${currentSectionLabel} down in the resume order`}
                                    onMoveUp={() => onMoveSection(activeTab, -1)}
                                    onMoveDown={() => onMoveSection(activeTab, 1)}
                                    disableUp={!canMoveSectionUp}
                                    disableDown={!canMoveSectionDown}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="formContainer">
                        {activeTab !== "personal" ? (
                            <div className="field editorSectionTitleField">
                                <label htmlFor={`section-title-${activeTab}`}>Section name</label>
                                <input
                                    id={`section-title-${activeTab}`}
                                    value={resolveSectionTitle(resume.sectionTitles, activeTab)}
                                    onChange={(event) => actions.updateSectionTitle(activeTab, event.target.value)}
                                />
                            </div>
                        ) : null}

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
                        {activeTab === "skills" && (
                            <SkillsForm
                                skills={resume.skills}
                                actions={actions}
                                getFieldError={getFieldError}
                                markTouched={markTouched}
                            />
                        )}
                        {activeTab === "projects" && (
                            <ProjectsForm
                                projects={resume.projects}
                                actions={actions}
                                getFieldError={getFieldError}
                                markTouched={markTouched}
                            />
                        )}
                        {activeTab === "certifications" && (
                            <CertificationsForm
                                certifications={resume.certifications}
                                actions={actions}
                                getFieldError={getFieldError}
                                markTouched={markTouched}
                            />
                        )}
                        {activeTab === "volunteering" && (
                            <VolunteeringForm
                                volunteering={resume.volunteering}
                                actions={actions}
                                getFieldError={getFieldError}
                                markTouched={markTouched}
                            />
                        )}
                        {activeTab === "leadership" && (
                            <LeadershipForm
                                leadership={resume.leadership}
                                actions={actions}
                                getFieldError={getFieldError}
                                markTouched={markTouched}
                            />
                        )}
                        {activeTab === "languages" && (
                            <LanguagesForm
                                languages={resume.languages}
                                actions={actions}
                                getFieldError={getFieldError}
                                markTouched={markTouched}
                            />
                        )}
                        {activeTab === "awards" && (
                            <AwardsForm
                                awards={resume.awards}
                                actions={actions}
                                getFieldError={getFieldError}
                                markTouched={markTouched}
                            />
                        )}
                        {activeTab === "publications" && (
                            <PublicationsForm
                                publications={resume.publications}
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
