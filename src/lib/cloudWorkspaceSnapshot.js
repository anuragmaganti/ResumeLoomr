import { normalizeDraftPayload } from './resume.js';
import { normalizeCoverLetterDraft } from './coverLetter.js';
import { normalizeWorkspaceIndex } from './workspace.js';

export function normalizeCloudWorkspaceSnapshot(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const workspace = normalizeWorkspaceIndex(payload.workspace);
  const rawDrafts = payload.drafts && typeof payload.drafts === 'object' ? payload.drafts : {};
  const rawCoverLetterDrafts = payload.coverLetterDrafts && typeof payload.coverLetterDrafts === 'object'
    ? payload.coverLetterDrafts
    : {};
  const tombstones = Array.isArray(payload.tombstones) ? payload.tombstones : [];
  const coverLetterTombstones = Array.isArray(payload.coverLetterTombstones)
    ? payload.coverLetterTombstones
    : [];
  const draftsByResumeId = new Map();
  const coverLetterDraftsById = new Map();

  workspace.resumeIds.forEach((resumeId) => {
    const draft = rawDrafts[resumeId];

    if (draft) {
      const normalizedDraft = normalizeDraftPayload(draft);
      draftsByResumeId.set(resumeId, {
        resume: normalizedDraft.resume,
        template: normalizedDraft.template,
        savedAt: draft.savedAt || null,
        cloudVersion: Math.max(0, Number(draft.cloudVersion || 0) || 0),
      });
    }
  });

  Object.values(workspace.coverLetters.meta).forEach((meta) => {
    const draft = rawCoverLetterDrafts[meta.id];

    if (draft) {
      coverLetterDraftsById.set(meta.id, normalizeCoverLetterDraft({
        ...draft,
        cloudVersion: Math.max(0, Number(draft.cloudVersion || 0) || 0),
      }, meta.resumeId));
    }
  });

  if (
    workspace.resumeIds.length === 0
    && tombstones.length === 0
    && coverLetterTombstones.length === 0
  ) {
    return null;
  }

  return {
    workspace,
    draftsByResumeId,
    coverLetterDraftsById,
    activeResumeId: workspace.activeResumeId || workspace.resumeIds[0],
    tombstones,
    coverLetterTombstones,
    workspaceCloudVersion: Math.max(0, Number(payload.workspaceVersion || 0) || 0),
  };
}
