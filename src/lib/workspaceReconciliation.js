import {
  MAX_WORKSPACE_RESUMES,
  createDuplicateResumeName,
  createWorkspaceResumeId,
  createWorkspaceResumeMeta,
  mergeWorkspaceOrganizations,
  normalizeWorkspaceIndex,
  placeWorkspaceResumeAfter,
} from './workspace.js';
import { createFreshWorkspaceDraft } from './workspaceDraft.js';
import { trimText } from './text.js';
import {
  createDraftContentHash,
  createDraftMergeContentHash,
  draftHasMeaningfulChanges,
  getDraftTimestamp,
  normalizeCloudVersion,
  normalizeDraftMap,
  normalizeDraftState,
  preservePermanentSampleDismissal,
} from './draftState.js';
import { stableJson } from './stableJson.js';

function getTimestamp(value) {
  const timestamp = Date.parse(value || '');

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function workspaceHasVisibleDrafts(workspace, draftsByResumeId, tombstonedResumeIds = new Set()) {
  const normalizedWorkspace = normalizeWorkspaceIndex(workspace);

  if (normalizedWorkspace.resumeIds.length > 1) {
    return true;
  }

  return normalizedWorkspace.resumeIds.some((resumeId, index) => {
    if (tombstonedResumeIds.has(resumeId)) {
      return false;
    }

    const name = trimText(normalizedWorkspace.meta[resumeId]?.name);
    const hasCustomName = name !== '' && name !== `Resume ${index + 1}`;

    return hasCustomName || draftHasMeaningfulChanges(draftsByResumeId.get(resumeId));
  });
}

function createUniqueResumeId(existingIds) {
  let resumeId = createWorkspaceResumeId();

  while (existingIds.has(resumeId)) {
    resumeId = createWorkspaceResumeId();
  }

  existingIds.add(resumeId);
  return resumeId;
}

function createConflictCopyName(baseName, existingNames) {
  const fallbackName = trimText(baseName) || 'Resume';
  return createDuplicateResumeName(fallbackName, existingNames);
}

export function normalizeTombstoneList(tombstones, pendingOutbox = []) {
  const records = [
    ...(Array.isArray(tombstones) ? tombstones : []),
    ...(Array.isArray(pendingOutbox) ? pendingOutbox.map((record) => record?.tombstone).filter(Boolean) : []),
  ];

  return records
    .filter((record) => trimText(record?.resumeId) !== '')
    .map((record) => ({
      ...record,
      resumeId: trimText(record.resumeId),
    }));
}

function tombstoneAppliesToAccount(tombstone, accountUid = '') {
  const tombstoneAccountUid = trimText(tombstone?.accountUid);
  const normalizedAccountUid = trimText(accountUid);

  return !tombstoneAccountUid || !normalizedAccountUid || tombstoneAccountUid === normalizedAccountUid;
}

export function filterTombstonesForAccount(tombstones, accountUid = '') {
  return (Array.isArray(tombstones) ? tombstones : [])
    .filter((tombstone) => tombstoneAppliesToAccount(tombstone, accountUid));
}

export function mergeConcurrentLocalWorkspaces(currentWorkspace, incomingWorkspace, tombstones = []) {
  const current = normalizeWorkspaceIndex(currentWorkspace);
  const incoming = normalizeWorkspaceIndex(incomingWorkspace);
  const deletedIds = new Set(normalizeTombstoneList(tombstones).map((record) => record.resumeId));
  const resumeIds = [...new Set([...incoming.resumeIds, ...current.resumeIds])]
    .filter((resumeId) => !deletedIds.has(resumeId))
    .slice(0, MAX_WORKSPACE_RESUMES);
  const meta = Object.fromEntries(resumeIds.map((resumeId, index) => {
    const incomingMeta = incoming.meta[resumeId];
    const currentMeta = current.meta[resumeId];
    const incomingTimestamp = getTimestamp(incomingMeta?.updatedAt);
    const currentTimestamp = getTimestamp(currentMeta?.updatedAt);
    const preferredMeta = incomingTimestamp >= currentTimestamp ? incomingMeta : currentMeta;

    return [
      resumeId,
      createWorkspaceResumeMeta(preferredMeta?.name || `Resume ${index + 1}`, preferredMeta?.updatedAt || ''),
    ];
  }));

  return normalizeWorkspaceIndex({
    activeResumeId: resumeIds.includes(incoming.activeResumeId)
      ? incoming.activeResumeId
      : (resumeIds.includes(current.activeResumeId) ? current.activeResumeId : resumeIds[0] || ''),
    resumeIds,
    meta,
    organization: mergeWorkspaceOrganizations(
      incoming.organization,
      current.organization,
      resumeIds,
      {
        primaryResumeIds: incoming.resumeIds,
        secondaryResumeIds: current.resumeIds,
      },
    ),
  });
}

function workspacesMatch(firstWorkspace, secondWorkspace) {
  return stableJson(normalizeWorkspaceIndex(firstWorkspace)) === stableJson(normalizeWorkspaceIndex(secondWorkspace));
}

export function mergeLocalAndCloudWorkspaces({
  localWorkspace,
  localDraftsByResumeId,
  cloudWorkspace = null,
  cloudDraftsByResumeId = null,
  tombstones = [],
  cloudTombstones = [],
  pendingOutbox = [],
  outboxRecords = pendingOutbox,
  workspaceCloudVersion = 0,
  maxResumes = MAX_WORKSPACE_RESUMES,
} = {}) {
  const normalizedLocalWorkspace = normalizeWorkspaceIndex(localWorkspace);
  const normalizedCloudWorkspace = normalizeWorkspaceIndex(cloudWorkspace);
  const localDrafts = normalizeDraftMap(localDraftsByResumeId);
  const cloudDrafts = normalizeDraftMap(cloudDraftsByResumeId);
  const localTombstoneRecords = normalizeTombstoneList(tombstones, outboxRecords);
  const cloudTombstoneRecords = normalizeTombstoneList(cloudTombstones);
  const tombstoneRecords = normalizeTombstoneList([
    ...localTombstoneRecords,
    ...cloudTombstoneRecords,
  ]);
  const localTombstonedResumeIds = new Set(localTombstoneRecords.map((record) => record.resumeId));
  const remotelyTombstonedResumeIds = new Set(cloudTombstoneRecords.map((record) => record.resumeId));
  const unsyncedLocalUpsertResumeIds = new Set(
    (Array.isArray(outboxRecords) ? outboxRecords : [])
      .filter((record) => (
        record?.type === 'upsertDraft'
        && trimText(record.resumeId)
        && record.status !== 'synced'
      ))
      .map((record) => trimText(record.resumeId)),
  );
  const tombstonedResumeIds = new Set(tombstoneRecords.map((record) => record.resumeId));
  const localHasContent = workspaceHasVisibleDrafts(normalizedLocalWorkspace, localDrafts, tombstonedResumeIds);
  const cloudHasContent = workspaceHasVisibleDrafts(normalizedCloudWorkspace, cloudDrafts, tombstonedResumeIds);
  const mergedDrafts = new Map();
  const mergedResumeIds = [];
  const mergedMeta = {};
  const existingIds = new Set([...normalizedLocalWorkspace.resumeIds, ...normalizedCloudWorkspace.resumeIds]);
  const existingNames = [];
  const upsertResumeIds = new Set();
  const warnings = [];
  const conflictCopySources = [];

  function addResume({ resumeId, draft, meta = {}, origin = 'cloud', forceUpsert = false, cloudVersion = null }) {
    if (!resumeId || mergedDrafts.has(resumeId) || tombstonedResumeIds.has(resumeId)) {
      return;
    }

    const normalizedDraft = normalizeDraftState({
      ...draft,
      cloudVersion: cloudVersion === null ? draft?.cloudVersion : cloudVersion,
    });
    const name = trimText(meta.name) || `Resume ${mergedResumeIds.length + 1}`;
    const updatedAt = normalizedDraft.savedAt || meta.updatedAt || '';

    mergedResumeIds.push(resumeId);
    mergedDrafts.set(resumeId, normalizedDraft);
    mergedMeta[resumeId] = createWorkspaceResumeMeta(name, updatedAt);
    existingNames.push(name);

    if (forceUpsert || origin === 'local' || origin === 'copy') {
      upsertResumeIds.add(resumeId);
    }
  }

  function addConflictCopy({ sourceResumeId, draft, meta = {} }) {
    const copyId = createUniqueResumeId(existingIds);
    const copyName = createConflictCopyName(meta.name || 'Resume', existingNames);

    addResume({
      resumeId: copyId,
      draft,
      meta: {
        ...meta,
        name: copyName,
      },
      origin: 'copy',
      forceUpsert: true,
      cloudVersion: 0,
    });
    conflictCopySources.push({ copyId, sourceResumeId });
  }

  if (!localHasContent && cloudHasContent) {
    normalizedCloudWorkspace.resumeIds.forEach((resumeId) => {
      addResume({
        resumeId,
        draft: cloudDrafts.get(resumeId),
        meta: normalizedCloudWorkspace.meta[resumeId],
        origin: 'cloud',
      });
    });
  } else {
    normalizedLocalWorkspace.resumeIds.forEach((resumeId) => {
      if (tombstonedResumeIds.has(resumeId)) {
        return;
      }

      const localDraft = localDrafts.get(resumeId);
      const cloudDraft = cloudDrafts.get(resumeId);

      if (!localDraft) {
        return;
      }

      if (!cloudDraft) {
        addResume({
          resumeId,
          draft: localDraft,
          meta: normalizedLocalWorkspace.meta[resumeId],
          origin: localHasContent ? 'local' : 'blank-local',
          forceUpsert: localHasContent,
          cloudVersion: 0,
        });
        return;
      }

      const localHash = createDraftMergeContentHash(localDraft);
      const cloudHash = createDraftMergeContentHash(cloudDraft);
      const cloudFullHash = createDraftContentHash(cloudDraft);

      if (localHash === cloudHash) {
        const localIsNewer = getDraftTimestamp(localDraft, normalizedLocalWorkspace.meta[resumeId]) >= getDraftTimestamp(cloudDraft, normalizedCloudWorkspace.meta[resumeId]);
        const preferredDraft = localIsNewer ? localDraft : cloudDraft;
        const mergedDraft = preservePermanentSampleDismissal(preferredDraft, localDraft, cloudDraft);
        const mergedFullHash = createDraftContentHash(mergedDraft);

        addResume({
          resumeId,
          draft: mergedDraft,
          meta: localHasContent ? normalizedLocalWorkspace.meta[resumeId] : normalizedCloudWorkspace.meta[resumeId],
          origin: mergedFullHash !== cloudFullHash ? 'local' : 'cloud',
          forceUpsert: mergedFullHash !== cloudFullHash,
          cloudVersion: cloudDraft.cloudVersion,
        });
        return;
      }

      const localIsNewer = getDraftTimestamp(localDraft, normalizedLocalWorkspace.meta[resumeId]) >= getDraftTimestamp(cloudDraft, normalizedCloudWorkspace.meta[resumeId]);

      if (localIsNewer) {
        addResume({
          resumeId,
          draft: preservePermanentSampleDismissal(localDraft, cloudDraft),
          meta: normalizedLocalWorkspace.meta[resumeId],
          origin: 'local',
          forceUpsert: true,
          cloudVersion: cloudDraft.cloudVersion,
        });
        addConflictCopy({
          sourceResumeId: resumeId,
          draft: cloudDraft,
          meta: normalizedCloudWorkspace.meta[resumeId],
        });
      } else {
        const mergedCloudDraft = preservePermanentSampleDismissal(cloudDraft, localDraft);

        addResume({
          resumeId,
          draft: mergedCloudDraft,
          meta: normalizedCloudWorkspace.meta[resumeId],
          origin: 'cloud',
          forceUpsert: createDraftContentHash(mergedCloudDraft) !== cloudFullHash,
          cloudVersion: cloudDraft.cloudVersion,
        });
        addConflictCopy({
          sourceResumeId: resumeId,
          draft: localDraft,
          meta: normalizedLocalWorkspace.meta[resumeId],
        });
      }
    });

    normalizedCloudWorkspace.resumeIds.forEach((resumeId) => {
      if (mergedDrafts.has(resumeId) || tombstonedResumeIds.has(resumeId)) {
        return;
      }

      const cloudDraft = cloudDrafts.get(resumeId);

      if (cloudDraft) {
        addResume({
          resumeId,
          draft: cloudDraft,
          meta: normalizedCloudWorkspace.meta[resumeId],
          origin: 'cloud',
        });
      }
    });
  }

  let preservedRemoteDeleteConflict = false;

  remotelyTombstonedResumeIds.forEach((resumeId) => {
    if (
      localTombstonedResumeIds.has(resumeId)
      || !unsyncedLocalUpsertResumeIds.has(resumeId)
      || !normalizedLocalWorkspace.resumeIds.includes(resumeId)
    ) {
      return;
    }

    const localDraft = localDrafts.get(resumeId);

    if (!localDraft) {
      return;
    }

    addConflictCopy({
      sourceResumeId: resumeId,
      draft: localDraft,
      meta: normalizedLocalWorkspace.meta[resumeId],
    });
    preservedRemoteDeleteConflict = true;
  });

  if (preservedRemoteDeleteConflict) {
    warnings.push('A resume deleted on another device had local edits, so those edits were preserved as a separate copy.');
  }

  if (mergedResumeIds.length === 0) {
    const fresh = createFreshWorkspaceDraft();

    existingIds.add(fresh.activeResumeId);
    addResume({
      resumeId: fresh.activeResumeId,
      draft: fresh.draft,
      meta: fresh.workspace.meta[fresh.activeResumeId],
      origin: 'local',
      forceUpsert: true,
      cloudVersion: 0,
    });
  }

  let nextResumeIds = mergedResumeIds;

  if (nextResumeIds.length > maxResumes) {
    warnings.push(`Only the first ${maxResumes} resumes were kept in this browser.`);
    nextResumeIds = nextResumeIds.slice(0, maxResumes);
  }

  const nextResumeIdSet = new Set(nextResumeIds);

  Array.from(mergedDrafts.keys()).forEach((resumeId) => {
    if (!nextResumeIdSet.has(resumeId)) {
      mergedDrafts.delete(resumeId);
      delete mergedMeta[resumeId];
      upsertResumeIds.delete(resumeId);
    }
  });

  const preferredActiveResumeId = localHasContent
    ? normalizedLocalWorkspace.activeResumeId
    : normalizedCloudWorkspace.activeResumeId;
  const activeResumeId = nextResumeIdSet.has(preferredActiveResumeId)
    ? preferredActiveResumeId
    : (nextResumeIds[0] || normalizedLocalWorkspace.activeResumeId || normalizedCloudWorkspace.activeResumeId || '');
  const primaryOrganization = localHasContent
    ? normalizedLocalWorkspace.organization
    : normalizedCloudWorkspace.organization;
  const secondaryOrganization = localHasContent
    ? normalizedCloudWorkspace.organization
    : normalizedLocalWorkspace.organization;
  const primaryOrganizationResumeIds = localHasContent
    ? normalizedLocalWorkspace.resumeIds
    : normalizedCloudWorkspace.resumeIds;
  const secondaryOrganizationResumeIds = localHasContent
    ? normalizedCloudWorkspace.resumeIds
    : normalizedLocalWorkspace.resumeIds;
  let workspace = normalizeWorkspaceIndex({
    activeResumeId,
    resumeIds: nextResumeIds,
    meta: mergedMeta,
    organization: mergeWorkspaceOrganizations(
      primaryOrganization,
      secondaryOrganization,
      nextResumeIds,
      {
        primaryResumeIds: primaryOrganizationResumeIds,
        secondaryResumeIds: secondaryOrganizationResumeIds,
      },
    ),
  });
  conflictCopySources.forEach(({ copyId, sourceResumeId }) => {
    workspace = placeWorkspaceResumeAfter(workspace, copyId, sourceResumeId);
  });
  const cloudHasWorkspace = normalizedCloudWorkspace.resumeIds.length > 0 && cloudDrafts.size > 0;
  const deleteResumeIds = Array.from(tombstonedResumeIds).filter((resumeId) => (
    cloudDrafts.has(resumeId) || normalizedCloudWorkspace.resumeIds.includes(resumeId)
  ));
  const workspaceNeedsSync = (
    upsertResumeIds.size > 0
    || deleteResumeIds.length > 0
    || (localHasContent && !workspacesMatch(workspace, normalizedCloudWorkspace))
  ) && (localHasContent || cloudHasWorkspace || upsertResumeIds.size > 0 || deleteResumeIds.length > 0);

  return {
    workspace,
    draftsByResumeId: mergedDrafts,
    activeResumeId: workspace.activeResumeId,
    syncPlan: {
      workspaceNeedsSync,
      upsertResumeIds: Array.from(upsertResumeIds).filter((resumeId) => mergedDrafts.has(resumeId)),
      deleteResumeIds,
    },
    warnings,
    tombstones: tombstoneRecords,
    workspaceCloudVersion: normalizeCloudVersion(workspaceCloudVersion),
    localHasContent,
    cloudHasContent,
  };
}
