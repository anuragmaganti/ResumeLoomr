const IMPORT_RESUME_MAX_BYTES = 3 * 1024 * 1024;

const PDF_MIME_TYPE = 'application/pdf';
const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const PNG_MIME_TYPE = 'image/png';
const JPEG_MIME_TYPE = 'image/jpeg';
const OCTET_STREAM_MIME_TYPE = 'application/octet-stream';
const SUPPORTED_FILE_TYPES_LABEL = 'PDF, DOCX, PNG, JPG, or JPEG';
const SUPPORTED_EXTENSION_MIME_TYPES = {
  pdf: new Set([PDF_MIME_TYPE, OCTET_STREAM_MIME_TYPE]),
  docx: new Set([DOCX_MIME_TYPE, OCTET_STREAM_MIME_TYPE]),
  png: new Set([PNG_MIME_TYPE, OCTET_STREAM_MIME_TYPE]),
  jpg: new Set([JPEG_MIME_TYPE, OCTET_STREAM_MIME_TYPE]),
  jpeg: new Set([JPEG_MIME_TYPE, OCTET_STREAM_MIME_TYPE]),
};

function getExtension(fileName) {
  const match = String(fileName || '').toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] || '';
}

function isSupportedResumeFile(file) {
  const extension = getExtension(file?.name);
  const supportedMimeTypes = SUPPORTED_EXTENSION_MIME_TYPES[extension];

  if (!supportedMimeTypes) {
    return false;
  }

  if (!file?.type) {
    return true;
  }

  return supportedMimeTypes.has(file.type);
}

export function validateImportResumeFile(file) {
  if (!file) {
    return `Choose a ${SUPPORTED_FILE_TYPES_LABEL} resume first.`;
  }

  if (!isSupportedResumeFile(file)) {
    return `Upload a ${SUPPORTED_FILE_TYPES_LABEL} resume file.`;
  }

  if (file.size <= 0) {
    return 'The selected file is empty.';
  }

  if (file.size > IMPORT_RESUME_MAX_BYTES) {
    return 'Upload a resume smaller than 3 MB.';
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
