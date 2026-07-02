import AutoResizeTextarea from "../autoResizeTextarea";
import { ensureEducationCustomSections } from "../../lib/resume";
import CollapsibleEntryCard from "./collapsibleEntryCard";
import { buildEntrySummary } from "./buildEntrySummary";
import EntryActionMenu from "./entryActionMenu";
import FormFieldError from "./formFieldError";
import { createEditorTargetAttributes } from "../../lib/editorTargets";

export default function EducationForm({ section, actions, getFieldError, markTouched, editorTarget, placeholderFor }) {
    const entries = section.entries || [];
    const sectionId = section.id;

    const pathFor = (entryId, field) => `sections.${sectionId}.${entryId}.${field}`;
    const placeholder = (entryId, field, fallback) => placeholderFor?.(pathFor(entryId, field), fallback) || fallback;
    const editorAttrs = (entryId, field) => createEditorTargetAttributes(pathFor(entryId, field), { entryId });
    const updateField = (entryId, field, value) => actions.updateSectionBlockEntry(sectionId, entryId, field, value);
    const addEntry = () => actions.addSectionBlockEntry(sectionId);
    const moveEntry = (entryId, direction) => actions.moveSectionBlockEntry(sectionId, entryId, direction);
    const removeEntry = (entryId) => actions.removeSectionBlockEntry(sectionId, entryId);
    const updateCustomSection = (entryId, sectionIndex, field, value) => (
        actions.updateSectionBlockEducationCustomSection(sectionId, entryId, sectionIndex, field, value)
    );
    const addCustomSection = (entryId) => actions.addSectionBlockEducationCustomSection(sectionId, entryId);
    const moveCustomSection = (entryId, sectionIndex, direction) => (
        actions.moveSectionBlockEducationCustomSection(sectionId, entryId, sectionIndex, direction)
    );
    const removeCustomSection = (entryId, sectionIndex) => (
        actions.removeSectionBlockEducationCustomSection(sectionId, entryId, sectionIndex)
    );

    return (
        <div className="formStack">
            {entries.map((entry, index) => {
                const customSections = ensureEducationCustomSections(entry.customSections);
                const programs = Array.isArray(entry.programs) ? entry.programs : [];
                const usesPrograms = programs.length > 0;

                return (
                <CollapsibleEntryCard
                    key={entry.id}
                    summary={buildEntrySummary(
                        [entry.school, entry.degree, entry.yearsEdu],
                        "Add institution, degree, and dates"
                    )}
                    fallbackSummary="Add institution, degree, and dates"
                    expandLabel={`education entry ${index + 1}`}
                    menuLabel={`Education ${index + 1} actions`}
                    moveUpLabel={`Move education ${index + 1} up`}
                    moveDownLabel={`Move education ${index + 1} down`}
                    removeLabel={`Remove education ${index + 1}`}
                    onMoveUp={() => moveEntry(entry.id, -1)}
                    onMoveDown={() => moveEntry(entry.id, 1)}
                    onRemove={() => removeEntry(entry.id)}
                    disableUp={index === 0}
                    disableDown={index === entries.length - 1}
                    disableRemove={entries.length === 1}
                    expandSignal={editorTarget?.entryId === entry.id ? editorTarget.requestId : 0}
                >
                    <form onSubmit={(event) => event.preventDefault()}>
                        <div className="field">
                            <label htmlFor={`school-${entry.id}`}>Institution</label>
                            <input
                                type="text"
                                id={`school-${entry.id}`}
                                {...editorAttrs(entry.id, 'school')}
                                value={entry.school}
                                onChange={(event) => updateField(entry.id, 'school', event.target.value)}
                                onBlur={() => markTouched(pathFor(entry.id, 'school'))}
                                placeholder={placeholder(entry.id, 'school', 'University or school name')}
                            />
                            <FormFieldError message={getFieldError(pathFor(entry.id, 'school'))} />
                        </div>

                        <div className="fieldGrid fieldGridTwo">
                            <div className="field">
                                <label htmlFor={`location-${entry.id}`}>Location</label>
                                <input
                                    type="text"
                                    id={`location-${entry.id}`}
                                    {...editorAttrs(entry.id, 'location')}
                                    value={entry.location}
                                    onChange={(event) => updateField(entry.id, 'location', event.target.value)}
                                    onBlur={() => markTouched(pathFor(entry.id, 'location'))}
                                    placeholder={placeholder(entry.id, 'location', 'Cambridge, MA')}
                                />
                            </div>

                            <div className="field">
                                <label htmlFor={`yearsEdu-${entry.id}`}>{usesPrograms ? 'Institution dates' : 'Dates'}</label>
                                <input
                                    type="text"
                                    id={`yearsEdu-${entry.id}`}
                                    {...editorAttrs(entry.id, 'yearsEdu')}
                                    value={entry.yearsEdu}
                                    onChange={(event) => updateField(entry.id, 'yearsEdu', event.target.value)}
                                    onBlur={() => markTouched(pathFor(entry.id, 'yearsEdu'))}
                                    placeholder={placeholder(entry.id, 'yearsEdu', '2020 - 2024')}
                                />
                                <FormFieldError message={getFieldError(pathFor(entry.id, 'yearsEdu'))} />
                            </div>
                        </div>

                        {usesPrograms ? (
                            <div className="field">
                                <label>Programs</label>
                                <div className="nestedEntryStack">
                                    {programs.map((program, programIndex) => (
                                        <div className="nestedEntryCard" key={program.id}>
                                            <div className="nestedEntryRow">
                                                <div className="nestedEntryContent">
                                                    <div className="fieldGrid fieldGridTwo">
                                                        <div className="field">
                                                            <label htmlFor={`education-program-degree-${entry.id}-${program.id}`}>Degree or program</label>
                                                            <input
                                                                type="text"
                                                                id={`education-program-degree-${entry.id}-${program.id}`}
                                                                {...editorAttrs(entry.id, `programs.${programIndex}.degree`)}
                                                                value={program.degree}
                                                                onChange={(event) => actions.updateSectionBlockEducationProgram(sectionId, entry.id, programIndex, 'degree', event.target.value)}
                                                                onBlur={() => markTouched(pathFor(entry.id, `programs.${programIndex}.degree`))}
                                                                placeholder={placeholder(entry.id, `programs.${programIndex}.degree`, 'B.S. Computer Science')}
                                                            />
                                                        </div>

                                                        <div className="field">
                                                            <label htmlFor={`education-program-years-${entry.id}-${program.id}`}>Dates</label>
                                                            <input
                                                                type="text"
                                                                id={`education-program-years-${entry.id}-${program.id}`}
                                                                {...editorAttrs(entry.id, `programs.${programIndex}.yearsEdu`)}
                                                                value={program.yearsEdu}
                                                                onChange={(event) => actions.updateSectionBlockEducationProgram(sectionId, entry.id, programIndex, 'yearsEdu', event.target.value)}
                                                                onBlur={() => markTouched(pathFor(entry.id, `programs.${programIndex}.yearsEdu`))}
                                                                placeholder={placeholder(entry.id, `programs.${programIndex}.yearsEdu`, '2020 - 2024')}
                                                            />
                                                        </div>
                                                    </div>

                                                    <div className="fieldGrid fieldGridTwo">
                                                        <div className="field">
                                                            <label htmlFor={`education-program-gpa-${entry.id}-${program.id}`}>GPA</label>
                                                            <input
                                                                type="text"
                                                                id={`education-program-gpa-${entry.id}-${program.id}`}
                                                                {...editorAttrs(entry.id, `programs.${programIndex}.gpa`)}
                                                                value={program.gpa}
                                                                onChange={(event) => actions.updateSectionBlockEducationProgram(sectionId, entry.id, programIndex, 'gpa', event.target.value)}
                                                                onBlur={() => markTouched(pathFor(entry.id, `programs.${programIndex}.gpa`))}
                                                                placeholder={placeholder(entry.id, `programs.${programIndex}.gpa`, '3.9 / 4.0')}
                                                            />
                                                        </div>

                                                        <div className="field">
                                                            <label htmlFor={`education-program-honors-${entry.id}-${program.id}`}>Honors</label>
                                                            <input
                                                                type="text"
                                                                id={`education-program-honors-${entry.id}-${program.id}`}
                                                                {...editorAttrs(entry.id, `programs.${programIndex}.honors`)}
                                                                value={program.honors}
                                                                onChange={(event) => actions.updateSectionBlockEducationProgram(sectionId, entry.id, programIndex, 'honors', event.target.value)}
                                                                onBlur={() => markTouched(pathFor(entry.id, `programs.${programIndex}.honors`))}
                                                                placeholder={placeholder(entry.id, `programs.${programIndex}.honors`, 'Magna Cum Laude')}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="activityActions nestedEntryActions">
                                                    <EntryActionMenu
                                                        menuLabel={`Program ${programIndex + 1} actions`}
                                                        moveUpLabel={`Move program ${programIndex + 1} up`}
                                                        moveDownLabel={`Move program ${programIndex + 1} down`}
                                                        removeLabel={`Remove program ${programIndex + 1}`}
                                                        onMoveUp={() => actions.moveSectionBlockEducationProgram(sectionId, entry.id, programIndex, -1)}
                                                        onMoveDown={() => actions.moveSectionBlockEducationProgram(sectionId, entry.id, programIndex, 1)}
                                                        onRemove={() => actions.removeSectionBlockEducationProgram(sectionId, entry.id, programIndex)}
                                                        disableUp={programIndex === 0}
                                                        disableDown={programIndex === programs.length - 1}
                                                        disableRemove={programs.length === 1}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <button className="button buttonSecondary addInlineButton" type="button" onClick={() => actions.addSectionBlockEducationProgram(sectionId, entry.id)}>
                                    Add program
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="fieldGrid fieldGridTwo">
                                    <div className="field">
                                        <label htmlFor={`degree-${entry.id}`}>Degree or program</label>
                                        <input
                                            type="text"
                                            id={`degree-${entry.id}`}
                                            {...editorAttrs(entry.id, 'degree')}
                                            value={entry.degree}
                                            onChange={(event) => updateField(entry.id, 'degree', event.target.value)}
                                            onBlur={() => markTouched(pathFor(entry.id, 'degree'))}
                                            placeholder={placeholder(entry.id, 'degree', 'B.S. Computer Science')}
                                        />
                                        <FormFieldError message={getFieldError(pathFor(entry.id, 'degree'))} />
                                    </div>

                                    <div className="field">
                                        <label htmlFor={`gpa-${entry.id}`}>GPA</label>
                                        <input
                                            type="text"
                                            id={`gpa-${entry.id}`}
                                            {...editorAttrs(entry.id, 'gpa')}
                                            value={entry.gpa}
                                            onChange={(event) => updateField(entry.id, 'gpa', event.target.value)}
                                            onBlur={() => markTouched(pathFor(entry.id, 'gpa'))}
                                            placeholder={placeholder(entry.id, 'gpa', '3.9 / 4.0')}
                                        />
                                    </div>
                                </div>

                                <div className="field">
                                    <label htmlFor={`honors-${entry.id}`}>Honors</label>
                                    <input
                                        type="text"
                                        id={`honors-${entry.id}`}
                                        {...editorAttrs(entry.id, 'honors')}
                                        value={entry.honors}
                                        onChange={(event) => updateField(entry.id, 'honors', event.target.value)}
                                        onBlur={() => markTouched(pathFor(entry.id, 'honors'))}
                                        placeholder={placeholder(entry.id, 'honors', "Magna Cum Laude, Dean's List")}
                                    />
                                </div>
                            </>
                        )}

                        <div className="field">
                            <label htmlFor={`coursework-${entry.id}`}>Relevant coursework</label>
                            <AutoResizeTextarea
                                id={`coursework-${entry.id}`}
                                {...editorAttrs(entry.id, 'coursework')}
                                value={entry.coursework}
                                onChange={(event) => updateField(entry.id, 'coursework', event.target.value)}
                                onBlur={() => markTouched(pathFor(entry.id, 'coursework'))}
                                rows={2}
                                placeholder={placeholder(entry.id, 'coursework', 'Human-Computer Interaction, Algorithms, Product Strategy')}
                            />
                        </div>

                        <div className="field">
                            <label htmlFor={`awards-${entry.id}`}>Awards</label>
                            <AutoResizeTextarea
                                id={`awards-${entry.id}`}
                                {...editorAttrs(entry.id, 'awards')}
                                value={entry.awards}
                                onChange={(event) => updateField(entry.id, 'awards', event.target.value)}
                                onBlur={() => markTouched(pathFor(entry.id, 'awards'))}
                                rows={2}
                                placeholder={placeholder(entry.id, 'awards', 'Scholarships, distinctions, academic awards')}
                            />
                        </div>

                        <div className="field">
                            <label>Custom sections</label>

                            <div className="nestedEntryStack">
                                {customSections.map((section, sectionIndex) => (
                                    <div className="nestedEntryCard" key={section.id}>
                                        <div className="nestedEntryRow">
                                            <div className="nestedEntryContent">
                                                <div className="field">
                                                    <label htmlFor={`customSectionLabel-${entry.id}-${section.id}`}>Section title</label>
                                                    <input
                                                        type="text"
                                                        id={`customSectionLabel-${entry.id}-${section.id}`}
                                                        {...editorAttrs(entry.id, `customSections.${sectionIndex}.label`)}
                                                        value={section.label}
                                                        onChange={(event) => updateCustomSection(entry.id, sectionIndex, 'label', event.target.value)}
                                                        onBlur={() => markTouched(pathFor(entry.id, `customSections.${sectionIndex}.label`))}
                                                        placeholder={placeholder(entry.id, `customSections.${sectionIndex}.label`, 'Capstone project')}
                                                    />
                                                </div>

                                                <div className="field">
                                                    <label htmlFor={`customSection-${entry.id}-${section.id}`}>Section content</label>
                                                    <AutoResizeTextarea
                                                        id={`customSection-${entry.id}-${section.id}`}
                                                        {...editorAttrs(entry.id, `customSections.${sectionIndex}.content`)}
                                                        value={section.content}
                                                        onChange={(event) => updateCustomSection(entry.id, sectionIndex, 'content', event.target.value)}
                                                        onBlur={() => markTouched(pathFor(entry.id, `customSections.${sectionIndex}.content`))}
                                                        rows={2}
                                                        placeholder={placeholder(entry.id, `customSections.${sectionIndex}.content`, 'Add the details you want to show under this custom section.')}
                                                    />
                                                </div>
                                            </div>

                                            <div className="activityActions nestedEntryActions">
                                                <EntryActionMenu
                                                    menuLabel={`Custom section ${sectionIndex + 1} actions`}
                                                    moveUpLabel={`Move custom section ${sectionIndex + 1} up`}
                                                    moveDownLabel={`Move custom section ${sectionIndex + 1} down`}
                                                    removeLabel={`Remove custom section ${sectionIndex + 1}`}
                                                    onMoveUp={() => moveCustomSection(entry.id, sectionIndex, -1)}
                                                    onMoveDown={() => moveCustomSection(entry.id, sectionIndex, 1)}
                                                    onRemove={() => removeCustomSection(entry.id, sectionIndex)}
                                                    disableUp={sectionIndex === 0}
                                                    disableDown={sectionIndex === customSections.length - 1}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button className="button buttonSecondary addInlineButton" type="button" onClick={() => addCustomSection(entry.id)}>
                            Add custom section
                        </button>
                    </form>
                </CollapsibleEntryCard>
            )})}

            <button className="button buttonSecondary addEntryButton" type="button" onClick={addEntry}>
                Add education
            </button>
        </div>
    )
}
