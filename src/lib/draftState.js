import {
  createDraftPayload,
  createEmptyResume,
  dismissSampleInformation,
  normalizeDraftPayload,
} from './resume.js';
import { stableJson } from './stableJson.js';
import { trimText } from './text.js';

export function normalizeCloudVersion(value) {
  const version = Number(value);

  return Number.isSafeInteger(version) && version >= 0 ? version : 0;
}

export function getDraftStateRevision(draft) {
  return draft?.localRevision || '';
}

export function normalizeDraftState(draft) {
  const normalizedDraft = normalizeDraftPayload(draft);

  return {
    resume: normalizedDraft.resume,
    template: normalizedDraft.template,
    savedAt: draft?.savedAt || null,
    localRevision: draft?.localRevision || '',
    cloudVersion: normalizeCloudVersion(draft?.cloudVersion),
  };
}

export function normalizeDraftWithRevision(draft, localRevision = '') {
  return {
    ...normalizeDraftState(draft),
    localRevision: localRevision || getDraftStateRevision(draft),
  };
}

export function serializeDraftState(draft) {
  return {
    version: 3,
    savedAt: draft?.savedAt ?? null,
    template: draft?.template,
    resume: draft?.resume,
    localRevision: draft?.localRevision || '',
    cloudVersion: normalizeCloudVersion(draft?.cloudVersion),
  };
}

function withoutIdentityFields(value) {
  if (Array.isArray(value)) {
    return value.map(withoutIdentityFields);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== 'id')
        .map(([key, entryValue]) => [key, withoutIdentityFields(entryValue)]),
    );
  }

  return value;
}

function hashDraftContent(content) {
  const serialized = stableJson(content);
  let hash = 2166136261;

  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

export function createDraftContentHash(draft) {
  const normalizedDraft = normalizeDraftState(draft);

  return hashDraftContent({
    resume: normalizedDraft.resume,
    template: normalizedDraft.template,
  });
}

export function createDraftMergeContentHash(draft) {
  const normalizedDraft = normalizeDraftState(draft);
  const { sampleDisplay: _sampleDisplay, ...resumeForMerge } = normalizedDraft.resume || {};

  return hashDraftContent({
    resume: resumeForMerge,
    template: normalizedDraft.template,
  });
}

export function preservePermanentSampleDismissal(preferredDraft, ...otherDrafts) {
  const normalizedPreferredDraft = normalizeDraftState(preferredDraft);
  const isDismissed = [normalizedPreferredDraft, ...otherDrafts]
    .some((draft) => normalizeDraftState(draft).resume.sampleDisplay.isDismissed);

  if (!isDismissed || normalizedPreferredDraft.resume.sampleDisplay.isDismissed) {
    return normalizedPreferredDraft;
  }

  return {
    ...normalizedPreferredDraft,
    resume: dismissSampleInformation(normalizedPreferredDraft.resume),
  };
}

function draftHasVisibleText(draft) {
  const normalizedDraft = normalizeDraftPayload(draft);
  const personal = normalizedDraft.resume.personal || {};

  if (Object.values(personal).some((value) => trimText(value) !== '')) {
    return true;
  }

  function valueHasText(value, key = '') {
    if (key === 'id' || key === 'groupLabel') {
      return false;
    }

    if (typeof value === 'string') {
      return trimText(value) !== '';
    }

    if (Array.isArray(value)) {
      return value.some((item) => valueHasText(item));
    }

    if (value && typeof value === 'object') {
      return Object.entries(value).some(([entryKey, entryValue]) => valueHasText(entryValue, entryKey));
    }

    return false;
  }

  return Array.isArray(normalizedDraft.resume.sections)
    && normalizedDraft.resume.sections.some((section) => (
      trimText(section.title) !== ''
      && Array.isArray(section.entries)
      && section.entries.some((entry) => valueHasText(entry))
    ));
}

export function draftHasMeaningfulChanges(draft) {
  if (draftHasVisibleText(draft)) {
    return true;
  }

  const normalizedDraft = normalizeDraftState(draft);
  const pristineDraft = normalizeDraftState({
    resume: createEmptyResume(),
    template: 'compact',
  });
  const { sampleDisplay: _sampleDisplay, ...resumeWithoutSampleDisplay } = normalizedDraft.resume;
  const { sampleDisplay: _pristineSampleDisplay, ...pristineResumeWithoutSampleDisplay } = pristineDraft.resume;

  return stableJson(withoutIdentityFields({
    resume: resumeWithoutSampleDisplay,
    template: normalizedDraft.template,
  })) !== stableJson(withoutIdentityFields({
    resume: pristineResumeWithoutSampleDisplay,
    template: pristineDraft.template,
  }));
}

export function normalizeDraftMap(candidate) {
  if (candidate instanceof Map) {
    return new Map(Array.from(candidate.entries()).map(([resumeId, draft]) => [
      resumeId,
      normalizeDraftState(draft),
    ]));
  }

  if (candidate && typeof candidate === 'object') {
    return new Map(Object.entries(candidate).map(([resumeId, draft]) => [
      resumeId,
      normalizeDraftState(draft),
    ]));
  }

  return new Map();
}

export function getDraftTimestamp(draft, meta = {}) {
  const timestamp = Date.parse(draft?.savedAt || meta?.updatedAt || '');
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function createSavedDraftState({ resume, template, localRevision = '', cloudVersion = 0 }) {
  const payload = createDraftPayload({
    resume,
    template,
    savedAt: new Date().toISOString(),
    localRevision,
  });

  return {
    resume: payload.resume,
    template: payload.template,
    savedAt: payload.savedAt,
    localRevision: payload.localRevision,
    cloudVersion: normalizeCloudVersion(cloudVersion),
  };
}

export function createUnsyncedDraftCopyState(draft) {
  return createSavedDraftState({
    resume: draft?.resume,
    template: draft?.template,
  });
}
