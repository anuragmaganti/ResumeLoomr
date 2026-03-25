import AutoResizeTextarea from "../autoResizeTextarea";
import CollapsibleEntryCard from "./collapsibleEntryCard";
import { buildEntrySummary } from "./buildEntrySummary";
import FormFieldError from "./formFieldError";

export default function SkillsForm({ skills, actions, getFieldError, markTouched }) {
  return (
    <div className="formStack">
      {skills.map((entry, index) => (
        <CollapsibleEntryCard
          key={entry.id}
          summary={buildEntrySummary(
            [entry.category, entry.items],
            "Add a skill category and skill list"
          )}
          fallbackSummary="Add a skill category and skill list"
          expandLabel={`skill group ${index + 1}`}
          menuLabel={`Skill group ${index + 1} actions`}
          moveUpLabel={`Move skill group ${index + 1} up`}
          moveDownLabel={`Move skill group ${index + 1} down`}
          removeLabel={`Remove skill group ${index + 1}`}
          onMoveUp={() => actions.moveCollectionEntry('skills', entry.id, -1)}
          onMoveDown={() => actions.moveCollectionEntry('skills', entry.id, 1)}
          onRemove={() => actions.removeCollectionEntry('skills', entry.id)}
          disableUp={index === 0}
          disableDown={index === skills.length - 1}
          disableRemove={skills.length === 1}
        >
          <form onSubmit={(event) => event.preventDefault()}>
            <div className="field">
              <label htmlFor={`skills-category-${entry.id}`}>Category</label>
              <input
                type="text"
                id={`skills-category-${entry.id}`}
                value={entry.category}
                onChange={(event) => actions.updateCollectionEntry('skills', entry.id, 'category', event.target.value)}
                onBlur={() => markTouched(`skills.${entry.id}.category`)}
                placeholder="Product design"
              />
            </div>

            <div className="field">
              <label htmlFor={`skills-items-${entry.id}`}>Skills</label>
              <AutoResizeTextarea
                id={`skills-items-${entry.id}`}
                value={entry.items}
                onChange={(event) => actions.updateCollectionEntry('skills', entry.id, 'items', event.target.value)}
                onBlur={() => markTouched(`skills.${entry.id}.items`)}
                rows={2}
                placeholder="Design systems, prototyping, user research, Figma"
              />
              <FormFieldError message={getFieldError(`skills.${entry.id}.items`)} />
            </div>
          </form>
        </CollapsibleEntryCard>
      ))}

      <button className="button buttonSecondary addEntryButton" type="button" onClick={() => actions.addCollectionEntry('skills')}>
        Add skill group
      </button>
    </div>
  );
}
