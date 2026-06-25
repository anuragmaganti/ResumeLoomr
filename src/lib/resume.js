export const DRAFT_STORAGE_KEY = 'resumeloomr:draft:v2';
export const WORKSPACE_INDEX_STORAGE_KEY = 'resumeloomr:index:v1';
export const RESUME_STORAGE_KEY_PREFIX = 'resumeloomr:resume:';
export const MAX_WORKSPACE_RESUME_NAME_LENGTH = 25;
export const MAX_WORKSPACE_RESUMES = 10;
export const DEFAULT_TEMPLATE = 'modern';
export const TEMPLATE_OPTIONS = [
  { id: 'modern', label: 'Modern' },
  { id: 'executive', label: 'Executive' },
  { id: 'compact', label: 'Compact' }
];
export const SECTION_IDS = [
  'personal',
  'education',
  'experience',
  'skills',
  'projects',
  'certifications',
  'volunteering',
  'leadership',
  'languages',
  'awards',
  'publications'
];
export const SECTION_TITLE_DEFAULTS = {
  education: 'Education',
  experience: 'Experience',
  skills: 'Skills',
  projects: 'Projects',
  certifications: 'Certifications',
  volunteering: 'Volunteering',
  leadership: 'Leadership',
  languages: 'Languages',
  awards: 'Awards',
  publications: 'Publications'
};
export const SECTION_BLOCK_KINDS = [
  'education',
  'roles',
  'skills',
  'projects',
  'certifications',
  'languages',
  'awards',
  'publications',
  'custom'
];
export const RESUME_SETTINGS_DEFAULTS = {
  textSize: 0,
  horizontalMargins: 0,
  verticalMargins: 0,
  lineSpacing: 0,
  sectionSpacing: 0,
  entrySpacing: 0,
  headingSize: 0,
  nameSize: 0
};

const RESUME_SETTINGS_MIN = -5;
const RESUME_SETTINGS_MAX = 5;
const DEFAULT_RESUME_LABEL = 'Resume';
const TEXT_SIZE_STEP = 0.03;
const HEADING_SIZE_STEP = 0.05;
const NAME_SIZE_STEP = 0.05;
const MARGIN_STEP_IN = 0.04;
const LINE_SPACING_STEP = 0.04;
const SECTION_SPACING_STEP = 4;
const ENTRY_SPACING_STEP = 3;
const RESUME_PRESENTATION_BASES = {
  modern: {
    pageMinHeightPx: 1090,
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
    listGapPx: 4
  },
  executive: {
    pageMinHeightPx: 1090,
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
    listGapPx: 4
  },
  compact: {
    pageMinHeightPx: 1021,
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
    listGapPx: 4
  }
};
const LEGACY_SECTION_KIND_MAP = {
  education: 'education',
  experience: 'roles',
  skills: 'skills',
  projects: 'projects',
  certifications: 'certifications',
  volunteering: 'roles',
  leadership: 'roles',
  languages: 'languages',
  awards: 'awards',
  publications: 'publications'
};
const ROLE_LEGACY_SECTION_IDS = new Set(['experience', 'volunteering', 'leadership']);

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `id-${Math.random().toString(36).slice(2, 10)}`;
}

export function createWorkspaceResumeId() {
  return createId();
}

function asText(value) {
  return typeof value === 'string' ? value : '';
}

function normalizeWorkspaceResumeName(value, fallback) {
  return sanitizeWorkspaceResumeName(value, fallback);
}

export function sanitizeWorkspaceResumeName(value, fallback = '') {
  const nextName = trimText(value).slice(0, MAX_WORKSPACE_RESUME_NAME_LENGTH).trim();

  if (nextName) {
    return nextName;
  }

  return trimText(fallback).slice(0, MAX_WORKSPACE_RESUME_NAME_LENGTH).trim();
}

function clampResumeSettingValue(value) {
  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return 0;
  }

  return Math.max(RESUME_SETTINGS_MIN, Math.min(RESUME_SETTINGS_MAX, Math.round(numericValue)));
}

function clampNumber(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, value));
}

function formatRem(value) {
  return `${Number(value.toFixed(4))}rem`;
}

function formatPx(value) {
  return `${Number(value.toFixed(2))}px`;
}

function formatInches(value) {
  return `${Number(value.toFixed(3))}in`;
}

function formatUnitless(value) {
  return Number(value.toFixed(3)).toString();
}

function resolvePresentationBase(template) {
  return RESUME_PRESENTATION_BASES[template] || RESUME_PRESENTATION_BASES[DEFAULT_TEMPLATE];
}

function normalizeStringList(list) {
  const nextList = Array.isArray(list) ? list.map(asText) : [''];
  return nextList.length > 0 ? nextList : [''];
}

function listHasContent(list) {
  return list.some((value) => trimText(value) !== '');
}

function entryHasTextContent(entry, fields) {
  return fields.some((field) => trimText(entry[field]) !== '');
}

function updateEntryField(sectionEntries, entryId, field, value) {
  return sectionEntries.map((entry) => (
    entry.id === entryId ? { ...entry, [field]: value } : entry
  ));
}

function addEntry(sectionEntries, createEntry) {
  return [...sectionEntries, createEntry()];
}

function slugifySectionId(value, fallback = 'section') {
  const slug = trimText(value)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || fallback;
}

function createSectionBlockId(kind, title, index = 0) {
  const suffix = index > 0 ? `-${index + 1}` : '';
  return `${kind}-${slugifySectionId(title, kind)}${suffix}`;
}

export function resolveSectionTitle(sectionTitles, sectionId) {
  const defaultTitle = SECTION_TITLE_DEFAULTS[sectionId] || '';
  const customTitle = trimText(sectionTitles?.[sectionId]);
  return customTitle || defaultTitle;
}

export function normalizeResumeSettings(candidate) {
  const settings = candidate && typeof candidate === 'object' ? candidate : {};

  return Object.fromEntries(
    Object.entries(RESUME_SETTINGS_DEFAULTS).map(([settingId, defaultValue]) => [
      settingId,
      clampResumeSettingValue(settings[settingId] ?? defaultValue)
    ])
  );
}

export function createResumeStorageKey(resumeId) {
  return `${RESUME_STORAGE_KEY_PREFIX}${resumeId}`;
}

export function normalizeWorkspaceIndex(candidate) {
  const index = candidate && typeof candidate === 'object' ? candidate : {};
  const requestedResumeIds = Array.isArray(index.resumeIds)
    ? index.resumeIds.filter((resumeId) => trimText(resumeId) !== '')
    : [];
  const resumeIds = Array.from(new Set(requestedResumeIds));
  const rawMeta = index.meta && typeof index.meta === 'object' ? index.meta : {};
  const meta = Object.fromEntries(
    resumeIds.map((resumeId, indexPosition) => {
      const sourceMeta = rawMeta[resumeId] && typeof rawMeta[resumeId] === 'object' ? rawMeta[resumeId] : {};
      const fallbackName = `${DEFAULT_RESUME_LABEL} ${indexPosition + 1}`;

      return [
        resumeId,
        {
          name: normalizeWorkspaceResumeName(sourceMeta.name, fallbackName),
          updatedAt: asText(sourceMeta.updatedAt)
        }
      ];
    })
  );

  return {
    activeResumeId: resumeIds.includes(index.activeResumeId) ? index.activeResumeId : (resumeIds[0] || ''),
    resumeIds,
    meta
  };
}

export function reorderWorkspaceResumes(workspace, sourceResumeId, targetResumeId, placement = 'before') {
  const normalizedWorkspace = normalizeWorkspaceIndex(workspace);

  if (!sourceResumeId || !targetResumeId || sourceResumeId === targetResumeId) {
    return normalizedWorkspace;
  }

  const currentIndex = normalizedWorkspace.resumeIds.indexOf(sourceResumeId);
  const targetIndex = normalizedWorkspace.resumeIds.indexOf(targetResumeId);

  if (currentIndex < 0 || targetIndex < 0) {
    return normalizedWorkspace;
  }

  const nextResumeIds = normalizedWorkspace.resumeIds.filter((resumeId) => resumeId !== sourceResumeId);
  const targetIndexAfterRemoval = nextResumeIds.indexOf(targetResumeId);

  if (targetIndexAfterRemoval < 0) {
    return normalizedWorkspace;
  }

  const insertionIndex = placement === 'after'
    ? targetIndexAfterRemoval + 1
    : targetIndexAfterRemoval;

  nextResumeIds.splice(insertionIndex, 0, sourceResumeId);

  return normalizeWorkspaceIndex({
    ...normalizedWorkspace,
    resumeIds: nextResumeIds,
  });
}

export function reorderWorkspaceResumesToMatch(workspace, orderedResumeIds) {
  const normalizedWorkspace = normalizeWorkspaceIndex(workspace);
  const requestedOrder = Array.from(new Set(
    (Array.isArray(orderedResumeIds) ? orderedResumeIds : [])
      .filter((resumeId) => trimText(resumeId) !== '')
  ));

  if (
    requestedOrder.length !== normalizedWorkspace.resumeIds.length ||
    requestedOrder.some((resumeId) => !normalizedWorkspace.resumeIds.includes(resumeId))
  ) {
    return normalizedWorkspace;
  }

  return normalizeWorkspaceIndex({
    ...normalizedWorkspace,
    resumeIds: requestedOrder,
  });
}

