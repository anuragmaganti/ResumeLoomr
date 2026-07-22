import { createEditorTargetAttributes } from '../../lib/editorTargets.js';

export function createSectionEntryFormBindings({ section, actions, placeholderFor }) {
  const sectionId = section.id;
  const pathFor = (entryId, field) => `sections.${sectionId}.${entryId}.${field}`;

  return {
    sectionId,
    pathFor,
    placeholder(entryId, field, fallback) {
      return placeholderFor?.(pathFor(entryId, field), fallback) || fallback;
    },
    editorAttrs(entryId, field) {
      return createEditorTargetAttributes(pathFor(entryId, field), { entryId });
    },
    updateEntry(entryId, field, value) {
      actions.updateSectionBlockEntry(sectionId, entryId, field, value);
    },
  };
}
