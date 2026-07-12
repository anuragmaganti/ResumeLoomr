import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  DEFAULT_TEMPLATE,
  MAX_RESUME_SECTIONS,
  MAX_WORKSPACE_RESUME_NAME_LENGTH,
  MAX_WORKSPACE_RESUMES,
  PERSONAL_CONTACT_FIELDS,
  PERSONAL_HEADER_ROWS,
  SECTION_TEMPLATE_GROUPS,
  UNTITLED_SECTION_TITLE,
  addResumeSectionBlock,
  addSectionBlockEntry,
  addSectionBlockTextListItem,
  commitSectionTitle,
  createDuplicateResumeName,
  createEmptyResume,
  createFreshWorkspaceDraft,
  createNextResumeName,
  createResumeStorageKey,
  createWorkspaceFolderFromResumes,
  createWorkspaceResumeId,
  createWorkspaceResumeMeta,
  dismissSampleInformation,
  getDefaultEntryHeaderLayout,
  getEffectivePersonalAlignment,
  getPreviewModel,
  materializeAndReorderSectionBlockEntries,
  mergeWorkspaceOrganizations,
  moveSectionHeaderField,
  moveSectionBlockEntry,
  getResumePresentationVars,
  getResumePrintPageRule,
  moveResumeSectionBlock,
  normalizeDraftPayload,
  normalizePersonalContactOrder,
  normalizePersonalHeaderOrder,
  normalizeResumeSettings,
  normalizeWorkspaceFolderToneIndex,
  normalizeWorkspaceOrganization,
  normalizeWorkspaceIndex,
  placeWorkspaceResumeAfter,
  removeWorkspaceFolders,
  renameWorkspaceFolder,
  removeResumeSectionBlock,
  reorderSectionBlockEntriesToMatch,
  reorderSectionBlockTextListItem,
  reorderResumeSectionBlocksToMatch,
  removeWorkspaceResumes,
  setPersonalContactOrder,
  setPersonalHeaderOrder,
  setResumeSettingValue,
  setResumeSummaryWidthPercent,
  setSampleTextListOrder,
  setSectionEntryHeaderLayout,
  normalizeEntryHeaderLayout,
  updatePersonalField,
  updateResumeSetting,
  updateSampleDisplay,
  updateSectionBlockEducationCustomSection,
  updateSectionBlockEducationProgram,
  updateSectionBlockEntry,
  updateSectionBlockTextList,
  updateSectionTitle,
  validateResume,
} from '../src/lib/resume.js';
import {
  buildResumeRailLayout,
  getFolderPlacementCellRect,
  getFolderResumeInsertionIndex,
  getFolderResumeDropIntent,
  getOrganizationResumePlacement,
  getOrganizationVisualResumeIds,
  moveOrganizationResumeBundle,
  moveOrganizationRootItem,
  moveOrganizationRootItemToIndex,
  isPointerWithinFolderPlacementSurface,
} from '../src/lib/workspaceOrganization.js';
import {
  getRailGridMetrics,
  getRootPointerDestination,
} from '../src/components/resumeWorkspaceRailDrag.js';
import { calculatePreviewPageBreaks } from '../src/lib/previewPagination.js';
import { getSaveStatusPresentation } from '../src/lib/saveStatus.js';
import {
  clearLocalResumeWorkspaceData,
  createSignOutStoragePreference,
  getSignOutStorageMode,
  hasLocalResumeWorkspaceData,
} from '../src/lib/browserConnection.js';
import {
  createOutboxAckDescriptor,
  createDraftContentHash,
  createSavedDraftState,
  filterOutboxOperationsForAccount,
  mergeLocalAndCloudWorkspaces,
  outboxOperationBelongsToAccount,
  outboxOperationMatchesAck,
  persistLocalResumeBatchDelete,
} from '../src/lib/localWorkspaceDb.js';
import {
  getOperationAcksFromResponse,
} from '../src/lib/backgroundSync.js';
import {
  cloudWorkspaceFromDoc,
  createWorkspaceDoc,
  getSyncCursorId,
  mergeCloudWorkspaceForWrite,
  operationBelongsToSyncAccount,
  partitionSyncOperationsByAccount,
  preservePermanentSampleDismissal,
  shouldAcceptDraftSyncOperation,
  shouldAcceptSyncOperation,
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

test('save status presentation prioritizes local writes before cloud state', () => {
  assert.deepEqual(
    getSaveStatusPresentation({ saveState: 'saving', syncState: 'saved', cloudMode: true }),
    { id: 'saving-local', label: 'Saving locally' },
  );
  assert.deepEqual(
    getSaveStatusPresentation({ saveState: 'error', syncState: 'syncing', cloudMode: true }),
    { id: 'local-error', label: 'Local save unavailable' },
  );
});

test('save status presentation distinguishes local and cloud completion states', () => {
  assert.deepEqual(
    getSaveStatusPresentation({ saveState: 'saved', syncState: 'idle', cloudMode: false }),
    { id: 'saved-local', label: 'Saved locally' },
  );
  assert.deepEqual(
    getSaveStatusPresentation({ saveState: 'saved', syncState: 'syncing', cloudMode: true }),
    { id: 'syncing', label: 'Syncing' },
  );
  assert.deepEqual(
    getSaveStatusPresentation({ saveState: 'saved', syncState: 'saved', cloudMode: true }),
    { id: 'synced', label: 'Synced' },
  );
  assert.deepEqual(
    getSaveStatusPresentation({ saveState: 'saved', syncState: 'offline', cloudMode: true }),
    { id: 'queued', label: 'Queued' },
  );
});

test('account settings maps sign-out choices to the existing browser storage preference', () => {
  assert.equal(getSignOutStorageMode({ allow: true, skipPrompt: false }), 'ask');
  assert.equal(getSignOutStorageMode({ allow: true, skipPrompt: true }), 'keep');
  assert.equal(getSignOutStorageMode({ allow: false, skipPrompt: true }), 'clear');

  assert.deepEqual(createSignOutStoragePreference('ask', { allow: false, skipPrompt: true }), {
    allow: false,
    skipPrompt: false,
  });
  assert.deepEqual(createSignOutStoragePreference('keep'), {
    allow: true,
    skipPrompt: true,
  });
  assert.deepEqual(createSignOutStoragePreference('clear'), {
    allow: false,
    skipPrompt: true,
  });
});

test('folder open state is cleared with browser resume data but is not itself resume data', async () => {
  const values = new Map([
    ['resumeloomr:open-folders:v1', JSON.stringify(['folder-1'])],
    ['unrelated', 'keep'],
  ]);
  const storage = {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] || null; },
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };

  assert.equal(hasLocalResumeWorkspaceData(storage), false);
  await clearLocalResumeWorkspaceData(storage);
  assert.equal(storage.getItem('resumeloomr:open-folders:v1'), null);
  assert.equal(storage.getItem('unrelated'), 'keep');
});
import {
  validateImportResumeFile,
} from '../src/lib/importResume.js';

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

test('workspace organization normalizes flat workspaces and enforces one placement per resume', () => {
  const flatWorkspace = createWorkspace(['r1', 'r2', 'r3']);
  assert.deepEqual(flatWorkspace.organization.rootItems, [
    { type: 'resume', id: 'r1' },
    { type: 'resume', id: 'r2' },
    { type: 'resume', id: 'r3' },
  ]);

  const organization = normalizeWorkspaceOrganization({
    rootItems: [
      { type: 'resume', id: 'r1' },
      { type: 'folder', id: 'folder-1' },
      { type: 'resume', id: 'r2' },
      { type: 'resume', id: 'missing' },
    ],
    folders: {
      'folder-1': {
        id: 'folder-1',
        name: 'Applications',
        resumeIds: ['r2', 'r1', 'r2'],
      },
    },
  }, ['r1', 'r2', 'r3']);

  assert.deepEqual(organization.folders['folder-1'], {
    id: 'folder-1',
    name: 'Applications',
    toneIndex: normalizeWorkspaceFolderToneIndex(undefined, 'folder-1'),
    resumeIds: ['r2', 'r1'],
  });
  assert.deepEqual(organization.rootItems, [
    { type: 'folder', id: 'folder-1' },
    { type: 'resume', id: 'r3' },
  ]);
  assert.deepEqual(getOrganizationVisualResumeIds(organization), ['r2', 'r1', 'r3']);
});

