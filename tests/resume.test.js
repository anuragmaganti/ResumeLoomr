import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_RESUME_SECTIONS,
  SECTION_TEMPLATE_GROUPS,
  UNTITLED_SECTION_TITLE,
  addResumeSectionBlock,
  addSectionBlockEntry,
  addSectionBlockTextListItem,
  commitSectionTitle,
  createEmptyResume,
  dismissSampleInformation,
  moveSectionBlockEntry,
  moveResumeSectionBlock,
  normalizeDraftPayload,
  removeResumeSectionBlock,
  reorderSectionBlockEntriesToMatch,
  reorderSectionBlockTextListItem,
  reorderResumeSectionBlocksToMatch,
  setSampleTextListOrder,
  setSectionEntryHeaderLayout,
  updatePersonalField,
  updateSampleDisplay,
  updateSectionBlockEducationCustomSection,
  updateSectionBlockEducationProgram,
  updateSectionBlockEntry,
  updateSectionBlockTextList,
  updateSectionTitle,
} from '../src/lib/resume.js';
import {
  getDefaultEntryHeaderLayout,
  moveSectionHeaderField,
  normalizeEntryHeaderLayout,
} from '../src/lib/resumeEntryLayout.js';
import {
  didTransientSampleEntryChange,
  materializeAndReorderSectionBlockEntries,
  projectTransientSampleEntry,
  resolveTransientSampleEntry,
} from '../src/lib/resumeSampleProjection.js';
import { getPreviewModel } from '../src/lib/resumePreviewModel.js';
import {
  DEFAULT_TEMPLATE,
  PERSONAL_CONTACT_FIELDS,
  PERSONAL_HEADER_ROWS,
} from '../src/lib/resumeSettings.js';
import { validateResume } from '../src/lib/resumeValidation.js';
import {
  MAX_WORKSPACE_RESUME_NAME_LENGTH,
  MAX_WORKSPACE_RESUMES,
} from '../src/lib/workspace.js';
import {
  createMixedSamplePreviewModel,
  createSamplePlaceholderResolver,
  createSamplePreviewModel,
  getPersistableSampleTextListMove,
  getSampleResumeIndex,
} from '../src/lib/sampleResumes.js';

const addRoleBlockEntry = addSectionBlockEntry;
const updateRoleBlockEntry = updateSectionBlockEntry;
const addRoleBlockActivity = (resume, sectionId, entryId) => (
  addSectionBlockTextListItem(resume, sectionId, entryId, 'activities')
);
const updateRoleBlockActivity = (resume, sectionId, entryId, activityIndex, value) => (
  updateSectionBlockTextList(resume, sectionId, entryId, 'activities', activityIndex, value)
);

function getSection(resume, sectionId) {
  return resume.sections.find((section) => section.id === sectionId);
}

function getSampleEntryBindingsFromPreview(section) {
  return Object.fromEntries(
    (Array.isArray(section?.entries) ? section.entries : [])
      .map((entry) => [
        entry.id,
        Number.isInteger(entry.sampleSourceIndex) ? entry.sampleSourceIndex : null,
      ])
      .filter(([entryId, sourceIndex]) => entryId && Number.isInteger(sourceIndex)),
  );
}

test('createEmptyResume returns the block-first resume shape', () => {
  const resume = createEmptyResume();

  assert.deepEqual(Object.keys(resume).sort(), ['personal', 'sampleDisplay', 'sections', 'settings']);
  assert.deepEqual(resume.sampleDisplay, {
    hasStarted: false,
    showInformation: true,
    isDismissed: false,
    entryBindings: {},
    textListOrders: {},
  });
  assert.deepEqual(resume.settings, {
    textSize: 0,
    horizontalMargins: 0,
    verticalMargins: 0,
    lineSpacing: 0,
    sectionSpacing: 0,
    entrySpacing: 0,
    headingSize: 0,
    nameSize: 0,
    summaryWidthPercent: 100,
    showSummaryTitle: false,
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
  });
  assert.deepEqual(
    resume.sections.map((section) => [section.id, section.kind, section.title]),
    [
      ['education', 'education', 'Education'],
      ['experience', 'roles', 'Experience'],
      ['internships', 'roles', 'Internships'],
      ['projects', 'projects', 'Projects'],
      ['skills', 'skills', 'Skills'],
    ],
  );
  assert.equal(getSection(resume, 'experience').entries[0].activities.length, 1);
  assert.equal(getSection(resume, 'projects').entries[0].highlights.length, 1);
});

test('normalizeDraftPayload creates block-only drafts and fills missing defaults', () => {
  const normalized = normalizeDraftPayload({
    template: 'unknown-template',
    resume: {
      personal: {
        name: 'Ada Lovelace',
      },
      settings: {
        textSize: 7,
      },
      sections: [
        {
          id: 'custom-work',
          kind: 'roles',
          title: 'Internships',
          entries: [{ company: 'Analytical Engines', role: 'Intern' }],
        },
        {
          id: 'custom-notes',
          kind: 'custom',
          title: 'Professional Affiliations',
          entries: [{ title: 'Association for Computing', subtitle: 'Member' }],
        },
      ],
    },
  });

  assert.equal(normalized.version, 3);
  assert.equal(normalized.template, DEFAULT_TEMPLATE);
  assert.equal(normalized.resume.personal.name, 'Ada Lovelace');
  assert.equal(normalized.resume.personal.summaryTitle, 'Summary');
  assert.equal(normalized.resume.settings.textSize, 5);
  assert.deepEqual(normalized.resume.sections.map((section) => section.id), ['custom-work', 'custom-notes']);
  assert.equal(normalized.resume.sections[0].entries[0].company, 'Analytical Engines');
  assert.equal(normalized.resume.sections[0].entries[0].location, '');
  assert.equal(normalized.resume.sections[1].entries[0].location, '');
  assert.equal(Object.hasOwn(normalized, 'section' + 'Order'), false);
});

test('sample display metadata normalizes and updates with resume drafts', () => {
  let resume = createEmptyResume();

  resume = updateSampleDisplay(resume, { hasStarted: true, showInformation: false });

  assert.deepEqual(resume.sampleDisplay, {
    hasStarted: true,
    showInformation: false,
    isDismissed: false,
    entryBindings: {},
    textListOrders: {},
  });
  assert.deepEqual(normalizeDraftPayload({ resume }).resume.sampleDisplay, {
    hasStarted: true,
    showInformation: false,
    isDismissed: false,
    entryBindings: {},
    textListOrders: {},
  });
  assert.deepEqual(normalizeDraftPayload({
    resume: {
      ...resume,
      sampleDisplay: {
        hasStarted: 'yes',
        entryBindings: {
          experience: {
            entry1: 2,
            bad: -1,
            tooLarge: 100,
          },
          badSection: ['entry1'],
        },
      },
    },
  }).resume.sampleDisplay, {
    hasStarted: true,
    showInformation: true,
    isDismissed: false,
    entryBindings: {
      experience: {
        entry1: 2,
      },
    },
    textListOrders: {},
  });

  resume = setSampleTextListOrder(resume, 'experience.entry.activities', [2, 0, 1]);
  assert.deepEqual(resume.sampleDisplay.textListOrders, {
    'experience.entry.activities': [2, 0, 1],
  });

  resume = setSampleTextListOrder(resume, 'experience.entry.activities', null);
  assert.deepEqual(resume.sampleDisplay.textListOrders, {});
});

