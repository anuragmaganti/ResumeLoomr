import {
  listHasContent,
  normalizeStringList,
} from './resumeValues.js';
import { trimText } from './text.js';

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `id-${Math.random().toString(36).slice(2, 10)}`;
}

function asText(value) {
  return typeof value === 'string' ? value : '';
}

export function createEducationProgram(candidate = {}) {
  return {
    id: trimText(candidate.id) || createId(),
    degree: asText(candidate.degree),
    yearsEdu: asText(candidate.yearsEdu || candidate.years),
    gpa: asText(candidate.gpa),
    honors: asText(candidate.honors),
  };
}

export function createEducationCustomSection(candidate = {}) {
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

export function createResumeEntry(kind, candidate = {}) {
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
