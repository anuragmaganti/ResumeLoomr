import { trimText } from './text.js';

export const DRAFT_STORAGE_KEY = 'resumeloomr:draft:v2';
export const WORKSPACE_INDEX_STORAGE_KEY = 'resumeloomr:index:v1';
export const RESUME_STORAGE_KEY_PREFIX = 'resumeloomr:resume:';
export const WORKSPACE_OPEN_FOLDERS_STORAGE_KEY = 'resumeloomr:open-folders:v1';
export const MAX_WORKSPACE_RESUME_NAME_LENGTH = 50;
export const MAX_WORKSPACE_RESUMES = 100;
export const MAX_WORKSPACE_FOLDERS = 100;
export const MAX_WORKSPACE_FOLDER_NAME_LENGTH = 50;
export const WORKSPACE_FOLDER_TONE_COUNT = 5;

const DEFAULT_RESUME_LABEL = 'Resume';

function createWorkspaceId() {
  return globalThis.crypto?.randomUUID?.() ?? `id-${Math.random().toString(36).slice(2, 10)}`;
}

export function createWorkspaceResumeId() {
  return createWorkspaceId();
}

function createWorkspaceFolderId() {
  return createWorkspaceId();
}

export function createResumeStorageKey(resumeId) {
  return `${RESUME_STORAGE_KEY_PREFIX}${resumeId}`;
}

export function sanitizeWorkspaceResumeName(value, fallback = '') {
  const nextName = trimText(value).slice(0, MAX_WORKSPACE_RESUME_NAME_LENGTH).trim();

  if (nextName) {
    return nextName;
  }

  return trimText(fallback).slice(0, MAX_WORKSPACE_RESUME_NAME_LENGTH).trim();
}

export function createWorkspaceResumeMeta(name = DEFAULT_RESUME_LABEL, updatedAt = '') {
  return {
    name: sanitizeWorkspaceResumeName(name, DEFAULT_RESUME_LABEL),
    updatedAt: typeof updatedAt === 'string' ? updatedAt : '',
  };
}

export function updateWorkspaceResumeMeta(workspace, resumeId, updates = {}) {
  const normalizedWorkspace = normalizeWorkspaceIndex(workspace);

  if (!resumeId || !normalizedWorkspace.meta[resumeId]) {
    return normalizedWorkspace;
  }

  return normalizeWorkspaceIndex({
    ...normalizedWorkspace,
    meta: {
      ...normalizedWorkspace.meta,
      [resumeId]: {
        ...normalizedWorkspace.meta[resumeId],
        ...updates,
      },
    },
  });
}

export function sanitizeWorkspaceFolderName(value, fallback = 'New folder') {
  const nextName = trimText(value).slice(0, MAX_WORKSPACE_FOLDER_NAME_LENGTH).trim();

  if (nextName) {
    return nextName;
  }

  return trimText(fallback).slice(0, MAX_WORKSPACE_FOLDER_NAME_LENGTH).trim() || 'New folder';
}

function createUniqueWorkspaceFolderName(folders, value, { excludeFolderId = '', fallback = 'New folder' } = {}) {
  const baseName = sanitizeWorkspaceFolderName(value, fallback);
  const existingNames = new Set(
    Object.entries(folders || {})
      .filter(([folderId]) => folderId !== excludeFolderId)
      .map(([, folder]) => trimText(folder?.name).toLowerCase())
      .filter(Boolean),
  );

  if (!existingNames.has(baseName.toLowerCase())) {
    return baseName;
  }

  let index = 2;
  let candidate = '';

  do {
    const suffix = ` ${index}`;
    candidate = `${baseName.slice(0, MAX_WORKSPACE_FOLDER_NAME_LENGTH - suffix.length).trimEnd()}${suffix}`;
    index += 1;
  } while (existingNames.has(candidate.toLowerCase()));

  return candidate;
}

export function createNextWorkspaceFolderName(folders = {}) {
  return createUniqueWorkspaceFolderName(folders, 'New folder');
}

