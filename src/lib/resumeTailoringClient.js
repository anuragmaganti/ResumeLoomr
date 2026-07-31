import { validateJobListingFile } from './jobListingInput.js';
import { readDocumentFileAsBase64 } from './importDocument.js';

export async function requestResumeTailoring({ catalogRequest, source, instructions, idToken, signal }) {
  const requestSource = { type: source.type };

  if (source.type === 'file') {
    const validationError = validateJobListingFile(source.file);
    if (validationError) throw new Error(validationError);
    requestSource.fileName = source.file.name;
    requestSource.mimeType = source.file.type;
    requestSource.fileDataBase64 = await readDocumentFileAsBase64(
      source.file,
      'The selected job listing could not be read.',
    );
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
