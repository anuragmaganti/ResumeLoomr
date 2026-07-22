import AutoResizeTextarea from "../autoResizeTextarea";
import FormFieldError from "./formFieldError";
import ReorderableTextList from "./reorderableTextList";
import { createSectionEntryFormBindings } from "./sectionEntryForm";
import SectionEntryList from "./sectionEntryList";

export default function ProjectsForm({ section, actions, getFieldError, markTouched, editorTarget, placeholderFor }) {
  const { sectionId, pathFor, placeholder, editorAttrs, updateEntry } = createSectionEntryFormBindings({
    section,
    actions,
    placeholderFor,
  });
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
    <SectionEntryList
      section={section}
      actions={actions}
      editorTarget={editorTarget}
      entryNoun="project"
      fallbackSummary="Add a project name and details"
      getSummaryValues={(entry) => [entry.name, entry.subtitle || entry.summary, entry.years]}
      addLabel="Add project"
    >
      {(entry) => (
        <>
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
                  placeholder={placeholder(entry.id, 'name', 'ResumeLoomr')}
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
                  placeholder={placeholder(entry.id, 'years', '2025 - Present')}
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
                placeholder={placeholder(entry.id, 'subtitle', 'React, Vite, plain CSS')}
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
                placeholder={placeholder(entry.id, 'summary', 'Summarize what the project is, who it served, or what made it notable.')}
              />
            </div>

            <ReorderableTextList
              label="Highlights"
              items={entry.highlights}
              idPrefix={`project-highlights-${entry.id}`}
              pathPrefix={pathFor(entry.id, 'highlights')}
              placeholder="Add a measurable project outcome or implementation detail."
              placeholderFor={placeholderFor}
              addLabel="Add highlight"
              getFieldError={getFieldError}
              markTouched={markTouched}
              onChangeItem={(itemIndex, value) => updateTextList(entry.id, 'highlights', itemIndex, value)}
              onMoveItem={(itemIndex, direction) => moveTextListItem(entry.id, 'highlights', itemIndex, direction)}
              onRemoveItem={(itemIndex) => removeTextListItem(entry.id, 'highlights', itemIndex)}
              onAddItem={() => addTextListItem(entry.id, 'highlights')}
            />
        </>
      )}
    </SectionEntryList>
  );
}
