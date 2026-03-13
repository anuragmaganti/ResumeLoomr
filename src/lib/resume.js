export const DRAFT_STORAGE_KEY = 'resumeloomr:draft:v2';
export const DEFAULT_TEMPLATE = 'modern';
export const TEMPLATE_OPTIONS = [
  { id: 'modern', label: 'Modern' },
  { id: 'executive', label: 'Executive' },
  { id: 'compact', label: 'Compact' }
];

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `id-${Math.random().toString(36).slice(2, 10)}`;
}

function asText(value) {
  return typeof value === 'string' ? value : '';
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

export function normalizeBulletText(value) {
  return trimText(value).replace(/^[\s\-*•]+/, '');
}

export function createEducationEntry(overrides = {}) {
  return {
    id: overrides.id || createId(),
    school: asText(overrides.school),
    degree: asText(overrides.degree),
    yearsEdu: asText(overrides.yearsEdu)
  };
}

export function createExperienceEntry(overrides = {}) {
  const activities = Array.isArray(overrides.activities) ? overrides.activities.map(asText) : [''];

  return {
    id: overrides.id || createId(),
    company: asText(overrides.company),
    role: asText(overrides.role),
    activities: activities.length > 0 ? activities : [''],
    yearsExp: asText(overrides.yearsExp)
  };
}

export function createEmptyResume() {
  return {
    personal: {
      name: '',
      phone: '',
      email: '',
      aboutMe: ''
    },
    education: [createEducationEntry()],
    experience: [createExperienceEntry()]
  };
}

export function normalizeResume(candidate) {
  const resume = candidate && typeof candidate === 'object' ? candidate : {};
  const personal = resume.personal && typeof resume.personal === 'object' ? resume.personal : {};
  const education = Array.isArray(resume.education) ? resume.education : [];
  const experience = Array.isArray(resume.experience) ? resume.experience : [];

  return {
    personal: {
      name: asText(personal.name),
      phone: asText(personal.phone),
      email: asText(personal.email),
      aboutMe: asText(personal.aboutMe)
    },
    education: education.length > 0 ? education.map(createEducationEntry) : [createEducationEntry()],
    experience: experience.length > 0 ? experience.map(createExperienceEntry) : [createExperienceEntry()]
  };
}

export function normalizeDraftPayload(payload) {
  const draft = payload && typeof payload === 'object' ? payload : {};
  const candidateResume = draft.resume && typeof draft.resume === 'object' ? draft.resume : draft;
  const template = TEMPLATE_OPTIONS.some((option) => option.id === draft.template) ? draft.template : DEFAULT_TEMPLATE;

  return {
    template,
    resume: normalizeResume(candidateResume)
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

export function updatePersonalField(resume, field, value) {
  return {
    ...resume,
    personal: {
      ...resume.personal,
      [field]: value
    }
  };
}

export function updateEducationField(resume, entryId, field, value) {
  return {
    ...resume,
    education: resume.education.map((entry) => (
      entry.id === entryId ? { ...entry, [field]: value } : entry
    ))
  };
}

export function addEducation(resume) {
  return {
    ...resume,
    education: [...resume.education, createEducationEntry()]
  };
}

export function moveEducation(resume, entryId, direction) {
  return {
    ...resume,
    education: moveItemById(resume.education, entryId, direction)
  };
}

export function removeEducation(resume, entryId) {
  if (resume.education.length <= 1) {
    return resume;
  }

  return {
    ...resume,
    education: resume.education.filter((entry) => entry.id !== entryId)
  };
}

export function updateExperienceField(resume, entryId, field, value) {
  return {
    ...resume,
    experience: resume.experience.map((entry) => (
      entry.id === entryId ? { ...entry, [field]: value } : entry
    ))
  };
}

export function addExperience(resume) {
  return {
    ...resume,
    experience: [...resume.experience, createExperienceEntry()]
  };
}

export function moveExperience(resume, entryId, direction) {
  return {
    ...resume,
    experience: moveItemById(resume.experience, entryId, direction)
  };
}

export function removeExperience(resume, entryId) {
  if (resume.experience.length <= 1) {
    return resume;
  }

  return {
    ...resume,
    experience: resume.experience.filter((entry) => entry.id !== entryId)
  };
}

export function updateActivity(resume, entryId, activityIndex, value) {
  return {
    ...resume,
    experience: resume.experience.map((entry) => (
      entry.id === entryId
        ? {
            ...entry,
            activities: entry.activities.map((activity, index) => (
              index === activityIndex ? value : activity
            ))
          }
        : entry
    ))
  };
}

export function addActivity(resume, entryId) {
  return {
    ...resume,
    experience: resume.experience.map((entry) => (
      entry.id === entryId
        ? { ...entry, activities: [...entry.activities, ''] }
        : entry
    ))
  };
}

export function moveActivity(resume, entryId, activityIndex, direction) {
  return {
    ...resume,
    experience: resume.experience.map((entry) => (
      entry.id === entryId
        ? {
            ...entry,
            activities: reorderList(entry.activities, activityIndex, activityIndex + direction)
          }
        : entry
    ))
  };
}

export function removeActivity(resume, entryId, activityIndex) {
  return {
    ...resume,
    experience: resume.experience.map((entry) => {
      if (entry.id !== entryId) {
        return entry;
      }

      if (entry.activities.length <= 1) {
        return { ...entry, activities: [''] };
      }

      return {
        ...entry,
        activities: entry.activities.filter((_, index) => index !== activityIndex)
      };
    })
  };
}

export function personalHasContent(personal) {
  return [personal.name, personal.phone, personal.email, personal.aboutMe].some((value) => trimText(value) !== '');
}

export function educationEntryHasContent(entry) {
  return [entry.school, entry.degree, entry.yearsEdu].some((value) => trimText(value) !== '');
}

export function experienceEntryHasContent(entry) {
  return [entry.company, entry.role, entry.yearsExp].some((value) => trimText(value) !== '') ||
    entry.activities.some((activity) => trimText(activity) !== '');
}

export function getPreviewModel(resume) {
  const personal = {
    name: trimText(resume.personal.name),
    phone: formatPhoneForPreview(resume.personal.phone),
    email: trimText(resume.personal.email),
    aboutMe: trimText(resume.personal.aboutMe)
  };

  const educationEntries = resume.education
    .filter(educationEntryHasContent)
    .map((entry) => ({
      id: entry.id,
      school: trimText(entry.school),
      degree: trimText(entry.degree),
      yearsEdu: trimText(entry.yearsEdu)
    }));

  const experienceEntries = resume.experience
    .filter(experienceEntryHasContent)
    .map((entry) => ({
      id: entry.id,
      company: trimText(entry.company),
      role: trimText(entry.role),
      yearsExp: trimText(entry.yearsExp),
      activities: entry.activities
        .map(normalizeBulletText)
        .filter((activity) => activity !== '')
    }));

  const hasContent = personalHasContent(personal) || educationEntries.length > 0 || experienceEntries.length > 0;

  return {
    hasContent,
    personal,
    educationEntries,
    experienceEntries,
    showPersonal: personalHasContent(personal),
    showEducation: educationEntries.length > 0,
    showExperience: experienceEntries.length > 0
  };
}

export function validateResume(resume) {
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

  resume.education.forEach((entry) => {
    if (!educationEntryHasContent(entry)) {
      return;
    }

    if (!trimText(entry.school)) {
      errors[`education.${entry.id}.school`] = 'Add the institution name.';
    }

    if (!trimText(entry.degree)) {
      errors[`education.${entry.id}.degree`] = 'Add the degree or program.';
    }

    if (!trimText(entry.yearsEdu)) {
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

  return errors;
}

export function createDraftPayload({ resume, template }) {
  return {
    version: 2,
    savedAt: new Date().toISOString(),
    template,
    resume
  };
}
