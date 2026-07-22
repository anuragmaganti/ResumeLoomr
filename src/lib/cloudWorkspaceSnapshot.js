import { normalizeDraftPayload } from './resume.js';
import { normalizeWorkspaceIndex } from './workspace.js';

export function normalizeCloudWorkspaceSnapshot(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const workspace = normalizeWorkspaceIndex(payload.workspace);
  const rawDrafts = payload.drafts && typeof payload.drafts === 'object' ? payload.drafts : {};
  const tombstones = Array.isArray(payload.tombstones) ? payload.tombstones : [];
  const draftsByResumeId = new Map();

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

  if (workspace.resumeIds.length === 0 && tombstones.length === 0) {
    return null;
  }

  return {
    workspace,
    draftsByResumeId,
    activeResumeId: workspace.activeResumeId || workspace.resumeIds[0],
    tombstones,
    workspaceCloudVersion: Math.max(0, Number(payload.workspaceVersion || 0) || 0),
  };
}