test('sample information dismissal is permanent and clears sample-only ordering metadata', () => {
  let resume = updateSampleDisplay(createEmptyResume(), {
    hasStarted: true,
    showInformation: true,
    entryBindings: { experience: { entry1: 0 } },
    textListOrders: { 'experience.entry.activities': [1, 0] },
  });

  resume = dismissSampleInformation(resume);

  assert.deepEqual(resume.sampleDisplay, {
    hasStarted: true,
    showInformation: false,
    isDismissed: true,
    entryBindings: {},
    textListOrders: {},
  });

  const attemptedRestore = updateSampleDisplay(resume, { showInformation: true });
  assert.equal(attemptedRestore.sampleDisplay.isDismissed, true);
  assert.equal(attemptedRestore.sampleDisplay.showInformation, false);
  assert.equal(createMixedSamplePreviewModel(attemptedRestore, 'resume-5'), null);
});

test('block actions update roles, education details, and list items', () => {
  let resume = createEmptyResume();
  const roleEntryId = getSection(resume, 'experience').entries[0].id;
  const educationEntryId = getSection(resume, 'education').entries[0].id;

  resume = updateRoleBlockEntry(resume, 'experience', roleEntryId, 'company', 'Acme');
  resume = updateRoleBlockEntry(resume, 'experience', roleEntryId, 'role', 'Designer');
  resume = updateRoleBlockEntry(resume, 'experience', roleEntryId, 'location', 'New York, NY');
  resume = updateRoleBlockActivity(resume, 'experience', roleEntryId, 0, 'Led redesign');
  resume = updateSectionBlockEntry(resume, 'education', educationEntryId, 'school', 'Example University');
  resume = updateSectionBlockEducationProgram(resume, 'education', educationEntryId, 0, 'degree', 'Ignored because no program exists');
  resume = updateSectionBlockEducationCustomSection(resume, 'education', educationEntryId, 0, 'label', 'Coursework');
  resume = updateSectionBlockEducationCustomSection(resume, 'education', educationEntryId, 0, 'content', 'Algorithms, HCI');

  assert.equal(getSection(resume, 'experience').entries[0].company, 'Acme');
  assert.equal(getSection(resume, 'experience').entries[0].location, 'New York, NY');
  assert.equal(getSection(resume, 'experience').entries[0].activities[0], 'Led redesign');
  assert.equal(getSection(resume, 'education').entries[0].school, 'Example University');
  assert.equal(getSection(resume, 'education').entries[0].customSections[0].label, 'Coursework');
});

test('entry header layouts normalize defaults for education roles and custom sections', () => {
  const resume = normalizeDraftPayload({
    resume: {
      sections: [
        {
          id: 'schooling',
          kind: 'education',
          title: 'Schooling',
          entries: [{ school: 'Example University' }],
        },
        {
          id: 'work',
          kind: 'roles',
          title: 'Work',
          entries: [{ company: 'Acme' }],
        },
        {
          id: 'affiliations',
          kind: 'custom',
          title: 'Affiliations',
          entries: [{ title: 'Member' }],
        },
      ],
    },
  }).resume;

  assert.deepEqual(getSection(resume, 'schooling').entryHeaderLayout, getDefaultEntryHeaderLayout('education'));
  assert.deepEqual(getSection(resume, 'work').entryHeaderLayout, getDefaultEntryHeaderLayout('roles'));
  assert.deepEqual(getSection(resume, 'affiliations').entryHeaderLayout, getDefaultEntryHeaderLayout('custom'));
});

test('entry header layout normalization repairs invalid and duplicate fields', () => {
  const rolesLayout = normalizeEntryHeaderLayout('roles', {
    lines: [
      { left: ['company', 'company'], right: ['bad-field', null] },
      { left: [null, null], right: [null, null] },
    ],
  });
  const educationLayout = normalizeEntryHeaderLayout('education', {
    lines: [
      { left: ['school', 'school', 'degree'], right: ['bad-field', null, 'location'] },
      { left: [null, 'gpa', null], right: [null, null, null] },
    ],
  });

  const flattenedRoleFields = rolesLayout.lines.flatMap((line) => [...line.left, ...line.right]).filter(Boolean);
  const flattenedEducationFields = educationLayout.lines.flatMap((line) => [...line.left, ...line.right]).filter(Boolean);

  assert.deepEqual([...new Set(flattenedRoleFields)].sort(), ['company', 'location', 'role', 'yearsExp']);
  assert.equal(flattenedRoleFields.length, 4);
  assert.deepEqual([...new Set(flattenedEducationFields)].sort(), ['degree', 'gpa', 'honors', 'location', 'school', 'yearsEdu']);
  assert.equal(flattenedEducationFields.length, 6);
  assert.equal(educationLayout.lines[0].left.length, 3);
  assert.equal(educationLayout.lines[0].right.length, 3);
});

test('entry header layout helper swaps occupied slots and moves into empty slots', () => {
  const defaultLayout = getDefaultEntryHeaderLayout('roles');
  const swapped = moveSectionHeaderField(
    defaultLayout,
    { lineIndex: 0, side: 'left', slotIndex: 0 },
    { lineIndex: 1, side: 'left', slotIndex: 0 },
  );

  assert.equal(swapped.lines[0].left[0], 'role');
  assert.equal(swapped.lines[1].left[0], 'company');

  const moved = moveSectionHeaderField(
    swapped,
    { lineIndex: 0, side: 'right', slotIndex: 1 },
    { lineIndex: 0, side: 'left', slotIndex: 1 },
  );

  assert.equal(moved.lines[0].left[1], 'location');
  assert.equal(moved.lines[0].right[1], null);

  const educationMoved = moveSectionHeaderField(
    getDefaultEntryHeaderLayout('education'),
    { lineIndex: 1, side: 'right', slotIndex: 2 },
    { lineIndex: 0, side: 'left', slotIndex: 2 },
  );

  assert.equal(educationMoved.lines[0].left[2], 'yearsEdu');
  assert.equal(educationMoved.lines[1].right[2], null);
});

