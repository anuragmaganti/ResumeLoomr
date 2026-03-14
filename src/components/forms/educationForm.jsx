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
                    </form>
                </fieldset>
            ))}

            <button className="button buttonSecondary addEntryButton" type="button" onClick={() => actions.addEducation()}>
                Add education
            </button>
        </div>
    )
}
