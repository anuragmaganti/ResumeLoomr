import { parseCoverLetterWithGemini } from './importCoverLetter.js';
import { parseResumeWithGemini } from './importResume.js';
import { ImportResumeError } from './resumeImport/error.js';

function normalizeImportDocumentKind(value) {
  if (value === 'resume') return 'resume';
  if (value === 'coverLetter') return 'coverLetter';
  throw new ImportResumeError('Choose whether this file is a resume or cover letter.', {
    statusCode: 400,
    code: 'import/invalid-document-kind',
  });
}

export async function parseImportedDocument(file, { documentKind, resumeId = '' } = {}) {
  const kind = normalizeImportDocumentKind(documentKind);
  const parsed = kind === 'coverLetter'
    ? await parseCoverLetterWithGemini(file, { resumeId })
    : await parseResumeWithGemini(file);

  return { ...parsed, documentKind: kind };
}
