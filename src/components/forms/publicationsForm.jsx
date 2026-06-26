import AutoResizeTextarea from "../autoResizeTextarea";
import CollapsibleEntryCard from "./collapsibleEntryCard";
import { buildEntrySummary } from "./buildEntrySummary";
import FormFieldError from "./formFieldError";
import { createEditorTargetAttributes } from "../../lib/editorTargets";

export default function PublicationsForm({ section, actions, getFieldError, markTouched, editorTarget }) {
  const entries = section.entries || [];
  const sectionId = section.id;
  const pathFor = (entryId, field) => `sections.${sectionId}.${entryId}.${field}`;
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
            [entry.title, entry.publisher, entry.years],
            "Add title, publisher, and date"
          )}
          fallbackSummary="Add title, publisher, and date"
          expandLabel={`publication ${index + 1}`}
          menuLabel={`Publication ${index + 1} actions`}
          moveUpLabel={`Move publication ${index + 1} up`}
          moveDownLabel={`Move publication ${index + 1} down`}
          removeLabel={`Remove publication ${index + 1}`}
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
                <label htmlFor={`publication-title-${entry.id}`}>Title</label>
                <input
                  type="text"
                  id={`publication-title-${entry.id}`}
                  {...editorAttrs(entry.id, 'title')}
                  value={entry.title}
                  onChange={(event) => updateEntry(entry.id, 'title', event.target.value)}
                  onBlur={() => markTouched(pathFor(entry.id, 'title'))}
                  placeholder="Designing for clarity in high-density interfaces"
                />
                <FormFieldError message={getFieldError(pathFor(entry.id, 'title'))} />
              </div>

              <div className="field">
                <label htmlFor={`publication-years-${entry.id}`}>Date</label>
                <input
                  type="text"
                  id={`publication-years-${entry.id}`}
                  {...editorAttrs(entry.id, 'years')}
                  value={entry.years}
                  onChange={(event) => updateEntry(entry.id, 'years', event.target.value)}
                  onBlur={() => markTouched(pathFor(entry.id, 'years'))}
                  placeholder="2024"
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor={`publication-publisher-${entry.id}`}>Publisher or venue</label>
              <input
                type="text"
                id={`publication-publisher-${entry.id}`}
                {...editorAttrs(entry.id, 'publisher')}
                value={entry.publisher}
                onChange={(event) => updateEntry(entry.id, 'publisher', event.target.value)}
                onBlur={() => markTouched(pathFor(entry.id, 'publisher'))}
                placeholder="Smashing Magazine"
              />
            </div>

            <div className="field">
              <label htmlFor={`publication-details-${entry.id}`}>Details</label>
              <AutoResizeTextarea
                id={`publication-details-${entry.id}`}
                {...editorAttrs(entry.id, 'details')}
                value={entry.details}
                onChange={(event) => updateEntry(entry.id, 'details', event.target.value)}
                onBlur={() => markTouched(pathFor(entry.id, 'details'))}
                rows={2}
                placeholder="Add context like co-authors, publication type, or impact."
              />
            </div>
          </form>
        </CollapsibleEntryCard>
      ))}

      <button className="button buttonSecondary addEntryButton" type="button" onClick={addEntry}>
        Add publication
      </button>
    </div>
  );
}
