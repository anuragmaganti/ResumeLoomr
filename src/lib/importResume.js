export const IMPORT_RESUME_MAX_BYTES = 3 * 1024 * 1024;
export const IMPORT_RESUME_MODE_FULL = 'full';
export const IMPORT_RESUME_MODE_ONE_PAGE = 'onePage';

const PDF_MIME_TYPE = 'application/pdf';
const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const SUPPORTED_EXTENSIONS = ['pdf', 'docx'];
const SUPPORTED_IMPORT_MODES = new Set([IMPORT_RESUME_MODE_FULL, IMPORT_RESUME_MODE_ONE_PAGE]);

function getExtension(fileName) {
  const match = String(fileName || '').toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] || '';
}

function isSupportedResumeFile(file) {
  const extension = getExtension(file?.name);

  if (!SUPPORTED_EXTENSIONS.includes(extension)) {
    return false;
  }

  if (!file?.type) {
    return true;
  }

  return (
    file.type === PDF_MIME_TYPE ||
    file.type === DOCX_MIME_TYPE ||
    file.type === 'application/octet-stream'
  );
}

export function validateImportResumeFile(file) {
  if (!file) {
    return 'Choose a PDF or DOCX resume first.';
  }

  if (!isSupportedResumeFile(file)) {
    return 'Upload a PDF or DOCX resume file.';
  }

  if (file.size <= 0) {
    return 'The selected file is empty.';
  }

  if (file.size > IMPORT_RESUME_MAX_BYTES) {
    return 'Upload a resume smaller than 3 MB.';
  }

  return '';
}

export function normalizeImportResumeMode(value) {
  return SUPPORTED_IMPORT_MODES.has(value) ? value : IMPORT_RESUME_MODE_FULL;
}

export function readFileAsBase64(file) {
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

export async function importResumeFile({ file, idToken, importMode = IMPORT_RESUME_MODE_FULL }) {
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
      importMode: normalizeImportResumeMode(importMode),
    }),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload?.error?.message || 'Resume import failed. Try again with another file.');
  }

  return payload;
}
