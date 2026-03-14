import AutoResizeTextarea from "../autoResizeTextarea";

function FieldError({ message }) {
    if (!message) {
        return null;
    }

    return <p className="fieldError">{message}</p>;
}

export default function EducationForm({ education, actions, getFieldError, markTouched }) {
    return (
        <div className="formStack">
            {education.map((entry, index) => (
                <fieldset key={entry.id} className="formSection entryCard">
                    <div className="entryHeader">
                        <div>
                            <h3>Education {index + 1}</h3>
                        </div>
                        <div className="entryActions">
                            <button
                                className="button buttonSecondary actionButton"
                                type="button"
                                onClick={() => actions.moveEducation(entry.id, -1)}
                                disabled={index === 0}
                                aria-label={`Move education ${index + 1} up`}
                            >
                                ↑
                            </button>
                            <button
                                className="button buttonSecondary actionButton"
                                type="button"
                                onClick={() => actions.moveEducation(entry.id, 1)}
                                disabled={index === education.length - 1}
                                aria-label={`Move education ${index + 1} down`}
                            >
                                ↓
                            </button>
                            <button
                                className="button buttonDanger actionButton"
                                type="button"
                                onClick={() => actions.removeEducation(entry.id)}
                                disabled={education.length === 1}
                                aria-label={`Remove education ${index + 1}`}
                            >
                                x
                            </button>
                        </div>
                    </div>

                    <form onSubmit={(event) => event.preventDefault()}>
                        <div className="field">
                            <label htmlFor={`school-${entry.id}`}>Institution</label>
                            <input
                                type="text"
                                id={`school-${entry.id}`}
                                value={entry.school}
                                onChange={(event) => actions.updateEducationField(entry.id, 'school', event.target.value)}
                                onBlur={() => markTouched(`education.${entry.id}.school`)}
                                placeholder="University or school name"
                            />
                            <FieldError message={getFieldError(`education.${entry.id}.school`)} />
                        </div>

                        <div className="fieldGrid fieldGridTwo">
                            <div className="field">
                                <label htmlFor={`degree-${entry.id}`}>Degree or program</label>
                                <input
                                    type="text"
                                    id={`degree-${entry.id}`}
                                    value={entry.degree}
                                    onChange={(event) => actions.updateEducationField(entry.id, 'degree', event.target.value)}
                                    onBlur={() => markTouched(`education.${entry.id}.degree`)}
                                    placeholder="B.S. Computer Science"
                                />
                                <FieldError message={getFieldError(`education.${entry.id}.degree`)} />
                            </div>

                            <div className="field">
                                <label htmlFor={`yearsEdu-${entry.id}`}>Dates</label>
                                <input
                                    type="text"
                                    id={`yearsEdu-${entry.id}`}
                                    value={entry.yearsEdu}
                                    onChange={(event) => actions.updateEducationField(entry.id, 'yearsEdu', event.target.value)}
                                    onBlur={() => markTouched(`education.${entry.id}.yearsEdu`)}
                                    placeholder="2020 - 2024"
                                />
                                <FieldError message={getFieldError(`education.${entry.id}.yearsEdu`)} />
                            </div>
                        </div>

                        <div className="fieldGrid fieldGridTwo">
                            <div className="field">
                                <label htmlFor={`location-${entry.id}`}>Location</label>
                                <input
                                    type="text"
                                    id={`location-${entry.id}`}
                                    value={entry.location}
                                    onChange={(event) => actions.updateEducationField(entry.id, 'location', event.target.value)}
                                    onBlur={() => markTouched(`education.${entry.id}.location`)}
                                    placeholder="Cambridge, MA"
                                />
                            </div>

                            <div className="field">
                                <label htmlFor={`gpa-${entry.id}`}>GPA</label>
                                <input
                                    type="text"
                                    id={`gpa-${entry.id}`}
                                    value={entry.gpa}
                                    onChange={(event) => actions.updateEducationField(entry.id, 'gpa', event.target.value)}
                                    onBlur={() => markTouched(`education.${entry.id}.gpa`)}
                                    placeholder="3.9 / 4.0"
                                />
                            </div>
                        </div>

                        <div className="field">
                            <label htmlFor={`honors-${entry.id}`}>Honors</label>
                            <input
                                type="text"
                                id={`honors-${entry.id}`}
                                value={entry.honors}
                                onChange={(event) => actions.updateEducationField(entry.id, 'honors', event.target.value)}
                                onBlur={() => markTouched(`education.${entry.id}.honors`)}
                                placeholder="Magna Cum Laude, Dean's List"
                            />
                        </div>

                        <div className="field">
                            <label htmlFor={`coursework-${entry.id}`}>Relevant coursework</label>
                            <AutoResizeTextarea
                                id={`coursework-${entry.id}`}
                                value={entry.coursework}
                                onChange={(event) => actions.updateEducationField(entry.id, 'coursework', event.target.value)}
                                onBlur={() => markTouched(`education.${entry.id}.coursework`)}
                                rows={2}
                                placeholder="Human-Computer Interaction, Algorithms, Product Strategy"
                            />
                        </div>

                        <div className="field">
                            <label htmlFor={`awards-${entry.id}`}>Awards</label>
                            <AutoResizeTextarea
                                id={`awards-${entry.id}`}
                                value={entry.awards}
                                onChange={(event) => actions.updateEducationField(entry.id, 'awards', event.target.value)}
                                onBlur={() => markTouched(`education.${entry.id}.awards`)}
                                rows={2}
                                placeholder="Scholarships, distinctions, academic awards"
                            />
                        </div>

                        <div className="field">
                            <label>Custom sections</label>

                            <div className="nestedEntryStack">
                                {entry.customSections.map((section, sectionIndex) => (
                                    <div className="nestedEntryCard" key={section.id}>
                                        <div className="nestedEntryRow">
                                            <div className="nestedEntryContent">
                                                <div className="field">
                                                    <label htmlFor={`customSectionLabel-${entry.id}-${section.id}`}>Section title</label>
                                                    <input
                                                        type="text"
                                                        id={`customSectionLabel-${entry.id}-${section.id}`}
                                                        value={section.label}
                                                        onChange={(event) => actions.updateEducationCustomSection(entry.id, sectionIndex, 'label', event.target.value)}
                                                        onBlur={() => markTouched(`education.${entry.id}.customSections.${sectionIndex}.label`)}
                                                        placeholder="Capstone project"
                                                    />
                                                </div>

                                                <div className="field">
                                                    <label htmlFor={`customSection-${entry.id}-${section.id}`}>Section content</label>
                                                    <AutoResizeTextarea
                                                        id={`customSection-${entry.id}-${section.id}`}
                                                        value={section.content}
                                                        onChange={(event) => actions.updateEducationCustomSection(entry.id, sectionIndex, 'content', event.target.value)}
                                                        onBlur={() => markTouched(`education.${entry.id}.customSections.${sectionIndex}.content`)}
                                                        rows={2}
                                                        placeholder="Add the details you want to show under this custom section."
                                                    />
                                                </div>
                                            </div>

                                            <div className="activityActions nestedEntryActions">
                                                <button
                                                    className="button buttonSecondary iconButton"
                                                    type="button"
                                                    onClick={() => actions.moveEducationCustomSection(entry.id, sectionIndex, -1)}
                                                    disabled={sectionIndex === 0}
                                                    aria-label={`Move custom section ${sectionIndex + 1} up`}
                                                >
                                                    ↑
                                                </button>
                                                <button
                                                    className="button buttonSecondary iconButton"
                                                    type="button"
                                                    onClick={() => actions.moveEducationCustomSection(entry.id, sectionIndex, 1)}
                                                    disabled={sectionIndex === entry.customSections.length - 1}
                                                    aria-label={`Move custom section ${sectionIndex + 1} down`}
                                                >
                                                    ↓
                                                </button>
                                                <button
                                                    className="button buttonDanger iconButton"
                                                    type="button"
                                                    onClick={() => actions.removeEducationCustomSection(entry.id, sectionIndex)}
                                                    aria-label={`Remove custom section ${sectionIndex + 1}`}
                                                >
                                                    x
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <button className="button buttonSecondary addInlineButton" type="button" onClick={() => actions.addEducationCustomSection(entry.id)}>
                            Add custom section
                        </button>
                    </form>
                </fieldset>
            ))}

            <button className="button buttonSecondary addEntryButton" type="button" onClick={() => actions.addEducation()}>
                Add education
            </button>
        </div>
    )
}
