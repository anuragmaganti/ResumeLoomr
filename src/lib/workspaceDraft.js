import {
  createDraftPayload,
  createEmptyResume,
} from './resume.js';
import { DEFAULT_TEMPLATE } from './resumeSettings.js';
import {
  createWorkspaceResumeId,
  createWorkspaceResumeMeta,
  normalizeWorkspaceIndex,
} from './workspace.js';

export function createBlankDraftState() {
  return createDraftPayload({
    resume: createEmptyResume(),
    template: DEFAULT_TEMPLATE,
    savedAt: null,
  });
}

export function createFreshWorkspaceDraft() {
  const resumeId = createWorkspaceResumeId();
  const draft = createBlankDraftState();
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
