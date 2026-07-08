import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  DEFAULT_TEMPLATE,
  MAX_RESUME_SECTIONS,
  MAX_WORKSPACE_RESUME_NAME_LENGTH,
  MAX_WORKSPACE_RESUMES,
  SECTION_TEMPLATE_GROUPS,
  UNTITLED_SECTION_TITLE,
  addResumeSectionBlock,
  addRoleBlockActivity,
  addRoleBlockEntry,
  commitSectionTitle,
  createDuplicateResumeName,
  createEmptyResume,
  createFreshWorkspaceDraft,
  createNextResumeName,
  createResumeStorageKey,
  createWorkspaceResumeId,
  createWorkspaceResumeMeta,
  getDefaultEntryHeaderLayout,
  getPreviewModel,
  materializeAndReorderSectionBlockEntries,
  moveSectionHeaderField,
  getResumePresentationVars,
  getResumePrintPageRule,
  moveResumeSectionBlock,
  normalizeDraftPayload,
  normalizeResumeSettings,
  normalizeWorkspaceIndex,
  removeResumeSectionBlock,
  reorderSectionBlockEntriesToMatch,
  reorderSectionBlockTextListItem,
  reorderResumeSectionBlocksToMatch,
  reorderWorkspaceResumesToMatch,
  setResumeSettingValue,
  setResumeSummaryWidthPercent,
  setSectionEntryHeaderLayout,
  normalizeEntryHeaderLayout,
  updatePersonalField,
  updateRoleBlockActivity,
  updateRoleBlockEntry,
  updateResumeSetting,
  updateSampleDisplay,
  updateSectionBlockEducationCustomSection,
  updateSectionBlockEducationProgram,
  updateSectionBlockEntry,
  updateSectionBlockTextList,
  updateSectionTitle,
  validateResume,
} from '../src/lib/resume.js';
import { calculatePreviewPageBreaks } from '../src/lib/previewPagination.js';
import {
  createOutboxAckDescriptor,
  createDraftContentHash,
  createSavedDraftState,
  filterOutboxOperationsForAccount,
  mergeLocalAndCloudWorkspaces,
  outboxOperationBelongsToAccount,
  outboxOperationMatchesAck,
} from '../src/lib/localWorkspaceDb.js';
import {
  getOperationAcksFromResponse,
} from '../src/lib/backgroundSync.js';
import {
  operationBelongsToSyncAccount,
  partitionSyncOperationsByAccount,
} from '../api/sync-workspace.js';
import {
  DEFAULT_GEMINI_IMPORT_MODEL,
  DEFAULT_GEMINI_THINKING_LEVEL,
  IMPORT_FILE_MAX_BYTES,
  assessExtractedResumeText,
  compileSourceDocumentToImportedDraft,
  createGeminiImportGenerationConfig,
  createImageSourceDocumentGeminiContents,
  createSourceDocumentCoverage,
  createSourceDocumentFromText,
  normalizeImportFilePayload,
  shouldUseVisualPdfFallbackForSourceText,
  validateImportedDraftCoverage,
} from '../server/importResume.js';
import {
  validateImportResumeFile,
} from '../src/lib/importResume.js';
import {
  createMixedSamplePreviewModel,
  createSamplePlaceholderResolver,
  createSamplePreviewModel,
  getPersistableSampleEntryOrder,
  getPersistableSampleTextListMove,
  getSampleResumeIndex,
} from '../src/lib/sampleResumes.js';

function getSection(resume, sectionId) {
  return resume.sections.find((section) => section.id === sectionId);
}

function createDraft(name, savedAt = '2026-01-01T00:00:00.000Z') {
  const resume = updatePersonalField(createEmptyResume(), 'name', name);

  return {
    resume,
    template: DEFAULT_TEMPLATE,
    savedAt,
  };
}

function createWorkspace(resumeIds, { activeResumeId = resumeIds[0], names = {}, updatedAt = '2026-01-01T00:00:00.000Z' } = {}) {
  return normalizeWorkspaceIndex({
    activeResumeId,
    resumeIds,
    meta: Object.fromEntries(resumeIds.map((resumeId, index) => [
      resumeId,
      createWorkspaceResumeMeta(names[resumeId] || `Resume ${index + 1}`, updatedAt),
    ])),
  });
}

