import { useEffect } from "react";
import SectionTabs from "./sectionTabs";
import PersonalForm from "./forms/personalForm";
import SectionBlockForm from "./forms/sectionBlockForm";
import EntryActionMenu from "./forms/entryActionMenu";
import EditorSettingsRail from "./editorSettingsRail";
import { resolveSectionTitle } from "../lib/resume";
import {
    createEditorTargetAttributes,
    sectionTitleEditorPath
} from "../lib/editorTargets";

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
    onMoveSection,
    onReorderSection,
    onReorderSections,
    template,
    templateOptions,
    onTemplateChange,
    resume,
    actions,
    getFieldError,
    markTouched,
    maxHeight,
    previewEditTarget
}) {
    const resumeBlocks = Array.isArray(resume.sections) ? resume.sections : [];
    const activeBlock = resumeBlocks.find((section) => section.id === activeTab);
    const currentSectionLabel = activeTab === "personal"
        ? sectionMeta.personal.label
        : activeBlock?.title || resolveSectionTitle(resume.sectionTitles, activeTab);
    const sections = [
        {
            id: "personal",
            navLabel: sectionMeta.personal.navLabel,
            navHint: sectionMeta.personal.navHint
        },
        ...resumeBlocks.map((section) => ({
            id: section.id,
            navLabel: section.title,
            navHint: sectionMeta[section.legacySectionId]?.navHint || sectionMeta[section.kind]?.navHint || (
                section.kind === "roles" ? "Roles and highlights" : "Section details"
            )
        }))
    ];
    const activeSectionIndex = sections.findIndex((section) => section.id === activeTab);
    const canMoveSectionUp = activeTab !== "personal" && activeSectionIndex > 1;
    const canMoveSectionDown = activeTab !== "personal" && activeSectionIndex > -1 && activeSectionIndex < sections.length - 1;
    const canRemoveSection = activeTab !== "personal" && resumeBlocks.length > 1;
    const editorWorkspaceStyle = maxHeight
        ? {
            minHeight: `${maxHeight}px`,
            '--editor-stage-max-height': `${maxHeight}px`
        }
        : undefined;

    useEffect(() => {
        if (!previewEditTarget?.requestId || !previewEditTarget.path) {
            return undefined;
        }

        if (previewEditTarget.sectionId && previewEditTarget.sectionId !== activeTab) {
            setActiveTab(previewEditTarget.sectionId);
        }

        let isCancelled = false;
        let frameId = 0;
        let attempts = 0;

        function findEditorTarget() {
            return Array.from(document.querySelectorAll("[data-editor-path]"))
                .find((element) => element.dataset.editorPath === previewEditTarget.path);
        }

        function focusAndHighlightTarget() {
            if (isCancelled) {
                return;
            }

            const fieldElement = findEditorTarget();

            if (!fieldElement) {
                attempts += 1;

                if (attempts < 10) {
                    frameId = window.requestAnimationFrame(focusAndHighlightTarget);
                }

                return;
            }

            const focusElement = fieldElement.matches("input, textarea")
                ? fieldElement
                : fieldElement.querySelector("input, textarea");

            fieldElement.scrollIntoView({ block: "center", behavior: "smooth" });
            focusElement?.focus({ preventScroll: true });
        }

        frameId = window.requestAnimationFrame(focusAndHighlightTarget);

        return () => {
            isCancelled = true;

            if (frameId) {
                window.cancelAnimationFrame(frameId);
            }
        };
    }, [activeTab, previewEditTarget, setActiveTab]);

    return (
        <section className="editorPanel">
            <div className="editorWorkspace" style={editorWorkspaceStyle}>
                <div className="editorSidebar">
                    <aside className="settingsRail panel">
                        <EditorSettingsRail
                            settings={resume.settings}
                            onAdjustSetting={actions.updateResumeSetting}
                            template={template}
                            templateOptions={templateOptions}
                            onTemplateChange={onTemplateChange}
                        />
                    </aside>

                    <aside className="editorRail panel">
                        <SectionTabs
                            activeTab={activeTab}
                            setActiveTab={setActiveTab}
                            sections={sections}
                            onReorderSection={onReorderSection}
                            onReorderSections={onReorderSections}
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
                                    removeLabel={`Remove ${currentSectionLabel} section`}
                                    onRemove={canRemoveSection ? () => {
                                        const fallbackSection = sections[Math.max(0, activeSectionIndex - 1)] || sections[0];
                                        actions.removeResumeSection(activeTab);
                                        setActiveTab(fallbackSection.id);
                                    } : undefined}
                                    disableUp={!canMoveSectionUp}
                                    disableDown={!canMoveSectionDown}
                                    disableRemove={!canRemoveSection}
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
                                    {...createEditorTargetAttributes(sectionTitleEditorPath(activeTab))}
                                    value={currentSectionLabel}
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
                        {activeTab !== "personal" && activeBlock && (
                            <SectionBlockForm
                                section={activeBlock}
                                actions={actions}
                                getFieldError={getFieldError}
                                markTouched={markTouched}
                                editorTarget={previewEditTarget}
                            />
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
