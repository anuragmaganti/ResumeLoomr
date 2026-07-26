import { trimText } from './text.js';

const MAX_WORKSPACE_COVER_LETTERS = 300;
const MAX_COVER_LETTER_NAME_LENGTH = 50;

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `letter-${Math.random().toString(36).slice(2, 12)}`;
}

export function createCoverLetterId() {
  return createId();
}

export function sanitizeCoverLetterName(value, fallback = 'Cover letter') {
  return (trimText(value) || trimText(fallback) || 'Cover letter')
    .slice(0, MAX_COVER_LETTER_NAME_LENGTH)
    .trim();
}

function normalizeRemovedIds(candidate) {
  return [...new Set(
    (Array.isArray(candidate?.removedIds) ? candidate.removedIds : [])
      .map(trimText)
      .filter(Boolean),
  )];
}

export function normalizeCoverLetterRegistry(candidate = {}, resumeIds = []) {
  const validResumeIds = [...new Set((Array.isArray(resumeIds) ? resumeIds : []).map(trimText).filter(Boolean))];
  const validResumeIdSet = new Set(validResumeIds);
  const removedIds = normalizeRemovedIds(candidate);
  const removedIdSet = new Set(removedIds);
  const rawMeta = candidate?.meta && typeof candidate.meta === 'object' && !Array.isArray(candidate.meta)
    ? candidate.meta
    : {};
  const rawOrder = candidate?.orderByResumeId && typeof candidate.orderByResumeId === 'object'
    ? candidate.orderByResumeId
    : {};
  const meta = {};

  Object.entries(rawMeta).slice(0, MAX_WORKSPACE_COVER_LETTERS).forEach(([metaId, value]) => {
    const id = trimText(value?.id || metaId);
    const resumeId = trimText(value?.resumeId);

    if (!id || removedIdSet.has(id) || !validResumeIdSet.has(resumeId) || meta[id]) {
      return;
    }

    meta[id] = {
      id,
      resumeId,
      name: sanitizeCoverLetterName(value?.name),
      updatedAt: typeof value?.updatedAt === 'string' ? value.updatedAt : '',
    };
  });

  const orderByResumeId = {};
  const placedIds = new Set();

  validResumeIds.forEach((resumeId) => {
    const requestedOrder = Array.isArray(rawOrder[resumeId]) ? rawOrder[resumeId] : [];
    const orderedIds = [];

    requestedOrder.forEach((rawId) => {
      const id = trimText(rawId);

      if (meta[id]?.resumeId === resumeId && !placedIds.has(id)) {
        placedIds.add(id);
        orderedIds.push(id);
      }
    });

    Object.values(meta).forEach((entry) => {
      if (entry.resumeId === resumeId && !placedIds.has(entry.id)) {
        placedIds.add(entry.id);
        orderedIds.push(entry.id);
      }
    });

    if (orderedIds.length > 0) {
      orderByResumeId[resumeId] = orderedIds;
    }
  });

  return {
    version: 1,
    updatedAt: typeof candidate?.updatedAt === 'string' ? candidate.updatedAt : '',
    orderByResumeId,
    meta,
    removedIds,
  };
}

export function getResumeCoverLetterIds(workspace, resumeId) {
  const registry = normalizeCoverLetterRegistry(workspace?.coverLetters, workspace?.resumeIds);
  return [...(registry.orderByResumeId[trimText(resumeId)] || [])];
}

export function getPrimaryCoverLetterId(workspace, resumeId) {
  return getResumeCoverLetterIds(workspace, resumeId)[0] || '';
}

export function addWorkspaceCoverLetter(workspace, resumeId, {
  coverLetterId = '',
  name = 'Cover letter',
  updatedAt = '',
} = {}) {
  const normalizedResumeId = trimText(resumeId);
  const registry = normalizeCoverLetterRegistry(workspace?.coverLetters, workspace?.resumeIds);

  if (
    !workspace?.resumeIds?.includes(normalizedResumeId)
    || Object.keys(registry.meta).length >= MAX_WORKSPACE_COVER_LETTERS
  ) {
    return { registry, coverLetterId: '' };
  }

  let id = trimText(coverLetterId);
  while (!id || registry.meta[id] || registry.removedIds.includes(id)) {
    id = createId();
  }

  const now = updatedAt || new Date().toISOString();
  return {
    coverLetterId: id,
    registry: normalizeCoverLetterRegistry({
      ...registry,
      updatedAt: now,
      orderByResumeId: {
        ...registry.orderByResumeId,
        [normalizedResumeId]: [...(registry.orderByResumeId[normalizedResumeId] || []), id],
      },
      meta: {
        ...registry.meta,
        [id]: {
          id,
          resumeId: normalizedResumeId,
          name: sanitizeCoverLetterName(name),
          updatedAt: now,
        },
      },
    }, workspace.resumeIds),
  };
}

export function removeWorkspaceCoverLetters(workspace, requestedIds, { now = '' } = {}) {
  const registry = normalizeCoverLetterRegistry(workspace?.coverLetters, workspace?.resumeIds);
  const requestedSet = new Set((Array.isArray(requestedIds) ? requestedIds : []).map(trimText).filter(Boolean));
  const removedIds = Object.keys(registry.meta).filter((id) => requestedSet.has(id));

  if (removedIds.length === 0) {
    return { registry, removedIds: [] };
  }

  const removedSet = new Set(removedIds);
  const meta = Object.fromEntries(Object.entries(registry.meta).filter(([id]) => !removedSet.has(id)));
  const orderByResumeId = Object.fromEntries(
    Object.entries(registry.orderByResumeId)
      .map(([resumeId, ids]) => [resumeId, ids.filter((id) => !removedSet.has(id))])
      .filter(([, ids]) => ids.length > 0),
  );

  return {
    removedIds,
    registry: normalizeCoverLetterRegistry({
      ...registry,
      updatedAt: now || new Date().toISOString(),
      meta,
      orderByResumeId,
      removedIds: [...registry.removedIds, ...removedIds],
    }, workspace.resumeIds),
  };
}

export function mergeCoverLetterRegistries(primaryCandidate, secondaryCandidate, resumeIds) {
  const primary = normalizeCoverLetterRegistry(primaryCandidate, resumeIds);
  const secondary = normalizeCoverLetterRegistry(secondaryCandidate, resumeIds);
  const removedIds = [...new Set([...primary.removedIds, ...secondary.removedIds])];
  const removedSet = new Set(removedIds);
  const meta = Object.fromEntries(
    Object.entries(primary.meta).filter(([id]) => !removedSet.has(id)),
  );

  Object.entries(secondary.meta).forEach(([id, value]) => {
    if (!meta[id] && !removedSet.has(id)) {
      meta[id] = value;
    }
  });

  const orderByResumeId = {};
  resumeIds.forEach((resumeId) => {
    const ids = [
      ...(primary.orderByResumeId[resumeId] || []),
      ...(secondary.orderByResumeId[resumeId] || []),
    ];
    const uniqueIds = [...new Set(ids)].filter((id) => meta[id]?.resumeId === resumeId);
    if (uniqueIds.length > 0) orderByResumeId[resumeId] = uniqueIds;
  });

  return normalizeCoverLetterRegistry({
    version: 1,
    updatedAt: primary.updatedAt || secondary.updatedAt || '',
    orderByResumeId,
    meta,
    removedIds,
  }, resumeIds);
}