test('folder creation preserves visual order and uses the earliest selected root anchor', () => {
  const workspace = normalizeWorkspaceIndex({
    ...createWorkspace(['r1', 'r2', 'r3', 'r4']),
    organization: {
      updatedAt: '2026-01-01T00:00:00.000Z',
      rootItems: [
        { type: 'resume', id: 'r1' },
        { type: 'folder', id: 'folder-old' },
        { type: 'resume', id: 'r4' },
      ],
      folders: {
        'folder-old': {
          id: 'folder-old',
          name: 'Existing',
          resumeIds: ['r2', 'r3'],
        },
      },
    },
  });
  const result = createWorkspaceFolderFromResumes(workspace, ['r4', 'r2'], {
    folderId: 'folder-new',
    now: '2026-02-01T00:00:00.000Z',
  });

  assert.equal(result.folderId, 'folder-new');
  assert.deepEqual(result.movedResumeIds, ['r2', 'r4']);
  assert.deepEqual(result.workspace.organization.rootItems, [
    { type: 'resume', id: 'r1' },
    { type: 'folder', id: 'folder-new' },
    { type: 'folder', id: 'folder-old' },
  ]);
  assert.deepEqual(result.workspace.organization.folders['folder-new'].resumeIds, ['r2', 'r4']);
  assert.deepEqual(result.workspace.organization.folders['folder-old'].resumeIds, ['r3']);
  assert.ok(result.workspace.organization.folders['folder-new'].toneIndex >= 0);
  assert.notEqual(
    result.workspace.organization.folders['folder-new'].toneIndex,
    result.workspace.organization.folders['folder-old'].toneIndex,
  );
});

test('folder tone identity survives normalization and does not depend on root order', () => {
  const first = normalizeWorkspaceOrganization({
    rootItems: [
      { type: 'folder', id: 'folder-a' },
      { type: 'folder', id: 'folder-b' },
    ],
    folders: {
      'folder-a': { id: 'folder-a', name: 'A', toneIndex: 4, resumeIds: ['r1'] },
      'folder-b': { id: 'folder-b', name: 'B', resumeIds: ['r2'] },
    },
  }, ['r1', 'r2']);
  const reordered = normalizeWorkspaceOrganization({
    ...first,
    rootItems: [...first.rootItems].reverse(),
  }, ['r1', 'r2']);

  assert.equal(first.folders['folder-a'].toneIndex, 4);
  assert.equal(reordered.folders['folder-a'].toneIndex, 4);
  assert.equal(
    reordered.folders['folder-b'].toneIndex,
    normalizeWorkspaceFolderToneIndex(undefined, 'folder-b'),
  );
});

test('folder removal ungroups children in place and records a folder tombstone', () => {
  const workspace = normalizeWorkspaceIndex({
    ...createWorkspace(['r1', 'r2', 'r3', 'r4']),
    organization: {
      rootItems: [
        { type: 'resume', id: 'r1' },
        { type: 'folder', id: 'folder-1' },
        { type: 'resume', id: 'r4' },
      ],
      folders: {
        'folder-1': { id: 'folder-1', name: 'Folder', resumeIds: ['r2', 'r3'] },
      },
    },
  });
  const result = removeWorkspaceFolders(workspace, ['folder-1'], {
    now: '2026-02-01T00:00:00.000Z',
  });

  assert.deepEqual(result.workspace.organization.rootItems, [
    { type: 'resume', id: 'r1' },
    { type: 'resume', id: 'r2' },
    { type: 'resume', id: 'r3' },
    { type: 'resume', id: 'r4' },
  ]);
  assert.equal(result.workspace.organization.folders['folder-1'], undefined);
  assert.deepEqual(result.workspace.organization.removedFolderIds, ['folder-1']);
});

test('deleting a foldered resume preserves every remaining folder and placement', () => {
  const workspace = normalizeWorkspaceIndex({
    ...createWorkspace(['r1', 'r2', 'r3']),
    activeResumeId: 'r1',
    organization: {
      updatedAt: '2026-02-01T00:00:00.000Z',
      rootItems: [
        { type: 'folder', id: 'folder-1' },
        { type: 'resume', id: 'r3' },
      ],
      folders: {
        'folder-1': {
          id: 'folder-1',
          name: 'Applications',
          resumeIds: ['r1', 'r2'],
        },
      },
    },
  });
  const firstDeletion = removeWorkspaceResumes(workspace, ['r1'], {
    now: '2026-03-01T00:00:00.000Z',
  });
  const secondDeletion = removeWorkspaceResumes(firstDeletion.workspace, ['r2'], {
    now: '2026-04-01T00:00:00.000Z',
  });

  assert.deepEqual(firstDeletion.workspace.organization.rootItems, [
    { type: 'folder', id: 'folder-1' },
    { type: 'resume', id: 'r3' },
  ]);
  assert.deepEqual(firstDeletion.workspace.organization.folders['folder-1'].resumeIds, ['r2']);
  assert.deepEqual(secondDeletion.workspace.organization.rootItems, [
    { type: 'folder', id: 'folder-1' },
    { type: 'resume', id: 'r3' },
  ]);
  assert.deepEqual(secondDeletion.workspace.organization.folders['folder-1'].resumeIds, []);
  assert.ok(
    Date.parse(secondDeletion.workspace.organization.updatedAt)
      >= Date.parse(firstDeletion.workspace.organization.updatedAt),
  );
});

test('combined folder removal and resume deletion keeps non-selected children at root', () => {
  const workspace = normalizeWorkspaceIndex({
    ...createWorkspace(['r1', 'r2', 'r3']),
    organization: {
      rootItems: [
        { type: 'folder', id: 'folder-1' },
        { type: 'resume', id: 'r3' },
      ],
      folders: {
        'folder-1': { id: 'folder-1', name: 'Folder', resumeIds: ['r1', 'r2'] },
      },
    },
  });
  const folderRemoval = removeWorkspaceFolders(workspace, ['folder-1'], {
    now: '2026-02-01T00:00:00.000Z',
  });
  const deletion = removeWorkspaceResumes(folderRemoval.workspace, ['r1'], {
    now: '2026-02-02T00:00:00.000Z',
  });

  assert.deepEqual(deletion.workspace.organization.rootItems, [
    { type: 'resume', id: 'r2' },
    { type: 'resume', id: 'r3' },
  ]);
  assert.deepEqual(deletion.workspace.organization.removedFolderIds, ['folder-1']);
});

test('folder names fall back safely and receive deterministic duplicate suffixes', () => {
  const first = createWorkspaceFolderFromResumes(createWorkspace(['r1', 'r2']), ['r1'], {
    folderId: 'folder-1',
    now: '2026-02-01T00:00:00.000Z',
  }).workspace;
  const secondResult = createWorkspaceFolderFromResumes(first, ['r2'], {
    folderId: 'folder-2',
    now: '2026-02-02T00:00:00.000Z',
  });
  const renamed = renameWorkspaceFolder(secondResult.workspace, 'folder-2', '', {
    now: '2026-02-03T00:00:00.000Z',
  });

  assert.equal(first.organization.folders['folder-1'].name, 'New folder');
  assert.equal(secondResult.workspace.organization.folders['folder-2'].name, 'New folder 2');
  assert.equal(renamed.organization.folders['folder-2'].name, 'New folder 2');
});

test('duplicate placement keeps a copied resume beside its source container', () => {
  const workspace = normalizeWorkspaceIndex({
    ...createWorkspace(['r1', 'r2', 'r3']),
    organization: {
      rootItems: [
        { type: 'folder', id: 'folder-1' },
        { type: 'resume', id: 'r3' },
      ],
      folders: {
        'folder-1': { id: 'folder-1', name: 'Folder', resumeIds: ['r1'] },
      },
    },
  });
  const next = placeWorkspaceResumeAfter(workspace, 'r2', 'r1', {
    now: '2026-02-01T00:00:00.000Z',
  });

  assert.deepEqual(next.organization.folders['folder-1'].resumeIds, ['r1', 'r2']);
  assert.deepEqual(getOrganizationResumePlacement(next.organization, 'r2'), {
    containerId: 'folder-1',
    index: 1,
  });
});

