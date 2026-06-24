import AutoResizeTextarea from "../autoResizeTextarea";
import CollapsibleEntryCard from "./collapsibleEntryCard";
import { buildEntrySummary } from "./buildEntrySummary";
import FormFieldError from "./formFieldError";

export default function AwardsForm({ awards = [], section, actions, getFieldError, markTouched }) {
  const entries = section?.entries || awards;
  const sectionId = section?.id || '';
  const isBlockEditor = Boolean(sectionId);
  const pathFor = (entryId, field) => (
    isBlockEditor ? `sections.${sectionId}.${entryId}.${field}` : `awards.${entryId}.${field}`
  );
  const updateEntry = (entryId, field, value) => (
    isBlockEditor
      ? actions.updateSectionBlockEntry(sectionId, entryId, field, value)
      : actions.updateCollectionEntry('awards', entryId, field, value)
  );
  const addEntry = () => (
    isBlockEditor ? actions.addSectionBlockEntry(sectionId) : actions.addCollectionEntry('awards')
  );
  const moveEntry = (entryId, direction) => (
    isBlockEditor ? actions.moveSectionBlockEntry(sectionId, entryId, direction) : actions.moveCollectionEntry('awards', entryId, direction)
  );
  const removeEntry = (entryId) => (
    isBlockEditor ? actions.removeSectionBlockEntry(sectionId, entryId) : actions.removeCollectionEntry('awards', entryId)
  );

  return (
    <div className="formStack">
      {entries.map((entry, index) => (
        <CollapsibleEntryCard
          key={entry.id}
          summary={buildEntrySummary(
            [entry.title, entry.issuer, entry.years],
            "Add award, issuer, and date"
          )}
          fallbackSummary="Add award, issuer, and date"
          expandLabel={`award ${index + 1}`}
          menuLabel={`Award ${index + 1} actions`}
          moveUpLabel={`Move award ${index + 1} up`}
          moveDownLabel={`Move award ${index + 1} down`}
          removeLabel={`Remove award ${index + 1}`}
          onMoveUp={() => moveEntry(entry.id, -1)}
          onMoveDown={() => moveEntry(entry.id, 1)}
          onRemove={() => removeEntry(entry.id)}
          disableUp={index === 0}
          disableDown={index === entries.length - 1}
          disableRemove={entries.length === 1}
        >
          <form onSubmit={(event) => event.preventDefault()}>
            <div className="fieldGrid fieldGridTwo">
              <div className="field">
                <label htmlFor={`award-title-${entry.id}`}>Award</label>
                <input
                  type="text"
                  id={`award-title-${entry.id}`}
                  value={entry.title}
                  onChange={(event) => updateEntry(entry.id, 'title', event.target.value)}
                  onBlur={() => markTouched(pathFor(entry.id, 'title'))}
                  placeholder="Employee of the Year"
                />
                <FormFieldError message={getFieldError(pathFor(entry.id, 'title'))} />
              </div>

              <div className="field">
                <label htmlFor={`award-years-${entry.id}`}>Date</label>
                <input
                  type="text"
                  id={`award-years-${entry.id}`}
                  value={entry.years}
                  onChange={(event) => updateEntry(entry.id, 'years', event.target.value)}
                  onBlur={() => markTouched(pathFor(entry.id, 'years'))}
                  placeholder="2024"
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor={`award-issuer-${entry.id}`}>Issuer</label>
              <input
                type="text"
                id={`award-issuer-${entry.id}`}
                value={entry.issuer}
                onChange={(event) => updateEntry(entry.id, 'issuer', event.target.value)}
                onBlur={() => markTouched(pathFor(entry.id, 'issuer'))}
                placeholder="Acme Inc."
              />
            </div>

            <div className="field">
              <label htmlFor={`award-details-${entry.id}`}>Details</label>
              <AutoResizeTextarea
                id={`award-details-${entry.id}`}
                value={entry.details}
                onChange={(event) => updateEntry(entry.id, 'details', event.target.value)}
                onBlur={() => markTouched(pathFor(entry.id, 'details'))}
                rows={2}
                placeholder="Add context about why the award matters."
              />
            </div>
          </form>
        </CollapsibleEntryCard>
      ))}

      <button className="button buttonSecondary addEntryButton" type="button" onClick={addEntry}>
        Add award
      </button>
    </div>
  );
}
