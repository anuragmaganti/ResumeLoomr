import {
  PRINT_PAGE_HEIGHT_PX,
  PRINT_PAGE_WIDTH_PX,
} from './previewPagination.js';

export const DRAFT_STORAGE_KEY = 'resumeloomr:draft:v2';
export const WORKSPACE_INDEX_STORAGE_KEY = 'resumeloomr:index:v1';
export const RESUME_STORAGE_KEY_PREFIX = 'resumeloomr:resume:';
export const MAX_WORKSPACE_RESUME_NAME_LENGTH = 50;
export const MAX_WORKSPACE_RESUMES = 100;
export const MAX_RESUME_SECTIONS = 100;
export const UNTITLED_SECTION_TITLE = 'Untitled section';
export const DEFAULT_TEMPLATE = 'compact';
export const TEMPLATE_OPTIONS = [
  { id: 'compact', label: 'Compact' },
  { id: 'executive', label: 'Executive' },
];
export const SECTION_BLOCK_KINDS = [
  'education',
  'roles',
  'skills',
  'projects',
  'certifications',
  'languages',
  'awards',
  'publications',
  'custom',
];
export const PERSONAL_CONTACT_FIELDS = [
  'location',
  'phone',
  'email',
  'linkedinUrl',
  'githubUrl',
  'portfolioUrl',
  'customField',
];
export const PERSONAL_ALIGNMENT_OPTIONS = ['left', 'center'];
export const PERSONAL_HEADER_ROWS = ['headline', 'contact'];
export const ENTRY_HEADER_LAYOUT_FIELDS = {
  education: ['school', 'degree', 'location', 'yearsEdu', 'gpa', 'honors'],
  roles: ['company', 'role', 'location', 'yearsExp'],
  custom: ['title', 'subtitle', 'location', 'years'],
};
export const SECTION_TEMPLATE_GROUPS = [
  {
    id: 'common',
    label: 'Common',
    templates: [
      { id: 'education', kind: 'education', title: 'Education' },
      { id: 'experience', kind: 'roles', title: 'Experience' },
      { id: 'internships', kind: 'roles', title: 'Internships' },
      { id: 'skills', kind: 'skills', title: 'Skills' },
      { id: 'projects', kind: 'projects', title: 'Projects' },
    ],
  },
  {
    id: 'career',
    label: 'Career',
    templates: [
      { id: 'leadership', kind: 'roles', title: 'Leadership' },
      { id: 'volunteering', kind: 'roles', title: 'Volunteering' },
      { id: 'community-service', kind: 'roles', title: 'Community Service' },
      { id: 'campus-involvement', kind: 'roles', title: 'Campus Involvement' },
      { id: 'research', kind: 'roles', title: 'Research' },
      { id: 'teaching', kind: 'roles', title: 'Teaching' },
    ],
  },
  {
    id: 'credentials',
    label: 'Credentials',
    templates: [
      { id: 'certifications', kind: 'certifications', title: 'Certifications' },
      { id: 'awards', kind: 'awards', title: 'Awards' },
      { id: 'languages', kind: 'languages', title: 'Languages' },
      { id: 'publications', kind: 'publications', title: 'Publications' },
      { id: 'presentations', kind: 'publications', title: 'Presentations' },
      { id: 'patents', kind: 'publications', title: 'Patents' },
    ],
  },
  {
    id: 'specialized',
    label: 'Specialized',
    templates: [
      { id: 'clinical-experience', kind: 'roles', title: 'Clinical Experience' },
      { id: 'military-service', kind: 'roles', title: 'Military Service' },
      { id: 'professional-affiliations', kind: 'custom', title: 'Professional Affiliations' },
    ],
  },
  {
    id: 'custom',
    label: 'Custom',
    templates: [
      { id: 'custom-section', kind: 'custom', title: 'Custom Section' },
    ],
  },
];
export const RESUME_SETTINGS_DEFAULTS = {
  textSize: 0,
  horizontalMargins: 0,
  verticalMargins: 0,
  lineSpacing: 0,
  sectionSpacing: 0,
  entrySpacing: 0,
  headingSize: 0,
  nameSize: 0,
  summaryWidthPercent: 100,
  personalSeparatorTone: 50,
  sectionSeparatorTone: 50,
  personalSeparatorWeight: 2,
  sectionSeparatorWeight: 2,
  personalSeparatorGap: 0,
  sectionSeparatorGap: -1,
  sectionSeparatorPosition: 'aboveSectionName',
  personalContactOrder: PERSONAL_CONTACT_FIELDS,
  personalAlignment: 'template',
  personalHeaderOrder: PERSONAL_HEADER_ROWS,
};
export const SAMPLE_DISPLAY_DEFAULTS = {
  hasStarted: false,
  showInformation: true,
  entryBindings: {},
};

const RESUME_SETTINGS_MIN = -5;
const RESUME_SETTINGS_MAX = 5;
const SUMMARY_WIDTH_MIN = 75;
const SUMMARY_WIDTH_MAX = 100;
const SEPARATOR_TONE_MIN = 0;
const SEPARATOR_TONE_MAX = 100;
const SEPARATOR_WEIGHT_MIN = 1;
const SEPARATOR_WEIGHT_MAX = 5;
const SEPARATOR_GAP_MIN = -5;
const SEPARATOR_GAP_MAX = 5;
const SECTION_SEPARATOR_POSITION_DEFAULT = 'aboveSectionName';
const SECTION_SEPARATOR_POSITIONS = new Set(['aboveSectionName', 'belowSectionName']);
const PERSONAL_ALIGNMENT_DEFAULT = 'template';
const PERSONAL_ALIGNMENTS = new Set([PERSONAL_ALIGNMENT_DEFAULT, ...PERSONAL_ALIGNMENT_OPTIONS]);
const DEFAULT_RESUME_LABEL = 'Resume';
const TEXT_SIZE_STEP = 0.03;
const HEADING_SIZE_STEP = 0.05;
const NAME_SIZE_STEP = 0.05;
const RESUME_FONT_ROOT_PX = 16;
const MARGIN_STEP_IN = 0.04;
const LINE_SPACING_STEP = 0.04;
const SECTION_SPACING_STEP = 4;
const ENTRY_SPACING_STEP = 3;
const SEPARATOR_GAP_STEP = 2;
const SETTING_RANGES = {
  summaryWidthPercent: [SUMMARY_WIDTH_MIN, SUMMARY_WIDTH_MAX],
  personalSeparatorTone: [SEPARATOR_TONE_MIN, SEPARATOR_TONE_MAX],
  sectionSeparatorTone: [SEPARATOR_TONE_MIN, SEPARATOR_TONE_MAX],
  personalSeparatorWeight: [SEPARATOR_WEIGHT_MIN, SEPARATOR_WEIGHT_MAX],
  sectionSeparatorWeight: [SEPARATOR_WEIGHT_MIN, SEPARATOR_WEIGHT_MAX],
  personalSeparatorGap: [SEPARATOR_GAP_MIN, SEPARATOR_GAP_MAX],
  sectionSeparatorGap: [SEPARATOR_GAP_MIN, SEPARATOR_GAP_MAX],
};

function normalizeSectionSeparatorPosition(value) {
  return SECTION_SEPARATOR_POSITIONS.has(value) ? value : SECTION_SEPARATOR_POSITION_DEFAULT;
}

export function normalizePersonalContactOrder(order) {
  const requestedFields = Array.isArray(order) ? order.map(trimText).filter(Boolean) : [];
  const nextFields = [];

  requestedFields.forEach((field) => {
    if (PERSONAL_CONTACT_FIELDS.includes(field) && !nextFields.includes(field)) {
      nextFields.push(field);
    }
  });

  PERSONAL_CONTACT_FIELDS.forEach((field) => {
    if (!nextFields.includes(field)) {
      nextFields.push(field);
    }
  });

  return nextFields;
}

export function normalizePersonalAlignment(alignment) {
  return PERSONAL_ALIGNMENTS.has(alignment) ? alignment : PERSONAL_ALIGNMENT_DEFAULT;
}

export function getEffectivePersonalAlignment(settings, template = DEFAULT_TEMPLATE) {
  const alignment = normalizePersonalAlignment(settings?.personalAlignment);

  if (alignment !== PERSONAL_ALIGNMENT_DEFAULT) {
    return alignment;
  }

  return template === 'executive' ? 'left' : 'center';
}

export function normalizePersonalHeaderOrder(order) {
  const requestedRows = Array.isArray(order) ? order.map(trimText).filter(Boolean) : [];
  const nextRows = [];

  requestedRows.forEach((row) => {
    if (PERSONAL_HEADER_ROWS.includes(row) && !nextRows.includes(row)) {
      nextRows.push(row);
    }
  });

  PERSONAL_HEADER_ROWS.forEach((row) => {
    if (!nextRows.includes(row)) {
      nextRows.push(row);
    }
  });

  return nextRows;
}

