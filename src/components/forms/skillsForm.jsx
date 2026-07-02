import AutoResizeTextarea from "../autoResizeTextarea";
import CollapsibleEntryCard from "./collapsibleEntryCard";
import { buildEntrySummary } from "./buildEntrySummary";
import FormFieldError from "./formFieldError";
import { createEditorTargetAttributes } from "../../lib/editorTargets";

export default function SkillsForm({ section, actions, getFieldError, markTouched, editorTarget, placeholderFor }) {
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
            [entry.category, entry.items],
            "Add a skill category and skill list"
          )}
          fallbackSummary="Add a skill category and skill list"
          expandLabel={`skill group ${index + 1}`}
          menuLabel={`Skill group ${index + 1} actions`}
          moveUpLabel={`Move skill group ${index + 1} up`}
          moveDownLabel={`Move skill group ${index + 1} down`}
          removeLabel={`Remove skill group ${index + 1}`}
          onMoveUp={() => moveEntry(entry.id, -1)}
          onMoveDown={() => moveEntry(entry.id, 1)}
          onRemove={() => removeEntry(entry.id)}
          disableUp={index === 0}
          disableDown={index === entries.length - 1}
          disableRemove={entries.length === 1}
          expandSignal={editorTarget?.entryId === entry.id ? editorTarget.requestId : 0}
        >
          <form onSubmit={(event) => event.preventDefault()}>
            <div className="field">
              <label htmlFor={`skills-category-${entry.id}`}>Category</label>
              <input
                type="text"
                id={`skills-category-${entry.id}`}
                {...editorAttrs(entry.id, 'category')}
                value={entry.category}
                onChange={(event) => updateEntry(entry.id, 'category', event.target.value)}
                onBlur={() => markTouched(pathFor(entry.id, 'category'))}
                placeholder={placeholder(entry.id, 'category', 'Product design')}
              />
            </div>

            <div className="field">
              <label htmlFor={`skills-items-${entry.id}`}>Skills</label>
              <AutoResizeTextarea
                id={`skills-items-${entry.id}`}
                {...editorAttrs(entry.id, 'items')}
                value={entry.items}
                onChange={(event) => updateEntry(entry.id, 'items', event.target.value)}
                onBlur={() => markTouched(pathFor(entry.id, 'items'))}
                rows={2}
                placeholder={placeholder(entry.id, 'items', 'Design systems, prototyping, user research, Figma')}
              />
              <FormFieldError message={getFieldError(pathFor(entry.id, 'items'))} />
            </div>
          </form>
        </CollapsibleEntryCard>
      ))}

      <button className="button buttonSecondary addEntryButton" type="button" onClick={addEntry}>
        Add skill group
      </button>
    </div>
  );
}