export function createEmptyWorkspaceIndex() {
  return {
    activeResumeId: '',
    resumeIds: [],
    meta: {}
  };
}

export function createWorkspaceResumeMeta(name, updatedAt = '') {
  return {
    name: sanitizeWorkspaceResumeName(name, DEFAULT_RESUME_LABEL),
    updatedAt: asText(updatedAt)
  };
}

export function createNextResumeName(existingNames) {
  const normalizedNames = new Set(
    (Array.isArray(existingNames) ? existingNames : [])
      .map((name) => trimText(name).toLowerCase())
      .filter(Boolean)
  );
  let nextNumber = 1;

  while (normalizedNames.has(`${DEFAULT_RESUME_LABEL.toLowerCase()} ${nextNumber}`)) {
    nextNumber += 1;
  }

  return `${DEFAULT_RESUME_LABEL} ${nextNumber}`;
}

export function createDuplicateResumeName(sourceName, existingNames) {
  const baseName = sanitizeWorkspaceResumeName(sourceName, DEFAULT_RESUME_LABEL);
  const normalizedNames = new Set(
    (Array.isArray(existingNames) ? existingNames : [])
      .map((name) => trimText(name).toLowerCase())
      .filter(Boolean)
  );
  const buildCopyName = (copyNumber) => {
    const suffix = copyNumber > 1 ? ` copy ${copyNumber}` : ' copy';
    const maxBaseLength = Math.max(1, MAX_WORKSPACE_RESUME_NAME_LENGTH - suffix.length);
    const nextBaseName = sanitizeWorkspaceResumeName(baseName, DEFAULT_RESUME_LABEL)
      .slice(0, maxBaseLength)
      .trim();

    return `${nextBaseName || DEFAULT_RESUME_LABEL.slice(0, maxBaseLength)}${suffix}`;
  };
  const firstCopyName = buildCopyName(1);

  if (!normalizedNames.has(firstCopyName.toLowerCase())) {
    return firstCopyName;
  }

  let nextCopyNumber = 2;

  while (normalizedNames.has(buildCopyName(nextCopyNumber).toLowerCase())) {
    nextCopyNumber += 1;
  }

  return buildCopyName(nextCopyNumber);
}

export function createWorkspaceFromLegacyDraft(payload) {
  const resumeId = createId();
  const normalizedDraft = normalizeDraftPayload(payload);
  const resumeName = `${DEFAULT_RESUME_LABEL} 1`;

  return {
    workspace: {
      activeResumeId: resumeId,
      resumeIds: [resumeId],
      meta: {
        [resumeId]: createWorkspaceResumeMeta(resumeName, asText(payload?.savedAt))
      }
    },
    activeResumeId: resumeId,
    draft: {
      ...normalizedDraft,
      savedAt: payload?.savedAt || null
    }
  };
}

export function createFreshWorkspaceDraft(name = `${DEFAULT_RESUME_LABEL} 1`) {
  const resumeId = createId();

  return {
    workspace: {
      activeResumeId: resumeId,
      resumeIds: [resumeId],
      meta: {
        [resumeId]: createWorkspaceResumeMeta(name)
      }
    },
    activeResumeId: resumeId,
    draft: {
      resume: createEmptyResume(),
      template: DEFAULT_TEMPLATE,
      sectionOrder: SECTION_IDS,
      savedAt: null
    }
  };
}

function normalizeSectionTitles(sectionTitles) {
  return Object.fromEntries(
    Object.keys(SECTION_TITLE_DEFAULTS).map((sectionId) => [sectionId, resolveSectionTitle(sectionTitles, sectionId)])
  );
}

function removeEntry(sectionEntries, entryId) {
  if (sectionEntries.length <= 1) {
    return sectionEntries;
  }

  return sectionEntries.filter((entry) => entry.id !== entryId);
}

function updateEntryStringList(entries, entryId, field, itemIndex, value) {
  return entries.map((entry) => (
    entry.id === entryId
      ? {
          ...entry,
          [field]: entry[field].map((item, index) => (index === itemIndex ? value : item))
        }
      : entry
  ));
}

function addEntryStringListItem(entries, entryId, field) {
  return entries.map((entry) => (
    entry.id === entryId
      ? { ...entry, [field]: [...entry[field], ''] }
      : entry
  ));
}

function moveEntryStringListItem(entries, entryId, field, itemIndex, direction) {
  return entries.map((entry) => (
    entry.id === entryId
      ? { ...entry, [field]: reorderList(entry[field], itemIndex, itemIndex + direction) }
      : entry
  ));
}

function removeEntryStringListItem(entries, entryId, field, itemIndex) {
  return entries.map((entry) => {
    if (entry.id !== entryId) {
      return entry;
    }

    if (entry[field].length <= 1) {
      return { ...entry, [field]: [''] };
    }

    return {
      ...entry,
      [field]: entry[field].filter((_, index) => index !== itemIndex)
    };
  });
}

export function trimText(value) {
  return asText(value).trim();
}

export function formatPhoneForPreview(value) {
  const rawValue = trimText(value);
  const digits = rawValue.replace(/\D/g, '');

  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }

  return rawValue;
}

export function normalizeUrl(value) {
  const rawValue = trimText(value);

  if (!rawValue) {
    return '';
  }

  const prefixedValue = /^[a-z][a-z\d+\-.]*:\/\//i.test(rawValue) ? rawValue : `https://${rawValue}`;

  try {
    const url = new URL(prefixedValue);

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return '';
    }

    return url.toString();
  } catch {
    return '';
  }
}

export function formatUrlForDisplay(value) {
  const normalizedUrl = normalizeUrl(value);

  if (!normalizedUrl) {
    return trimText(value);
  }

  const url = new URL(normalizedUrl);
  const path = url.pathname === '/' ? '' : url.pathname.replace(/\/$/, '');
  return `${url.hostname.replace(/^www\./, '')}${path}`;
}

export function normalizeBulletText(value) {
  return trimText(value).replace(/^[\s\-*•]+/, '');
}

function createEducationCustomSection(overrides = {}) {
  const source = overrides && typeof overrides === 'object' ? overrides : {};

  return {
    id: source.id || createId(),
    label: asText(source.label),
    content: asText(source.content)
  };
}

export function ensureEducationCustomSections(customSections, { allowEmpty = false } = {}) {
  const nextSections = Array.isArray(customSections)
    ? customSections.map((section) => createEducationCustomSection(section))
    : [];

  if (nextSections.length > 0) {
    return nextSections;
  }

  return allowEmpty ? [] : [createEducationCustomSection()];
}

function normalizeEducationCustomSections(overrides = {}) {
  const explicitSections = ensureEducationCustomSections(overrides.customSections, { allowEmpty: true });
  const legacyDescription = asText(overrides.description);
  const legacyContent = asText(overrides.customSection) || legacyDescription;
  const legacyLabel = asText(overrides.customSectionLabel);

  if (explicitSections.length > 0) {
    return explicitSections;
  }

  if (legacyLabel || legacyContent) {
    return [createEducationCustomSection({ label: legacyLabel, content: legacyContent })];
  }

  return [createEducationCustomSection()];
}

function createEducationProgram(overrides = {}) {
  const source = overrides && typeof overrides === 'object' ? overrides : {};

  return {
    id: source.id || createId(),
    degree: asText(source.degree),
    yearsEdu: asText(source.yearsEdu),
    gpa: asText(source.gpa),
    honors: asText(source.honors)
  };
}

function normalizeEducationPrograms(overrides = {}) {
  return Array.isArray(overrides.programs)
    ? overrides.programs.map(createEducationProgram).filter((program) => (
        [program.degree, program.yearsEdu, program.gpa, program.honors].some((value) => trimText(value) !== '')
      ))
    : [];
}

export function normalizeSectionOrder(candidate) {
  const requestedOrder = Array.isArray(candidate)
    ? candidate.filter((sectionId) => SECTION_IDS.includes(sectionId))
    : [];
  const dedupedOrder = Array.from(new Set(requestedOrder));
  const remainingSections = SECTION_IDS.filter((sectionId) => !dedupedOrder.includes(sectionId));
  const nextOrder = [...dedupedOrder, ...remainingSections].filter((sectionId) => sectionId !== 'personal');

  return ['personal', ...nextOrder];
}

export function createEducationEntry(overrides = {}) {
  return {
    id: overrides.id || createId(),
    school: asText(overrides.school),
    degree: asText(overrides.degree),
    yearsEdu: asText(overrides.yearsEdu),
    location: asText(overrides.location),
    gpa: asText(overrides.gpa),
    honors: asText(overrides.honors),
    coursework: asText(overrides.coursework),
    awards: asText(overrides.awards),
    programs: normalizeEducationPrograms(overrides),
    customSections: normalizeEducationCustomSections(overrides)
  };
}

export function createExperienceEntry(overrides = {}) {
  return {
    id: overrides.id || createId(),
    company: asText(overrides.company),
    role: asText(overrides.role),
    groupLabel: asText(overrides.groupLabel),
    activities: normalizeStringList(overrides.activities),
    yearsExp: asText(overrides.yearsExp)
  };
}

export function createSkillsEntry(overrides = {}) {
  return {
    id: overrides.id || createId(),
    category: asText(overrides.category),
    items: asText(overrides.items)
  };
}

export function createProjectEntry(overrides = {}) {
  return {
    id: overrides.id || createId(),
    name: asText(overrides.name),
    subtitle: asText(overrides.subtitle),
    years: asText(overrides.years),
    summary: asText(overrides.summary),
    highlights: normalizeStringList(overrides.highlights)
  };
}

