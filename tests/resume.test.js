import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addEducation,
  createEmptyResume,
  getPreviewModel,
  moveActivity,
  normalizeDraftPayload,
  normalizeBulletText,
  removeEducation,
  removeExperience,
  updatePersonalField,
  validateResume,
} from '../src/lib/resume.js';

test('createEmptyResume returns editable starter entries', () => {
  const resume = createEmptyResume();

  assert.equal(resume.education.length, 1);
  assert.equal(resume.experience.length, 1);
  assert.deepEqual(resume.experience[0].activities, ['']);
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

test('moveActivity reorders highlight bullets', () => {
  const resume = createEmptyResume();
  const entryId = resume.experience[0].id;
  resume.experience[0].activities = ['First', 'Second', 'Third'];

  const nextResume = moveActivity(resume, entryId, 0, 2);
  assert.deepEqual(nextResume.experience[0].activities, ['Second', 'Third', 'First']);
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

test('getPreviewModel hides empty sections, formats personal links, and trims bullet markers', () => {
  const resume = createEmptyResume();
  resume.personal.name = 'Jordan Lee';
  resume.personal.headline = 'Frontend Engineer';
  resume.personal.location = 'Brooklyn, NY';
  resume.personal.githubUrl = 'github.com/jordanlee';
  resume.personal.customField = 'Behance: behance.net/jordanlee';
  resume.experience[0].company = 'Acme';
  resume.experience[0].role = 'Designer';
  resume.experience[0].activities = ['• Led redesign', '  - Improved conversion'];

  const previewModel = getPreviewModel(resume);

  assert.equal(previewModel.showEducation, false);
  assert.equal(previewModel.showExperience, true);
  assert.equal(previewModel.personal.headline, 'Frontend Engineer');
  assert.equal(previewModel.personal.location, 'Brooklyn, NY');
  assert.deepEqual(
    previewModel.personal.links.map((link) => link.text),
    ['github.com/jordanlee', 'Behance: behance.net/jordanlee']
  );
  assert.deepEqual(previewModel.experienceEntries[0].activities, ['Led redesign', 'Improved conversion']);
});

test('normalizeDraftPayload accepts bare resume objects and valid templates', () => {
  const normalized = normalizeDraftPayload({
    template: 'compact',
    resume: {
      personal: { name: 'Jordan', phone: '', email: '', aboutMe: '' },
      education: [],
      experience: []
    }
  });

  assert.equal(normalized.template, 'compact');
  assert.equal(normalized.resume.personal.name, 'Jordan');
  assert.equal(normalized.resume.personal.linkedinUrl, '');
  assert.equal(normalized.resume.education.length, 1);
  assert.equal(normalized.resume.experience.length, 1);
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