export function normalizeWorkspaceFolderToneIndex(value, folderId = '') {
  if (Number.isInteger(value) && value >= 0 && value < WORKSPACE_FOLDER_TONE_COUNT) {
    return value;
  }

  const text = trimText(folderId) || 'workspace-folder';
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % WORKSPACE_FOLDER_TONE_COUNT;
}

function createNextWorkspaceFolderToneIndex(folders = {}) {
  const usedToneIndexes = new Set(
    Object.values(folders).map((folder) => normalizeWorkspaceFolderToneIndex(
      folder?.toneIndex,
      folder?.id,
    )),
  );
  for (let toneIndex = 0; toneIndex < WORKSPACE_FOLDER_TONE_COUNT; toneIndex += 1) {
    if (!usedToneIndexes.has(toneIndex)) return toneIndex;
  }
  return Object.keys(folders).length % WORKSPACE_FOLDER_TONE_COUNT;
}

function createRootResumeItem(id) {
  return { type: 'resume', id };
}

function createRootFolderItem(id) {
  return { type: 'folder', id };
}

function normalizeWorkspaceRootItem(item) {
  const type = item?.type === 'folder' ? 'folder' : item?.type === 'resume' ? 'resume' : '';
  const id = trimText(item?.id);
  return type && id ? { type, id } : null;
}

export function normalizeWorkspaceOrganization(candidate = {}, resumeIds = []) {
  const validResumeIds = [...new Set((Array.isArray(resumeIds) ? resumeIds : []).map(trimText).filter(Boolean))];
  const validResumeIdSet = new Set(validResumeIds);
  const removedFolderIds = [...new Set(
    (Array.isArray(candidate?.removedFolderIds) ? candidate.removedFolderIds : [])
      .map(trimText)
      .filter(Boolean),
  )];
  const removedFolderIdSet = new Set(removedFolderIds);
  const rawFolders = candidate?.folders && typeof candidate.folders === 'object' ? candidate.folders : {};
  const folders = {};

  Object.entries(rawFolders).slice(0, MAX_WORKSPACE_FOLDERS).forEach(([folderKey, folder], index) => {
    const id = trimText(folder?.id || folderKey);

    if (!id || removedFolderIdSet.has(id) || folders[id]) {
      return;
    }

    folders[id] = {
      id,
      name: createUniqueWorkspaceFolderName(folders, folder?.name, {
        fallback: `New folder${index ? ` ${index + 1}` : ''}`,
      }),
      toneIndex: normalizeWorkspaceFolderToneIndex(folder?.toneIndex, id),
      resumeIds: [...new Set(
        (Array.isArray(folder?.resumeIds) ? folder.resumeIds : [])
          .map(trimText)
          .filter((resumeId) => validResumeIdSet.has(resumeId)),
      )],
    };
  });

  const rawRootItems = (Array.isArray(candidate?.rootItems) ? candidate.rootItems : [])
    .map(normalizeWorkspaceRootItem)
    .filter(Boolean);
  const orderedFolderIds = [];
  const seenFolderIds = new Set();

  rawRootItems.forEach((item) => {
    if (item.type === 'folder' && folders[item.id] && !seenFolderIds.has(item.id)) {
      seenFolderIds.add(item.id);
      orderedFolderIds.push(item.id);
    }
  });
  Object.keys(folders).forEach((folderId) => {
    if (!seenFolderIds.has(folderId)) {
      seenFolderIds.add(folderId);
      orderedFolderIds.push(folderId);
    }
  });

  // Folder membership wins over duplicate root placement. This repairs interrupted moves safely.
  const placedResumeIds = new Set();
  orderedFolderIds.forEach((folderId) => {
    folders[folderId].resumeIds = folders[folderId].resumeIds.filter((resumeId) => {
      if (placedResumeIds.has(resumeId)) {
        return false;
      }

      placedResumeIds.add(resumeId);
      return true;
    });
  });

  const rootItems = [];
  const placedRootFolderIds = new Set();
  rawRootItems.forEach((item) => {
    if (item.type === 'folder') {
      if (folders[item.id] && !placedRootFolderIds.has(item.id)) {
        placedRootFolderIds.add(item.id);
        rootItems.push(createRootFolderItem(item.id));
      }
      return;
    }

    if (validResumeIdSet.has(item.id) && !placedResumeIds.has(item.id)) {
      placedResumeIds.add(item.id);
      rootItems.push(createRootResumeItem(item.id));
    }
  });

  orderedFolderIds.forEach((folderId) => {
    if (!placedRootFolderIds.has(folderId)) {
      placedRootFolderIds.add(folderId);
      rootItems.push(createRootFolderItem(folderId));
    }
  });
  validResumeIds.forEach((resumeId) => {
    if (!placedResumeIds.has(resumeId)) {
      placedResumeIds.add(resumeId);
      rootItems.push(createRootResumeItem(resumeId));
    }
  });

  return {
    version: 1,
    updatedAt: typeof candidate?.updatedAt === 'string' ? candidate.updatedAt : '',
    rootItems,
    folders,
    removedFolderIds,
  };
}

