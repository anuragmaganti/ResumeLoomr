import { trimText } from '../src/lib/text.js';
import { compileSourceDocumentToImportedDraft } from './resumeImport/compiler.js';
import { validateImportedDraftCoverage } from './resumeImport/coverage.js';
import { ImportResumeError } from './resumeImport/error.js';
import {
  assessExtractedResumeText,
  extractDocxText,
  extractPdfText,
} from './resumeImport/fileText.js';
import {
  DEFAULT_GEMINI_IMPORT_MODEL,
  createGeminiClient,
  createGeminiImportGenerationConfig,
} from './resumeImport/geminiProvider.js';
import {
  createImageSourceDocumentGeminiContents,
  createTextSourceDocumentGeminiContents,
  generateSourceDocumentFromGemini,
  generateSourceMappingFromGemini,
  sourceDocumentResponseJsonSchema,
  sourceMappingResponseJsonSchema,
} from './resumeImport/geminiSource.js';
import {
  DOCX_MIME_TYPE,
  PDF_MIME_TYPE,
  isImageMimeType,
} from './resumeImport/filePayload.js';
import {
  createSourceDocumentCoverage,
  createSourceDocumentFromText,
  shouldUseVisualPdfFallbackForSourceText,
  sourceDocumentToText,
  summarizeSourceDocument,
} from './resumeImport/sourceDocument.js';

export { verifyFirebaseIdToken } from './resumeImport/auth.js';
export { ImportResumeError } from './resumeImport/error.js';
export {
  DEFAULT_GEMINI_IMPORT_MODEL,
  DEFAULT_GEMINI_THINKING_LEVEL,
  createGeminiImportGenerationConfig,
} from './resumeImport/geminiProvider.js';
export {
  IMPORT_FILE_MAX_BYTES,
  normalizeImportFilePayload,
} from './resumeImport/filePayload.js';
export { assessExtractedResumeText } from './resumeImport/fileText.js';
export { compileSourceDocumentToImportedDraft } from './resumeImport/compiler.js';
export { createImageSourceDocumentGeminiContents } from './resumeImport/geminiSource.js';
export { validateImportedDraftCoverage } from './resumeImport/coverage.js';
export {
  createImportResponseBody,
  parseImportRequestBody,
} from './resumeImport/http.js';
export {
  createSourceDocumentCoverage,
  createSourceDocumentFromText,
  shouldUseVisualPdfFallbackForSourceText,
} from './resumeImport/sourceDocument.js';

function createSourceDocumentDiagnostics(file, model, sourceMode) {
  return {
    phase: 'source-document',
    model,
    sourceMode,
    fileName: trimText(file.fileName).slice(0, 120),
    mimeType: file.mimeType,
    fileSizeBytes: file.size || file.buffer?.length || 0,
  };
}

function generateVisualSourceDocument({
  ai,
  model,
  file,
  generationConfig,
  sourceMode,
  createContents,
  diagnosticsFile = file,
}) {
  return generateSourceDocumentFromGemini({
    ai,
    model,
    file,
    generationConfig,
    ...(createContents ? { createContents } : {}),
    diagnostics: createSourceDocumentDiagnostics(diagnosticsFile, model, sourceMode),
  });
}

