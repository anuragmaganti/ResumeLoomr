import CollapsibleEntryCard, { buildEntrySummary } from "./collapsibleEntryCard";
import FormFieldError from "./formFieldError";
import ReorderableTextList from "./reorderableTextList";

export default function ExperienceForm({ experience, actions, getFieldError, markTouched }) {
    return (
        <div className="formStack">
            {experience.map((entry, index) => (
                <CollapsibleEntryCard
                    key={entry.id}
                    summary={buildEntrySummary(
                        [entry.company, entry.role, entry.yearsExp],
                        "Add company, role, and dates"
                    )}
                    fallbackSummary="Add company, role, and dates"
                    expandLabel={`experience entry ${index + 1}`}
                    menuLabel={`Experience ${index + 1} actions`}
                    moveUpLabel={`Move experience ${index + 1} up`}
                    moveDownLabel={`Move experience ${index + 1} down`}
                    removeLabel={`Remove experience ${index + 1}`}
                    onMoveUp={() => actions.moveExperience(entry.id, -1)}
                    onMoveDown={() => actions.moveExperience(entry.id, 1)}
                    onRemove={() => actions.removeExperience(entry.id)}
                    disableUp={index === 0}
                    disableDown={index === experience.length - 1}
                    disableRemove={experience.length === 1}
                >
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
                                <FormFieldError message={getFieldError(`experience.${entry.id}.company`)} />
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
                                <FormFieldError message={getFieldError(`experience.${entry.id}.yearsExp`)} />
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
                            <FormFieldError message={getFieldError(`experience.${entry.id}.role`)} />
                        </div>

                        <ReorderableTextList
                            label="Highlights"
                            items={entry.activities}
                            idPrefix={`activities-${entry.id}`}
                            pathPrefix={`experience.${entry.id}.activities`}
                            placeholder="Describe a measurable accomplishment or core responsibility."
                            addLabel="Add highlight"
                            getFieldError={getFieldError}
                            markTouched={markTouched}
                            onChangeItem={(activityIndex, value) => actions.updateActivity(entry.id, activityIndex, value)}
                            onMoveItem={(activityIndex, direction) => actions.moveActivity(entry.id, activityIndex, direction)}
                            onRemoveItem={(activityIndex) => actions.removeActivity(entry.id, activityIndex)}
                            onAddItem={() => actions.addActivity(entry.id)}
                        />
                    </form>
                </CollapsibleEntryCard>
            ))}

            <button className="button buttonSecondary addEntryButton" type="button" onClick={() => actions.addExperience()}>
                Add experience
            </button>
        </div>
    )
}
