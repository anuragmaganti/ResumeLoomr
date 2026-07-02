import AutoResizeTextarea from "../autoResizeTextarea";
import CollapsibleEntryCard from "./collapsibleEntryCard";
import { buildEntrySummary } from "./buildEntrySummary";
import FormFieldError from "./formFieldError";
import { createEditorTargetAttributes } from "../../lib/editorTargets";

export default function AwardsForm({ section, actions, getFieldError, markTouched, editorTarget, placeholderFor }) {
  const entries = section.entries || [];
  const sectionId = section.id;
  const pathFor = (entryId, field) => `sections.${sectionId}.${entryId}.${field}`;
  const placeholder = (entryId, field, fallback) => placeholderFor?.(pathFor(entryId, field), fallback) || fallback;
  const editorAttrs = (entryId, field) => createEditorTargetAttributes(pathFor(entryId, field), { entryId });
  const updateEntry = (entryId, field, value) => actions.updateSectionBlockEntry(sectionId, entryId, field, value);
  const addEntry = () => actions.addSectionBlockEntry(sectionId);
  const moveEntry = (entryId, direction) => actions.moveSectionBlockEntry(sectionId, entryId, direction);
  const removeEntry = (entryId) => actions.removeSectionBlockEntry(sectionId, entryId);

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
          expandSignal={editorTarget?.entryId === entry.id ? editorTarget.requestId : 0}
        >
          <form onSubmit={(event) => event.preventDefault()}>
            <div className="fieldGrid fieldGridTwo">
              <div className="field">
                <label htmlFor={`award-title-${entry.id}`}>Award</label>
                <input
                  type="text"
                  id={`award-title-${entry.id}`}
                  {...editorAttrs(entry.id, 'title')}
                  value={entry.title}
                  onChange={(event) => updateEntry(entry.id, 'title', event.target.value)}
                  onBlur={() => markTouched(pathFor(entry.id, 'title'))}
                  placeholder={placeholder(entry.id, 'title', 'Employee of the Year')}
                />
                <FormFieldError message={getFieldError(pathFor(entry.id, 'title'))} />
              </div>

              <div className="field">
                <label htmlFor={`award-years-${entry.id}`}>Date</label>
                <input
                  type="text"
                  id={`award-years-${entry.id}`}
                  {...editorAttrs(entry.id, 'years')}
                  value={entry.years}
                  onChange={(event) => updateEntry(entry.id, 'years', event.target.value)}
                  onBlur={() => markTouched(pathFor(entry.id, 'years'))}
                  placeholder={placeholder(entry.id, 'years', '2024')}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor={`award-issuer-${entry.id}`}>Issuer</label>
              <input
                type="text"
                id={`award-issuer-${entry.id}`}
                {...editorAttrs(entry.id, 'issuer')}
                value={entry.issuer}
                onChange={(event) => updateEntry(entry.id, 'issuer', event.target.value)}
                onBlur={() => markTouched(pathFor(entry.id, 'issuer'))}
                placeholder={placeholder(entry.id, 'issuer', 'Acme Inc.')}
              />
            </div>

            <div className="field">
              <label htmlFor={`award-details-${entry.id}`}>Details</label>
              <AutoResizeTextarea
                id={`award-details-${entry.id}`}
                {...editorAttrs(entry.id, 'details')}
                value={entry.details}
                onChange={(event) => updateEntry(entry.id, 'details', event.target.value)}
                onBlur={() => markTouched(pathFor(entry.id, 'details'))}
                rows={2}
                placeholder={placeholder(entry.id, 'details', 'Add context about why the award matters.')}
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
