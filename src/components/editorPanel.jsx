import { useEffect, useRef } from "react";
import SectionTabs from "./sectionTabs";
import PersonalForm from "./forms/personalForm";
import SectionBlockForm from "./forms/sectionBlockForm";
import EntryActionMenu from "./forms/entryActionMenu";
import EditorSettingsRail from "./editorSettingsRail";
import {
    createEditorTargetAttributes,
    getEditorEntryIdentity,
    mapDisplayedCaretOffsetToSource,
    personalEditorPath,
    sectionTitleEditorPath
} from "../lib/editorTargets";
import { MAX_RESUME_SECTIONS, SECTION_TEMPLATE_GROUPS, UNTITLED_SECTION_TITLE } from "../lib/resume";

const PERSONAL_SECTION_LABEL = "Personal details";

function formatSectionRailLabel(value) {
    const label = typeof value === "string" ? value.trim() : "";
    const hasLetters = /[A-Za-z]/.test(label);
    const isAllCaps = hasLetters && label === label.toUpperCase();

    if (!isAllCaps) {
        return label;
    }

    const lowerLabel = label.toLowerCase();
    return `${lowerLabel.charAt(0).toUpperCase()}${lowerLabel.slice(1)}`;
}

function scrollElementWithinContainer(element, container) {
    if (!element || !container) {
        return;
    }

    const elementRect = element.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const topOverflow = elementRect.top - containerRect.top;
    const bottomOverflow = elementRect.bottom - containerRect.bottom;

    if (topOverflow < 0) {
        container.scrollTo({
            top: container.scrollTop + topOverflow - 16,
            behavior: "smooth"
        });
        return;
    }

    if (bottomOverflow > 0) {
        container.scrollTo({
            top: container.scrollTop + bottomOverflow + 16,
            behavior: "smooth"
        });
    }
}

