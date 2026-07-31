import test from 'node:test';
import assert from 'node:assert/strict';

import {
  JOB_LISTING_DOCX_MIME,
  JOB_LISTING_PDF_MIME,
  normalizeJobListingMimeType,
  normalizePublicJobListingUrl,
} from '../src/lib/jobListingInput.js';
import { createEmptyResume } from '../src/lib/resume.js';
import { getPreviewModel } from '../src/lib/resumePreviewModel.js';
import {
  applyApprovedTailoringChanges,
  createResumeTailoringCatalog,
  createResumeTailoringReview,
  createTailoringPreviewModel,
  updateTailoringDecision,
} from '../src/lib/resumeTailoring.js';
import {
  ResumeTailoringError,
  parseResumeTailoringRequest,
  validateResumeTailoringProposals,
} from '../server/resumeTailoring.js';

function createResumeFixture() {
  const resume = createEmptyResume();
  resume.personal = {
    ...resume.personal,
    name: 'Ada Example',
    email: 'ada@example.com',
    location: 'Chicago, IL',
    headline: 'Software Engineer',
    aboutMe: 'Engineer who builds reliable services.',
  };
  const roleSection = resume.sections.find((section) => section.kind === 'roles');
  roleSection.entries = [{
    id: 'role-1',
    company: 'Example Corp',
    role: 'Software Engineer',
    location: 'Chicago, IL',
    yearsExp: '2022-present',
    activities: ['Built TypeScript APIs.', 'Improved deployment reliability.'],
  }];
  const skillsSection = resume.sections.find((section) => section.kind === 'skills');
  skillsSection.entries = [{ id: 'skills-1', category: 'Languages', items: 'TypeScript, SQL' }];
  return resume;
}

test('tailoring catalog excludes contact, date, location, layout, and persistent IDs', () => {
  const catalog = createResumeTailoringCatalog(createResumeFixture());
  const requestText = JSON.stringify(catalog.request);

  assert.doesNotMatch(requestText, /ada@example\.com|Chicago, IL|2022-present/);
  assert.doesNotMatch(requestText, /role-1|skills-1|entryHeaderLayout|settings|sampleDisplay/);
  assert.match(requestText, /Software Engineer|Built TypeScript APIs|TypeScript/);
  assert.equal(catalog.request.targets.some((target) => target.fieldType === 'professional-summary'), true);
});

test('blank professional summary is never offered to the model', () => {
  const resume = createResumeFixture();
  resume.personal.aboutMe = '';
  const catalog = createResumeTailoringCatalog(resume);

  assert.equal(catalog.request.targets.some((target) => target.fieldType === 'professional-summary'), false);
});

test('blank starter entries are not exposed as AI targets', () => {
  const catalog = createResumeTailoringCatalog(createEmptyResume());

  assert.equal(catalog.targets.length, 0);
});

test('approved atomic changes apply without adding sections or entries', () => {
  const resume = createResumeFixture();
  const catalog = createResumeTailoringCatalog(resume);
  const summary = catalog.targets.find((target) => target.fieldType === 'professional-summary');
  const role = catalog.targets.find((target) => target.fieldType === 'role-title');
  const bullets = catalog.targets.filter((target) => target.type === 'listItem' && target.fieldType === 'bullet');
  const bulletList = catalog.targets.find((target) => target.type === 'list' && target.fieldType === 'bullet');
  const review = createResumeTailoringReview(catalog, {
    changes: [
      { targetId: summary.id, operation: 'replace', value: 'Backend engineer focused on reliable services.', position: null, labels: ['role-focused'], note: '' },
      { targetId: role.id, operation: 'replace', value: 'Backend Software Engineer', position: null, labels: ['clarity'], note: '' },
      { targetId: bullets[0].id, operation: 'replace', value: 'Built reliable TypeScript APIs.', position: 1, labels: ['impact'], note: '' },
      { targetId: bullets[1].id, operation: 'remove', value: '', position: null, labels: [], note: '' },
      { targetId: bulletList.id, operation: 'add', value: 'Improved service observability.', position: 0, labels: ['role-focused'], note: '' },
    ],
  });
  let decided = review;
  for (const change of review.changes) decided = updateTailoringDecision(decided, change.id, 'approved');
  const result = applyApprovedTailoringChanges(resume, decided);
  const roleSectionBefore = resume.sections.find((section) => section.kind === 'roles');
  const roleSectionAfter = result.sections.find((section) => section.id === roleSectionBefore.id);

  assert.equal(result.sections.length, resume.sections.length);
  assert.equal(roleSectionAfter.entries.length, roleSectionBefore.entries.length);
  assert.equal(result.personal.aboutMe, 'Backend engineer focused on reliable services.');
  assert.equal(roleSectionAfter.entries[0].role, 'Backend Software Engineer');
  assert.deepEqual(roleSectionAfter.entries[0].activities, [
    'Improved service observability.',
    'Built reliable TypeScript APIs.',
  ]);
  assert.equal(roleSectionAfter.entries[0].company, 'Example Corp');
  assert.equal(roleSectionAfter.entries[0].yearsExp, '2022-present');
});

