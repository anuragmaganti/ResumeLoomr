import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SECTION_IDS,
  addEducationCustomSection,
  addEducation,
  createEmptyResume,
  getPreviewModel,
  moveActivity,
  moveEducationCustomSection,
  moveSectionOrder,
  normalizeDraftPayload,
  normalizeBulletText,
  removeEducationCustomSection,
  removeEducation,
  removeExperience,
  updatePersonalField,
  updateSectionTitle,
  validateResume,
} from '../src/lib/resume.js';

test('createEmptyResume returns editable starter entries', () => {
  const resume = createEmptyResume();

  assert.equal(resume.education.length, 1);
  assert.equal(resume.experience.length, 1);
  assert.equal(resume.skills.length, 1);
  assert.equal(resume.projects.length, 1);
  assert.equal(resume.certifications.length, 1);
  assert.equal(resume.volunteering.length, 1);
  assert.equal(resume.leadership.length, 1);
  assert.equal(resume.languages.length, 1);
  assert.equal(resume.awards.length, 1);
  assert.equal(resume.publications.length, 1);
  assert.deepEqual(resume.experience[0].activities, ['']);
  assert.deepEqual(resume.projects[0].highlights, ['']);
});

test('removeEducation and removeExperience preserve at least one editable entry', () => {
  const resume = createEmptyResume();
  const nextResume = removeEducation(resume, resume.education[0].id);
  const finalResume = removeExperience(nextResume, nextResume.experience[0].id);

  assert.equal(finalResume.education.length, 1);
  assert.equal(finalResume.experience.length, 1);
});

test('addEducation appends a new education card', () => {
  const resume = addEducation(createEmptyResume());
  assert.equal(resume.education.length, 2);
});

test('education custom sections can be added, moved, and reduced back to one editable row', () => {
  const resume = createEmptyResume();
  const entryId = resume.education[0].id;

  let nextResume = addEducationCustomSection(resume, entryId);
  assert.equal(nextResume.education[0].customSections.length, 2);

  nextResume.education[0].customSections[0].label = 'Capstone';
  nextResume.education[0].customSections[1].label = 'Leadership';

  nextResume = moveEducationCustomSection(nextResume, entryId, 0, 1);
  assert.equal(nextResume.education[0].customSections[1].label, 'Capstone');

  nextResume = removeEducationCustomSection(nextResume, entryId, 1);
  assert.equal(nextResume.education[0].customSections.length, 1);

  nextResume = removeEducationCustomSection(nextResume, entryId, 0);
  assert.equal(nextResume.education[0].customSections.length, 1);
  assert.equal(nextResume.education[0].customSections[0].label, '');
  assert.equal(nextResume.education[0].customSections[0].content, '');
});

test('moveActivity reorders highlight bullets', () => {
  const resume = createEmptyResume();
  const entryId = resume.experience[0].id;
  resume.experience[0].activities = ['First', 'Second', 'Third'];

  const nextResume = moveActivity(resume, entryId, 0, 2);
  assert.deepEqual(nextResume.experience[0].activities, ['Second', 'Third', 'First']);
});

test('moveSectionOrder keeps personal first and reorders the remaining sections', () => {
  assert.deepEqual(
    moveSectionOrder(SECTION_IDS, 'education', 1).slice(0, 4),
    ['personal', 'experience', 'education', 'skills']
  );
  assert.deepEqual(
    moveSectionOrder(SECTION_IDS, 'personal', 1),
    SECTION_IDS
  );
});

test('validateResume flags missing core fields and partial entries', () => {
  const resume = createEmptyResume();
  const populated = updatePersonalField(resume, 'email', 'invalid-email');
  populated.personal.customField = 'Portfolio available on request';
  populated.education[0].school = 'Example University';

  const errors = validateResume(populated);

  assert.equal(errors['personal.name'], 'Add your full name.');
  assert.equal(errors['personal.email'], 'Enter a valid email address.');
  assert.equal(errors['personal.customField'], undefined);
  assert.equal(errors[`education.${populated.education[0].id}.degree`], 'Add the degree or program.');
});

