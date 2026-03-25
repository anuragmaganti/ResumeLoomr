import CollapsibleEntryCard from "./collapsibleEntryCard";
import { buildEntrySummary } from "./buildEntrySummary";
import FormFieldError from "./formFieldError";
import ReorderableTextList from "./reorderableTextList";

export default function VolunteeringForm({ volunteering, actions, getFieldError, markTouched }) {
  return (
    <div className="formStack">
      {volunteering.map((entry, index) => (
        <CollapsibleEntryCard
          key={entry.id}
          summary={buildEntrySummary(
            [entry.organization, entry.role, entry.years],
            "Add organization, role, and dates"
          )}
          fallbackSummary="Add organization, role, and dates"
          expandLabel={`volunteer role ${index + 1}`}
          menuLabel={`Volunteer role ${index + 1} actions`}
          moveUpLabel={`Move volunteer role ${index + 1} up`}
          moveDownLabel={`Move volunteer role ${index + 1} down`}
          removeLabel={`Remove volunteer role ${index + 1}`}
          onMoveUp={() => actions.moveCollectionEntry('volunteering', entry.id, -1)}
          onMoveDown={() => actions.moveCollectionEntry('volunteering', entry.id, 1)}
          onRemove={() => actions.removeCollectionEntry('volunteering', entry.id)}
          disableUp={index === 0}
          disableDown={index === volunteering.length - 1}
          disableRemove={volunteering.length === 1}
        >
          <form onSubmit={(event) => event.preventDefault()}>
            <div className="fieldGrid fieldGridTwo">
              <div className="field">
                <label htmlFor={`volunteering-organization-${entry.id}`}>Organization</label>
                <input
                  type="text"
                  id={`volunteering-organization-${entry.id}`}
                  value={entry.organization}
                  onChange={(event) => actions.updateCollectionEntry('volunteering', entry.id, 'organization', event.target.value)}
                  onBlur={() => markTouched(`volunteering.${entry.id}.organization`)}
                  placeholder="Code for America"
                />
                <FormFieldError message={getFieldError(`volunteering.${entry.id}.organization`)} />
              </div>

              <div className="field">
                <label htmlFor={`volunteering-years-${entry.id}`}>Dates</label>
                <input
                  type="text"
                  id={`volunteering-years-${entry.id}`}
                  value={entry.years}
                  onChange={(event) => actions.updateCollectionEntry('volunteering', entry.id, 'years', event.target.value)}
                  onBlur={() => markTouched(`volunteering.${entry.id}.years`)}
                  placeholder="2022 - Present"
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor={`volunteering-role-${entry.id}`}>Role</label>
              <input
                type="text"
                id={`volunteering-role-${entry.id}`}
                value={entry.role}
                onChange={(event) => actions.updateCollectionEntry('volunteering', entry.id, 'role', event.target.value)}
                onBlur={() => markTouched(`volunteering.${entry.id}.role`)}
                placeholder="Volunteer mentor"
              />
              <FormFieldError message={getFieldError(`volunteering.${entry.id}.role`)} />
            </div>

            <ReorderableTextList
              label="Highlights"
              items={entry.highlights}
              idPrefix={`volunteering-highlights-${entry.id}`}
              pathPrefix={`volunteering.${entry.id}.highlights`}
              placeholder="Describe impact, service, or leadership in this volunteer role."
              addLabel="Add highlight"
              getFieldError={getFieldError}
              markTouched={markTouched}
              onChangeItem={(itemIndex, value) => actions.updateCollectionTextList('volunteering', entry.id, 'highlights', itemIndex, value)}
              onMoveItem={(itemIndex, direction) => actions.moveCollectionTextListItem('volunteering', entry.id, 'highlights', itemIndex, direction)}
              onRemoveItem={(itemIndex) => actions.removeCollectionTextListItem('volunteering', entry.id, 'highlights', itemIndex)}
              onAddItem={() => actions.addCollectionTextListItem('volunteering', entry.id, 'highlights')}
            />
          </form>
        </CollapsibleEntryCard>
      ))}

      <button className="button buttonSecondary addEntryButton" type="button" onClick={() => actions.addCollectionEntry('volunteering')}>
        Add volunteer role
      </button>
    </div>
  );
}