const DEFAULT_SECTION_BLOCKS = [
  { id: 'education', kind: 'education', title: 'Education' },
  { id: 'experience', kind: 'roles', title: 'Experience' },
  { id: 'internships', kind: 'roles', title: 'Internships' },
  { id: 'projects', kind: 'projects', title: 'Projects' },
  { id: 'skills', kind: 'skills', title: 'Skills' },
];
const SECTION_TEMPLATE_MAP = new Map(
  SECTION_TEMPLATE_GROUPS.flatMap((group) => group.templates.map((template) => [template.id, template])),
);
const ENTRY_HEADER_LAYOUT_VERSION = 1;
const ENTRY_HEADER_LAYOUT_DEFAULTS = {
  education: {
    version: ENTRY_HEADER_LAYOUT_VERSION,
    lines: [
      { left: ['school', null, null], right: [null, null, 'location'] },
      { left: ['degree', 'gpa', 'honors'], right: [null, null, 'yearsEdu'] },
    ],
  },
  roles: {
    version: ENTRY_HEADER_LAYOUT_VERSION,
    lines: [
      { left: ['company', null], right: [null, 'location'] },
      { left: ['role', null], right: [null, 'yearsExp'] },
    ],
  },
  custom: {
    version: ENTRY_HEADER_LAYOUT_VERSION,
    lines: [
      { left: ['title', null], right: [null, 'location'] },
      { left: ['subtitle', null], right: [null, 'years'] },
    ],
  },
};
const RESUME_PRESENTATION_BASES = {
  executive: {
    pageMarginInlineIn: 0.5,
    pageMarginTopIn: 0.5,
    pageMarginBottomIn: 0.5,
    nameSizeRem: 1.5,
    headingSizeRem: 0.625,
    bodySizeRem: 0.75,
    detailSizeRem: 0.6875,
    metaSizeRem: 0.6875,
    headlineSizeRem: 0.8125,
    bodyLineHeight: 1.3,
    detailLineHeight: 1.45,
    listLineHeight: 1.4,
    sectionGapPx: 12,
    sectionHeadingGapPx: 8,
    entryGapPx: 6,
    repeatedEntryGapPx: 8,
    detailGapPx: 4,
    listGapPx: 4,
  },
  compact: {
    pageMarginInlineIn: 0.4375,
    pageMarginTopIn: 0.4375,
    pageMarginBottomIn: 0.4375,
    nameSizeRem: 1.3125,
    headingSizeRem: 0.625,
    bodySizeRem: 0.75,
    detailSizeRem: 0.6875,
    metaSizeRem: 0.6875,
    headlineSizeRem: 0.8125,
    bodyLineHeight: 1.4,
    detailLineHeight: 1.4,
    listLineHeight: 1.4,
    sectionGapPx: 10,
    sectionHeadingGapPx: 8,
    entryGapPx: 6,
    repeatedEntryGapPx: 8,
    detailGapPx: 4,
    listGapPx: 4,
  },
};

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `id-${Math.random().toString(36).slice(2, 10)}`;
}

export function createWorkspaceResumeId() {
  return createId();
}

export function trimText(value) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
}

function asText(value) {
  return typeof value === 'string' ? value : '';
}

function clampNumber(value, min, max) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return min;
  }

  return Math.min(max, Math.max(min, numericValue));
}

function clampInteger(value, min, max) {
  return Math.trunc(clampNumber(value, min, max));
}

function normalizeTemplate(template) {
  return TEMPLATE_OPTIONS.some((option) => option.id === template) ? template : DEFAULT_TEMPLATE;
}

function listHasContent(items) {
  return Array.isArray(items) && items.some((item) => trimText(item) !== '');
}

function normalizeStringList(items, { minItems = 1 } = {}) {
  const nextItems = Array.isArray(items)
    ? items.map((item) => asText(item))
    : [];

  while (nextItems.length < minItems) {
    nextItems.push('');
  }

  return nextItems;
}

function moveItem(array, index, direction) {
  const targetIndex = index + direction;

  if (index < 0 || targetIndex < 0 || targetIndex >= array.length) {
    return array;
  }

  const nextItems = [...array];
  const [item] = nextItems.splice(index, 1);
  nextItems.splice(targetIndex, 0, item);
  return nextItems;
}

function moveItemToIndex(array, fromIndex, toIndex) {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= array.length ||
    toIndex >= array.length ||
    fromIndex === toIndex
  ) {
    return array;
  }

  const nextItems = [...array];
  const [item] = nextItems.splice(fromIndex, 1);
  nextItems.splice(toIndex, 0, item);
  return nextItems;
}

function moveItemById(items, itemId, direction) {
  return moveItem(items, items.findIndex((item) => item.id === itemId), direction);
}

function reorderItemSubsetById(items, orderedItemIds) {
  const requestedIds = Array.isArray(orderedItemIds) ? orderedItemIds.map(trimText).filter(Boolean) : [];
  const requestedIdSet = new Set(requestedIds);
  const itemById = new Map(items.map((item) => [item.id, item]));

  if (
    requestedIds.length === 0 ||
    requestedIdSet.size !== requestedIds.length ||
    requestedIds.some((itemId) => !itemById.has(itemId))
  ) {
    return items;
  }

  const reorderedItems = requestedIds.map((itemId) => itemById.get(itemId));
  let reorderedIndex = 0;

  return items.map((item) => {
    if (!requestedIdSet.has(item.id)) {
      return item;
    }

    const nextItem = reorderedItems[reorderedIndex];
    reorderedIndex += 1;
    return nextItem;
  });
}

function reorderItemById(items, itemId, targetItemId, placement = 'before') {
  const fromIndex = items.findIndex((item) => item.id === itemId);
  const targetIndex = items.findIndex((item) => item.id === targetItemId);

  if (fromIndex < 0 || targetIndex < 0 || itemId === targetItemId) {
    return items;
  }

  const nextItems = [...items];
  const [item] = nextItems.splice(fromIndex, 1);
  const adjustedTargetIndex = nextItems.findIndex((candidate) => candidate.id === targetItemId);
  const insertIndex = placement === 'after' ? adjustedTargetIndex + 1 : adjustedTargetIndex;
  nextItems.splice(insertIndex, 0, item);
  return nextItems;
}

function createEducationProgram(candidate = {}) {
  return {
    id: trimText(candidate.id) || createId(),
    degree: asText(candidate.degree),
    yearsEdu: asText(candidate.yearsEdu || candidate.years),
    gpa: asText(candidate.gpa),
    honors: asText(candidate.honors),
  };
}

function createEducationCustomSection(candidate = {}) {
  return {
    id: trimText(candidate.id) || createId(),
    label: asText(candidate.label || candidate.title),
    content: asText(candidate.content || candidate.details),
  };
}

export function ensureEducationCustomSections(customSections, { allowEmpty = false } = {}) {
  const sections = Array.isArray(customSections)
    ? customSections.map(createEducationCustomSection)
    : [];

  if (!allowEmpty && sections.length === 0) {
    return [createEducationCustomSection()];
  }

  return sections;
}

function createEducationEntry(candidate = {}) {
  return {
    id: trimText(candidate.id) || createId(),
    school: asText(candidate.school || candidate.institution),
    degree: asText(candidate.degree || candidate.program),
    yearsEdu: asText(candidate.yearsEdu || candidate.years || candidate.dates),
    location: asText(candidate.location),
    gpa: asText(candidate.gpa),
    honors: asText(candidate.honors),
    coursework: asText(candidate.coursework),
    awards: asText(candidate.awards),
    programs: Array.isArray(candidate.programs) ? candidate.programs.map(createEducationProgram) : [],
    customSections: ensureEducationCustomSections(candidate.customSections || candidate.details),
  };
}

function createRoleEntry(candidate = {}) {
  return {
    id: trimText(candidate.id) || createId(),
    company: asText(candidate.company || candidate.organization || candidate.employer),
    role: asText(candidate.role || candidate.title),
    location: asText(candidate.location),
    yearsExp: asText(candidate.yearsExp || candidate.years || candidate.dates),
    activities: normalizeStringList(candidate.activities || candidate.highlights),
  };
}

function createSkillsEntry(candidate = {}) {
  const items = Array.isArray(candidate.items)
    ? candidate.items.join(', ')
    : candidate.items || candidate.skills;

  return {
    id: trimText(candidate.id) || createId(),
    category: asText(candidate.category || candidate.title),
    items: asText(items),
  };
}

function createProjectEntry(candidate = {}) {
  return {
    id: trimText(candidate.id) || createId(),
    name: asText(candidate.name || candidate.title),
    subtitle: asText(candidate.subtitle || candidate.stack),
    years: asText(candidate.years || candidate.dates),
    summary: asText(candidate.summary || candidate.details),
    highlights: normalizeStringList(candidate.highlights || candidate.activities),
  };
}

function createCertificationEntry(candidate = {}) {
  return {
    id: trimText(candidate.id) || createId(),
    name: asText(candidate.name || candidate.title),
    issuer: asText(candidate.issuer || candidate.organization),
    years: asText(candidate.years || candidate.dates),
    details: asText(candidate.details || candidate.summary),
  };
}

function createLanguageEntry(candidate = {}) {
  return {
    id: trimText(candidate.id) || createId(),
    language: asText(candidate.language || candidate.name),
    proficiency: asText(candidate.proficiency || candidate.level),
  };
}

function createAwardEntry(candidate = {}) {
  return {
    id: trimText(candidate.id) || createId(),
    title: asText(candidate.title || candidate.name),
    issuer: asText(candidate.issuer || candidate.organization),
    years: asText(candidate.years || candidate.dates),
    details: asText(candidate.details || candidate.summary),
  };
}

function createPublicationEntry(candidate = {}) {
  return {
    id: trimText(candidate.id) || createId(),
    title: asText(candidate.title || candidate.name),
    publisher: asText(candidate.publisher || candidate.issuer),
    years: asText(candidate.years || candidate.dates),
    details: asText(candidate.details || candidate.summary),
  };
}

function createCustomEntry(candidate = {}) {
  return {
    id: trimText(candidate.id) || createId(),
    title: asText(candidate.title || candidate.name),
    subtitle: asText(candidate.subtitle),
    location: asText(candidate.location),
    years: asText(candidate.years || candidate.dates),
    details: asText(candidate.details || candidate.summary),
    highlights: normalizeStringList(candidate.highlights || candidate.activities),
  };
}

function createEntryForKind(kind, candidate = {}) {
  if (kind === 'education') {
    return createEducationEntry(candidate);
  }

  if (kind === 'roles') {
    return createRoleEntry(candidate);
  }

  if (kind === 'skills') {
    return createSkillsEntry(candidate);
  }

  if (kind === 'projects') {
    return createProjectEntry(candidate);
  }

  if (kind === 'certifications') {
    return createCertificationEntry(candidate);
  }

  if (kind === 'languages') {
    return createLanguageEntry(candidate);
  }

  if (kind === 'awards') {
    return createAwardEntry(candidate);
  }

  if (kind === 'publications') {
    return createPublicationEntry(candidate);
  }

  return createCustomEntry(candidate);
}

function normalizeSectionKind(kind) {
  return SECTION_BLOCK_KINDS.includes(kind) ? kind : 'custom';
}