export function createCertificationEntry(overrides = {}) {
  return {
    id: overrides.id || createId(),
    name: asText(overrides.name),
    issuer: asText(overrides.issuer),
    years: asText(overrides.years),
    details: asText(overrides.details)
  };
}

export function createVolunteeringEntry(overrides = {}) {
  return {
    id: overrides.id || createId(),
    organization: asText(overrides.organization),
    role: asText(overrides.role),
    years: asText(overrides.years),
    highlights: normalizeStringList(overrides.highlights)
  };
}

export function createLeadershipEntry(overrides = {}) {
  return {
    id: overrides.id || createId(),
    organization: asText(overrides.organization),
    role: asText(overrides.role),
    years: asText(overrides.years),
    highlights: normalizeStringList(overrides.highlights)
  };
}

export function createLanguageEntry(overrides = {}) {
  return {
    id: overrides.id || createId(),
    language: asText(overrides.language),
    proficiency: asText(overrides.proficiency)
  };
}

export function createAwardEntry(overrides = {}) {
  return {
    id: overrides.id || createId(),
    title: asText(overrides.title),
    issuer: asText(overrides.issuer),
    years: asText(overrides.years),
    details: asText(overrides.details)
  };
}

export function createPublicationEntry(overrides = {}) {
  return {
    id: overrides.id || createId(),
    title: asText(overrides.title),
    publisher: asText(overrides.publisher),
    years: asText(overrides.years),
    details: asText(overrides.details)
  };
}

export function createRoleEntry(overrides = {}) {
  return {
    id: overrides.id || createId(),
    company: asText(overrides.company) || asText(overrides.organization),
    role: asText(overrides.role),
    groupLabel: asText(overrides.groupLabel),
    yearsExp: asText(overrides.yearsExp) || asText(overrides.years),
    activities: normalizeStringList(overrides.activities || overrides.highlights)
  };
}

function createCustomBlockEntry(overrides = {}) {
  return {
    id: overrides.id || createId(),
    title: asText(overrides.title) || asText(overrides.label),
    subtitle: asText(overrides.subtitle),
    years: asText(overrides.years),
    details: asText(overrides.details) || asText(overrides.content),
    highlights: normalizeStringList(overrides.highlights)
  };
}

const SECTION_ENTRY_CREATORS = {
  skills: createSkillsEntry,
  projects: createProjectEntry,
  certifications: createCertificationEntry,
  volunteering: createVolunteeringEntry,
  leadership: createLeadershipEntry,
  languages: createLanguageEntry,
  awards: createAwardEntry,
  publications: createPublicationEntry
};

const SECTION_BLOCK_ENTRY_CREATORS = {
  education: createEducationEntry,
  roles: createRoleEntry,
  skills: createSkillsEntry,
  projects: createProjectEntry,
  certifications: createCertificationEntry,
  languages: createLanguageEntry,
  awards: createAwardEntry,
  publications: createPublicationEntry,
  custom: createCustomBlockEntry
};

function normalizeSectionBlockKind(kind) {
  return SECTION_BLOCK_KINDS.includes(kind) ? kind : 'custom';
}

function normalizeSectionBlockEntries(kind, entries) {
  const createEntry = SECTION_BLOCK_ENTRY_CREATORS[kind] || createCustomBlockEntry;
  return Array.isArray(entries) ? entries.map(createEntry) : [];
}

function getLegacySectionBlockEntries(section, kind, legacyResume) {
  const legacySectionId = section.legacySectionId;

  if (!legacySectionId || !legacyResume || typeof legacyResume !== 'object') {
    return null;
  }

  if (legacySectionId === 'experience') {
    return Array.isArray(legacyResume.experience)
      ? legacyResume.experience.map((entry) => createRoleEntry({
          ...entry,
          groupLabel: trimText(entry.groupLabel) || section.title
        }))
      : null;
  }

  if (ROLE_LEGACY_SECTION_IDS.has(legacySectionId)) {
    return Array.isArray(legacyResume[legacySectionId])
      ? legacyResume[legacySectionId].map((entry) => createRoleEntry({
          id: entry.id,
          company: entry.organization,
          role: entry.role,
          yearsExp: entry.years,
          activities: entry.highlights,
          groupLabel: section.title
        }))
      : null;
  }

  if (LEGACY_SECTION_KIND_MAP[legacySectionId] === kind && Array.isArray(legacyResume[legacySectionId])) {
    return legacyResume[legacySectionId];
  }

  return null;
}

function createRoleBlocksFromExperience(entries, title, baseId = 'experience', legacySectionId = 'experience') {
  const hasGroupLabels = entries.some((entry) => trimText(entry.groupLabel) !== '');

  if (!hasGroupLabels) {
    return [{
      id: baseId,
      kind: 'roles',
      title,
      legacySectionId,
      entries: entries.map((entry) => createRoleEntry({ ...entry, groupLabel: entry.groupLabel || title }))
    }];
  }

  const blocks = [];
  const seenLabels = new Map();

  entries.forEach((entry) => {
    const groupTitle = trimText(entry.groupLabel) || title;
    const key = slugifySectionId(groupTitle, baseId);
    let block = blocks[blocks.length - 1];

    if (!block || slugifySectionId(block.title, baseId) !== key) {
      const occurrence = seenLabels.get(key) || 0;
      seenLabels.set(key, occurrence + 1);
      block = {
        id: occurrence === 0 && groupTitle === title ? baseId : createSectionBlockId('roles', groupTitle, occurrence),
        kind: 'roles',
        title: groupTitle,
        legacySectionId,
        entries: []
      };
      blocks.push(block);
    }

    block.entries.push(createRoleEntry({ ...entry, groupLabel: groupTitle }));
  });

  return blocks;
}

function createRoleBlocksFromLegacySection(entries, title, legacySectionId) {
  const roleEntries = entries.map((entry) => createRoleEntry({
    id: entry.id,
    company: entry.organization,
    role: entry.role,
    yearsExp: entry.years,
    activities: entry.highlights,
    groupLabel: title
  }));

  return [{
    id: legacySectionId,
    kind: 'roles',
    title,
    legacySectionId,
    entries: roleEntries
  }];
}

export function createSectionBlocksFromLegacyResume(resume, sectionOrder = SECTION_IDS) {
  const normalizedOrder = normalizeSectionOrder(sectionOrder);
  const blocks = [];

  normalizedOrder.forEach((sectionId) => {
    if (sectionId === 'personal') {
      return;
    }

    const kind = LEGACY_SECTION_KIND_MAP[sectionId];
    const title = resolveSectionTitle(resume.sectionTitles, sectionId);

    if (!kind) {
      return;
    }

    if (sectionId === 'experience') {
      blocks.push(...createRoleBlocksFromExperience(resume.experience, title, 'experience', sectionId));
      return;
    }

    if (ROLE_LEGACY_SECTION_IDS.has(sectionId)) {
      blocks.push(...createRoleBlocksFromLegacySection(resume[sectionId], title, sectionId));
      return;
    }

    blocks.push({
      id: sectionId,
      kind,
      title,
      legacySectionId: sectionId,
      entries: normalizeSectionBlockEntries(kind, resume[sectionId])
    });
  });

  return blocks;
}

export function normalizeResumeSections(candidate, legacyResume, sectionOrder = SECTION_IDS, options = {}) {
  const candidateSections = Array.isArray(candidate) ? candidate : [];
  const normalizedBlocks = [];
  const usedIds = new Set();
  const refreshLegacyEntries = options.refreshLegacyEntries === true;

  candidateSections.forEach((section, index) => {
    if (!section || typeof section !== 'object') {
      return;
    }

    const kind = normalizeSectionBlockKind(section.kind);
    const fallbackTitle = SECTION_TITLE_DEFAULTS[section.legacySectionId] || (kind === 'roles' ? 'Experience' : 'Custom');
    const title = trimText(section.title) || fallbackTitle;
    const rawId = trimText(section.id) || createSectionBlockId(kind, title, index);
    let id = rawId;
    let duplicateIndex = 2;

    while (usedIds.has(id) || id === 'personal') {
      id = `${rawId}-${duplicateIndex}`;
      duplicateIndex += 1;
    }

    usedIds.add(id);
    const legacyEntries = refreshLegacyEntries ? getLegacySectionBlockEntries({ ...section, title }, kind, legacyResume) : null;

    normalizedBlocks.push({
      id,
      kind,
      title,
      legacySectionId: Object.hasOwn(LEGACY_SECTION_KIND_MAP, section.legacySectionId) ? section.legacySectionId : '',
      entries: normalizeSectionBlockEntries(kind, legacyEntries || section.entries)
    });
  });

  return normalizedBlocks.length > 0
    ? normalizedBlocks
    : createSectionBlocksFromLegacyResume(legacyResume, sectionOrder);
}

export function createEmptyResume() {
  const resume = {
    personal: {
      name: '',
      headline: '',
      location: '',
      phone: '',
      email: '',
      linkedinUrl: '',
      portfolioUrl: '',
      githubUrl: '',
      customField: '',
      aboutMe: ''
    },
    settings: normalizeResumeSettings(),
    sectionTitles: normalizeSectionTitles(),
    education: [createEducationEntry()],
    experience: [createExperienceEntry()],
    skills: [createSkillsEntry()],
    projects: [createProjectEntry()],
    certifications: [createCertificationEntry()],
    volunteering: [createVolunteeringEntry()],
    leadership: [createLeadershipEntry()],
    languages: [createLanguageEntry()],
    awards: [createAwardEntry()],
    publications: [createPublicationEntry()]
  };

  return {
    ...resume,
    sections: createSectionBlocksFromLegacyResume(resume, SECTION_IDS)
  };
}

