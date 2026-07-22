import { useEffect, useRef, useState } from 'react';
import { importResumeFile } from '../lib/importResume.js';

const IDLE_IMPORT_STATE = { status: 'idle' };

export function useResumeImportController({
  authUser,
  openAuthModal,
  endTransientSampleEntry,
  createImportPlaceholderResume,
  replaceResumeDraft,
  showNotice,
}) {
  const authUserRef = useRef(authUser);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [importState, setImportState] = useState(IDLE_IMPORT_STATE);
  const isImporting = importState.status === 'processing';

  useEffect(() => {
    authUserRef.current = authUser;
  }, [authUser]);

  function openImport() {
    endTransientSampleEntry?.();

    if (!authUser) {
      openAuthModal?.();
      return;
    }

    setIsModalOpen(true);
  }

  function closeImport() {
    setIsModalOpen(false);
  }

  async function uploadResume(file) {
    if (!authUser) {
      setIsModalOpen(false);
      openAuthModal?.();
      return;
    }

    const importUser = authUser;
    let placeholderResumeId = null;

    setIsModalOpen(false);
    setImportState({ status: 'processing', fileName: file.name });

    try {
      placeholderResumeId = await createImportPlaceholderResume({ sourceFileName: file.name });

      if (!placeholderResumeId) {
        throw new Error('Create or delete a resume before importing another file.');
      }

      setImportState({ status: 'processing', fileName: file.name, resumeId: placeholderResumeId });

      const idToken = await importUser.getIdToken();
      const importedDraft = await importResumeFile({ file, idToken });

      if (authUserRef.current?.uid !== importUser.uid) {
        showNotice({
          tone: 'error',
          message: 'The import finished after your account changed, so it was not applied.',
        });
        return;
      }

      await replaceResumeDraft(placeholderResumeId, importedDraft.draft, {
        name: importedDraft.suggestedName || file.name,
      });

      if (importedDraft.draft?.importWarnings?.length > 0) {
        showNotice({
          tone: 'warning',
          message: 'Imported resume added. Some sections may need review.',
        });
      }
    } catch (error) {
      showNotice({
        tone: 'error',
        message: error?.message || 'Resume import failed. The blank resume is still editable.',
      });
    } finally {
      setImportState(IDLE_IMPORT_STATE);
    }
  }

  return {
    closeImport,
    importState,
    isImporting,
    isModalOpen,
    openImport,
    uploadResume,
  };
}