function cloneEntryHeaderLayout(layout) {
  return {
    version: ENTRY_HEADER_LAYOUT_VERSION,
    lines: [0, 1].map((lineIndex) => ({
      left: (Array.isArray(layout?.lines?.[lineIndex]?.left) ? layout.lines[lineIndex].left : [null, null])
        .map((field) => field ?? null),
      right: (Array.isArray(layout?.lines?.[lineIndex]?.right) ? layout.lines[lineIndex].right : [null, null])
        .map((field) => field ?? null),
    })),
  };
}

export function getDefaultEntryHeaderLayout(sectionKind) {
  const kind = normalizeSectionKind(sectionKind);
  const defaultLayout = ENTRY_HEADER_LAYOUT_DEFAULTS[kind];

  return defaultLayout ? cloneEntryHeaderLayout(defaultLayout) : null;
}

function getEntryHeaderLayoutFields(sectionKind) {
  return ENTRY_HEADER_LAYOUT_FIELDS[normalizeSectionKind(sectionKind)] || [];
}

function getEntryHeaderLayoutSlot(layout, slot) {
  const lineIndex = Number(slot?.lineIndex);
  const slotIndex = Number(slot?.slotIndex);
  const side = slot?.side === 'right' ? 'right' : 'left';
  const slots = layout?.lines?.[lineIndex]?.[side];

  if (
    !Number.isInteger(lineIndex) ||
    !Number.isInteger(slotIndex) ||
    lineIndex < 0 ||
    lineIndex > 1 ||
    !Array.isArray(slots) ||
    slotIndex < 0 ||
    slotIndex >= slots.length
  ) {
    return undefined;
  }

  return slots[slotIndex];
}

function setEntryHeaderLayoutSlot(layout, slot, value) {
  const lineIndex = Number(slot?.lineIndex);
  const slotIndex = Number(slot?.slotIndex);
  const side = slot?.side === 'right' ? 'right' : 'left';
  const slots = layout?.lines?.[lineIndex]?.[side];

  if (
    !Number.isInteger(lineIndex) ||
    !Number.isInteger(slotIndex) ||
    lineIndex < 0 ||
    lineIndex > 1 ||
    !Array.isArray(slots) ||
    slotIndex < 0 ||
    slotIndex >= slots.length
  ) {
    return layout;
  }

  const nextLayout = cloneEntryHeaderLayout(layout);
  nextLayout.lines[lineIndex][side][slotIndex] = value || null;
  return nextLayout;
}

export function normalizeEntryHeaderLayout(sectionKind, layout) {
  const fields = getEntryHeaderLayoutFields(sectionKind);
  const defaultLayout = getDefaultEntryHeaderLayout(sectionKind);

  if (!defaultLayout) {
    return null;
  }

  const fieldSet = new Set(fields);
  const usedFields = new Set();
  let normalizedLayout = {
    version: ENTRY_HEADER_LAYOUT_VERSION,
    lines: [0, 1].map((lineIndex) => ({
      left: defaultLayout.lines[lineIndex].left.map((_, slotIndex) => {
        const field = layout?.lines?.[lineIndex]?.left?.[slotIndex];

        if (!fieldSet.has(field) || usedFields.has(field)) {
          return null;
        }

        usedFields.add(field);
        return field;
      }),
      right: defaultLayout.lines[lineIndex].right.map((_, slotIndex) => {
        const field = layout?.lines?.[lineIndex]?.right?.[slotIndex];

        if (!fieldSet.has(field) || usedFields.has(field)) {
          return null;
        }

        usedFields.add(field);
        return field;
      }),
    })),
  };

  fields
    .filter((field) => !usedFields.has(field))
    .forEach((field) => {
      const defaultSlot = findEntryHeaderFieldSlot(defaultLayout, field);
      const targetSlot = defaultSlot && getEntryHeaderLayoutSlot(normalizedLayout, defaultSlot) === null
        ? defaultSlot
        : findEmptyEntryHeaderSlot(normalizedLayout);

      if (targetSlot) {
        normalizedLayout = setEntryHeaderLayoutSlot(normalizedLayout, targetSlot, field);
        usedFields.add(field);
      }
    });

  return normalizedLayout;
}

export function findEntryHeaderFieldSlot(layout, field) {
  for (let lineIndex = 0; lineIndex < 2; lineIndex += 1) {
    for (const side of ['left', 'right']) {
      const slots = layout?.lines?.[lineIndex]?.[side] || [];

      for (let slotIndex = 0; slotIndex < slots.length; slotIndex += 1) {
        if (layout?.lines?.[lineIndex]?.[side]?.[slotIndex] === field) {
          return { lineIndex, side, slotIndex };
        }
      }
    }
  }

  return null;
}

function findEmptyEntryHeaderSlot(layout) {
  for (let lineIndex = 0; lineIndex < 2; lineIndex += 1) {
    for (const side of ['left', 'right']) {
      const slots = layout?.lines?.[lineIndex]?.[side] || [];

      for (let slotIndex = 0; slotIndex < slots.length; slotIndex += 1) {
        if (!layout?.lines?.[lineIndex]?.[side]?.[slotIndex]) {
          return { lineIndex, side, slotIndex };
        }
      }
    }
  }

  return null;
}

export function moveSectionHeaderField(layout, fromSlot, toSlot) {
  const fromField = getEntryHeaderLayoutSlot(layout, fromSlot);

  if (!fromField) {
    return cloneEntryHeaderLayout(layout);
  }

  const toField = getEntryHeaderLayoutSlot(layout, toSlot) || null;
  let nextLayout = setEntryHeaderLayoutSlot(layout, fromSlot, toField);
  nextLayout = setEntryHeaderLayoutSlot(nextLayout, toSlot, fromField);

  return nextLayout;
}

function createSectionId(kind, title, index = 0) {
  const base = trimText(title)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || kind
    || 'section';
  return index > 0 ? `${base}-${index + 1}` : base;
}

function uniqueSectionId(rawId, usedIds, kind, title, index) {
  let baseId = trimText(rawId) || createSectionId(kind, title, index);

  if (baseId === 'personal') {
    baseId = createSectionId(kind, title, index);
  }

  let nextId = baseId;
  let suffix = 2;

  while (usedIds.has(nextId) || nextId === 'personal') {
    nextId = `${baseId}-${suffix}`;
    suffix += 1;
  }

  usedIds.add(nextId);
  return nextId;
}

function getSectionTemplate(templateId) {
  const template = SECTION_TEMPLATE_MAP.get(trimText(templateId));

  if (template) {
    return template;
  }

  return SECTION_TEMPLATE_MAP.get('custom-section');
}

function createUniqueSectionTitle(sections, title) {
  const baseTitle = trimText(title) || 'Custom Section';
  const existingTitles = new Set(
    sections.map((section) => trimText(section.title).toLowerCase()).filter(Boolean),
  );

  if (!existingTitles.has(baseTitle.toLowerCase())) {
    return baseTitle;
  }

  let suffix = 2;

  while (existingTitles.has(`${baseTitle} ${suffix}`.toLowerCase())) {
    suffix += 1;
  }

  return `${baseTitle} ${suffix}`;
}

function normalizeSectionBlock(section, index, usedIds) {
  const kind = normalizeSectionKind(section?.kind);
  const defaultBlock = DEFAULT_SECTION_BLOCKS[index] || {};
  const hasExplicitTitle = section && typeof section === 'object' && Object.hasOwn(section, 'title');
  const title = trimText(section?.title) || (
    hasExplicitTitle
      ? UNTITLED_SECTION_TITLE
      : defaultBlock.title || (kind === 'roles' ? 'Experience' : 'Custom')
  );
  const entries = Array.isArray(section?.entries) ? section.entries : [];

  const normalizedSection = {
    id: uniqueSectionId(section?.id, usedIds, kind, title, index),
    kind,
    title,
    entries: entries.length > 0 ? entries.map((entry) => createEntryForKind(kind, entry)) : [createEntryForKind(kind)],
  };

  const entryHeaderLayout = normalizeEntryHeaderLayout(kind, section?.entryHeaderLayout);

  return entryHeaderLayout
    ? {
      ...normalizedSection,
      entryHeaderLayout,
    }
    : normalizedSection;
}

export function normalizeResumeSettings(settings) {
  return Object.fromEntries(
    Object.keys(RESUME_SETTINGS_DEFAULTS).map((key) => {
      if (key === 'personalContactOrder') {
        return [
          key,
          normalizePersonalContactOrder(settings?.[key] ?? RESUME_SETTINGS_DEFAULTS[key]),
        ];
      }

      if (key === 'personalHeaderOrder') {
        return [
          key,
          normalizePersonalHeaderOrder(settings?.[key] ?? RESUME_SETTINGS_DEFAULTS[key]),
        ];
      }

      if (key === 'personalAlignment') {
        return [
          key,
          normalizePersonalAlignment(settings?.[key] ?? RESUME_SETTINGS_DEFAULTS[key]),
        ];
      }

      if (key === 'sectionSeparatorPosition') {
        return [
          key,
          normalizeSectionSeparatorPosition(settings?.[key] ?? RESUME_SETTINGS_DEFAULTS[key]),
        ];
      }

      const [min, max] = SETTING_RANGES[key] || [RESUME_SETTINGS_MIN, RESUME_SETTINGS_MAX];

      return [
        key,
        clampInteger(settings?.[key] ?? RESUME_SETTINGS_DEFAULTS[key], min, max),
      ];
    }),
  );
}

export function normalizeSampleDisplay(sampleDisplay) {
  const display = sampleDisplay && typeof sampleDisplay === 'object' ? sampleDisplay : {};

  return {
    hasStarted: Boolean(display.hasStarted),
    showInformation: display.showInformation === false ? false : true,
    entryBindings: normalizeSampleEntryBindings(display.entryBindings),
  };
}