export function normalizeResume(candidate, { sectionOrder = SECTION_IDS } = {}) {
  const resume = candidate && typeof candidate === 'object' ? candidate : {};
  const personal = resume.personal && typeof resume.personal === 'object' ? resume.personal : {};
  const sectionTitles = resume.sectionTitles && typeof resume.sectionTitles === 'object' ? resume.sectionTitles : {};
  const education = Array.isArray(resume.education) ? resume.education : [];
  const experience = Array.isArray(resume.experience) ? resume.experience : [];
  const skills = Array.isArray(resume.skills) ? resume.skills : [];
  const projects = Array.isArray(resume.projects) ? resume.projects : [];
  const certifications = Array.isArray(resume.certifications) ? resume.certifications : [];
  const volunteering = Array.isArray(resume.volunteering) ? resume.volunteering : [];
  const leadership = Array.isArray(resume.leadership) ? resume.leadership : [];
  const languages = Array.isArray(resume.languages) ? resume.languages : [];
  const awards = Array.isArray(resume.awards) ? resume.awards : [];
  const publications = Array.isArray(resume.publications) ? resume.publications : [];
  const legacyCustomLinkLabel = trimText(personal.customLinkLabel);
  const legacyCustomLinkUrl = trimText(personal.customLinkUrl);
  const customField = asText(personal.customField) || (
    legacyCustomLinkLabel && legacyCustomLinkUrl
      ? `${legacyCustomLinkLabel}: ${legacyCustomLinkUrl}`
      : legacyCustomLinkUrl || legacyCustomLinkLabel
  );
  const normalizedResume = {
    personal: {
      name: asText(personal.name),
      headline: asText(personal.headline),
      location: asText(personal.location),
      phone: asText(personal.phone),
      email: asText(personal.email),
      linkedinUrl: asText(personal.linkedinUrl),
      portfolioUrl: asText(personal.portfolioUrl),
      githubUrl: asText(personal.githubUrl),
      customField,
      aboutMe: asText(personal.aboutMe)
    },
    settings: normalizeResumeSettings(resume.settings),
    sectionTitles: normalizeSectionTitles(sectionTitles),
    education: education.length > 0 ? education.map(createEducationEntry) : [createEducationEntry()],
    experience: experience.length > 0 ? experience.map(createExperienceEntry) : [createExperienceEntry()],
    skills: skills.length > 0 ? skills.map(createSkillsEntry) : [createSkillsEntry()],
    projects: projects.length > 0 ? projects.map(createProjectEntry) : [createProjectEntry()],
    certifications: certifications.length > 0 ? certifications.map(createCertificationEntry) : [createCertificationEntry()],
    volunteering: volunteering.length > 0 ? volunteering.map(createVolunteeringEntry) : [createVolunteeringEntry()],
    leadership: leadership.length > 0 ? leadership.map(createLeadershipEntry) : [createLeadershipEntry()],
    languages: languages.length > 0 ? languages.map(createLanguageEntry) : [createLanguageEntry()],
    awards: awards.length > 0 ? awards.map(createAwardEntry) : [createAwardEntry()],
    publications: publications.length > 0 ? publications.map(createPublicationEntry) : [createPublicationEntry()]
  };

  return {
    ...normalizedResume,
    sections: normalizeResumeSections(resume.sections, normalizedResume, sectionOrder, { refreshLegacyEntries: true })
  };
}

export function normalizeDraftPayload(payload) {
  const draft = payload && typeof payload === 'object' ? payload : {};
  const candidateResume = draft.resume && typeof draft.resume === 'object' ? draft.resume : draft;
  const template = TEMPLATE_OPTIONS.some((option) => option.id === draft.template) ? draft.template : DEFAULT_TEMPLATE;
  const sectionOrder = normalizeSectionOrder(draft.sectionOrder);

  return {
    template,
    resume: normalizeResume(candidateResume, { sectionOrder }),
    sectionOrder
  };
}

export function reorderList(list, fromIndex, toIndex) {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= list.length ||
    toIndex >= list.length ||
    fromIndex === toIndex
  ) {
    return list;
  }

  const nextList = [...list];
  const [item] = nextList.splice(fromIndex, 1);
  nextList.splice(toIndex, 0, item);
  return nextList;
}

export function moveItemById(list, entryId, direction) {
  const currentIndex = list.findIndex((item) => item.id === entryId);

  if (currentIndex < 0) {
    return list;
  }

  return reorderList(list, currentIndex, currentIndex + direction);
}

export function moveSectionOrder(sectionOrder, sectionId, direction) {
  const normalizedOrder = normalizeSectionOrder(sectionOrder);

  if (sectionId === 'personal') {
    return normalizedOrder;
  }

  const currentIndex = normalizedOrder.indexOf(sectionId);
  const nextIndex = currentIndex + direction;

  if (currentIndex < 0 || nextIndex < 1 || nextIndex >= normalizedOrder.length) {
    return normalizedOrder;
  }

  return reorderList(normalizedOrder, currentIndex, nextIndex);
}

export function reorderSectionOrder(sectionOrder, sectionId, targetSectionId, placement = 'before') {
  const normalizedOrder = normalizeSectionOrder(sectionOrder);

  if (sectionId === 'personal' || sectionId === targetSectionId) {
    return normalizedOrder;
  }

  const currentIndex = normalizedOrder.indexOf(sectionId);
  const targetIndex = normalizedOrder.indexOf(targetSectionId);

  if (currentIndex < 1 || targetIndex < 0) {
    return normalizedOrder;
  }

  const nextOrder = [...normalizedOrder];
  nextOrder.splice(currentIndex, 1);

  let insertIndex = targetIndex + (placement === 'after' ? 1 : 0);

  if (currentIndex < insertIndex) {
    insertIndex -= 1;
  }

  insertIndex = Math.max(1, Math.min(insertIndex, nextOrder.length));
  nextOrder.splice(insertIndex, 0, sectionId);

  return normalizeSectionOrder(nextOrder);
}

export function reorderSectionOrderToMatch(sectionOrder, orderedSectionIds) {
  const normalizedOrder = normalizeSectionOrder(sectionOrder);
  const requestedOrder = Array.from(new Set(
    (Array.isArray(orderedSectionIds) ? orderedSectionIds : [])
      .filter((sectionId) => trimText(sectionId) !== '' && sectionId !== 'personal')
  ));
  const currentSections = normalizedOrder.filter((sectionId) => sectionId !== 'personal');

  if (
    requestedOrder.length !== currentSections.length ||
    requestedOrder.some((sectionId) => !currentSections.includes(sectionId))
  ) {
    return normalizedOrder;
  }

  return normalizeSectionOrder(['personal', ...requestedOrder]);
}

export function updatePersonalField(resume, field, value) {
  return {
    ...resume,
    personal: {
      ...resume.personal,
      [field]: value
    }
  };
}

function syncLegacyMirrorsFromSections(resume) {
  const sections = normalizeResumeSections(resume.sections, resume);
  const mirrors = {
    education: [],
    experience: [],
    skills: [],
    projects: [],
    certifications: [],
    volunteering: [],
    leadership: [],
    languages: [],
    awards: [],
    publications: []
  };

  sections.forEach((section) => {
    if (section.kind === 'education') {
      mirrors.education.push(...section.entries.map(createEducationEntry));
      return;
    }

    if (section.kind === 'roles') {
      const roleEntries = section.entries.map((entry) => createExperienceEntry({
        ...entry,
        groupLabel: trimText(entry.groupLabel) || section.title
      }));
      mirrors.experience.push(...roleEntries);

      if (section.legacySectionId === 'volunteering') {
        mirrors.volunteering.push(...section.entries.map((entry) => createVolunteeringEntry({
          id: entry.id,
          organization: entry.company,
          role: entry.role,
          years: entry.yearsExp,
          highlights: entry.activities
        })));
      }

      if (section.legacySectionId === 'leadership') {
        mirrors.leadership.push(...section.entries.map((entry) => createLeadershipEntry({
          id: entry.id,
          organization: entry.company,
          role: entry.role,
          years: entry.yearsExp,
          highlights: entry.activities
        })));
      }

      return;
    }

    if (section.kind === 'skills') {
      mirrors.skills.push(...section.entries.map(createSkillsEntry));
      return;
    }

    if (section.kind === 'projects') {
      mirrors.projects.push(...section.entries.map(createProjectEntry));
      return;
    }

    if (section.kind === 'certifications') {
      mirrors.certifications.push(...section.entries.map(createCertificationEntry));
      return;
    }

    if (section.kind === 'languages') {
      mirrors.languages.push(...section.entries.map(createLanguageEntry));
      return;
    }

    if (section.kind === 'awards') {
      mirrors.awards.push(...section.entries.map(createAwardEntry));
      return;
    }

    if (section.kind === 'publications') {
      mirrors.publications.push(...section.entries.map(createPublicationEntry));
    }
  });

  return {
    ...resume,
    sections,
    education: mirrors.education.length > 0 ? mirrors.education : [createEducationEntry()],
    experience: mirrors.experience.length > 0 ? mirrors.experience : [createExperienceEntry()],
    skills: mirrors.skills.length > 0 ? mirrors.skills : [createSkillsEntry()],
    projects: mirrors.projects.length > 0 ? mirrors.projects : [createProjectEntry()],
    certifications: mirrors.certifications.length > 0 ? mirrors.certifications : [createCertificationEntry()],
    volunteering: mirrors.volunteering.length > 0 ? mirrors.volunteering : [createVolunteeringEntry()],
    leadership: mirrors.leadership.length > 0 ? mirrors.leadership : [createLeadershipEntry()],
    languages: mirrors.languages.length > 0 ? mirrors.languages : [createLanguageEntry()],
    awards: mirrors.awards.length > 0 ? mirrors.awards : [createAwardEntry()],
    publications: mirrors.publications.length > 0 ? mirrors.publications : [createPublicationEntry()]
  };
}

