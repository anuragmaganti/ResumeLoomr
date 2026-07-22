import AutoResizeTextarea from "../autoResizeTextarea";
import FormFieldError from "./formFieldError";
import ReorderableTextList from "./reorderableTextList";
import { createSectionEntryFormBindings } from "./sectionEntryForm";
import SectionEntryList from "./sectionEntryList";

export default function CustomBlockForm({ section, actions, getFieldError, markTouched, editorTarget, placeholderFor }) {
  const { sectionId, pathFor, placeholder, editorAttrs, updateEntry } = createSectionEntryFormBindings({
    section,
    actions,
    placeholderFor,
  });

  return (
    <SectionEntryList
      section={section}
      actions={actions}
      editorTarget={editorTarget}
      entryNoun={`${section.title} entry`}
      fallbackSummary="Add title and details"
      getSummaryValues={(entry) => [entry.title, entry.subtitle, entry.location, entry.years, entry.details]}
      addLabel="Add entry"
    >
      {(entry) => (
        <>
            <div className="field">
              <label htmlFor={`custom-title-${section.id}-${entry.id}`}>Title</label>
              <input
                type="text"
                id={`custom-title-${section.id}-${entry.id}`}
                {...editorAttrs(entry.id, 'title')}
                value={entry.title}
                onChange={(event) => updateEntry(entry.id, 'title', event.target.value)}
                onBlur={() => markTouched(pathFor(entry.id, 'title'))}
                placeholder={placeholder(entry.id, 'title', 'Entry title')}
              />
              <FormFieldError message={getFieldError(pathFor(entry.id, 'title'))} />
            </div>

            <div className="field">
              <label htmlFor={`custom-subtitle-${section.id}-${entry.id}`}>Subtitle</label>
              <input
                type="text"
                id={`custom-subtitle-${section.id}-${entry.id}`}
                {...editorAttrs(entry.id, 'subtitle')}
                value={entry.subtitle}
                onChange={(event) => updateEntry(entry.id, 'subtitle', event.target.value)}
                onBlur={() => markTouched(pathFor(entry.id, 'subtitle'))}
                placeholder={placeholder(entry.id, 'subtitle', 'Optional context')}
              />
            </div>

            <div className="fieldGrid fieldGridTwo">
              <div className="field">
                <label htmlFor={`custom-location-${section.id}-${entry.id}`}>Location</label>
                <input
                  type="text"
                  id={`custom-location-${section.id}-${entry.id}`}
                  {...editorAttrs(entry.id, 'location')}
                  value={entry.location}
                  onChange={(event) => updateEntry(entry.id, 'location', event.target.value)}
                  onBlur={() => markTouched(pathFor(entry.id, 'location'))}
                  placeholder={placeholder(entry.id, 'location', 'City, State')}
                />
              </div>

              <div className="field">
                <label htmlFor={`custom-years-${section.id}-${entry.id}`}>Date</label>
                <input
                  type="text"
                  id={`custom-years-${section.id}-${entry.id}`}
                  {...editorAttrs(entry.id, 'years')}
                  value={entry.years}
                  onChange={(event) => updateEntry(entry.id, 'years', event.target.value)}
                  onBlur={() => markTouched(pathFor(entry.id, 'years'))}
                  placeholder={placeholder(entry.id, 'years', '2024')}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor={`custom-details-${section.id}-${entry.id}`}>Details</label>
              <AutoResizeTextarea
                id={`custom-details-${section.id}-${entry.id}`}
                {...editorAttrs(entry.id, 'details')}
                value={entry.details}
                onChange={(event) => updateEntry(entry.id, 'details', event.target.value)}
                onBlur={() => markTouched(pathFor(entry.id, 'details'))}
                rows={2}
                placeholder={placeholder(entry.id, 'details', 'Add details for this entry.')}
              />
            </div>

            <ReorderableTextList
              label="Highlights"
              items={entry.highlights}
              idPrefix={`custom-highlights-${section.id}-${entry.id}`}
              pathPrefix={pathFor(entry.id, 'highlights')}
              placeholder="Add a detail or bullet."
              placeholderFor={placeholderFor}
              addLabel="Add highlight"
              getFieldError={getFieldError}
              markTouched={markTouched}
              onChangeItem={(itemIndex, value) => actions.updateSectionBlockTextList(sectionId, entry.id, 'highlights', itemIndex, value)}
              onMoveItem={(itemIndex, direction) => actions.moveSectionBlockTextListItem(sectionId, entry.id, 'highlights', itemIndex, direction)}
              onRemoveItem={(itemIndex) => actions.removeSectionBlockTextListItem(sectionId, entry.id, 'highlights', itemIndex)}
              onAddItem={() => actions.addSectionBlockTextListItem(sectionId, entry.id, 'highlights')}
            />
        </>
      )}
    </SectionEntryList>
  );
}
