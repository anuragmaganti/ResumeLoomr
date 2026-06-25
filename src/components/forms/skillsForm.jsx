import AutoResizeTextarea from "../autoResizeTextarea";
import CollapsibleEntryCard from "./collapsibleEntryCard";
import { buildEntrySummary } from "./buildEntrySummary";
import FormFieldError from "./formFieldError";
import { createEditorTargetAttributes } from "../../lib/editorTargets";

export default function SkillsForm({ skills = [], section, actions, getFieldError, markTouched, editorTarget }) {
  const entries = section?.entries || skills;
  const sectionId = section?.id || '';
  const isBlockEditor = Boolean(sectionId);
  const pathFor = (entryId, field) => (
    isBlockEditor ? `sections.${sectionId}.${entryId}.${field}` : `skills.${entryId}.${field}`
  );
  const editorAttrs = (entryId, field) => createEditorTargetAttributes(pathFor(entryId, field), { entryId });
  const updateEntry = (entryId, field, value) => (
    isBlockEditor
      ? actions.updateSectionBlockEntry(sectionId, entryId, field, value)
      : actions.updateCollectionEntry('skills', entryId, field, value)
  );
  const addEntry = () => (
    isBlockEditor ? actions.addSectionBlockEntry(sectionId) : actions.addCollectionEntry('skills')
  );
  const moveEntry = (entryId, direction) => (
    isBlockEditor ? actions.moveSectionBlockEntry(sectionId, entryId, direction) : actions.moveCollectionEntry('skills', entryId, direction)
  );
  const removeEntry = (entryId) => (
    isBlockEditor ? actions.removeSectionBlockEntry(sectionId, entryId) : actions.removeCollectionEntry('skills', entryId)
  );

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
                placeholder="Product design"
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
                placeholder="Design systems, prototyping, user research, Figma"
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
