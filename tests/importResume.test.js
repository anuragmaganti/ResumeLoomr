import test from 'node:test';
import assert from 'node:assert/strict';

import { validateImportResumeFile } from '../src/lib/importResume.js';
import {
  IMPORT_FILE_ACCEPT,
  normalizeResumeImportMimeType,
} from '../src/lib/importFileTypes.js';
import { getPreviewModel } from '../src/lib/resumePreviewModel.js';
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
import { parseImportRequestBody } from '../server/resumeImport/http.js';

test('import request parsing maps malformed and oversized JSON to import errors', async () => {
  await assert.rejects(
    parseImportRequestBody({ body: '{invalid' }),
    (error) => error?.statusCode === 400 && error?.code === 'import/invalid-json',
  );
  await assert.rejects(
    parseImportRequestBody({ body: 'x'.repeat(IMPORT_FILE_MAX_BYTES * 2) }),
    (error) => error?.statusCode === 413 && error?.code === 'import/file-too-large',
  );
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

test('shared import type contract preserves browser and server normalization rules', () => {
  assert.match(IMPORT_FILE_ACCEPT, /\.pdf/);
  assert.match(IMPORT_FILE_ACCEPT, /image\/jpeg/);
  assert.equal(normalizeResumeImportMimeType('resume.JPG', 'APPLICATION/OCTET-STREAM'), 'image/jpeg');
  assert.equal(normalizeResumeImportMimeType('', 'image/png'), 'image/png');
  assert.equal(normalizeResumeImportMimeType('', 'image/png', { allowMimeOnly: false }), '');
  assert.equal(normalizeResumeImportMimeType('resume.png', 'application/pdf'), '');
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

test('source document compiler preserves explicit summary headings and enables them', () => {
  ['Summary', 'Profile', 'Objective'].forEach((title) => {
    const result = compileSourceDocumentToImportedDraft({
      personalLines: ['Jane Doe', 'jane@example.com'],
      sections: [
        {
          id: `source-${title.toLowerCase()}-1`,
          title,
          lines: ['Product engineer with experience building reliable web applications.'],
        },
      ],
    }, null, { sourceFileName: 'jane.pdf' });

    assert.equal(result.draft.resume.personal.aboutMe, 'Product engineer with experience building reliable web applications.');
    assert.equal(result.draft.resume.personal.summaryTitle, title);
    assert.equal(result.draft.resume.settings.showSummaryTitle, true);
  });
});

test('source document compiler leaves unheaded personal summaries untitled', () => {
  const result = compileSourceDocumentToImportedDraft({
    personalLines: [
      'Jane Doe',
      'jane@example.com',
      'Product engineer with experience building reliable web applications.',
    ],
    sections: [],
  }, null, { sourceFileName: 'jane.pdf' });

  assert.equal(result.draft.resume.settings.showSummaryTitle, false);
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
