import AutoResizeTextarea from "../autoResizeTextarea";
import CollapsibleEntryCard from "./collapsibleEntryCard";
import { buildEntrySummary } from "./buildEntrySummary";
import FormFieldError from "./formFieldError";
import ReorderableTextList from "./reorderableTextList";
import { createEditorTargetAttributes } from "../../lib/editorTargets";

export default function ProjectsForm({ section, actions, getFieldError, markTouched, editorTarget }) {
  const entries = section.entries || [];
  const sectionId = section.id;
  const pathFor = (entryId, field) => `sections.${sectionId}.${entryId}.${field}`;
  const editorAttrs = (entryId, field) => createEditorTargetAttributes(pathFor(entryId, field), { entryId });
  const updateEntry = (entryId, field, value) => actions.updateSectionBlockEntry(sectionId, entryId, field, value);
  const addEntry = () => actions.addSectionBlockEntry(sectionId);
  const moveEntry = (entryId, direction) => actions.moveSectionBlockEntry(sectionId, entryId, direction);
  const removeEntry = (entryId) => actions.removeSectionBlockEntry(sectionId, entryId);
  const updateTextList = (entryId, field, itemIndex, value) => (
    actions.updateSectionBlockTextList(sectionId, entryId, field, itemIndex, value)
  );
  const addTextListItem = (entryId, field) => actions.addSectionBlockTextListItem(sectionId, entryId, field);
  const moveTextListItem = (entryId, field, itemIndex, direction) => (
    actions.moveSectionBlockTextListItem(sectionId, entryId, field, itemIndex, direction)
  );
  const removeTextListItem = (entryId, field, itemIndex) => (
    actions.removeSectionBlockTextListItem(sectionId, entryId, field, itemIndex)
  );

  return (
    <div className="formStack">
      {entries.map((entry, index) => (
        <CollapsibleEntryCard
          key={entry.id}
          summary={buildEntrySummary(
            [entry.name, entry.subtitle || entry.summary, entry.years],
            "Add a project name and details"
          )}
          fallbackSummary="Add a project name and details"
          expandLabel={`project ${index + 1}`}
          menuLabel={`Project ${index + 1} actions`}
          moveUpLabel={`Move project ${index + 1} up`}
          moveDownLabel={`Move project ${index + 1} down`}
          removeLabel={`Remove project ${index + 1}`}
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
                <label htmlFor={`project-name-${entry.id}`}>Project name</label>
                <input
                  type="text"
                  id={`project-name-${entry.id}`}
                  {...editorAttrs(entry.id, 'name')}
                  value={entry.name}
                  onChange={(event) => updateEntry(entry.id, 'name', event.target.value)}
                  onBlur={() => markTouched(pathFor(entry.id, 'name'))}
                  placeholder="ResumeLoomr"
                />
                <FormFieldError message={getFieldError(pathFor(entry.id, 'name'))} />
              </div>

              <div className="field">
                <label htmlFor={`project-years-${entry.id}`}>Dates</label>
                <input
                  type="text"
                  id={`project-years-${entry.id}`}
                  {...editorAttrs(entry.id, 'years')}
                  value={entry.years}
                  onChange={(event) => updateEntry(entry.id, 'years', event.target.value)}
                  onBlur={() => markTouched(pathFor(entry.id, 'years'))}
                  placeholder="2025 - Present"
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor={`project-subtitle-${entry.id}`}>Subtitle or stack</label>
              <input
                type="text"
                id={`project-subtitle-${entry.id}`}
                {...editorAttrs(entry.id, 'subtitle')}
                value={entry.subtitle}
                onChange={(event) => updateEntry(entry.id, 'subtitle', event.target.value)}
                onBlur={() => markTouched(pathFor(entry.id, 'subtitle'))}
                placeholder="React, Vite, plain CSS"
              />
            </div>

            <div className="field">
              <label htmlFor={`project-summary-${entry.id}`}>Summary</label>
              <AutoResizeTextarea
                id={`project-summary-${entry.id}`}
                {...editorAttrs(entry.id, 'summary')}
                value={entry.summary}
                onChange={(event) => updateEntry(entry.id, 'summary', event.target.value)}
                onBlur={() => markTouched(pathFor(entry.id, 'summary'))}
                rows={2}
                placeholder="Summarize what the project is, who it served, or what made it notable."
              />
            </div>

            <ReorderableTextList
              label="Highlights"
              items={entry.highlights}
              idPrefix={`project-highlights-${entry.id}`}
              pathPrefix={pathFor(entry.id, 'highlights')}
              placeholder="Add a measurable project outcome or implementation detail."
              addLabel="Add highlight"
              getFieldError={getFieldError}
              markTouched={markTouched}
              onChangeItem={(itemIndex, value) => updateTextList(entry.id, 'highlights', itemIndex, value)}
              onMoveItem={(itemIndex, direction) => moveTextListItem(entry.id, 'highlights', itemIndex, direction)}
              onRemoveItem={(itemIndex) => removeTextListItem(entry.id, 'highlights', itemIndex)}
              onAddItem={() => addTextListItem(entry.id, 'highlights')}
            />
          </form>
        </CollapsibleEntryCard>
      ))}

      <button className="button buttonSecondary addEntryButton" type="button" onClick={addEntry}>
        Add project
      </button>
    </div>
  );
}
