import {
  createCoverLetterContentHash,
  normalizeCoverLetterDraft,
} from './coverLetter.js';
import {
  createCoverLetterId,
  normalizeCoverLetterRegistry,
  sanitizeCoverLetterName,
} from './coverLetterWorkspace.js';
import { normalizeCloudVersion } from './draftState.js';
import { trimText } from './text.js';

function normalizeDraftMap(candidate) {
  const entries = candidate instanceof Map
    ? [...candidate.entries()]
    : candidate && typeof candidate === 'object'
      ? Object.entries(candidate)
      : [];
  return new Map(entries.map(([id, draft]) => [
    trimText(id),
    normalizeCoverLetterDraft(draft, draft?.coverLetter?.resumeId),
  ]).filter(([id]) => id));
}

function normalizeCoverLetterTombstones(tombstones, outboxRecords = []) {
  return [
    ...(Array.isArray(tombstones) ? tombstones : []),
    ...(Array.isArray(outboxRecords)
      ? outboxRecords.map((record) => record?.tombstone).filter((record) => record?.coverLetterId)
      : []),
  ].flatMap((record) => {
    const coverLetterId = trimText(record?.coverLetterId);
    return coverLetterId ? [{ ...record, coverLetterId }] : [];
  });
}

function getDraftTimestamp(draft, meta = {}) {
  const timestamp = Date.parse(draft?.savedAt || meta?.updatedAt || '');
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function preserveSampleDismissal(preferred, ...others) {
  const normalized = normalizeCoverLetterDraft(preferred, preferred?.coverLetter?.resumeId);
  const dismissed = [normalized, ...others].some((draft) => (
    normalizeCoverLetterDraft(draft, draft?.coverLetter?.resumeId).coverLetter.sampleDisplay.isDismissed
  ));

  if (!dismissed || normalized.coverLetter.sampleDisplay.isDismissed) return normalized;
  return {
    ...normalized,
    coverLetter: {
      ...normalized.coverLetter,
      sampleDisplay: {
        ...normalized.coverLetter.sampleDisplay,
        hasStarted: true,
        showInformation: false,
        isDismissed: true,
      },
    },
  };
}

function createUniqueId(existingIds) {
  let id = createCoverLetterId();
  while (existingIds.has(id)) id = createCoverLetterId();
  existingIds.add(id);
  return id;
}

function createCopyName(name, existingNames) {
  const base = sanitizeCoverLetterName(name);
  let index = 1;
  let candidate = `${base} copy`.slice(0, 50);
  while (existingNames.has(candidate.toLowerCase())) {
    index += 1;
    const suffix = ` copy ${index}`;
    candidate = `${base.slice(0, 50 - suffix.length).trimEnd()}${suffix}`;
  }
  existingNames.add(candidate.toLowerCase());
  return candidate;
}

function resolveParentResumeId(origin, resumeId, conflictCopySources, validResumeIds) {
  const mapping = conflictCopySources.find((entry) => (
    entry.sourceResumeId === resumeId && entry.origin === origin
  ));
  const resolved = mapping?.copyId || resumeId;
  return validResumeIds.has(resolved) ? resolved : '';
}

export function mergeCoverLettersForWorkspace({
  workspace,
  localWorkspace,
  cloudWorkspace,
  localDraftsById,
  cloudDraftsById,
  tombstones = [],
  cloudTombstones = [],
  outboxRecords = [],
  conflictCopySources = [],
  localHasContent = false,
} = {}) {
  const validResumeIds = new Set(workspace.resumeIds);
  const localRegistry = normalizeCoverLetterRegistry(localWorkspace?.coverLetters, localWorkspace?.resumeIds);
  const cloudRegistry = normalizeCoverLetterRegistry(cloudWorkspace?.coverLetters, cloudWorkspace?.resumeIds);
  const localDrafts = normalizeDraftMap(localDraftsById);
  const cloudDrafts = normalizeDraftMap(cloudDraftsById);
  const localTombstones = normalizeCoverLetterTombstones(tombstones, outboxRecords);
  const remoteTombstones = normalizeCoverLetterTombstones(cloudTombstones);
  const allTombstones = normalizeCoverLetterTombstones([...localTombstones, ...remoteTombstones]);
  const tombstonedIds = new Set(allTombstones.map((record) => record.coverLetterId));
  const unsyncedLocalIds = new Set(
    (Array.isArray(outboxRecords) ? outboxRecords : [])
      .filter((record) => record?.type === 'upsertCoverLetter' && record.status !== 'synced')
      .map((record) => trimText(record.coverLetterId))
      .filter(Boolean),
  );
  const draftsById = new Map();
  const meta = {};
  const orderByResumeId = {};
  const existingIds = new Set([
    ...Object.keys(localRegistry.meta),
    ...Object.keys(cloudRegistry.meta),
  ]);
  const namesByResumeId = new Map();
  const upsertIds = new Set();
  const warnings = [];

  function add({ id, draft, sourceMeta, resumeId, origin, forceUpsert = false, cloudVersion = null }) {
    if (!id || draftsById.has(id) || tombstonedIds.has(id) || !validResumeIds.has(resumeId) || !draft) return;
    const normalizedDraft = normalizeCoverLetterDraft({
      ...draft,
      coverLetter: { ...draft.coverLetter, resumeId },
      cloudVersion: cloudVersion === null ? draft.cloudVersion : cloudVersion,
    }, resumeId);
    const name = sanitizeCoverLetterName(sourceMeta?.name);
    draftsById.set(id, normalizedDraft);
    meta[id] = {
      id,
      resumeId,
      name,
      updatedAt: normalizedDraft.savedAt || sourceMeta?.updatedAt || '',
    };
    orderByResumeId[resumeId] ||= [];
    orderByResumeId[resumeId].push(id);
    const names = namesByResumeId.get(resumeId) || new Set();
    names.add(name.toLowerCase());
    namesByResumeId.set(resumeId, names);
    if (forceUpsert || origin === 'local' || origin === 'copy') upsertIds.add(id);
  }

  function addCopy({ draft, sourceMeta, resumeId }) {
    if (!validResumeIds.has(resumeId) || !draft) return;
    const id = createUniqueId(existingIds);
    const names = namesByResumeId.get(resumeId) || new Set();
    const name = createCopyName(sourceMeta?.name || 'Cover letter', names);
    namesByResumeId.set(resumeId, names);
    add({ id, draft, sourceMeta: { ...sourceMeta, name }, resumeId, origin: 'copy', forceUpsert: true, cloudVersion: 0 });
  }

  const primaryRegistry = localHasContent ? localRegistry : cloudRegistry;
  const secondaryRegistry = localHasContent ? cloudRegistry : localRegistry;
  const orderedIds = [
    ...Object.values(primaryRegistry.orderByResumeId).flat(),
    ...Object.values(secondaryRegistry.orderByResumeId).flat(),
    ...Object.keys(localRegistry.meta),
    ...Object.keys(cloudRegistry.meta),
  ];

  [...new Set(orderedIds)].forEach((id) => {
    if (draftsById.has(id) || tombstonedIds.has(id)) return;
    const localMeta = localRegistry.meta[id];
    const cloudMeta = cloudRegistry.meta[id];
    const localDraft = localDrafts.get(id);
    const cloudDraft = cloudDrafts.get(id);
    const localParent = localMeta
      ? resolveParentResumeId('local', localMeta.resumeId, conflictCopySources, validResumeIds)
      : '';
    const cloudParent = cloudMeta
      ? resolveParentResumeId('cloud', cloudMeta.resumeId, conflictCopySources, validResumeIds)
      : '';

    if (localDraft && cloudDraft) {
      const sameContent = createCoverLetterContentHash(localDraft) === createCoverLetterContentHash(cloudDraft);
      const localNewer = getDraftTimestamp(localDraft, localMeta) >= getDraftTimestamp(cloudDraft, cloudMeta);

      if (sameContent && localParent === cloudParent) {
        const preferred = localNewer ? localDraft : cloudDraft;
        const merged = preserveSampleDismissal(preferred, localDraft, cloudDraft);
        add({
          id,
          draft: merged,
          sourceMeta: localNewer ? localMeta : cloudMeta,
          resumeId: localParent || cloudParent,
          origin: createCoverLetterContentHash(merged) === createCoverLetterContentHash(cloudDraft) ? 'cloud' : 'local',
          forceUpsert: createCoverLetterContentHash(merged) !== createCoverLetterContentHash(cloudDraft),
          cloudVersion: cloudDraft.cloudVersion,
        });
        return;
      }

      if (localNewer) {
        add({ id, draft: preserveSampleDismissal(localDraft, cloudDraft), sourceMeta: localMeta, resumeId: localParent, origin: 'local', forceUpsert: true, cloudVersion: cloudDraft.cloudVersion });
        addCopy({ draft: cloudDraft, sourceMeta: cloudMeta, resumeId: cloudParent || localParent });
      } else {
        add({ id, draft: preserveSampleDismissal(cloudDraft, localDraft), sourceMeta: cloudMeta, resumeId: cloudParent, origin: 'cloud', cloudVersion: cloudDraft.cloudVersion });
        addCopy({ draft: localDraft, sourceMeta: localMeta, resumeId: localParent || cloudParent });
      }
      return;
    }

    if (localDraft && localParent) {
      add({ id, draft: localDraft, sourceMeta: localMeta, resumeId: localParent, origin: 'local', forceUpsert: true, cloudVersion: 0 });
    } else if (cloudDraft && cloudParent) {
      add({ id, draft: cloudDraft, sourceMeta: cloudMeta, resumeId: cloudParent, origin: 'cloud' });
    }
  });

  const remoteDeletedIds = new Set(remoteTombstones.map((record) => record.coverLetterId));
  remoteDeletedIds.forEach((id) => {
    if (!unsyncedLocalIds.has(id) || draftsById.has(id)) return;
    const localMeta = localRegistry.meta[id];
    const localDraft = localDrafts.get(id);
    const resumeId = localMeta
      ? resolveParentResumeId('local', localMeta.resumeId, conflictCopySources, validResumeIds)
      : '';
    if (localDraft && resumeId) {
      addCopy({ draft: localDraft, sourceMeta: localMeta, resumeId });
      warnings.push('A cover letter deleted on another device had local edits, so those edits were preserved as a copy.');
    }
  });

  const registry = normalizeCoverLetterRegistry({
    version: 1,
    updatedAt: primaryRegistry.updatedAt || secondaryRegistry.updatedAt || '',
    orderByResumeId,
    meta,
    removedIds: [...new Set([
      ...localRegistry.removedIds,
      ...cloudRegistry.removedIds,
      ...allTombstones.map((record) => record.coverLetterId),
    ])],
  }, workspace.resumeIds);
  const deleteIds = [...tombstonedIds].filter((id) => cloudRegistry.meta[id] || cloudDrafts.has(id));

  return {
    workspace: { ...workspace, coverLetters: registry },
    draftsById,
    tombstones: allTombstones,
    syncPlan: {
      upsertIds: [...upsertIds].filter((id) => draftsById.has(id)),
      deleteIds,
    },
    warnings,
    cloudVersionsById: new Map([...draftsById].map(([id, draft]) => [id, normalizeCloudVersion(draft.cloudVersion)])),
  };
}