function normalizeSampleEntryBindings(entryBindings) {
  if (!entryBindings || typeof entryBindings !== 'object' || Array.isArray(entryBindings)) {
    return {};
  }

  const nextBindings = {};

  Object.entries(entryBindings).forEach(([rawSectionId, sectionBindings]) => {
    const sectionId = trimText(rawSectionId);

    if (
      !sectionId ||
      sectionId.length > 100 ||
      !sectionBindings ||
      typeof sectionBindings !== 'object' ||
      Array.isArray(sectionBindings)
    ) {
      return;
    }

    const entryBindingsById = {};

    Object.entries(sectionBindings).forEach(([rawEntryId, rawSourceIndex]) => {
      const entryId = trimText(rawEntryId);
      const sourceIndex = Number(rawSourceIndex);

      if (
        !entryId ||
        entryId.length > 160 ||
        !Number.isInteger(sourceIndex) ||
        sourceIndex < 0 ||
        sourceIndex > 99
      ) {
        return;
      }

      entryBindingsById[entryId] = sourceIndex;
    });

    if (Object.keys(entryBindingsById).length > 0) {
      nextBindings[sectionId] = entryBindingsById;
    }
  });

  return nextBindings;
}

function isValidSampleSourceIndex(sourceIndex) {
  return Number.isInteger(sourceIndex) && sourceIndex >= 0 && sourceIndex <= 99;
}

function canInferSampleEntryBindings(normalizedResume, section) {
  return (
    normalizedResume.sampleDisplay.showInformation &&
    section?.kind === 'roles' &&
    /experience|work|career/i.test(`${section.id} ${section.title}`)
  );
}

function inferSectionSampleEntryBindings(normalizedResume, section) {
  const currentBindings = normalizedResume.sampleDisplay.entryBindings?.[section.id] || {};
  const shouldInfer = canInferSampleEntryBindings(normalizedResume, section);
  const nextBindings = {};

  (Array.isArray(section?.entries) ? section.entries : []).forEach((entry, index) => {
    const entryId = trimText(entry.id);

    if (!entryId) {
      return;
    }

    const currentSourceIndex = currentBindings[entryId];

    if (isValidSampleSourceIndex(currentSourceIndex)) {
      nextBindings[entryId] = currentSourceIndex;
      return;
    }

    if (shouldInfer && index <= 99) {
      nextBindings[entryId] = index;
    }
  });

  return nextBindings;
}

function applySectionSampleEntryBindings(
  normalizedResume,
  sectionId,
  orderedEntries,
  incomingBindings = {},
  inferredSectionBindings = null,
) {
  const section = normalizedResume.sections.find((candidateSection) => candidateSection.id === sectionId);

  if (!section) {
    return normalizedResume;
  }

  const fallbackSectionBindings = inferredSectionBindings || inferSectionSampleEntryBindings(normalizedResume, section);
  const nextSectionBindings = {};

  (Array.isArray(orderedEntries) ? orderedEntries : []).forEach((entry) => {
    const entryId = trimText(entry.id);
    const sourceIndex = isValidSampleSourceIndex(incomingBindings[entryId])
      ? incomingBindings[entryId]
      : fallbackSectionBindings[entryId];

    if (entryId && isValidSampleSourceIndex(sourceIndex)) {
      nextSectionBindings[entryId] = sourceIndex;
    }
  });

  const nextEntryBindings = {
    ...normalizedResume.sampleDisplay.entryBindings,
  };

  if (Object.keys(nextSectionBindings).length > 0) {
    nextEntryBindings[sectionId] = nextSectionBindings;
  } else {
    delete nextEntryBindings[sectionId];
  }

  return {
    ...normalizedResume,
    sampleDisplay: normalizeSampleDisplay({
      ...normalizedResume.sampleDisplay,
      entryBindings: nextEntryBindings,
    }),
  };
}

export function createPersonal(candidate = {}) {
  return {
    name: asText(candidate.name),
    headline: asText(candidate.headline),
    location: asText(candidate.location),
    phone: asText(candidate.phone),
    email: asText(candidate.email),
    linkedinUrl: asText(candidate.linkedinUrl),
    portfolioUrl: asText(candidate.portfolioUrl),
    githubUrl: asText(candidate.githubUrl),
    customField: asText(candidate.customField),
    aboutMe: asText(candidate.aboutMe || candidate.summary),
  };
}

export function createDefaultSections() {
  return DEFAULT_SECTION_BLOCKS.map((section) => ({
    ...section,
    entries: [createEntryForKind(section.kind)],
  }));
}

export function createResumeSectionBlock(resume, templateId) {
  const normalizedResume = normalizeResume(resume);

  if (normalizedResume.sections.length >= MAX_RESUME_SECTIONS) {
    return null;
  }

  const template = getSectionTemplate(templateId);
  const kind = normalizeSectionKind(template.kind);
  const title = createUniqueSectionTitle(normalizedResume.sections, template.title);
  const usedIds = new Set(normalizedResume.sections.map((section) => section.id));

  return normalizeSectionBlock({
    id: createSectionId(kind, title),
    kind,
    title,
    entries: [createEntryForKind(kind)],
  }, normalizedResume.sections.length, usedIds);
}

export function addResumeSectionBlock(resume, templateId) {
  const normalizedResume = normalizeResume(resume);
  const section = createResumeSectionBlock(normalizedResume, templateId);

  if (!section) {
    return {
      resume: normalizedResume,
      sectionId: '',
    };
  }

  return {
    resume: {
      ...normalizedResume,
      sections: [...normalizedResume.sections, section],
    },
    sectionId: section.id,
  };
}

export function createEmptyResume() {
  return {
    personal: createPersonal(),
    settings: normalizeResumeSettings(),
    sampleDisplay: normalizeSampleDisplay(),
    sections: createDefaultSections(),
  };
}

export function normalizeResume(candidate) {
  const resume = candidate && typeof candidate === 'object' ? candidate : {};
  const usedIds = new Set();
  const sections = Array.isArray(resume.sections) && resume.sections.length > 0
    ? resume.sections.map((section, index) => normalizeSectionBlock(section, index, usedIds))
    : createDefaultSections();

  return {
    personal: createPersonal(resume.personal),
    settings: normalizeResumeSettings(resume.settings),
    sampleDisplay: normalizeSampleDisplay(resume.sampleDisplay),
    sections,
  };
}

export function normalizeDraftPayload(candidate = {}) {
  const draft = candidate && typeof candidate === 'object' ? candidate : {};

  return {
    version: 3,
    savedAt: typeof draft.savedAt === 'string' ? draft.savedAt : null,
    template: normalizeTemplate(draft.template),
    localRevision: typeof draft.localRevision === 'string' ? draft.localRevision : '',
    resume: normalizeResume(draft.resume),
  };
}

export function createDraftPayload({ resume, template, savedAt = new Date().toISOString(), localRevision = '' } = {}) {
  return {
    version: 3,
    savedAt,
    template: normalizeTemplate(template),
    localRevision,
    resume: normalizeResume(resume),
  };
}

export function createResumeStorageKey(resumeId) {
  return `${RESUME_STORAGE_KEY_PREFIX}${resumeId}`;
}

export function sanitizeWorkspaceResumeName(value, fallback = '') {
  const nextName = trimText(value).slice(0, MAX_WORKSPACE_RESUME_NAME_LENGTH).trim();

  if (nextName) {
    return nextName;
  }

  return trimText(fallback).slice(0, MAX_WORKSPACE_RESUME_NAME_LENGTH).trim();
}

export function createWorkspaceResumeMeta(name = DEFAULT_RESUME_LABEL, updatedAt = '') {
  return {
    name: sanitizeWorkspaceResumeName(name, DEFAULT_RESUME_LABEL),
    updatedAt: typeof updatedAt === 'string' ? updatedAt : '',
  };
}

export function normalizeWorkspaceIndex(candidate = {}) {
  const rawResumeIds = Array.isArray(candidate?.resumeIds) ? candidate.resumeIds : [];
  const resumeIds = [...new Set(rawResumeIds.map(trimText).filter(Boolean))].slice(0, MAX_WORKSPACE_RESUMES);
  const meta = {};

  resumeIds.forEach((resumeId, index) => {
    meta[resumeId] = createWorkspaceResumeMeta(
      candidate?.meta?.[resumeId]?.name || `${DEFAULT_RESUME_LABEL} ${index + 1}`,
      candidate?.meta?.[resumeId]?.updatedAt || '',
    );
  });

  return {
    activeResumeId: resumeIds.includes(candidate?.activeResumeId) ? candidate.activeResumeId : (resumeIds[0] || ''),
    resumeIds,
    meta,
  };
}

export function createFreshWorkspaceDraft() {
  const resumeId = createWorkspaceResumeId();
  const draft = createDraftPayload({
    resume: createEmptyResume(),
    template: DEFAULT_TEMPLATE,
    savedAt: null,
  });
  const workspace = normalizeWorkspaceIndex({
    activeResumeId: resumeId,
    resumeIds: [resumeId],
    meta: {
      [resumeId]: createWorkspaceResumeMeta('Resume 1', ''),
    },
  });

  return {
    workspace,
    activeResumeId: resumeId,
    draft,
  };
}

export function createNextResumeName(existingNames = []) {
  const names = new Set(existingNames.map((name) => trimText(name).toLowerCase()));
  let index = 1;

  while (names.has(`${DEFAULT_RESUME_LABEL} ${index}`.toLowerCase())) {
    index += 1;
  }

  return `${DEFAULT_RESUME_LABEL} ${index}`;
}

export function createDuplicateResumeName(sourceName = DEFAULT_RESUME_LABEL, existingNames = []) {
  const baseName = sanitizeWorkspaceResumeName(sourceName, DEFAULT_RESUME_LABEL);
  const names = new Set(existingNames.map((name) => trimText(name).toLowerCase()));
  const firstCopy = sanitizeWorkspaceResumeName(`${baseName} copy`, `${DEFAULT_RESUME_LABEL} copy`);

  if (!names.has(firstCopy.toLowerCase())) {
    return firstCopy;
  }

  let index = 2;

  while (index < 1000) {
    const copyName = sanitizeWorkspaceResumeName(`${baseName} copy ${index}`, `${DEFAULT_RESUME_LABEL} copy ${index}`);

    if (!names.has(copyName.toLowerCase())) {
      return copyName;
    }

    index += 1;
  }

  return sanitizeWorkspaceResumeName(`${DEFAULT_RESUME_LABEL} copy ${Date.now()}`, DEFAULT_RESUME_LABEL);
}

