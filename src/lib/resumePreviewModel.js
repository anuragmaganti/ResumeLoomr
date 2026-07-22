import {
  awardEntryHasContent,
  certificationEntryHasContent,
  customEntryHasContent,
  educationEntryHasContent,
  ensureEducationCustomSections,
  languageEntryHasContent,
  projectEntryHasContent,
  publicationEntryHasContent,
  roleEntryHasContent,
  skillsEntryHasContent,
} from './resumeEntries.js';
import { normalizeEntryHeaderLayout } from './resumeEntryLayout.js';
import { normalizeResume } from './resume.js';
import { normalizeStringList } from './resumeValues.js';
import { trimText } from './text.js';

function personalHasContent(personal) {
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

function normalizeBulletText(value) {
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
