import AutoResizeTextarea from "../autoResizeTextarea";
import CollapsibleEntryCard from "./collapsibleEntryCard";
import { buildEntrySummary } from "./buildEntrySummary";
import FormFieldError from "./formFieldError";
import ReorderableTextList from "./reorderableTextList";

export default function ProjectsForm({ projects = [], section, actions, getFieldError, markTouched }) {
  const entries = section?.entries || projects;
  const sectionId = section?.id || '';
  const isBlockEditor = Boolean(sectionId);
  const pathFor = (entryId, field) => (
    isBlockEditor ? `sections.${sectionId}.${entryId}.${field}` : `projects.${entryId}.${field}`
  );
  const updateEntry = (entryId, field, value) => (
    isBlockEditor
      ? actions.updateSectionBlockEntry(sectionId, entryId, field, value)
      : actions.updateCollectionEntry('projects', entryId, field, value)
  );
  const addEntry = () => (
    isBlockEditor ? actions.addSectionBlockEntry(sectionId) : actions.addCollectionEntry('projects')
  );
  const moveEntry = (entryId, direction) => (
    isBlockEditor ? actions.moveSectionBlockEntry(sectionId, entryId, direction) : actions.moveCollectionEntry('projects', entryId, direction)
  );
  const removeEntry = (entryId) => (
    isBlockEditor ? actions.removeSectionBlockEntry(sectionId, entryId) : actions.removeCollectionEntry('projects', entryId)
  );
  const updateTextList = (entryId, field, itemIndex, value) => (
    isBlockEditor
      ? actions.updateSectionBlockTextList(sectionId, entryId, field, itemIndex, value)
      : actions.updateCollectionTextList('projects', entryId, field, itemIndex, value)
  );
  const addTextListItem = (entryId, field) => (
    isBlockEditor
      ? actions.addSectionBlockTextListItem(sectionId, entryId, field)
      : actions.addCollectionTextListItem('projects', entryId, field)
  );
  const moveTextListItem = (entryId, field, itemIndex, direction) => (
    isBlockEditor
      ? actions.moveSectionBlockTextListItem(sectionId, entryId, field, itemIndex, direction)
      : actions.moveCollectionTextListItem('projects', entryId, field, itemIndex, direction)
  );
  const removeTextListItem = (entryId, field, itemIndex) => (
    isBlockEditor
      ? actions.removeSectionBlockTextListItem(sectionId, entryId, field, itemIndex)
      : actions.removeCollectionTextListItem('projects', entryId, field, itemIndex)
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
        >
          <form onSubmit={(event) => event.preventDefault()}>
            <div className="fieldGrid fieldGridTwo">
              <div className="field">
                <label htmlFor={`project-name-${entry.id}`}>Project name</label>
                <input
                  type="text"
                  id={`project-name-${entry.id}`}
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