test('organization movement supports ordered resume bundles across root and folders', () => {
  const organization = normalizeWorkspaceOrganization({
    rootItems: [
      { type: 'resume', id: 'r1' },
      { type: 'folder', id: 'folder-1' },
      { type: 'resume', id: 'r4' },
    ],
    folders: {
      'folder-1': { id: 'folder-1', name: 'Folder', resumeIds: ['r2', 'r3'] },
    },
  }, ['r1', 'r2', 'r3', 'r4']);
  const movedIntoFolder = moveOrganizationResumeBundle(organization, ['r1', 'r4'], {
    containerId: 'folder-1',
    overResumeId: 'r3',
  });
  const movedBackToRoot = moveOrganizationResumeBundle(movedIntoFolder, ['r3', 'r1'], {
    containerId: 'root',
    overResumeId: 'r4',
  });

  assert.deepEqual(movedIntoFolder.folders['folder-1'].resumeIds, ['r2', 'r1', 'r4', 'r3']);
  assert.deepEqual(movedBackToRoot.rootItems, [
    { type: 'folder', id: 'folder-1' },
    { type: 'resume', id: 'r3' },
    { type: 'resume', id: 'r1' },
  ]);
  assert.deepEqual(movedBackToRoot.folders['folder-1'].resumeIds, ['r2', 'r4']);
});

test('organization movement transfers a resume between folders without duplicating it', () => {
  const organization = normalizeWorkspaceOrganization({
    rootItems: [
      { type: 'folder', id: 'folder-1' },
      { type: 'folder', id: 'folder-2' },
    ],
    folders: {
      'folder-1': { id: 'folder-1', name: 'One', resumeIds: ['r1', 'r2'] },
      'folder-2': { id: 'folder-2', name: 'Two', resumeIds: ['r3', 'r4'] },
    },
  }, ['r1', 'r2', 'r3', 'r4']);
  const moved = moveOrganizationResumeBundle(organization, ['r2'], {
    containerId: 'folder-2',
    overResumeId: 'r4',
  });

  assert.deepEqual(moved.folders['folder-1'].resumeIds, ['r1']);
  assert.deepEqual(moved.folders['folder-2'].resumeIds, ['r3', 'r2', 'r4']);
  assert.deepEqual(getOrganizationVisualResumeIds(moved), ['r1', 'r3', 'r2', 'r4']);
});

test('moving a resume out of a folder can place it beside its source folder', () => {
  const organization = normalizeWorkspaceOrganization({
    rootItems: [
      { type: 'resume', id: 'r1' },
      { type: 'folder', id: 'folder-1' },
      { type: 'resume', id: 'r4' },
    ],
    folders: {
      'folder-1': { id: 'folder-1', name: 'One', resumeIds: ['r2', 'r3'] },
    },
  }, ['r1', 'r2', 'r3', 'r4']);
  const moved = moveOrganizationResumeBundle(organization, ['r2'], {
    containerId: 'root',
    afterRootItem: { type: 'folder', id: 'folder-1' },
  });

  assert.deepEqual(moved.rootItems, [
    { type: 'resume', id: 'r1' },
    { type: 'folder', id: 'folder-1' },
    { type: 'resume', id: 'r2' },
    { type: 'resume', id: 'r4' },
  ]);
  assert.deepEqual(moved.folders['folder-1'].resumeIds, ['r3']);
  assert.deepEqual(getOrganizationVisualResumeIds(moved), ['r1', 'r3', 'r2', 'r4']);
});

test('resume movement can insert at root before or after a folder', () => {
  const organization = normalizeWorkspaceOrganization({
    rootItems: [
      { type: 'folder', id: 'folder-1' },
      { type: 'folder', id: 'folder-2' },
    ],
    folders: {
      'folder-1': { id: 'folder-1', name: 'One', resumeIds: ['r1'] },
      'folder-2': { id: 'folder-2', name: 'Two', resumeIds: ['r2'] },
    },
  }, ['r1', 'r2']);
  const beforeSecond = moveOrganizationResumeBundle(organization, ['r1'], {
    containerId: 'root',
    overRootItem: { type: 'folder', id: 'folder-2' },
    after: false,
  });
  const afterSecond = moveOrganizationResumeBundle(beforeSecond, ['r1'], {
    containerId: 'root',
    overRootItem: { type: 'folder', id: 'folder-2' },
    after: true,
  });

  assert.deepEqual(beforeSecond.rootItems, [
    { type: 'folder', id: 'folder-1' },
    { type: 'resume', id: 'r1' },
    { type: 'folder', id: 'folder-2' },
  ]);
  assert.deepEqual(afterSecond.rootItems, [
    { type: 'folder', id: 'folder-1' },
    { type: 'folder', id: 'folder-2' },
    { type: 'resume', id: 'r1' },
  ]);
});

test('folder resume drop intent reserves edges for root insertion', () => {
  const rect = { left: 100, right: 300, top: 40, bottom: 78 };

  assert.equal(getFolderResumeDropIntent({ x: 200, y: 59 }, rect), 'inside');
  assert.equal(getFolderResumeDropIntent({ x: 110, y: 59 }, rect), 'before');
  assert.equal(getFolderResumeDropIntent({ x: 290, y: 59 }, rect), 'after');
  assert.equal(getFolderResumeDropIntent({ x: 200, y: 35 }, rect), 'before');
  assert.equal(getFolderResumeDropIntent({ x: 200, y: 83 }, rect), 'after');
});

test('open-folder collision only includes visibly painted folder cells', () => {
  const placement = {
    isOpen: true,
    width: 4,
    height: 2,
    surfaceRows: [
      { row: 0, column: 1, span: 3 },
      { row: 1, column: 0, span: 1 },
    ],
  };
  const rect = { left: 100, top: 50, width: 400, height: 83 };

  assert.equal(isPointerWithinFolderPlacementSurface({ x: 255, y: 69 }, rect, placement), true);
  assert.equal(isPointerWithinFolderPlacementSurface({ x: 150, y: 69 }, rect, placement), false);
  assert.equal(isPointerWithinFolderPlacementSurface({ x: 150, y: 114 }, rect, placement), true);
  assert.equal(isPointerWithinFolderPlacementSurface({ x: 255, y: 114 }, rect, placement), false);
  assert.equal(isPointerWithinFolderPlacementSurface({ x: 201, y: 69 }, rect, placement), false);
  assert.equal(
    isPointerWithinFolderPlacementSurface({ x: 201, y: 69 }, rect, placement, { includeGaps: true }),
    true,
  );
  assert.equal(
    isPointerWithinFolderPlacementSurface({ x: 150, y: 69 }, rect, placement, { includeGaps: true }),
    false,
  );
});

test('auto-open folder collision cells use their final grid positions', () => {
  const placement = {
    isOpen: true,
    width: 4,
    tile: { row: 0, column: 1 },
    children: [{ resumeId: 'r1', row: 0, column: 2 }],
  };
  const rect = { left: 100, top: 50, width: 400, height: 38 };

  assert.deepEqual(getFolderPlacementCellRect(rect, placement, placement.tile), {
    x: 201.75,
    y: 50,
    top: 50,
    right: 296.5,
    bottom: 88,
    left: 201.75,
    width: 94.75,
    height: 38,
  });
  assert.equal(getFolderPlacementCellRect(rect, placement, placement.children[0]).left, 303.5);
});