test('section entry header layout updates only the target section and reaches preview model', () => {
  let resume = createEmptyResume();
  const customResult = addResumeSectionBlock(resume, 'custom-section');
  resume = customResult.resume;

  const nextExperienceLayout = moveSectionHeaderField(
    getDefaultEntryHeaderLayout('roles'),
    { lineIndex: 1, side: 'left', slotIndex: 0 },
    { lineIndex: 0, side: 'left', slotIndex: 1 },
  );

  resume = setSectionEntryHeaderLayout(resume, 'experience', nextExperienceLayout);

  assert.deepEqual(getSection(resume, 'experience').entryHeaderLayout, nextExperienceLayout);
  assert.deepEqual(getSection(resume, 'internships').entryHeaderLayout, getDefaultEntryHeaderLayout('roles'));
  assert.deepEqual(getSection(resume, customResult.sectionId).entryHeaderLayout, getDefaultEntryHeaderLayout('custom'));

  const experienceEntryId = getSection(resume, 'experience').entries[0].id;
  resume = updateRoleBlockEntry(resume, 'experience', experienceEntryId, 'company', 'Acme');
  resume = updateRoleBlockEntry(resume, 'experience', experienceEntryId, 'role', 'Engineer');

  const nextEducationLayout = moveSectionHeaderField(
    getDefaultEntryHeaderLayout('education'),
    { lineIndex: 0, side: 'right', slotIndex: 2 },
    { lineIndex: 0, side: 'left', slotIndex: 1 },
  );
  resume = setSectionEntryHeaderLayout(resume, 'education', nextEducationLayout);

  const educationEntryId = getSection(resume, 'education').entries[0].id;
  resume = updateSectionBlockEntry(resume, 'education', educationEntryId, 'school', 'Example University');
  resume = updateSectionBlockEntry(resume, 'education', educationEntryId, 'degree', 'B.S. Computer Science');
  resume = updateSectionBlockEntry(resume, 'education', educationEntryId, 'location', 'Athens, GA');
  resume = updateSectionBlockEntry(resume, 'education', educationEntryId, 'yearsEdu', '2020 - 2024');
  resume = updateSectionBlockEntry(resume, 'education', educationEntryId, 'gpa', '3.9');
  resume = updateSectionBlockEntry(resume, 'education', educationEntryId, 'honors', 'Magna Cum Laude');

  const preview = getPreviewModel(resume);
  assert.deepEqual(preview.sectionBlocks.find((section) => section.id === 'education').entryHeaderLayout, nextEducationLayout);
  assert.deepEqual(preview.sectionBlocks.find((section) => section.id === 'experience').entryHeaderLayout, nextExperienceLayout);
});

test('generic block actions handle projects and section titles', () => {
  let resume = createEmptyResume();
  const projectEntryId = getSection(resume, 'projects').entries[0].id;

  resume = updateSectionTitle(resume, 'projects', 'Recent Projects');
  resume = updateSectionBlockEntry(resume, 'projects', projectEntryId, 'name', 'ResumeLoomr');
  resume = updateSectionBlockTextList(resume, 'projects', projectEntryId, 'highlights', 0, 'Built a resume editor');

  assert.equal(getSection(resume, 'projects').title, 'Recent Projects');
  assert.equal(getSection(resume, 'projects').entries[0].name, 'ResumeLoomr');
  assert.equal(getSection(resume, 'projects').entries[0].highlights[0], 'Built a resume editor');
});

test('section titles can be temporarily blank and commit to an untitled fallback', () => {
  let resume = createEmptyResume();

  resume = updateSectionTitle(resume, 'projects', '');
  assert.equal(getSection(resume, 'projects').title, '');

  const normalizedDraft = normalizeDraftPayload({ resume });
  assert.equal(getSection(normalizedDraft.resume, 'projects').title, UNTITLED_SECTION_TITLE);

  resume = commitSectionTitle(resume, 'projects');
  assert.equal(getSection(resume, 'projects').title, UNTITLED_SECTION_TITLE);
});

test('section helpers reorder and remove blocks without a separate order field', () => {
  let resume = createEmptyResume();

  resume = moveResumeSectionBlock(resume, 'projects', -1);
  assert.deepEqual(resume.sections.slice(0, 5).map((section) => section.id), ['education', 'experience', 'projects', 'internships', 'skills']);

  resume = reorderResumeSectionBlocksToMatch(resume, ['skills', 'education', 'experience']);
  assert.deepEqual(resume.sections.slice(0, 5).map((section) => section.id), ['skills', 'education', 'projects', 'internships', 'experience']);

  resume = removeResumeSectionBlock(resume, 'skills');
  assert.equal(getSection(resume, 'skills'), undefined);
});

test('section entry and text-list exact reorders stay inside their target block', () => {
  let resume = createEmptyResume();
  const experience = getSection(resume, 'experience');
  const firstEntryId = experience.entries[0].id;

  resume = updateRoleBlockEntry(resume, 'experience', firstEntryId, 'company', 'First company');
  resume = updateRoleBlockActivity(resume, 'experience', firstEntryId, 0, 'First bullet');
  resume = updateRoleBlockActivity(resume, 'experience', firstEntryId, 1, 'Second bullet');
  resume = updateRoleBlockActivity(resume, 'experience', firstEntryId, 2, 'Third bullet');
  resume = updateSectionBlockTextList(resume, 'projects', getSection(resume, 'projects').entries[0].id, 'highlights', 0, 'Project bullet');

  resume = reorderSectionBlockTextListItem(resume, 'experience', firstEntryId, 'activities', 0, 2);

  assert.deepEqual(getSection(resume, 'experience').entries[0].activities.slice(0, 3), [
    'Second bullet',
    'Third bullet',
    'First bullet',
  ]);
  assert.equal(getSection(resume, 'projects').entries[0].highlights[0], 'Project bullet');

  resume = addRoleBlockEntry(resume, 'experience');
  const secondEntryId = getSection(resume, 'experience').entries[1].id;

  resume = updateRoleBlockEntry(resume, 'experience', secondEntryId, 'company', 'Second company');
  resume = reorderSectionBlockEntriesToMatch(resume, 'experience', [secondEntryId, firstEntryId]);

  assert.deepEqual(getSection(resume, 'experience').entries.map((entry) => entry.company).slice(0, 2), [
    'Second company',
    'First company',
  ]);
});

