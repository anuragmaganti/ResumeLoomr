import AutoResizeTextarea from "../autoResizeTextarea";
import FormFieldError from "./formFieldError";
import { createSectionEntryFormBindings } from "./sectionEntryForm";
import SectionEntryList from "./sectionEntryList";

export default function CertificationsForm({ section, actions, getFieldError, markTouched, editorTarget, placeholderFor }) {
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
      entryNoun="certification"
      fallbackSummary="Add certification, issuer, and date"
      getSummaryValues={(entry) => [entry.name, entry.issuer, entry.years]}
      addLabel="Add certification"
    >
      {(entry) => (
        <>
            <div className="fieldGrid fieldGridTwo">
              <div className="field">
                <label htmlFor={`certification-name-${entry.id}`}>Certification</label>
                <input
                  type="text"
                  id={`certification-name-${entry.id}`}
                  {...editorAttrs(entry.id, 'name')}
                  value={entry.name}
                  onChange={(event) => updateEntry(entry.id, 'name', event.target.value)}
                  onBlur={() => markTouched(pathFor(entry.id, 'name'))}
                  placeholder={placeholder(entry.id, 'name', 'AWS Certified Cloud Practitioner')}
                />
                <FormFieldError message={getFieldError(pathFor(entry.id, 'name'))} />
              </div>

              <div className="field">
                <label htmlFor={`certification-years-${entry.id}`}>Date</label>
                <input
                  type="text"
                  id={`certification-years-${entry.id}`}
                  {...editorAttrs(entry.id, 'years')}
                  value={entry.years}
                  onChange={(event) => updateEntry(entry.id, 'years', event.target.value)}
                  onBlur={() => markTouched(pathFor(entry.id, 'years'))}
                  placeholder={placeholder(entry.id, 'years', '2024')}
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor={`certification-issuer-${entry.id}`}>Issuer</label>
              <input
                type="text"
                id={`certification-issuer-${entry.id}`}
                {...editorAttrs(entry.id, 'issuer')}
                value={entry.issuer}
                onChange={(event) => updateEntry(entry.id, 'issuer', event.target.value)}
                onBlur={() => markTouched(pathFor(entry.id, 'issuer'))}
                placeholder={placeholder(entry.id, 'issuer', 'Amazon Web Services')}
              />
            </div>

            <div className="field">
              <label htmlFor={`certification-details-${entry.id}`}>Details</label>
              <AutoResizeTextarea
                id={`certification-details-${entry.id}`}
                {...editorAttrs(entry.id, 'details')}
                value={entry.details}
                onChange={(event) => updateEntry(entry.id, 'details', event.target.value)}
                onBlur={() => markTouched(pathFor(entry.id, 'details'))}
                rows={2}
                placeholder={placeholder(entry.id, 'details', 'Add optional details like scope, credential ID, or specialization.')}
              />
            </div>
        </>
      )}
    </SectionEntryList>
  );
}
