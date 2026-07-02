import CollapsibleEntryCard from "./collapsibleEntryCard";
import { buildEntrySummary } from "./buildEntrySummary";
import FormFieldError from "./formFieldError";
import ReorderableTextList from "./reorderableTextList";
import { createEditorTargetAttributes } from "../../lib/editorTargets";

export default function RoleBlockForm({ section, actions, getFieldError, markTouched, editorTarget, placeholderFor }) {
  const entries = section.entries || [];
  const placeholder = (path, fallback) => placeholderFor?.(path, fallback) || fallback;

  return (
    <div className="formStack">
      {entries.map((entry, index) => {
        const pathPrefix = `sections.${section.id}.${entry.id}`;

        return (
          <CollapsibleEntryCard
            key={entry.id}
            summary={buildEntrySummary(
              [entry.company, entry.role, entry.location, entry.yearsExp],
              "Add organization, role, and dates"
            )}
            fallbackSummary="Add organization, role, and dates"
            expandLabel={`${section.title} entry ${index + 1}`}
            menuLabel={`${section.title} entry ${index + 1} actions`}
            moveUpLabel={`Move ${section.title} entry ${index + 1} up`}
            moveDownLabel={`Move ${section.title} entry ${index + 1} down`}
            removeLabel={`Remove ${section.title} entry ${index + 1}`}
            onMoveUp={() => actions.moveRoleBlockEntry(section.id, entry.id, -1)}
            onMoveDown={() => actions.moveRoleBlockEntry(section.id, entry.id, 1)}
            onRemove={() => actions.removeRoleBlockEntry(section.id, entry.id)}
            disableUp={index === 0}
            disableDown={index === entries.length - 1}
            disableRemove={entries.length === 1}
            expandSignal={editorTarget?.entryId === entry.id ? editorTarget.requestId : 0}
          >
            <form onSubmit={(event) => event.preventDefault()}>
              <div className="fieldGrid fieldGridTwo">
                <div className="field">
                  <label htmlFor={`role-company-${section.id}-${entry.id}`}>Organization</label>
                  <input
                    type="text"
                    id={`role-company-${section.id}-${entry.id}`}
                    {...createEditorTargetAttributes(`${pathPrefix}.company`, { entryId: entry.id })}
                    value={entry.company}
                    onChange={(event) => actions.updateRoleBlockEntry(section.id, entry.id, 'company', event.target.value)}
                    onBlur={() => markTouched(`${pathPrefix}.company`)}
                    placeholder={placeholder(`${pathPrefix}.company`, 'Organization or company')}
                  />
                  <FormFieldError message={getFieldError(`${pathPrefix}.company`)} />
                </div>

                <div className="field">
                  <label htmlFor={`role-title-${section.id}-${entry.id}`}>Role</label>
                  <input
                    type="text"
                    id={`role-title-${section.id}-${entry.id}`}
                    {...createEditorTargetAttributes(`${pathPrefix}.role`, { entryId: entry.id })}
                    value={entry.role}
                    onChange={(event) => actions.updateRoleBlockEntry(section.id, entry.id, 'role', event.target.value)}
                    onBlur={() => markTouched(`${pathPrefix}.role`)}
                    placeholder={placeholder(`${pathPrefix}.role`, 'Role title')}
                  />
                  <FormFieldError message={getFieldError(`${pathPrefix}.role`)} />
                </div>
              </div>

              <div className="fieldGrid fieldGridTwo">
                <div className="field">
                  <label htmlFor={`role-location-${section.id}-${entry.id}`}>Location</label>
                  <input
                    type="text"
                    id={`role-location-${section.id}-${entry.id}`}
                    {...createEditorTargetAttributes(`${pathPrefix}.location`, { entryId: entry.id })}
                    value={entry.location}
                    onChange={(event) => actions.updateRoleBlockEntry(section.id, entry.id, 'location', event.target.value)}
                    onBlur={() => markTouched(`${pathPrefix}.location`)}
                    placeholder={placeholder(`${pathPrefix}.location`, 'City, State')}
                  />
                </div>

                <div className="field">
                  <label htmlFor={`role-years-${section.id}-${entry.id}`}>Dates</label>
                  <input
                    type="text"
                    id={`role-years-${section.id}-${entry.id}`}
                    {...createEditorTargetAttributes(`${pathPrefix}.yearsExp`, { entryId: entry.id })}
                    value={entry.yearsExp}
                    onChange={(event) => actions.updateRoleBlockEntry(section.id, entry.id, 'yearsExp', event.target.value)}
                    onBlur={() => markTouched(`${pathPrefix}.yearsExp`)}
                    placeholder={placeholder(`${pathPrefix}.yearsExp`, '2022 - Present')}
                  />
                  <FormFieldError message={getFieldError(`${pathPrefix}.yearsExp`)} />
                </div>
              </div>

              <ReorderableTextList
                label="Highlights"
                items={entry.activities}
                idPrefix={`role-highlights-${section.id}-${entry.id}`}
                pathPrefix={`${pathPrefix}.activities`}
                placeholder="Describe a measurable accomplishment or core responsibility."
                placeholderFor={placeholderFor}
                addLabel="Add highlight"
                getFieldError={getFieldError}
                markTouched={markTouched}
                onChangeItem={(activityIndex, value) => actions.updateRoleBlockActivity(section.id, entry.id, activityIndex, value)}
                onMoveItem={(activityIndex, direction) => actions.moveRoleBlockActivity(section.id, entry.id, activityIndex, direction)}
                onRemoveItem={(activityIndex) => actions.removeRoleBlockActivity(section.id, entry.id, activityIndex)}
                onAddItem={() => actions.addRoleBlockActivity(section.id, entry.id)}
              />
            </form>
          </CollapsibleEntryCard>
        );
      })}

      <button className="button buttonSecondary addEntryButton" type="button" onClick={() => actions.addRoleBlockEntry(section.id)}>
        Add role
      </button>
    </div>
  );
}