test('section template helper appends repeatable block sections with unique names', () => {
  let resume = createEmptyResume();

  const firstInternship = addResumeSectionBlock(resume, 'internships');
  resume = firstInternship.resume;
  const secondInternship = addResumeSectionBlock(resume, 'internships');
  resume = secondInternship.resume;
  const fallbackCustom = addResumeSectionBlock(resume, 'unknown-template');
  resume = fallbackCustom.resume;

  assert.ok(SECTION_TEMPLATE_GROUPS.some((group) => group.templates.some((template) => template.id === 'internships')));
  assert.equal(getSection(resume, firstInternship.sectionId).kind, 'roles');
  assert.equal(getSection(resume, firstInternship.sectionId).title, 'Internships 2');
  assert.equal(getSection(resume, secondInternship.sectionId).title, 'Internships 3');
  assert.notEqual(firstInternship.sectionId, secondInternship.sectionId);
  assert.equal(getSection(resume, fallbackCustom.sectionId).kind, 'custom');
  assert.equal(getSection(resume, fallbackCustom.sectionId).title, 'Custom Section');
});

test('section template helper stops at the resume section safety cap', () => {
  let resume = createEmptyResume();

  while (resume.sections.length < MAX_RESUME_SECTIONS) {
    resume = addResumeSectionBlock(resume, 'custom-section').resume;
  }

  const capped = addResumeSectionBlock(resume, 'custom-section');

  assert.equal(resume.sections.length, MAX_RESUME_SECTIONS);
  assert.equal(capped.resume.sections.length, MAX_RESUME_SECTIONS);
  assert.equal(capped.sectionId, '');
});

test('preview model renders ordered block sections and filters empty sections', () => {
  let resume = createEmptyResume();
  const roleEntryId = getSection(resume, 'experience').entries[0].id;

  resume = updatePersonalField(resume, 'name', 'Grace Hopper');
  resume = updateRoleBlockEntry(resume, 'experience', roleEntryId, 'company', 'Navy');
  resume = updateRoleBlockEntry(resume, 'experience', roleEntryId, 'role', 'Computer Scientist');
  resume = updateRoleBlockEntry(resume, 'experience', roleEntryId, 'yearsExp', '1944 - 1986');
  resume = updateRoleBlockActivity(resume, 'experience', roleEntryId, 0, '');
  resume = updateRoleBlockActivity(resume, 'experience', roleEntryId, 1, '- Built compilers');
  resume = addRoleBlockEntry(resume, 'experience');
  const emptyRoleEntryId = getSection(resume, 'experience').entries[1].id;

  const preview = getPreviewModel(resume);

  assert.equal(preview.hasContent, true);
  assert.equal(preview.personal.name, 'Grace Hopper');
  assert.deepEqual(preview.sectionOrder.slice(0, 5), ['education', 'experience', 'internships', 'projects', 'skills']);
  assert.deepEqual(preview.sectionBlocks.map((section) => section.id), ['experience']);
  assert.deepEqual(preview.sectionBlocks[0].entryOrder.slice(0, 2), [roleEntryId, emptyRoleEntryId]);
  assert.deepEqual(preview.sectionBlocks[0].entries[0].activities, [
    { text: 'Built compilers', sourceIndex: 1 },
  ]);
});

test('sample resume selection is deterministic and render-only for empty resumes', () => {
  const resume = createEmptyResume();
  const before = JSON.stringify(resume);
  const realPreview = getPreviewModel(resume);
  const firstSample = createSamplePreviewModel(resume, 'resume-alpha', realPreview);
  const secondSample = createSamplePreviewModel(resume, 'resume-alpha', realPreview);
  const roleBlock = firstSample.sectionBlocks.find((section) => section.kind === 'roles');
  const roleEntryId = roleBlock.entries[0].id;
  const activityOrder = roleBlock.entries[0].activities.map((activity) => activity.sourceIndex);
  const reorderedActivityOrder = [activityOrder[1], activityOrder[0], ...activityOrder.slice(2)];
  const reorderedSample = createSamplePreviewModel(resume, 'resume-alpha', realPreview, {
    [`${roleBlock.id}.${roleEntryId}.activities`]: reorderedActivityOrder,
  });
  const sampleIndexes = new Set(Array.from({ length: 32 }, (_, index) => getSampleResumeIndex(`resume-${index}`)));

  assert.equal(JSON.stringify(resume), before);
  assert.equal(firstSample.sampleId, secondSample.sampleId);
  assert.equal(firstSample.hasContent, true);
  assert.equal(firstSample.isSamplePreview, true);
  assert.equal(firstSample.sectionBlocks.every((section) => resume.sections.some((realSection) => realSection.id === section.id)), true);
  assert.deepEqual(reorderedSample.sectionBlocks.find((section) => section.id === roleBlock.id).entries[0].activities.map((activity) => activity.sourceIndex), reorderedActivityOrder);
  assert.equal(sampleIndexes.size, 9);
});

test('Erlich sample uses reference content and supports preview-only entry order', () => {
  const resume = createEmptyResume();
  const before = JSON.stringify(resume);
  const realPreview = getPreviewModel(resume);
  const preview = createSamplePreviewModel(resume, 'resume-5', realPreview);
  const educationBlock = preview.sectionBlocks.find((section) => section.kind === 'education');
  const roleBlock = preview.sectionBlocks.find((section) => section.id === 'experience');
  const roleIds = roleBlock.entries.map((entry) => entry.id);
  const reorderedPreview = createSamplePreviewModel(resume, 'resume-5', realPreview, {
    [`${roleBlock.id}.entries`]: [...roleIds].reverse(),
  });

  assert.equal(preview.sampleId, 'erlich-bachman');
  assert.equal(preview.personal.aboutMe.includes('identifying genius, housing genius'), true);
  assert.equal(educationBlock.entries[0].coursework.includes('Ethics of Taking 10% for Advising'), true);
  assert.deepEqual(educationBlock.entries[0].customSections, [
    {
      id: educationBlock.entries[0].customSections[0].id,
      label: 'Additional Academic Exposure',
      content: 'University of California, Berkeley, Reed College, Oberlin College',
    },
  ]);
  assert.equal(roleBlock.entries.length, 4);
  assert.deepEqual(roleBlock.entries.map((entry) => [entry.company, entry.role]), [
    ['Aviato', 'Founder & CEO'],
    ['Pied Piper', 'Board Member / 10% Stakeholder'],
    ['Hacker Hostel', 'Founder / Resident Mentor'],
    ['Bachmanity Capital', 'Co-Founder / General Partner'],
  ]);
  assert.deepEqual(roleBlock.entries.map((entry) => entry.isSamplePlaceholderEntry), [
    true,
    true,
    true,
    true,
  ]);
  assert.deepEqual(roleBlock.entries.map((entry) => [entry.location, entry.yearsExp]), [
    ['San Francisco, CA', '2018-2020'],
    ['Palo Alto, CA', '2020-2022'],
    ['5230 Newell Road, Palo Alto, CA', '2010-2016'],
    ['Palo Alto, CA', '2016-2016'],
  ]);
  assert.deepEqual(reorderedPreview.sectionBlocks.find((section) => section.id === roleBlock.id).entryOrder, [...roleIds].reverse());
  assert.equal(JSON.stringify(resume), before);
});

