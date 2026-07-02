import CollapsibleEntryCard from "./collapsibleEntryCard";
import { buildEntrySummary } from "./buildEntrySummary";
import FormFieldError from "./formFieldError";
import { createEditorTargetAttributes } from "../../lib/editorTargets";

export default function LanguagesForm({ section, actions, getFieldError, markTouched, editorTarget, placeholderFor }) {
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
            [entry.language, entry.proficiency],
            "Add language and proficiency"
          )}
          fallbackSummary="Add language and proficiency"
          expandLabel={`language ${index + 1}`}
          menuLabel={`Language ${index + 1} actions`}
          moveUpLabel={`Move language ${index + 1} up`}
          moveDownLabel={`Move language ${index + 1} down`}
          removeLabel={`Remove language ${index + 1}`}
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
          </form>
        </CollapsibleEntryCard>
      ))}

      <button className="button buttonSecondary addEntryButton" type="button" onClick={addEntry}>
        Add language
      </button>
    </div>
  );
}
