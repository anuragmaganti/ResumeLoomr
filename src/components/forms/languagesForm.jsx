import FormFieldError from "./formFieldError";
import { createSectionEntryFormBindings } from "./sectionEntryForm";
import SectionEntryList from "./sectionEntryList";

export default function LanguagesForm({ section, actions, getFieldError, markTouched, editorTarget, placeholderFor }) {
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
      entryNoun="language"
      fallbackSummary="Add language and proficiency"
      getSummaryValues={(entry) => [entry.language, entry.proficiency]}
      addLabel="Add language"
    >
      {(entry) => (
        <>
            <div className="fieldGrid fieldGridTwo">
              <div className="field">
                <label htmlFor={`language-name-${entry.id}`}>Language</label>
                <input
                  type="text"
                  id={`language-name-${entry.id}`}
                  {...editorAttrs(entry.id, 'language')}
                  value={entry.language}
                  onChange={(event) => updateEntry(entry.id, 'language', event.target.value)}
                  onBlur={() => markTouched(pathFor(entry.id, 'language'))}
                  placeholder={placeholder(entry.id, 'language', 'Spanish')}
                />
                <FormFieldError message={getFieldError(pathFor(entry.id, 'language'))} />
              </div>

              <div className="field">
                <label htmlFor={`language-proficiency-${entry.id}`}>Proficiency</label>
                <input
                  type="text"
                  id={`language-proficiency-${entry.id}`}
                  {...editorAttrs(entry.id, 'proficiency')}
                  value={entry.proficiency}
                  onChange={(event) => updateEntry(entry.id, 'proficiency', event.target.value)}
                  onBlur={() => markTouched(pathFor(entry.id, 'proficiency'))}
                  placeholder={placeholder(entry.id, 'proficiency', 'Professional working proficiency')}
                />
              </div>
            </div>
        </>
      )}
    </SectionEntryList>
  );
}
