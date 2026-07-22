import {
  DEFAULT_TEMPLATE,
  PERSONAL_CONTACT_FIELDS,
  PERSONAL_HEADER_ROWS,
  adjustResumeSettings,
  hasResumeSettingId,
  normalizePersonalContactOrder,
  normalizePersonalHeaderOrder,
  normalizeResumeSettings,
  normalizeResumeTemplate,
  setResumeSettingsValue,
} from './resumeSettings.js';
import {
  listHasContent,
  normalizeStringList,
} from './resumeValues.js';
import { trimText } from './text.js';

export const MAX_RESUME_SECTIONS = 100;
export const UNTITLED_SECTION_TITLE = 'Untitled section';
const SECTION_BLOCK_KINDS = [
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
function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `id-${Math.random().toString(36).slice(2, 10)}`;
}

function asText(value) {
  return typeof value === 'string' ? value : '';
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

function findEntryHeaderFieldSlot(layout, field) {
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

function normalizeSampleDisplay(sampleDisplay) {
  const display = sampleDisplay && typeof sampleDisplay === 'object' ? sampleDisplay : {};
  const isDismissed = Boolean(display.isDismissed);

  return {
    hasStarted: isDismissed || Boolean(display.hasStarted),
    showInformation: isDismissed ? false : display.showInformation !== false,
    isDismissed,
    entryBindings: isDismissed ? {} : normalizeSampleEntryBindings(display.entryBindings),
    textListOrders: isDismissed ? {} : normalizeSampleTextListOrders(display.textListOrders),
  };
}

function normalizeSampleTextListOrders(textListOrders) {
  if (!textListOrders || typeof textListOrders !== 'object' || Array.isArray(textListOrders)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(textListOrders).flatMap(([rawKey, rawOrder]) => {
      const key = trimText(rawKey);
      const order = Array.isArray(rawOrder)
        ? rawOrder.map(Number).filter((value) => Number.isInteger(value) && value >= 0 && value <= 99)
        : [];
      const uniqueOrder = [...new Set(order)];

      return key && key.length <= 360 && uniqueOrder.length === order.length && uniqueOrder.length > 0
        ? [[key, uniqueOrder]]
        : [];
    }),
  );
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

function createPersonal(candidate = {}) {
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

function createDefaultSections() {
  return DEFAULT_SECTION_BLOCKS.map((section) => ({
    ...section,
    entries: [createEntryForKind(section.kind)],
  }));
}

function createResumeSectionBlock(resume, templateId) {
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
    template: normalizeResumeTemplate(draft.template),
    localRevision: typeof draft.localRevision === 'string' ? draft.localRevision : '',
    resume: normalizeResume(draft.resume),
  };
}

export function createDraftPayload({ resume, template, savedAt = new Date().toISOString(), localRevision = '' } = {}) {
  return {
    version: 3,
    savedAt,
    template: normalizeResumeTemplate(template),
    localRevision,
    resume: normalizeResume(resume),
  };
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

  return {
    ...normalizedResume,
    settings: adjustResumeSettings(normalizedResume.settings, settingId, delta),
  };
}

export function setResumeSummaryWidthPercent(resume, widthPercent) {
  const normalizedResume = normalizeResume(resume);

  return {
    ...normalizedResume,
    settings: setResumeSettingsValue(normalizedResume.settings, 'summaryWidthPercent', widthPercent),
  };
}

export function setResumeSettingValue(resume, settingId, value) {
  const normalizedResume = normalizeResume(resume);

  if (!hasResumeSettingId(settingId)) {
    return normalizedResume;
  }

  if (settingId === 'personalContactOrder') {
    return setPersonalContactOrder(normalizedResume, value);
  }

  if (settingId === 'personalHeaderOrder') {
    return setPersonalHeaderOrder(normalizedResume, value);
  }

  return {
    ...normalizedResume,
    settings: setResumeSettingsValue(normalizedResume.settings, settingId, value),
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
  const isDismissed = normalizedResume.sampleDisplay.isDismissed || updates.isDismissed === true;

  return {
    ...normalizedResume,
    sampleDisplay: normalizeSampleDisplay({
      ...normalizedResume.sampleDisplay,
      ...updates,
      isDismissed,
    }),
  };
}

export function dismissSampleInformation(resume) {
  return updateSampleDisplay(resume, {
    hasStarted: true,
    showInformation: false,
    isDismissed: true,
    entryBindings: {},
    textListOrders: {},
  });
}

export function setSampleTextListOrder(resume, orderKey, orderedSourceIndexes) {
  const normalizedResume = normalizeResume(resume);
  const key = trimText(orderKey);

  if (!key || key.length > 360) {
    return normalizedResume;
  }

  const nextOrders = {
    ...normalizedResume.sampleDisplay.textListOrders,
  };
  const normalizedOrder = normalizeSampleTextListOrders({
    [key]: orderedSourceIndexes,
  })[key];

  if (normalizedOrder) {
    nextOrders[key] = normalizedOrder;
  } else {
    delete nextOrders[key];
  }

  return updateSampleDisplay(normalizedResume, {
    textListOrders: nextOrders,
  });
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

function previewTextListLength(items) {
  return (Array.isArray(items) ? items : []).reduce((length, item, index) => {
    const sourceIndex = Number.isInteger(item?.sourceIndex) ? item.sourceIndex : index;
    return Math.max(length, sourceIndex + 1);
  }, 0);
}

function extendBlankTextList(items, requiredLength) {
  const nextItems = normalizeStringList(items);

  while (nextItems.length < requiredLength) {
    nextItems.push('');
  }

  return nextItems;
}

function extendEducationPrograms(programs, requiredLength) {
  const nextPrograms = Array.isArray(programs) ? [...programs] : [];

  while (nextPrograms.length < requiredLength) {
    nextPrograms.push(createEducationProgram());
  }

  return nextPrograms;
}

function extendEducationCustomSections(customSections, requiredLength) {
  const nextSections = ensureEducationCustomSections(customSections);

  while (nextSections.length < requiredLength) {
    nextSections.push(createEducationCustomSection());
  }

  return nextSections;
}

function createTransientPreviewEntry(sectionKind, previewEntry, existingEntry) {
  const entryId = trimText(previewEntry?.id);

  if (!entryId) {
    return null;
  }

  const nextEntry = createEntryForKind(sectionKind, existingEntry || { id: entryId });
  nextEntry.id = entryId;

  if (sectionKind === 'roles') {
    nextEntry.activities = extendBlankTextList(
      nextEntry.activities,
      previewTextListLength(previewEntry?.activities),
    );
  } else if (sectionKind === 'projects' || sectionKind === 'custom') {
    nextEntry.highlights = extendBlankTextList(
      nextEntry.highlights,
      previewTextListLength(previewEntry?.highlights),
    );
  } else if (sectionKind === 'education') {
    nextEntry.programs = extendEducationPrograms(
      nextEntry.programs,
      Array.isArray(previewEntry?.programs) ? previewEntry.programs.length : 0,
    );
    nextEntry.customSections = extendEducationCustomSections(
      nextEntry.customSections,
      Array.isArray(previewEntry?.customSections) ? previewEntry.customSections.length : 0,
    );
  }

  return nextEntry;
}

function findTransientEntryInsertionIndex(entries, previewEntryOrder, entryId) {
  const order = Array.isArray(previewEntryOrder) ? previewEntryOrder.filter(Boolean) : [];
  const targetIndex = order.indexOf(entryId);

  if (targetIndex < 0) {
    return entries.length;
  }

  const entryIndexById = new Map(entries.map((entry, index) => [entry.id, index]));

  for (let index = targetIndex - 1; index >= 0; index -= 1) {
    const previousEntryIndex = entryIndexById.get(order[index]);

    if (Number.isInteger(previousEntryIndex)) {
      return previousEntryIndex + 1;
    }
  }

  for (let index = targetIndex + 1; index < order.length; index += 1) {
    const nextEntryIndex = entryIndexById.get(order[index]);

    if (Number.isInteger(nextEntryIndex)) {
      return nextEntryIndex;
    }
  }

  return entries.length;
}

export function projectTransientSampleEntry(resume, sectionId, previewEntry, previewEntryOrder = []) {
  const normalizedResume = normalizeResume(resume);
  const entryId = trimText(previewEntry?.id);
  let transient = null;

  if (!entryId) {
    return { resume: normalizedResume, transient };
  }

  const sections = normalizedResume.sections.map((section) => {
    if (section.id !== sectionId) {
      return section;
    }

    const existingEntryIndex = section.entries.findIndex((entry) => entry.id === entryId);
    const baselineEntry = existingEntryIndex >= 0 ? section.entries[existingEntryIndex] : null;
    const projectedEntry = createTransientPreviewEntry(section.kind, previewEntry, baselineEntry);

    if (!projectedEntry) {
      return section;
    }

    const entries = [...section.entries];

    if (existingEntryIndex >= 0) {
      entries[existingEntryIndex] = projectedEntry;
    } else {
      const insertionIndex = findTransientEntryInsertionIndex(entries, previewEntryOrder, entryId);
      entries.splice(insertionIndex, 0, projectedEntry);
    }

    transient = {
      sectionId,
      entryId,
      sectionKind: section.kind,
      baselineEntry,
      projectedEntry,
    };

    return {
      ...section,
      entries,
    };
  });

  return {
    resume: transient ? { ...normalizedResume, sections } : normalizedResume,
    transient,
  };
}

export function resolveTransientSampleEntry(resume, transient) {
  if (!transient?.sectionId || !transient?.entryId) {
    return resume;
  }

  const section = resume.sections?.find((candidate) => candidate.id === transient.sectionId);

  if (!section) {
    return resume;
  }

  const currentEntryIndex = section.entries.findIndex((entry) => entry.id === transient.entryId);
  const hasTargetMutation = didTransientSampleEntryChange(resume, transient);

  if (currentEntryIndex < 0) {
    return hasTargetMutation ? resume : restoreTransientSampleEntry(resume, transient);
  }

  const currentEntry = section.entries[currentEntryIndex];
  const baselineHasContent = Boolean(
    transient.baselineEntry && sectionEntryHasContent(transient.sectionKind, transient.baselineEntry),
  );
  const currentHasContent = sectionEntryHasContent(transient.sectionKind, currentEntry);

  if (hasTargetMutation && (baselineHasContent || currentHasContent)) {
    return resume;
  }

  return restoreTransientSampleEntry(resume, transient);
}

function restoreTransientSampleEntry(resume, transient) {
  const section = resume.sections?.find((candidate) => candidate.id === transient.sectionId);

  if (!section) {
    return resume;
  }

  const currentEntryIndex = section.entries.findIndex((entry) => entry.id === transient.entryId);
  const entries = [...section.entries];

  if (transient.baselineEntry) {
    if (currentEntryIndex >= 0) {
      entries[currentEntryIndex] = transient.baselineEntry;
    } else {
      entries.push(transient.baselineEntry);
    }
  } else if (currentEntryIndex >= 0) {
    entries.splice(currentEntryIndex, 1);
  }

  return {
    ...resume,
    sections: resume.sections.map((candidate) => (
      candidate.id === transient.sectionId
        ? { ...candidate, entries }
        : candidate
    )),
  };
}

function compactTransientEntryValue(value, key = '') {
  if (key === 'id') {
    return undefined;
  }

  if (typeof value === 'string') {
    const normalizedValue = trimText(value);
    return normalizedValue || undefined;
  }

  if (Array.isArray(value)) {
    const compactedItems = value
      .map((item) => compactTransientEntryValue(item))
      .filter((item) => item !== undefined);

    return compactedItems.length > 0 ? compactedItems : undefined;
  }

  if (value && typeof value === 'object') {
    const compactedEntries = Object.entries(value)
      .map(([entryKey, entryValue]) => [entryKey, compactTransientEntryValue(entryValue, entryKey)])
      .filter(([, entryValue]) => entryValue !== undefined);

    return compactedEntries.length > 0 ? Object.fromEntries(compactedEntries) : undefined;
  }

  return value === undefined || value === null ? undefined : value;
}

export function didTransientSampleEntryChange(resume, transient) {
  if (!transient?.sectionId || !transient?.entryId || !transient.projectedEntry) {
    return false;
  }

  const section = resume.sections?.find((candidate) => candidate.id === transient.sectionId);
  const currentEntry = section?.entries?.find((entry) => entry.id === transient.entryId);

  if (!currentEntry) {
    return true;
  }

  return JSON.stringify(compactTransientEntryValue(currentEntry) || null)
    !== JSON.stringify(compactTransientEntryValue(transient.projectedEntry) || null);
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

export function customEntryHasContent(entry) {
  return entryHasTextContent(entry, ['title', 'subtitle', 'location', 'years', 'details']) || listHasContent(entry.highlights);
}

export function sectionEntryHasContent(sectionKind, entry) {
  if (!entry) {
    return false;
  }

  if (sectionKind === 'education') {
    return educationEntryHasContent(entry);
  }

  if (sectionKind === 'roles') {
    return roleEntryHasContent(entry);
  }

  if (sectionKind === 'skills') {
    return skillsEntryHasContent(entry);
  }

  if (sectionKind === 'projects') {
    return projectEntryHasContent(entry);
  }

  if (sectionKind === 'certifications') {
    return certificationEntryHasContent(entry);
  }

  if (sectionKind === 'languages') {
    return languageEntryHasContent(entry);
  }

  if (sectionKind === 'awards') {
    return awardEntryHasContent(entry);
  }

  if (sectionKind === 'publications') {
    return publicationEntryHasContent(entry);
  }

  return customEntryHasContent(entry);
}
