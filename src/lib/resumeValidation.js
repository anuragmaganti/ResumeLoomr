import {
  awardEntryHasContent,
  certificationEntryHasContent,
  customEntryHasContent,
  educationEntryHasContent,
  languageEntryHasContent,
  projectEntryHasContent,
  publicationEntryHasContent,
  roleEntryHasContent,
  skillsEntryHasContent,
} from './resumeEntries.js';
import { normalizeResume } from './resume.js';
import { normalizeStringList } from './resumeValues.js';
import { trimText } from './text.js';

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
