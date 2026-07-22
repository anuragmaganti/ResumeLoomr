import {
  DEFAULT_TEMPLATE,
  createDraftPayload,
  createEmptyResume,
} from './resume.js';
import {
  createWorkspaceResumeId,
  createWorkspaceResumeMeta,
  normalizeWorkspaceIndex,
} from './workspace.js';

export function createFreshWorkspaceDraft() {
  const resumeId = createWorkspaceResumeId();
  const draft = createDraftPayload({
    resume: createEmptyResume(),
    template: DEFAULT_TEMPLATE,
    savedAt: null,
  });
  const workspace = normalizeWorkspaceIndex({
    activeResumeId: resumeId,
    resumeIds: [resumeId],
    meta: {
      [resumeId]: createWorkspaceResumeMeta('Resume 1', ''),
    },
  });

  return {
    workspace,
    activeResumeId: resumeId,
    draft,
  };
}