test('createEmptyResume returns the block-first resume shape', () => {
  const resume = createEmptyResume();

  assert.deepEqual(Object.keys(resume).sort(), ['personal', 'sampleDisplay', 'sections', 'settings']);
  assert.deepEqual(resume.sampleDisplay, {
    hasStarted: false,
    showInformation: true,
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
    personalSeparatorTone: 50,
    sectionSeparatorTone: 50,
    personalSeparatorWeight: 2,
    sectionSeparatorWeight: 2,
    personalSeparatorGap: 0,
    sectionSeparatorGap: 0,
    sectionSeparatorPosition: 'aboveSectionName',
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
  });
  assert.deepEqual(normalizeDraftPayload({ resume }).resume.sampleDisplay, {
    hasStarted: true,
    showInformation: false,
  });
  assert.deepEqual(normalizeDraftPayload({
    resume: {
      ...resume,
      sampleDisplay: {
        hasStarted: 'yes',
      },
    },
  }).resume.sampleDisplay, {
    hasStarted: true,
    showInformation: true,
  });
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

test('sample preview entry reorders persist real editor entry order when IDs match', () => {
  let resume = updateSampleDisplay(createEmptyResume(), { hasStarted: true, showInformation: true });
  resume = addRoleBlockEntry(resume, 'experience');

  const [firstEntry, secondEntry] = getSection(resume, 'experience').entries;
  resume = updateRoleBlockEntry(resume, 'experience', firstEntry.id, 'company', 'ONE');
  resume = updateRoleBlockEntry(resume, 'experience', secondEntry.id, 'company', 'TWO');

  const mixedPreview = createMixedSamplePreviewModel(resume, 'resume-5', getPreviewModel(resume));
  const experiencePreview = mixedPreview.sectionBlocks.find((section) => section.id === 'experience');
  const nextPreviewOrder = [
    secondEntry.id,
    firstEntry.id,
    ...experiencePreview.entryOrder.filter((entryId) => entryId !== firstEntry.id && entryId !== secondEntry.id),
  ];
  const persistedOrder = getPersistableSampleEntryOrder(resume, 'experience', nextPreviewOrder);

  assert.deepEqual(experiencePreview.entries.slice(0, 2).map((entry) => entry.company), ['ONE', 'TWO']);
  assert.deepEqual(persistedOrder, [secondEntry.id, firstEntry.id]);

  const reorderedResume = reorderSectionBlockEntriesToMatch(resume, 'experience', persistedOrder);
  assert.deepEqual(
    getSection(reorderedResume, 'experience').entries.map((entry) => entry.company),
    ['TWO', 'ONE'],
  );
  assert.equal(getPersistableSampleEntryOrder(createEmptyResume(), 'experience', nextPreviewOrder), null);
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

  assert.equal(getPersistableSampleEntryOrder(resume, 'experience', reorderedExperience.entryOrder), null);
  assert.deepEqual(reorderedExperience.entries.map((entry) => entry.id), reorderedExperience.entryOrder);
  assert.deepEqual(reorderedExperience.entries.map((entry) => entry.company), [
    'TWO',
    'Hacker Hostel',
    'ONE',
    'Bachmanity Capital',
  ]);
  assert.deepEqual(getSection(resume, 'experience').entries.map((entry) => entry.company), ['TWO', 'ONE']);
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

test('workspace helpers support local-first resume ordering and naming', () => {
  const resumeId = createWorkspaceResumeId();
  const workspace = createFreshWorkspaceDraft();

  assert.match(resumeId, /^id-|^[0-9a-f-]{8,}$/i);
  assert.equal(MAX_WORKSPACE_RESUMES, 100);
  assert.equal(createResumeStorageKey('abc123'), 'resumeloomr:resume:abc123');
  assert.equal(workspace.workspace.meta[workspace.activeResumeId].name, 'Resume 1');
  assert.equal(createNextResumeName(['Resume 1', 'Resume 3']), 'Resume 2');
  assert.equal(createDuplicateResumeName('Resume no skills', ['Resume no skills']), 'Resume no skills copy');
  assert.ok(createDuplicateResumeName('abcdefghijklmnopqrstuvwxyz'.repeat(2), []).length <= MAX_WORKSPACE_RESUME_NAME_LENGTH);
});

test('workspace reorder helper preserves active resume and exact rail order', () => {
  const workspace = createWorkspace(['r1', 'r2', 'r3'], { activeResumeId: 'r2' });
  const reordered = reorderWorkspaceResumesToMatch(workspace, ['r3', 'r1', 'r2']);

  assert.deepEqual(reordered.resumeIds, ['r3', 'r1', 'r2']);
  assert.equal(reordered.activeResumeId, 'r2');
});

test('resume settings produce bounded preview and print variables', () => {
  const settings = normalizeResumeSettings({
    textSize: 99,
    horizontalMargins: -99,
    verticalMargins: 2,
  });
  const vars = getResumePresentationVars(settings, 'compact');

  assert.equal(settings.textSize, 5);
  assert.equal(settings.horizontalMargins, -5);
  assert.equal(settings.summaryWidthPercent, 100);
  assert.equal(settings.personalSeparatorTone, 50);
  assert.equal(settings.sectionSeparatorWeight, 2);
  assert.equal(settings.sectionSeparatorPosition, 'aboveSectionName');
  assert.match(vars['--resume-page-margin-inline'], /in$/);
  assert.match(vars['--resume-print-content-width'], /in$/);
  assert.match(vars['--resume-name-size'], /px$/);
  assert.match(vars['--resume-heading-size'], /px$/);
  assert.match(vars['--resume-body-size'], /px$/);
  assert.match(vars['--resume-detail-size'], /px$/);
  assert.match(vars['--resume-meta-size'], /px$/);
  assert.match(vars['--resume-headline-size'], /px$/);
  assert.doesNotMatch(vars['--resume-body-size'], /rem$/);
  assert.equal(vars['--resume-summary-width-percent'], '100%');
  assert.equal(vars['--resume-section-separator-color'], 'rgba(0, 0, 0, 0.5)');
  assert.equal(vars['--resume-section-separator-weight'], '1px');
  assert.match(getResumePrintPageRule(settings, 'compact'), /^@page \{ size: letter;/);

  const updatedResume = updateResumeSetting(createEmptyResume(), 'textSize', 1);
  assert.equal(updatedResume.settings.textSize, 1);

  const narrowSummary = setResumeSummaryWidthPercent(createEmptyResume(), 10);
  assert.equal(narrowSummary.settings.summaryWidthPercent, 75);

  const wideSummary = setResumeSummaryWidthPercent(createEmptyResume(), 110);
  assert.equal(wideSummary.settings.summaryWidthPercent, 100);

  const hiddenPersonalSeparator = setResumeSettingValue(createEmptyResume(), 'personalSeparatorTone', -20);
  assert.equal(hiddenPersonalSeparator.settings.personalSeparatorTone, 0);

  const thickSectionSeparator = setResumeSettingValue(createEmptyResume(), 'sectionSeparatorWeight', 99);
  assert.equal(thickSectionSeparator.settings.sectionSeparatorWeight, 5);

  const compactSectionGap = setResumeSettingValue(createEmptyResume(), 'sectionSeparatorGap', -99);
  assert.equal(compactSectionGap.settings.sectionSeparatorGap, -5);

  const belowHeadingSeparator = setResumeSettingValue(createEmptyResume(), 'sectionSeparatorPosition', 'belowSectionName');
  assert.equal(belowHeadingSeparator.settings.sectionSeparatorPosition, 'belowSectionName');

  const invalidSeparatorPosition = setResumeSettingValue(createEmptyResume(), 'sectionSeparatorPosition', 'sideways');
  assert.equal(invalidSeparatorPosition.settings.sectionSeparatorPosition, 'aboveSectionName');
});

test('preview mobile chrome rules do not reflow printable resume content', () => {
  const previewCss = fs.readFileSync('src/styles/preview.css', 'utf8');
  const appCss = fs.readFileSync('src/App.css', 'utf8');
  const indexHtml = fs.readFileSync('index.html', 'utf8');

  assert.match(indexHtml, /<meta name="format-detection" content="telephone=no, email=no, address=no, date=no" \/>/);
  assert.match(previewCss, /@media screen and \(max-width: 720px\)/);
  assert.doesNotMatch(appCss, /@media \((?:max|min)-width/);
  assert.doesNotMatch(previewCss, /@media \((?:max|min)-width/);
  assert.match(previewCss, /-webkit-text-size-adjust:\s*100%/);
  assert.match(previewCss, /\.resumePage\s*\{[\s\S]*?font-family:\s*Arial,\s*Helvetica,\s*sans-serif/);
  assert.match(previewCss, /--resume-name-size:\s*24px/);
  assert.match(previewCss, /--resume-body-size:\s*12px/);
  assert.match(previewCss, /\.previewDragOverlay h2\s*\{[\s\S]*?font-size:\s*var\(--resume-heading-size,\s*10px\)/);
  assert.match(previewCss, /\.resumePage a\[x-apple-data-detectors\],\s*\.resumePage a\[href\^="tel"\],\s*\.resumePage a\[href\^="mailto"\]\s*\{[\s\S]*?font:\s*inherit !important/);
  assert.match(previewCss, /\.resumePage h2\s*\{[\s\S]*?line-height:\s*1\.1/);
  assert.doesNotMatch(previewCss, /@media \(max-width: 720px\)[\s\S]*?\.previewEntryHeader[\s\S]*?flex-direction:\s*column/);
  assert.doesNotMatch(previewCss, /@media \(max-width: 720px\)[\s\S]*?\.personalDetails[\s\S]*?flex-wrap:\s*wrap/);
});

test('preview print CSS uses physical page geometry instead of mobile viewport geometry', () => {
  const previewCss = fs.readFileSync('src/styles/preview.css', 'utf8');
  const appCss = fs.readFileSync('src/App.css', 'utf8');
  const previewComponent = fs.readFileSync('src/components/resumePreview.jsx', 'utf8');
  const builderHook = fs.readFileSync('src/hooks/useResumeBuilder.js', 'utf8');
  const printStart = previewCss.indexOf('@media print');
  const pageRuleStart = previewCss.indexOf('@page', printStart);
  const printCss = printStart >= 0 && pageRuleStart > printStart
    ? previewCss.slice(printStart, pageRuleStart)
    : '';
  const appPrintStart = appCss.indexOf('@media print');
  const appPrintCss = appPrintStart >= 0 ? appCss.slice(appPrintStart) : '';

  assert.match(printCss, /\.previewPageViewport,\s*\.previewPageScaleShell,\s*\.previewPageScaleLayer\s*\{[\s\S]*?position:\s*static !important/);
  assert.match(printCss, /\.previewPageViewport,\s*\.previewPageScaleShell,\s*\.previewPageScaleLayer\s*\{[\s\S]*?width:\s*var\(--resume-print-content-width\) !important/);
  assert.match(printCss, /\.previewPageViewport,\s*\.previewPageScaleShell,\s*\.previewPageScaleLayer\s*\{[\s\S]*?height:\s*auto !important/);
  assert.match(printCss, /\.previewPageViewport,\s*\.previewPageScaleShell,\s*\.previewPageScaleLayer\s*\{[\s\S]*?-webkit-transform:\s*none !important/);
  assert.match(printCss, /\.resumePage\s*\{[\s\S]*?width:\s*var\(--resume-print-content-width\)/);
  assert.match(printCss, /\.resumePage\s*\{[\s\S]*?-webkit-filter:\s*none !important/);
  assert.match(printCss, /\.resumePage\s*\{[\s\S]*?-webkit-transform:\s*none !important/);
  assert.match(previewCss, /@page\s*\{\s*size:\s*letter;\s*margin:\s*0\.5in;/);
  assert.match(appPrintCss, /\.app::before\s*\{[\s\S]*?display:\s*none !important/);
  assert.match(appPrintCss, /\.sectionAddDialogLayer,\s*\.resumePillOverlay,\s*\.tabButtonOverlay,\s*\.previewDragOverlayFrame,\s*\.mobileWorkspaceToggle/);
  assert.match(appPrintCss, /\.appShell\s*\{[\s\S]*?width:\s*auto/);
  assert.match(appPrintCss, /\.workspace\s*\{[\s\S]*?max-width:\s*none/);
  assert.match(appPrintCss, /html,\s*body,\s*#root,\s*\.app\s*\{[\s\S]*?-webkit-text-size-adjust:\s*100% !important/);
  assert.match(appPrintCss, /html,\s*body\s*\{[\s\S]*?font-size:\s*16px !important/);
  assert.match(appPrintCss, /\.workspaceColumnPreview,\s*\.previewPanel,\s*\.previewFrame\s*\{[\s\S]*?width:\s*auto/);
  assert.match(builderHook, /window\.addEventListener\('beforeprint', handleBeforePrint\)/);
  assert.match(builderHook, /function preparePrintView\(\)\s*\{[\s\S]*?setMobileView\('preview'\)/);
  assert.match(previewComponent, /className="previewPageViewport" style=\{presentationVars\}/);
  assert.match(previewComponent, /useLayoutEffect\(\(\) => \{\s*if \(typeof document === 'undefined'\)/);
  assert.match(previewComponent, /document\.head\.appendChild\(styleElement\)/);
  assert.doesNotMatch(previewComponent, /<style media="print">/);
});

test('below-heading section separators render on the final visible section', () => {
  const previewCss = fs.readFileSync('src/styles/preview.css', 'utf8');
  const previewComponent = fs.readFileSync('src/components/resumePreview.jsx', 'utf8');

  assert.match(previewComponent, /const showSeparator = sectionSeparatorPosition === 'belowSectionName'\s*\?\s*true\s*:\s*index < visibleSectionBlocks\.length - 1/);
  assert.match(previewComponent, /separatorPosition === 'belowSectionName'\s*\?\s*renderSectionSeparatorControl/);
  assert.match(previewCss, /\.resumeSection:not\(\.resumeSection--separatorBelowHeading\):last-child > \.sectionSeparatorControl/);
  assert.match(previewCss, /\.resumeSection:not\(\.resumeSection--separatorBelowHeading\)\.resumeSection--lastVisible > \.sectionSeparatorControl/);
});

test('preview page break helper uses printable height for raw markers', () => {
  assert.deepEqual(calculatePreviewPageBreaks({
    contentHeight: 2200,
    printableHeight: 900,
  }), [900, 1800]);
});

test('preview page break helper moves marker before fitting cut-through entries', () => {
  assert.deepEqual(calculatePreviewPageBreaks({
    contentHeight: 1300,
    printableHeight: 900,
    breakCandidates: [
      { top: 884, bottom: 980, priority: 2 },
    ],
  }), [884]);
});

test('preview page break helper does not jump to the top of long entries', () => {
  assert.deepEqual(calculatePreviewPageBreaks({
    contentHeight: 1300,
    printableHeight: 900,
    breakCandidates: [
      { top: 760, bottom: 980, priority: 2 },
    ],
  }), [900]);
});

test('preview page break helper can snap first section entries farther', () => {
  assert.deepEqual(calculatePreviewPageBreaks({
    contentHeight: 1300,
    printableHeight: 900,
    breakCandidates: [
      { top: 780, bottom: 980, priority: 2, snapDistance: 144 },
    ],
  }), [780]);
});

test('preview page break helper does not move marker above oversized sections', () => {
  assert.deepEqual(calculatePreviewPageBreaks({
    contentHeight: 1800,
    printableHeight: 900,
    breakCandidates: [
      { top: 200, bottom: 1300, priority: 1 },
    ],
  }), [900]);
});

test('preview page break helper falls back to bullet candidates for oversized entries', () => {
  assert.deepEqual(calculatePreviewPageBreaks({
    contentHeight: 1600,
    printableHeight: 900,
    breakCandidates: [
      { top: 300, bottom: 1250, priority: 2 },
      { top: 884, bottom: 930, priority: 3 },
    ],
  }), [884]);
});

test('preview page break helper keeps raw marker when no clean candidate is valid', () => {
  assert.deepEqual(calculatePreviewPageBreaks({
    contentHeight: 1100,
    printableHeight: 900,
    breakCandidates: [
      { top: 920, bottom: 1020, priority: 2 },
    ],
  }), [900]);
});

test('draft content hashes ignore saved time but track content', () => {
  const firstDraft = createDraft('Resume A', '2026-01-01T00:00:00.000Z');
  const secondDraft = {
    ...firstDraft,
    savedAt: '2026-02-01T00:00:00.000Z',
  };
  const thirdDraft = createDraft('Resume B', '2026-02-01T00:00:00.000Z');

  assert.equal(createDraftContentHash(firstDraft), createDraftContentHash(secondDraft));
  assert.notEqual(createDraftContentHash(firstDraft), createDraftContentHash(thirdDraft));
});

test('saved draft state stamps a fresh save time', async () => {
  const oldDraft = createDraft('Fresh Save', '2000-01-01T03:10:00.000Z');
  const beforeSave = Date.now();
  await new Promise((resolve) => setTimeout(resolve, 2));
  const savedDraft = createSavedDraftState(oldDraft);

  assert.ok(Date.parse(savedDraft.savedAt) >= beforeSave);
  assert.notEqual(savedDraft.savedAt, oldDraft.savedAt);

  const blankSavedDraft = createSavedDraftState({
    ...oldDraft,
    savedAt: null,
  });

  assert.match(blankSavedDraft.savedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('login merge restores cloud resumes into blank local workspaces', () => {
  const localWorkspace = createWorkspace(['local-blank']);
  const cloudWorkspace = createWorkspace(['cloud-1', 'cloud-2'], { activeResumeId: 'cloud-2' });
  const result = mergeLocalAndCloudWorkspaces({
    localWorkspace,
    localDraftsByResumeId: new Map([['local-blank', createDraft('')]]),
    cloudWorkspace,
    cloudDraftsByResumeId: new Map([
      ['cloud-1', createDraft('Cloud One')],
      ['cloud-2', createDraft('Cloud Two')],
    ]),
  });

  assert.deepEqual(result.workspace.resumeIds, ['cloud-1', 'cloud-2']);
  assert.equal(result.activeResumeId, 'cloud-2');
  assert.equal(result.draftsByResumeId.get('cloud-1').resume.personal.name, 'Cloud One');
});

test('login merge treats sample-only local state as blank when restoring cloud resumes', () => {
  const localWorkspace = createWorkspace(['local-blank']);
  const localBlankDraft = {
    ...createDraft('', '2026-02-01T00:00:00.000Z'),
    resume: updateSampleDisplay(createEmptyResume(), {
      hasStarted: true,
      showInformation: false,
    }),
  };
  const cloudWorkspace = createWorkspace(['cloud-1'], { activeResumeId: 'cloud-1' });
  const result = mergeLocalAndCloudWorkspaces({
    localWorkspace,
    localDraftsByResumeId: new Map([['local-blank', localBlankDraft]]),
    cloudWorkspace,
    cloudDraftsByResumeId: new Map([['cloud-1', createDraft('Cloud Resume')]]),
  });

  assert.deepEqual(result.workspace.resumeIds, ['cloud-1']);
  assert.equal(result.activeResumeId, 'cloud-1');
  assert.equal(result.localHasContent, false);
  assert.deepEqual(result.syncPlan.upsertResumeIds, []);
});

test('login merge preserves local and cloud content without dropping either side', () => {
  const result = mergeLocalAndCloudWorkspaces({
    localWorkspace: createWorkspace(['local-1']),
    localDraftsByResumeId: new Map([['local-1', createDraft('Local Resume')]]),
    cloudWorkspace: createWorkspace(['cloud-1']),
    cloudDraftsByResumeId: new Map([['cloud-1', createDraft('Cloud Resume')]]),
  });

  assert.deepEqual(result.workspace.resumeIds, ['local-1', 'cloud-1']);
  assert.equal(result.syncPlan.workspaceNeedsSync, true);
  assert.deepEqual(result.syncPlan.upsertResumeIds, ['local-1']);
});

test('login merge syncs sample display preference without duplicating identical content', () => {
  const baseResume = createDraft('Same Resume').resume;
  const localDraft = {
    ...createDraft('Same Resume', '2026-02-01T00:00:00.000Z'),
    resume: updateSampleDisplay(baseResume, {
      hasStarted: true,
      showInformation: false,
    }),
  };
  const cloudDraft = {
    ...createDraft('Same Resume', '2026-01-01T00:00:00.000Z'),
    resume: updateSampleDisplay(baseResume, {
      hasStarted: true,
      showInformation: true,
    }),
  };
  const result = mergeLocalAndCloudWorkspaces({
    localWorkspace: createWorkspace(['resume-1'], { activeResumeId: 'resume-1' }),
    localDraftsByResumeId: new Map([['resume-1', localDraft]]),
    cloudWorkspace: createWorkspace(['resume-1'], { activeResumeId: 'resume-1' }),
    cloudDraftsByResumeId: new Map([['resume-1', cloudDraft]]),
  });

  assert.deepEqual(result.workspace.resumeIds, ['resume-1']);
  assert.equal(result.draftsByResumeId.get('resume-1').resume.sampleDisplay.showInformation, false);
  assert.equal(result.syncPlan.workspaceNeedsSync, true);
  assert.deepEqual(result.syncPlan.upsertResumeIds, ['resume-1']);
});

test('outbox acknowledgement matching requires the exact operation version and revision', () => {
  const operation = {
    id: 'upsertDraft:r1',
    type: 'upsertDraft',
    operationVersion: 100,
    localRevision: 'rev-a',
  };

  assert.deepEqual(createOutboxAckDescriptor(operation), {
    id: 'upsertDraft:r1',
    operationVersion: 100,
    localRevision: 'rev-a',
  });
  assert.equal(outboxOperationMatchesAck(operation, {
    id: 'upsertDraft:r1',
    operationVersion: 100,
    localRevision: 'rev-a',
  }), true);
  assert.equal(outboxOperationMatchesAck(operation, {
    id: 'upsertDraft:r1',
    operationVersion: 101,
    localRevision: 'rev-a',
  }), false);
  assert.equal(outboxOperationMatchesAck(operation, {
    id: 'upsertDraft:r1',
    operationVersion: 100,
    localRevision: 'rev-b',
  }), false);
  assert.equal(outboxOperationMatchesAck({
    id: 'deleteDraft:r1',
    type: 'deleteDraft',
    operationVersion: 200,
    localRevision: 'delete-token',
  }, {
    id: 'deleteDraft:r1',
    operationVersion: 200,
    localRevision: 'delete-token',
  }), true);
});

test('outbox account filtering keeps cloud sync scoped to the signed-in user', () => {
  const operations = [
    {
      id: 'upsertDraft:a1',
      type: 'upsertDraft',
      accountUid: 'account-a',
    },
    {
      id: 'upsertDraft:b1',
      type: 'upsertDraft',
      accountUid: 'account-b',
    },
    {
      id: 'upsertDraft:guest',
      type: 'upsertDraft',
      accountUid: '',
    },
  ];

  assert.equal(outboxOperationBelongsToAccount(operations[0], 'account-a'), true);
  assert.equal(outboxOperationBelongsToAccount(operations[1], 'account-a'), false);
  assert.equal(outboxOperationBelongsToAccount(operations[2], 'account-a'), false);
  assert.deepEqual(
    filterOutboxOperationsForAccount(operations, 'account-a').map((operation) => operation.id),
    ['upsertDraft:a1'],
  );
});

test('sync API partitions operations by the authenticated Firebase account', () => {
  const operations = [
    {
      id: 'workspace',
      type: 'workspace',
      accountUid: 'account-a',
      operationVersion: 10,
      localRevision: 'workspace-a',
    },
    {
      id: 'upsertDraft:r1',
      type: 'upsertDraft',
      accountUid: 'account-b',
      operationVersion: 20,
      localRevision: 'draft-b',
    },
    {
      id: 'upsertDraft:guest',
      type: 'upsertDraft',
      accountUid: '',
      operationVersion: 30,
      localRevision: 'guest-draft',
    },
  ];
  const result = partitionSyncOperationsByAccount(operations, 'account-a');

  assert.equal(operationBelongsToSyncAccount(operations[0], 'account-a'), true);
  assert.deepEqual(result.scopedOperations.map((operation) => operation.id), ['workspace']);
  assert.deepEqual(result.rejectedOperations, [
    { id: 'upsertDraft:r1', operationVersion: 20, localRevision: 'draft-b' },
    { id: 'upsertDraft:guest', operationVersion: 30, localRevision: 'guest-draft' },
  ]);
});

test('sync response acknowledgement mapping preserves sent operation descriptors', () => {
  const operations = [
    {
      id: 'workspace',
      type: 'workspace',
      operationVersion: 10,
      localRevision: 'workspace-token',
    },
    {
      id: 'upsertDraft:r1',
      type: 'upsertDraft',
      operationVersion: 20,
      localRevision: 'draft-rev',
    },
  ];

  assert.deepEqual(getOperationAcksFromResponse({
    syncedOperations: [{ id: 'workspace', operationVersion: 10, localRevision: 'workspace-token' }],
  }, operations, 'syncedOperations', 'syncedOperationIds'), [
    { id: 'workspace', operationVersion: 10, localRevision: 'workspace-token' },
  ]);
  assert.deepEqual(getOperationAcksFromResponse({
    syncedOperationIds: ['upsertDraft:r1'],
  }, operations, 'syncedOperations', 'syncedOperationIds'), [
    { id: 'upsertDraft:r1', operationVersion: 20, localRevision: 'draft-rev' },
  ]);
});

test('import file normalization rejects unsupported or oversized uploads', () => {
  assert.throws(
    () => normalizeImportFilePayload({
      fileName: 'resume.txt',
      mimeType: 'text/plain',
      fileDataBase64: Buffer.from('plain text').toString('base64'),
    }),
    /PDF, DOCX, PNG, JPG, or JPEG/,
  );

  assert.throws(
    () => normalizeImportFilePayload({
      fileName: 'resume.pdf',
      mimeType: 'application/pdf',
      fileDataBase64: Buffer.alloc(IMPORT_FILE_MAX_BYTES + 1).toString('base64'),
    }),
    /3 MB/,
  );
});

test('import file validation accepts PDF DOCX PNG JPG and JPEG files', () => {
  assert.equal(validateImportResumeFile({ name: 'resume.pdf', type: 'application/pdf', size: 12 }), '');
  assert.equal(validateImportResumeFile({ name: 'resume.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 12 }), '');
  assert.equal(validateImportResumeFile({ name: 'resume.png', type: 'image/png', size: 12 }), '');
  assert.equal(validateImportResumeFile({ name: 'resume.jpg', type: 'image/jpeg', size: 12 }), '');
  assert.equal(validateImportResumeFile({ name: 'resume.jpeg', type: 'image/jpeg', size: 12 }), '');
  assert.match(validateImportResumeFile({ name: 'resume.gif', type: 'image/gif', size: 12 }), /PDF, DOCX, PNG, JPG, or JPEG/);
});

test('server import file normalization accepts image resumes and rejects mismatched MIME types', () => {
  const pngPayload = normalizeImportFilePayload({
    fileName: 'resume.png',
    mimeType: 'image/png',
    fileDataBase64: Buffer.from('png bytes').toString('base64'),
  });
  const jpgPayload = normalizeImportFilePayload({
    fileName: 'resume.jpg',
    mimeType: 'application/octet-stream',
    fileDataBase64: Buffer.from('jpg bytes').toString('base64'),
  });

  assert.equal(pngPayload.mimeType, 'image/png');
  assert.equal(jpgPayload.mimeType, 'image/jpeg');
  assert.throws(
    () => normalizeImportFilePayload({
      fileName: 'resume.png',
      mimeType: 'application/pdf',
      fileDataBase64: Buffer.from('not png').toString('base64'),
    }),
    /PDF, DOCX, PNG, JPG, or JPEG/,
  );
});

test('image source document Gemini contents put instructions before inline image data', () => {
  const contents = createImageSourceDocumentGeminiContents({
    mimeType: 'image/jpeg',
    base64: Buffer.from('image bytes').toString('base64'),
  });

  assert.equal(contents[0].text.includes('Transcribe this resume image'), true);
  assert.equal(contents[1].inlineData.mimeType, 'image/jpeg');
});

test('PDF text assessment accepts resume-like text and rejects empty extraction', () => {
  const goodText = [
    'Jane Doe jane@example.com 555-555-5555 linkedin.com/in/janedoe',
    'Experience',
    ...Array.from({ length: 90 }, (_, index) => `Built product feature ${index} using React and SQL in 202${index % 5}.`),
  ].join('\n');

  assert.equal(assessExtractedResumeText(goodText).isTrustworthy, true);
  assert.equal(assessExtractedResumeText('').isTrustworthy, false);
});

test('readable resume text keeps line breaks for source section detection', () => {
  const sourceDocument = createSourceDocumentFromText([
    'Jane Doe',
    'jane@example.com | 555-555-5555 | linkedin.com/in/janedoe',
    'EDUCATION',
    'Example University',
    'B.S. Computer Science',
    'EXPERIENCE',
    'Acme | Software Engineer',
    '2022 - Present',
    '- Built internal tools',
    'SKILLS',
    'React, TypeScript, SQL',
  ].join('\n'));

  assert.deepEqual(sourceDocument.sections.map((section) => section.title), ['EDUCATION', 'EXPERIENCE', 'SKILLS']);
  assert.equal(sourceDocument.sections[1].lines.includes('Acme | Software Engineer'), true);
  assert.equal(sourceDocument.sections[1].lines.includes('- Built internal tools'), true);
});

test('PDF text layout gate falls back when selectable text is column-scrambled', () => {
  const normalText = [
    'Jane Doe',
    'jane@example.com | 555-555-5555',
    'EDUCATION',
    'Example University',
    'EXPERIENCE',
    'Acme | Engineer',
    '2022 - Present',
  ].join('\n');
  const scrambledText = [
    'EDUCATION',
    'Rhino 3D',
    'RELEVANT PROJECT EXPERIENCE',
    'SOFTWARE',
    'hayden@example.com',
    'Hayden Lee',
    'SKILLS',
    'LANGUAGES',
  ].join('\n');
  const normalSourceDocument = createSourceDocumentFromText(normalText);
  const scrambledSourceDocument = createSourceDocumentFromText(scrambledText);

  assert.equal(shouldUseVisualPdfFallbackForSourceText(normalText, normalSourceDocument), false);
  assert.equal(shouldUseVisualPdfFallbackForSourceText(scrambledText, scrambledSourceDocument), true);
});

test('source document parser splits inline section headings from extracted PDF text', () => {
  const sourceDocument = createSourceDocumentFromText([
    'First Name Last Name',
    'Room 123 MIT Dorm • Phone: 617-xxx-xxxx • Email: freshman@mit.edu',
    'Education Massachusetts Institute of Technology (MIT) Cambridge, MA',
    'Candidate for Bachelor of Science in Biology June 20XX',
    'Leadership MIT Undergraduate Giving Campaign Cambridge, MA',
    'Experience Class of 20XX Co-Chair November, 20XX',
    '• Trained members in fundraising activities.',
    'Work Area Supermarkets W. Southtown, NS',
    'Experience Clerk and Bagger January 20XX-May 20XX',
    '• Provided customer service to 100+ people per day.',
    'Activities MIT Varsity Track & Field Team September 20XX-Present',
    '& Awards Team Member, Pole Vaulting',
    'Skills Computer: Microsoft Word, Excel, and Power Point',
  ].join('\n'));

  assert.deepEqual(sourceDocument.sections.map((section) => section.title), [
    'Education',
    'Leadership Experience',
    'Work Experience',
    'Activities & Awards',
    'Skills',
  ]);
  assert.deepEqual(sourceDocument.sections.map((section) => section.lines[0]), [
    'Massachusetts Institute of Technology (MIT) Cambridge, MA',
    'MIT Undergraduate Giving Campaign Cambridge, MA',
    'Area Supermarkets W. Southtown, NS',
    'MIT Varsity Track & Field Team September 20XX-Present',
    'Computer: Microsoft Word, Excel, and Power Point',
  ]);
});

test('source document compiler preserves section order and block kinds', () => {
  const source = {
    personalLines: ['Jane Doe', 'jane@example.com', 'linkedin.com/in/janedoe'],
    sections: [
      {
        id: 'source-education-1',
        title: 'EDUCATION',
        lines: ['Example University', 'B.S. Computer Science', 'GPA: 3.8'],
      },
      {
        id: 'source-skills-2',
        title: 'TECHNICAL SKILLS',
        lines: ['Front-End', 'React, TypeScript, CSS'],
      },
      {
        id: 'source-experience-3',
        title: 'EXPERIENCE',
        lines: ['Acme | Software Engineer', '2022 - Present', '- Built internal tools', '- Improved performance'],
      },
    ],
  };
  const result = compileSourceDocumentToImportedDraft(source, null, { sourceFileName: 'jane.pdf' });
  const preview = getPreviewModel(result.draft.resume);

  assert.equal(result.suggestedName, 'Jane Doe');
  assert.equal(result.draft.resume.personal.linkedinUrl, 'linkedin.com/in/janedoe');
  assert.deepEqual(preview.sectionBlocks.map((section) => section.title), ['EDUCATION', 'TECHNICAL SKILLS', 'EXPERIENCE']);
  assert.deepEqual(preview.sectionBlocks.map((section) => section.kind), ['education', 'skills', 'roles']);
  assert.deepEqual(preview.sectionBlocks[2].entries[0].activities, [
    { text: 'Built internal tools', sourceIndex: 0 },
    { text: 'Improved performance', sourceIndex: 1 },
  ]);
});

test('source document compiler prefers parsed personal name over mapped file name', () => {
  const source = {
    personalLines: ['Real Person', 'real@example.com'],
    sections: [
      {
        id: 'source-skills-1',
        title: 'SKILLS',
        lines: ['React, TypeScript'],
      },
    ],
  };
  const result = compileSourceDocumentToImportedDraft(source, {
    suggestedName: 'uploaded-file-name',
    personal: {},
    sections: [],
  }, { sourceFileName: 'uploaded-file-name.pdf' });

  assert.equal(result.suggestedName, 'Real Person');
});

test('source role compiler maps image-style company/date/role hierarchy into role fields', () => {
  const source = {
    personalLines: ['Example Person'],
    sections: [
      {
        id: 'source-experience-1',
        title: 'EXPERIENCE',
        lines: [
          'Aviato | San Francisco, CA',
          '2018-2020',
          'Founder & CEO',
          '• Built a flight search company',
          '• Led founder strategy',
          'Pied Piper',
          '2020-2022',
          'Board Member / 10% Stakeholder',
          '• Advised the executive team',
        ],
      },
    ],
  };
  const result = compileSourceDocumentToImportedDraft(source, null, { sourceFileName: 'example.png' });
  const roles = getPreviewModel(result.draft.resume).sectionBlocks[0].entries;

  assert.equal(roles.length, 2);
  assert.equal(roles[0].company, 'Aviato');
  assert.equal(roles[0].role, 'Founder & CEO');
  assert.equal(roles[0].location, 'San Francisco, CA');
  assert.equal(roles[0].yearsExp, '2018-2020');
  assert.deepEqual(roles[0].activities.map((activity) => activity.text), [
    'Built a flight search company',
    'Led founder strategy',
  ]);
  assert.equal(roles[1].company, 'Pied Piper');
  assert.equal(roles[1].role, 'Board Member / 10% Stakeholder');
  assert.equal(roles[1].yearsExp, '2020-2022');
});

test('source role compiler merges organization location lines with following role date lines', () => {
  const source = {
    personalLines: ['Example Person'],
    sections: [
      {
        id: 'source-work-1',
        title: 'RELEVANT WORK EXPERIENCE',
        lines: [
          'ABC Pollution Control Miami, FL',
          'Environmental Engineering Intern June 2022 – August 2022',
          'Developed remediation plans for field projects',
          'Golob & Legion Engineers Athens, GA',
          'Intern May 2021 – August 2021',
          'Prepared technical documentation for senior engineers',
        ],
      },
    ],
  };
  const result = compileSourceDocumentToImportedDraft(source, null, { sourceFileName: 'engineering.docx' });
  const entries = result.draft.resume.sections[0].entries;

  assert.equal(entries.length, 2);
  assert.deepEqual(entries.map((entry) => ({
    company: entry.company,
    role: entry.role,
    location: entry.location,
    yearsExp: entry.yearsExp,
    activities: entry.activities,
  })), [
    {
      company: 'ABC Pollution Control',
      role: 'Environmental Engineering Intern',
      location: 'Miami, FL',
      yearsExp: 'June 2022 – August 2022',
      activities: ['Developed remediation plans for field projects'],
    },
    {
      company: 'Golob & Legion Engineers',
      role: 'Intern',
      location: 'Athens, GA',
      yearsExp: 'May 2021 – August 2021',
      activities: ['Prepared technical documentation for senior engineers'],
    },
  ]);
});

test('source role compiler preserves compact no-bullet roles under previous organization', () => {
  const source = {
    personalLines: ['Example Student'],
    sections: [
      {
        id: 'source-leadership-1',
        title: 'LEADERSHIP EXPERIENCE',
        lines: [
          'MIT Undergraduate Giving Campaign Cambridge, MA',
          'Class of 20XX Co-Chair November, 20XX',
          '• Trained freshman fundraisers',
          'High School Newspaper Southtown, NS',
          'Chief Editor August 20XX-May 20XX',
          '• Oversaw staff of 14 students',
          'Assistant Editor August 20XX-May 20XX',
          'Sports Editor August 20XX-May 20XX',
          'Relay For Life W. Southtown, NS',
          'Team Captain April 20XX',
          '• Organized a team of 15 students',
        ],
      },
    ],
  };
  const result = compileSourceDocumentToImportedDraft(source, null, { sourceFileName: 'student.pdf' });
  const entries = result.draft.resume.sections[0].entries;

  assert.deepEqual(entries.map((entry) => ({
    company: entry.company,
    role: entry.role,
    location: entry.location,
    yearsExp: entry.yearsExp,
    activities: entry.activities,
  })), [
    {
      company: 'MIT Undergraduate Giving Campaign',
      role: 'Class of 20XX Co-Chair',
      location: 'Cambridge, MA',
      yearsExp: 'November, 20XX',
      activities: ['Trained freshman fundraisers'],
    },
    {
      company: 'High School Newspaper',
      role: 'Chief Editor',
      location: 'Southtown, NS',
      yearsExp: 'August 20XX-May 20XX',
      activities: ['Oversaw staff of 14 students'],
    },
    {
      company: 'High School Newspaper',
      role: 'Assistant Editor',
      location: 'Southtown, NS',
      yearsExp: 'August 20XX-May 20XX',
      activities: [''],
    },
    {
      company: 'High School Newspaper',
      role: 'Sports Editor',
      location: 'Southtown, NS',
      yearsExp: 'August 20XX-May 20XX',
      activities: [''],
    },
    {
      company: 'Relay For Life W.',
      role: 'Team Captain',
      location: 'Southtown, NS',
      yearsExp: 'April 20XX',
      activities: ['Organized a team of 15 students'],
    },
  ]);
});

test('source compiler keeps education bullets under the current institution', () => {
  const source = {
    personalLines: ['Example Student'],
    sections: [
      {
        id: 'source-education-1',
        title: 'Education',
        lines: [
          'Massachusetts Institute of Technology Cambridge, MA',
          'Candidate for B.S. in Biology, GPA: 4.6/5.0 20XX',
          'Concentration in Management at Sloan Business School and Minor in Brain and Cognitive Sciences.',
          'Authored 5 publications in the MIT Undergraduate Research Journal.',
          'Relevant Coursework: Finance Theory, Economics of the Health Care Industry, Strategic Decision-Making in Life Sciences,',
          'Cellular Neurobiology, Immunology.',
        ],
      },
    ],
  };
  const result = compileSourceDocumentToImportedDraft(source, null, { sourceFileName: 'student.pdf' });
  const [education] = result.draft.resume.sections[0].entries;

  assert.equal(result.draft.resume.sections[0].entries.length, 1);
  assert.equal(education.school, 'Massachusetts Institute of Technology');
  assert.equal(education.location, 'Cambridge, MA');
  assert.equal(education.degree, 'Candidate for B.S. in Biology');
  assert.equal(education.gpa, '4.6/5.0');
  assert.match(education.coursework, /Strategic Decision-Making/);
  assert.match(education.coursework, /Cellular Neurobiology/);
  assert.equal(education.customSections[0].label, 'Details');
  assert.match(education.customSections[0].content, /Concentration in Management/);
});

test('source role compiler keeps business suffixes in company names', () => {
  const source = {
    personalLines: ['Example Student'],
    sections: [
      {
        id: 'source-experience-1',
        title: 'Experience',
        lines: [
          'MERCK & CO., INC. RAHWAY, NJ',
          'Pharmaceutical Laboratory Research Assistant, Infectious Disease Department 20XX',
          'Identified deficiencies in Type 2 Diabetes drugs.',
          'SCIENCE & ENGINEERING BUSINESS CLUB CAMBRIDGE, MA',
          'Consulting Focus Group Organizing Committee 20XX - Present',
          'Organized campus-wide information sessions.',
        ],
      },
    ],
  };
  const result = compileSourceDocumentToImportedDraft(source, null, { sourceFileName: 'student.pdf' });
  const entries = result.draft.resume.sections[0].entries;

  assert.deepEqual(entries.map((entry) => ({
    company: entry.company,
    role: entry.role,
    location: entry.location,
    yearsExp: entry.yearsExp,
  })), [
    {
      company: 'MERCK & CO., INC.',
      role: 'Pharmaceutical Laboratory Research Assistant, Infectious Disease Department',
      location: 'RAHWAY, NJ',
      yearsExp: '20XX',
    },
    {
      company: 'SCIENCE & ENGINEERING BUSINESS CLUB',
      role: 'Consulting Focus Group Organizing Committee',
      location: 'CAMBRIDGE, MA',
      yearsExp: '20XX - Present',
    },
  ]);
});

test('source award compiler separates titled awards and interests', () => {
  const source = {
    personalLines: ['Example Student'],
    sections: [
      {
        id: 'source-awards-1',
        title: 'Awards & Interests',
        lines: [
          'Robert C. Byrd Scholarship, awarded to top 1% of U.S. students for academic excellence.',
          'Rensselaer Medal, awarded to top 20,000 students worldwide for achievements in mathematics and science.',
          'Interest in track & field, travel, photography, and oncology.',
        ],
      },
    ],
  };
  const result = compileSourceDocumentToImportedDraft(source, null, { sourceFileName: 'student.pdf' });
  const entries = result.draft.resume.sections[0].entries;

  assert.deepEqual(entries.map((entry) => ({
    title: entry.title,
    details: entry.details,
  })), [
    {
      title: 'Robert C. Byrd Scholarship',
      details: 'awarded to top 1% of U.S. students for academic excellence.',
    },
    {
      title: 'Rensselaer Medal',
      details: 'awarded to top 20,000 students worldwide for achievements in mathematics and science.',
    },
    {
      title: 'Interests',
      details: 'track & field, travel, photography, and oncology.',
    },
  ]);
});

test('source parser keeps project role titles inside experience and moves trailing name from skills', () => {
  const sourceDocument = createSourceDocumentFromText([
    'Environment St Phone: 617-xxx-xxxx',
    'Cambridge, MA 02139 Email: EnviroEng@mit.edu',
    'EXPERIENCE',
    'Engineers for a Sustainable World – Ithaca, NY/La 34, Honduras',
    'Project Team Member 20XX-20XX',
    '• Designed a water treatment plant.',
    'CERTIFICATIONS AND SKILLS',
    '• Engineer in Training, April 20XX',
    '• Eligible for Professional Engineering Licensing Exam in',
    '20XX',
    'Student Enviro Eng',
  ].join('\n'));
  const result = compileSourceDocumentToImportedDraft(sourceDocument, null, { sourceFileName: 'student.pdf' });
  const experience = result.draft.resume.sections.find((section) => section.title === 'EXPERIENCE');
  const skills = result.draft.resume.sections.find((section) => section.title === 'CERTIFICATIONS AND SKILLS');

  assert.deepEqual(sourceDocument.personalLines.slice(0, 1), ['Student Enviro Eng']);
  assert.deepEqual(sourceDocument.sections.map((section) => section.title), ['EXPERIENCE', 'CERTIFICATIONS AND SKILLS']);
  assert.equal(experience.entries[0].company, 'Engineers for a Sustainable World');
  assert.equal(experience.entries[0].role, 'Project Team Member');
  assert.equal(experience.entries[0].location, 'Ithaca, NY/La 34, Honduras');
  assert.equal(skills.entries[0].items, 'Engineer in Training, April 20XX, Eligible for Professional Engineering Licensing Exam in 20XX');
});

test('source parser keeps schools after coursework separate and extracts names glued to skills', () => {
  const sourceDocument = createSourceDocumentFromText([
    'Environment St Phone: 617-xxx-xxxx',
    'Cambridge, MA 02139 Email: EnviroEng@mit.edu',
    'EDUCATION',
    'Massachusetts Institute of Technology (MIT) – Cambridge, MA',
    'Master of Engineering in Environmental Engineering 20XX (expected)',
    '• Relevant Coursework: Sustainable Energy, Applications of Technology',
    'in Energy and the Environment, Design for Sustainability',
    'Cornell University – Ithaca, NY',
    'Bachelor of Science in Civil and Environmental Engineering 20XX',
    'CERTIFICATIONS AND SKILLS',
    '• Hydraulic calculations using MathCAD',
    '• Water Distribution Modeling using H2OMap Water Student Enviro Eng',
  ].join('\n'));
  const result = compileSourceDocumentToImportedDraft(sourceDocument, null, { sourceFileName: 'masters.pdf' });
  const educationEntries = result.draft.resume.sections.find((section) => section.title === 'EDUCATION').entries;
  const skills = result.draft.resume.sections.find((section) => section.title === 'CERTIFICATIONS AND SKILLS');

  assert.equal(result.draft.resume.personal.name, 'Student Enviro Eng');
  assert.equal(educationEntries.length, 2);
  assert.equal(educationEntries[0].school, 'Massachusetts Institute of Technology (MIT)');
  assert.equal(educationEntries[1].school, 'Cornell University');
  assert.equal(skills.entries[0].items, 'Hydraulic calculations using MathCAD, Water Distribution Modeling using H2OMap Water');
});

test('source education compiler does not split wrapped detail text that contains school words', () => {
  const sourceDocument = createSourceDocumentFromText([
    'Example Alum',
    'alum@example.com',
    'EDUCATION',
    'UNIVERSITY OF PENNSYLVANIA, Philadelphia, PA',
    'The Wharton School, Master of Business Administration, Major in Finance. August 20XX.',
    '• Extensive experience with organizations including Mastery Charter Schools, Victory',
    'Schools, School District of Philadelphia, and Association for Sustainable Economic Development.',
    'MASSACHUSETTS INSTITUTE OF TECHNOLOGY, Cambridge, MA',
    'Bachelor of Science, Major in Economics. June 20XX.',
  ].join('\n'));
  const result = compileSourceDocumentToImportedDraft(sourceDocument, null, { sourceFileName: 'alum.pdf' });
  const educationEntries = result.draft.resume.sections.find((section) => section.title === 'EDUCATION').entries;

  assert.equal(educationEntries.length, 2);
  assert.equal(educationEntries[0].school, 'UNIVERSITY OF PENNSYLVANIA');
  assert.match(educationEntries[0].customSections.map((section) => section.content).join(' '), /School District of Philadelphia/);
  assert.equal(educationEntries[1].school, 'MASSACHUSETTS INSTITUTE OF TECHNOLOGY');
});

test('source parser handles placeholder-year education roles and leadership without merging entries', () => {
  const sourceDocument = createSourceDocumentFromText([
    'Example Student',
    'student@example.edu • 333-111-2222',
    'EDUCATION',
    'Example Institute of Technology 20XX-20XX',
    '• BS in Biological Engineering, GPA: 4.9/5 Cambridge, MA',
    '• Scholarship visit to Example University (20XX)',
    'Collège Saint-Remacle à Stavelot 20XX-20XX',
    '• Achieved Grande Distinction during foreign exchange in French-speaking Belgium Stavelot, Belgium',
    'Southern Example High School 20XX-20XX',
    '• Six week foreign exchange in Röhrnbach, Germany (Summer 20XX) Center Valley, PA',
    'EXPERIENCE',
    'Undergraduate Researcher in Weiss Lab, MIT Synthetic Biology Center Dec 20XX – Present',
    '• Create platform for biosensor development based on B-cell receptor Cambridge, MA',
    '• Assayed effects of VHH fragments on enzyme function Summer School in Radiobiology',
    '(SCK-CEN) Jul 20XX',
    '• Studied cancer pathology and space microbiology Mol, Belgium',
    'LEADERSHIP & SERVICE',
    'Stop Our Silence President (20XX-20XX), Co-President (20XX-20XX), Treasurer (20XX-20XX)',
    '• Organized awareness events',
    'Women in Science and Engineering (WiSE) Mentor (20XX-20XX)',
    '• Mentored high school students',
    'Member of Alpha Chi Omega (20XX-Present)',
  ].join('\n'));
  const result = compileSourceDocumentToImportedDraft(sourceDocument, null, { sourceFileName: 'student.pdf' });
  const sections = result.draft.resume.sections;
  const educationEntries = sections.find((section) => section.kind === 'education').entries;
  const experienceEntries = sections.find((section) => section.title === 'EXPERIENCE').entries;
  const leadershipEntries = sections.find((section) => section.title === 'LEADERSHIP & SERVICE').entries;

  assert.deepEqual(sourceDocument.sections.map((section) => section.title), ['EDUCATION', 'EXPERIENCE', 'LEADERSHIP & SERVICE']);
  assert.equal(educationEntries.length, 3);
  assert.equal(educationEntries[0].school, 'Example Institute of Technology');
  assert.equal(educationEntries[0].degree, 'BS in Biological Engineering');
  assert.equal(educationEntries[0].location, 'Cambridge, MA');
  assert.equal(educationEntries[1].school, 'Collège Saint-Remacle à Stavelot');
  assert.equal(educationEntries[1].location, 'Stavelot, Belgium');
  assert.equal(educationEntries[2].location, 'Center Valley, PA');
  assert.equal(experienceEntries.length, 2);
  assert.deepEqual(experienceEntries.map((entry) => ({
    company: entry.company,
    role: entry.role,
    location: entry.location,
    yearsExp: entry.yearsExp,
    activities: entry.activities,
  })), [
    {
      company: 'MIT Synthetic Biology Center',
      role: 'Undergraduate Researcher in Weiss Lab',
      location: 'Cambridge, MA',
      yearsExp: 'Dec 20XX – Present',
      activities: [
        'Create platform for biosensor development based on B-cell receptor',
        'Assayed effects of VHH fragments on enzyme function',
      ],
    },
    {
      company: 'Summer School in Radiobiology (SCK-CEN)',
      role: '',
      location: 'Mol, Belgium',
      yearsExp: 'Jul 20XX',
      activities: ['Studied cancer pathology and space microbiology'],
    },
  ]);
  assert.deepEqual(leadershipEntries.map((entry) => ({
    company: entry.company,
    role: entry.role,
    yearsExp: entry.yearsExp,
    activities: entry.activities,
  })), [
    {
      company: 'Stop Our Silence',
      role: 'President (20XX-20XX), Co-President (20XX-20XX), Treasurer (20XX-20XX)',
      yearsExp: '',
      activities: ['Organized awareness events'],
    },
    {
      company: 'Women in Science and Engineering (WiSE)',
      role: 'Mentor',
      yearsExp: '20XX-20XX',
      activities: ['Mentored high school students'],
    },
    {
      company: 'Alpha Chi Omega',
      role: 'Member',
      yearsExp: '20XX-Present',
      activities: [''],
    },
  ]);
});

test('source parser handles academic CV headings, page markers, and references', () => {
  const sourceDocument = createSourceDocumentFromText([
    'Researcher Person',
    'Business Address Home Address',
    'Example Institute 1234 Main Street Apt. 007',
    '77 Massachusetts Av. Rm. E39-305 Cambridge, MA 02139',
    '617-555-5555 researcher@example.edu',
    'Education Example Institute Cambridge, MA',
    'Ph.D in Mechanical Engineering. GPA 4.9/5.0 Expected, June 20XX',
    'Research Example Lab Cambridge, MA',
    'Experience Advisor: Example Professor',
    '• Developed a coupled model.',
    'Researcher Person 2/4',
    'Teaching Teaching & Learning Laboratory at MIT Spring 20XX',
    'Experience Teaching Certificate Program',
    '• Completed seven workshops.',
    'Industry Example Company Cupertino, CA',
    'Experience Product Design Engineer June to August 20XX',
    '• Built prototype hardware.',
    'Skills Language: Fluent in Spanish, Portuguese, German and English',
    'References Professor Example Room E39-305 Department of Mechanical Engineering',
    'Example Institute 77 Massachusetts Ave. Cambridge, MA 02139',
  ].join('\n'));
  const result = compileSourceDocumentToImportedDraft(sourceDocument, null, { sourceFileName: 'academic.pdf' });
  const sections = result.draft.resume.sections;

  assert.deepEqual(sourceDocument.sections.map((section) => section.title), [
    'Education',
    'Research Experience',
    'Teaching Experience',
    'Industry Experience',
    'Skills',
    'References',
  ]);
  assert.equal(result.draft.resume.personal.location, 'Cambridge, MA');
  assert.equal(sections.find((section) => section.title === 'Education').entries[0].degree, 'Ph.D in Mechanical Engineering.');
  assert.equal(sections.find((section) => section.title === 'Research Experience').entries[0].company, 'Example Lab');
  assert.equal(sections.find((section) => section.title === 'Research Experience').entries[0].role, 'Advisor: Example Professor');
  assert.equal(sections.find((section) => section.title === 'Teaching Experience').entries[0].role, 'Teaching Certificate Program');
  assert.equal(sections.find((section) => section.title === 'Industry Experience').entries[0].location, 'Cupertino, CA');
  assert.equal(sections.find((section) => section.title === 'Skills').entries[0].category, 'Language');
  assert.equal(sections.find((section) => section.title === 'References').kind, 'custom');
});

test('source publication compiler keeps wrapped citations together', () => {
  const sourceDocument = createSourceDocumentFromText([
    'Researcher Person',
    'researcher@example.edu',
    'Publications Smith, A., Person, R., and Lee, B. (20XX). A finite element implementation',
    'of a coupled diffusion-deformation theory. Journal of Examples, 52, 1-18.',
    'Person, R., and Smith, A. (20XX, November). Modeling silicon anodes.',
    'In Example Conference Proceedings, 2363-2368.',
    'Conferences Person, R., and Smith, A. (June, 20XX). Coupled diffusion-',
    '(Lead author) deformations in phase-separating materials. National Congress, East Lansing, MI.',
    'Patents Person, R. (20XX). “Compact media player.” U.S. Patent No.',
    '8,724,339.',
  ].join('\n'));
  const result = compileSourceDocumentToImportedDraft(sourceDocument, null, { sourceFileName: 'academic.pdf' });
  const publications = result.draft.resume.sections.find((section) => section.title === 'Publications');
  const conferences = result.draft.resume.sections.find((section) => section.title === 'Conferences');
  const patents = result.draft.resume.sections.find((section) => section.title === 'Patents');

  assert.equal(publications.entries.length, 2);
  assert.match(publications.entries[0].title, /Journal of Examples/);
  assert.match(publications.entries[1].title, /Example Conference Proceedings/);
  assert.equal(conferences.entries.length, 1);
  assert.match(conferences.entries[0].title, /National Congress/);
  assert.equal(patents.entries.length, 1);
  assert.match(patents.entries[0].title, /8,724,339/);
});

test('source role compiler promotes title-like first activities as a safety fallback', () => {
  const source = {
    personalLines: ['Example Person'],
    sections: [
      {
        id: 'source-experience-1',
        title: 'EXPERIENCE',
        lines: [
          'Example Labs 2021-2024',
          '• Chief Strategist',
          '• Built planning systems',
        ],
      },
    ],
  };
  const result = compileSourceDocumentToImportedDraft(source, null, { sourceFileName: 'example.png' });
  const role = getPreviewModel(result.draft.resume).sectionBlocks[0].entries[0];

  assert.equal(role.company, 'Example Labs');
  assert.equal(role.role, 'Chief Strategist');
  assert.deepEqual(role.activities.map((activity) => activity.text), ['Built planning systems']);
});

test('source education compiler keeps academic exposure labels inside the current school', () => {
  const source = {
    personalLines: ['Example Person'],
    sections: [
      {
        id: 'source-education-1',
        title: 'EDUCATION',
        lines: [
          'Hampshire College Amherst, MA 2014-2018',
          'B.A. Ultimate Frisbee',
          'Relevant coursework: Applied Synergy, Ethics',
          'Additional Academic Exposure: University of California, Berkeley, Reed College',
        ],
      },
    ],
  };
  const result = compileSourceDocumentToImportedDraft(source, null, { sourceFileName: 'example.png' });
  const educationEntries = getPreviewModel(result.draft.resume).sectionBlocks[0].entries;

  assert.equal(educationEntries.length, 1);
  assert.equal(educationEntries[0].school, 'Hampshire College');
  assert.ok(educationEntries[0].customSections.some((section) => (
    section.label === 'Additional Academic Exposure' &&
    section.content.includes('University of California')
  )));
});

test('source coverage warnings are non-blocking when content is preserved', () => {
  const source = createSourceDocumentFromText(`
Jane Doe
jane@example.com

HONORS AND AWARDS
Dean's List
Hackathon Winner
  `);
  const result = compileSourceDocumentToImportedDraft(source, null, { sourceFileName: 'jane.pdf' });
  const coverage = createSourceDocumentCoverage(source);
  const validation = validateImportedDraftCoverage(result.draft, coverage);

  assert.equal(validation.ok, true);
});

test('Gemini import generation config uses Gemini 3 thinking settings', () => {
  const config = createGeminiImportGenerationConfig(DEFAULT_GEMINI_IMPORT_MODEL, {
    GEMINI_THINKING_LEVEL: DEFAULT_GEMINI_THINKING_LEVEL,
  }, {
    responseJsonSchema: {
      type: 'object',
      properties: {
        ok: { type: 'string' },
      },
      required: ['ok'],
    },
  });

  assert.equal(config.responseMimeType, 'application/json');
  assert.equal(config.thinkingConfig.thinkingLevel, DEFAULT_GEMINI_THINKING_LEVEL);
  assert.equal(Object.hasOwn(config, 'temperature'), false);
});
