import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  DRAFT_STORAGE_KEY,
  MAX_WORKSPACE_RESUMES,
  SECTION_IDS,
  WORKSPACE_INDEX_STORAGE_KEY,
  addEducationCustomSection,
  addEducation,
  createDuplicateResumeName,
  createEmptyResume,
  createFreshWorkspaceDraft,
  createNextResumeName,
  createResumeStorageKey,
  createWorkspaceFromLegacyDraft,
  createWorkspaceResumeId,
  createWorkspaceResumeMeta,
  createEmptyWorkspaceIndex,
  getResumePresentationVars,
  getResumePrintPageRule,
  getPreviewModel,
  moveActivity,
  moveEducationCustomSection,
  moveResumeSectionBlock,
  moveSectionOrder,
  normalizeDraftPayload,
  normalizeBulletText,
  normalizeResumeSettings,
  normalizeWorkspaceIndex,
  removeEducationCustomSection,
  removeEducation,
  removeExperience,
  removeResumeSectionBlock,
  reorderResumeSectionBlock,
  reorderResumeSectionBlocksToMatch,
  reorderSectionOrder,
  reorderSectionOrderToMatch,
  reorderWorkspaceResumes,
  reorderWorkspaceResumesToMatch,
  updatePersonalField,
  updateRoleBlockEntry,
  updateResumeSetting,
  updateSectionBlockEducationCustomSection,
  updateSectionBlockEducationProgram,
  updateSectionBlockEntry,
  updateSectionTitle,
  validateResume,
} from '../src/lib/resume.js';
import {
  CLOUD_DEVICE_ID_KEY,
  CLOUD_DRAFT_MAX_BYTES,
  CLOUD_SESSION_ID_KEY,
  CLOUD_TRUSTED_DEVICE_KEY,
  CLOUD_WORKSPACE_RESUME_LIMIT,
  createCloudDraftDoc,
  getCloudSessionId,
  validateCloudDraftPayload,
} from '../src/lib/firebaseWorkspace.js';
import {
  GUEST_WORKSPACE_CLOUD_MIRROR_BACKUP_KEY,
  GUEST_WORKSPACE_CLOUD_MIRROR_MANIFEST_KEY,
  createGuestMirrorWorkspace,
  persistCloudDraftMirror,
  persistCloudWorkspaceMirror,
  readCloudMirrorManifest,
  refreshCloudMirrorManifest,
} from '../src/lib/localWorkspaceMirror.js';
import {
  CONNECTED_ACCOUNT_STORAGE_KEY,
  DEFAULT_SIGNED_OUT_EDITING_PREFERENCE,
  SIGNED_OUT_EDITING_PREFERENCE_KEY,
  clearBrowserResumeConnectionData,
  clearLocalResumeWorkspaceData,
  hasLocalResumeWorkspaceData,
  readConnectedAccount,
  readSignedOutEditingPreference,
  writeConnectedAccount,
  writeSignedOutEditingPreference,
} from '../src/lib/browserConnection.js';
import {
  DEFAULT_GEMINI_MAX_OUTPUT_TOKENS,
  DEFAULT_GEMINI_IMPORT_MODEL,
  DEFAULT_GEMINI_THINKING_LEVEL,
  IMPORT_FILE_MAX_BYTES,
  ImportResumeError,
  assessExtractedResumeText,
  compileSourceDocumentToImportedDraft,
  createGeminiImportGenerationConfig,
  createSourceDocumentCoverage,
  createSourceDocumentFromText,
  getGeminiErrorDetails,
  normalizeImportFilePayload,
  validateImportedDraftCoverage,
} from '../server/importResume.js';

const TEST_FILE_DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.resolve(TEST_FILE_DIR, '../src');
const SERVER_IMPORT_PATH = path.resolve(TEST_FILE_DIR, '../server/importResume.js');
const LEGACY_CLOUD_IMPORT_PREFIX = 'resumeloomr:firebase-imported:';

function createMemoryStorage(initialEntries = []) {
  const values = new Map(initialEntries);

  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    key(index) {
      return Array.from(values.keys())[index] || null;
    },
    get length() {
      return values.size;
    },
    values,
  };
}

function collectSourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const resolvedPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      return collectSourceFiles(resolvedPath);
    }

    if (/\.(js|jsx)$/.test(entry.name)) {
      return [resolvedPath];
    }

    return [];
  });
}