export function reorderWorkspaceResumes(workspace, sourceResumeId, targetResumeId, placement = 'before') {
  const normalizedWorkspace = normalizeWorkspaceIndex(workspace);
  const resumeIds = reorderItemById(
    normalizedWorkspace.resumeIds.map((id) => ({ id })),
    sourceResumeId,
    targetResumeId,
    placement,
  ).map((item) => item.id);

  return normalizeWorkspaceIndex({
    ...normalizedWorkspace,
    resumeIds,
  });
}

export function reorderWorkspaceResumesToMatch(workspace, orderedResumeIds) {
  const normalizedWorkspace = normalizeWorkspaceIndex(workspace);
  const requestedIds = Array.isArray(orderedResumeIds) ? orderedResumeIds : [];
  const existingIds = new Set(normalizedWorkspace.resumeIds);
  const nextIds = [
    ...requestedIds.filter((id) => existingIds.has(id)),
    ...normalizedWorkspace.resumeIds.filter((id) => !requestedIds.includes(id)),
  ];

  return normalizeWorkspaceIndex({
    ...normalizedWorkspace,
    resumeIds: nextIds,
  });
}

function updateSection(resume, sectionId, updater) {
  const normalizedResume = normalizeResume(resume);

  return {
    ...normalizedResume,
    sections: normalizedResume.sections.map((section) => (
      section.id === sectionId ? updater(section) : section
    )),
  };
}

function updateEntry(entries, entryId, updater) {
  return entries.map((entry) => (entry.id === entryId ? updater(entry) : entry));
}

export function updatePersonalField(resume, field, value) {
  return {
    ...normalizeResume(resume),
    personal: {
      ...normalizeResume(resume).personal,
      [field]: asText(value),
    },
  };
}

export function updateResumeSetting(resume, settingId, delta) {
  const normalizedResume = normalizeResume(resume);
  const currentValue = normalizedResume.settings[settingId] ?? 0;

  if (
    !Object.hasOwn(RESUME_SETTINGS_DEFAULTS, settingId) ||
    SETTING_RANGES[settingId] ||
    settingId === 'sectionSeparatorPosition' ||
    settingId === 'personalContactOrder' ||
    settingId === 'personalAlignment' ||
    settingId === 'personalHeaderOrder'
  ) {
    return normalizedResume;
  }

  return {
    ...normalizedResume,
    settings: {
      ...normalizedResume.settings,
      [settingId]: clampInteger(currentValue + delta, RESUME_SETTINGS_MIN, RESUME_SETTINGS_MAX),
    },
  };
}

export function setResumeSummaryWidthPercent(resume, widthPercent) {
  const normalizedResume = normalizeResume(resume);

  return {
    ...normalizedResume,
    settings: {
      ...normalizedResume.settings,
      summaryWidthPercent: clampInteger(widthPercent, SUMMARY_WIDTH_MIN, SUMMARY_WIDTH_MAX),
    },
  };
}

export function setResumeSettingValue(resume, settingId, value) {
  const normalizedResume = normalizeResume(resume);

  if (!Object.hasOwn(RESUME_SETTINGS_DEFAULTS, settingId)) {
    return normalizedResume;
  }

  if (settingId === 'personalContactOrder') {
    return setPersonalContactOrder(normalizedResume, value);
  }

  if (settingId === 'personalHeaderOrder') {
    return setPersonalHeaderOrder(normalizedResume, value);
  }

  if (settingId === 'personalAlignment') {
    return {
      ...normalizedResume,
      settings: {
        ...normalizedResume.settings,
        personalAlignment: normalizePersonalAlignment(value),
      },
    };
  }

  if (settingId === 'sectionSeparatorPosition') {
    return {
      ...normalizedResume,
      settings: {
        ...normalizedResume.settings,
        sectionSeparatorPosition: normalizeSectionSeparatorPosition(value),
      },
    };
  }

  const [min, max] = SETTING_RANGES[settingId] || [RESUME_SETTINGS_MIN, RESUME_SETTINGS_MAX];

  return {
    ...normalizedResume,
    settings: {
      ...normalizedResume.settings,
      [settingId]: clampInteger(value, min, max),
    },
  };
}

export function setPersonalContactOrder(resume, orderedFields) {
  const normalizedResume = normalizeResume(resume);
  const requestedFields = Array.isArray(orderedFields)
    ? orderedFields.map(trimText).filter(Boolean)
    : [];
  const requestedFieldSet = new Set(requestedFields);

  if (
    requestedFields.length === 0 ||
    requestedFieldSet.size !== requestedFields.length ||
    requestedFields.some((field) => !PERSONAL_CONTACT_FIELDS.includes(field))
  ) {
    return normalizedResume;
  }

  const nextOrder = normalizePersonalContactOrder([
    ...requestedFields,
    ...normalizedResume.settings.personalContactOrder.filter((field) => !requestedFieldSet.has(field)),
  ]);

  return {
    ...normalizedResume,
    settings: {
      ...normalizedResume.settings,
      personalContactOrder: nextOrder,
    },
  };
}

export function setPersonalHeaderOrder(resume, orderedRows) {
  const normalizedResume = normalizeResume(resume);
  const requestedRows = Array.isArray(orderedRows)
    ? orderedRows.map(trimText).filter(Boolean)
    : [];
  const requestedRowSet = new Set(requestedRows);

  if (
    requestedRows.length === 0 ||
    requestedRowSet.size !== requestedRows.length ||
    requestedRows.some((row) => !PERSONAL_HEADER_ROWS.includes(row))
  ) {
    return normalizedResume;
  }

  return {
    ...normalizedResume,
    settings: {
      ...normalizedResume.settings,
      personalHeaderOrder: normalizePersonalHeaderOrder(requestedRows),
    },
  };
}

export function setSectionEntryHeaderLayout(resume, sectionId, layout) {
  return updateSection(resume, sectionId, (section) => {
    const entryHeaderLayout = normalizeEntryHeaderLayout(section.kind, layout);

    return entryHeaderLayout
      ? {
        ...section,
        entryHeaderLayout,
      }
      : section;
  });
}

export function updateSampleDisplay(resume, updates = {}) {
  const normalizedResume = normalizeResume(resume);

  return {
    ...normalizedResume,
    sampleDisplay: normalizeSampleDisplay({
      ...normalizedResume.sampleDisplay,
      ...updates,
    }),
  };
}

export function updateSectionTitle(resume, sectionId, value) {
  return updateSection(resume, sectionId, (section) => ({
    ...section,
    title: asText(value),
  }));
}

export function commitSectionTitle(resume, sectionId) {
  return updateSection(resume, sectionId, (section) => ({
    ...section,
    title: trimText(section.title) || UNTITLED_SECTION_TITLE,
  }));
}

export function removeResumeSectionBlock(resume, sectionId) {
  const normalizedResume = normalizeResume(resume);
  const nextSections = normalizedResume.sections.filter((section) => section.id !== sectionId);

  if (nextSections.length === 0) {
    return normalizedResume;
  }

  return {
    ...normalizedResume,
    sections: nextSections,
  };
}

export function moveResumeSectionBlock(resume, sectionId, direction) {
  const normalizedResume = normalizeResume(resume);

  return {
    ...normalizedResume,
    sections: moveItemById(normalizedResume.sections, sectionId, direction),
  };
}

export function reorderResumeSectionBlock(resume, sectionId, targetSectionId, placement = 'before') {
  const normalizedResume = normalizeResume(resume);

  return {
    ...normalizedResume,
    sections: reorderItemById(normalizedResume.sections, sectionId, targetSectionId, placement),
  };
}

export function reorderResumeSectionBlocksToMatch(resume, orderedSectionIds) {
  const normalizedResume = normalizeResume(resume);
  const nextSections = reorderItemSubsetById(
    normalizedResume.sections,
    Array.isArray(orderedSectionIds) ? orderedSectionIds.filter((sectionId) => sectionId !== 'personal') : [],
  );

  return {
    ...normalizedResume,
    sections: nextSections,
  };
}

export function reorderSectionBlockEntriesToMatch(resume, sectionId, orderedEntryIds) {
  const normalizedResume = normalizeResume(resume);
  let didUpdateSection = false;
  let nextSectionEntries = [];
  let nextSectionBindings = {};
  const nextSections = normalizedResume.sections.map((section) => {
    if (section.id !== sectionId) {
      return section;
    }

    const inferredBindings = inferSectionSampleEntryBindings(normalizedResume, section);
    const entries = reorderItemSubsetById(section.entries, orderedEntryIds);
    nextSectionEntries = entries;
    nextSectionBindings = inferredBindings;
    didUpdateSection = true;

    return {
      ...section,
      entries,
    };
  });

  if (!didUpdateSection) {
    return normalizedResume;
  }

  return applySectionSampleEntryBindings({
    ...normalizedResume,
    sections: nextSections,
  }, sectionId, nextSectionEntries, {}, nextSectionBindings);
}

export function materializeAndReorderSectionBlockEntries(
  resume,
  sectionId,
  orderedEntryIds,
  sampleEntryBindings = {},
) {
  const normalizedResume = normalizeResume(resume);
  const requestedIds = Array.isArray(orderedEntryIds)
    ? orderedEntryIds.map(trimText).filter(Boolean)
    : [];
  const requestedIdSet = new Set(requestedIds);

  if (requestedIds.length === 0 || requestedIdSet.size !== requestedIds.length) {
    return normalizedResume;
  }

  const normalizedIncomingBindings = normalizeSampleEntryBindings({
    [sectionId]: sampleEntryBindings,
  })[sectionId] || {};
  let didUpdateSection = false;
  let nextSectionEntryIds = [];
  let fallbackSectionBindings = {};

  const nextSections = normalizedResume.sections.map((section) => {
    if (section.id !== sectionId) {
      return section;
    }

    fallbackSectionBindings = inferSectionSampleEntryBindings(normalizedResume, section);
    const entryById = new Map(section.entries.map((entry) => [entry.id, entry]));
    const nextEntries = [...section.entries];

    requestedIds.forEach((entryId) => {
      if (entryById.has(entryId)) {
        return;
      }

      const entry = createEntryForKind(section.kind, { id: entryId });
      entryById.set(entryId, entry);
      nextEntries.push(entry);
    });

    const reorderedEntries = reorderItemSubsetById(nextEntries, requestedIds);
    nextSectionEntryIds = reorderedEntries.map((entry) => entry.id).filter(Boolean);
    didUpdateSection = true;

    return {
      ...section,
      entries: reorderedEntries,
    };
  });

  if (!didUpdateSection) {
    return normalizedResume;
  }

  return applySectionSampleEntryBindings({
    ...normalizedResume,
    sections: nextSections,
  }, sectionId, nextSectionEntryIds.map((entryId) => ({ id: entryId })), normalizedIncomingBindings, fallbackSectionBindings);
}