test('getPreviewModel shapes the expanded resume sections and trims bullet markers', () => {
  const resume = createEmptyResume();
  const renamedResume = updateSectionTitle(resume, 'projects', 'Recent projects');
  assert.equal(renamedResume.sectionTitles.projects, 'Recent projects');
  assert.equal(getPreviewModel(renamedResume).sectionTitles.projects, 'Recent projects');

  resume.personal.name = 'Jordan Lee';
  resume.personal.headline = 'Frontend Engineer';
  resume.personal.location = 'Brooklyn, NY';
  resume.personal.githubUrl = 'github.com/jordanlee';
  resume.personal.customField = 'Behance: behance.net/jordanlee';
  resume.education[0].school = 'Example University';
  resume.education[0].degree = 'B.S. Computer Science';
  resume.education[0].yearsEdu = '2020 - 2024';
  resume.education[0].location = 'Cambridge, MA';
  resume.education[0].gpa = '3.9 / 4.0';
  resume.education[0].honors = 'Dean\'s List';
  resume.education[0].coursework = 'Algorithms, HCI';
  resume.education[0].awards = 'Presidential Scholarship';
  resume.education[0].customSections = [
    { id: 'capstone', label: 'Capstone', content: 'Focused on product-oriented software systems.' },
    { id: 'leadership', label: 'Leadership', content: 'Led the design club for two semesters.' }
  ];
  resume.experience[0].company = 'Acme';
  resume.experience[0].role = 'Designer';
  resume.experience[0].activities = ['• Led redesign', '  - Improved conversion'];
  resume.skills[0].category = 'Product';
  resume.skills[0].items = 'Roadmapping, stakeholder alignment';
  resume.projects[0].name = 'Resume builder';
  resume.projects[0].years = '2025';
  resume.projects[0].summary = 'Built a polished editor for resume creation.';
  resume.projects[0].highlights = ['• Added live preview', '- Improved print output'];
  resume.certifications[0].name = 'AWS Certified Cloud Practitioner';
  resume.certifications[0].issuer = 'Amazon Web Services';
  resume.certifications[0].years = '2024';
  resume.volunteering[0].organization = 'Code for Good';
  resume.volunteering[0].role = 'Mentor';
  resume.volunteering[0].highlights = ['• Guided student teams'];
  resume.leadership[0].organization = 'Design Club';
  resume.leadership[0].role = 'President';
  resume.languages[0].language = 'Spanish';
  resume.languages[0].proficiency = 'Professional';
  resume.awards[0].title = 'Employee of the Year';
  resume.awards[0].issuer = 'Acme';
  resume.publications[0].title = 'Designing better editors';
  resume.publications[0].publisher = 'UX Journal';

  const previewModel = getPreviewModel(resume);

  assert.equal(previewModel.showEducation, true);
  assert.equal(previewModel.showExperience, true);
  assert.equal(previewModel.showSkills, true);
  assert.equal(previewModel.showProjects, true);
  assert.equal(previewModel.showCertifications, true);
  assert.equal(previewModel.showVolunteering, true);
  assert.equal(previewModel.showLeadership, true);
  assert.equal(previewModel.showLanguages, true);
  assert.equal(previewModel.showAwards, true);
  assert.equal(previewModel.showPublications, true);
  assert.equal(previewModel.personal.headline, 'Frontend Engineer');
  assert.equal(previewModel.personal.location, 'Brooklyn, NY');
  assert.deepEqual(
    previewModel.personal.links.map((link) => link.text),
    ['github.com/jordanlee', 'Behance: behance.net/jordanlee']
  );
  assert.equal(previewModel.educationEntries[0].location, 'Cambridge, MA');
  assert.equal(previewModel.educationEntries[0].gpa, '3.9 / 4.0');
  assert.equal(previewModel.educationEntries[0].honors, 'Dean\'s List');
  assert.equal(previewModel.educationEntries[0].coursework, 'Algorithms, HCI');
  assert.equal(previewModel.educationEntries[0].awards, 'Presidential Scholarship');
  assert.deepEqual(
    previewModel.educationEntries[0].customSections.map((section) => ({ label: section.label, content: section.content })),
    [
      { label: 'Capstone', content: 'Focused on product-oriented software systems.' },
      { label: 'Leadership', content: 'Led the design club for two semesters.' }
    ]
  );
  assert.deepEqual(previewModel.experienceEntries[0].activities, ['Led redesign', 'Improved conversion']);
  assert.equal(previewModel.skillsEntries[0].items, 'Roadmapping, stakeholder alignment');
  assert.deepEqual(previewModel.projectEntries[0].highlights, ['Added live preview', 'Improved print output']);
  assert.equal(previewModel.certificationEntries[0].issuer, 'Amazon Web Services');
  assert.deepEqual(previewModel.volunteeringEntries[0].highlights, ['Guided student teams']);
  assert.equal(previewModel.leadershipEntries[0].organization, 'Design Club');
  assert.equal(previewModel.languageEntries[0].proficiency, 'Professional');
  assert.equal(previewModel.awardEntries[0].title, 'Employee of the Year');
  assert.equal(previewModel.publicationEntries[0].publisher, 'UX Journal');
});