test('sample placeholder resolver mirrors sample preview fields without mutating resumes', () => {
  let resume = createEmptyResume();
  const before = JSON.stringify(resume);
  const preview = createSamplePreviewModel(resume, 'resume-5', getPreviewModel(resume));
  const placeholderFor = createSamplePlaceholderResolver(resume, preview);
  const educationEntryId = getSection(resume, 'education').entries[0].id;
  const experienceEntryId = getSection(resume, 'experience').entries[0].id;
  const projectsEntryId = getSection(resume, 'projects').entries[0].id;
  const skillsEntryId = getSection(resume, 'skills').entries[0].id;

  assert.equal(placeholderFor('personal.name', 'Jordan Lee'), 'Erlich Bachman');
  assert.equal(placeholderFor('personal.githubUrl', 'github.com/jordanlee'), 'github.com/jordanlee');
  assert.equal(placeholderFor(`sections.education.${educationEntryId}.school`, 'School'), 'Hampshire College');
  assert.equal(placeholderFor(`sections.education.${educationEntryId}.customSections.0.label`, 'Capstone'), 'Additional Academic Exposure');
  assert.equal(placeholderFor(`sections.experience.${experienceEntryId}.company`, 'Organization'), 'Aviato');
  assert.equal(placeholderFor(`sections.experience.${experienceEntryId}.role`, 'Role'), 'Founder & CEO');
  assert.equal(placeholderFor(`sections.experience.${experienceEntryId}.activities.0`, 'Highlight').includes('Built and exited Aviato'), true);
  assert.equal(placeholderFor(`sections.projects.${projectsEntryId}.name`, 'Project'), 'Aviato Brand System');
  assert.equal(placeholderFor(`sections.skills.${skillsEntryId}.items`, 'Skills').includes('Demo-day posture'), true);
  assert.equal(placeholderFor('sections.awards.missing.title', 'Employee of the Year'), 'Employee of the Year');
  assert.equal(JSON.stringify(resume), before);

  resume = addRoleBlockEntry(resume, 'experience');
  const secondExperienceEntryId = getSection(resume, 'experience').entries[1].id;
  const previewWithSecondRole = createSamplePreviewModel(resume, 'resume-5', getPreviewModel(resume));
  const placeholderForSecondRole = createSamplePlaceholderResolver(resume, previewWithSecondRole);

  assert.equal(placeholderForSecondRole(`sections.experience.${secondExperienceEntryId}.company`, 'Organization'), 'Pied Piper');
  assert.equal(placeholderForSecondRole(`sections.experience.${secondExperienceEntryId}.role`, 'Role'), 'Board Member / 10% Stakeholder');
});

test('mixed sample preview uses real user fields over sample fields', () => {
  let resume = createEmptyResume();
  const experienceEntryId = getSection(resume, 'experience').entries[0].id;

  resume = updateSampleDisplay(resume, { hasStarted: true, showInformation: true });
  resume = updatePersonalField(resume, 'name', 'Real Person');
  resume = updateRoleBlockEntry(resume, 'experience', experienceEntryId, 'company', 'Real Company');
  resume = updateRoleBlockActivity(resume, 'experience', experienceEntryId, 0, 'Shipped a real accomplishment.');

  const realPreview = getPreviewModel(resume);
  const mixedPreview = createMixedSamplePreviewModel(resume, 'resume-5', realPreview);
  const roleEntry = mixedPreview.sectionBlocks.find((section) => section.id === 'experience').entries[0];

  assert.equal(realPreview.personal.name, 'Real Person');
  assert.equal(mixedPreview.personal.name, 'Real Person');
  assert.equal(mixedPreview.personal.headline, 'Startup Visionary');
  assert.equal(roleEntry.company, 'Real Company');
  assert.equal(roleEntry.role, 'Founder & CEO');
  assert.equal(roleEntry.activities[0].text, 'Shipped a real accomplishment.');
  assert.equal(roleEntry.activities[1].text.includes('Leveraged a seven-figure liquidity event'), true);
});

test('partially edited sample role entries keep fallback fields after reorder and reload', () => {
  let resume = updateSampleDisplay(createEmptyResume(), { hasStarted: true, showInformation: true });
  resume = addRoleBlockEntry(resume, 'experience');

  const [firstEntry, secondEntry] = getSection(resume, 'experience').entries;
  resume = updateRoleBlockEntry(resume, 'experience', firstEntry.id, 'company', '1');
  resume = updateRoleBlockEntry(resume, 'experience', secondEntry.id, 'company', '2');

  const mixedPreview = createMixedSamplePreviewModel(resume, 'resume-5', getPreviewModel(resume));
  const experiencePreview = mixedPreview.sectionBlocks.find((section) => section.id === 'experience');
  const nextPreviewOrder = [
    secondEntry.id,
    firstEntry.id,
    ...experiencePreview.entryOrder.filter((entryId) => entryId !== firstEntry.id && entryId !== secondEntry.id),
  ];
  const materializedResume = materializeAndReorderSectionBlockEntries(
    resume,
    'experience',
    nextPreviewOrder,
    getSampleEntryBindingsFromPreview(experiencePreview),
  );
  const persistedResume = normalizeDraftPayload({ resume: materializedResume }).resume;
  const reloadedPreview = createMixedSamplePreviewModel(persistedResume, 'resume-5', getPreviewModel(persistedResume));
  const reloadedExperience = reloadedPreview.sectionBlocks.find((section) => section.id === 'experience');

  assert.deepEqual(materializedResume.sampleDisplay.entryBindings.experience, {
    [secondEntry.id]: 1,
    [firstEntry.id]: 0,
    'experience-sample-entry-3': 2,
    'experience-sample-entry-4': 3,
  });
  assert.deepEqual(reloadedExperience.entries.slice(0, 2).map((entry) => ({
    company: entry.company,
    role: entry.role,
    location: entry.location,
    yearsExp: entry.yearsExp,
  })), [
    {
      company: '2',
      role: 'Board Member / 10% Stakeholder',
      location: 'Palo Alto, CA',
      yearsExp: '2020-2022',
    },
    {
      company: '1',
      role: 'Founder & CEO',
      location: 'San Francisco, CA',
      yearsExp: '2018-2020',
    },
  ]);
});

