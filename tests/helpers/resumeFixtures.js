import {
  createEmptyResume,
  updatePersonalField,
} from '../../src/lib/resume.js';
import { DEFAULT_TEMPLATE } from '../../src/lib/resumeSettings.js';
import {
  createWorkspaceResumeMeta,
  normalizeWorkspaceIndex,
} from '../../src/lib/workspace.js';

export function createDraft(name, savedAt = '2026-01-01T00:00:00.000Z') {
  const resume = updatePersonalField(createEmptyResume(), 'name', name);

  return {
    resume,
    template: DEFAULT_TEMPLATE,
    savedAt,
  };
}

export function createWorkspace(
  resumeIds,
  {
    activeResumeId = resumeIds[0],
    names = {},
    updatedAt = '2026-01-01T00:00:00.000Z',
  } = {},
) {
  return normalizeWorkspaceIndex({
    activeResumeId,
    resumeIds,
    meta: Object.fromEntries(resumeIds.map((resumeId, index) => [
      resumeId,
      createWorkspaceResumeMeta(names[resumeId] || `Resume ${index + 1}`, updatedAt),
    ])),
  });
}
