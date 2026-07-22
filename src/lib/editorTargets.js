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

export function parseEditorTargetPath(path) {
  const pathParts = typeof path === 'string' ? path.split('.') : [];

  if (pathParts[0] === 'personal' && pathParts[1]) {
    return {
      sectionId: 'personal',
      field: pathParts[1],
      path,
    };
  }

  if (pathParts[0] !== 'sections' || !pathParts[1] || !pathParts[2]) {
    return null;
  }

  if (pathParts[2] === '__title') {
    return {
      sectionId: pathParts[1],
      field: '__title',
      path,
    };
  }

  if (!pathParts[3]) {
    return null;
  }

  const target = {
    sectionId: pathParts[1],
    entryId: pathParts[2],
    field: pathParts[3],
    path,
  };

  if (/^\d+$/.test(pathParts[4] || '') && pathParts.length === 5) {
    target.itemIndex = Number(pathParts[4]);
  } else if (
    (pathParts[3] === 'programs' || pathParts[3] === 'customSections') &&
    /^\d+$/.test(pathParts[4] || '') &&
    pathParts[5]
  ) {
    target.field = pathParts[5];
    target.nestedPath = pathParts.slice(3).join('.');
  }

  return target;
}

export function getEditorEntryIdentity(path) {
  const target = parseEditorTargetPath(path);

  if (!target?.entryId) {
    return null;
  }

  return {
    sectionId: target.sectionId,
    entryId: target.entryId,
  };
}

const MULTILINE_EDITOR_FIELDS = new Set([
  'aboutMe',
  'awards',
  'content',
  'coursework',
  'details',
  'items',
  'summary',
]);

const URL_EDITOR_FIELDS = new Set(['linkedinUrl', 'githubUrl', 'portfolioUrl']);

const EDITOR_FIELD_LABELS = {
  __title: 'Section title',
  aboutMe: 'Professional summary',
  activities: 'Highlight',
  awards: 'Awards',
  category: 'Skill category',
  company: 'Organization',
  content: 'Custom section content',
  coursework: 'Relevant coursework',
  degree: 'Degree',
  details: 'Details',
  email: 'Email address',
  githubUrl: 'GitHub URL',
  gpa: 'GPA',
  headline: 'Professional headline',
  highlights: 'Highlight',
  honors: 'Honors',
  issuer: 'Issuer',
  items: 'Skills',
  label: 'Custom section title',
  language: 'Language',
  linkedinUrl: 'LinkedIn URL',
  location: 'Location',
  name: 'Name',
  phone: 'Phone number',
  portfolioUrl: 'Portfolio URL',
  proficiency: 'Proficiency',
  publisher: 'Publisher',
  role: 'Role',
  school: 'Institution',
  subtitle: 'Subtitle',
  summary: 'Summary',
  title: 'Title',
  years: 'Dates',
  yearsEdu: 'Dates',
  yearsExp: 'Dates',
};

function toText(value) {
  return value === undefined || value === null ? '' : String(value);
}

function clampOffset(value, length) {
  const offset = Number.isFinite(value) ? Math.trunc(value) : length;
  return Math.max(0, Math.min(offset, Math.max(0, length)));
}

export function mapDisplayedCaretOffsetToSource({
  displayText,
  sourceValue,
  displayOffset,
  isPlaceholder = false,
} = {}) {
  const display = toText(displayText);
  const source = toText(sourceValue);

  if (isPlaceholder || source.trim() === '') {
    return 0;
  }

  const normalizedDisplayOffset = clampOffset(displayOffset, display.length);

  if (display === source) {
    return normalizedDisplayOffset;
  }

  if (display) {
    const displayStart = source.indexOf(display);

    if (displayStart >= 0) {
      return clampOffset(displayStart + normalizedDisplayOffset, source.length);
    }
  }

  return clampOffset(normalizedDisplayOffset, source.length);
}