export function updateSectionBlockEntry(resume, sectionId, entryId, field, value) {
  return updateSection(resume, sectionId, (section) => ({
    ...section,
    entries: updateEntry(section.entries, entryId, (entry) => ({
      ...entry,
      [field]: asText(value),
    })),
  }));
}

export function addSectionBlockEntry(resume, sectionId) {
  return updateSection(resume, sectionId, (section) => ({
    ...section,
    entries: [...section.entries, createEntryForKind(section.kind)],
  }));
}

export function moveSectionBlockEntry(resume, sectionId, entryId, direction) {
  const normalizedResume = normalizeResume(resume);
  const section = normalizedResume.sections.find((candidateSection) => candidateSection.id === sectionId);

  if (!section) {
    return normalizedResume;
  }

  const entries = moveItemById(section.entries, entryId, direction);

  if (entries === section.entries) {
    return normalizedResume;
  }

  return reorderSectionBlockEntriesToMatch(
    normalizedResume,
    sectionId,
    entries.map((entry) => entry.id),
  );
}

export function removeSectionBlockEntry(resume, sectionId, entryId) {
  return updateSection(resume, sectionId, (section) => {
    const nextEntries = section.entries.filter((entry) => entry.id !== entryId);

    return {
      ...section,
      entries: nextEntries.length > 0 ? nextEntries : section.entries,
    };
  });
}

export const updateRoleBlockEntry = updateSectionBlockEntry;
export const addRoleBlockEntry = addSectionBlockEntry;
export const moveRoleBlockEntry = moveSectionBlockEntry;
export const removeRoleBlockEntry = removeSectionBlockEntry;

export function updateSectionBlockTextList(resume, sectionId, entryId, field, itemIndex, value) {
  return updateSection(resume, sectionId, (section) => ({
    ...section,
    entries: updateEntry(section.entries, entryId, (entry) => {
      const items = normalizeStringList(entry[field]);
      const nextItems = [...items];
      nextItems[itemIndex] = asText(value);

      return {
        ...entry,
        [field]: nextItems,
      };
    }),
  }));
}

export function addSectionBlockTextListItem(resume, sectionId, entryId, field) {
  return updateSection(resume, sectionId, (section) => ({
    ...section,
    entries: updateEntry(section.entries, entryId, (entry) => ({
      ...entry,
      [field]: [...normalizeStringList(entry[field]), ''],
    })),
  }));
}

export function moveSectionBlockTextListItem(resume, sectionId, entryId, field, itemIndex, direction) {
  return updateSection(resume, sectionId, (section) => ({
    ...section,
    entries: updateEntry(section.entries, entryId, (entry) => ({
      ...entry,
      [field]: moveItem(normalizeStringList(entry[field]), itemIndex, direction),
    })),
  }));
}

export function reorderSectionBlockTextListItem(resume, sectionId, entryId, field, fromIndex, toIndex) {
  return updateSection(resume, sectionId, (section) => ({
    ...section,
    entries: updateEntry(section.entries, entryId, (entry) => {
      const items = normalizeStringList(entry[field]);

      return {
        ...entry,
        [field]: moveItemToIndex(items, fromIndex, toIndex),
      };
    }),
  }));
}

export function removeSectionBlockTextListItem(resume, sectionId, entryId, field, itemIndex) {
  return updateSection(resume, sectionId, (section) => ({
    ...section,
    entries: updateEntry(section.entries, entryId, (entry) => {
      const nextItems = normalizeStringList(entry[field]).filter((_, index) => index !== itemIndex);

      return {
        ...entry,
        [field]: nextItems.length > 0 ? nextItems : [''],
      };
    }),
  }));
}

export const updateRoleBlockActivity = (resume, sectionId, entryId, activityIndex, value) => (
  updateSectionBlockTextList(resume, sectionId, entryId, 'activities', activityIndex, value)
);
export const addRoleBlockActivity = (resume, sectionId, entryId) => (
  addSectionBlockTextListItem(resume, sectionId, entryId, 'activities')
);
export const moveRoleBlockActivity = (resume, sectionId, entryId, activityIndex, direction) => (
  moveSectionBlockTextListItem(resume, sectionId, entryId, 'activities', activityIndex, direction)
);
export const removeRoleBlockActivity = (resume, sectionId, entryId, activityIndex) => (
  removeSectionBlockTextListItem(resume, sectionId, entryId, 'activities', activityIndex)
);

export function updateSectionBlockEducationCustomSection(resume, sectionId, entryId, sectionIndex, field, value) {
  return updateSection(resume, sectionId, (section) => ({
    ...section,
    entries: updateEntry(section.entries, entryId, (entry) => {
      const customSections = ensureEducationCustomSections(entry.customSections);
      const nextSections = customSections.map((customSection, index) => (
        index === sectionIndex ? { ...customSection, [field]: asText(value) } : customSection
      ));

      return {
        ...entry,
        customSections: nextSections,
      };
    }),
  }));
}

export function addSectionBlockEducationCustomSection(resume, sectionId, entryId) {
  return updateSection(resume, sectionId, (section) => ({
    ...section,
    entries: updateEntry(section.entries, entryId, (entry) => ({
      ...entry,
      customSections: [...ensureEducationCustomSections(entry.customSections), createEducationCustomSection()],
    })),
  }));
}

export function moveSectionBlockEducationCustomSection(resume, sectionId, entryId, sectionIndex, direction) {
  return updateSection(resume, sectionId, (section) => ({
    ...section,
    entries: updateEntry(section.entries, entryId, (entry) => ({
      ...entry,
      customSections: moveItem(ensureEducationCustomSections(entry.customSections), sectionIndex, direction),
    })),
  }));
}

export function removeSectionBlockEducationCustomSection(resume, sectionId, entryId, sectionIndex) {
  return updateSection(resume, sectionId, (section) => ({
    ...section,
    entries: updateEntry(section.entries, entryId, (entry) => {
      const nextSections = ensureEducationCustomSections(entry.customSections).filter((_, index) => index !== sectionIndex);

      return {
        ...entry,
        customSections: nextSections.length > 0 ? nextSections : [createEducationCustomSection()],
      };
    }),
  }));
}

export function updateSectionBlockEducationProgram(resume, sectionId, entryId, programIndex, field, value) {
  return updateSection(resume, sectionId, (section) => ({
    ...section,
    entries: updateEntry(section.entries, entryId, (entry) => {
      const programs = Array.isArray(entry.programs) ? entry.programs : [];
      const nextPrograms = programs.map((program, index) => (
        index === programIndex ? { ...program, [field]: asText(value) } : program
      ));

      return {
        ...entry,
        programs: nextPrograms,
      };
    }),
  }));
}

export function addSectionBlockEducationProgram(resume, sectionId, entryId) {
  return updateSection(resume, sectionId, (section) => ({
    ...section,
    entries: updateEntry(section.entries, entryId, (entry) => ({
      ...entry,
      programs: [...(Array.isArray(entry.programs) ? entry.programs : []), createEducationProgram()],
    })),
  }));
}

export function moveSectionBlockEducationProgram(resume, sectionId, entryId, programIndex, direction) {
  return updateSection(resume, sectionId, (section) => ({
    ...section,
    entries: updateEntry(section.entries, entryId, (entry) => ({
      ...entry,
      programs: moveItem(Array.isArray(entry.programs) ? entry.programs : [], programIndex, direction),
    })),
  }));
}

export function removeSectionBlockEducationProgram(resume, sectionId, entryId, programIndex) {
  return updateSection(resume, sectionId, (section) => ({
    ...section,
    entries: updateEntry(section.entries, entryId, (entry) => ({
      ...entry,
      programs: (Array.isArray(entry.programs) ? entry.programs : []).filter((_, index) => index !== programIndex),
    })),
  }));
}

export function personalHasContent(personal) {
  return [
    personal.name,
    personal.headline,
    personal.location,
    personal.phone,
    personal.email,
    personal.linkedinUrl,
    personal.portfolioUrl,
    personal.githubUrl,
    personal.customField,
    personal.aboutMe,
  ].some((value) => trimText(value) !== '');
}

function entryHasTextContent(entry, fields) {
  return fields.some((field) => trimText(entry[field]) !== '');
}

export function educationEntryHasContent(entry) {
  const hasCustomSectionContent = ensureEducationCustomSections(entry.customSections, { allowEmpty: true }).some((section) => (
    trimText(section.label) !== '' || trimText(section.content) !== ''
  ));
  const hasProgramContent = Array.isArray(entry.programs) && entry.programs.some((program) => (
    [program.degree, program.yearsEdu, program.gpa, program.honors].some((value) => trimText(value) !== '')
  ));

  return entryHasTextContent(entry, ['school', 'degree', 'yearsEdu', 'location', 'gpa', 'honors', 'coursework', 'awards'])
    || hasCustomSectionContent
    || hasProgramContent;
}

export function roleEntryHasContent(entry) {
  return entryHasTextContent(entry, ['company', 'role', 'location', 'yearsExp']) || listHasContent(entry.activities);
}

export function skillsEntryHasContent(entry) {
  return entryHasTextContent(entry, ['category', 'items']);
}