export function mergeWorkspaceOrganizations(
  primaryCandidate,
  secondaryCandidate,
  resumeIds,
  {
    primaryResumeIds = resumeIds,
    secondaryResumeIds = resumeIds,
  } = {},
) {
  const primary = normalizeWorkspaceOrganization(primaryCandidate, primaryResumeIds);
  const secondary = normalizeWorkspaceOrganization(secondaryCandidate, secondaryResumeIds);
  // The caller establishes authority. Client wall clocks are not reliable
  // enough to resolve organization conflicts across browsers.
  const base = primary;
  const older = secondary;
  const removedFolderIds = [...new Set([
    ...primary.removedFolderIds,
    ...secondary.removedFolderIds,
  ])];
  const removedFolderIdSet = new Set(removedFolderIds);
  const folders = Object.fromEntries(
    Object.entries(base.folders)
      .filter(([folderId]) => !removedFolderIdSet.has(folderId))
      .map(([folderId, folder]) => [folderId, { ...folder, resumeIds: [...folder.resumeIds] }]),
  );
  const basePlacedResumeIds = new Set();

  Object.values(folders).forEach((folder) => {
    folder.resumeIds.forEach((resumeId) => basePlacedResumeIds.add(resumeId));
  });
  base.rootItems.forEach((item) => {
    if (item.type === 'resume') {
      basePlacedResumeIds.add(item.id);
    }
  });

  Object.entries(older.folders).forEach(([folderId, folder]) => {
    if (folders[folderId] || removedFolderIdSet.has(folderId)) {
      return;
    }

    folders[folderId] = {
      ...folder,
      resumeIds: folder.resumeIds.filter((resumeId) => !basePlacedResumeIds.has(resumeId)),
    };
  });

  const rootItemKeys = new Set();
  const rootItems = [];
  function appendRootItem(item) {
    const key = `${item.type}:${item.id}`;

    if (rootItemKeys.has(key) || (item.type === 'folder' && removedFolderIdSet.has(item.id))) {
      return;
    }

    rootItemKeys.add(key);
    rootItems.push(item);
  }

  base.rootItems.forEach(appendRootItem);
  older.rootItems.forEach((item) => {
    if (item.type === 'folder' && folders[item.id] && !base.folders[item.id]) {
      appendRootItem(item);
    } else if (item.type === 'resume' && !basePlacedResumeIds.has(item.id)) {
      appendRootItem(item);
    }
  });

  return normalizeWorkspaceOrganization({
    version: 1,
    updatedAt: base.updatedAt || older.updatedAt || '',
    rootItems,
    folders,
    removedFolderIds,
  }, resumeIds);
}

export function normalizeWorkspaceIndex(candidate = {}) {
  const rawResumeIds = Array.isArray(candidate?.resumeIds) ? candidate.resumeIds : [];
  const resumeIds = [...new Set(rawResumeIds.map(trimText).filter(Boolean))].slice(0, MAX_WORKSPACE_RESUMES);
  const meta = {};

  resumeIds.forEach((resumeId, index) => {
    meta[resumeId] = createWorkspaceResumeMeta(
      candidate?.meta?.[resumeId]?.name || `${DEFAULT_RESUME_LABEL} ${index + 1}`,
      candidate?.meta?.[resumeId]?.updatedAt || '',
    );
  });

  return {
    activeResumeId: resumeIds.includes(candidate?.activeResumeId) ? candidate.activeResumeId : (resumeIds[0] || ''),
    resumeIds,
    meta,
    organization: normalizeWorkspaceOrganization(candidate?.organization, resumeIds),
  };
}

