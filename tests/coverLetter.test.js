import test from 'node:test';
import assert from 'node:assert/strict';

import {
  coverLetterHasContent,
  createBlankCoverLetterDraft,
  createCoverLetterContentHash,
  getCoverLetterWordCount,
  reconcileImportedCoverLetterSender,
  resolveCoverLetterSender,
  serializeCoverLetterDraft,
} from '../src/lib/coverLetter.js';
import {
  addWorkspaceCoverLetter,
  normalizeCoverLetterRegistry,
} from '../src/lib/coverLetterWorkspace.js';
import { mergeCoverLettersForWorkspace } from '../src/lib/coverLetterReconciliation.js';
import {
  createMixedSampleCoverLetterModel,
  getSampleCoverLetterCharacterId,
  getSampleCoverLetterCount,
} from '../src/lib/sampleCoverLetters.js';
import { createBlankDraftState } from '../src/lib/workspaceDraft.js';
import { normalizeWorkspaceIndex } from '../src/lib/workspace.js';
import {
  assessCoverLetterSourceDocument,
  createCoverLetterSourceDocumentFromText,
} from '../server/coverLetterImport/sourceDocument.js';
import { compileCoverLetterSourceDocument } from '../server/coverLetterImport/compiler.js';

function createWorkspace(resumeId = 'resume-1') {
  return normalizeWorkspaceIndex({
    activeResumeId: resumeId,
    resumeIds: [resumeId],
    meta: {
      [resumeId]: { name: 'Resume 1', updatedAt: '' },
    },
  });
}

function createLetterDraft(resumeId, text, savedAt) {
  const draft = createBlankCoverLetterDraft(resumeId);
  draft.coverLetter.bodyBlocks[0].text = text;
  draft.savedAt = savedAt;
  return draft;
}

test('cover letter defaults stay blank while meaningful text affects content and hashing', () => {
  const draft = createBlankCoverLetterDraft('resume-1');
  const initialHash = createCoverLetterContentHash(draft);

  assert.equal(draft.template, 'compact');
  assert.equal(draft.coverLetter.resumeId, 'resume-1');
  assert.equal(coverLetterHasContent(draft.coverLetter), false);
  assert.equal(getCoverLetterWordCount(draft.coverLetter), 1);

  draft.coverLetter.bodyBlocks[0].text = 'I build reliable products.';

  assert.equal(coverLetterHasContent(draft.coverLetter), true);
  assert.equal(getCoverLetterWordCount(draft.coverLetter), 5);
  assert.notEqual(createCoverLetterContentHash(draft), initialHash);
});

test('linked sender values resolve from the resume while explicit blank overrides win', () => {
  const draft = createBlankCoverLetterDraft('resume-1');
  const resume = createBlankDraftState().resume;
  resume.personal.name = 'Anurag Maganti';
  resume.personal.email = 'anurag@example.com';
  draft.coverLetter.sender.overrides.email = '';

  assert.deepEqual(resolveCoverLetterSender(draft.coverLetter, resume), {
    name: 'Anurag Maganti',
    headline: '',
    location: '',
    phone: '',
    email: '',
    linkedinUrl: '',
    githubUrl: '',
    portfolioUrl: '',
    customField: '',
  });
});

test('paired imports dedupe matching sender fields, backfill blanks, and preserve conflicts', () => {
  const resumeDraft = createBlankDraftState();
  resumeDraft.resume.personal.name = 'Anurag Maganti';
  const letterDraft = createBlankCoverLetterDraft('resume-1');
  letterDraft.coverLetter.sender.overrides = {
    name: 'Anurag Maganti',
    email: 'letter@example.com',
    phone: '(555) 111-2222',
  };
  resumeDraft.resume.personal.email = 'resume@example.com';

  const result = reconcileImportedCoverLetterSender({
    resumeDraft,
    coverLetterDraft: letterDraft,
    allowResumeBackfill: true,
  });

  assert.equal(result.coverLetterDraft.coverLetter.sender.overrides.name, undefined);
  assert.equal(result.resumeDraft.resume.personal.phone, '(555) 111-2222');
  assert.equal(result.coverLetterDraft.coverLetter.sender.overrides.phone, undefined);
  assert.equal(result.coverLetterDraft.coverLetter.sender.overrides.email, 'letter@example.com');
  assert.equal(result.coverLetterDraft.importWarnings.length, 1);
});

