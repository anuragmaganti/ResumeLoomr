import {
  readLocalStorageJsonItem,
  writeLocalStorageJsonItem,
} from './browserStorage.js';
import { ACTIVE_DOCUMENT_VIEW_STORAGE_KEY } from './localWorkspaceKeys.js';
import { trimText } from './text.js';

export function normalizeActiveDocumentView(candidate) {
  const resumeId = trimText(candidate?.resumeId).slice(0, 200);
  const type = candidate?.type === 'coverLetter' ? 'coverLetter' : 'resume';
  const coverLetterId = type === 'coverLetter'
    ? trimText(candidate?.coverLetterId).slice(0, 200)
    : '';

  if (!resumeId || (type === 'coverLetter' && !coverLetterId)) return null;
  return { resumeId, type, coverLetterId };
}

export function readActiveDocumentView(storage = null) {
  return normalizeActiveDocumentView(
    readLocalStorageJsonItem(ACTIVE_DOCUMENT_VIEW_STORAGE_KEY, storage),
  );
}

export function writeActiveDocumentView(view, storage = null) {
  const normalized = normalizeActiveDocumentView(view);
  return normalized
    ? writeLocalStorageJsonItem(ACTIVE_DOCUMENT_VIEW_STORAGE_KEY, normalized, storage)
    : false;
}