test('folder resume insertion follows the pointer grid instead of animated child rectangles', () => {
  const rect = { left: 100, top: 50, width: 400, height: 83 };
  const sameRowPlacement = {
    isOpen: true,
    width: 4,
    tile: { row: 0, column: 1 },
  };

  assert.equal(getFolderResumeInsertionIndex({ x: 320, y: 69 }, rect, sameRowPlacement, 2), 0);
  assert.equal(getFolderResumeInsertionIndex({ x: 380, y: 69 }, rect, sameRowPlacement, 2), 1);
  assert.equal(getFolderResumeInsertionIndex({ x: 420, y: 69 }, rect, sameRowPlacement, 2), 1);
  assert.equal(getFolderResumeInsertionIndex({ x: 485, y: 69 }, rect, sameRowPlacement, 2), 2);

  const wrappedPlacement = {
    isOpen: true,
    width: 4,
    tile: { row: 0, column: 3 },
  };

  assert.equal(getFolderResumeInsertionIndex({ x: 120, y: 114 }, rect, wrappedPlacement, 2), 0);
  assert.equal(getFolderResumeInsertionIndex({ x: 180, y: 114 }, rect, wrappedPlacement, 2), 1);
  assert.equal(getFolderResumeInsertionIndex({ x: 220, y: 114 }, rect, wrappedPlacement, 2), 1);
  assert.equal(getFolderResumeInsertionIndex({ x: 285, y: 114 }, rect, wrappedPlacement, 2), 2);
  assert.equal(getFolderResumeInsertionIndex({ x: 200, y: 69 }, rect, sameRowPlacement, 0), 0);
  assert.equal(getFolderResumeInsertionIndex(null, rect, sameRowPlacement, 2), null);
});

test('root folder movement never nests folders and preserves the moved folder contents', () => {
  const organization = normalizeWorkspaceOrganization({
    rootItems: [
      { type: 'folder', id: 'folder-1' },
      { type: 'resume', id: 'r3' },
      { type: 'folder', id: 'folder-2' },
    ],
    folders: {
      'folder-1': { id: 'folder-1', name: 'One', resumeIds: ['r1'] },
      'folder-2': { id: 'folder-2', name: 'Two', resumeIds: ['r2'] },
    },
  }, ['r1', 'r2', 'r3']);
  const moved = moveOrganizationRootItem(
    organization,
    { type: 'folder', id: 'folder-2' },
    { type: 'resume', id: 'r3' },
    false,
  );

  assert.deepEqual(moved.rootItems, [
    { type: 'folder', id: 'folder-1' },
    { type: 'folder', id: 'folder-2' },
    { type: 'resume', id: 'r3' },
  ]);
  assert.deepEqual(moved.folders['folder-2'].resumeIds, ['r2']);
});

test('root folder movement ignores its own drop target', () => {
  const organization = normalizeWorkspaceOrganization({
    rootItems: [
      { type: 'resume', id: 'r1' },
      { type: 'folder', id: 'folder-1' },
      { type: 'resume', id: 'r2' },
    ],
    folders: {
      'folder-1': { id: 'folder-1', name: 'Folder', resumeIds: ['r3'] },
    },
  }, ['r1', 'r2', 'r3']);
  const unchanged = moveOrganizationRootItem(
    organization,
    { type: 'folder', id: 'folder-1' },
    { type: 'folder', id: 'folder-1' },
    true,
  );

  assert.equal(unchanged, organization);
  assert.deepEqual(unchanged.rootItems, organization.rootItems);
});

test('root resume and folder movement accept deterministic insertion indexes', () => {
  const organization = normalizeWorkspaceOrganization({
    rootItems: [
      { type: 'resume', id: 'r1' },
      { type: 'folder', id: 'folder-1' },
      { type: 'resume', id: 'r3' },
    ],
    folders: {
      'folder-1': { id: 'folder-1', name: 'Folder', resumeIds: ['r2'] },
    },
  }, ['r1', 'r2', 'r3']);
  const resumeFirst = moveOrganizationResumeBundle(organization, ['r3'], {
    containerId: 'root',
    rootIndex: 0,
  });
  const folderFirst = moveOrganizationRootItemToIndex(
    resumeFirst,
    { type: 'folder', id: 'folder-1' },
    0,
  );

  assert.deepEqual(resumeFirst.rootItems, [
    { type: 'resume', id: 'r3' },
    { type: 'resume', id: 'r1' },
    { type: 'folder', id: 'folder-1' },
  ]);
  assert.deepEqual(folderFirst.rootItems, [
    { type: 'folder', id: 'folder-1' },
    { type: 'resume', id: 'r3' },
    { type: 'resume', id: 'r1' },
  ]);
  assert.deepEqual(folderFirst.folders['folder-1'].resumeIds, ['r2']);
});

function railPlacementsOverlap(first, second) {
  const getCells = (placement) => new Set(
    placement.isOpen
      ? placement.surfaceRows.flatMap((surfaceRow) => (
        Array.from({ length: surfaceRow.span }, (_, offset) => (
          `${placement.row + surfaceRow.row}:${surfaceRow.column + offset}`
        ))
      ))
      : [`${placement.row + (placement.tile?.row || 0)}:${placement.tile?.column ?? placement.column}`],
  );
  const firstCells = getCells(first);
  return [...getCells(second)].some((cell) => firstCells.has(cell));
}

test('resume rail cluster packing stays bounded and collision-free from two through six columns', () => {
  const organization = normalizeWorkspaceOrganization({
    rootItems: [
      { type: 'folder', id: 'folder-1' },
      { type: 'resume', id: 'r4' },
      { type: 'folder', id: 'folder-2' },
      { type: 'resume', id: 'r5' },
    ],
    folders: {
      'folder-1': { id: 'folder-1', name: 'One', resumeIds: ['r1', 'r2'] },
      'folder-2': { id: 'folder-2', name: 'Two', resumeIds: ['r3'] },
    },
  }, ['r1', 'r2', 'r3', 'r4', 'r5']);

  [2, 3, 4, 5, 6].forEach((columns) => {
    const layout = buildResumeRailLayout(organization, new Set(['folder-1', 'folder-2']), columns);
    const folderPlacements = layout.placements.filter((placement) => placement.item.type === 'folder');

    assert.equal(folderPlacements.length, 2);
    layout.placements.forEach((placement, index) => {
      assert.ok(placement.column >= 0);
      assert.ok(placement.column + placement.width <= columns);
      assert.ok(placement.row >= 0);
      assert.ok(placement.row + placement.height <= layout.rowCount);
      layout.placements.slice(index + 1).forEach((otherPlacement) => {
        assert.equal(railPlacementsOverlap(placement, otherPlacement), false);
      });
    });
    folderPlacements.forEach((placement) => {
      const folder = organization.folders[placement.folderId];
      assert.equal(placement.isOpen, true);
      assert.equal(placement.children.length, folder.resumeIds.length);
      assert.ok(placement.width * placement.height >= folder.resumeIds.length + 1);
    });
  });
});

