import {
  IMPORT_FILE_MAX_BYTES,
  IMPORT_FILE_MAX_MEGABYTES,
  IMPORT_FILE_TYPES_LABEL,
  normalizeResumeImportMimeType,
} from './importFileTypes.js';

export function validateImportDocumentFile(file, label = 'document') {
  if (!file) return `Choose a ${IMPORT_FILE_TYPES_LABEL} ${label} first.`;
  if (!normalizeResumeImportMimeType(file.name, file.type, { allowMimeOnly: false })) {
    return `Upload a ${IMPORT_FILE_TYPES_LABEL} ${label} file.`;
  }
  if (file.size <= 0) return 'The selected file is empty.';
  if (file.size > IMPORT_FILE_MAX_BYTES) {
    return `Upload a ${label} smaller than ${IMPORT_FILE_MAX_MEGABYTES} MB.`;
  }
  return '';
}
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result.includes(',') ? result.split(',').pop() : result);
    };
    reader.onerror = () => reject(new Error('The selected file could not be read.'));
    reader.readAsDataURL(file);
  });
}

export async function importDocumentFile({ file, documentKind, idToken, resumeId = '' }) {
  const label = documentKind === 'coverLetter' ? 'cover letter' : 'resume';
  const validationError = validateImportDocumentFile(file, label);
  if (validationError) throw new Error(validationError);

  const fileDataBase64 = await readFileAsBase64(file);
  const response = await fetch('/api/import-document', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      documentKind,
      resumeId,
      fileName: file.name,
      mimeType: file.type,
      fileDataBase64,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error?.message || `${label} import failed. Try another file.`);
    error.code = payload?.error?.code || 'import/failed';
    throw error;
  }
  return payload;
}
