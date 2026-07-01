import test from 'node:test';
import assert from 'node:assert/strict';

import {
  DEFAULT_TEMPLATE,
  MAX_RESUME_SECTIONS,
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
  updateSectionBlockEducationCustomSection,
  updateSectionBlockEducationProgram,
  updateSectionBlockEntry,
  updateSectionBlockTextList,
  updateSectionTitle,
  validateResume,
} from '../src/lib/resume.js';
import {
  createOutboxAckDescriptor,
  createDraftContentHash,
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
  createSourceDocumentCoverage,
  createSourceDocumentFromText,
  normalizeImportFilePayload,
  validateImportedDraftCoverage,
} from '../server/importResume.js';

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

  assert.deepEqual(Object.keys(resume).sort(), ['personal', 'sections', 'settings']);
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
      ['skills', 'skills', 'Skills'],
      ['projects', 'projects', 'Projects'],
      ['certifications', 'certifications', 'Certifications'],
      ['volunteering', 'roles', 'Volunteering'],
      ['leadership', 'roles', 'Leadership'],
      ['languages', 'languages', 'Languages'],
      ['awards', 'awards', 'Awards'],
      ['publications', 'publications', 'Publications'],
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
      ],
    },
  });

  assert.equal(normalized.version, 3);
  assert.equal(normalized.template, DEFAULT_TEMPLATE);
  assert.equal(normalized.resume.personal.name, 'Ada Lovelace');
  assert.equal(normalized.resume.settings.textSize, 5);
  assert.deepEqual(normalized.resume.sections.map((section) => section.id), ['custom-work']);
  assert.equal(normalized.resume.sections[0].entries[0].company, 'Analytical Engines');
  assert.equal(Object.hasOwn(normalized, 'section' + 'Order'), false);
});

test('block actions update roles, education details, and list items', () => {
  let resume = createEmptyResume();
  const roleEntryId = getSection(resume, 'experience').entries[0].id;
  const educationEntryId = getSection(resume, 'education').entries[0].id;

  resume = updateRoleBlockEntry(resume, 'experience', roleEntryId, 'company', 'Acme');
  resume = updateRoleBlockEntry(resume, 'experience', roleEntryId, 'role', 'Designer');
  resume = updateRoleBlockActivity(resume, 'experience', roleEntryId, 0, 'Led redesign');
  resume = updateSectionBlockEntry(resume, 'education', educationEntryId, 'school', 'Example University');
  resume = updateSectionBlockEducationProgram(resume, 'education', educationEntryId, 0, 'degree', 'Ignored because no program exists');
  resume = updateSectionBlockEducationCustomSection(resume, 'education', educationEntryId, 0, 'label', 'Coursework');
  resume = updateSectionBlockEducationCustomSection(resume, 'education', educationEntryId, 0, 'content', 'Algorithms, HCI');

  assert.equal(getSection(resume, 'experience').entries[0].company, 'Acme');
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
  assert.deepEqual(resume.sections.slice(0, 4).map((section) => section.id), ['education', 'experience', 'projects', 'skills']);

  resume = reorderResumeSectionBlocksToMatch(resume, ['skills', 'education', 'experience']);
  assert.deepEqual(resume.sections.slice(0, 4).map((section) => section.id), ['skills', 'education', 'projects', 'experience']);

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
  assert.equal(getSection(resume, firstInternship.sectionId).title, 'Internships');
  assert.equal(getSection(resume, secondInternship.sectionId).title, 'Internships 2');
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
  assert.deepEqual(preview.sectionOrder.slice(0, 4), ['education', 'experience', 'skills', 'projects']);
  assert.deepEqual(preview.sectionBlocks.map((section) => section.id), ['experience']);
  assert.deepEqual(preview.sectionBlocks[0].entryOrder.slice(0, 2), [roleEntryId, emptyRoleEntryId]);
  assert.deepEqual(preview.sectionBlocks[0].entries[0].activities, [
    { text: 'Built compilers', sourceIndex: 1 },
  ]);
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
  assert.ok(createDuplicateResumeName('abcdefghijklmnopqrstuvwxyz', []).length <= 25);
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
    /PDF or DOCX/,
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

test('PDF text assessment accepts resume-like text and rejects empty extraction', () => {
  const goodText = [
    'Jane Doe jane@example.com 555-555-5555 linkedin.com/in/janedoe',
    'Experience',
    ...Array.from({ length: 90 }, (_, index) => `Built product feature ${index} using React and SQL in 202${index % 5}.`),
  ].join('\n');

  assert.equal(assessExtractedResumeText(goodText).isTrustworthy, true);
  assert.equal(assessExtractedResumeText('').isTrustworthy, false);
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
