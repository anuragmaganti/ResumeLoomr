import AutoResizeTextarea from "../autoResizeTextarea";
import FormFieldError from "./formFieldError";
import { createSectionEntryFormBindings } from "./sectionEntryForm";
import SectionEntryList from "./sectionEntryList";

export default function PublicationsForm({ section, actions, getFieldError, markTouched, editorTarget, placeholderFor }) {
  const { pathFor, placeholder, editorAttrs, updateEntry } = createSectionEntryFormBindings({
    section,
    actions,
    placeholderFor,
  });

  return (
    <SectionEntryList
      section={section}
      actions={actions}
      editorTarget={editorTarget}
      entryNoun="publication"
      fallbackSummary="Add title, publisher, and date"
      getSummaryValues={(entry) => [entry.title, entry.publisher, entry.years]}
      addLabel="Add publication"
    >
      {(entry) => (
        <>
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
                  placeholder={placeholder(entry.id, 'title', 'Designing for clarity in high-density interfaces')}
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
                  placeholder={placeholder(entry.id, 'years', '2024')}
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
                placeholder={placeholder(entry.id, 'publisher', 'Smashing Magazine')}
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
                placeholder={placeholder(entry.id, 'details', 'Add context like co-authors, publication type, or impact.')}
              />
            </div>
        </>
      )}
    </SectionEntryList>
  );
}