function findWorkspaceResumePlacement(workspace, resumeId) {
  const normalizedWorkspace = normalizeWorkspaceIndex(workspace);
  const targetId = trimText(resumeId);

  for (const [folderId, folder] of Object.entries(normalizedWorkspace.organization.folders)) {
    const index = folder.resumeIds.indexOf(targetId);

    if (index >= 0) {
      return { type: 'folder', folderId, index };
    }
  }

  const index = normalizedWorkspace.organization.rootItems.findIndex(
    (item) => item.type === 'resume' && item.id === targetId,
  );
  return index >= 0 ? { type: 'root', folderId: '', index } : null;
}

export function createWorkspaceFolderFromResumes(workspace, requestedResumeIds, { folderId = '', now = '' } = {}) {
  const normalizedWorkspace = normalizeWorkspaceIndex(workspace);
  const organization = normalizedWorkspace.organization;
  const requestedSet = new Set(
    (Array.isArray(requestedResumeIds) ? requestedResumeIds : [])
      .map(trimText)
      .filter((resumeId) => normalizedWorkspace.resumeIds.includes(resumeId)),
  );

  if (requestedSet.size === 0 || Object.keys(organization.folders).length >= MAX_WORKSPACE_FOLDERS) {
    return { workspace: normalizedWorkspace, folderId: '', movedResumeIds: [] };
  }

  const visualResumeIds = [];
  organization.rootItems.forEach((item) => {
    if (item.type === 'resume') {
      visualResumeIds.push(item.id);
    } else {
      visualResumeIds.push(...(organization.folders[item.id]?.resumeIds || []));
    }
  });
  const movedResumeIds = visualResumeIds.filter((resumeId) => requestedSet.has(resumeId));
  const sourceRootIndexes = organization.rootItems.flatMap((item, index) => {
    if (item.type === 'resume' && requestedSet.has(item.id)) {
      return [index];
    }
    if (item.type === 'folder' && organization.folders[item.id]?.resumeIds.some((id) => requestedSet.has(id))) {
      return [index];
    }
    return [];
  });
  const anchorIndex = sourceRootIndexes.length ? Math.min(...sourceRootIndexes) : organization.rootItems.length;
  const createdAt = now || new Date().toISOString();
  let nextFolderId = trimText(folderId) || createWorkspaceFolderId();

  while (organization.folders[nextFolderId]) {
    nextFolderId = createWorkspaceFolderId();
  }

  const nextFolders = Object.fromEntries(Object.entries(organization.folders).map(([id, folder]) => [id, {
    ...folder,
    resumeIds: folder.resumeIds.filter((resumeId) => !requestedSet.has(resumeId)),
  }]));
  nextFolders[nextFolderId] = {
    id: nextFolderId,
    name: createNextWorkspaceFolderName(organization.folders),
    toneIndex: createNextWorkspaceFolderToneIndex(organization.folders),
    resumeIds: movedResumeIds,
  };
  const retainedBeforeAnchor = organization.rootItems
    .slice(0, anchorIndex)
    .filter((item) => !(item.type === 'resume' && requestedSet.has(item.id))).length;
  const nextRootItems = organization.rootItems.filter(
    (item) => !(item.type === 'resume' && requestedSet.has(item.id)),
  );
  nextRootItems.splice(retainedBeforeAnchor, 0, createRootFolderItem(nextFolderId));

  const nextWorkspace = normalizeWorkspaceIndex({
      ...normalizedWorkspace,
      organization: {
        ...organization,
        updatedAt: createdAt,
        rootItems: nextRootItems,
        folders: nextFolders,
      },
    });

  return {
    workspace: nextWorkspace,
    folderId: nextFolderId,
    movedResumeIds,
  };
}