test('editor entry moves keep partially edited sample fallback fields attached', () => {
  let resume = updateSampleDisplay(createEmptyResume(), { hasStarted: true, showInformation: true });
  resume = addRoleBlockEntry(resume, 'experience');

  const [firstEntry, secondEntry] = getSection(resume, 'experience').entries;
  resume = updateRoleBlockEntry(resume, 'experience', firstEntry.id, 'company', '1');
  resume = updateRoleBlockEntry(resume, 'experience', secondEntry.id, 'company', '2');

  const movedResume = moveSectionBlockEntry(resume, 'experience', secondEntry.id, -1);
  const reloadedPreview = createMixedSamplePreviewModel(movedResume, 'resume-5', getPreviewModel(movedResume));
  const reloadedExperience = reloadedPreview.sectionBlocks.find((section) => section.id === 'experience');

  assert.deepEqual(movedResume.sampleDisplay.entryBindings.experience, {
    [secondEntry.id]: 1,
    [firstEntry.id]: 0,
  });
  assert.deepEqual(reloadedExperience.entries.slice(0, 2).map((entry) => ({
    company: entry.company,
    role: entry.role,
  })), [
    {
      company: '2',
      role: 'Board Member / 10% Stakeholder',
    },
    {
      company: '1',
      role: 'Founder & CEO',
    },
  ]);
});

test('sample-only entry reorders around real entries do not duplicate real editor rows', () => {
  let resume = updateSampleDisplay(createEmptyResume(), { hasStarted: true, showInformation: true });
  resume = addRoleBlockEntry(resume, 'experience');

  const [firstEntry, secondEntry] = getSection(resume, 'experience').entries;
  resume = updateRoleBlockEntry(resume, 'experience', firstEntry.id, 'company', 'TWO');
  resume = updateRoleBlockEntry(resume, 'experience', secondEntry.id, 'company', 'ONE');

  const mixedPreview = createMixedSamplePreviewModel(resume, 'resume-5', getPreviewModel(resume));
  const experiencePreview = mixedPreview.sectionBlocks.find((section) => section.id === 'experience');
  const sampleOnlyEntryId = experiencePreview.entryOrder.find((entryId) => entryId !== firstEntry.id && entryId !== secondEntry.id);
  const reorderedPreview = createMixedSamplePreviewModel(resume, 'resume-5', getPreviewModel(resume), {
    'experience.entries': [firstEntry.id, sampleOnlyEntryId, secondEntry.id, ...experiencePreview.entryOrder.filter((entryId) => (
      entryId !== firstEntry.id && entryId !== secondEntry.id && entryId !== sampleOnlyEntryId
    ))],
  });
  const reorderedExperience = reorderedPreview.sectionBlocks.find((section) => section.id === 'experience');

  assert.deepEqual(reorderedExperience.entries.map((entry) => entry.id), reorderedExperience.entryOrder);
  assert.deepEqual(reorderedExperience.entries.map((entry) => entry.company), [
    'TWO',
    'Hacker Hostel',
    'ONE',
    'Bachmanity Capital',
  ]);
  assert.deepEqual(getSection(resume, 'experience').entries.map((entry) => entry.company), ['TWO', 'ONE']);
});

test('sample-only editor projection creates only the clicked blank entry and its list rows', () => {
  const resume = updateSampleDisplay(createEmptyResume(), { hasStarted: true, showInformation: true });
  const preview = createMixedSamplePreviewModel(resume, 'resume-5', getPreviewModel(resume));
  const previewSection = preview.sectionBlocks.find((section) => section.id === 'experience');
  const realEntryIds = new Set(getSection(resume, 'experience').entries.map((entry) => entry.id));
  const previewEntry = previewSection.entries.find((entry) => !realEntryIds.has(entry.id));
  const result = projectTransientSampleEntry(
    resume,
    'experience',
    previewEntry,
    previewSection.entryOrder,
  );
  const projectedEntries = getSection(result.resume, 'experience').entries;

  assert.equal(projectedEntries.length, getSection(resume, 'experience').entries.length + 1);
  assert.equal(projectedEntries.some((entry) => entry.id === previewEntry.id), true);
  assert.equal(projectedEntries.find((entry) => entry.id === previewEntry.id).company, '');
  assert.equal(
    projectedEntries.find((entry) => entry.id === previewEntry.id).activities.length,
    previewEntry.activities.length,
  );
  assert.equal(result.transient.entryId, previewEntry.id);
  assert.equal(result.transient.baselineEntry, null);
  assert.deepEqual(getSection(resume, 'experience').entries.map((entry) => entry.id), [...realEntryIds]);
});

test('untouched sample editor projections resolve without persisting blank structure', () => {
  const resume = updateSampleDisplay(createEmptyResume(), { hasStarted: true, showInformation: true });
  const preview = createMixedSamplePreviewModel(resume, 'resume-5', getPreviewModel(resume));
  const previewSection = preview.sectionBlocks.find((section) => section.id === 'experience');
  const realEntryIds = new Set(getSection(resume, 'experience').entries.map((entry) => entry.id));
  const previewEntry = previewSection.entries.find((entry) => !realEntryIds.has(entry.id));
  const projected = projectTransientSampleEntry(resume, 'experience', previewEntry, previewSection.entryOrder);
  const resolved = resolveTransientSampleEntry(projected.resume, projected.transient);

  assert.deepEqual(getSection(resolved, 'experience').entries, getSection(resume, 'experience').entries);

  const edited = updateSectionBlockEntry(projected.resume, 'experience', previewEntry.id, 'company', 'Real company');
  const promoted = resolveTransientSampleEntry(edited, projected.transient);

  assert.equal(getSection(promoted, 'experience').entries.find((entry) => entry.id === previewEntry.id).company, 'Real company');
});

test('existing blank entries temporarily gain sample list rows and restore their baseline when empty', () => {
  const resume = updateSampleDisplay(createEmptyResume(), { hasStarted: true, showInformation: true });
  const preview = createMixedSamplePreviewModel(resume, 'resume-5', getPreviewModel(resume));
  const previewSection = preview.sectionBlocks.find((section) => section.id === 'experience');
  const previewEntry = previewSection.entries[0];
  const baselineEntry = getSection(resume, 'experience').entries[0];
  const projected = projectTransientSampleEntry(resume, 'experience', previewEntry, previewSection.entryOrder);
  const projectedEntry = getSection(projected.resume, 'experience').entries[0];

  assert.ok(projectedEntry.activities.length > baselineEntry.activities.length);
  assert.deepEqual(
    getSection(resolveTransientSampleEntry(projected.resume, projected.transient), 'experience').entries[0],
    baselineEntry,
  );
});