export function projectEntryHasContent(entry) {
  return entryHasTextContent(entry, ['name', 'subtitle', 'years', 'summary']) || listHasContent(entry.highlights);
}

export function certificationEntryHasContent(entry) {
  return entryHasTextContent(entry, ['name', 'issuer', 'years', 'details']);
}

export function languageEntryHasContent(entry) {
  return entryHasTextContent(entry, ['language', 'proficiency']);
}

export function awardEntryHasContent(entry) {
  return entryHasTextContent(entry, ['title', 'issuer', 'years', 'details']);
}

export function publicationEntryHasContent(entry) {
  return entryHasTextContent(entry, ['title', 'publisher', 'years', 'details']);
}

function customEntryHasContent(entry) {
  return entryHasTextContent(entry, ['title', 'subtitle', 'location', 'years', 'details']) || listHasContent(entry.highlights);
}

export function normalizeBulletText(value) {
  return trimText(value).replace(/^([*-]+|\d+[.)])\s+/, '').trim();
}

function toPreviewEducationEntries(entries) {
  return entries
    .filter(educationEntryHasContent)
    .map((entry) => ({
      id: entry.id,
      school: trimText(entry.school),
      degree: trimText(entry.degree),
      yearsEdu: trimText(entry.yearsEdu),
      location: trimText(entry.location),
      gpa: trimText(entry.gpa),
      honors: trimText(entry.honors),
      coursework: trimText(entry.coursework),
      awards: trimText(entry.awards),
      programs: (Array.isArray(entry.programs) ? entry.programs : [])
        .map((program, index) => ({
          id: program.id || `${entry.id}-program-${index}`,
          degree: trimText(program.degree),
          yearsEdu: trimText(program.yearsEdu),
          gpa: trimText(program.gpa),
          honors: trimText(program.honors),
        }))
        .filter((program) => [program.degree, program.yearsEdu, program.gpa, program.honors].some(Boolean)),
      customSections: ensureEducationCustomSections(entry.customSections, { allowEmpty: true })
        .map((section) => ({
          id: section.id,
          label: trimText(section.label),
          content: trimText(section.content),
        }))
        .filter((section) => section.content !== ''),
    }));
}

function toPreviewRoleEntries(entries) {
  return entries
    .filter(roleEntryHasContent)
    .map((entry) => ({
      id: entry.id,
      company: trimText(entry.company),
      role: trimText(entry.role),
      location: trimText(entry.location),
      yearsExp: trimText(entry.yearsExp),
      activities: toPreviewTextList(entry.activities),
    }));
}

function toPreviewSkillsEntries(entries) {
  return entries
    .filter(skillsEntryHasContent)
    .map((entry) => ({
      id: entry.id,
      category: trimText(entry.category),
      items: trimText(entry.items),
    }));
}

function toPreviewProjectEntries(entries) {
  return entries
    .filter(projectEntryHasContent)
    .map((entry) => ({
      id: entry.id,
      name: trimText(entry.name),
      subtitle: trimText(entry.subtitle),
      years: trimText(entry.years),
      summary: trimText(entry.summary),
      highlights: toPreviewTextList(entry.highlights),
    }));
}

function toPreviewCertificationEntries(entries) {
  return entries
    .filter(certificationEntryHasContent)
    .map((entry) => ({
      id: entry.id,
      name: trimText(entry.name),
      issuer: trimText(entry.issuer),
      years: trimText(entry.years),
      details: trimText(entry.details),
    }));
}

function toPreviewLanguageEntries(entries) {
  return entries
    .filter(languageEntryHasContent)
    .map((entry) => ({
      id: entry.id,
      language: trimText(entry.language),
      proficiency: trimText(entry.proficiency),
    }));
}

function toPreviewAwardEntries(entries) {
  return entries
    .filter(awardEntryHasContent)
    .map((entry) => ({
      id: entry.id,
      title: trimText(entry.title),
      issuer: trimText(entry.issuer),
      years: trimText(entry.years),
      details: trimText(entry.details),
    }));
}

function toPreviewPublicationEntries(entries) {
  return entries
    .filter(publicationEntryHasContent)
    .map((entry) => ({
      id: entry.id,
      title: trimText(entry.title),
      publisher: trimText(entry.publisher),
      years: trimText(entry.years),
      details: trimText(entry.details),
    }));
}

function toPreviewCustomEntries(entries) {
  return entries
    .filter(customEntryHasContent)
    .map((entry) => ({
      id: entry.id,
      title: trimText(entry.title),
      subtitle: trimText(entry.subtitle),
      location: trimText(entry.location),
      years: trimText(entry.years),
      details: trimText(entry.details),
      highlights: toPreviewTextList(entry.highlights),
    }));
}

function toPreviewTextList(items) {
  return normalizeStringList(items, { minItems: 0 })
    .map((item, index) => ({
      text: normalizeBulletText(item),
      sourceIndex: index,
    }))
    .filter((item) => item.text);
}

function toPreviewEntries(section) {
  if (section.kind === 'education') {
    return toPreviewEducationEntries(section.entries);
  }

  if (section.kind === 'roles') {
    return toPreviewRoleEntries(section.entries);
  }

  if (section.kind === 'skills') {
    return toPreviewSkillsEntries(section.entries);
  }

  if (section.kind === 'projects') {
    return toPreviewProjectEntries(section.entries);
  }

  if (section.kind === 'certifications') {
    return toPreviewCertificationEntries(section.entries);
  }

  if (section.kind === 'languages') {
    return toPreviewLanguageEntries(section.entries);
  }

  if (section.kind === 'awards') {
    return toPreviewAwardEntries(section.entries);
  }

  if (section.kind === 'publications') {
    return toPreviewPublicationEntries(section.entries);
  }

  return toPreviewCustomEntries(section.entries);
}

function formatUrlForDisplay(value) {
  return trimText(value).replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '');
}

function formatPhoneForPreview(value) {
  return trimText(value);
}

export function getPreviewModel(candidateResume) {
  const resume = normalizeResume(candidateResume);
  const personal = {
    name: trimText(resume.personal.name),
    headline: trimText(resume.personal.headline),
    location: trimText(resume.personal.location),
    phone: formatPhoneForPreview(resume.personal.phone),
    email: trimText(resume.personal.email),
    linkedinUrl: trimText(resume.personal.linkedinUrl),
    portfolioUrl: trimText(resume.personal.portfolioUrl),
    githubUrl: trimText(resume.personal.githubUrl),
    customField: trimText(resume.personal.customField),
    aboutMe: trimText(resume.personal.aboutMe),
  };
  const links = [
    personal.linkedinUrl ? { id: 'linkedin', text: formatUrlForDisplay(personal.linkedinUrl) } : null,
    personal.portfolioUrl ? { id: 'portfolio', text: formatUrlForDisplay(personal.portfolioUrl) } : null,
    personal.githubUrl ? { id: 'github', text: formatUrlForDisplay(personal.githubUrl) } : null,
    personal.customField ? { id: 'custom', text: personal.customField } : null,
  ].filter(Boolean);
  const sectionBlocks = resume.sections
    .map((section) => ({
      id: section.id,
      kind: section.kind,
      title: trimText(section.title),
      entryHeaderLayout: normalizeEntryHeaderLayout(section.kind, section.entryHeaderLayout),
      entryOrder: section.entries.map((entry) => entry.id),
      entries: toPreviewEntries(section),
    }))
    .filter((section) => section.entries.length > 0);

  return {
    hasContent: personalHasContent(personal) || sectionBlocks.length > 0,
    personal: {
      ...personal,
      links,
    },
    sectionOrder: resume.sections.map((section) => section.id),
    sectionBlocks,
    showPersonal: personalHasContent(personal),
  };
}

function normalizeUrl(value) {
  const text = trimText(value);

  if (!text) {
    return '';
  }

  try {
    const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
    return url.hostname.includes('.') ? url.href : '';
  } catch {
    return '';
  }
}

export function validateResume(candidateResume) {
  const resume = normalizeResume(candidateResume);
  const errors = {};
  const email = trimText(resume.personal.email);
  const phone = trimText(resume.personal.phone);
  const name = trimText(resume.personal.name);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const phoneRegex = /^[+\d\s().-]{7,}$/;

  if (!name) {
    errors['personal.name'] = 'Add your full name.';
  }

  if (!email && !phone) {
    errors['personal.email'] = 'Add at least one contact method.';
    errors['personal.phone'] = 'Add at least one contact method.';
  }

  if (email && !emailRegex.test(email)) {
    errors['personal.email'] = 'Enter a valid email address.';
  }

  if (phone && !phoneRegex.test(phone)) {
    errors['personal.phone'] = 'Enter a valid phone number.';
  }

  ['linkedinUrl', 'portfolioUrl', 'githubUrl'].forEach((field) => {
    if (trimText(resume.personal[field]) && !normalizeUrl(resume.personal[field])) {
      errors[`personal.${field}`] = 'Enter a valid URL.';
    }
  });

  resume.sections.forEach((section) => {
    section.entries.forEach((entry) => {
      const prefix = `sections.${section.id}.${entry.id}`;

      if (section.kind === 'education' && educationEntryHasContent(entry)) {
        const hasProgramDegree = Array.isArray(entry.programs) && entry.programs.some((program) => trimText(program.degree) !== '');
        const hasProgramYears = Array.isArray(entry.programs) && entry.programs.some((program) => trimText(program.yearsEdu) !== '');

        if (!trimText(entry.school)) {
          errors[`${prefix}.school`] = 'Add the institution name.';
        }

        if (!trimText(entry.degree) && !hasProgramDegree) {
          errors[`${prefix}.degree`] = 'Add the degree or program.';
        }

        if (!trimText(entry.yearsEdu) && !hasProgramYears) {
          errors[`${prefix}.yearsEdu`] = 'Add the date range.';
        }
      }

      if (section.kind === 'roles' && roleEntryHasContent(entry)) {
        if (!trimText(entry.company)) {
          errors[`${prefix}.company`] = 'Add the organization.';
        }

        if (!trimText(entry.role)) {
          errors[`${prefix}.role`] = 'Add the role title.';
        }

        if (!trimText(entry.yearsExp)) {
          errors[`${prefix}.yearsExp`] = 'Add the date range.';
        }

        if (normalizeStringList(entry.activities, { minItems: 0 }).every((activity) => trimText(activity) === '')) {
          errors[`${prefix}.activities.0`] = 'Add at least one highlight.';
        }
      }

      if (section.kind === 'skills' && skillsEntryHasContent(entry) && !trimText(entry.items)) {
        errors[`${prefix}.items`] = 'Add at least one skill.';
      }

      if (section.kind === 'projects' && projectEntryHasContent(entry) && !trimText(entry.name)) {
        errors[`${prefix}.name`] = 'Add the project name.';
      }

      if (section.kind === 'certifications' && certificationEntryHasContent(entry) && !trimText(entry.name)) {
        errors[`${prefix}.name`] = 'Add the certification name.';
      }

      if (section.kind === 'languages' && languageEntryHasContent(entry) && !trimText(entry.language)) {
        errors[`${prefix}.language`] = 'Add the language.';
      }

      if (section.kind === 'awards' && awardEntryHasContent(entry) && !trimText(entry.title)) {
        errors[`${prefix}.title`] = 'Add the award title.';
      }

      if (section.kind === 'publications' && publicationEntryHasContent(entry) && !trimText(entry.title)) {
        errors[`${prefix}.title`] = 'Add the publication title.';
      }

      if (section.kind === 'custom' && customEntryHasContent(entry) && !trimText(entry.title)) {
        errors[`${prefix}.title`] = 'Add an entry title.';
      }
    });
  });

  return errors;
}