export function moveResumeSectionBlock(resume, sectionId, direction) {
  if (sectionId === 'personal') {
    return resume;
  }

  const sections = normalizeResumeSections(resume.sections, resume);
  const currentIndex = sections.findIndex((section) => section.id === sectionId);
  const nextIndex = currentIndex + direction;

  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= sections.length) {
    return resume;
  }

  return {
    ...resume,
    sections: reorderList(sections, currentIndex, nextIndex)
  };
}

export function reorderResumeSectionBlock(resume, sectionId, targetSectionId, placement = 'before') {
  if (sectionId === 'personal' || sectionId === targetSectionId) {
    return resume;
  }

  const sections = normalizeResumeSections(resume.sections, resume);
  const currentIndex = sections.findIndex((section) => section.id === sectionId);
  const targetIndex = sections.findIndex((section) => section.id === targetSectionId);

  if (currentIndex < 0 || targetIndex < 0) {
    return resume;
  }

  const nextSections = [...sections];
  const [section] = nextSections.splice(currentIndex, 1);
  let insertIndex = targetIndex + (placement === 'after' ? 1 : 0);

  if (currentIndex < insertIndex) {
    insertIndex -= 1;
  }

  insertIndex = Math.max(0, Math.min(insertIndex, nextSections.length));
  nextSections.splice(insertIndex, 0, section);

  return syncLegacyMirrorsFromSections({
    ...resume,
    sections: nextSections
  });
}

export function reorderResumeSectionBlocksToMatch(resume, orderedSectionIds) {
  const sections = normalizeResumeSections(resume.sections, resume);
  const requestedOrder = Array.from(new Set(
    (Array.isArray(orderedSectionIds) ? orderedSectionIds : [])
      .filter((sectionId) => trimText(sectionId) !== '' && sectionId !== 'personal')
  ));

  if (
    requestedOrder.length !== sections.length ||
    requestedOrder.some((sectionId) => !sections.some((section) => section.id === sectionId))
  ) {
    return resume;
  }

  const sectionsById = new Map(sections.map((section) => [section.id, section]));

  return syncLegacyMirrorsFromSections({
    ...resume,
    sections: requestedOrder.map((sectionId) => sectionsById.get(sectionId))
  });
}

export function removeResumeSectionBlock(resume, sectionId) {
  if (sectionId === 'personal') {
    return resume;
  }

  const sections = normalizeResumeSections(resume.sections, resume);

  if (sections.length <= 1 || !sections.some((section) => section.id === sectionId)) {
    return resume;
  }

  return syncLegacyMirrorsFromSections({
    ...resume,
    sections: sections.filter((section) => section.id !== sectionId)
  });
}

export function updateSectionTitle(resume, sectionId, value) {
  const nextTitle = trimText(value);
  const currentSections = normalizeResumeSections(resume.sections, resume);
  const matchingBlock = currentSections.find((section) => section.id === sectionId);

  if (matchingBlock) {
    const fallbackTitle = matchingBlock.title || SECTION_TITLE_DEFAULTS[matchingBlock.legacySectionId] || 'Custom';
    const resolvedTitle = nextTitle || fallbackTitle;
    const nextSections = currentSections.map((section) => (
      section.id === sectionId
        ? {
            ...section,
            title: resolvedTitle,
            entries: section.kind === 'roles'
              ? section.entries.map((entry) => ({ ...entry, groupLabel: resolvedTitle }))
              : section.entries
          }
        : section
    ));
    const nextResume = {
      ...resume,
      sections: nextSections
    };

    if (!Object.hasOwn(SECTION_TITLE_DEFAULTS, sectionId)) {
      return syncLegacyMirrorsFromSections(nextResume);
    }

    return syncLegacyMirrorsFromSections({
      ...nextResume,
      sectionTitles: {
        ...normalizeSectionTitles(resume.sectionTitles),
        [sectionId]: resolvedTitle
      }
    });
  }

  if (!Object.hasOwn(SECTION_TITLE_DEFAULTS, sectionId)) {
    return resume;
  }

  return {
    ...resume,
    sectionTitles: {
      ...normalizeSectionTitles(resume.sectionTitles),
      [sectionId]: nextTitle || SECTION_TITLE_DEFAULTS[sectionId]
    }
  };
}

export function updateResumeSetting(resume, settingId, delta) {
  if (!Object.hasOwn(RESUME_SETTINGS_DEFAULTS, settingId)) {
    return resume;
  }

  const settings = normalizeResumeSettings(resume.settings);
  const nextValue = clampResumeSettingValue(settings[settingId] + delta);

  if (nextValue === settings[settingId]) {
    return resume;
  }

  return {
    ...resume,
    settings: {
      ...settings,
      [settingId]: nextValue
    }
  };
}

export function updateEducationField(resume, entryId, field, value) {
  return {
    ...resume,
    education: updateEntryField(resume.education, entryId, field, value)
  };
}

export function addEducation(resume) {
  return {
    ...resume,
    education: addEntry(resume.education, createEducationEntry)
  };
}

export function moveEducation(resume, entryId, direction) {
  return {
    ...resume,
    education: moveItemById(resume.education, entryId, direction)
  };
}

export function removeEducation(resume, entryId) {
  const nextEducation = removeEntry(resume.education, entryId);

  if (nextEducation === resume.education) {
    return resume;
  }

  return {
    ...resume,
    education: nextEducation
  };
}

export function updateEducationCustomSection(resume, entryId, sectionIndex, field, value) {
  return {
    ...resume,
    education: resume.education.map((entry) => (
      entry.id === entryId
        ? {
            ...entry,
            customSections: ensureEducationCustomSections(entry.customSections).map((section, index) => (
              index === sectionIndex ? { ...section, [field]: value } : section
            ))
          }
        : entry
    ))
  };
}

export function addEducationCustomSection(resume, entryId) {
  return {
    ...resume,
    education: resume.education.map((entry) => (
      entry.id === entryId
        ? { ...entry, customSections: [...ensureEducationCustomSections(entry.customSections), createEducationCustomSection()] }
        : entry
    ))
  };
}

export function moveEducationCustomSection(resume, entryId, sectionIndex, direction) {
  return {
    ...resume,
    education: resume.education.map((entry) => (
      entry.id === entryId
        ? {
            ...entry,
            customSections: reorderList(ensureEducationCustomSections(entry.customSections), sectionIndex, sectionIndex + direction)
          }
        : entry
    ))
  };
}

export function removeEducationCustomSection(resume, entryId, sectionIndex) {
  return {
    ...resume,
    education: resume.education.map((entry) => {
      if (entry.id !== entryId) {
        return entry;
      }

      const currentSections = ensureEducationCustomSections(entry.customSections);

      if (currentSections.length <= 1) {
        return { ...entry, customSections: [createEducationCustomSection()] };
      }

      return {
        ...entry,
        customSections: currentSections.filter((_, index) => index !== sectionIndex)
      };
    })
  };
}

export function updateExperienceField(resume, entryId, field, value) {
  return {
    ...resume,
    experience: updateEntryField(resume.experience, entryId, field, value)
  };
}

export function addExperience(resume) {
  return {
    ...resume,
    experience: addEntry(resume.experience, createExperienceEntry)
  };
}

export function moveExperience(resume, entryId, direction) {
  return {
    ...resume,
    experience: moveItemById(resume.experience, entryId, direction)
  };
}

export function removeExperience(resume, entryId) {
  const nextExperience = removeEntry(resume.experience, entryId);

  if (nextExperience === resume.experience) {
    return resume;
  }

  return {
    ...resume,
    experience: nextExperience
  };
}

export function updateActivity(resume, entryId, activityIndex, value) {
  return {
    ...resume,
    experience: updateEntryStringList(resume.experience, entryId, 'activities', activityIndex, value)
  };
}

export function addActivity(resume, entryId) {
  return {
    ...resume,
    experience: addEntryStringListItem(resume.experience, entryId, 'activities')
  };
}

export function moveActivity(resume, entryId, activityIndex, direction) {
  return {
    ...resume,
    experience: moveEntryStringListItem(resume.experience, entryId, 'activities', activityIndex, direction)
  };
}

export function removeActivity(resume, entryId, activityIndex) {
  return {
    ...resume,
    experience: removeEntryStringListItem(resume.experience, entryId, 'activities', activityIndex)
  };
}

