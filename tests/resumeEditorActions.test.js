import test from 'node:test';
import assert from 'node:assert/strict';

import { createEmptyResume } from '../src/lib/resume.js';
import { createResumeEditorActions } from '../src/lib/resumeEditorActions.js';

test('resume editor actions route UI commands through the canonical resume mutation path', () => {
  let resume = createEmptyResume();
  let transientEndCount = 0;
  const updateResume = (transform) => {
    resume = transform(resume);
  };
  const actions = createResumeEditorActions({
    updateResume,
    addResumeSection: (templateId) => `added:${templateId}`,
    prepareTransientSampleEntry: (...args) => args,
    endTransientSampleEntry: () => {
      transientEndCount += 1;
      return true;
    },
    endTransientSampleEntryUnless: (...args) => args,
  });
  const roleSection = resume.sections.find((section) => section.kind === 'roles');
  const roleEntry = roleSection.entries[0];

  actions.updatePersonalField('name', 'Ada Lovelace');
  actions.updateSectionBlockEntry(roleSection.id, roleEntry.id, 'company', 'Analytical Engines');
  actions.addSectionBlockTextListItem(roleSection.id, roleEntry.id, 'activities');
  actions.updateSectionBlockTextList(roleSection.id, roleEntry.id, 'activities', 0, 'Designed an algorithm.');
  actions.startFromScratch();

  assert.equal(resume.personal.name, 'Ada Lovelace');
  assert.equal(resume.sections.find((section) => section.id === roleSection.id).entries[0].company, 'Analytical Engines');
  assert.deepEqual(
    resume.sections.find((section) => section.id === roleSection.id).entries[0].activities,
    ['Designed an algorithm.', ''],
  );
  assert.equal(resume.sampleDisplay.hasStarted, true);
  assert.equal(actions.addResumeSection('research'), 'added:research');

  actions.setSampleInformationVisible(false);
  actions.dismissSampleInformation();
  assert.equal(transientEndCount, 2);
  assert.equal(resume.sampleDisplay.isDismissed, true);
});

test('resume editor actions preserve transient sample lifecycle delegates', () => {
  const actions = createResumeEditorActions({
    updateResume() {},
    addResumeSection() {},
    prepareTransientSampleEntry: (...args) => ['prepare', ...args],
    endTransientSampleEntry: (...args) => ['end', ...args],
    endTransientSampleEntryUnless: (...args) => ['unless', ...args],
  });

  assert.deepEqual(actions.prepareTransientSampleEntry('section', 'entry'), ['prepare', 'section', 'entry']);
  assert.deepEqual(actions.endTransientSampleEntry({ sectionId: 'section' }), ['end', { sectionId: 'section' }]);
  assert.deepEqual(actions.endTransientSampleEntryUnless('section', 'entry'), ['unless', 'section', 'entry']);
});
