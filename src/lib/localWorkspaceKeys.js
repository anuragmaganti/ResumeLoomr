export const LEGACY_DRAFT_STORAGE_KEY = 'resumeloomr:draft:v2';
export const WORKSPACE_INDEX_STORAGE_KEY = 'resumeloomr:index:v1';
export const RESUME_STORAGE_KEY_PREFIX = 'resumeloomr:resume:';
export const WORKSPACE_OPEN_FOLDERS_STORAGE_KEY = 'resumeloomr:open-folders:v1';
export const LOCAL_WORKSPACE_PRESENT_KEY = 'resumeloomr:local-workspace-present:v1';
export const LOCAL_SYNC_CLIENT_ID_KEY = 'resumeloomr:sync-client-id:v1';
export const LOCAL_SYNC_SEQUENCE_KEY = 'resumeloomr:sync-sequence:v1';

export function createResumeStorageKey(resumeId) {
  return `${RESUME_STORAGE_KEY_PREFIX}${resumeId}`;
}