test('normalizeDraftPayload accepts bare resume objects and valid templates', () => {
  const normalized = normalizeDraftPayload({
    template: 'compact',
    sectionOrder: ['experience', 'personal', 'education'],
    resume: {
      personal: { name: 'Jordan', phone: '', email: '', aboutMe: '' },
      education: [],
      experience: []
    }
  });

  assert.equal(normalized.template, 'compact');
  assert.deepEqual(normalized.sectionOrder.slice(0, 4), ['personal', 'experience', 'education', 'skills']);
  assert.equal(normalized.resume.personal.name, 'Jordan');
  assert.equal(normalized.resume.personal.linkedinUrl, '');
  assert.equal(normalized.resume.education[0].location, '');
  assert.equal(normalized.resume.education[0].customSections.length, 1);
  assert.equal(normalized.resume.education[0].customSections[0].label, '');
  assert.equal(normalized.resume.education[0].customSections[0].content, '');
  assert.equal(normalized.resume.education.length, 1);
  assert.equal(normalized.resume.experience.length, 1);
  assert.equal(normalized.resume.skills.length, 1);
  assert.equal(normalized.resume.projects.length, 1);
  assert.equal(normalized.resume.publications.length, 1);
});

test('normalizeDraftPayload migrates legacy education description into the first custom section', () => {
  const normalized = normalizeDraftPayload({
    resume: {
      personal: { name: 'Jordan' },
      education: [{ school: 'Example University', description: 'Legacy note' }],
      experience: []
    }
  });

  assert.equal(normalized.resume.education[0].customSections[0].content, 'Legacy note');
});

test('normalizeDraftPayload migrates legacy custom section fields into the custom sections list', () => {
  const normalized = normalizeDraftPayload({
    resume: {
      personal: { name: 'Jordan' },
      education: [{
        school: 'Example University',
        customSectionLabel: 'Capstone',
        customSection: 'Built a campus scheduling tool.'
      }],
      experience: []
    }
  });

  assert.equal(normalized.resume.education[0].customSections[0].label, 'Capstone');
  assert.equal(normalized.resume.education[0].customSections[0].content, 'Built a campus scheduling tool.');
});

test('normalizeDraftPayload tolerates malformed education custom section entries', () => {
  const normalized = normalizeDraftPayload({
    resume: {
      personal: { name: 'Jordan' },
      education: [{
        school: 'Example University',
        customSections: [null, { label: 'Capstone', content: 'Built a campus scheduling tool.' }]
      }],
      experience: []
    }
  });

  assert.equal(normalized.resume.education[0].customSections.length, 2);
  assert.equal(normalized.resume.education[0].customSections[0].label, '');
  assert.equal(normalized.resume.education[0].customSections[0].content, '');
  assert.equal(normalized.resume.education[0].customSections[1].label, 'Capstone');
});

test('normalizeDraftPayload migrates legacy custom link fields into customField', () => {
  const normalized = normalizeDraftPayload({
    resume: {
      personal: {
        name: 'Jordan',
        customLinkLabel: 'Behance',
        customLinkUrl: 'behance.net/jordanlee'
      },
      education: [],
      experience: []
    }
  });

  assert.equal(normalized.resume.personal.customField, 'Behance: behance.net/jordanlee');
});

test('normalizeBulletText removes manual bullet prefixes', () => {
  assert.equal(normalizeBulletText(' • Hello world '), 'Hello world');
});