function resolvePresentationBase(template) {
  return RESUME_PRESENTATION_BASES[template] || RESUME_PRESENTATION_BASES[DEFAULT_TEMPLATE];
}

function formatFontPxFromRem(value) {
  return formatPx(value * RESUME_FONT_ROOT_PX);
}

function formatPx(value) {
  return `${Number(value.toFixed(2))}px`;
}

function formatInches(value) {
  return `${Number(value.toFixed(3))}in`;
}

function formatUnitless(value) {
  return `${Number(value.toFixed(3))}`;
}

function formatSeparatorColor(tone) {
  const normalizedTone = clampInteger(tone, SEPARATOR_TONE_MIN, SEPARATOR_TONE_MAX);

  if (normalizedTone <= 0) {
    return 'transparent';
  }

  return `rgba(0, 0, 0, ${Number((normalizedTone / 100).toFixed(2))})`;
}

function formatDarkSeparatorColor(tone) {
  const normalizedTone = clampInteger(tone, SEPARATOR_TONE_MIN, SEPARATOR_TONE_MAX);

  if (normalizedTone <= 0) {
    return 'transparent';
  }

  return `rgba(255, 255, 255, ${Number((normalizedTone / 100).toFixed(2))})`;
}

function formatSeparatorWeight(weight) {
  const normalizedWeight = clampInteger(weight, SEPARATOR_WEIGHT_MIN, SEPARATOR_WEIGHT_MAX);
  const weightMap = {
    1: 0.5,
    2: 1,
    3: 1.5,
    4: 2,
    5: 3,
  };

  return formatPx(weightMap[normalizedWeight] || 1);
}

function personalAlignmentToJustifyContent(alignment) {
  if (alignment === 'left') {
    return 'flex-start';
  }

  return 'center';
}

function personalAlignmentToSummaryMargins(alignment) {
  if (alignment === 'left') {
    return { left: '0', right: 'auto' };
  }

  return { left: 'auto', right: 'auto' };
}

export function getResumePresentationVars(settings, template) {
  const normalizedSettings = normalizeResumeSettings(settings);
  const base = resolvePresentationBase(template);
  const personalAlignment = getEffectivePersonalAlignment(normalizedSettings, template);
  const summaryMargins = personalAlignmentToSummaryMargins(personalAlignment);
  const textScale = 1 + (normalizedSettings.textSize * TEXT_SIZE_STEP);
  const headingScale = 1 + (normalizedSettings.headingSize * HEADING_SIZE_STEP);
  const nameScale = 1 + (normalizedSettings.nameSize * NAME_SIZE_STEP);
  const bodyLineHeight = clampNumber(base.bodyLineHeight + (normalizedSettings.lineSpacing * LINE_SPACING_STEP), 1, 2.2);
  const detailLineHeight = clampNumber(base.detailLineHeight + (normalizedSettings.lineSpacing * LINE_SPACING_STEP), 1, 2.3);
  const listLineHeight = clampNumber(base.listLineHeight + (normalizedSettings.lineSpacing * LINE_SPACING_STEP), 1, 2.3);
  const sectionGap = Math.max(0, base.sectionGapPx + (normalizedSettings.sectionSpacing * SECTION_SPACING_STEP));
  const sectionHeadingGap = Math.max(0, base.sectionHeadingGapPx + (normalizedSettings.sectionSpacing * SECTION_SPACING_STEP));
  const personalSeparatorGap = Math.max(0, sectionGap + (normalizedSettings.personalSeparatorGap * SEPARATOR_GAP_STEP));
  const sectionSeparatorGap = Math.max(0, sectionGap + (normalizedSettings.sectionSeparatorGap * SEPARATOR_GAP_STEP));
  const entryGap = Math.max(0, base.entryGapPx + (normalizedSettings.entrySpacing * ENTRY_SPACING_STEP));
  const repeatedEntryGap = Math.max(0, base.repeatedEntryGapPx + (normalizedSettings.entrySpacing * ENTRY_SPACING_STEP));
  const detailGap = Math.max(0, base.detailGapPx + (normalizedSettings.entrySpacing * ENTRY_SPACING_STEP));
  const listGap = Math.max(0, base.listGapPx + (normalizedSettings.entrySpacing * ENTRY_SPACING_STEP));
  const pageMarginInline = Math.max(0.2, base.pageMarginInlineIn + (normalizedSettings.horizontalMargins * MARGIN_STEP_IN));
  const pageMarginTop = Math.max(0.2, base.pageMarginTopIn + (normalizedSettings.verticalMargins * MARGIN_STEP_IN));
  const pageMarginBottom = Math.max(0.2, base.pageMarginBottomIn + (normalizedSettings.verticalMargins * MARGIN_STEP_IN));
  const printContentWidth = Math.max(0, 8.5 - (pageMarginInline * 2));
  const printMinHeight = Math.max(0, 11 - pageMarginTop - pageMarginBottom);

  return {
    '--resume-page-width': `${PRINT_PAGE_WIDTH_PX}px`,
    '--resume-page-height': `${PRINT_PAGE_HEIGHT_PX}px`,
    '--resume-page-min-height': `${PRINT_PAGE_HEIGHT_PX}px`,
    '--resume-page-margin-inline': formatInches(pageMarginInline),
    '--resume-page-margin-top': formatInches(pageMarginTop),
    '--resume-page-margin-bottom': formatInches(pageMarginBottom),
    '--resume-print-content-width': formatInches(printContentWidth),
    '--resume-name-size': formatFontPxFromRem(base.nameSizeRem * nameScale),
    '--resume-heading-size': formatFontPxFromRem(base.headingSizeRem * headingScale),
    '--resume-body-size': formatFontPxFromRem(base.bodySizeRem * textScale),
    '--resume-detail-size': formatFontPxFromRem(base.detailSizeRem * textScale),
    '--resume-meta-size': formatFontPxFromRem(base.metaSizeRem * textScale),
    '--resume-headline-size': formatFontPxFromRem(base.headlineSizeRem * textScale),
    '--resume-body-line-height': formatUnitless(bodyLineHeight),
    '--resume-detail-line-height': formatUnitless(detailLineHeight),
    '--resume-list-line-height': formatUnitless(listLineHeight),
    '--resume-section-gap': formatPx(sectionGap),
    '--resume-personal-separator-gap': formatPx(personalSeparatorGap),
    '--resume-section-separator-gap': formatPx(sectionSeparatorGap),
    '--resume-personal-separator-color': formatSeparatorColor(normalizedSettings.personalSeparatorTone),
    '--resume-section-separator-color': formatSeparatorColor(normalizedSettings.sectionSeparatorTone),
    '--resume-personal-separator-dark-color': formatDarkSeparatorColor(normalizedSettings.personalSeparatorTone),
    '--resume-section-separator-dark-color': formatDarkSeparatorColor(normalizedSettings.sectionSeparatorTone),
    '--resume-personal-separator-weight': formatSeparatorWeight(normalizedSettings.personalSeparatorWeight),
    '--resume-section-separator-weight': formatSeparatorWeight(normalizedSettings.sectionSeparatorWeight),
    '--resume-section-heading-gap': formatPx(sectionHeadingGap),
    '--resume-entry-gap': formatPx(entryGap),
    '--resume-repeated-entry-gap': formatPx(repeatedEntryGap),
    '--resume-detail-gap': formatPx(detailGap),
    '--resume-list-gap': formatPx(listGap),
    '--resume-summary-width-percent': `${normalizedSettings.summaryWidthPercent}%`,
    '--resume-personal-alignment': personalAlignment,
    '--resume-personal-justify-content': personalAlignmentToJustifyContent(personalAlignment),
    '--resume-summary-margin-left': summaryMargins.left,
    '--resume-summary-margin-right': summaryMargins.right,
    '--resume-print-min-height': formatInches(printMinHeight),
  };
}

export function getResumePrintPageRule(settings, template) {
  const normalizedSettings = normalizeResumeSettings(settings);
  const base = resolvePresentationBase(template);
  const horizontalMargin = Math.max(0.2, base.pageMarginInlineIn + (normalizedSettings.horizontalMargins * MARGIN_STEP_IN));
  const verticalMargin = Math.max(0.2, base.pageMarginTopIn + (normalizedSettings.verticalMargins * MARGIN_STEP_IN));

  return `@page { size: letter; margin: ${formatInches(verticalMargin)} ${formatInches(horizontalMargin)} ${formatInches(verticalMargin)} ${formatInches(horizontalMargin)}; }`;
}
