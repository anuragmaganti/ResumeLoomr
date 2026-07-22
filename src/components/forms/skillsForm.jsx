import AutoResizeTextarea from "../autoResizeTextarea";
import FormFieldError from "./formFieldError";
import { createSectionEntryFormBindings } from "./sectionEntryForm";
import SectionEntryList from "./sectionEntryList";

export default function SkillsForm({ section, actions, getFieldError, markTouched, editorTarget, placeholderFor }) {
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
      entryNoun="skill group"
      fallbackSummary="Add a skill category and skill list"
      getSummaryValues={(entry) => [entry.category, entry.items]}
      addLabel="Add skill group"
    >
      {(entry) => (
        <>
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
        </>
      )}
    </SectionEntryList>
  );
}
