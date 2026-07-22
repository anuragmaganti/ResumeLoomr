import {
  IMPORT_FILE_MAX_BYTES,
  IMPORT_FILE_MAX_MEGABYTES,
  IMPORT_FILE_TYPES_LABEL,
  normalizeResumeImportMimeType,
} from './importFileTypes.js';

function isSupportedResumeFile(file) {
  return Boolean(normalizeResumeImportMimeType(file?.name, file?.type, { allowMimeOnly: false }));
}

export function validateImportResumeFile(file) {
  if (!file) {
    return `Choose a ${IMPORT_FILE_TYPES_LABEL} resume first.`;
  }

  if (!isSupportedResumeFile(file)) {
    return `Upload a ${IMPORT_FILE_TYPES_LABEL} resume file.`;
  }

  if (file.size <= 0) {
    return 'The selected file is empty.';
  }

  if (file.size > IMPORT_FILE_MAX_BYTES) {
    return `Upload a resume smaller than ${IMPORT_FILE_MAX_MEGABYTES} MB.`;
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

export async function importResumeFile({ file, idToken }) {
  const validationError = validateImportResumeFile(file);

  if (validationError) {
    throw new Error(validationError);
  }

  const fileDataBase64 = await readFileAsBase64(file);
  const response = await fetch('/api/import-resume', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      fileName: file.name,
      mimeType: file.type,
      fileDataBase64,
    }),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error?.message || 'Resume import failed. Try again with another file.');
  }

  return payload;
}
