import AutoResizeTextarea from "../autoResizeTextarea";
import FormFieldError from "./formFieldError";
import { createSectionEntryFormBindings } from "./sectionEntryForm";
import SectionEntryList from "./sectionEntryList";

export default function AwardsForm({ section, actions, getFieldError, markTouched, editorTarget, placeholderFor }) {
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
      entryNoun="award"
      fallbackSummary="Add award, issuer, and date"
      getSummaryValues={(entry) => [entry.title, entry.issuer, entry.years]}
      addLabel="Add award"
    >
      {(entry) => (
        <>
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
        </>
      )}
    </SectionEntryList>
  );
}