function updateRoleSectionEntries(resume, sectionId, transform) {
  const sections = normalizeResumeSections(resume.sections, resume);
  const nextSections = sections.map((section) => (
    section.id === sectionId && section.kind === 'roles'
      ? {
          ...section,
          entries: transform(section.entries, section).map((entry) => createRoleEntry({
            ...entry,
            groupLabel: trimText(entry.groupLabel) || section.title
          }))
        }
      : section
  ));

  return syncLegacyMirrorsFromSections({
    ...resume,
    sections: nextSections
  });
}

export function updateRoleBlockEntry(resume, sectionId, entryId, field, value) {
  return updateRoleSectionEntries(resume, sectionId, (entries) => updateEntryField(entries, entryId, field, value));
}

export function addRoleBlockEntry(resume, sectionId) {
  return updateRoleSectionEntries(resume, sectionId, (entries, section) => [
    ...entries,
    createRoleEntry({ groupLabel: section.title })
  ]);
}

export function moveRoleBlockEntry(resume, sectionId, entryId, direction) {
  return updateRoleSectionEntries(resume, sectionId, (entries) => moveItemById(entries, entryId, direction));
}

export function removeRoleBlockEntry(resume, sectionId, entryId) {
  return updateRoleSectionEntries(resume, sectionId, (entries) => {
    if (entries.length <= 1) {
      return entries;
    }

    return entries.filter((entry) => entry.id !== entryId);
  });
}

export function updateRoleBlockActivity(resume, sectionId, entryId, activityIndex, value) {
  return updateRoleSectionEntries(resume, sectionId, (entries) => (
    updateEntryStringList(entries, entryId, 'activities', activityIndex, value)
  ));
}

export function addRoleBlockActivity(resume, sectionId, entryId) {
  return updateRoleSectionEntries(resume, sectionId, (entries) => (
    addEntryStringListItem(entries, entryId, 'activities')
  ));
}

export function moveRoleBlockActivity(resume, sectionId, entryId, activityIndex, direction) {
  return updateRoleSectionEntries(resume, sectionId, (entries) => (
    moveEntryStringListItem(entries, entryId, 'activities', activityIndex, direction)
  ));
}

export function removeRoleBlockActivity(resume, sectionId, entryId, activityIndex) {
  return updateRoleSectionEntries(resume, sectionId, (entries) => (
    removeEntryStringListItem(entries, entryId, 'activities', activityIndex)
  ));
}

function updateSectionBlockEntries(resume, sectionId, transform) {
  const sections = normalizeResumeSections(resume.sections, resume);
  let didUpdate = false;
  const nextSections = sections.map((section) => {
    if (section.id !== sectionId) {
      return section;
    }

    didUpdate = true;

    return {
      ...section,
      entries: normalizeSectionBlockEntries(section.kind, transform(section.entries, section))
    };
  });

  if (!didUpdate) {
    return resume;
  }

  return syncLegacyMirrorsFromSections({
    ...resume,
    sections: nextSections
  });
}

export function updateSectionBlockEntry(resume, sectionId, entryId, field, value) {
  return updateSectionBlockEntries(resume, sectionId, (entries) => updateEntryField(entries, entryId, field, value));
}

export function addSectionBlockEntry(resume, sectionId) {
  return updateSectionBlockEntries(resume, sectionId, (entries, section) => {
    const createEntry = SECTION_BLOCK_ENTRY_CREATORS[section.kind] || createCustomBlockEntry;
    const nextEntry = section.kind === 'roles'
      ? createRoleEntry({ groupLabel: section.title })
      : createEntry();

    return [...entries, nextEntry];
  });
}

export function moveSectionBlockEntry(resume, sectionId, entryId, direction) {
  return updateSectionBlockEntries(resume, sectionId, (entries) => moveItemById(entries, entryId, direction));
}

export function removeSectionBlockEntry(resume, sectionId, entryId) {
  return updateSectionBlockEntries(resume, sectionId, (entries) => removeEntry(entries, entryId));
}

export function updateSectionBlockTextList(resume, sectionId, entryId, field, itemIndex, value) {
  return updateSectionBlockEntries(resume, sectionId, (entries) => updateEntryStringList(entries, entryId, field, itemIndex, value));
}

export function addSectionBlockTextListItem(resume, sectionId, entryId, field) {
  return updateSectionBlockEntries(resume, sectionId, (entries) => addEntryStringListItem(entries, entryId, field));
}

export function moveSectionBlockTextListItem(resume, sectionId, entryId, field, itemIndex, direction) {
  return updateSectionBlockEntries(resume, sectionId, (entries) => moveEntryStringListItem(entries, entryId, field, itemIndex, direction));
}

export function removeSectionBlockTextListItem(resume, sectionId, entryId, field, itemIndex) {
  return updateSectionBlockEntries(resume, sectionId, (entries) => removeEntryStringListItem(entries, entryId, field, itemIndex));
}

export function updateSectionBlockEducationCustomSection(resume, sectionId, entryId, sectionIndex, field, value) {
  return updateSectionBlockEntries(resume, sectionId, (entries) => (
    entries.map((entry) => (
      entry.id === entryId
        ? {
            ...entry,
            customSections: ensureEducationCustomSections(entry.customSections).map((section, index) => (
              index === sectionIndex ? { ...section, [field]: value } : section
            ))
          }
        : entry
    ))
  ));
}

export function addSectionBlockEducationCustomSection(resume, sectionId, entryId) {
  return updateSectionBlockEntries(resume, sectionId, (entries) => (
    entries.map((entry) => (
      entry.id === entryId
        ? { ...entry, customSections: [...ensureEducationCustomSections(entry.customSections), createEducationCustomSection()] }
        : entry
    ))
  ));
}

export function moveSectionBlockEducationCustomSection(resume, sectionId, entryId, sectionIndex, direction) {
  return updateSectionBlockEntries(resume, sectionId, (entries) => (
    entries.map((entry) => (
      entry.id === entryId
        ? {
            ...entry,
            customSections: reorderList(ensureEducationCustomSections(entry.customSections), sectionIndex, sectionIndex + direction)
          }
        : entry
    ))
  ));
}

export function removeSectionBlockEducationCustomSection(resume, sectionId, entryId, sectionIndex) {
  return updateSectionBlockEntries(resume, sectionId, (entries) => (
    entries.map((entry) => {
      if (entry.id !== entryId) {
        return entry;
      }

      const currentSections = ensureEducationCustomSections(entry.customSections);

      if (currentSections.length <= 1) {
        return { ...entry, customSections: [createEducationCustomSection()] };
      }

      return {
        ...entry,
        customSections: currentSections.filter((_, index) => index !== sectionIndex)
      };
    })
  ));
}

export function updateSectionBlockEducationProgram(resume, sectionId, entryId, programIndex, field, value) {
  return updateSectionBlockEntries(resume, sectionId, (entries) => (
    entries.map((entry) => (
      entry.id === entryId
        ? {
            ...entry,
            programs: entry.programs.map((program, index) => (
              index === programIndex ? createEducationProgram({ ...program, [field]: value }) : program
            ))
          }
        : entry
    ))
  ));
}

export function addSectionBlockEducationProgram(resume, sectionId, entryId) {
  return updateSectionBlockEntries(resume, sectionId, (entries) => (
    entries.map((entry) => (
      entry.id === entryId
        ? { ...entry, programs: [...entry.programs, createEducationProgram()] }
        : entry
    ))
  ));
}

export function moveSectionBlockEducationProgram(resume, sectionId, entryId, programIndex, direction) {
  return updateSectionBlockEntries(resume, sectionId, (entries) => (
    entries.map((entry) => (
      entry.id === entryId
        ? { ...entry, programs: reorderList(entry.programs, programIndex, programIndex + direction) }
        : entry
    ))
  ));
}

export function removeSectionBlockEducationProgram(resume, sectionId, entryId, programIndex) {
  return updateSectionBlockEntries(resume, sectionId, (entries) => (
    entries.map((entry) => {
      if (entry.id !== entryId || entry.programs.length <= 1) {
        return entry;
      }

      return {
        ...entry,
        programs: entry.programs.filter((_, index) => index !== programIndex)
      };
    })
  ));
}

export function updateCollectionEntry(resume, sectionKey, entryId, field, value) {
  return {
    ...resume,
    [sectionKey]: updateEntryField(resume[sectionKey], entryId, field, value)
  };
}

export function addCollectionEntry(resume, sectionKey) {
  return {
    ...resume,
    [sectionKey]: addEntry(resume[sectionKey], SECTION_ENTRY_CREATORS[sectionKey])
  };
}

export function moveCollectionEntry(resume, sectionKey, entryId, direction) {
  return {
    ...resume,
    [sectionKey]: moveItemById(resume[sectionKey], entryId, direction)
  };
}

export function removeCollectionEntry(resume, sectionKey, entryId) {
  const nextEntries = removeEntry(resume[sectionKey], entryId);

  if (nextEntries === resume[sectionKey]) {
    return resume;
  }

  return {
    ...resume,
    [sectionKey]: nextEntries
  };
}

export function updateCollectionTextList(resume, sectionKey, entryId, field, itemIndex, value) {
  return {
    ...resume,
    [sectionKey]: updateEntryStringList(resume[sectionKey], entryId, field, itemIndex, value)
  };
}

export function addCollectionTextListItem(resume, sectionKey, entryId, field) {
  return {
    ...resume,
    [sectionKey]: addEntryStringListItem(resume[sectionKey], entryId, field)
  };
}

