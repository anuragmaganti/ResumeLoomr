import { trimText } from '../src/lib/text.js';
import { compileCoverLetterSourceDocument } from './coverLetterImport/compiler.js';
import {
  createCoverLetterDocumentGeminiContents,
  createCoverLetterImageGeminiContents,
  createCoverLetterTextGeminiContents,
  coverLetterSourceResponseJsonSchema,
  generateCoverLetterSourceFromGemini,
} from './coverLetterImport/geminiSource.js';
import {
  assessCoverLetterSourceDocument,
  createCoverLetterSourceDocumentFromText,
} from './coverLetterImport/sourceDocument.js';
import { ImportResumeError } from './resumeImport/error.js';
import { extractDocxText, extractPdfText } from './resumeImport/fileText.js';
import {
  DEFAULT_GEMINI_IMPORT_MODEL,
  createGeminiClient,
  createGeminiImportGenerationConfig,
} from './resumeImport/geminiProvider.js';
import { DOCX_MIME_TYPE, PDF_MIME_TYPE, isImageMimeType } from './resumeImport/filePayload.js';

function createDiagnostics(file, model, sourceMode) {
  return {
    phase: 'cover-letter-source',
    model,
    sourceMode,
    fileName: trimText(file.fileName).slice(0, 120),
    mimeType: file.mimeType,
    fileSizeBytes: file.size || file.buffer?.length || 0,
  };
}

async function generateVisualSource({ ai, model, file, generationConfig, sourceMode, createContents }) {
  return generateCoverLetterSourceFromGemini({
    ai,
    model,
    file,
    generationConfig,
    diagnostics: createDiagnostics(file, model, sourceMode),
    createContents,
  });
}

export async function parseCoverLetterWithGemini(file, { resumeId = '' } = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new ImportResumeError('Gemini is not configured.', {
      statusCode: 500,
      code: 'import/gemini-missing',
      expose: false,
    });
  }

  const ai = createGeminiClient(apiKey);
  const model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_IMPORT_MODEL;
  const generationConfig = createGeminiImportGenerationConfig(model, process.env, {
    responseJsonSchema: coverLetterSourceResponseJsonSchema,
  });
  const warnings = [];
  let sourceDocument;
  let sourceMode;

  if (file.mimeType === PDF_MIME_TYPE) {
    const text = await extractPdfText(file);
    const textSource = createCoverLetterSourceDocumentFromText(text);
    if (text && assessCoverLetterSourceDocument(textSource).isUsable) {
      sourceDocument = textSource;
      sourceMode = 'pdf-text';
    } else {
      sourceMode = 'pdf-document';
      warnings.push('Some cover letter details may need review because selectable PDF text was unavailable.');
      sourceDocument = await generateVisualSource({
        ai,
        model,
        file,
        generationConfig,
        sourceMode,
        createContents: createCoverLetterDocumentGeminiContents,
      });
    }
  } else if (isImageMimeType(file.mimeType)) {
    sourceMode = 'image-document';
    warnings.push('Some cover letter details may need review because image text could not be verified independently.');
    sourceDocument = await generateVisualSource({
      ai,
      model,
      file,
      generationConfig,
      sourceMode,
      createContents: createCoverLetterImageGeminiContents,
    });
  } else if (file.mimeType === DOCX_MIME_TYPE) {
    const text = await extractDocxText(file);
    sourceDocument = createCoverLetterSourceDocumentFromText(text);
    sourceMode = 'docx-text';
    if (!assessCoverLetterSourceDocument(sourceDocument).isUsable && text) {
      sourceMode = 'docx-text-layout';
      sourceDocument = await generateVisualSource({
        ai,
        model,
        file: { ...file, text },
        generationConfig,
        sourceMode,
        createContents: createCoverLetterTextGeminiContents,
      });
    }
  }

  const assessment = assessCoverLetterSourceDocument(sourceDocument);
  if (!assessment.isUsable) {
    throw new ImportResumeError('The uploaded cover letter did not contain readable letter content.', {
      statusCode: 422,
      code: 'import/no-readable-cover-letter',
    });
  }
  if (assessment.isLikelyResume) {
    throw new ImportResumeError('This file looks like a resume, not a cover letter. Confirm the file slot and try again.', {
      statusCode: 409,
      code: 'import/document-kind-mismatch',
    });
  }

  const compiled = compileCoverLetterSourceDocument(sourceDocument, {
    resumeId,
    sourceFileName: file.fileName,
  });

  return {
    ...compiled,
    documentKind: 'coverLetter',
    diagnostics: {
      ...createDiagnostics(file, model, sourceMode),
      coverSignalCount: assessment.coverSignalCount,
      resumeHeadingCount: assessment.resumeHeadingCount,
    },
    draft: {
      ...compiled.draft,
      importWarnings: warnings,
    },
  };
}