test('pending and rejected changes do not mutate the resume', () => {
  const resume = createResumeFixture();
  const catalog = createResumeTailoringCatalog(resume);
  const headline = catalog.targets.find((target) => target.fieldType === 'headline');
  const review = createResumeTailoringReview(catalog, {
    changes: [{ targetId: headline.id, operation: 'replace', value: 'Backend Engineer', position: null, labels: [], note: '' }],
  });

  const pendingResult = applyApprovedTailoringChanges(resume, review);
  assert.equal(pendingResult.personal.headline, resume.personal.headline);
  const rejected = updateTailoringDecision(review, review.changes[0].id, 'rejected');
  assert.equal(applyApprovedTailoringChanges(resume, rejected).personal.headline, resume.personal.headline);
});

test('tailoring preview marks proposed and removed list items without mutating its input', () => {
  const resume = createResumeFixture();
  const preview = getPreviewModel(resume);
  const catalog = createResumeTailoringCatalog(resume);
  const bullets = catalog.targets.filter((target) => target.type === 'listItem' && target.fieldType === 'bullet');
  const review = createResumeTailoringReview(catalog, {
    changes: [
      { targetId: bullets[0].id, operation: 'replace', value: 'Built production TypeScript APIs.', position: null, labels: [], note: '' },
      { targetId: bullets[1].id, operation: 'remove', value: '', position: null, labels: [], note: '' },
    ],
  });
  const tailored = createTailoringPreviewModel(preview, review).previewModel;
  const roleEntry = tailored.sectionBlocks.find((section) => section.kind === 'roles').entries[0];

  assert.equal(roleEntry.activities[0].text, 'Built production TypeScript APIs.');
  assert.equal(roleEntry.activities[1].tailoringRemoved, true);
  assert.equal(preview.sectionBlocks.find((section) => section.kind === 'roles').entries[0].activities[0].text, 'Built TypeScript APIs.');
});

test('job listing validation accepts PDF/DOCX and rejects private URLs', () => {
  assert.equal(normalizeJobListingMimeType('listing.pdf', ''), JOB_LISTING_PDF_MIME);
  assert.equal(normalizeJobListingMimeType('listing.docx', 'application/octet-stream'), JOB_LISTING_DOCX_MIME);
  assert.equal(normalizeJobListingMimeType('listing.pdf', JOB_LISTING_DOCX_MIME), '');
  assert.equal(normalizePublicJobListingUrl('http://127.0.0.1/job'), '');
  assert.equal(normalizePublicJobListingUrl('https://jobs.example.com/opening'), 'https://jobs.example.com/opening');
});

test('server discards unsupported and duplicate model operations', () => {
  const catalog = createResumeTailoringCatalog(createResumeFixture());
  const scalar = catalog.request.targets.find((target) => target.type === 'scalar');
  const list = catalog.request.targets.find((target) => target.type === 'list');
  const request = { resume: catalog.request };
  const result = validateResumeTailoringProposals({
    changes: [
      { targetId: scalar.id, operation: 'add', value: 'Invalid', position: 0, labels: [], note: '' },
      { targetId: scalar.id, operation: 'replace', value: 'Backend Engineer', position: 8, labels: ['clarity'], note: '' },
      { targetId: scalar.id, operation: 'replace', value: 'Duplicate', position: -1, labels: [], note: '' },
      { targetId: list.id, operation: 'add', value: 'Improved service monitoring.', position: 0, labels: ['impact'], note: '' },
      { targetId: 'unknown-target', operation: 'replace', value: 'Unknown', position: -1, labels: [], note: '' },
    ],
  }, request);

  assert.deepEqual(result.changes.map((change) => change.value), [
    'Backend Engineer',
    'Improved service monitoring.',
  ]);
  assert.equal(result.changes[0].position, null);
});

test('server rejects whitespace-only pasted job listings after normalization', async () => {
  const catalog = createResumeTailoringCatalog(createResumeFixture());

  await assert.rejects(
    () => parseResumeTailoringRequest({}, async () => ({
      resume: catalog.request,
      source: { type: 'text', text: ' '.repeat(80) },
      instructions: '',
    })),
    (error) => error instanceof ResumeTailoringError && error.code === 'tailor/listing-too-short',
  );
});