test('transient sample entry changes ignore blank projection rows and whitespace', () => {
  const resume = createEmptyResume();
  const section = resume.sections.find((candidate) => candidate.kind === 'roles');
  const existingEntry = section.entries[0];
  existingEntry.company = 'Real company';
  const previewEntry = {
    id: existingEntry.id,
    activities: [
      { text: 'Sample one', sourceIndex: 0 },
      { text: 'Sample two', sourceIndex: 1 },
    ],
  };
  const projection = projectTransientSampleEntry(resume, section.id, previewEntry, [existingEntry.id]);

  assert.equal(didTransientSampleEntryChange(projection.resume, projection.transient), false);

  const whitespaceEdit = updateSectionBlockTextList(
    projection.resume,
    section.id,
    existingEntry.id,
    'activities',
    1,
    '   ',
  );
  assert.equal(didTransientSampleEntryChange(whitespaceEdit, projection.transient), false);

  const realEdit = updateSectionBlockTextList(
    projection.resume,
    section.id,
    existingEntry.id,
    'activities',
    1,
    'Built a real system',
  );
  assert.equal(didTransientSampleEntryChange(realEdit, projection.transient), true);
});

test('sample-only entry reorders materialize blank editor rows that preserve order', () => {
  let resume = updateSampleDisplay(createEmptyResume(), { hasStarted: true, showInformation: true });
  resume = addRoleBlockEntry(resume, 'experience');

  const [firstEntry, secondEntry] = getSection(resume, 'experience').entries;
  resume = updateRoleBlockEntry(resume, 'experience', firstEntry.id, 'company', 'TWO');
  resume = updateRoleBlockEntry(resume, 'experience', secondEntry.id, 'company', 'ONE');

  const mixedPreview = createMixedSamplePreviewModel(resume, 'resume-5', getPreviewModel(resume));
  const experiencePreview = mixedPreview.sectionBlocks.find((section) => section.id === 'experience');
  const sampleOnlyEntryId = experiencePreview.entryOrder.find((entryId) => entryId !== firstEntry.id && entryId !== secondEntry.id);
  const nextPreviewOrder = [
    sampleOnlyEntryId,
    firstEntry.id,
    secondEntry.id,
    ...experiencePreview.entryOrder.filter((entryId) => (
      entryId !== firstEntry.id && entryId !== secondEntry.id && entryId !== sampleOnlyEntryId
    )),
  ];

  const materializedResume = materializeAndReorderSectionBlockEntries(resume, 'experience', nextPreviewOrder);
  const materializedEntries = getSection(materializedResume, 'experience').entries;

  assert.deepEqual(materializedEntries.map((entry) => entry.id), nextPreviewOrder);
  assert.equal(materializedEntries[0].id, sampleOnlyEntryId);
  assert.equal(materializedEntries[0].company, '');
  assert.equal(materializedEntries[0].role, '');
  assert.deepEqual(materializedEntries[0].activities, ['']);
  assert.deepEqual(materializedEntries.slice(1, 3).map((entry) => entry.company), ['TWO', 'ONE']);

  const updatedResume = updateRoleBlockEntry(materializedResume, 'experience', sampleOnlyEntryId, 'company', 'THREE');
  const reloadedPreview = createMixedSamplePreviewModel(updatedResume, 'resume-5', getPreviewModel(updatedResume));
  const reloadedExperience = reloadedPreview.sectionBlocks.find((section) => section.id === 'experience');

  assert.deepEqual(getSection(updatedResume, 'experience').entries.slice(0, 3).map((entry) => entry.company), [
    'THREE',
    'TWO',
    'ONE',
  ]);
  assert.deepEqual(reloadedExperience.entries.slice(0, 3).map((entry) => entry.company), [
    'THREE',
    'TWO',
    'ONE',
  ]);
});

test('two sample-only entries can reorder into persistent blank editor rows', () => {
  const resume = updateSampleDisplay(createEmptyResume(), { hasStarted: true, showInformation: true });
  const mixedPreview = createMixedSamplePreviewModel(resume, 'resume-5', getPreviewModel(resume));
  const experiencePreview = mixedPreview.sectionBlocks.find((section) => section.id === 'experience');
  const realEntryIds = new Set(getSection(resume, 'experience').entries.map((entry) => entry.id));
  const sampleOnlyEntryIds = experiencePreview.entryOrder.filter((entryId) => !realEntryIds.has(entryId));
  const nextPreviewOrder = [
    experiencePreview.entryOrder[0],
    sampleOnlyEntryIds[1],
    sampleOnlyEntryIds[0],
    ...experiencePreview.entryOrder.filter((entryId) => (
      entryId !== experiencePreview.entryOrder[0] &&
      entryId !== sampleOnlyEntryIds[0] &&
      entryId !== sampleOnlyEntryIds[1]
    )),
  ];

  const materializedResume = materializeAndReorderSectionBlockEntries(resume, 'experience', nextPreviewOrder);
  const materializedEntries = getSection(materializedResume, 'experience').entries;
  const reloadedPreview = createMixedSamplePreviewModel(materializedResume, 'resume-5', getPreviewModel(materializedResume));
  const reloadedExperience = reloadedPreview.sectionBlocks.find((section) => section.id === 'experience');

  assert.deepEqual(materializedEntries.map((entry) => entry.id), nextPreviewOrder);
  assert.deepEqual(materializedEntries.map((entry) => entry.company), ['', '', '', '']);
  assert.deepEqual(reloadedExperience.entries.map((entry) => entry.id), nextPreviewOrder);
  assert.equal(new Set(reloadedExperience.entries.map((entry) => entry.id)).size, reloadedExperience.entries.length);
  assert.deepEqual(reloadedExperience.entries.map((entry) => entry.isSamplePlaceholderEntry), [true, true, true, true]);
});

test('sample entry ids stay bound to their original sample content after materialized reorder', () => {
  const resume = updateSampleDisplay(createEmptyResume(), { hasStarted: true, showInformation: true });
  const mixedPreview = createMixedSamplePreviewModel(resume, 'resume-5', getPreviewModel(resume));
  const experiencePreview = mixedPreview.sectionBlocks.find((section) => section.id === 'experience');
  const lastSampleEntryId = experiencePreview.entryOrder.at(-1);
  const nextPreviewOrder = [
    lastSampleEntryId,
    ...experiencePreview.entryOrder.filter((entryId) => entryId !== lastSampleEntryId),
  ];

  const materializedResume = materializeAndReorderSectionBlockEntries(resume, 'experience', nextPreviewOrder);
  const reloadedPreview = createMixedSamplePreviewModel(materializedResume, 'resume-5', getPreviewModel(materializedResume));
  const reloadedExperience = reloadedPreview.sectionBlocks.find((section) => section.id === 'experience');

  assert.deepEqual(getSection(materializedResume, 'experience').entries.map((entry) => entry.id), nextPreviewOrder);
  assert.equal(reloadedExperience.entries[0].id, lastSampleEntryId);
  assert.equal(reloadedExperience.entries[0].company, 'Bachmanity Capital');
  assert.equal(reloadedExperience.entries[0].role, 'Co-Founder / General Partner');
});