export function moveCollectionTextListItem(resume, sectionKey, entryId, field, itemIndex, direction) {
  return {
    ...resume,
    [sectionKey]: moveEntryStringListItem(resume[sectionKey], entryId, field, itemIndex, direction)
  };
}

export function removeCollectionTextListItem(resume, sectionKey, entryId, field, itemIndex) {
  return {
    ...resume,
    [sectionKey]: removeEntryStringListItem(resume[sectionKey], entryId, field, itemIndex)
  };
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
    personal.aboutMe
  ].some((value) => trimText(value) !== '');
}

export function educationEntryHasContent(entry) {
  const hasCustomSectionContent = ensureEducationCustomSections(entry.customSections, { allowEmpty: true }).some((section) => (
    trimText(section.label) !== '' || trimText(section.content) !== ''
  ));
  const hasProgramContent = Array.isArray(entry.programs) && entry.programs.some((program) => (
    [program.degree, program.yearsEdu, program.gpa, program.honors].some((value) => trimText(value) !== '')
  ));

  return entryHasTextContent(entry, [
    'school',
    'degree',
    'yearsEdu',
    'location',
    'gpa',
    'honors',
    'coursework',
    'awards'
  ]) || hasCustomSectionContent || hasProgramContent;
}

export function experienceEntryHasContent(entry) {
  return entryHasTextContent(entry, ['company', 'role', 'yearsExp']) || listHasContent(entry.activities);
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

export function volunteeringEntryHasContent(entry) {
  return entryHasTextContent(entry, ['organization', 'role', 'years']) || listHasContent(entry.highlights);
}

export function leadershipEntryHasContent(entry) {
  return entryHasTextContent(entry, ['organization', 'role', 'years']) || listHasContent(entry.highlights);
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
      programs: Array.isArray(entry.programs)
        ? entry.programs.map((program, index) => ({
            id: program.id || `${entry.id}-program-${index}`,
            degree: trimText(program.degree),
            yearsEdu: trimText(program.yearsEdu),
            gpa: trimText(program.gpa),
            honors: trimText(program.honors)
          })).filter((program) => [program.degree, program.yearsEdu, program.gpa, program.honors].some((value) => value !== ''))
        : [],
      customSections: ensureEducationCustomSections(entry.customSections, { allowEmpty: true })
        .map((section) => ({
          id: section.id,
          label: trimText(section.label),
          content: trimText(section.content)
        }))
        .filter((section) => section.content !== '')
    }));
}

function toPreviewRoleEntries(entries) {
  return entries
    .filter(experienceEntryHasContent)
    .map((entry) => ({
      id: entry.id,
      company: trimText(entry.company),
      role: trimText(entry.role),
      groupLabel: trimText(entry.groupLabel),
      yearsExp: trimText(entry.yearsExp),
      activities: entry.activities.map(normalizeBulletText).filter((item) => item !== '')
    }));
}

function toPreviewSkillsEntries(entries) {
  return entries
    .filter(skillsEntryHasContent)
    .map((entry) => ({
      id: entry.id,
      category: trimText(entry.category),
      items: trimText(entry.items)
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
      highlights: entry.highlights.map(normalizeBulletText).filter((item) => item !== '')
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
      details: trimText(entry.details)
    }));
}

function toPreviewLanguageEntries(entries) {
  return entries
    .filter(languageEntryHasContent)
    .map((entry) => ({
      id: entry.id,
      language: trimText(entry.language),
      proficiency: trimText(entry.proficiency)
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
      details: trimText(entry.details)
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
      details: trimText(entry.details)
    }));
}

function toPreviewCustomEntries(entries) {
  return entries
    .filter((entry) => [entry.title, entry.subtitle, entry.years, entry.details].some((value) => trimText(value) !== '') || listHasContent(entry.highlights))
    .map((entry) => ({
      id: entry.id,
      title: trimText(entry.title),
      subtitle: trimText(entry.subtitle),
      years: trimText(entry.years),
      details: trimText(entry.details),
      highlights: entry.highlights.map(normalizeBulletText).filter((item) => item !== '')
    }));
}

export function getPreviewModel(resume) {
  const sectionTitles = normalizeSectionTitles(resume.sectionTitles);
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
    aboutMe: trimText(resume.personal.aboutMe)
  };
  const personalLinks = [
    personal.linkedinUrl ? { id: 'linkedin', text: formatUrlForDisplay(personal.linkedinUrl) } : null,
    personal.portfolioUrl ? { id: 'portfolio', text: formatUrlForDisplay(personal.portfolioUrl) } : null,
    personal.githubUrl ? { id: 'github', text: formatUrlForDisplay(personal.githubUrl) } : null,
    personal.customField ? { id: 'custom', text: personal.customField } : null
  ].filter(Boolean);

  const educationEntries = toPreviewEducationEntries(resume.education);
  const experienceEntries = toPreviewRoleEntries(resume.experience);
  const skillsEntries = toPreviewSkillsEntries(resume.skills);
  const projectEntries = toPreviewProjectEntries(resume.projects);
  const certificationEntries = toPreviewCertificationEntries(resume.certifications);

  const volunteeringEntries = resume.volunteering
    .filter(volunteeringEntryHasContent)
    .map((entry) => ({
      id: entry.id,
      organization: trimText(entry.organization),
      role: trimText(entry.role),
      years: trimText(entry.years),
      highlights: entry.highlights.map(normalizeBulletText).filter((item) => item !== '')
    }));

  const leadershipEntries = resume.leadership
    .filter(leadershipEntryHasContent)
    .map((entry) => ({
      id: entry.id,
      organization: trimText(entry.organization),
      role: trimText(entry.role),
      years: trimText(entry.years),
      highlights: entry.highlights.map(normalizeBulletText).filter((item) => item !== '')
    }));

  const languageEntries = toPreviewLanguageEntries(resume.languages);
  const awardEntries = toPreviewAwardEntries(resume.awards);
  const publicationEntries = toPreviewPublicationEntries(resume.publications);
  const roleEntriesByLegacySection = {
    experience: experienceEntries,
    volunteering: toPreviewRoleEntries(resume.volunteering.map((entry) => createRoleEntry({
      id: entry.id,
      company: entry.organization,
      role: entry.role,
      yearsExp: entry.years,
      activities: entry.highlights,
      groupLabel: sectionTitles.volunteering
    }))),
    leadership: toPreviewRoleEntries(resume.leadership.map((entry) => createRoleEntry({
      id: entry.id,
      company: entry.organization,
      role: entry.role,
      yearsExp: entry.years,
      activities: entry.highlights,
      groupLabel: sectionTitles.leadership
    })))
  };
  const fixedPreviewEntriesBySection = {
    education: educationEntries,
    experience: experienceEntries,
    skills: skillsEntries,
    projects: projectEntries,
    certifications: certificationEntries,
    languages: languageEntries,
    awards: awardEntries,
    publications: publicationEntries
  };
  const sectionBlocks = normalizeResumeSections(resume.sections, resume)
    .map((block) => {
      let entries = [];

      if (block.kind === 'roles') {
        entries = block.id === block.legacySectionId && roleEntriesByLegacySection[block.legacySectionId]
          ? roleEntriesByLegacySection[block.legacySectionId]
          : toPreviewRoleEntries(block.entries);
      } else if (block.id === block.legacySectionId && fixedPreviewEntriesBySection[block.legacySectionId]) {
        entries = fixedPreviewEntriesBySection[block.legacySectionId];
      } else if (block.kind === 'education') {
        entries = toPreviewEducationEntries(block.entries);
      } else if (block.kind === 'skills') {
        entries = toPreviewSkillsEntries(block.entries);
      } else if (block.kind === 'projects') {
        entries = toPreviewProjectEntries(block.entries);
      } else if (block.kind === 'certifications') {
        entries = toPreviewCertificationEntries(block.entries);
      } else if (block.kind === 'languages') {
        entries = toPreviewLanguageEntries(block.entries);
      } else if (block.kind === 'awards') {
        entries = toPreviewAwardEntries(block.entries);
      } else if (block.kind === 'publications') {
        entries = toPreviewPublicationEntries(block.entries);
      } else {
        entries = toPreviewCustomEntries(block.entries);
      }

      return {
        id: block.id,
        kind: block.kind,
        title: trimText(block.title),
        legacySectionId: block.legacySectionId,
        entries
      };
    })
    .filter((block) => block.entries.length > 0);

  const hasContent = personalHasContent(personal) || [
    educationEntries,
    experienceEntries,
    skillsEntries,
    projectEntries,
    certificationEntries,
    volunteeringEntries,
    leadershipEntries,
    languageEntries,
    awardEntries,
    publicationEntries,
    sectionBlocks
  ].some((entries) => entries.length > 0);

  return {
    hasContent,
    sectionTitles,
    personal: {
      ...personal,
      links: personalLinks
    },
    educationEntries,
    experienceEntries,
    skillsEntries,
    projectEntries,
    certificationEntries,
    volunteeringEntries,
    leadershipEntries,
    languageEntries,
    awardEntries,
    publicationEntries,
    sectionBlocks,
    showPersonal: personalHasContent(personal),
    showEducation: educationEntries.length > 0,
    showExperience: experienceEntries.length > 0,
    showSkills: skillsEntries.length > 0,
    showProjects: projectEntries.length > 0,
    showCertifications: certificationEntries.length > 0,
    showVolunteering: volunteeringEntries.length > 0,
    showLeadership: leadershipEntries.length > 0,
    showLanguages: languageEntries.length > 0,
    showAwards: awardEntries.length > 0,
    showPublications: publicationEntries.length > 0
  };
}