export function renameWorkspaceFolder(workspace, folderId, nextName, { now = '' } = {}) {
  const normalizedWorkspace = normalizeWorkspaceIndex(workspace);
  const folder = normalizedWorkspace.organization.folders[folderId];

  if (!folder) {
    return normalizedWorkspace;
  }

  const updatedAt = now || new Date().toISOString();
  return normalizeWorkspaceIndex({
    ...normalizedWorkspace,
    organization: {
      ...normalizedWorkspace.organization,
      updatedAt,
      folders: {
        ...normalizedWorkspace.organization.folders,
        [folderId]: {
          ...folder,
          name: createUniqueWorkspaceFolderName(
            normalizedWorkspace.organization.folders,
            nextName,
            { excludeFolderId: folderId },
          ),
        },
      },
    },
  });
}

export function removeWorkspaceFolders(workspace, requestedFolderIds, { now = '' } = {}) {
  const normalizedWorkspace = normalizeWorkspaceIndex(workspace);
  const requestedIds = new Set(
    (Array.isArray(requestedFolderIds) ? requestedFolderIds : []).map(trimText).filter(Boolean),
  );
  const removedFolderIds = normalizedWorkspace.organization.rootItems
    .filter((item) => item.type === 'folder' && requestedIds.has(item.id))
    .map((item) => item.id);

  if (removedFolderIds.length === 0) {
    return { workspace: normalizedWorkspace, removedFolderIds: [] };
  }

  const removedSet = new Set(removedFolderIds);
  const nextRootItems = normalizedWorkspace.organization.rootItems.flatMap((item) => {
    if (item.type !== 'folder' || !removedSet.has(item.id)) {
      return [item];
    }

    return (normalizedWorkspace.organization.folders[item.id]?.resumeIds || []).map(createRootResumeItem);
  });
  const nextFolders = { ...normalizedWorkspace.organization.folders };
  removedFolderIds.forEach((id) => delete nextFolders[id]);
  const updatedAt = now || new Date().toISOString();

  return {
    workspace: normalizeWorkspaceIndex({
      ...normalizedWorkspace,
      organization: {
        ...normalizedWorkspace.organization,
        updatedAt,
        rootItems: nextRootItems,
        folders: nextFolders,
        removedFolderIds: [
          ...normalizedWorkspace.organization.removedFolderIds,
          ...removedFolderIds,
        ],
      },
    }),
    removedFolderIds,
  };
}

export function placeWorkspaceResumeAfter(workspace, resumeId, sourceResumeId, { now = '' } = {}) {
  const normalizedWorkspace = normalizeWorkspaceIndex(workspace);
  const targetId = trimText(resumeId);
  const sourceId = trimText(sourceResumeId);

  if (!normalizedWorkspace.resumeIds.includes(targetId) || targetId === sourceId) {
    return normalizedWorkspace;
  }

  const updatedAt = now || new Date().toISOString();
  const organization = normalizedWorkspace.organization;
  const nextFolders = Object.fromEntries(Object.entries(organization.folders).map(([id, folder]) => [id, {
    ...folder,
    resumeIds: folder.resumeIds.filter((idValue) => idValue !== targetId),
  }]));
  const nextRootItems = organization.rootItems.filter(
    (item) => !(item.type === 'resume' && item.id === targetId),
  );
  const sourcePlacement = findWorkspaceResumePlacement({ ...normalizedWorkspace, organization: { ...organization, rootItems: nextRootItems, folders: nextFolders } }, sourceId);

  if (sourcePlacement?.type === 'folder') {
    nextFolders[sourcePlacement.folderId].resumeIds.splice(sourcePlacement.index + 1, 0, targetId);
  } else {
    const sourceRootIndex = nextRootItems.findIndex((item) => item.type === 'resume' && item.id === sourceId);
    nextRootItems.splice(sourceRootIndex >= 0 ? sourceRootIndex + 1 : nextRootItems.length, 0, createRootResumeItem(targetId));
  }

  const nextWorkspace = normalizeWorkspaceIndex({
    ...normalizedWorkspace,
    organization: {
      ...organization,
      updatedAt,
      rootItems: nextRootItems,
      folders: nextFolders,
    },
  });

  return nextWorkspace;
}

