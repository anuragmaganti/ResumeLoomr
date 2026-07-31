import { validateJobListingFile } from './jobListingInput.js';

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      resolve(result.includes(',') ? result.split(',').pop() : result);
    };
    reader.onerror = () => reject(new Error('The selected job listing could not be read.'));
    reader.readAsDataURL(file);
  });
}

export async function requestResumeTailoring({ catalogRequest, source, instructions, idToken, signal }) {
  const requestSource = { type: source.type };

  if (source.type === 'file') {
    const validationError = validateJobListingFile(source.file);
    if (validationError) throw new Error(validationError);
    requestSource.fileName = source.file.name;
    requestSource.mimeType = source.file.type;
    requestSource.fileDataBase64 = await readFileAsBase64(source.file);
  } else if (source.type === 'url') {
    requestSource.url = source.url;
  } else {
    requestSource.text = source.text;
  }

  const response = await fetch('/api/tailor-resume', {
    method: 'POST',
    signal,
    headers: {
      Authorization: `Bearer ${idToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      resume: catalogRequest,
      source: requestSource,
      instructions,
    }),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(payload?.error?.message || 'The resume could not be tailored. Try again.');
    error.code = payload?.error?.code || 'tailor/failed';
    throw error;
  }

  return payload;
}
