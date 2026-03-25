import CollapsibleEntryCard from "./collapsibleEntryCard";
import { buildEntrySummary } from "./buildEntrySummary";
import FormFieldError from "./formFieldError";
import ReorderableTextList from "./reorderableTextList";

export default function LeadershipForm({ leadership, actions, getFieldError, markTouched }) {
  return (
    <div className="formStack">
      {leadership.map((entry, index) => (
        <CollapsibleEntryCard
          key={entry.id}
          summary={buildEntrySummary(
            [entry.organization, entry.role, entry.years],
            "Add organization, role, and dates"
          )}
          fallbackSummary="Add organization, role, and dates"
          expandLabel={`leadership role ${index + 1}`}
          menuLabel={`Leadership role ${index + 1} actions`}
          moveUpLabel={`Move leadership role ${index + 1} up`}
          moveDownLabel={`Move leadership role ${index + 1} down`}
          removeLabel={`Remove leadership role ${index + 1}`}
          onMoveUp={() => actions.moveCollectionEntry('leadership', entry.id, -1)}
          onMoveDown={() => actions.moveCollectionEntry('leadership', entry.id, 1)}
          onRemove={() => actions.removeCollectionEntry('leadership', entry.id)}
          disableUp={index === 0}
          disableDown={index === leadership.length - 1}
          disableRemove={leadership.length === 1}
        >
          <form onSubmit={(event) => event.preventDefault()}>
            <div className="fieldGrid fieldGridTwo">
              <div className="field">
                <label htmlFor={`leadership-organization-${entry.id}`}>Organization</label>
                <input
                  type="text"
                  id={`leadership-organization-${entry.id}`}
                  value={entry.organization}
                  onChange={(event) => actions.updateCollectionEntry('leadership', entry.id, 'organization', event.target.value)}
                  onBlur={() => markTouched(`leadership.${entry.id}.organization`)}
                  placeholder="Design Club"
                />
                <FormFieldError message={getFieldError(`leadership.${entry.id}.organization`)} />
              </div>

              <div className="field">
                <label htmlFor={`leadership-years-${entry.id}`}>Dates</label>
                <input
                  type="text"
                  id={`leadership-years-${entry.id}`}
                  value={entry.years}
                  onChange={(event) => actions.updateCollectionEntry('leadership', entry.id, 'years', event.target.value)}
                  onBlur={() => markTouched(`leadership.${entry.id}.years`)}
                  placeholder="2023 - 2024"
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor={`leadership-role-${entry.id}`}>Role</label>
              <input
                type="text"
                id={`leadership-role-${entry.id}`}
                value={entry.role}
                onChange={(event) => actions.updateCollectionEntry('leadership', entry.id, 'role', event.target.value)}
                onBlur={() => markTouched(`leadership.${entry.id}.role`)}
                placeholder="President"
              />
              <FormFieldError message={getFieldError(`leadership.${entry.id}.role`)} />
            </div>

            <ReorderableTextList
              label="Highlights"
              items={entry.highlights}
              idPrefix={`leadership-highlights-${entry.id}`}
              pathPrefix={`leadership.${entry.id}.highlights`}
              placeholder="Describe leadership scope, initiatives, or outcomes."
              addLabel="Add highlight"
              getFieldError={getFieldError}
              markTouched={markTouched}
              onChangeItem={(itemIndex, value) => actions.updateCollectionTextList('leadership', entry.id, 'highlights', itemIndex, value)}
              onMoveItem={(itemIndex, direction) => actions.moveCollectionTextListItem('leadership', entry.id, 'highlights', itemIndex, direction)}
              onRemoveItem={(itemIndex) => actions.removeCollectionTextListItem('leadership', entry.id, 'highlights', itemIndex)}
              onAddItem={() => actions.addCollectionTextListItem('leadership', entry.id, 'highlights')}
            />
          </form>
        </CollapsibleEntryCard>
      ))}

      <button className="button buttonSecondary addEntryButton" type="button" onClick={() => actions.addCollectionEntry('leadership')}>
        Add leadership role
      </button>
    </div>
  );
}
