import { useState } from 'react';
import {
  IMPORT_FILE_ACCEPT,
  IMPORT_FILE_MAX_MEGABYTES,
  IMPORT_FILE_TYPES_LABEL,
} from '../lib/importFileTypes.js';
import { validateImportDocumentFile } from '../lib/importDocument.js';

function ImportFileSlot({ label, file, busy, onChange }) {
  const error = file ? validateImportDocumentFile(file, label.toLowerCase()) : '';
  return (
    <div className={`importDocumentSlot${file ? ' hasFile' : ''}`}>
      <div className="importDocumentSlotHeader">
        <span>{label}</span>
        <span className="importDocumentOptional">Optional</span>
      </div>
      <label className="importResumeDropzone" aria-label={`Choose ${label.toLowerCase()} file to import`}>
        <input
          type="file"
          accept={IMPORT_FILE_ACCEPT}
          onChange={(event) => onChange(event.target.files?.[0] || null)}
          disabled={busy}
        />
        <span className="importResumeDropzoneIcon" aria-hidden="true">
          <svg viewBox="0 0 48 48" focusable="false">
            <path className="importResumeIconPage" d="M15 6h13.5L38 15.5V40a2 2 0 0 1-2 2H15a5 5 0 0 1-5-5V11a5 5 0 0 1 5-5Z" />
            <path className="importResumeIconFold" d="M28 7v9h9" />
            <path className="importResumeIconArrow" d="M24 18v14m0 0-5-5m5 5 5-5" />
            <path className="importResumeIconTray" d="M17 36h14" />
          </svg>
        </span>
        <span className="importDocumentFileName">{file?.name || `Choose ${label.toLowerCase()}`}</span>
      </label>
      {error ? <p className="authError" role="alert">{error}</p> : null}
    </div>
  );
}

export default function ImportResumeModal({
  isOpen,
  busy,
  importState,
  resumeOptions,
  activeResumeId,
  onClose,
  onUpload,
  onImportSuccessful,
}) {
  const [resumeFile, setResumeFile] = useState(null);
  const [coverLetterFile, setCoverLetterFile] = useState(null);
  const [targetResumeId, setTargetResumeId] = useState(activeResumeId);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const resolvedTargetResumeId = resumeOptions.some((resume) => resume.id === targetResumeId)
    ? targetResumeId
    : activeResumeId;
  const targetResume = resumeOptions.find((resume) => resume.id === resolvedTargetResumeId);
  const existingCoverLetter = targetResume?.coverLetters?.[0] || null;
  const importingCoverOnly = Boolean(coverLetterFile && !resumeFile);
  const replacementRequired = importingCoverOnly && Boolean(existingCoverLetter);
  const resumeError = resumeFile ? validateImportDocumentFile(resumeFile, 'resume') : '';
  const coverLetterError = coverLetterFile
    ? validateImportDocumentFile(coverLetterFile, 'cover letter')
    : '';
  const canUpload = Boolean(resumeFile || coverLetterFile)
    && !resumeError
    && !coverLetterError
    && (!importingCoverOnly || resolvedTargetResumeId)
    && (!replacementRequired || replaceExisting)
    && !busy;
  const actionLabel = resumeFile && coverLetterFile
    ? 'Import both'
    : coverLetterFile ? 'Import cover letter' : 'Import resume';

  function resetAndClose() {
    if (busy) return;
    setResumeFile(null);
    setCoverLetterFile(null);
    setTargetResumeId(activeResumeId);
    setReplaceExisting(false);
    setError('');
    onClose();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!canUpload) {
      setError(resumeError || coverLetterError || 'Choose at least one document to import.');
      return;
    }
    setError('');
    const result = await onUpload({
      resumeFile,
      coverLetterFile,
      targetResumeId: importingCoverOnly ? resolvedTargetResumeId : '',
      replaceCoverLetterId: replacementRequired && replaceExisting ? existingCoverLetter.id : '',
    });
    if (result?.status === 'complete') {
      setResumeFile(null);
      setCoverLetterFile(null);
      setReplaceExisting(false);
    }
  }

  return (
    <div className="authOverlay importResumeOverlay" role="presentation">
      <button type="button" className="authBackdrop" onClick={resetAndClose} aria-label="Close import" disabled={busy} />
      <section className="authDialog importResumeDialog importDocumentDialog panel" role="dialog" aria-modal="true" aria-labelledby="import-resume-title">
        <div className="authDialogHeader importResumeHeader">
          <div>
            <h2 id="import-resume-title">Import resume and/or cover letter</h2>
            <p>Upload {IMPORT_FILE_TYPES_LABEL} files up to {IMPORT_FILE_MAX_MEGABYTES} MB each.</p>
          </div>
          <button type="button" className="authCloseButton" onClick={resetAndClose} aria-label="Close import" disabled={busy}>×</button>
        </div>

        <form className="importResumeForm" onSubmit={handleSubmit}>
          <div className="importDocumentGrid">
            <ImportFileSlot label="Resume" file={resumeFile} busy={busy} onChange={setResumeFile} />
            <ImportFileSlot label="Cover letter" file={coverLetterFile} busy={busy} onChange={setCoverLetterFile} />
          </div>

          {importingCoverOnly ? (
            <div className="importDocumentTarget">
              <label htmlFor="cover-letter-target">Attach to resume</label>
              <select
                id="cover-letter-target"
                value={resolvedTargetResumeId}
                onChange={(event) => {
                  setTargetResumeId(event.target.value);
                  setReplaceExisting(false);
                }}
                disabled={busy}
              >
                {resumeOptions.map((resume) => <option key={resume.id} value={resume.id}>{resume.name}</option>)}
              </select>
              {replacementRequired ? (
                <label className="importDocumentReplace">
                  <input type="checkbox" checked={replaceExisting} onChange={(event) => setReplaceExisting(event.target.checked)} />
                  <span>Replace “{existingCoverLetter.name}” after the new file finishes importing</span>
                </label>
              ) : null}
            </div>
          ) : null}

          {importState.status === 'partial' ? (
            <div className="importDocumentPartial" role="alert">
              <strong>One file finished and one failed.</strong>
              <span>{importState.failures.map((failure) => failure.message).join(' ')}</span>
              <button type="button" className="button buttonSecondary" onClick={onImportSuccessful}>
                Import successful file only
              </button>
            </div>
          ) : null}
          {error || importState.status === 'error' ? (
            <p className="authError" role="alert">{error || importState.message}</p>
          ) : null}

          <div className="importResumeActions">
            <button type="button" className="button buttonSecondary" onClick={resetAndClose} disabled={busy}>Cancel</button>
            <button type="submit" className="button buttonPrimary" disabled={!canUpload}>
              {busy ? 'Processing…' : actionLabel}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
