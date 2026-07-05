import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_TEMPLATE,
  MAX_RESUME_SECTIONS,
  MAX_WORKSPACE_RESUME_NAME_LENGTH,
  MAX_WORKSPACE_RESUMES,
  SECTION_TEMPLATE_GROUPS,
  UNTITLED_SECTION_TITLE,
  addResumeSectionBlock,
  addRoleBlockEntry,
  commitSectionTitle,
  createDuplicateResumeName,
  createEmptyResume,
  createFreshWorkspaceDraft,
  createNextResumeName,
  createResumeStorageKey,
  createWorkspaceResumeId,
  createWorkspaceResumeMeta,
  getPreviewModel,
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
  validateImportedDraftCoverage,
} from '../server/importResume.js';
import {
  validateImportResumeFile,
} from '../src/lib/importResume.js';
import {
  createMixedSamplePreviewModel,
  createSamplePlaceholderResolver,
  createSamplePreviewModel,
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
  assert.match(vars['--resume-page-margin-inline'], /in$/);
  assert.match(getResumePrintPageRule(settings, 'compact'), /^@page/);

  const updatedResume = updateResumeSetting(createEmptyResume(), 'textSize', 1);
  assert.equal(updatedResume.settings.textSize, 1);
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