test('createEmptyResume returns editable starter entries', () => {
  const resume = createEmptyResume();

  assert.deepEqual(resume.settings, {
    textSize: 0,
    horizontalMargins: 0,
    verticalMargins: 0,
    lineSpacing: 0,
    sectionSpacing: 0,
    entrySpacing: 0,
    headingSize: 0,
    nameSize: 0
  });
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

test('workspace helpers build stable storage keys and metadata', () => {
  const resumeId = createWorkspaceResumeId();
  const workspace = createFreshWorkspaceDraft();

  assert.match(resumeId, /^id-|^[0-9a-f-]{8,}$/i);
  assert.equal(MAX_WORKSPACE_RESUMES, 10);
  assert.equal(CLOUD_WORKSPACE_RESUME_LIMIT, 50);
  assert.equal(createResumeStorageKey('abc123'), 'resumeloomr:resume:abc123');
  assert.deepEqual(createWorkspaceResumeMeta('Resume 4', '2026-03-26T12:00:00.000Z'), {
    name: 'Resume 4',
    updatedAt: '2026-03-26T12:00:00.000Z'
  });
  assert.equal(workspace.workspace.resumeIds.length, 1);
  assert.equal(workspace.workspace.meta[workspace.activeResumeId].name, 'Resume 1');
  assert.deepEqual(createEmptyWorkspaceIndex(), {
    activeResumeId: '',
    resumeIds: [],
    meta: {}
  });
});

test('workspace naming helpers create sequential and duplicate-safe names', () => {
  assert.equal(createNextResumeName(['Resume 1', 'Resume 3']), 'Resume 2');
  assert.equal(createDuplicateResumeName('Resume no skills', ['Resume no skills']), 'Resume no skills copy');
  assert.equal(
    createDuplicateResumeName('Resume no skills', ['Resume no skills', 'Resume no skills copy', 'Resume no skills copy 2']),
    'Resume no skills copy 3'
  );
  assert.ok(createDuplicateResumeName('abcdefghijklmnopqrstuvwxyz', []).length <= 25);
  assert.ok(createDuplicateResumeName('abcdefghijklmnopqrstuvwxyz', []).endsWith(' copy'));
  assert.equal(createWorkspaceResumeMeta('abcdefghijklmnopqrstuvwxyz').name.length, 25);
});

test('normalizeWorkspaceIndex keeps valid ids and backfills missing names', () => {
  const normalized = normalizeWorkspaceIndex({
    activeResumeId: 'resume-2',
    resumeIds: ['resume-1', 'resume-2', 'resume-2'],
    meta: {
      'resume-1': { name: 'Resume no skills', updatedAt: '2026-03-26T12:00:00.000Z' },
      'resume-2': { updatedAt: '2026-03-26T13:00:00.000Z' }
    }
  });

  assert.deepEqual(normalized.resumeIds, ['resume-1', 'resume-2']);
  assert.equal(normalized.activeResumeId, 'resume-2');
  assert.equal(normalized.meta['resume-1'].name, 'Resume no skills');
  assert.equal(normalized.meta['resume-2'].name, 'Resume 2');
});

test('normalizeWorkspaceIndex truncates imported resume names to the supported length', () => {
  const normalized = normalizeWorkspaceIndex({
    activeResumeId: 'resume-1',
    resumeIds: ['resume-1'],
    meta: {
      'resume-1': {
        name: 'abcdefghijklmnopqrstuvwxyz imported resume',
      },
    },
  });

  assert.equal(normalized.meta['resume-1'].name.length, 25);
  assert.equal(normalized.meta['resume-1'].name, 'abcdefghijklmnopqrstuvwxy');
});

test('resume import file normalization rejects unsupported file types', () => {
  assert.throws(
    () => normalizeImportFilePayload({
      fileName: 'resume.txt',
      mimeType: 'text/plain',
      fileDataBase64: Buffer.from('plain text').toString('base64'),
    }),
    (error) => (
      error instanceof ImportResumeError &&
      error.statusCode === 415 &&
      error.code === 'import/unsupported-file-type'
    ),
  );
});

test('resume import file normalization rejects oversize uploads', () => {
  assert.throws(
    () => normalizeImportFilePayload({
      fileName: 'resume.pdf',
      mimeType: 'application/pdf',
      fileDataBase64: Buffer.alloc(IMPORT_FILE_MAX_BYTES + 1).toString('base64'),
    }),
    (error) => (
      error instanceof ImportResumeError &&
      error.statusCode === 413 &&
      error.code === 'import/file-too-large'
    ),
  );
});

test('resume import file normalization reads valid PDF and DOCX uploads', () => {
  const pdfImport = normalizeImportFilePayload({
    fileName: 'resume.pdf',
    mimeType: 'application/pdf',
    fileDataBase64: Buffer.from('pdf data').toString('base64'),
  });
  const docxImport = normalizeImportFilePayload({
    fileName: 'resume.docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    fileDataBase64: Buffer.from('docx data').toString('base64'),
  });

  assert.equal(pdfImport.mimeType, 'application/pdf');
  assert.equal(docxImport.mimeType, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
});

test('PDF extraction assessment accepts readable resume text', () => {
  const text = `
    Jordan Lee
    jordan.lee@example.com | (555) 123-4567 | linkedin.com/in/jordanlee
    Product-focused Software Engineer with experience building React and Node tools.
    Experience
    Acme Health, Software Engineer, 2021 - Present
    Built onboarding workflows that reduced manual review time and improved customer activation.
    Designed reporting dashboards, partnered with product managers, and implemented SQL data checks.
    Collaborated with design, support, and operations teams to ship reliable improvements every quarter.
    Education
    State University, B.S. Computer Science, 2017 - 2021
    Skills
    JavaScript, TypeScript, React, Node, SQL, AWS, accessibility, product analytics, communication.
  `;
  const assessment = assessExtractedResumeText(text);

  assert.equal(assessment.isTrustworthy, true);
  assert.ok(assessment.nonWhitespaceCharacters >= 450);
  assert.ok(assessment.wordCount >= 75);
  assert.ok(assessment.printableRatio >= 0.85);
  assert.ok(assessment.resumeSignalCount >= 2);
});

test('PDF extraction assessment rejects empty scanned-style text', () => {
  const assessment = assessExtractedResumeText('');

  assert.equal(assessment.isTrustworthy, false);
  assert.equal(assessment.nonWhitespaceCharacters, 0);
  assert.equal(assessment.wordCount, 0);
});

test('PDF extraction assessment rejects garbled text', () => {
  const assessment = assessExtractedResumeText(`${'\u0001'.repeat(520)} Jordan Lee 2024 Skills`);

  assert.equal(assessment.isTrustworthy, false);
  assert.ok(assessment.printableRatio < 0.85);
});

test('PDF extraction assessment accepts unusual but readable resume formatting', () => {
  const text = `
    AVERY PATEL // avery@sample.dev // github.com/averypatel
    Builder of internal products, workflow automation, and customer-facing dashboards.
    2020 -> Current : Senior Analyst at Northstar Labs
    Improved weekly planning by building Python, SQL, and spreadsheet automations for operations teams.
    2018 -> 2020 : Operations Associate at Harbor Studio
    Managed data cleanup, vendor reporting, onboarding, and process documentation across departments.
    Created repeatable workflows, trained teammates, and documented quality checks for monthly reporting.
    University of Michigan | Bachelor of Arts | 2014 -> 2018
    Tools I use often: SQL, Python, Excel, Looker, Tableau, stakeholder communication, leadership.
  `;
  const assessment = assessExtractedResumeText(text);

  assert.equal(assessment.isTrustworthy, true);
  assert.ok(assessment.resumeSignalCount >= 2);
});

test('source document coverage detects ordered blocks and required detail signals', () => {
  const sourceDocument = createSourceDocumentFromText(`
    WALTER WASHINGTON
    EDUCATION
    University of Georgia, Honors Program Athens, GA
    Bachelor of Arts, Political Science May 2023
    Bachelor of Arts, Spanish GPA: 3.73/4.00
    Certificate in Personal and Organizational Leadership August 2022 - Present
    • Participant in selective leadership development program
    Study Abroad: Oxford University August 2021 - December 2021
    • Earned 6 credit hours taught by Oxford faculty
    RELEVANT COURSEWORK
    Leadership and Personal Development, Business Spanish
    INTERNSHIP EXPERIENCE
    Benton, Getchell & Grayson, LLC, Virtual Law Intern August 2021 - Present
    • Contribute to daily operations of law firm
    • Draft motions and participate in depositions
    • Update correspondence of clients
    The Population Institute, Intern June 2020 - August 2020
    • Created and negotiated student scholarship program
    • Managed relations for World Population Day Symposium
    • Wrote 4 grant proposals
    • Advocated with Congress and NGOs
    LEADERSHIP EXPERIENCE
    UGA Department of University Housing, Resident Assistant August 2021 - Present
    • Design, implement, and evaluate educational programs
    • Utilize communication and counseling skills
    • Quickly respond to crises
    • Compile annual facility inventory
    YMCA Camp Harbor, Head Counselor May 2019 - July 2019
    • Selected by supervisor to interview, hire, and train counselors
    • Developed leadership training curriculum
    • Taught leadership lessons to campers
    • Designed comprehensive camp schedule
    ADDITIONAL WORK EXPERIENCE
    UGA Honors Program, Student Assistant September 2019 - Present
    HONORS & AWARDS
    HOPE Scholarship Recipient August 2019 - Present
    Dean's List 5 semesters
    Governor's Scholarship August 2019 - May 2020
    UGA Rotary Top 12 Award Winner February 2020
  `);
  const coverage = createSourceDocumentCoverage(sourceDocument);

  assert.deepEqual(
    coverage.blocks.map((block) => [block.title, block.kind]),
    [
      ['EDUCATION', 'education'],
      ['INTERNSHIP EXPERIENCE', 'roles'],
      ['LEADERSHIP EXPERIENCE', 'roles'],
      ['ADDITIONAL WORK EXPERIENCE', 'roles'],
      ['HONORS & AWARDS', 'awards'],
    ]
  );
  assert.equal(coverage.bulletCount, 17);
  assert.equal(coverage.awardCount, 4);
  assert.equal(coverage.hasGpa, true);
  assert.equal(coverage.hasCoursework, true);
  assert.deepEqual(coverage.sections, {
    education: true,
    roles: true,
    awards: true,
  });
  assert.equal(coverage.blocks.find((block) => block.title === 'INTERNSHIP EXPERIENCE').roleEntryCount, 2);
  assert.equal(coverage.blocks.find((block) => block.title === 'LEADERSHIP EXPERIENCE').roleEntryCount, 2);
});

test('source document segmentation handles generic section headings', () => {
  const sourceDocument = createSourceDocumentFromText(`
    JORDAN EXAMPLE
    jordan@example.com | Austin, TX | github.com/jordan
    CAREER HIGHLIGHTS
    • Built a public-sector workflow used by 10 teams
    • Reduced reporting time by 40%
    TECHNICAL TOOLKIT
    JavaScript, React, SQL, Python
    COMMUNITY ENGAGEMENT
    Code Club, Mentor January 2022 - Present
    • Coached students through weekly coding labs
  `);

  assert.deepEqual(
    sourceDocument.sections.map((section) => section.title),
    ['CAREER HIGHLIGHTS', 'TECHNICAL TOOLKIT', 'COMMUNITY ENGAGEMENT']
  );
  assert.equal(sourceDocument.personalLines[0], 'JORDAN EXAMPLE');
  assert.equal(sourceDocument.sections[0].lines.length, 2);
});

test('source-first import discards contact link labels while preserving personal URLs', () => {
  const sourceDocument = createSourceDocumentFromText(`
    CASEY EXAMPLE
    Product Engineer | Denver, CO | casey@example.com | (303) 555-1212
    LINKS
    caseyexample.com
    linkedin.com/in/caseyexample
    github.com/caseyexample
    EDUCATION
    State University
    B.S. Computer Science
  `);
  const imported = compileSourceDocumentToImportedDraft(sourceDocument, null, {
    sourceFileName: 'contact-links.pdf',
  });

  assert.equal(sourceDocument.personalLines.includes('LINKS'), false);
  assert.equal(imported.draft.resume.personal.portfolioUrl, 'caseyexample.com');
  assert.equal(imported.draft.resume.personal.linkedinUrl, 'linkedin.com/in/caseyexample');
  assert.equal(imported.draft.resume.personal.githubUrl, 'github.com/caseyexample');
  assert.equal(imported.draft.resume.personal.aboutMe, '');
  assert.deepEqual(imported.draft.resume.sections.map((section) => section.title), ['EDUCATION']);
});

test('source-first import groups split role/date lines and strips uploaded bullet glyphs', () => {
  const sourceDocument = createSourceDocumentFromText(`
    CASEY EXAMPLE
    EXPERIENCE
    Acme Labs | Senior Software Engineer
    01/2022 - 05/2024
    ➢ Built onboarding workflows for 20 teams
    ▸ Improved API latency by 35%
    Clinic Group | Data Assistant
    06/2020 - 12/2021
    → Processed transfer requests in Excel,
    ensuring accurate data for night-shift teams
  `);
  const imported = compileSourceDocumentToImportedDraft(sourceDocument, null, {
    sourceFileName: 'roles.pdf',
  });
  const rolesBlock = imported.draft.resume.sections.find((section) => section.title === 'EXPERIENCE');

  assert.equal(rolesBlock.entries.length, 2);
  assert.equal(rolesBlock.entries[0].company, 'Acme Labs');
  assert.equal(rolesBlock.entries[0].role, 'Senior Software Engineer');
  assert.equal(rolesBlock.entries[0].yearsExp, '01/2022 - 05/2024');
  assert.deepEqual(rolesBlock.entries[0].activities, [
    'Built onboarding workflows for 20 teams',
    'Improved API latency by 35%',
  ]);
  assert.equal(rolesBlock.entries[1].company, 'Clinic Group');
  assert.equal(rolesBlock.entries[1].role, 'Data Assistant');
  assert.equal(rolesBlock.entries[1].yearsExp, '06/2020 - 12/2021');
  assert.deepEqual(rolesBlock.entries[1].activities, [
    'Processed transfer requests in Excel, ensuring accurate data for night-shift teams',
  ]);
});

test('source-first import handles bootcamp education, degree language text, and named skill groups', () => {
  const sourceDocument = createSourceDocumentFromText(`
    CASEY EXAMPLE
    EDUCATION
    Code Academy
    Advanced Software
    Engineering Certificate
    State Tech
    B.S. Biochemistry &
    B.A. Applied Language
    SKILLS
    Front-End
    JavaScript, React,
    Next.js, CSS
    Back-End
    Node.js, SQL, AWS
  `);
  const imported = compileSourceDocumentToImportedDraft(sourceDocument, null, {
    sourceFileName: 'education-skills.pdf',
  });
  const educationBlock = imported.draft.resume.sections.find((section) => section.title === 'EDUCATION');
  const skillsBlock = imported.draft.resume.sections.find((section) => section.title === 'SKILLS');

  assert.deepEqual(imported.draft.resume.sections.map((section) => section.title), ['EDUCATION', 'SKILLS']);
  assert.equal(educationBlock.entries.length, 2);
  assert.equal(educationBlock.entries[0].school, 'Code Academy');
  assert.equal(educationBlock.entries[0].degree, 'Advanced Software Engineering Certificate');
  assert.equal(educationBlock.entries[1].school, 'State Tech');
  assert.equal(educationBlock.entries[1].degree, 'B.S. Biochemistry & B.A. Applied Language');
  assert.deepEqual(
    skillsBlock.entries.map((entry) => [entry.category, entry.items]),
    [
      ['Front-End', 'JavaScript, React, Next.js, CSS'],
      ['Back-End', 'Node.js, SQL, AWS'],
    ],
  );
});

test('source-first import splits pipe-delimited project names from summaries', () => {
  const sourceDocument = createSourceDocumentFromText(`
    CASEY EXAMPLE
    PROJECTS
    Inkloom | Tool for artists to generate templates
    Lumka | Minigame powered by a shuffle algorithm
  `);
  const imported = compileSourceDocumentToImportedDraft(sourceDocument, null, {
    sourceFileName: 'projects.pdf',
  });
  const projectsBlock = imported.draft.resume.sections.find((section) => section.title === 'PROJECTS');

  assert.equal(projectsBlock.entries[0].name, 'Inkloom');
  assert.equal(projectsBlock.entries[0].summary, 'Tool for artists to generate templates');
  assert.equal(projectsBlock.entries[1].name, 'Lumka');
  assert.equal(projectsBlock.entries[1].summary, 'Minigame powered by a shuffle algorithm');
});

test('source-first compiler preserves ordered role bullets, education details, and awards', () => {
  const sourceText = `
    WALTER WASHINGTON
    wwashington@uofga.edu ● Athens, GA 30602 ● (706) 555-1234 ● linkedin.com/in/wwashington
    EDUCATION
    University of Georgia, Honors Program Athens, GA
    Bachelor of Arts, Political Science | School of Public & International Affairs May 2023
    Bachelor of Arts, Spanish | Franklin College of Arts & Sciences GPA: 3.73/4.00
    Certificate in Personal and Organizational Leadership August 2022 - Present
    • Participant in highly selective year-long leadership development program
    Study Abroad: Oxford University | Oxford, England August 2021 - December 2021
    • Earned 6 credit hours taught by Oxford faculty
    RELEVANT COURSEWORK
    Leadership and Personal Development, Business Spanish
    INTERNSHIP EXPERIENCE
    Benton, Getchell & Grayson, LLC, Virtual Law Intern | Remote August 2021 - Present
    • Contribute to daily operations of law firm
    • Draft motions and participate in depositions
    • Update correspondence of clients
    The Population Institute, Intern | Washington, D.C. June 2020 - August 2020
    • Created and negotiated student scholarship program
    • Managed relations for World Population Day Symposium
    • Wrote 4 grant proposals
    • Advocated with Congress and NGOs
    LEADERSHIP EXPERIENCE
    UGA Department of University Housing, Resident Assistant | Athens, GA August 2021 - Present
    • Design, implement, and evaluate educational programs, including an Effective
    Leadership workshop series
    • Utilize communication and counseling skills
    • Quickly respond to crises
    • Compile annual facility inventory
    YMCA Camp Harbor, Head Counselor | Gainesville, GA May 2019 - July 2019
    • Selected by supervisor to interview, hire, and train counselors
    • Developed leadership training curriculum
    • Taught leadership lessons to campers
    • Designed comprehensive camp schedule
    ADDITIONAL WORK EXPERIENCE
    UGA Honors Program, Student Assistant | Athens, GA September 2019 - Present
    Russell Hall, Desk Assistant | Athens, GA August 2020 - May 2021
    Dillard's, Sales Associate | Alpharetta, GA May 2018 - August 2019
    HONORS & AWARDS
    HOPE Scholarship Recipient August 2019 - Present
    Dean's List 5 semesters
    Governor's Scholarship August 2019 - May 2020
    UGA Rotary Top 12 Award Winner February 2020
  `;
  const sourceDocument = createSourceDocumentFromText(sourceText);
  const imported = compileSourceDocumentToImportedDraft(sourceDocument, null, {
    sourceFileName: 'government_leadership_resume25.pdf',
  });
  const previewModel = getPreviewModel(imported.draft.resume);
  const validation = validateImportedDraftCoverage(imported.draft, createSourceDocumentCoverage(sourceDocument));

  assert.equal(imported.draft.resume.personal.name, 'WALTER WASHINGTON');
  assert.equal(imported.draft.resume.personal.email, 'wwashington@uofga.edu');
  assert.deepEqual(
    previewModel.sectionBlocks.map((section) => [section.title, section.kind]),
    [
      ['EDUCATION', 'education'],
      ['INTERNSHIP EXPERIENCE', 'roles'],
      ['LEADERSHIP EXPERIENCE', 'roles'],
      ['ADDITIONAL WORK EXPERIENCE', 'roles'],
      ['HONORS & AWARDS', 'awards'],
    ]
  );
  assert.equal(previewModel.sectionBlocks.find((section) => section.title === 'EDUCATION').entries.length, 1);
  assert.equal(previewModel.sectionBlocks.find((section) => section.title === 'INTERNSHIP EXPERIENCE').entries.length, 2);
  assert.equal(previewModel.sectionBlocks.find((section) => section.title === 'LEADERSHIP EXPERIENCE').entries[0].activities.length, 4);
  assert.equal(previewModel.sectionBlocks.find((section) => section.title === 'ADDITIONAL WORK EXPERIENCE').entries.length, 3);
  assert.equal(previewModel.sectionBlocks.find((section) => section.title === 'HONORS & AWARDS').entries.length, 4);
  assert.equal(validation.ok, true);
});

test('source-first coverage warns when compiled sections drop source details', () => {
  const sourceDocument = createSourceDocumentFromText(`
    EDUCATION
    University of Georgia GPA: 3.73/4.00
    RELEVANT COURSEWORK
    Leadership and Personal Development
    EXPERIENCE
    Acme, Intern 2024
    • First source bullet
    • Second source bullet
    • Third source bullet
    • Fourth source bullet
    HONORS & AWARDS
    Award One
    Award Two
  `);
  const sourceCoverage = createSourceDocumentCoverage(sourceDocument);
  const incompleteDraft = normalizeDraftPayload({
    resume: {
      personal: { name: 'Walter Washington' },
      sections: [
        {
          id: 'roles-experience',
          kind: 'roles',
          title: 'EXPERIENCE',
          entries: [
            {
              id: 'role-1',
              company: 'Acme',
              role: 'Intern',
              activities: ['First source bullet'],
            },
          ],
        },
      ],
    },
  });
  const validation = validateImportedDraftCoverage(incompleteDraft, sourceCoverage);

  assert.equal(validation.ok, false);
  assert.match(validation.issues.join(' '), /Education section/);
  assert.match(validation.issues.join(' '), /awards/);
  assert.match(validation.issues.join(' '), /GPA/);
  assert.match(validation.issues.join(' '), /coursework/i);
  assert.match(validation.issues.join(' '), /1 of 4/);
});

test('preview model renders role section blocks in source order without duplicate group labels', () => {
  const draft = normalizeDraftPayload({
    resume: {
      sections: [
        {
          id: 'roles-internship',
          kind: 'roles',
          title: 'INTERNSHIP EXPERIENCE',
          entries: [
            {
              id: 'internship-entry',
              company: 'Benton',
              role: 'Intern',
              yearsExp: '2021',
              activities: ['Drafted motions'],
            },
          ],
        },
        {
          id: 'roles-leadership',
          kind: 'roles',
          title: 'LEADERSHIP EXPERIENCE',
          entries: [
            {
              id: 'leadership-entry',
              company: 'UGA Housing',
              role: 'Resident Assistant',
              yearsExp: '2021',
              activities: ['Led programs'],
            },
          ],
        },
        {
          id: 'roles-additional-work',
          kind: 'roles',
          title: 'ADDITIONAL WORK EXPERIENCE',
          entries: [
            {
              id: 'work-entry',
              company: 'UGA Honors Program',
              role: 'Student Assistant',
              yearsExp: '2019',
              activities: ['Supported office operations'],
            },
          ],
        },
      ],
    },
  });
  const model = getPreviewModel(draft.resume);

  assert.deepEqual(
    model.sectionBlocks.map((section) => section.title),
    ['INTERNSHIP EXPERIENCE', 'LEADERSHIP EXPERIENCE', 'ADDITIONAL WORK EXPERIENCE']
  );
  assert.equal(model.sectionBlocks[1].entries[0].company, 'UGA Housing');
  assert.equal(model.sectionBlocks[1].title, 'LEADERSHIP EXPERIENCE');
});

test('section block actions reorder and edit dynamic role blocks safely', () => {
  const draft = normalizeDraftPayload({
    resume: {
      sections: [
        {
          id: 'roles-internship',
          kind: 'roles',
          title: 'INTERNSHIP EXPERIENCE',
          entries: [
            {
              id: 'internship-entry',
              company: 'Benton',
              role: 'Intern',
              yearsExp: '2021',
              activities: ['Drafted motions'],
            },
          ],
        },
        {
          id: 'roles-leadership',
          kind: 'roles',
          title: 'LEADERSHIP EXPERIENCE',
          entries: [
            {
              id: 'leadership-entry',
              company: 'UGA Housing',
              role: 'Resident Assistant',
              yearsExp: '2021',
              activities: ['Led programs'],
            },
          ],
        },
      ],
    },
  });
  const [firstBlock, secondBlock] = draft.resume.sections;
  const reordered = reorderResumeSectionBlock(draft.resume, secondBlock.id, firstBlock.id, 'before');
  const edited = updateRoleBlockEntry(reordered, secondBlock.id, secondBlock.entries[0].id, 'company', 'University Housing');
  const movedBack = moveResumeSectionBlock(edited, secondBlock.id, 1);

  assert.deepEqual(
    movedBack.sections
      .filter((section) => section.kind === 'roles' && section.entries.some((entry) => entry.company || entry.role || entry.activities.some(Boolean)))
      .map((section) => section.title),
    ['INTERNSHIP EXPERIENCE', 'LEADERSHIP EXPERIENCE']
  );
  assert.equal(movedBack.sections[1].entries[0].company, 'University Housing');
});

test('block-first actions edit imported education and awards blocks shown in preview', () => {
  const draft = normalizeDraftPayload({
    resume: {
      sections: [
        {
          id: 'education-imported',
          kind: 'education',
          title: 'EDUCATION',
          entries: [
            {
              id: 'education-entry',
              school: 'University of Georgia',
              location: 'Athens, GA',
              programs: [
                {
                  id: 'program-1',
                  degree: 'Bachelor of Arts, Political Science',
                  yearsEdu: 'May 2023',
                  gpa: '3.73/4.00',
                },
              ],
              coursework: 'Leadership and Personal Development',
              customSections: [{ id: 'custom-1', label: 'Study Abroad', content: 'Oxford University' }],
            },
          ],
        },
        {
          id: 'awards-imported',
          kind: 'awards',
          title: 'HONORS & AWARDS',
          entries: [
            {
              id: 'award-1',
              title: 'HOPE Scholarship Recipient',
              years: 'August 2019 - Present',
            },
          ],
        },
      ],
    },
  });
  const editedSchool = updateSectionBlockEntry(draft.resume, 'education-imported', 'education-entry', 'school', 'University of Georgia Honors Program');
  const editedProgram = updateSectionBlockEducationProgram(editedSchool, 'education-imported', 'education-entry', 0, 'gpa', '3.80/4.00');
  const editedCustom = updateSectionBlockEducationCustomSection(editedProgram, 'education-imported', 'education-entry', 0, 'content', 'Oxford University tutorial program');
  const editedAward = updateSectionBlockEntry(editedCustom, 'awards-imported', 'award-1', 'details', 'Merit scholarship');
  const previewModel = getPreviewModel(editedAward);

  assert.equal(editedAward.sections[0].entries[0].school, 'University of Georgia Honors Program');
  assert.equal(editedAward.sections[0].entries[0].programs[0].gpa, '3.80/4.00');
  assert.equal(editedAward.sections[0].entries[0].customSections[0].content, 'Oxford University tutorial program');
  assert.equal(editedAward.sections[1].entries[0].details, 'Merit scholarship');
  assert.equal(editedAward.education[0].school, 'University of Georgia Honors Program');
  assert.equal(editedAward.awards[0].details, 'Merit scholarship');
  assert.equal(previewModel.sectionBlocks[0].entries[0].programs[0].gpa, '3.80/4.00');
  assert.equal(previewModel.sectionBlocks[1].entries[0].details, 'Merit scholarship');
});

test('normalization refreshes stale legacy fixed blocks into section blocks', () => {
  const draft = normalizeDraftPayload({
    resume: {
      education: [
        {
          id: 'education-entry',
          school: 'Fresh Legacy University',
          degree: 'B.A. Economics',
          yearsEdu: '2024',
        },
      ],
      sections: [
        {
          id: 'education',
          kind: 'education',
          title: 'Education',
          legacySectionId: 'education',
          entries: [
            {
              id: 'education-entry',
              school: 'Stale Block University',
              degree: 'Old Degree',
              yearsEdu: '2020',
            },
          ],
        },
      ],
    },
  });

  assert.equal(draft.resume.sections[0].entries[0].school, 'Fresh Legacy University');
  assert.equal(getPreviewModel(draft.resume).sectionBlocks[0].entries[0].school, 'Fresh Legacy University');
});

test('removing a section block clears matching legacy mirror content', () => {
  const resume = createEmptyResume();
  resume.awards[0].title = 'Hidden Award';
  const removedAwards = removeResumeSectionBlock(resume, 'awards');

  assert.equal(removedAwards.sections.some((section) => section.id === 'awards'), false);
  assert.equal(removedAwards.awards.length, 1);
  assert.equal(removedAwards.awards[0].title, '');

  const draft = normalizeDraftPayload({
    resume: {
      sections: [
        {
          id: 'roles-internship',
          kind: 'roles',
          title: 'INTERNSHIP EXPERIENCE',
          entries: [
            {
              id: 'internship-entry',
              company: 'Benton',
              role: 'Intern',
              yearsExp: '2021',
              activities: ['Drafted motions'],
            },
          ],
        },
        {
          id: 'roles-leadership',
          kind: 'roles',
          title: 'LEADERSHIP EXPERIENCE',
          entries: [
            {
              id: 'leadership-entry',
              company: 'UGA Housing',
              role: 'Resident Assistant',
              yearsExp: '2021',
              activities: ['Led programs'],
            },
          ],
        },
      ],
    },
  });
  const leadershipBlock = draft.resume.sections.find((section) => section.title === 'LEADERSHIP EXPERIENCE');
  const removedRoleBlock = removeResumeSectionBlock(draft.resume, leadershipBlock.id);

  assert.equal(removedRoleBlock.sections.some((section) => section.id === leadershipBlock.id), false);
  assert.deepEqual(
    removedRoleBlock.sections.filter((section) => section.kind === 'roles').map((section) => section.title),
    ['INTERNSHIP EXPERIENCE']
  );
});

test('server import source keeps DOCX text-only and PDF fallback paths', () => {
  const source = fs.readFileSync(SERVER_IMPORT_PATH, 'utf8');

  assert.match(source, /if \(isPdf\) \{/);
  assert.match(source, /extractPdfText\(file\)/);
  assert.match(source, /assessExtractedResumeText\(extractedPdfText\)/);
  assert.match(source, /sourceDocument = createSourceDocumentFromText\(sourceText\)/);
  assert.match(source, /generateSourceDocumentFromGemini\(\{/);
  assert.match(source, /generateSourceMappingFromGemini\(\{/);
  assert.match(source, /compileSourceDocumentToImportedDraft\(sourceDocument, sourceMapping/);
  assert.match(source, /createSourceDocumentCoverage\(sourceDocument\)/);
  assert.match(source, /sourceText = await extractDocxText\(file\)/);
});

test('Gemini 3 import config uses explicit source schemas without legacy temperature', () => {
  const responseJsonSchema = {
    type: 'object',
    properties: {
      sections: { type: 'array', items: { type: 'object' } },
    },
    required: ['sections'],
  };
  const config = createGeminiImportGenerationConfig('gemini-3.1-flash-lite', {
    GEMINI_THINKING_LEVEL: '',
    GEMINI_MAX_OUTPUT_TOKENS: '',
  }, { responseJsonSchema });
  const configWithoutSchema = createGeminiImportGenerationConfig('gemini-3.1-flash-lite', {
    GEMINI_THINKING_LEVEL: '',
    GEMINI_MAX_OUTPUT_TOKENS: '',
  });

  assert.equal(DEFAULT_GEMINI_IMPORT_MODEL, 'gemini-3.1-flash-lite');
  assert.equal(config.responseMimeType, 'application/json');
  assert.equal(config.responseJsonSchema, responseJsonSchema);
  assert.equal(Object.hasOwn(configWithoutSchema, 'responseJsonSchema'), false);
  assert.equal(config.thinkingConfig.thinkingLevel, DEFAULT_GEMINI_THINKING_LEVEL);
  assert.equal(config.maxOutputTokens, DEFAULT_GEMINI_MAX_OUTPUT_TOKENS);
  assert.equal(Object.hasOwn(config, 'temperature'), false);
});

test('Gemini import config keeps 2.5 rollback tuning without thinking level', () => {
  const config = createGeminiImportGenerationConfig('gemini-2.5-flash-lite', {
    GEMINI_THINKING_LEVEL: 'high',
    GEMINI_MAX_OUTPUT_TOKENS: '12000',
  });

  assert.equal(config.temperature, 0.1);
  assert.equal(config.maxOutputTokens, 12000);
  assert.equal(Object.hasOwn(config, 'thinkingConfig'), false);
});

test('Gemini import config clamps output tokens and rejects invalid thinking levels', () => {
  const invalidConfig = createGeminiImportGenerationConfig('gemini-3.1-flash-lite', {
    GEMINI_THINKING_LEVEL: 'unsupported',
    GEMINI_MAX_OUTPUT_TOKENS: '999999',
  });
  const lowConfig = createGeminiImportGenerationConfig('gemini-3.1-flash-lite', {
    GEMINI_THINKING_LEVEL: 'minimal',
    GEMINI_MAX_OUTPUT_TOKENS: '12',
  });

  assert.equal(invalidConfig.thinkingConfig.thinkingLevel, DEFAULT_GEMINI_THINKING_LEVEL);
  assert.equal(invalidConfig.maxOutputTokens, 65536);
  assert.equal(lowConfig.thinkingConfig.thinkingLevel, 'minimal');
  assert.equal(lowConfig.maxOutputTokens, 1024);
});

test('Gemini provider errors expose status details for typed API responses', () => {
  const error = new Error(JSON.stringify({
    error: {
      code: 503,
      message: 'This model is currently experiencing high demand. Please try again later.',
      status: 'UNAVAILABLE',
    },
  }));
  const details = getGeminiErrorDetails(error);

  assert.equal(details.statusCode, 503);
  assert.equal(details.status, 'UNAVAILABLE');
  assert.match(details.message, /high demand/);
});

test('Gemini provider errors detect daily quota exhaustion details', () => {
  const error = new Error(JSON.stringify({
    error: {
      code: 429,
      message: 'You exceeded your current quota. Please check your plan and billing details.',
      status: 'RESOURCE_EXHAUSTED',
      details: [
        {
          '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
          violations: [
            {
              quotaMetric: 'generativelanguage.googleapis.com/generate_content_free_tier_requests',
              quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier',
            },
          ],
        },
      ],
    },
  }));
  const details = getGeminiErrorDetails(error);

  assert.equal(details.statusCode, 429);
  assert.equal(details.status, 'RESOURCE_EXHAUSTED');
  assert.equal(details.isDailyQuota, true);
  assert.equal(details.quotaViolations[0].quotaId, 'GenerateRequestsPerDayPerProjectPerModel-FreeTier');
});

test('workspace resume reorder moves ids before and after targets without changing active resume', () => {
  const workspace = normalizeWorkspaceIndex({
    activeResumeId: 'resume-3',
    resumeIds: ['resume-1', 'resume-2', 'resume-3', 'resume-4'],
    meta: {
      'resume-1': { name: 'Resume 1', updatedAt: '' },
      'resume-2': { name: 'Resume 2', updatedAt: '' },
      'resume-3': { name: 'Resume 3', updatedAt: '' },
      'resume-4': { name: 'Resume 4', updatedAt: '' },
    },
  });
  const movedAfter = reorderWorkspaceResumes(workspace, 'resume-1', 'resume-3', 'after');
  const movedBefore = reorderWorkspaceResumes(movedAfter, 'resume-4', 'resume-2', 'before');

  assert.deepEqual(movedAfter.resumeIds, ['resume-2', 'resume-3', 'resume-1', 'resume-4']);
  assert.equal(movedAfter.activeResumeId, 'resume-3');
  assert.deepEqual(movedBefore.resumeIds, ['resume-4', 'resume-2', 'resume-3', 'resume-1']);
  assert.equal(movedBefore.activeResumeId, 'resume-3');
});

test('workspace resume reorder ignores invalid ids and no-op drops', () => {
  const workspace = normalizeWorkspaceIndex({
    activeResumeId: 'resume-1',
    resumeIds: ['resume-1', 'resume-2'],
    meta: {
      'resume-1': { name: 'Resume 1', updatedAt: '' },
      'resume-2': { name: 'Resume 2', updatedAt: '' },
    },
  });

  assert.deepEqual(reorderWorkspaceResumes(workspace, 'resume-1', 'missing', 'after'), workspace);
  assert.deepEqual(reorderWorkspaceResumes(workspace, 'resume-1', 'resume-1', 'before'), workspace);
});

test('workspace resume exact-order reorder preserves active resume and rejects invalid orders', () => {
  const workspace = normalizeWorkspaceIndex({
    activeResumeId: 'resume-2',
    resumeIds: ['resume-1', 'resume-2', 'resume-3'],
    meta: {
      'resume-1': { name: 'Resume 1', updatedAt: '' },
      'resume-2': { name: 'Resume 2', updatedAt: '' },
      'resume-3': { name: 'Resume 3', updatedAt: '' },
    },
  });
  const reordered = reorderWorkspaceResumesToMatch(workspace, ['resume-3', 'resume-1', 'resume-2']);

  assert.deepEqual(reordered.resumeIds, ['resume-3', 'resume-1', 'resume-2']);
  assert.equal(reordered.activeResumeId, 'resume-2');
  assert.deepEqual(reorderWorkspaceResumesToMatch(workspace, ['resume-3', 'resume-1']), workspace);
  assert.deepEqual(reorderWorkspaceResumesToMatch(workspace, ['resume-3', 'resume-1', 'missing']), workspace);
});

test('cloud guest mirror keeps the first ten resumes in rail order', () => {
  const resumeIds = Array.from({ length: MAX_WORKSPACE_RESUMES + 2 }, (_, index) => `resume-${index + 1}`);
  const workspace = normalizeWorkspaceIndex({
    activeResumeId: 'resume-12',
    resumeIds,
    meta: Object.fromEntries(resumeIds.map((resumeId, index) => [
      resumeId,
      { name: `Resume ${index + 1}`, updatedAt: `2026-01-${String(index + 1).padStart(2, '0')}T00:00:00.000Z` },
    ])),
  });
  const mirror = createGuestMirrorWorkspace(workspace);

  assert.equal(mirror.resumeIds.length, MAX_WORKSPACE_RESUMES);
  assert.deepEqual(mirror.resumeIds, resumeIds.slice(0, MAX_WORKSPACE_RESUMES));
  assert.equal(mirror.activeResumeId, 'resume-1');
  assert.equal(mirror.meta['resume-11'], undefined);
});

test('cloud guest mirror includes resumes moved into the first ten rail positions', () => {
  const baseResumeIds = Array.from({ length: MAX_WORKSPACE_RESUMES + 4 }, (_, index) => `resume-${index + 1}`);
  const resumeIds = [
    ...baseResumeIds.slice(0, 7),
    'resume-14',
    ...baseResumeIds.slice(7, 13),
  ];
  const workspace = normalizeWorkspaceIndex({
    activeResumeId: 'resume-14',
    resumeIds,
    meta: Object.fromEntries(baseResumeIds.map((resumeId, index) => [
      resumeId,
      {
        name: `Resume ${index + 1}`,
        updatedAt: resumeId === 'resume-13'
          ? '2026-02-01T00:00:00.000Z'
          : `2026-01-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
      },
    ])),
  });
  const mirror = createGuestMirrorWorkspace(workspace);

  assert.equal(mirror.resumeIds.length, MAX_WORKSPACE_RESUMES);
  assert.deepEqual(mirror.resumeIds, [
    'resume-1',
    'resume-2',
    'resume-3',
    'resume-4',
    'resume-5',
    'resume-6',
    'resume-7',
    'resume-14',
    'resume-8',
    'resume-9',
  ]);
  assert.equal(mirror.activeResumeId, 'resume-14');
  assert.equal(mirror.meta['resume-13'], undefined);
});

test('cloud guest mirror backs up existing guest workspace without deleting non-recent draft keys', () => {
  const existingWorkspace = normalizeWorkspaceIndex({
    activeResumeId: 'guest-1',
    resumeIds: ['guest-1'],
    meta: {
      'guest-1': { name: 'Guest Resume', updatedAt: '2026-01-01T00:00:00.000Z' },
    },
  });
  const storage = createMemoryStorage([
    [WORKSPACE_INDEX_STORAGE_KEY, JSON.stringify(existingWorkspace)],
    [createResumeStorageKey('guest-1'), JSON.stringify({ savedAt: 'guest' })],
    [createResumeStorageKey('unrelated'), JSON.stringify({ savedAt: 'keep-me' })],
  ]);
  const cloudWorkspace = normalizeWorkspaceIndex({
    activeResumeId: 'cloud-1',
    resumeIds: ['cloud-1'],
    meta: {
      'cloud-1': { name: 'Cloud Resume', updatedAt: '2026-01-02T00:00:00.000Z' },
    },
  });
  const cloudDraft = {
    resume: createEmptyResume(),
    template: 'modern',
    sectionOrder: SECTION_IDS,
    savedAt: '2026-01-02T00:00:00.000Z',
  };

  persistCloudWorkspaceMirror({
    uid: 'user-1',
    workspace: cloudWorkspace,
    readDraft: (resumeId) => (resumeId === 'cloud-1' ? cloudDraft : null),
    storage,
  });
  persistCloudWorkspaceMirror({
    workspace: cloudWorkspace,
    readDraft: () => null,
    storage,
  });

  const backup = JSON.parse(storage.getItem(GUEST_WORKSPACE_CLOUD_MIRROR_BACKUP_KEY));
  const mirroredWorkspace = JSON.parse(storage.getItem(WORKSPACE_INDEX_STORAGE_KEY));
  const mirroredDraft = JSON.parse(storage.getItem(createResumeStorageKey('cloud-1')));
  const manifest = JSON.parse(storage.getItem(GUEST_WORKSPACE_CLOUD_MIRROR_MANIFEST_KEY));

  assert.equal(JSON.parse(backup.workspaceRaw).meta['guest-1'].name, 'Guest Resume');
  assert.equal(JSON.parse(backup.drafts['guest-1']).savedAt, 'guest');
  assert.equal(JSON.parse(storage.getItem(createResumeStorageKey('unrelated'))).savedAt, 'keep-me');
  assert.deepEqual(mirroredWorkspace.resumeIds, ['cloud-1']);
  assert.equal(mirroredDraft.savedAt, '2026-01-02T00:00:00.000Z');
  assert.deepEqual(manifest.resumeIds, ['cloud-1']);
  assert.equal(readCloudMirrorManifest('user-1', storage).activeResumeId, 'cloud-1');
  assert.equal(readCloudMirrorManifest('other-user', storage), null);
});

test('cloud draft mirror writes visible mirrored drafts without deleting older local drafts', () => {
  const storage = createMemoryStorage([
    [createResumeStorageKey('resume-2'), JSON.stringify({ savedAt: 'stale' })],
  ]);
  const resumeIds = [
    'resume-1',
    'resume-11',
    ...Array.from({ length: MAX_WORKSPACE_RESUMES - 1 }, (_, index) => `resume-${index + 2}`),
  ];
  const workspace = normalizeWorkspaceIndex({
    activeResumeId: 'resume-1',
    resumeIds,
    meta: Object.fromEntries(resumeIds.map((resumeId, index) => [
      resumeId,
      {
        name: `Resume ${index + 1}`,
        updatedAt: resumeId === 'resume-1'
          ? '2026-02-01T00:00:00.000Z'
          : `2026-01-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
      },
    ])),
  });
  const draft = {
    resume: createEmptyResume(),
    template: 'compact',
    sectionOrder: SECTION_IDS,
    savedAt: '2026-01-03T00:00:00.000Z',
  };

  persistCloudDraftMirror({
    uid: 'user-1',
    resumeId: 'resume-11',
    workspace,
    draft,
    storage,
  });

  assert.equal(JSON.parse(storage.getItem(createResumeStorageKey('resume-11'))).template, 'compact');
  assert.equal(JSON.parse(storage.getItem(createResumeStorageKey('resume-2'))).savedAt, 'stale');
  assert.deepEqual(JSON.parse(storage.getItem(WORKSPACE_INDEX_STORAGE_KEY)).resumeIds, [
    'resume-1',
    'resume-11',
    'resume-2',
    'resume-3',
    'resume-4',
    'resume-5',
    'resume-6',
    'resume-7',
    'resume-8',
    'resume-9',
  ]);

  persistCloudDraftMirror({
    uid: 'user-1',
    resumeId: 'resume-1',
    workspace,
    draft,
    storage,
  });

  assert.equal(JSON.parse(storage.getItem(createResumeStorageKey('resume-1'))).template, 'compact');
});

test('cloud mirror manifest refreshes after stale local workspace normalization', () => {
  const storage = createMemoryStorage([
    [GUEST_WORKSPACE_CLOUD_MIRROR_MANIFEST_KEY, JSON.stringify({
      uid: 'user-1',
      activeResumeId: 'resume-1',
      resumeIds: ['resume-1', 'resume-2'],
      updatedAt: '2026-01-01T00:00:00.000Z',
    })],
  ]);
  const workspace = normalizeWorkspaceIndex({
    activeResumeId: 'resume-11',
    resumeIds: ['resume-11', 'resume-10'],
    meta: {
      'resume-11': { name: 'Resume 11', updatedAt: '2026-02-01T00:00:00.000Z' },
      'resume-10': { name: 'Resume 10', updatedAt: '2026-01-31T00:00:00.000Z' },
    },
  });

  refreshCloudMirrorManifest(workspace, storage);

  assert.deepEqual(readCloudMirrorManifest('user-1', storage).resumeIds, ['resume-11', 'resume-10']);
  assert.equal(readCloudMirrorManifest('user-1', storage).activeResumeId, 'resume-11');
});

test('connected account helpers persist user-facing account context', () => {
  const storage = createMemoryStorage();
  const account = writeConnectedAccount({
    uid: 'user-1',
    email: 'person@example.com',
    displayName: 'Person Example',
  }, {
    trustedDevice: true,
    cacheMode: 'persistent',
  }, storage);

  assert.equal(account.email, 'person@example.com');
  assert.deepEqual(readConnectedAccount(storage), account);
});

test('signed-out editing preference defaults safely and persists choices', () => {
  const storage = createMemoryStorage();

  assert.deepEqual(readSignedOutEditingPreference(storage), DEFAULT_SIGNED_OUT_EDITING_PREFERENCE);

  const preference = writeSignedOutEditingPreference({
    allow: false,
    skipPrompt: true,
  }, storage);

  assert.deepEqual(preference, {
    allow: false,
    skipPrompt: true,
  });
  assert.deepEqual(readSignedOutEditingPreference(storage), preference);
});

test('local resume workspace detector sees draft data but ignores account-only settings', () => {
  const emptyStorage = createMemoryStorage([
    [CONNECTED_ACCOUNT_STORAGE_KEY, '{"uid":"user-1"}'],
    ['resumeloomr:theme', 'dark'],
  ]);
  const workspaceStorage = createMemoryStorage([
    [WORKSPACE_INDEX_STORAGE_KEY, '{}'],
  ]);
  const draftStorage = createMemoryStorage([
    [createResumeStorageKey('resume-1'), '{}'],
  ]);

  assert.equal(hasLocalResumeWorkspaceData(emptyStorage), false);
  assert.equal(hasLocalResumeWorkspaceData(workspaceStorage), true);
  assert.equal(hasLocalResumeWorkspaceData(draftStorage), true);
});

test('clearing local resume workspace data preserves account and preference settings', () => {
  const storage = createMemoryStorage([
    [WORKSPACE_INDEX_STORAGE_KEY, '{}'],
    [DRAFT_STORAGE_KEY, '{}'],
    [createResumeStorageKey('resume-1'), '{}'],
    [GUEST_WORKSPACE_CLOUD_MIRROR_BACKUP_KEY, '{}'],
    [GUEST_WORKSPACE_CLOUD_MIRROR_MANIFEST_KEY, '{}'],
    [CONNECTED_ACCOUNT_STORAGE_KEY, '{"uid":"user-1"}'],
    [SIGNED_OUT_EDITING_PREFERENCE_KEY, JSON.stringify({ allow: false, skipPrompt: true })],
    [`${LEGACY_CLOUD_IMPORT_PREFIX}user-1`, 'true'],
    [CLOUD_DEVICE_ID_KEY, 'device-1'],
    [CLOUD_TRUSTED_DEVICE_KEY, 'true'],
    ['resumeloomr:theme', 'dark'],
  ]);

  clearLocalResumeWorkspaceData(storage);

  assert.equal(storage.getItem(WORKSPACE_INDEX_STORAGE_KEY), null);
  assert.equal(storage.getItem(DRAFT_STORAGE_KEY), null);
  assert.equal(storage.getItem(createResumeStorageKey('resume-1')), null);
  assert.equal(storage.getItem(GUEST_WORKSPACE_CLOUD_MIRROR_MANIFEST_KEY), null);
  assert.equal(storage.getItem(`${LEGACY_CLOUD_IMPORT_PREFIX}user-1`), null);
  assert.equal(storage.getItem(CONNECTED_ACCOUNT_STORAGE_KEY), '{"uid":"user-1"}');
  assert.equal(storage.getItem(SIGNED_OUT_EDITING_PREFERENCE_KEY), JSON.stringify({ allow: false, skipPrompt: true }));
  assert.equal(storage.getItem(CLOUD_DEVICE_ID_KEY), 'device-1');
  assert.equal(storage.getItem(CLOUD_TRUSTED_DEVICE_KEY), 'true');
  assert.equal(storage.getItem('resumeloomr:theme'), 'dark');
});

test('clearing browser connection data removes resume and account keys only', () => {
  const storage = createMemoryStorage([
    [WORKSPACE_INDEX_STORAGE_KEY, '{}'],
    [DRAFT_STORAGE_KEY, '{}'],
    [createResumeStorageKey('resume-1'), '{}'],
    [GUEST_WORKSPACE_CLOUD_MIRROR_BACKUP_KEY, '{}'],
    [GUEST_WORKSPACE_CLOUD_MIRROR_MANIFEST_KEY, '{}'],
    [CONNECTED_ACCOUNT_STORAGE_KEY, '{}'],
    [SIGNED_OUT_EDITING_PREFERENCE_KEY, '{}'],
    [`${LEGACY_CLOUD_IMPORT_PREFIX}user-1`, 'true'],
    [CLOUD_DEVICE_ID_KEY, 'device-1'],
    [CLOUD_TRUSTED_DEVICE_KEY, 'true'],
    ['resumeloomr:theme', 'dark'],
  ]);
  const sessionStorage = createMemoryStorage([
    [CLOUD_SESSION_ID_KEY, 'session-1'],
  ]);

  clearBrowserResumeConnectionData({ storage, sessionStorage });

  assert.equal(storage.getItem(WORKSPACE_INDEX_STORAGE_KEY), null);
  assert.equal(storage.getItem(DRAFT_STORAGE_KEY), null);
  assert.equal(storage.getItem(createResumeStorageKey('resume-1')), null);
  assert.equal(storage.getItem(CONNECTED_ACCOUNT_STORAGE_KEY), null);
  assert.equal(storage.getItem(SIGNED_OUT_EDITING_PREFERENCE_KEY), null);
  assert.equal(storage.getItem(GUEST_WORKSPACE_CLOUD_MIRROR_MANIFEST_KEY), null);
  assert.equal(storage.getItem(CLOUD_DEVICE_ID_KEY), null);
  assert.equal(storage.getItem(CLOUD_TRUSTED_DEVICE_KEY), null);
  assert.equal(sessionStorage.getItem(CLOUD_SESSION_ID_KEY), null);
  assert.equal(storage.getItem('resumeloomr:theme'), 'dark');
});

test('normalizeResumeSettings clamps invalid values into the supported range', () => {
  assert.deepEqual(
    normalizeResumeSettings({
      textSize: 9,
      horizontalMargins: -12,
      verticalMargins: '2',
      lineSpacing: 'bad',
      sectionSpacing: 1.6
    }),
    {
      textSize: 5,
      horizontalMargins: -5,
      verticalMargins: 2,
      lineSpacing: 0,
      sectionSpacing: 2,
      entrySpacing: 0,
      headingSize: 0,
      nameSize: 0
    }
  );
});

test('preview model keeps dangerous-looking strings as plain text data', () => {
  const resume = createEmptyResume();
  const payload = `<script>alert("xss")</script><style>body{display:none}</style>`;

  resume.personal.name = payload;
  resume.personal.aboutMe = payload;
  resume.education[0].school = payload;
  resume.education[0].degree = payload;
  resume.education[0].yearsEdu = '2020-2024';
  resume.experience[0].company = payload;
  resume.experience[0].role = payload;
  resume.experience[0].yearsExp = '2024-Present';
  resume.experience[0].activities = [payload];

  const preview = getPreviewModel(resume);

  assert.equal(preview.personal.name, payload);
  assert.equal(preview.personal.aboutMe, payload);
  assert.equal(preview.educationEntries[0].school, payload);
  assert.equal(preview.educationEntries[0].degree, payload);
  assert.equal(preview.experienceEntries[0].company, payload);
  assert.equal(preview.experienceEntries[0].role, payload);
  assert.deepEqual(preview.experienceEntries[0].activities, [payload]);
});

test('app source does not use raw HTML execution sinks in src files', () => {
  const sourceFiles = collectSourceFiles(SRC_DIR);
  const dangerousPatterns = [
    { label: 'dangerouslySetInnerHTML', pattern: /dangerouslySetInnerHTML/ },
    { label: '.innerHTML', pattern: /\.innerHTML\b/ },
    { label: 'eval(', pattern: /\beval\s*\(/ },
    { label: 'new Function(', pattern: /\bnew\s+Function\s*\(/ },
    { label: 'srcdoc=', pattern: /\bsrcdoc\s*=/ },
  ];

  for (const filePath of sourceFiles) {
    const source = fs.readFileSync(filePath, 'utf8');

    for (const { label, pattern } of dangerousPatterns) {
      assert.equal(
        pattern.test(source),
        false,
        `Found ${label} in ${path.relative(TEST_FILE_DIR, filePath)}`
      );
    }
  }
});

test('signed-in resume storage relies on Firebase cache instead of an app-owned IndexedDB cache', () => {
  const libFiles = collectSourceFiles(path.resolve(SRC_DIR, 'lib'));

  for (const filePath of libFiles) {
    const source = fs.readFileSync(filePath, 'utf8');

    assert.equal(
      /window\.indexedDB|indexedDB\.open/.test(source),
      false,
      `Found app-owned IndexedDB usage in ${path.relative(TEST_FILE_DIR, filePath)}`
    );
  }
});

test('cloud session id is stored in sessionStorage, not shared localStorage', () => {
  const previousWindow = globalThis.window;
  const sessionValues = new Map();
  const localValues = new Map();

  globalThis.window = {
    sessionStorage: {
      getItem(key) {
        return sessionValues.get(key) || null;
      },
      setItem(key, value) {
        sessionValues.set(key, value);
      },
    },
    localStorage: {
      getItem(key) {
        return localValues.get(key) || null;
      },
      setItem(key, value) {
        localValues.set(key, value);
      },
    },
  };

  try {
    const sessionId = getCloudSessionId();

    assert.equal(getCloudSessionId(), sessionId);
    assert.equal(localValues.size, 0);
    assert.equal(sessionValues.size, 1);
  } finally {
    globalThis.window = previousWindow;
  }
});

test('cloud draft payload guard rejects oversized documents before Firestore writes', () => {
  assert.throws(
    () => validateCloudDraftPayload({
      resume: {
        settings: {},
        projects: [{ summary: 'x'.repeat(CLOUD_DRAFT_MAX_BYTES) }],
      },
    }),
    /too large/i,
  );
});

test('cloud draft docs preserve the source draft timestamp for stale write ordering', () => {
  const savedAt = '2026-06-24T12:34:56.000Z';
  const draftDoc = createCloudDraftDoc({
    resumeId: 'resume-imported',
    name: 'Imported Resume',
    draft: {
      resume: createEmptyResume(),
      template: 'modern',
      sectionOrder: SECTION_IDS,
      savedAt,
    },
    identity: {
      deviceId: 'device-1',
      sessionId: 'session-1',
    },
  });

  assert.equal(draftDoc.savedAt, savedAt);
  assert.equal(draftDoc.updatedAt, savedAt);
  assert.equal(draftDoc.version, Date.parse(savedAt));
});

test('cloud draft writes guard against older in-flight saves overwriting newer drafts', () => {
  const source = fs.readFileSync(path.resolve(SRC_DIR, 'lib/firebaseWorkspace.js'), 'utf8');
  const writeStart = source.indexOf('export async function writeCloudDraft(');
  const writeEnd = source.indexOf('export async function deleteCloudResume(', writeStart);
  const writeSource = source.slice(writeStart, writeEnd);

  assert.ok(writeStart > -1);
  assert.match(writeSource, /runTransaction\(/);
  assert.match(writeSource, /currentVersion\s*>\s*draftDoc\.version/);
  assert.match(writeSource, /staleWriteSkipped:\s*true/);
  assert.match(writeSource, /navigator\.onLine\s*===\s*false/);
  assert.match(writeSource, /writeBatch\(/);
});

test('cloud workspace writes replace the index document instead of merging stale meta keys', () => {
  const source = fs.readFileSync(path.resolve(SRC_DIR, 'lib/firebaseWorkspace.js'), 'utf8');
  const workspaceWriteLines = source
    .split('\n')
    .filter((line) => /(?:setDoc|batch\.set)\(\s*workspaceRef/.test(line));

  assert.ok(workspaceWriteLines.length > 0);
  workspaceWriteLines.forEach((line) => {
    assert.equal(
      /\{\s*merge:\s*true\s*\}/.test(line),
      false,
      'workspace/main writes must not use merge:true because stale meta keys break deletes',
    );
  });
});

test('builder source uses a per-resume cloud save queue instead of one global save timer', () => {
  const source = fs.readFileSync(path.resolve(SRC_DIR, 'hooks/useResumeBuilder.js'), 'utf8');

  assert.match(source, /cloudSaveQueueRef\s*=\s*useRef\(new Map\(\)\)/);
  assert.equal(/cloudSaveTimeoutRef|cloudForceSaveRef/.test(source), false);
});

test('builder prevents active resume id and editor draft body mismatches from autosaving', () => {
  const source = fs.readFileSync(path.resolve(SRC_DIR, 'hooks/useResumeBuilder.js'), 'utf8');
  const autosaveStart = source.indexOf('if (!hasMounted.current)');
  const autosaveEnd = source.indexOf('}, [activeResumeId', autosaveStart);
  const autosaveSource = source.slice(autosaveStart, autosaveEnd);
  const loadDraftStart = source.indexOf('function loadDraftIntoEditor(');
  const loadDraftEnd = source.indexOf('function persistActiveDraftImmediately', loadDraftStart);
  const loadDraftSource = source.slice(loadDraftStart, loadDraftEnd);
  const persistStart = source.indexOf('function persistActiveDraftImmediately(');
  const persistEnd = source.indexOf('function commitWorkspace(', persistStart);
  const persistSource = source.slice(persistStart, persistEnd);

  assert.match(source, /editorDraftResumeIdRef\s*=\s*useRef\(initialWorkspaceState\.workspace\.activeResumeId\)/);
  assert.match(loadDraftSource, /editorDraftResumeIdRef\.current = resumeId/);
  assert.match(autosaveSource, /editorDraftResumeIdRef\.current !== activeResumeId/);
  assert.match(persistSource, /editorDraftResumeIdRef\.current !== resumeId/);
});

test('builder switches resumes by loading the target local draft before awaiting cloud work', () => {
  const source = fs.readFileSync(path.resolve(SRC_DIR, 'hooks/useResumeBuilder.js'), 'utf8');
  const switchStart = source.indexOf('async function setActiveResume(');
  const switchEnd = source.indexOf('async function createResume()', switchStart);
  const switchSource = source.slice(switchStart, switchEnd);
  const localLoadIndex = switchSource.indexOf('loadDraftIntoEditor(localNextDraft, { resumeId: nextResumeId })');
  const previousFlushIndex = switchSource.indexOf('await flushCloudDraft(previousResumeId');

  assert.ok(switchStart > -1);
  assert.match(switchSource, /const switchRequestId = resumeSwitchRequestRef\.current \+ 1/);
  assert.ok(localLoadIndex > -1);
  assert.ok(previousFlushIndex > -1);
  assert.ok(localLoadIndex < previousFlushIndex);
  assert.match(switchSource, /activeResumeIdRef\.current !== nextResumeId/);
  assert.match(switchSource, /hasLocalDirty\(nextResumeId\)/);
  assert.match(switchSource, /resume: persistedPayload\.resume/);
});

test('builder cloud saves only update editor save state for the loaded resume', () => {
  const source = fs.readFileSync(path.resolve(SRC_DIR, 'hooks/useResumeBuilder.js'), 'utf8');
  const flushStart = source.indexOf('async function flushCloudDraft(');
  const flushEnd = source.indexOf('function markActiveDraftDirty()', flushStart);
  const flushSource = source.slice(flushStart, flushEnd);

  assert.ok(flushStart > -1);
  assert.match(flushSource, /draft = null/);
  assert.match(flushSource, /const draftToSave = draft \|\| getLatestKnownDraftForResume\(resumeId\)/);
  assert.match(flushSource, /if \(!draftToSave\)/);
  assert.match(flushSource, /activeResumeIdRef\.current === resumeId && editorDraftResumeIdRef\.current === resumeId/);
});

test('builder conflict detection is scoped to the active resume dirty state', () => {
  const source = fs.readFileSync(path.resolve(SRC_DIR, 'hooks/useResumeBuilder.js'), 'utf8');
  const listenerStart = source.indexOf('return subscribeCloudDraft(');
  const listenerEnd = source.indexOf('// The active resume listener should restart', listenerStart);
  const listenerSource = source.slice(listenerStart, listenerEnd);
  const deleteStart = source.indexOf('async function deleteActiveResume()');
  const deleteEnd = source.indexOf('function useCloudConflictVersion()', deleteStart);
  const deleteSource = source.slice(deleteStart, deleteEnd);

  assert.ok(listenerStart > -1);
  assert.match(source, /localDirtyResumeIdsRef\s*=\s*useRef\(new Set\(\)\)/);
  assert.doesNotMatch(source, /localDirtyRef/);
  assert.match(source, /const subscribedResumeId = activeResumeId/);
  assert.match(listenerSource, /activeResumeIdRef\.current !== subscribedResumeId/);
  assert.match(listenerSource, /hasLocalDirty\(subscribedResumeId\)/);
  assert.match(deleteSource, /clearResumeDirty\(deletedResumeId\)/);
});

test('builder resets stale dynamic section tabs when loading a different resume', () => {
  const source = fs.readFileSync(path.resolve(SRC_DIR, 'hooks/useResumeBuilder.js'), 'utf8');
  const loadDraftStart = source.indexOf('function loadDraftIntoEditor(');
  const loadDraftEnd = source.indexOf('function persistActiveDraftImmediately', loadDraftStart);
  const loadDraftSource = source.slice(loadDraftStart, loadDraftEnd);

  assert.match(source, /function getDraftEditorSectionIds\(draft\)/);
  assert.match(loadDraftSource, /const nextSectionIds = getDraftEditorSectionIds\(nextDraft\)/);
  assert.match(loadDraftSource, /!nextSectionIds\.includes\(activeTab\)/);
  assert.match(loadDraftSource, /setActiveTab\('personal'\)/);
});

test('resume rename is scoped by resume id and updates cloud metadata directly', () => {
  const builderSource = fs.readFileSync(path.resolve(SRC_DIR, 'hooks/useResumeBuilder.js'), 'utf8');
  const headerSource = fs.readFileSync(path.resolve(SRC_DIR, 'components/header.jsx'), 'utf8');
  const firebaseSource = fs.readFileSync(path.resolve(SRC_DIR, 'lib/firebaseWorkspace.js'), 'utf8');
  const renameStart = builderSource.indexOf('function renameResume(');
  const renameEnd = builderSource.indexOf('async function deleteActiveResume()', renameStart);
  const renameSource = builderSource.slice(renameStart, renameEnd);

  assert.ok(renameStart > -1);
  assert.match(headerSource, /onRenameResume\(renamingId, trimmedValue\)/);
  assert.match(renameSource, /const targetResumeId = resumeId \|\| activeResumeId;/);
  assert.match(renameSource, /withWorkspaceResumeMeta\(workspace, targetResumeId,/);
  assert.match(renameSource, /updatedAt: renamedAt,/);
  assert.match(renameSource, /renameCloudResume\(user\.uid, targetResumeId,/);
  assert.match(firebaseSource, /export async function renameCloudResume/);
  assert.match(firebaseSource, /batch\.set\(\s*workspaceRef,/);
  assert.match(firebaseSource, /batch\.set\(\s*draftRef,/);
});

test('new resumes receive an immediate timestamp for workspace metadata', () => {
  const source = fs.readFileSync(path.resolve(SRC_DIR, 'hooks/useResumeBuilder.js'), 'utf8');
  const createStart = source.indexOf('async function createResume()');
  const createEnd = source.indexOf('async function duplicateActiveResume()', createStart);
  const createSource = source.slice(createStart, createEnd);

  assert.ok(createStart > -1);
  assert.match(createSource, /const nextPayload = createDraftPayload\(/);
  assert.match(createSource, /const nextPersistedDraft = \{/);
  assert.match(createSource, /savedAt: nextPayload\.savedAt,/);
  assert.match(createSource, /createWorkspaceResumeMeta\(nextResumeName, nextPayload\.savedAt\)/);
  assert.match(createSource, /loadDraftIntoEditor\(nextPersistedDraft,/);
});

test('builder exposes import placeholder and draft replacement actions', () => {
  const source = fs.readFileSync(path.resolve(SRC_DIR, 'hooks/useResumeBuilder.js'), 'utf8');
  const placeholderStart = source.indexOf('function createImportPlaceholderResume(');
  const placeholderEnd = source.indexOf('async function replaceResumeDraft(', placeholderStart);
  const replaceStart = source.indexOf('async function replaceResumeDraft(');
  const replaceEnd = source.indexOf('async function duplicateActiveResume()', replaceStart);
  const placeholderSource = source.slice(placeholderStart, placeholderEnd);
  const replaceSource = source.slice(replaceStart, replaceEnd);

  assert.ok(placeholderStart > -1);
  assert.ok(replaceStart > -1);
  assert.match(placeholderSource, /createDraftPayload\(/);
  assert.match(placeholderSource, /createWorkspaceResumeMeta\(nextResumeName, nextPayload\.savedAt\)/);
  assert.match(placeholderSource, /mirrorCloudDraftLocally\(nextResumeId, nextWorkspace, nextPersistedDraft\)/);
  assert.doesNotMatch(placeholderSource, /flushCloudDraft\(nextResumeId/);
  assert.doesNotMatch(placeholderSource, /writeCloudDraft\(\s*user\.uid,\s*nextResumeId/);
  assert.match(placeholderSource, /writeCloudDraft\(\s*user\.uid,\s*previousResumeId,\s*nextWorkspace/);
  assert.match(placeholderSource, /return nextResumeId/);
  assert.match(replaceSource, /normalizeDraftPayload\(importedDraft\)/);
  assert.match(replaceSource, /createDraftPayload\(/);
  assert.match(replaceSource, /persistExistingDraftState\(resumeId, nextDraft\)/);
  assert.match(replaceSource, /mirrorCloudDraftLocally\(resumeId, nextWorkspace, nextDraft\)/);
  assert.match(replaceSource, /markResumeDirty\(resumeId\)/);
  assert.match(replaceSource, /flushCloudDraft\(resumeId, nextWorkspace, nextDraft,/);
});

test('builder reloads the local mirrored workspace when signing out of cloud mode', () => {
  const source = fs.readFileSync(path.resolve(SRC_DIR, 'hooks/useResumeBuilder.js'), 'utf8');
  const signOutBranchStart = source.indexOf('if (!user) {');
  const signOutBranchEnd = source.indexOf('return undefined;', signOutBranchStart);
  const signOutBranchSource = source.slice(signOutBranchStart, signOutBranchEnd);

  assert.ok(signOutBranchStart > -1);
  assert.match(source, /wasCloudModeRef\s*=\s*useRef\(false\)/);
  assert.match(signOutBranchSource, /if \(wasCloudModeRef\.current\)/);
  assert.match(signOutBranchSource, /const storedWorkspace = loadStoredWorkspace\(\)/);
  assert.match(signOutBranchSource, /commitWorkspace\(storedWorkspace\.workspace\)/);
  assert.match(signOutBranchSource, /loadDraftIntoEditor\(storedWorkspace\.draft, \{ resumeId: storedWorkspace\.activeResumeId \}\)/);
  assert.match(signOutBranchSource, /wasCloudModeRef\.current = false/);
});

test('builder normalizes stale local workspaces to the first ten without deleting hidden drafts', () => {
  const source = fs.readFileSync(path.resolve(SRC_DIR, 'hooks/useResumeBuilder.js'), 'utf8');
  const loadStart = source.indexOf('function loadStoredWorkspace()');
  const loadEnd = source.indexOf('function formatSavedAt(', loadStart);
  const loadSource = source.slice(loadStart, loadEnd);

  assert.ok(loadStart > -1);
  assert.match(source, /createGuestMirrorWorkspace,/);
  assert.doesNotMatch(source, /function pruneStoredResumeDraftsToWorkspace\(workspace\)/);
  assert.match(loadSource, /const localWorkspace = createGuestMirrorWorkspace\(normalizedWorkspace\)/);
  assert.match(loadSource, /persistWorkspaceIndex\(localWorkspace\)/);
  assert.match(loadSource, /refreshCloudMirrorManifest\(localWorkspace\)/);
  assert.doesNotMatch(loadSource, /removeItem\(createResumeStorageKey/);
  assert.match(loadSource, /workspace: localWorkspace,/);
});

test('builder reconciles signed-out local workspace changes on every sign-in', () => {
  const source = fs.readFileSync(path.resolve(SRC_DIR, 'hooks/useResumeBuilder.js'), 'utf8');
  const bootstrapStart = source.indexOf('async function bootstrapCloudWorkspace()');
  const bootstrapEnd = source.indexOf('if (cancelled || !nextWorkspace)', bootstrapStart);
  const bootstrapSource = source.slice(bootstrapStart, bootstrapEnd);

  assert.ok(bootstrapStart > -1);
  assert.match(bootstrapSource, /readCloudMirrorManifest\(uid\)/);
  assert.match(bootstrapSource, /syncLocalWorkspaceToCloud\(/);
  assert.doesNotMatch(bootstrapSource, /hasImportedGuestWorkspace/);
  assert.doesNotMatch(source, /export async function appendWorkspaceToCloud/);
});

test('builder delete waits for online cloud delete before local removal', () => {
  const source = fs.readFileSync(path.resolve(SRC_DIR, 'hooks/useResumeBuilder.js'), 'utf8');
  const deleteStart = source.indexOf('async function deleteActiveResume()');
  const deleteEnd = source.indexOf('function useCloudConflictVersion()', deleteStart);
  const deleteSource = source.slice(deleteStart, deleteEnd);

  assert.ok(deleteStart > -1);
  assert.ok(deleteSource.indexOf('deleteCloudResume(') < deleteSource.indexOf('window.localStorage.removeItem'));
  assert.ok(deleteSource.includes('if (!cloudDeleteSucceeded && isOnline())'));
});

test('successful cloud mutations settle the syncing status', () => {
  const source = fs.readFileSync(path.resolve(SRC_DIR, 'hooks/useResumeBuilder.js'), 'utf8');
  const mutationStart = source.indexOf('function runCloudMutation(');
  const mutationEnd = source.indexOf('function mirrorCloudWorkspaceLocally', mutationStart);
  const mutationSource = source.slice(mutationStart, mutationEnd);
  const deleteStart = source.indexOf('async function deleteActiveResume()');
  const deleteEnd = source.indexOf('function useCloudConflictVersion()', deleteStart);
  const deleteSource = source.slice(deleteStart, deleteEnd);

  assert.ok(mutationStart > -1);
  assert.match(source, /function settleCloudSyncState\(\)/);
  assert.match(mutationSource, /setSyncState\('syncing'\)/);
  assert.match(mutationSource, /settleCloudSyncState\(\)/);
  assert.ok(deleteSource.indexOf('clearResumeDirty(deletedResumeId)') < deleteSource.indexOf('settleCloudSyncState()'));
});

test('conflict copy keeps the conflicted resume active instead of activating the copy', () => {
  const source = fs.readFileSync(path.resolve(SRC_DIR, 'hooks/useResumeBuilder.js'), 'utf8');
  const conflictCopyStart = source.indexOf('async function saveConflictAsCopy()');
  const conflictCopyEnd = source.indexOf('const actions = {', conflictCopyStart);
  const conflictCopySource = source.slice(conflictCopyStart, conflictCopyEnd);

  assert.ok(conflictCopyStart > -1);
  assert.match(conflictCopySource, /const originalResumeId = conflict\.resumeId \|\| activeResumeId;/);
  assert.match(conflictCopySource, /activeResumeId: originalResumeId,/);
  assert.doesNotMatch(conflictCopySource, /activeResumeId: nextResumeId,/);
});

test('app gates account switching before cloud bootstrap can import browser resumes', () => {
  const source = fs.readFileSync(path.resolve(SRC_DIR, '../src/App.jsx'), 'utf8');

  assert.match(source, /preSignInConnectedAccountRef\s*=\s*useRef\(readConnectedAccount\(\)\)/);
  assert.match(source, /const isAccountSwitchPending = Boolean\(/);
  assert.match(source, /hasLocalResumeWorkspaceData\(\)/);
  assert.match(source, /const builderUser = isAccountSwitchPending \? null : auth\.user/);
  assert.match(source, /user: builderUser,/);
  assert.match(source, /<AccountSwitchPrompt/);
});

test('sign out and disconnect do not clear browser resumes when cloud flush fails', () => {
  const source = fs.readFileSync(path.resolve(SRC_DIR, '../src/App.jsx'), 'utf8');
  const signOutStart = source.indexOf('async function completeSignOut(');
  const signOutEnd = source.indexOf('async function handleSignOut()', signOutStart);
  const signOutSource = source.slice(signOutStart, signOutEnd);
  const disconnectStart = source.indexOf('async function handleDisconnectBrowser()');
  const disconnectEnd = source.indexOf('function handleOpenAuthFromSettings()', disconnectStart);
  const disconnectSource = source.slice(disconnectStart, disconnectEnd);

  assert.ok(signOutStart > -1);
  assert.match(signOutSource, /const flushedDraft = await flushActiveCloudDraft\(\{ reason: 'signout' \}\)/);
  assert.ok(signOutSource.indexOf('if (auth.user && !flushedDraft)') < signOutSource.indexOf('clearLocalResumeWorkspaceData()'));
  assert.match(disconnectSource, /const flushedDraft = await flushActiveCloudDraft\(\{ reason: 'disconnect-browser' \}\)/);
  assert.ok(disconnectSource.indexOf('if (!flushedDraft)') < disconnectSource.indexOf('clearBrowserResumeConnectionData()'));
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

test('reorderSectionOrder keeps personal fixed while dragging sections into place', () => {
  const baseOrder = ['personal', 'education', 'experience', 'skills', 'projects'];

  assert.deepEqual(
    reorderSectionOrder(baseOrder, 'projects', 'experience', 'before').slice(0, 5),
    ['personal', 'education', 'projects', 'experience', 'skills']
  );
  assert.deepEqual(
    reorderSectionOrder(baseOrder, 'education', 'projects', 'after').slice(0, 5),
    ['personal', 'experience', 'skills', 'projects', 'education']
  );
  assert.deepEqual(
    reorderSectionOrder(baseOrder, 'personal', 'projects', 'after').slice(0, 5),
    ['personal', 'education', 'experience', 'skills', 'projects']
  );
  assert.equal(reorderSectionOrder(baseOrder, 'projects', 'personal', 'before')[0], 'personal');
});

test('reorderSectionOrderToMatch keeps personal fixed and rejects invalid exact orders', () => {
  const baseOrder = SECTION_IDS;
  const reorderedOrder = [
    'projects',
    ...SECTION_IDS.filter((sectionId) => sectionId !== 'personal' && sectionId !== 'projects'),
  ];

  assert.deepEqual(
    reorderSectionOrderToMatch(baseOrder, reorderedOrder).slice(0, 5),
    ['personal', 'projects', 'education', 'experience', 'skills']
  );
  assert.deepEqual(
    reorderSectionOrderToMatch(baseOrder, ['projects', 'education', 'skills']),
    baseOrder
  );
  assert.deepEqual(
    reorderSectionOrderToMatch(baseOrder, ['projects', 'education', 'skills', 'missing']),
    baseOrder
  );
});

test('reorderResumeSectionBlocksToMatch reorders block sections and preserves legacy mirrors', () => {
  const draft = normalizeDraftPayload({
    resume: {
      sections: [
        {
          id: 'education-block',
          kind: 'education',
          title: 'Education',
          entries: [{ id: 'edu-1', institution: 'UGA', degree: 'BBA' }],
        },
        {
          id: 'experience-block',
          kind: 'roles',
          title: 'Experience',
          entries: [{ id: 'role-1', company: 'Acme', role: 'Analyst', activities: ['Built reports'] }],
        },
        {
          id: 'skills-block',
          kind: 'skills',
          title: 'Skills',
          entries: [{ id: 'skills-1', category: 'Tools', items: 'Excel' }],
        },
      ],
    },
  });
  const reordered = reorderResumeSectionBlocksToMatch(draft.resume, [
    'skills-block',
    'experience-block',
    'education-block',
  ]);

  assert.deepEqual(reordered.sections.map((section) => section.id), [
    'skills-block',
    'experience-block',
    'education-block',
  ]);
  assert.equal(reordered.sections[1].entries[0].company, 'Acme');
  assert.deepEqual(
    reorderResumeSectionBlocksToMatch(draft.resume, ['skills-block', 'experience-block']).sections.map((section) => section.id),
    draft.resume.sections.map((section) => section.id)
  );
});

test('updateResumeSetting clamps stepper values to the supported range', () => {
  let resume = createEmptyResume();

  resume = updateResumeSetting(resume, 'textSize', 3);
  resume = updateResumeSetting(resume, 'textSize', 4);
  resume = updateResumeSetting(resume, 'horizontalMargins', -7);

  assert.equal(resume.settings.textSize, 5);
  assert.equal(resume.settings.horizontalMargins, -5);
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
  resume.experience[0].groupLabel = 'Professional Experience';
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
  assert.equal(previewModel.experienceEntries[0].groupLabel, 'Professional Experience');
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
  assert.equal(normalized.resume.settings.textSize, 0);
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

test('legacy single-draft payload migrates into a workspace named Resume 1', () => {
  const migrated = createWorkspaceFromLegacyDraft({
    savedAt: '2026-03-26T14:00:00.000Z',
    template: 'executive',
    sectionOrder: ['experience', 'personal', 'education'],
    resume: {
      personal: { name: 'Jordan' },
      education: [],
      experience: []
    }
  });

  assert.equal(WORKSPACE_INDEX_STORAGE_KEY, 'resumeloomr:index:v1');
  assert.equal(migrated.workspace.resumeIds.length, 1);
  assert.equal(migrated.workspace.activeResumeId, migrated.activeResumeId);
  assert.equal(migrated.workspace.meta[migrated.activeResumeId].name, 'Resume 1');
  assert.equal(migrated.draft.template, 'executive');
  assert.equal(migrated.draft.resume.personal.name, 'Jordan');
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

test('presentation helpers map settings into preview vars and print margins', () => {
  const styles = getResumePresentationVars({
    textSize: 2,
    horizontalMargins: 1,
    verticalMargins: -1,
    lineSpacing: 1,
    sectionSpacing: -1,
    entrySpacing: 2,
    headingSize: 1,
    nameSize: -1
  }, 'modern');

  assert.equal(styles['--resume-page-margin-inline'], '0.54in');
  assert.equal(styles['--resume-page-margin-top'], '0.46in');
  assert.equal(styles['--resume-name-size'], '1.425rem');
  assert.equal(styles['--resume-heading-size'], '0.6563rem');
  assert.equal(styles['--resume-body-size'], '0.795rem');
  assert.equal(styles['--resume-section-gap'], '8px');
  assert.equal(styles['--resume-entry-gap'], '12px');
  assert.equal(styles['--resume-print-min-height'], '10.08in');

  assert.equal(
    getResumePrintPageRule({ horizontalMargins: 1, verticalMargins: -1 }, 'modern'),
    '@page { margin: 0.46in 0.54in 0.46in 0.54in; }'
  );
});