export async function parseResumeWithGemini(file) {
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
  const visualSourceDocumentGenerationConfig = createGeminiImportGenerationConfig(model, process.env, {
    responseJsonSchema: sourceDocumentResponseJsonSchema,
  });
  const sourceMappingGenerationConfig = createGeminiImportGenerationConfig(model, process.env, {
    responseJsonSchema: sourceMappingResponseJsonSchema,
  });
  const isPdf = file.mimeType === PDF_MIME_TYPE;
  const isImage = isImageMimeType(file.mimeType);
  let sourceText;
  let sourceMode;
  let extractionDiagnostics = null;
  let sourceDocument;
  let sourceMapping = null;
  let mappingDiagnostics = null;
  const importWarnings = [];

  if (isPdf) {
    const extractedPdfText = await extractPdfText(file);
    const extractedPdfAssessment = assessExtractedResumeText(extractedPdfText);
    extractionDiagnostics = {
      isTrustworthy: extractedPdfAssessment.isTrustworthy,
      characters: extractedPdfAssessment.text.length,
      nonWhitespaceCharacters: extractedPdfAssessment.nonWhitespaceCharacters,
      wordCount: extractedPdfAssessment.wordCount,
      printableRatio: Number(extractedPdfAssessment.printableRatio.toFixed(3)),
      resumeSignalCount: extractedPdfAssessment.resumeSignalCount,
    };

    if (extractedPdfAssessment.isTrustworthy) {
      sourceText = extractedPdfAssessment.text;
      sourceMode = 'pdf-text';
      sourceDocument = createSourceDocumentFromText(sourceText);

      if (shouldUseVisualPdfFallbackForSourceText(sourceText, sourceDocument)) {
        sourceMode = 'pdf-text-layout';
        sourceDocument = await generateVisualSourceDocument({
          ai,
          model,
          file: {
            fileName: file.fileName,
            text: sourceText,
          },
          generationConfig: visualSourceDocumentGenerationConfig,
          sourceMode,
          createContents: createTextSourceDocumentGeminiContents,
          diagnosticsFile: file,
        });
        sourceText = sourceDocumentToText(sourceDocument);
      }
    } else {
      importWarnings.push('Some sections may need review because this PDF could not be verified from selectable text.');
      sourceMode = 'pdf-document';
      sourceDocument = await generateVisualSourceDocument({
        ai,
        model,
        file,
        generationConfig: visualSourceDocumentGenerationConfig,
        sourceMode,
      });
      sourceText = sourceDocumentToText(sourceDocument);
    }
  } else if (isImage) {
    importWarnings.push('Some sections may need review because this image resume could not be verified from selectable text.');
    sourceMode = 'image-document';
    sourceDocument = await generateVisualSourceDocument({
      ai,
      model,
      file,
      generationConfig: visualSourceDocumentGenerationConfig,
      sourceMode,
      createContents: createImageSourceDocumentGeminiContents,
    });
    sourceText = sourceDocumentToText(sourceDocument);
  } else {
    sourceText = await extractDocxText(file);

    if (!sourceText) {
      throw new ImportResumeError('The DOCX file did not contain readable text.', {
        statusCode: 422,
        code: 'import/no-readable-text',
      });
    }

    sourceMode = 'docx-text';
    sourceDocument = createSourceDocumentFromText(sourceText);
  }

  if (!sourceDocument?.hasSourceText) {
    throw new ImportResumeError('The uploaded resume did not contain readable resume content.', {
      statusCode: 422,
      code: 'import/no-readable-text',
    });
  }

  const sourceCoverage = createSourceDocumentCoverage(sourceDocument);

  const importDiagnostics = {
    model,
    sourceDocumentThinkingLevel: visualSourceDocumentGenerationConfig.thinkingConfig?.thinkingLevel,
    sourceMappingThinkingLevel: sourceMappingGenerationConfig.thinkingConfig?.thinkingLevel,
    maxOutputTokens: sourceMappingGenerationConfig.maxOutputTokens,
    fileName: trimText(file.fileName).slice(0, 120),
    mimeType: file.mimeType,
    fileSizeBytes: file.size || file.buffer?.length || 0,
    sourceMode,
    sourceTextCharacters: sourceText.length,
    sourceDocument: summarizeSourceDocument(sourceDocument),
    sourceCoverage,
    extraction: extractionDiagnostics,
  };

  try {
    sourceMapping = await generateSourceMappingFromGemini({
      ai,
      model,
      sourceFileName: file.fileName,
      sourceDocument,
      generationConfig: sourceMappingGenerationConfig,
      diagnostics: {
        ...importDiagnostics,
        phase: 'source-mapping',
      },
    });
  } catch (error) {
    if (!(error instanceof ImportResumeError) || error.code !== 'import/invalid-source-mapping') {
      throw error;
    }

    mappingDiagnostics = error.diagnostics || null;
    importWarnings.push('Some sections may need review because the AI could not classify every source section.');
  }

  const parsedImport = compileSourceDocumentToImportedDraft(sourceDocument, sourceMapping, { sourceFileName: file.fileName });
  const coverageValidation = validateImportedDraftCoverage(parsedImport.draft, sourceCoverage);

  if (!coverageValidation.ok) {
    importWarnings.push('Some sections may need review because the import could not verify every source detail.');
  }

  return {
    ...parsedImport,
    diagnostics: {
      ...importDiagnostics,
      mappingDiagnostics,
      coverageOk: coverageValidation.ok,
      coverageIssueCount: coverageValidation.issues.length,
      coverageIssues: coverageValidation.issues,
    },
    draft: {
      ...parsedImport.draft,
      importWarnings: Array.from(new Set(importWarnings)),
    },
  };
}