test('each open folder tile stays immediately before its resumes in the cell stream', () => {
  const organization = normalizeWorkspaceOrganization({
    rootItems: [
      { type: 'folder', id: 'folder-1' },
      { type: 'folder', id: 'folder-2' },
    ],
    folders: {
      'folder-1': { id: 'folder-1', name: 'One', resumeIds: ['r1', 'r2'] },
      'folder-2': { id: 'folder-2', name: 'Two', resumeIds: ['r3', 'r4', 'r5', 'r6', 'r7'] },
    },
  }, ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7']);
  const layout = buildResumeRailLayout(organization, new Set(['folder-1', 'folder-2']), 6);
  const first = layout.placements.find((placement) => placement.folderId === 'folder-1');
  const second = layout.placements.find((placement) => placement.folderId === 'folder-2');

  assert.deepEqual({ row: first.row, column: first.column, width: first.width, height: first.height }, {
    row: 0, column: 0, width: 6, height: 1,
  });
  assert.equal(first.tile.column, 0);
  assert.deepEqual({ row: second.row, column: second.column, width: second.width, height: second.height }, {
    row: 0, column: 0, width: 6, height: 2,
  });
  assert.equal(second.tile.column, 3);
  assert.deepEqual(second.children.map(({ row, column }) => ({ row, column })), [
    { row: 0, column: 4 },
    { row: 0, column: 5 },
    { row: 1, column: 0 },
    { row: 1, column: 1 },
    { row: 1, column: 2 },
  ]);
  assert.equal(railPlacementsOverlap(first, second), false);
});

test('the 2 5 2 2 2 folder case flows continuously without reserving empty cells', () => {
  const resumeIds = Array.from({ length: 13 }, (_, index) => `r${index + 1}`);
  const organization = normalizeWorkspaceOrganization({
    rootItems: [1, 2, 3, 4, 5].map((index) => ({ type: 'folder', id: `folder-${index}` })),
    folders: {
      'folder-1': { id: 'folder-1', name: 'One', resumeIds: ['r1', 'r2'] },
      'folder-2': { id: 'folder-2', name: 'Two', resumeIds: ['r3', 'r4', 'r5', 'r6', 'r7'] },
      'folder-3': { id: 'folder-3', name: 'Three', resumeIds: ['r8', 'r9'] },
      'folder-4': { id: 'folder-4', name: 'Four', resumeIds: ['r10', 'r11'] },
      'folder-5': { id: 'folder-5', name: 'Five', resumeIds: ['r12', 'r13'] },
    },
  }, resumeIds);
  const layout = buildResumeRailLayout(
    organization,
    new Set(['folder-1', 'folder-2', 'folder-3', 'folder-4', 'folder-5']),
    6,
  );

  assert.equal(layout.rowCount, 3);
  assert.equal(layout.placements.length, 5);
  assert.deepEqual(
    layout.placements.map((placement) => ({
      id: placement.folderId,
      row: placement.row,
      column: placement.column,
      width: placement.width,
      height: placement.height,
    })),
    [
      { id: 'folder-1', row: 0, column: 0, width: 6, height: 1 },
      { id: 'folder-2', row: 0, column: 0, width: 6, height: 2 },
      { id: 'folder-3', row: 1, column: 0, width: 6, height: 1 },
      { id: 'folder-4', row: 2, column: 0, width: 6, height: 1 },
      { id: 'folder-5', row: 2, column: 0, width: 6, height: 1 },
    ],
  );
  assert.deepEqual(layout.placements.map((placement) => placement.tile.column), [0, 3, 3, 0, 3]);
  layout.placements.forEach((placement, index) => {
    const occupiedCells = [placement.tile, ...placement.children]
      .map((cell) => `${cell.row}:${cell.column}`);
    assert.equal(new Set(occupiedCells).size, occupiedCells.length);
    assert.equal(placement.children.length, organization.folders[placement.folderId].resumeIds.length);
    layout.placements.slice(index + 1).forEach((otherPlacement) => {
      assert.equal(railPlacementsOverlap(placement, otherPlacement), false);
    });
  });
});

test('the next folder starts immediately after a wrapped open folder', () => {
  const resumeIds = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6'];
  const organization = normalizeWorkspaceOrganization({
    rootItems: [
      { type: 'folder', id: 'folder-1' },
      { type: 'folder', id: 'folder-2' },
      { type: 'folder', id: 'folder-3' },
    ],
    folders: {
      'folder-1': { id: 'folder-1', name: 'One', resumeIds: ['r1'] },
      'folder-2': { id: 'folder-2', name: 'Two', resumeIds: ['r2', 'r3', 'r4', 'r5', 'r6'] },
      'folder-3': { id: 'folder-3', name: 'Three', resumeIds: [] },
    },
  }, resumeIds);
  const layout = buildResumeRailLayout(
    organization,
    new Set(['folder-1', 'folder-2']),
    6,
  );
  const second = layout.placements.find((placement) => placement.folderId === 'folder-2');
  const third = layout.placements.find((placement) => placement.folderId === 'folder-3');

  assert.deepEqual(second.surfaceRows, [
    { row: 0, column: 2, span: 4 },
    { row: 1, column: 0, span: 2 },
  ]);
  assert.deepEqual({
    row: third.row + third.tile.row,
    column: third.tile.column,
  }, { row: 1, column: 2 });
  assert.equal(layout.rowCount, 2);
});

test('open folder resumes wrap horizontally across as many full-width rows as needed', () => {
  const resumeIds = Array.from({ length: 8 }, (_, index) => `r${index + 1}`);
  const organization = normalizeWorkspaceOrganization({
    rootItems: [{ type: 'folder', id: 'folder-1' }],
    folders: {
      'folder-1': { id: 'folder-1', name: 'One', resumeIds },
    },
  }, resumeIds);
  const layout = buildResumeRailLayout(organization, new Set(['folder-1']), 3);
  const [folder] = layout.placements;

  assert.deepEqual({ row: folder.row, column: folder.column, width: folder.width, height: folder.height }, {
    row: 0, column: 0, width: 3, height: 3,
  });
  assert.deepEqual(folder.children.map(({ row, column }) => ({ row, column })), [
    { row: 0, column: 1 },
    { row: 0, column: 2 },
    { row: 1, column: 0 },
    { row: 1, column: 1 },
    { row: 1, column: 2 },
    { row: 2, column: 0 },
    { row: 2, column: 1 },
    { row: 2, column: 2 },
  ]);
  assert.equal(layout.rowCount, 3);
});

test('workspace batch deletion preserves order and an active resume that survives', () => {
  const workspace = createWorkspace(['r1', 'r2', 'r3', 'r4'], { activeResumeId: 'r2' });
  const result = removeWorkspaceResumes(workspace, ['r4', 'r1']);

  assert.deepEqual(result.deletedResumeIds, ['r1', 'r4']);
  assert.deepEqual(result.workspace.resumeIds, ['r2', 'r3']);
  assert.equal(result.workspace.activeResumeId, 'r2');
  assert.equal(result.workspace.meta.r1, undefined);
  assert.equal(result.rejectedReason, '');
});

test('workspace batch deletion chooses the next ordered resume when active is deleted', () => {
  const workspace = createWorkspace(['r1', 'r2', 'r3', 'r4'], { activeResumeId: 'r2' });
  const result = removeWorkspaceResumes(workspace, ['r2', 'r4']);

  assert.deepEqual(result.workspace.resumeIds, ['r1', 'r3']);
  assert.equal(result.workspace.activeResumeId, 'r3');
});

test('workspace batch deletion ignores stale ids and refuses to remove every resume', () => {
  const workspace = createWorkspace(['r1', 'r2'], { activeResumeId: 'r1' });
  const staleResult = removeWorkspaceResumes(workspace, ['missing', 'r2', 'missing']);
  const rejectedResult = removeWorkspaceResumes(workspace, ['r2', 'r1', 'missing']);
  const emptyResult = removeWorkspaceResumes(workspace, ['missing']);

  assert.deepEqual(staleResult.deletedResumeIds, ['r2']);
  assert.deepEqual(staleResult.workspace.resumeIds, ['r1']);
  assert.equal(rejectedResult.rejectedReason, 'all');
  assert.deepEqual(rejectedResult.workspace.resumeIds, ['r1', 'r2']);
  assert.equal(emptyResult.rejectedReason, 'empty');
});

test('local batch deletion accepts one normalized workspace snapshot without browser storage', async () => {
  const workspace = createWorkspace(['r1', 'r3'], { activeResumeId: 'r3' });
  const persistedWorkspace = await persistLocalResumeBatchDelete({
    resumeIds: ['r2', 'r2'],
    workspace,
    enqueueSync: false,
  });

  assert.deepEqual(persistedWorkspace.resumeIds, ['r1', 'r3']);
  assert.equal(persistedWorkspace.activeResumeId, 'r3');
});

test('resume settings produce bounded preview and print variables', () => {
  const settings = normalizeResumeSettings({
    textSize: 99,
    horizontalMargins: -99,
    verticalMargins: 2,
    personalContactOrder: ['email', 'email', 'unknown', 'phone'],
  });
  const vars = getResumePresentationVars(settings, 'compact');

  assert.equal(settings.textSize, 5);
  assert.equal(settings.horizontalMargins, -5);
  assert.deepEqual(settings.personalContactOrder, [
    'email',
    'phone',
    'location',
    'linkedinUrl',
    'githubUrl',
    'portfolioUrl',
    'customField',
  ]);
  assert.equal(settings.summaryWidthPercent, 100);
  assert.equal(settings.personalSeparatorTone, 50);
  assert.equal(settings.sectionSeparatorWeight, 2);
  assert.equal(settings.sectionSeparatorPosition, 'aboveSectionName');
  assert.equal(settings.personalAlignment, 'template');
  assert.deepEqual(settings.personalHeaderOrder, ['headline', 'contact']);
  assert.equal(getEffectivePersonalAlignment(settings, 'compact'), 'center');
  assert.equal(getEffectivePersonalAlignment(settings, 'executive'), 'left');
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
  assert.equal(vars['--resume-personal-alignment'], 'center');
  assert.equal(vars['--resume-personal-justify-content'], 'center');
  assert.equal(vars['--resume-section-separator-color'], 'rgba(0, 0, 0, 0.5)');
  assert.equal(vars['--resume-section-separator-dark-color'], 'rgba(255, 255, 255, 0.5)');
  assert.equal(vars['--resume-section-separator-weight'], '1px');
  assert.equal(vars['--resume-section-separator-gap'], '8px');
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

  const leftAlignedPersonal = setResumeSettingValue(createEmptyResume(), 'personalAlignment', 'left');
  assert.equal(leftAlignedPersonal.settings.personalAlignment, 'left');
  assert.equal(getResumePresentationVars(leftAlignedPersonal.settings, 'compact')['--resume-personal-alignment'], 'left');

  const invalidPersonalAlignment = setResumeSettingValue(createEmptyResume(), 'personalAlignment', 'middle');
  assert.equal(invalidPersonalAlignment.settings.personalAlignment, 'template');
});

test('personal contact order is display-only metadata for sample and real fields', () => {
  const normalizedOrder = normalizePersonalContactOrder(['githubUrl', 'email', 'githubUrl', 'bad-field']);

  assert.deepEqual(normalizedOrder, [
    'githubUrl',
    'email',
    'location',
    'phone',
    'linkedinUrl',
    'portfolioUrl',
    'customField',
  ]);

  let resume = createEmptyResume();
  resume = updatePersonalField(resume, 'email', 'person@example.com');
  resume = updatePersonalField(resume, 'phone', '(555) 111-2222');
  resume = setPersonalContactOrder(resume, ['email', 'phone']);

  assert.deepEqual(resume.settings.personalContactOrder.slice(0, 2), ['email', 'phone']);
  assert.equal(resume.personal.email, 'person@example.com');
  assert.equal(resume.personal.phone, '(555) 111-2222');

  const rejected = setPersonalContactOrder(resume, ['email', 'email']);
  assert.deepEqual(rejected.settings.personalContactOrder, resume.settings.personalContactOrder);
});

test('personal headline and contact order is display-only metadata', () => {
  assert.deepEqual(normalizePersonalHeaderOrder(['contact', 'headline']), ['contact', 'headline']);
  assert.deepEqual(normalizePersonalHeaderOrder(['headline', 'headline', 'bad-row']), ['headline', 'contact']);

  let resume = createEmptyResume();
  resume = updatePersonalField(resume, 'headline', 'Software Engineer');
  resume = updatePersonalField(resume, 'email', 'person@example.com');
  resume = setPersonalHeaderOrder(resume, ['contact', 'headline']);

  assert.deepEqual(resume.settings.personalHeaderOrder, ['contact', 'headline']);
  assert.equal(resume.personal.headline, 'Software Engineer');
  assert.equal(resume.personal.email, 'person@example.com');

  const rejected = setPersonalHeaderOrder(resume, ['contact', 'contact']);
  assert.deepEqual(rejected.settings.personalHeaderOrder, resume.settings.personalHeaderOrder);

  const resetThroughSettingValue = setResumeSettingValue(resume, 'personalHeaderOrder', ['headline', 'contact']);
  assert.deepEqual(resetThroughSettingValue.settings.personalHeaderOrder, ['headline', 'contact']);
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

test('resume rail uses stable container-driven columns instead of viewport-sized tiles', () => {
  const appCss = fs.readFileSync('src/App.css', 'utf8');
  const railComponent = fs.readFileSync('src/components/resumeWorkspaceRail.jsx', 'utf8');
  const railView = fs.readFileSync('src/components/resumeWorkspaceRailView.jsx', 'utf8');
  const railDrag = fs.readFileSync('src/components/resumeWorkspaceRailDrag.js', 'utf8');

  assert.match(appCss, /\.resumeSubbar\s*\{[\s\S]*?container-name:\s*resume-rail/);
  assert.match(appCss, /\.resumePillStrip\s*\{[\s\S]*?--resume-rail-columns:\s*2/);
  assert.match(appCss, /grid-template-columns:\s*repeat\(var\(--resume-rail-columns\),\s*minmax\(0,\s*1fr\)\)/);
  assert.match(appCss, /\.resumePillStrip\s*\{[\s\S]*?row-gap:\s*7px/);
  assert.match(appCss, /\.resumePillStrip\s*\{[\s\S]*?grid-auto-rows:\s*38px/);
  assert.match(appCss, /@container resume-rail \(min-width:\s*1030px\)\s*\{[\s\S]*?--resume-rail-columns:\s*6/);
  assert.match(appCss, /\.resumePill\s*\{[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*0/);
  assert.match(appCss, /\.resumeNewButton\s*\{[\s\S]*?width:\s*100%;[\s\S]*?min-width:\s*0/);
  assert.match(appCss, /\.resumeRailCell:has\(\.entryMenu\.isOpen\)\s*\{[\s\S]*?z-index:\s*60/);
  assert.match(railView, /animateLayoutChanges:\s*disableSortableLayoutAnimation/);
  assert.match(railComponent, /buildResumeRailLayout\(layoutOrganization, displayedOpenFolderIds, columns\)/);
  assert.match(railView, /placement\.surfaceRows\.map\([\s\S]*?className="resumeFolderClusterSurface"/);
  assert.match(railView, /dragDisabled=\{isRenaming \|\| isOpen \|\| isTransitioning\}/);
  assert.match(railView, /const animationOrder = placement\.children\.length - index - 1/);
  assert.match(railView, /delay: shouldReduceMotion \? 0 : index \* itemStagger/);
  assert.match(railComponent, /closingFolderSnapshots\.values\(\)[\s\S]*?<ClosingFolderLayer/);
  assert.match(railComponent, /onDragMove=\{handleDragMove\}/);
  assert.doesNotMatch(railComponent, /onDragOver=/);
  assert.match(railDrag, /getFolderResumeInsertionIndex\(pointer, rect, placement, targetCount\)/);
  assert.match(railDrag, /getFolderPlacementRect\(metrics, placement\)/);
  assert.doesNotMatch(railComponent, /dragOverTargetRef|stableItemCollisionRef/);
  assert.match(railComponent, /<SortableContext items=\{rootSortableIds\} strategy=\{railSortingStrategy\}>/);
  assert.match(railComponent, /dragCollisionRectsRef/);
  assert.match(railComponent, /activeResumePlacementKeyRef\.current === placementKey/);
  assert.doesNotMatch(railComponent, /rectSortingStrategy/);
  assert.match(railComponent, /from '\.\/resumeWorkspaceRailDrag\.js'/);
  assert.match(railComponent, /from '\.\/resumeWorkspaceRailView\.jsx'/);
});

test('resume rail terminal cell supports insertion on either side of the final root item', () => {
  const rootItems = Array.from({ length: 7 }, (_, index) => ({
    type: 'resume',
    id: `resume-${index + 1}`,
  }));
  const organization = { rootItems, folders: {} };
  const metrics = getRailGridMetrics({ left: 0, top: 0, width: 1200 }, 6);
  const terminalRowY = metrics.top + metrics.rowStride * 1.4;
  const terminalCellLeftX = metrics.left + metrics.cellWidth * 0.25;
  const terminalCellRightX = metrics.left + metrics.cellWidth * 0.75;
  const options = {
    baseOrganization: organization,
    draggedItem: rootItems[0],
    draggedResumeIds: [rootItems[0].id],
    openFolderIds: new Set(),
    columns: 6,
    metrics,
  };

  const beforeFinal = getRootPointerDestination({
    ...options,
    pointer: { x: terminalCellLeftX, y: terminalRowY },
  });
  const afterFinal = getRootPointerDestination({
    ...options,
    pointer: { x: terminalCellRightX, y: terminalRowY },
  });

  assert.equal(beforeFinal.insertionIndex, 5);
  assert.equal(beforeFinal.position, 'before');
  assert.equal(beforeFinal.targetItem.id, 'resume-7');
  assert.equal(afterFinal.insertionIndex, 6);
  assert.equal(afterFinal.position, 'after');
  assert.equal(afterFinal.targetItem.id, 'resume-7');
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

test('empty sample content is replaced with the real preview model before print', () => {
  const appComponent = fs.readFileSync('src/App.jsx', 'utf8');

  assert.match(appComponent, /const displayPreviewModel = isPrintRendering \? previewModel : \(samplePreviewModel \|\| previewModel\)/);
  assert.match(appComponent, /window\.addEventListener\('beforeprint', preparePrintPreview\)/);
  assert.match(appComponent, /flushSync\(\(\) => setIsPrintRendering\(true\)\)/);
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

test('preview page markers measure rendered content instead of fixed page scroll height', () => {
  const previewComponent = fs.readFileSync('src/components/resumePreview.jsx', 'utf8');
  const previewCss = fs.readFileSync('src/styles/preview.css', 'utf8');

  assert.match(previewComponent, /function measurePreviewContentFlowHeight/);
  assert.match(previewComponent, /data-preview-page-content="true"/);
  assert.doesNotMatch(previewComponent, /Math\.max\(printableHeight,\s*resumeElement\.scrollHeight - paddingTop - paddingBottom\)/);
  assert.match(previewCss, /\.resumePageContent\s*\{/);
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

test('login merge preserves blank resumes with intentional layout or settings changes', () => {
  const localResume = setResumeSettingValue(createEmptyResume(), 'textSize', 2);
  const localDraft = {
    resume: localResume,
    template: DEFAULT_TEMPLATE,
    savedAt: '2026-02-01T00:00:00.000Z',
  };
  const result = mergeLocalAndCloudWorkspaces({
    localWorkspace: createWorkspace(['local-layout']),
    localDraftsByResumeId: new Map([['local-layout', localDraft]]),
    cloudWorkspace: createWorkspace(['cloud-1']),
    cloudDraftsByResumeId: new Map([['cloud-1', createDraft('Cloud Resume')]]),
  });

  assert.equal(result.localHasContent, true);
  assert.deepEqual(result.workspace.resumeIds, ['local-layout', 'cloud-1']);
  assert.deepEqual(result.syncPlan.upsertResumeIds, ['local-layout']);
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

test('login merge restores cloud folder organization into a blank browser', () => {
  const cloudWorkspace = normalizeWorkspaceIndex({
    ...createWorkspace(['cloud-1', 'cloud-2'], { activeResumeId: 'cloud-2' }),
    organization: {
      updatedAt: '2026-02-01T00:00:00.000Z',
      rootItems: [{ type: 'folder', id: 'cloud-folder' }],
      folders: {
        'cloud-folder': {
          id: 'cloud-folder',
          name: 'Cloud folder',
          resumeIds: ['cloud-1', 'cloud-2'],
        },
      },
    },
  });
  const result = mergeLocalAndCloudWorkspaces({
    localWorkspace: createWorkspace(['local-blank']),
    localDraftsByResumeId: new Map([['local-blank', createDraft('')]]),
    cloudWorkspace,
    cloudDraftsByResumeId: new Map([
      ['cloud-1', createDraft('Cloud One')],
      ['cloud-2', createDraft('Cloud Two')],
    ]),
  });

  assert.deepEqual(result.workspace.organization.rootItems, [
    { type: 'folder', id: 'cloud-folder' },
  ]);
  assert.deepEqual(result.workspace.organization.folders['cloud-folder'].resumeIds, ['cloud-1', 'cloud-2']);
});

test('login merge keeps local placement, cloud-only folders, and unioned folder tombstones', () => {
  const sharedDraftOne = createDraft('One');
  const sharedDraftTwo = createDraft('Two');
  const localWorkspace = normalizeWorkspaceIndex({
    ...createWorkspace(['r1', 'r2']),
    organization: {
      updatedAt: '2026-03-01T00:00:00.000Z',
      rootItems: [
        { type: 'folder', id: 'local-folder' },
        { type: 'resume', id: 'r2' },
      ],
      folders: {
        'local-folder': {
          id: 'local-folder',
          name: 'Local',
          resumeIds: ['r1'],
        },
      },
      removedFolderIds: ['removed-locally'],
    },
  });
  const cloudWorkspace = normalizeWorkspaceIndex({
    ...createWorkspace(['r1', 'r2', 'r3']),
    organization: {
      updatedAt: '2026-02-01T00:00:00.000Z',
      rootItems: [
        { type: 'folder', id: 'removed-locally' },
        { type: 'folder', id: 'cloud-folder' },
        { type: 'resume', id: 'r1' },
        { type: 'resume', id: 'r2' },
      ],
      folders: {
        'removed-locally': { id: 'removed-locally', name: 'Old', resumeIds: [] },
        'cloud-folder': {
          id: 'cloud-folder',
          name: 'Cloud',
          resumeIds: ['r3'],
        },
      },
      removedFolderIds: ['removed-in-cloud'],
    },
  });
  const result = mergeLocalAndCloudWorkspaces({
    localWorkspace,
    localDraftsByResumeId: new Map([
      ['r1', sharedDraftOne],
      ['r2', sharedDraftTwo],
    ]),
    cloudWorkspace,
    cloudDraftsByResumeId: new Map([
      ['r1', sharedDraftOne],
      ['r2', sharedDraftTwo],
      ['r3', createDraft('Three')],
    ]),
  });

  assert.deepEqual(result.workspace.organization.folders['local-folder'].resumeIds, ['r1']);
  assert.deepEqual(result.workspace.organization.folders['cloud-folder'].resumeIds, ['r3']);
  assert.equal(result.workspace.organization.folders['removed-locally'], undefined);
  assert.deepEqual(
    new Set(result.workspace.organization.removedFolderIds),
    new Set(['removed-locally', 'removed-in-cloud']),
  );
  assert.equal(result.syncPlan.workspaceNeedsSync, true);
});

test('login merge keeps local organization despite a future cloud clock', () => {
  const sharedDraftOne = createDraft('One');
  const sharedDraftTwo = createDraft('Two');
  const localWorkspace = normalizeWorkspaceIndex({
    ...createWorkspace(['r1', 'r2']),
    organization: {
      updatedAt: '2026-01-01T00:00:00.000Z',
      rootItems: [
        { type: 'resume', id: 'r2' },
        { type: 'resume', id: 'r1' },
      ],
      folders: {},
    },
  });
  const cloudWorkspace = normalizeWorkspaceIndex({
    ...createWorkspace(['r1', 'r2']),
    organization: {
      updatedAt: '2099-01-01T00:00:00.000Z',
      rootItems: [
        { type: 'resume', id: 'r1' },
        { type: 'resume', id: 'r2' },
      ],
      folders: {},
    },
  });
  const result = mergeLocalAndCloudWorkspaces({
    localWorkspace,
    localDraftsByResumeId: new Map([
      ['r1', sharedDraftOne],
      ['r2', sharedDraftTwo],
    ]),
    cloudWorkspace,
    cloudDraftsByResumeId: new Map([
      ['r1', sharedDraftOne],
      ['r2', sharedDraftTwo],
    ]),
  });

  assert.deepEqual(result.workspace.organization.rootItems, [
    { type: 'resume', id: 'r2' },
    { type: 'resume', id: 'r1' },
  ]);
  assert.equal(result.syncPlan.workspaceNeedsSync, true);
});

test('folder tombstones remain durable beyond the former normalization cap', () => {
  const removedFolderIds = Array.from({ length: 250 }, (_, index) => `removed-${index}`);
  const normalized = normalizeWorkspaceIndex({
    ...createWorkspace(['r1']),
    organization: {
      rootItems: [{ type: 'resume', id: 'r1' }],
      folders: {},
      removedFolderIds,
    },
  });
  const staleOrganization = {
    rootItems: [
      { type: 'folder', id: 'removed-0' },
      { type: 'resume', id: 'r1' },
    ],
    folders: {
      'removed-0': { id: 'removed-0', name: 'Old folder', resumeIds: [] },
    },
    removedFolderIds: [],
  };
  const merged = mergeWorkspaceOrganizations(
    normalized.organization,
    staleOrganization,
    ['r1'],
  );

  assert.equal(normalized.organization.removedFolderIds.length, 250);
  assert.ok(normalized.organization.removedFolderIds.includes('removed-0'));
  assert.equal(merged.folders['removed-0'], undefined);
  assert.equal(merged.rootItems.some((item) => item.id === 'removed-0'), false);
});

test('sync API workspace documents round trip folder organization', () => {
  const workspace = normalizeWorkspaceIndex({
    ...createWorkspace(['r1', 'r2']),
    organization: {
      updatedAt: '2026-03-01T00:00:00.000Z',
      rootItems: [{ type: 'folder', id: 'folder-1' }],
      folders: {
        'folder-1': {
          id: 'folder-1',
          name: 'Interviews',
          toneIndex: 3,
          resumeIds: ['r1', 'r2'],
        },
      },
      removedFolderIds: ['folder-old'],
    },
  });
  const cloudDocument = createWorkspaceDoc(workspace, {
    updatedAt: '2026-03-01T00:00:00.000Z',
    version: 42,
  });
  const restored = cloudWorkspaceFromDoc(cloudDocument);

  assert.equal(cloudDocument.schemaVersion, 2);
  assert.equal(restored.organization.folders['folder-1'].toneIndex, 3);
  assert.deepEqual(restored.organization, workspace.organization);
});

test('cloud workspace writes preserve concurrent browser folders and honor deletes', () => {
  const currentWorkspace = normalizeWorkspaceIndex({
    ...createWorkspace(['cloud-1']),
    organization: {
      updatedAt: '2026-02-01T00:00:00.000Z',
      rootItems: [{ type: 'folder', id: 'cloud-folder' }],
      folders: {
        'cloud-folder': {
          id: 'cloud-folder',
          name: 'Cloud folder',
          resumeIds: ['cloud-1'],
        },
      },
    },
  });
  const incomingWorkspace = normalizeWorkspaceIndex({
    ...createWorkspace(['local-1']),
    organization: {
      updatedAt: '2026-03-01T00:00:00.000Z',
      rootItems: [{ type: 'folder', id: 'local-folder' }],
      folders: {
        'local-folder': {
          id: 'local-folder',
          name: 'Local folder',
          resumeIds: ['local-1'],
        },
      },
    },
  });
  const currentDocument = createWorkspaceDoc(currentWorkspace, {
    updatedAt: '2026-02-01T00:00:00.000Z',
    version: 8,
  });
  const merged = mergeCloudWorkspaceForWrite(incomingWorkspace, currentDocument);
  const afterDelete = mergeCloudWorkspaceForWrite(incomingWorkspace, currentDocument, {
    deletedResumeIds: ['cloud-1'],
  });
  const incomingWithFolderTombstone = normalizeWorkspaceIndex({
    ...incomingWorkspace,
    organization: {
      ...incomingWorkspace.organization,
      removedFolderIds: ['cloud-folder'],
    },
  });
  const afterFolderRemoval = mergeCloudWorkspaceForWrite(incomingWithFolderTombstone, currentDocument);

  assert.deepEqual(merged.resumeIds, ['local-1', 'cloud-1']);
  assert.deepEqual(merged.organization.folders['local-folder'].resumeIds, ['local-1']);
  assert.deepEqual(merged.organization.folders['cloud-folder'].resumeIds, ['cloud-1']);
  assert.deepEqual(afterDelete.resumeIds, ['local-1']);
  assert.equal(afterDelete.organization.folders['cloud-folder'].resumeIds.length, 0);
  assert.equal(afterFolderRemoval.organization.folders['cloud-folder'], undefined);
  assert.ok(afterFolderRemoval.organization.removedFolderIds.includes('cloud-folder'));
});

test('accepted cloud workspace writes ignore client clock skew', () => {
  const currentWorkspace = normalizeWorkspaceIndex({
    ...createWorkspace(['r1', 'r2']),
    organization: {
      updatedAt: '2099-01-01T00:00:00.000Z',
      rootItems: [
        { type: 'resume', id: 'r1' },
        { type: 'resume', id: 'r2' },
      ],
      folders: {},
    },
  });
  const incomingWorkspace = normalizeWorkspaceIndex({
    ...createWorkspace(['r1', 'r2']),
    organization: {
      updatedAt: '2026-01-01T00:00:00.000Z',
      rootItems: [
        { type: 'resume', id: 'r2' },
        { type: 'resume', id: 'r1' },
      ],
      folders: {},
    },
  });
  const merged = mergeCloudWorkspaceForWrite(
    incomingWorkspace,
    createWorkspaceDoc(currentWorkspace),
  );

  assert.deepEqual(merged.organization.rootItems, [
    { type: 'resume', id: 'r2' },
    { type: 'resume', id: 'r1' },
  ]);
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

test('login merge never resurrects sample information after either copy dismissed it', () => {
  const baseResume = createDraft('Same Resume').resume;
  const localDraft = {
    ...createDraft('Same Resume', '2026-01-01T00:00:00.000Z'),
    resume: dismissSampleInformation(baseResume),
  };
  const cloudDraft = {
    ...createDraft('Same Resume', '2026-02-01T00:00:00.000Z'),
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

  assert.equal(result.draftsByResumeId.get('resume-1').resume.sampleDisplay.isDismissed, true);
  assert.equal(result.draftsByResumeId.get('resume-1').resume.sampleDisplay.showInformation, false);
  assert.deepEqual(result.syncPlan.upsertResumeIds, ['resume-1']);
});

test('sync API preserves an existing permanent sample dismissal', () => {
  const incomingDraft = {
    ...createDraft('Same Resume'),
    resume: updateSampleDisplay(createDraft('Same Resume').resume, {
      hasStarted: true,
      showInformation: true,
    }),
  };
  const preservedDraft = preservePermanentSampleDismissal(incomingDraft, {
    resume: {
      sampleDisplay: {
        isDismissed: true,
      },
    },
  });

  assert.equal(preservedDraft.resume.sampleDisplay.isDismissed, true);
  assert.equal(preservedDraft.resume.sampleDisplay.showInformation, false);
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

test('server sync cursors reject older same-browser operations without using wall-clock time', () => {
  const operation = {
    id: 'upsertDraft:r1',
    type: 'upsertDraft',
    resumeId: 'r1',
    clientId: 'browser-a',
    operationVersion: 7,
  };

  assert.equal(shouldAcceptSyncOperation(operation, null), true);
  assert.equal(shouldAcceptSyncOperation(operation, { lastSequence: 6 }), true);
  assert.equal(shouldAcceptSyncOperation(operation, { lastSequence: 7 }), false);
  assert.equal(shouldAcceptSyncOperation(operation, { lastSequence: 8 }), false);
});

test('draft upserts and deletes share a cursor and permanent tombstones block resurrection', () => {
  const upsert = {
    id: 'upsertDraft:r1',
    type: 'upsertDraft',
    resumeId: 'r1',
    clientId: 'browser-a',
    operationVersion: 7,
  };
  const remove = {
    ...upsert,
    id: 'deleteDraft:r1',
    type: 'deleteDraft',
    operationVersion: 8,
  };

  assert.equal(getSyncCursorId(upsert), getSyncCursorId(remove));
  assert.equal(shouldAcceptDraftSyncOperation(upsert, { lastSequence: 6 }, false), true);
  assert.equal(shouldAcceptDraftSyncOperation(upsert, { lastSequence: 6 }, true), false);
  assert.equal(shouldAcceptSyncOperation(upsert, { lastSequence: 8 }), false);
});

test('local persistence serializes editor saves and awaits them before switching or clearing', () => {
  const builderHook = fs.readFileSync('src/hooks/useResumeBuilder.js', 'utf8');
  const appComponent = fs.readFileSync('src/App.jsx', 'utf8');
  const browserConnection = fs.readFileSync('src/lib/browserConnection.js', 'utf8');

  assert.match(builderHook, /const editorSaveQueueRef = useRef\(Promise\.resolve\(\)\)/);
  assert.match(builderHook, /const saveResult = await persistCurrentEditorDraft\(\{ reason: 'switch-resume'/);
  assert.match(builderHook, /saveResult\?\.conflict \|\|\s*saveResult\?\.error \|\|\s*saveResult\?\.skipped/);
  assert.match(appComponent, /const flushedDraft = await flushActiveCloudDraft\(\{ reason: 'signout' \}\)/);
  assert.match(appComponent, /await clearLocalResumeWorkspaceData\(\)/);
  assert.match(browserConnection, /await deleteLocalWorkspaceDatabase\(\)/);
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