export function getPreviewCaretOffsetFromPoint(valueElement, clientX, clientY) {
  const ownerDocument = valueElement?.ownerDocument;

  if (!ownerDocument || !Number.isFinite(clientX) || !Number.isFinite(clientY)) {
    return null;
  }

  let offsetNode = null;
  let offset = null;

  if (typeof ownerDocument.caretPositionFromPoint === 'function') {
    const position = ownerDocument.caretPositionFromPoint(clientX, clientY);
    offsetNode = position?.offsetNode || null;
    offset = position?.offset;
  } else if (typeof ownerDocument.caretRangeFromPoint === 'function') {
    const range = ownerDocument.caretRangeFromPoint(clientX, clientY);
    offsetNode = range?.startContainer || null;
    offset = range?.startOffset;
  }

  if (
    !offsetNode ||
    !Number.isFinite(offset) ||
    (offsetNode !== valueElement && !valueElement.contains(offsetNode))
  ) {
    return null;
  }

  try {
    const range = ownerDocument.createRange();
    range.selectNodeContents(valueElement);
    range.setEnd(offsetNode, offset);
    return clampOffset(range.toString().length, valueElement.textContent?.length || 0);
  } catch {
    return null;
  }
}

export function isPreviewEditorTargetMultiline(target) {
  if (Number.isInteger(target?.itemIndex)) {
    return true;
  }

  if (target?.nestedPath?.split('.').at(-1) === 'content') {
    return true;
  }

  return MULTILINE_EDITOR_FIELDS.has(target?.field);
}

export function getPreviewEditorInputMode(target) {
  if (target?.sectionId === 'personal' && target?.field === 'email') {
    return 'email';
  }

  if (target?.sectionId === 'personal' && target?.field === 'phone') {
    return 'tel';
  }

  if (target?.sectionId === 'personal' && URL_EDITOR_FIELDS.has(target?.field)) {
    return 'url';
  }

  return 'text';
}

export function getPreviewEditorLabel(target) {
  return EDITOR_FIELD_LABELS[target?.field] || 'Resume field';
}

export function readResumeEditorTargetValue(resume, target) {
  if (!resume || !target?.sectionId || !target?.field) {
    return null;
  }

  if (target.sectionId === 'personal') {
    return toText(resume.personal?.[target.field]);
  }

  const section = Array.isArray(resume.sections)
    ? resume.sections.find((candidate) => candidate.id === target.sectionId)
    : null;

  if (!section) {
    return null;
  }

  if (target.field === '__title') {
    return toText(section.title);
  }

  const entry = Array.isArray(section.entries)
    ? section.entries.find((candidate) => candidate.id === target.entryId)
    : null;

  if (!entry) {
    return null;
  }

  if (Number.isInteger(target.itemIndex)) {
    const items = Array.isArray(entry[target.field]) ? entry[target.field] : [];
    return target.itemIndex >= 0 && target.itemIndex < items.length
      ? toText(items[target.itemIndex])
      : null;
  }

  if (target.nestedPath) {
    const pathParts = target.nestedPath.split('.').filter(Boolean);
    let current = entry;

    for (const pathPart of pathParts) {
      if (current === null || current === undefined) {
        return null;
      }

      const key = /^\d+$/.test(pathPart) ? Number(pathPart) : pathPart;
      current = current[key];
    }

    return current === undefined || current === null ? null : toText(current);
  }

  return entry[target.field] === undefined ? null : toText(entry[target.field]);
}

export function getPreviewEditorMutation(target, value) {
  if (!target?.sectionId || !target?.field) {
    return null;
  }

  const nextValue = toText(value);

  if (target.sectionId === 'personal') {
    return { type: 'personal', args: [target.field, nextValue] };
  }

  if (target.field === '__title') {
    return { type: 'sectionTitle', args: [target.sectionId, nextValue] };
  }

  if (target.entryId && Number.isInteger(target.itemIndex) && target.itemIndex >= 0) {
    return {
      type: 'textList',
      args: [target.sectionId, target.entryId, target.field, target.itemIndex, nextValue],
    };
  }

  const nestedMatch = typeof target.nestedPath === 'string'
    ? /^(programs|customSections)\.(\d+)\.([^.]+)$/.exec(target.nestedPath)
    : null;

  if (target.entryId && nestedMatch) {
    const [, collection, rawIndex, nestedField] = nestedMatch;
    return {
      type: collection === 'programs' ? 'educationProgram' : 'educationCustomSection',
      args: [target.sectionId, target.entryId, Number(rawIndex), nestedField, nextValue],
    };
  }

  if (target.entryId) {
    return {
      type: 'entry',
      args: [target.sectionId, target.entryId, target.field, nextValue],
    };
  }

  return null;
}
