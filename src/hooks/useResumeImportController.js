import { useEffect, useRef, useState } from 'react';
import { importDocumentFile } from '../lib/importDocument.js';

const IDLE_IMPORT_STATE = { status: 'idle' };

export function useResumeImportController({
  authUser,
  openAuthModal,
  endTransientSampleEntry,
  importDocuments,
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
    setImportState(IDLE_IMPORT_STATE);
    setIsModalOpen(true);
  }

  function closeImport() {
    if (isImporting) return;
    setImportState(IDLE_IMPORT_STATE);
    setIsModalOpen(false);
  }

  async function commitParsedImports({ selection, resumeImport = null, coverLetterImport = null, importUser }) {
    if (authUserRef.current?.uid !== importUser.uid) {
      throw new Error('Your account changed before the imported documents could be saved.');
    }
    const result = await importDocuments({
      resumeImport: resumeImport ? {
        draft: resumeImport.draft,
        name: resumeImport.suggestedName || selection.resumeFile?.name,
      } : null,
      coverLetterImport: coverLetterImport ? {
        draft: coverLetterImport.draft,
        name: coverLetterImport.suggestedName || selection.coverLetterFile?.name,
      } : null,
      targetResumeId: selection.targetResumeId,
      replaceCoverLetterId: selection.replaceCoverLetterId,
      expectedAccountUid: importUser.uid,
    });
    const warningCount = [resumeImport, coverLetterImport]
      .flatMap((item) => item?.draft?.importWarnings || []).length;
    showNotice({
      tone: warningCount > 0 ? 'warning' : 'success',
      message: warningCount > 0
        ? 'Import complete. Some details may need review.'
        : (resumeImport && coverLetterImport
          ? 'Resume and cover letter imported.'
          : `${coverLetterImport ? 'Cover letter' : 'Resume'} imported.`),
    });
    setImportState(IDLE_IMPORT_STATE);
    setIsModalOpen(false);
    return result;
  }

  async function uploadDocuments(selection) {
    if (!authUser) {
      setIsModalOpen(false);
      openAuthModal?.();
      return { status: 'error' };
    }
    const importUser = authUser;
    const jobs = [
      selection.resumeFile
        ? { kind: 'resume', file: selection.resumeFile, resumeId: '' }
        : null,
      selection.coverLetterFile
        ? {
            kind: 'coverLetter',
            file: selection.coverLetterFile,
            resumeId: selection.resumeFile ? '' : selection.targetResumeId,
          }
        : null,
    ].filter(Boolean);

    setImportState({ status: 'processing', kinds: jobs.map((job) => job.kind) });
    try {
      const idToken = await importUser.getIdToken();
      const settled = await Promise.allSettled(jobs.map((job) => importDocumentFile({
        file: job.file,
        documentKind: job.kind,
        resumeId: job.resumeId,
        idToken,
      })));
      if (authUserRef.current?.uid !== importUser.uid) {
        throw new Error('The import finished after your account changed, so it was not applied.');
      }

      const parsedByKind = {};
      const failures = [];
      settled.forEach((result, index) => {
        const job = jobs[index];
        if (result.status === 'fulfilled') parsedByKind[job.kind] = result.value;
        else failures.push({ kind: job.kind, message: result.reason?.message || `${job.kind} import failed.` });
      });

      if (failures.length > 0 && Object.keys(parsedByKind).length > 0) {
        setImportState({
          status: 'partial',
          selection,
          importUser,
          resumeImport: parsedByKind.resume || null,
          coverLetterImport: parsedByKind.coverLetter || null,
          failures,
        });
        return { status: 'partial' };
      }
      if (failures.length > 0) throw new Error(failures[0].message);

      await commitParsedImports({
        selection,
        importUser,
        resumeImport: parsedByKind.resume || null,
        coverLetterImport: parsedByKind.coverLetter || null,
      });
      return { status: 'complete' };
    } catch (error) {
      setImportState({ status: 'error', message: error?.message || 'Document import failed.' });
      return { status: 'error' };
    }
  }

  async function importSuccessfulDocument() {
    if (importState.status !== 'partial') return;
    setImportState({ status: 'processing', kinds: [] });
    try {
      await commitParsedImports(importState);
    } catch (error) {
      setImportState({ status: 'error', message: error?.message || 'The imported document could not be saved.' });
    }
  }

  return {
    closeImport,
    importState,
    importSuccessfulDocument,
    isImporting,
    isModalOpen,
    openImport,
    uploadDocuments,
  };
}
