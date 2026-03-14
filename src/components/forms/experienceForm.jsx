function FieldError({ message }) {
    if (!message) {
        return null;
    }

    return <p className="fieldError">{message}</p>;
}

export default function ExperienceForm({ experience, actions, getFieldError, markTouched }) {
    return (
        <div className="formStack">
            {experience.map((entry, index) => (
                <fieldset key={entry.id} className="formSection entryCard">
                    <div className="entryHeader">
                        <div>
                            <h3>Experience {index + 1}</h3>
                        </div>
                        <div className="entryActions">
                            <button
                                className="button buttonSecondary actionButton"
                                type="button"
                                onClick={() => actions.moveExperience(entry.id, -1)}
                                disabled={index === 0}
                                aria-label={`Move experience ${index + 1} up`}
                            >
                                Up
                            </button>
                            <button
                                className="button buttonSecondary actionButton"
                                type="button"
                                onClick={() => actions.moveExperience(entry.id, 1)}
                                disabled={index === experience.length - 1}
                                aria-label={`Move experience ${index + 1} down`}
                            >
                                Down
                            </button>
                            <button
                                className="button buttonGhost actionButton"
                                type="button"
                                onClick={() => actions.removeExperience(entry.id)}
                                disabled={experience.length === 1}
                            >
                                Remove
                            </button>
                        </div>
                    </div>

                    <form onSubmit={(event) => event.preventDefault()}>
                        <div className="fieldGrid fieldGridTwo">
                            <div className="field">
                                <label htmlFor={`company-${entry.id}`}>Company</label>
                                <input
                                    type="text"
                                    id={`company-${entry.id}`}
                                    value={entry.company}
                                    onChange={(event) => actions.updateExperienceField(entry.id, 'company', event.target.value)}
                                    onBlur={() => markTouched(`experience.${entry.id}.company`)}
                                    placeholder="Company name"
                                />
                                <FieldError message={getFieldError(`experience.${entry.id}.company`)} />
                            </div>

                            <div className="field">
                                <label htmlFor={`yearsExp-${entry.id}`}>Dates</label>
                                <input
                                    type="text"
                                    id={`yearsExp-${entry.id}`}
                                    value={entry.yearsExp}
                                    onChange={(event) => actions.updateExperienceField(entry.id, 'yearsExp', event.target.value)}
                                    onBlur={() => markTouched(`experience.${entry.id}.yearsExp`)}
                                    placeholder="2022 - Present"
                                />
                                <FieldError message={getFieldError(`experience.${entry.id}.yearsExp`)} />
                            </div>
                        </div>

                        <div className="field">
                            <label htmlFor={`role-${entry.id}`}>Role</label>
                            <input
                                type="text"
                                id={`role-${entry.id}`}
                                value={entry.role}
                                onChange={(event) => actions.updateExperienceField(entry.id, 'role', event.target.value)}
                                onBlur={() => markTouched(`experience.${entry.id}.role`)}
                                placeholder="Senior Product Designer"
                            />
                            <FieldError message={getFieldError(`experience.${entry.id}.role`)} />
                        </div>

                        <div className="field">
                            <label htmlFor={`activities-${entry.id}`}>Highlights</label>

                            {entry.activities.map((activity, activityIndex) => (
                                <div className="activityRow" key={`${entry.id}-${activityIndex}`}>
                                    <div className="activityInputWrap">
                                        <textarea
                                            id={`activities-${entry.id}-${activityIndex}`}
                                            value={activity}
                                            onChange={(event) => actions.updateActivity(entry.id, activityIndex, event.target.value)}
                                            onBlur={() => markTouched(`experience.${entry.id}.activities.${activityIndex}`)}
                                            rows="3"
                                            placeholder="Describe a measurable accomplishment or core responsibility."
                                        />
                                        <FieldError message={getFieldError(`experience.${entry.id}.activities.${activityIndex}`)} />
                                    </div>

                                    <div className="activityActions">
                                        <button
                                            className="button buttonSecondary iconButton"
                                            type="button"
                                            onClick={() => actions.moveActivity(entry.id, activityIndex, -1)}
                                            disabled={activityIndex === 0}
                                            aria-label={`Move highlight ${activityIndex + 1} up`}
                                        >
                                            Up
                                        </button>
                                        <button
                                            className="button buttonSecondary iconButton"
                                            type="button"
                                            onClick={() => actions.moveActivity(entry.id, activityIndex, 1)}
                                            disabled={activityIndex === entry.activities.length - 1}
                                            aria-label={`Move highlight ${activityIndex + 1} down`}
                                        >
                                            Down
                                        </button>
                                        <button
                                            className="button buttonGhost iconButton"
                                            type="button"
                                            onClick={() => actions.removeActivity(entry.id, activityIndex)}
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <button className="button buttonSecondary addInlineButton" type="button" onClick={() => actions.addActivity(entry.id)}>
                            Add highlight
                        </button>
                    </form>
                </fieldset>
            ))}

            <button className="button buttonSecondary addEntryButton" type="button" onClick={() => actions.addExperience()}>
                Add experience
            </button>
        </div>
    )
}