test('sample preview section reorders persist real section order without sample content', () => {
  const resume = updateSampleDisplay(createEmptyResume(), { hasStarted: true, showInformation: true });
  const preview = createMixedSamplePreviewModel(resume, 'resume-5', getPreviewModel(resume));
  const nextPreviewSectionOrder = [
    'projects',
    ...preview.sectionOrder.filter((sectionId) => sectionId !== 'projects'),
  ];
  const reorderedResume = reorderResumeSectionBlocksToMatch(resume, nextPreviewSectionOrder);
  const reorderedPreview = createMixedSamplePreviewModel(reorderedResume, 'resume-5', getPreviewModel(reorderedResume));

  assert.equal(reorderedResume.sections[0].id, 'projects');
  assert.equal(reorderedPreview.sectionOrder[0], 'projects');
  assert.equal(getPreviewModel(reorderedResume).hasContent, false);
});

test('sample preview bullet reorders persist only when source indexes map to real bullets', () => {
  let resume = updateSampleDisplay(createEmptyResume(), { hasStarted: true, showInformation: true });
  const experienceEntryId = getSection(resume, 'experience').entries[0].id;

  resume = addRoleBlockActivity(resume, 'experience', experienceEntryId);
  resume = updateRoleBlockActivity(resume, 'experience', experienceEntryId, 0, 'First real highlight.');
  resume = addRoleBlockActivity(resume, 'experience', experienceEntryId);
  resume = updateRoleBlockActivity(resume, 'experience', experienceEntryId, 1, 'Second real highlight.');

  const persistedMove = getPersistableSampleTextListMove(resume, 'experience', experienceEntryId, 'activities', 1, 0);
  const ignoredSampleOnlyMove = getPersistableSampleTextListMove(resume, 'experience', experienceEntryId, 'activities', 2, 0);

  assert.deepEqual(persistedMove, { fromIndex: 1, toIndex: 0 });
  assert.equal(ignoredSampleOnlyMove, null);

  const reorderedResume = reorderSectionBlockTextListItem(
    resume,
    'experience',
    experienceEntryId,
    'activities',
    persistedMove.fromIndex,
    persistedMove.toIndex,
  );

  assert.deepEqual(
    getSection(reorderedResume, 'experience').entries[0].activities,
    ['Second real highlight.', 'First real highlight.', ''],
  );
});

test('mixed sample preview keeps active empty added sections in resume order', () => {
  let resume = updateSampleDisplay(createEmptyResume(), { hasStarted: true, showInformation: true });
  let result = addResumeSectionBlock(resume, 'community-service');
  resume = result.resume;
  const communitySectionId = result.sectionId;

  result = addResumeSectionBlock(resume, 'custom-section');
  resume = result.resume;
  const customSectionId = result.sectionId;

  resume = reorderResumeSectionBlocksToMatch(resume, [
    'education',
    communitySectionId,
    customSectionId,
    'experience',
    'internships',
    'projects',
    'skills',
  ]);

  const realPreview = getPreviewModel(resume);

  assert.equal(realPreview.sectionBlocks.some((section) => section.id === communitySectionId), false);
  assert.equal(realPreview.sectionBlocks.some((section) => section.id === customSectionId), false);

  const communityPreview = createMixedSamplePreviewModel(resume, 'resume-5', realPreview, {}, {
    activeSectionId: communitySectionId,
  });

  assert.deepEqual(
    communityPreview.sectionBlocks.slice(0, 4).map((section) => section.id),
    ['education', communitySectionId, 'experience', 'projects'],
  );
  assert.equal(communityPreview.sectionBlocks.find((section) => section.id === communitySectionId).kind, 'roles');
  assert.equal(communityPreview.sectionBlocks.find((section) => section.id === communitySectionId).entries.length, 0);

  const customPreview = createMixedSamplePreviewModel(resume, 'resume-5', realPreview, {}, {
    activeSectionId: customSectionId,
  });

  assert.deepEqual(
    customPreview.sectionBlocks.slice(0, 4).map((section) => section.id),
    ['education', customSectionId, 'experience', 'projects'],
  );
  assert.equal(customPreview.sectionBlocks.find((section) => section.id === customSectionId).kind, 'custom');
  assert.equal(customPreview.sectionBlocks.find((section) => section.id === customSectionId).entries.length, 0);
});

test('each fictional sample renders multiple complete experience entries', () => {
  const previewsBySampleId = new Map();

  for (let index = 0; index < 128 && previewsBySampleId.size < 9; index += 1) {
    const resume = createEmptyResume();
    const before = JSON.stringify(resume);
    const preview = createSamplePreviewModel(resume, `resume-${index}`, getPreviewModel(resume));

    if (!previewsBySampleId.has(preview.sampleId)) {
      previewsBySampleId.set(preview.sampleId, preview);
    }

    assert.equal(JSON.stringify(resume), before);
  }

  assert.equal(previewsBySampleId.size, 9);

  for (const [sampleId, preview] of previewsBySampleId.entries()) {
    const roleBlock = preview.sectionBlocks.find((section) => section.id === 'experience');

    assert.ok(roleBlock, `${sampleId} should render an experience block`);
    assert.ok(roleBlock.entries.length >= 4, `${sampleId} should have fuller experience coverage`);

    for (const entry of roleBlock.entries) {
      assert.ok(entry.company, `${sampleId} experience should include an organization`);
      assert.ok(entry.role, `${sampleId} experience should include a role title`);
      assert.ok(entry.location, `${sampleId} experience should include a location`);
      assert.ok(entry.yearsExp, `${sampleId} experience should include date metadata`);
      assert.equal(entry.yearsExp.includes('|'), false, `${sampleId} date field should not contain location separators`);
      assert.ok(entry.activities.length >= 2, `${sampleId} experience should include multiple highlights`);
    }
  }
});

test('sample resume model is not used once real resume content exists', () => {
  const resume = updatePersonalField(createEmptyResume(), 'name', 'Real Person');
  const preview = getPreviewModel(resume);

  assert.equal(preview.hasContent, true);
  assert.equal(createSamplePreviewModel(resume, 'resume-alpha', preview), null);
});

test('validateResume uses block editor paths', () => {
  let resume = createEmptyResume();
  const roleEntryId = getSection(resume, 'experience').entries[0].id;

  resume = updatePersonalField(resume, 'name', 'Grace Hopper');
  resume = updatePersonalField(resume, 'email', 'grace@example.com');
  resume = updateRoleBlockEntry(resume, 'experience', roleEntryId, 'company', 'Navy');

  const errors = validateResume(resume);

  assert.equal(errors[`sections.experience.${roleEntryId}.role`], 'Add the role title.');
  assert.equal(errors[`sections.experience.${roleEntryId}.yearsExp`], 'Add the date range.');
});