test('cover letter registry enforces one valid parent and one placement per letter', () => {
  const registry = normalizeCoverLetterRegistry({
    orderByResumeId: {
      'resume-1': ['letter-1', 'letter-1', 'letter-orphan'],
      'resume-missing': ['letter-2'],
    },
    meta: {
      'letter-1': { id: 'letter-1', resumeId: 'resume-1', name: 'Primary' },
      'letter-orphan': { id: 'letter-orphan', resumeId: 'resume-missing', name: 'Orphan' },
      'letter-2': { id: 'letter-2', resumeId: 'resume-missing', name: 'Missing parent' },
    },
  }, ['resume-1']);

  assert.deepEqual(registry.orderByResumeId, { 'resume-1': ['letter-1'] });
  assert.deepEqual(Object.keys(registry.meta), ['letter-1']);
});

test('same-id cover letter conflicts preserve both drafts under one resume', () => {
  const workspace = createWorkspace();
  const addition = addWorkspaceCoverLetter(workspace, 'resume-1', {
    coverLetterId: 'letter-1',
    name: 'Acme cover letter',
    updatedAt: '2026-07-25T10:00:00.000Z',
  });
  const workspaceWithLetter = normalizeWorkspaceIndex({
    ...workspace,
    coverLetters: addition.registry,
  });
  const localDraft = createLetterDraft('resume-1', 'Newer local version', '2026-07-26T10:00:00.000Z');
  const cloudDraft = createLetterDraft('resume-1', 'Older cloud version', '2026-07-25T10:00:00.000Z');
  const merged = mergeCoverLettersForWorkspace({
    workspace: workspaceWithLetter,
    localWorkspace: workspaceWithLetter,
    cloudWorkspace: workspaceWithLetter,
    localDraftsById: new Map([['letter-1', localDraft]]),
    cloudDraftsById: new Map([['letter-1', cloudDraft]]),
    localHasContent: true,
  });
  const ids = merged.workspace.coverLetters.orderByResumeId['resume-1'];
  const copyId = ids.find((id) => id !== 'letter-1');

  assert.equal(ids.length, 2);
  assert.equal(merged.draftsById.get('letter-1').coverLetter.bodyBlocks[0].text, 'Newer local version');
  assert.equal(merged.draftsById.get(copyId).coverLetter.bodyBlocks[0].text, 'Older cloud version');
  assert.equal(merged.syncPlan.upsertIds.includes(copyId), true);
});

test('plain-text cover letter parsing preserves paragraph boundaries and detects resume mismatches', () => {
  const source = createCoverLetterSourceDocumentFromText(`Anurag Maganti
anurag@example.com

July 26, 2026
Hiring Manager
Acme Company
New York, NY

Dear Hiring Manager,

I am applying for the product engineer role.

I have shipped reliable local-first applications.

Thank you for your consideration.

Sincerely,
Anurag Maganti`);
  const compiled = compileCoverLetterSourceDocument(source, {
    resumeId: 'resume-1',
    sourceFileName: 'acme.pdf',
  });

  assert.deepEqual(
    source.bodyBlocks.map((block) => block.kind === 'paragraph' ? block.text : block.items.join(' ')),
    [
      'I am applying for the product engineer role.',
      'I have shipped reliable local-first applications.',
      'Thank you for your consideration.',
    ],
  );
  assert.deepEqual(compiled.draft.coverLetter.bodyBlocks.map((block) => block.role), [
    'opening',
    'evidence',
    'closing',
  ]);
  assert.equal(compiled.draft.coverLetter.resumeId, 'resume-1');

  const mismatch = assessCoverLetterSourceDocument({
    rawLines: ['Education', 'Experience', 'Skills'],
    bodyBlocks: [{ kind: 'paragraph', text: 'Resume content' }],
  });
  assert.equal(mismatch.isLikelyResume, true);
});

test('all nine sample letters follow the parent resume character and never serialize', () => {
  const observedCharacters = new Set();
  for (let index = 0; index < 2_000 && observedCharacters.size < getSampleCoverLetterCount(); index += 1) {
    observedCharacters.add(getSampleCoverLetterCharacterId(`resume-${index}`));
  }
  assert.equal(observedCharacters.size, 9);

  const resumeId = 'sample-parent';
  const draft = createBlankCoverLetterDraft(resumeId);
  const original = structuredClone(draft);
  const sampleModel = createMixedSampleCoverLetterModel({
    coverLetter: draft.coverLetter,
    resolvedSender: {},
    resumeId,
  });
  const sampleText = sampleModel.coverLetter.bodyBlocks[0].text;

  assert.equal(sampleModel.characterId, getSampleCoverLetterCharacterId(resumeId));
  assert.deepEqual(
    sampleModel.coverLetter.bodyBlocks.map((block) => block.id),
    draft.coverLetter.bodyBlocks.map((block) => block.id),
  );
  assert.deepEqual(draft, original);
  assert.equal(JSON.stringify(serializeCoverLetterDraft(draft)).includes(sampleText), false);
});
