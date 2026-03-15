import CollapsibleEntryCard, { buildEntrySummary } from "./collapsibleEntryCard";
import FormFieldError from "./formFieldError";

export default function LanguagesForm({ languages, actions, getFieldError, markTouched }) {
  return (
    <div className="formStack">
      {languages.map((entry, index) => (
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
          onMoveUp={() => actions.moveCollectionEntry('languages', entry.id, -1)}
          onMoveDown={() => actions.moveCollectionEntry('languages', entry.id, 1)}
          onRemove={() => actions.removeCollectionEntry('languages', entry.id)}
          disableUp={index === 0}
          disableDown={index === languages.length - 1}
          disableRemove={languages.length === 1}
        >
          <form onSubmit={(event) => event.preventDefault()}>
            <div className="fieldGrid fieldGridTwo">
              <div className="field">
                <label htmlFor={`language-name-${entry.id}`}>Language</label>
                <input
                  type="text"
                  id={`language-name-${entry.id}`}
                  value={entry.language}
                  onChange={(event) => actions.updateCollectionEntry('languages', entry.id, 'language', event.target.value)}
                  onBlur={() => markTouched(`languages.${entry.id}.language`)}
                  placeholder="Spanish"
                />
                <FormFieldError message={getFieldError(`languages.${entry.id}.language`)} />
              </div>

              <div className="field">
                <label htmlFor={`language-proficiency-${entry.id}`}>Proficiency</label>
                <input
                  type="text"
                  id={`language-proficiency-${entry.id}`}
                  value={entry.proficiency}
                  onChange={(event) => actions.updateCollectionEntry('languages', entry.id, 'proficiency', event.target.value)}
                  onBlur={() => markTouched(`languages.${entry.id}.proficiency`)}
                  placeholder="Professional working proficiency"
                />
              </div>
            </div>
          </form>
        </CollapsibleEntryCard>
      ))}

      <button className="button buttonSecondary addEntryButton" type="button" onClick={() => actions.addCollectionEntry('languages')}>
        Add language
      </button>
    </div>
  );
}