export function updateWorkspaceOrganization(workspace, organization, { now = '' } = {}) {
  const normalizedWorkspace = normalizeWorkspaceIndex(workspace);
  const updatedAt = now || new Date().toISOString();
  const nextWorkspace = normalizeWorkspaceIndex({
    ...normalizedWorkspace,
    organization: {
      ...organization,
      updatedAt,
    },
  });

  return nextWorkspace;
}

export function createNextResumeName(existingNames = []) {
  const names = new Set(existingNames.map((name) => trimText(name).toLowerCase()));
  let index = 1;

  while (names.has(`${DEFAULT_RESUME_LABEL} ${index}`.toLowerCase())) {
    index += 1;
  }

  return `${DEFAULT_RESUME_LABEL} ${index}`;
}

export function createDuplicateResumeName(sourceName = DEFAULT_RESUME_LABEL, existingNames = []) {
  const baseName = sanitizeWorkspaceResumeName(sourceName, DEFAULT_RESUME_LABEL);
  const names = new Set(existingNames.map((name) => trimText(name).toLowerCase()));
  const firstCopy = sanitizeWorkspaceResumeName(`${baseName} copy`, `${DEFAULT_RESUME_LABEL} copy`);

  if (!names.has(firstCopy.toLowerCase())) {
    return firstCopy;
  }

  let index = 2;

  while (index < 1000) {
    const copyName = sanitizeWorkspaceResumeName(`${baseName} copy ${index}`, `${DEFAULT_RESUME_LABEL} copy ${index}`);

    if (!names.has(copyName.toLowerCase())) {
      return copyName;
    }

    index += 1;
  }

  return sanitizeWorkspaceResumeName(`${DEFAULT_RESUME_LABEL} copy ${Date.now()}`, DEFAULT_RESUME_LABEL);
}

export function removeWorkspaceResumes(workspace, requestedResumeIds, { now = '' } = {}) {
  const normalizedWorkspace = normalizeWorkspaceIndex(workspace);
  const requestedIds = new Set(
    (Array.isArray(requestedResumeIds) ? requestedResumeIds : [])
      .map(trimText)
      .filter(Boolean),
  );
  const deletedResumeIds = normalizedWorkspace.resumeIds.filter((resumeId) => requestedIds.has(resumeId));

  if (deletedResumeIds.length === 0) {
    return {
      workspace: normalizedWorkspace,
      deletedResumeIds: [],
      rejectedReason: 'empty',
    };
  }

  if (deletedResumeIds.length >= normalizedWorkspace.resumeIds.length) {
    return {
      workspace: normalizedWorkspace,
      deletedResumeIds: [],
      rejectedReason: 'all',
    };
  }

  const deletedIds = new Set(deletedResumeIds);
  const activeIndex = normalizedWorkspace.resumeIds.indexOf(normalizedWorkspace.activeResumeId);
  const remainingResumeIds = normalizedWorkspace.resumeIds.filter((resumeId) => !deletedIds.has(resumeId));
  const nextActiveResumeId = deletedIds.has(normalizedWorkspace.activeResumeId)
    ? (
      remainingResumeIds.find((resumeId) => normalizedWorkspace.resumeIds.indexOf(resumeId) > activeIndex)
      || remainingResumeIds.at(-1)
    )
    : normalizedWorkspace.activeResumeId;
  const nextMeta = { ...normalizedWorkspace.meta };

  deletedResumeIds.forEach((resumeId) => {
    delete nextMeta[resumeId];
  });

  const updatedAt = now || new Date().toISOString();
  const nextWorkspace = normalizeWorkspaceIndex({
      activeResumeId: nextActiveResumeId,
      resumeIds: remainingResumeIds,
      meta: nextMeta,
      organization: {
        ...normalizedWorkspace.organization,
        updatedAt,
      },
    });

  return {
    workspace: nextWorkspace,
    deletedResumeIds,
    rejectedReason: '',
  };
}
