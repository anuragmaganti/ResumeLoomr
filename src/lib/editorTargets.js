export function personalEditorPath(field) {
  return `personal.${field}`;
}

export function sectionTitleEditorPath(sectionId) {
  return `sections.${sectionId}.__title`;
}

export function sectionEntryEditorPath(sectionId, entryId, field) {
  return `sections.${sectionId}.${entryId}.${field}`;
}

export function sectionEntryListEditorPath(sectionId, entryId, field, itemIndex) {
  return `${sectionEntryEditorPath(sectionId, entryId, field)}.${itemIndex}`;
}

export function sectionEntryNestedEditorPath(sectionId, entryId, nestedPath) {
  return `sections.${sectionId}.${entryId}.${nestedPath}`;
}

export function createPreviewEditAttributes(target) {
  if (!target?.sectionId || !target?.path) {
    return {};
  }

  const attributes = {
    'data-edit-section-id': target.sectionId,
    'data-edit-path': target.path,
  };

  if (target.field) {
    attributes['data-edit-field'] = target.field;
  }

  if (target.entryId) {
    attributes['data-edit-entry-id'] = target.entryId;
  }

  if (target.itemIndex !== undefined && target.itemIndex !== null) {
    attributes['data-edit-item-index'] = String(target.itemIndex);
  }

  if (target.nestedPath) {
    attributes['data-edit-nested-path'] = target.nestedPath;
  }

  return attributes;
}

export function createEditorTargetAttributes(path, { entryId } = {}) {
  if (!path) {
    return {};
  }

  return {
    'data-editor-path': path,
    ...(entryId ? { 'data-editor-entry-id': entryId } : {}),
  };
}