export default function EditorPanel({
    activeTab,
    setActiveTab,
    onMoveSection,
    onReorderSections,
    template,
    templateOptions,
    onTemplateChange,
    resume,
    actions,
    getFieldError,
    markTouched,
    maxHeight,
    isStartPending = false,
    onStartPendingInteraction,
    previewEditTarget,
    placeholderFor,
    onClearPreviewEditTarget,
    onPreviewPulseTarget,
    onEditorCaretChange,
    onEditorEntryFocus,
    onEditorEntryExit,
}) {
    const handledPreviewRequestIdRef = useRef(0);
    const pendingAddedSectionIdRef = useRef("");
    const caretSyncFrameIdRef = useRef(0);
    const activeEditorEntryRef = useRef(null);
    const resumeBlocks = Array.isArray(resume.sections) ? resume.sections : [];
    const activeBlock = resumeBlocks.find((section) => section.id === activeTab);
    const currentSectionTitleValue = activeTab === "personal"
        ? PERSONAL_SECTION_LABEL
        : activeBlock?.title ?? "";
    const currentSectionLabel = activeTab === "personal"
        ? PERSONAL_SECTION_LABEL
        : activeBlock?.title?.trim() || UNTITLED_SECTION_TITLE;
    const sections = [
        {
            id: "personal",
            navLabel: "Personal"
        },
        ...resumeBlocks.map((section) => ({
            id: section.id,
            navLabel: formatSectionRailLabel(section.title) || UNTITLED_SECTION_TITLE
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
    const setManualActiveTab = (sectionId) => {
        onClearPreviewEditTarget?.();
        onPreviewPulseTarget?.({
            path: sectionId === "personal" ? personalEditorPath("name") : sectionTitleEditorPath(sectionId)
        });
        setActiveTab(sectionId);
    };
    const handleAddSection = (templateId) => {
        const nextSectionId = actions.addResumeSection(templateId);

        if (!nextSectionId) {
            return;
        }

        onClearPreviewEditTarget?.();
        pendingAddedSectionIdRef.current = nextSectionId;
        setActiveTab(nextSectionId);
    };
    const getEditorFieldElement = (element) => {
        const target = typeof Element !== "undefined" && element instanceof Element ? element : null;

        return target?.closest?.("input[data-editor-path], textarea[data-editor-path]") || null;
    };
    const isEditorTextField = (element) => Boolean(
        element &&
        typeof element.selectionStart === "number"
    );
    const syncEditorCaretFromEvent = (event) => {
        const fieldElement = getEditorFieldElement(event.target);

        if (!isEditorTextField(fieldElement)) {
            return;
        }

        if (caretSyncFrameIdRef.current) {
            window.cancelAnimationFrame(caretSyncFrameIdRef.current);
        }

        caretSyncFrameIdRef.current = window.requestAnimationFrame(() => {
            caretSyncFrameIdRef.current = 0;

            if (document.activeElement !== fieldElement) {
                return;
            }

            onEditorCaretChange?.({
                path: fieldElement.dataset.editorPath,
                offset: fieldElement.selectionStart,
                value: fieldElement.value,
            });
        });
    };
    const pulsePreviewFromEditorEvent = (event) => {
        const fieldElement = getEditorFieldElement(event.target);

        if (!fieldElement) {
            return;
        }

        onPreviewPulseTarget?.({
            path: fieldElement.dataset.editorPath
        });
    };
    const handleEditorFocus = (event) => {
        const fieldElement = getEditorFieldElement(event.target);
        const entryIdentity = getEditorEntryIdentity(fieldElement?.dataset.editorPath);

        activeEditorEntryRef.current = entryIdentity;
        onEditorEntryFocus?.(entryIdentity);
        syncEditorCaretFromEvent(event);
        pulsePreviewFromEditorEvent(event);
    };
    const handleEditorMouseUp = (event) => {
        syncEditorCaretFromEvent(event);
        pulsePreviewFromEditorEvent(event);
    };
    const handleStartPendingInteraction = (event) => {
        if (!isStartPending) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();

        if (event.type === "pointerdown") {
            onStartPendingInteraction?.();
        }
    };
    const handleStartPendingFocus = (event) => {
        if (!isStartPending) {
            return;
        }

        event.preventDefault();
        event.stopPropagation();
        event.target?.blur?.();
    };
    const renderStartPendingOverlay = () => (
        isStartPending ? (
            <button
                type="button"
                className="startPendingOverlay"
                aria-label="Choose Import your resume or Start from scratch first"
                onClick={onStartPendingInteraction}
            />
        ) : null
    );
    const clearEditorCaretAfterBlur = (event) => {
        const editorStageElement = event.currentTarget;

        window.setTimeout(() => {
            if (!editorStageElement.contains(document.activeElement)) {
                onEditorCaretChange?.(null);
                onEditorEntryExit?.(activeEditorEntryRef.current);
                activeEditorEntryRef.current = null;
            }
        }, 0);
    };

    useEffect(() => {
        if (
            !previewEditTarget?.requestId ||
            !previewEditTarget.path ||
            handledPreviewRequestIdRef.current === previewEditTarget.requestId
        ) {
            return undefined;
        }

        handledPreviewRequestIdRef.current = previewEditTarget.requestId;

        if (previewEditTarget.sectionId && previewEditTarget.sectionId !== activeTab) {
            setActiveTab(previewEditTarget.sectionId);
        }

        let isCancelled = false;
        let frameId = 0;
        let restoreFrameId = 0;
        const restoreTimeoutIds = [];
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
            const previousScrollX = Number.isFinite(previewEditTarget.scrollX) ? previewEditTarget.scrollX : window.scrollX;
            const previousScrollY = Number.isFinite(previewEditTarget.scrollY) ? previewEditTarget.scrollY : window.scrollY;

            scrollElementWithinContainer(fieldElement, fieldElement.closest(".formContainer"));

            focusElement?.focus({ preventScroll: true });

            if (focusElement && typeof focusElement.value === "string") {
                const caretOffset = Number.isFinite(previewEditTarget.sourceOffset)
                    ? Math.max(0, Math.min(previewEditTarget.sourceOffset, focusElement.value.length))
                    : mapDisplayedCaretOffsetToSource({
                        displayText: previewEditTarget.displayText,
                        sourceValue: focusElement.value,
                        displayOffset: previewEditTarget.displayOffset,
                        isPlaceholder: focusElement.value.trim() === "",
                    });

                try {
                    focusElement.setSelectionRange?.(caretOffset, caretOffset);
                } catch {
                    // Some text-like input types do not support explicit selection ranges.
                }

                onEditorCaretChange?.({
                    path: previewEditTarget.path,
                    offset: caretOffset,
                    value: focusElement.value,
                });
            }

            const restorePreservedScroll = () => {
                if (!isCancelled) {
                    window.scrollTo(previousScrollX, previousScrollY);
                }
            };

            restorePreservedScroll();
            restoreFrameId = window.requestAnimationFrame(restorePreservedScroll);
            restoreTimeoutIds.push(window.setTimeout(restorePreservedScroll, 80));
            restoreTimeoutIds.push(window.setTimeout(restorePreservedScroll, 180));
        }

        frameId = window.requestAnimationFrame(focusAndHighlightTarget);

        return () => {
            isCancelled = true;

            if (frameId) {
                window.cancelAnimationFrame(frameId);
            }

            if (restoreFrameId) {
                window.cancelAnimationFrame(restoreFrameId);
            }

            restoreTimeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId));
        };
    }, [activeTab, onEditorCaretChange, previewEditTarget, setActiveTab]);

    useEffect(() => {
        const pendingSectionId = pendingAddedSectionIdRef.current;

        if (!pendingSectionId || activeTab !== pendingSectionId) {
            return undefined;
        }

        let frameId = window.requestAnimationFrame(() => {
            const sectionTitleInput = document.getElementById(`section-title-${pendingSectionId}`);

            if (!sectionTitleInput) {
                return;
            }

            scrollElementWithinContainer(sectionTitleInput, sectionTitleInput.closest(".formContainer"));
            sectionTitleInput.focus({ preventScroll: true });
            sectionTitleInput.select?.();
            pendingAddedSectionIdRef.current = "";
        });

        return () => {
            window.cancelAnimationFrame(frameId);
        };
    }, [activeTab]);

    useEffect(() => () => {
        if (caretSyncFrameIdRef.current) {
            window.cancelAnimationFrame(caretSyncFrameIdRef.current);
        }
    }, []);

    return (
        <section className="editorPanel">
            <div className="editorWorkspace" style={editorWorkspaceStyle}>
                <div className="editorSidebar">
                    <aside
                        className={`settingsRail panel${isStartPending ? " isStartPending" : ""}`}
                        aria-disabled={isStartPending}
                        onPointerDownCapture={handleStartPendingInteraction}
                        onClickCapture={handleStartPendingInteraction}
                        onFocusCapture={handleStartPendingFocus}
                    >
                        <EditorSettingsRail
                            settings={resume.settings}
                            onAdjustSetting={actions.updateResumeSetting}
                            template={template}
                            templateOptions={templateOptions}
                            onTemplateChange={onTemplateChange}
                        />
                        {renderStartPendingOverlay()}
                    </aside>

                    <aside className="editorRail panel">
                        <SectionTabs
                            activeTab={activeTab}
                            setActiveTab={setManualActiveTab}
                            sections={sections}
                            onReorderSections={onReorderSections}
                            sectionTemplateGroups={SECTION_TEMPLATE_GROUPS}
                            onAddSection={handleAddSection}
                            canAddMoreSections={resumeBlocks.length < MAX_RESUME_SECTIONS}
                        />
                    </aside>
                </div>

                <div
                    className={`editorStage panel${isStartPending ? " isStartPending" : ""}`}
                    aria-disabled={isStartPending}
                    onPointerDownCapture={handleStartPendingInteraction}
                    onClickCapture={handleStartPendingInteraction}
                    onFocusCapture={handleStartPendingFocus}
                    onFocus={handleEditorFocus}
                    onPointerUpCapture={pulsePreviewFromEditorEvent}
                    onInput={syncEditorCaretFromEvent}
                    onKeyUp={syncEditorCaretFromEvent}
                    onMouseUp={handleEditorMouseUp}
                    onSelect={syncEditorCaretFromEvent}
                    onBlur={clearEditorCaretAfterBlur}
                >
                    <div className="editorPanelHeader">
                        <div className="editorPanelHeading">
                            <h3>{currentSectionLabel}</h3>
                        </div>

                        <div className="editorPanelMeta">
                            <div className="sectionPlacementControl">
                                <span className="sectionPlacementLabel">Section order</span>
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
                                    value={currentSectionTitleValue}
                                    onChange={(event) => actions.updateSectionTitle(activeTab, event.target.value)}
                                    onBlur={() => actions.commitSectionTitle(activeTab)}
                                    placeholder={placeholderFor?.(sectionTitleEditorPath(activeTab), UNTITLED_SECTION_TITLE) || UNTITLED_SECTION_TITLE}
                                />
                            </div>
                        ) : null}

                        {activeTab === "personal" && (
                            <PersonalForm
                                personal={resume.personal}
                                actions={actions}
                                getFieldError={getFieldError}
                                markTouched={markTouched}
                                placeholderFor={placeholderFor}
                            />
                        )}
                        {activeTab !== "personal" && activeBlock && (
                            <SectionBlockForm
                                section={activeBlock}
                                actions={actions}
                                getFieldError={getFieldError}
                                markTouched={markTouched}
                                editorTarget={previewEditTarget}
                                placeholderFor={placeholderFor}
                            />
                        )}
                    </div>
                    {renderStartPendingOverlay()}
                </div>
            </div>
        </section>
    );
}