export function getResumePresentationVars(settings, template) {
  const normalizedSettings = normalizeResumeSettings(settings);
  const base = resolvePresentationBase(template);
  const textScale = 1 + (normalizedSettings.textSize * TEXT_SIZE_STEP);
  const headingScale = 1 + (normalizedSettings.headingSize * HEADING_SIZE_STEP);
  const nameScale = 1 + (normalizedSettings.nameSize * NAME_SIZE_STEP);
  const bodyLineHeight = clampNumber(base.bodyLineHeight + (normalizedSettings.lineSpacing * LINE_SPACING_STEP), 1, 2.2);
  const detailLineHeight = clampNumber(base.detailLineHeight + (normalizedSettings.lineSpacing * LINE_SPACING_STEP), 1, 2.3);
  const listLineHeight = clampNumber(base.listLineHeight + (normalizedSettings.lineSpacing * LINE_SPACING_STEP), 1, 2.3);
  const sectionGap = Math.max(0, base.sectionGapPx + (normalizedSettings.sectionSpacing * SECTION_SPACING_STEP));
  const sectionHeadingGap = Math.max(0, base.sectionHeadingGapPx + (normalizedSettings.sectionSpacing * SECTION_SPACING_STEP));
  const entryGap = Math.max(0, base.entryGapPx + (normalizedSettings.entrySpacing * ENTRY_SPACING_STEP));
  const repeatedEntryGap = Math.max(0, base.repeatedEntryGapPx + (normalizedSettings.entrySpacing * ENTRY_SPACING_STEP));
  const detailGap = Math.max(0, base.detailGapPx + (normalizedSettings.entrySpacing * ENTRY_SPACING_STEP));
  const listGap = Math.max(0, base.listGapPx + (normalizedSettings.entrySpacing * ENTRY_SPACING_STEP));
  const pageMarginInline = Math.max(0.2, base.pageMarginInlineIn + (normalizedSettings.horizontalMargins * MARGIN_STEP_IN));
  const pageMarginTop = Math.max(0.2, base.pageMarginTopIn + (normalizedSettings.verticalMargins * MARGIN_STEP_IN));
  const pageMarginBottom = Math.max(0.2, base.pageMarginBottomIn + (normalizedSettings.verticalMargins * MARGIN_STEP_IN));
  const printMinHeight = Math.max(0, 11 - pageMarginTop - pageMarginBottom);

  return {
    '--resume-page-min-height': `${base.pageMinHeightPx}px`,
    '--resume-page-margin-inline': formatInches(pageMarginInline),
    '--resume-page-margin-top': formatInches(pageMarginTop),
    '--resume-page-margin-bottom': formatInches(pageMarginBottom),
    '--resume-name-size': formatRem(base.nameSizeRem * nameScale),
    '--resume-heading-size': formatRem(base.headingSizeRem * headingScale),
    '--resume-body-size': formatRem(base.bodySizeRem * textScale),
    '--resume-detail-size': formatRem(base.detailSizeRem * textScale),
    '--resume-meta-size': formatRem(base.metaSizeRem * textScale),
    '--resume-headline-size': formatRem(base.headlineSizeRem * textScale),
    '--resume-body-line-height': formatUnitless(bodyLineHeight),
    '--resume-detail-line-height': formatUnitless(detailLineHeight),
    '--resume-list-line-height': formatUnitless(listLineHeight),
    '--resume-section-gap': formatPx(sectionGap),
    '--resume-section-heading-gap': formatPx(sectionHeadingGap),
    '--resume-entry-gap': formatPx(entryGap),
    '--resume-repeated-entry-gap': formatPx(repeatedEntryGap),
    '--resume-detail-gap': formatPx(detailGap),
    '--resume-list-gap': formatPx(listGap),
    '--resume-print-min-height': formatInches(printMinHeight)
  };
}

export function getResumePrintPageRule(settings, template) {
  const normalizedSettings = normalizeResumeSettings(settings);
  const base = resolvePresentationBase(template);
  const horizontalMargin = Math.max(0.2, base.pageMarginInlineIn + (normalizedSettings.horizontalMargins * MARGIN_STEP_IN));
  const verticalMargin = Math.max(0.2, base.pageMarginTopIn + (normalizedSettings.verticalMargins * MARGIN_STEP_IN));

  return `@page { margin: ${formatInches(verticalMargin)} ${formatInches(horizontalMargin)} ${formatInches(verticalMargin)} ${formatInches(horizontalMargin)}; }`;
}

export function validateResume(resume) {
  const errors = {};
  const email = trimText(resume.personal.email);
  const phone = trimText(resume.personal.phone);
  const name = trimText(resume.personal.name);
  const linkedinUrl = trimText(resume.personal.linkedinUrl);
  const portfolioUrl = trimText(resume.personal.portfolioUrl);
  const githubUrl = trimText(resume.personal.githubUrl);
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

  if (linkedinUrl && !normalizeUrl(linkedinUrl)) {
    errors['personal.linkedinUrl'] = 'Enter a valid LinkedIn URL.';
  }

  if (portfolioUrl && !normalizeUrl(portfolioUrl)) {
    errors['personal.portfolioUrl'] = 'Enter a valid portfolio URL.';
  }

  if (githubUrl && !normalizeUrl(githubUrl)) {
    errors['personal.githubUrl'] = 'Enter a valid GitHub URL.';
  }

  resume.education.forEach((entry) => {
    if (!educationEntryHasContent(entry)) {
      return;
    }

    const programs = Array.isArray(entry.programs) ? entry.programs : [];
    const hasProgramDegree = programs.some((program) => trimText(program.degree) !== '');
    const hasProgramYears = programs.some((program) => trimText(program.yearsEdu) !== '');

    if (!trimText(entry.school)) {
      errors[`education.${entry.id}.school`] = 'Add the institution name.';
    }

    if (!trimText(entry.degree) && !hasProgramDegree) {
      errors[`education.${entry.id}.degree`] = 'Add the degree or program.';
    }

    if (!trimText(entry.yearsEdu) && !hasProgramYears) {
      errors[`education.${entry.id}.yearsEdu`] = 'Add the date range.';
    }
  });

  resume.experience.forEach((entry) => {
    if (!experienceEntryHasContent(entry)) {
      return;
    }

    if (!trimText(entry.company)) {
      errors[`experience.${entry.id}.company`] = 'Add the company name.';
    }

    if (!trimText(entry.role)) {
      errors[`experience.${entry.id}.role`] = 'Add the role title.';
    }

    if (!trimText(entry.yearsExp)) {
      errors[`experience.${entry.id}.yearsExp`] = 'Add the date range.';
    }

    if (entry.activities.every((activity) => trimText(activity) === '')) {
      errors[`experience.${entry.id}.activities.0`] = 'Add at least one highlight.';
    }
  });

  resume.skills.forEach((entry) => {
    if (!skillsEntryHasContent(entry)) {
      return;
    }

    if (!trimText(entry.items)) {
      errors[`skills.${entry.id}.items`] = 'Add at least one skill.';
    }
  });

  resume.projects.forEach((entry) => {
    if (!projectEntryHasContent(entry)) {
      return;
    }

    if (!trimText(entry.name)) {
      errors[`projects.${entry.id}.name`] = 'Add the project name.';
    }
  });

  resume.certifications.forEach((entry) => {
    if (!certificationEntryHasContent(entry)) {
      return;
    }

    if (!trimText(entry.name)) {
      errors[`certifications.${entry.id}.name`] = 'Add the certification name.';
    }
  });

  resume.volunteering.forEach((entry) => {
    if (!volunteeringEntryHasContent(entry)) {
      return;
    }

    if (!trimText(entry.organization)) {
      errors[`volunteering.${entry.id}.organization`] = 'Add the organization.';
    }

    if (!trimText(entry.role)) {
      errors[`volunteering.${entry.id}.role`] = 'Add the role.';
    }
  });

  resume.leadership.forEach((entry) => {
    if (!leadershipEntryHasContent(entry)) {
      return;
    }

    if (!trimText(entry.organization)) {
      errors[`leadership.${entry.id}.organization`] = 'Add the organization.';
    }

    if (!trimText(entry.role)) {
      errors[`leadership.${entry.id}.role`] = 'Add the role.';
    }
  });

  resume.languages.forEach((entry) => {
    if (!languageEntryHasContent(entry)) {
      return;
    }

    if (!trimText(entry.language)) {
      errors[`languages.${entry.id}.language`] = 'Add the language.';
    }
  });

  resume.awards.forEach((entry) => {
    if (!awardEntryHasContent(entry)) {
      return;
    }

    if (!trimText(entry.title)) {
      errors[`awards.${entry.id}.title`] = 'Add the award title.';
    }
  });

  resume.publications.forEach((entry) => {
    if (!publicationEntryHasContent(entry)) {
      return;
    }

    if (!trimText(entry.title)) {
      errors[`publications.${entry.id}.title`] = 'Add the publication title.';
    }
  });

  return errors;
}

export function createDraftPayload({ resume, template, sectionOrder }) {
  const normalizedSectionOrder = normalizeSectionOrder(sectionOrder);

  return {
    version: 2,
    savedAt: new Date().toISOString(),
    template,
    sectionOrder: normalizedSectionOrder,
    resume: normalizeResume(resume, { sectionOrder: normalizedSectionOrder })
  };
}
