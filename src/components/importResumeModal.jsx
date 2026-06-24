import { useState } from 'react';
import {
  IMPORT_RESUME_MODE_FULL,
  IMPORT_RESUME_MODE_ONE_PAGE,
  validateImportResumeFile,
} from '../lib/importResume.js';

export default function ImportResumeModal({
  isOpen,
  busy,
  onClose,
  onUpload,
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [importMode, setImportMode] = useState(IMPORT_RESUME_MODE_FULL);
  const [error, setError] = useState('');

  if (!isOpen) {
    return null;
  }

  const fileError = selectedFile ? validateImportResumeFile(selectedFile) : '';
  const canUpload = Boolean(selectedFile) && !fileError && !busy;

  function handleFileChange(event) {
    const nextFile = event.target.files?.[0] || null;
    setSelectedFile(nextFile);
    setError(nextFile ? validateImportResumeFile(nextFile) : '');
  }

  function resetAndClose() {
    if (busy) {
      return;
    }

    setSelectedFile(null);
    setImportMode(IMPORT_RESUME_MODE_FULL);
    setError('');
    onClose();
  }

  function handleSubmit(event) {
    event.preventDefault();
    const validationError = validateImportResumeFile(selectedFile);

    if (validationError) {
      setError(validationError);
      return;
    }

    setSelectedFile(null);
    setError('');
    onUpload(selectedFile, importMode);
  }

  return (
    <div className="authOverlay importResumeOverlay" role="presentation">
      <div className="authBackdrop" onClick={resetAndClose} aria-hidden="true" />
      <section className="authDialog importResumeDialog panel" role="dialog" aria-modal="true" aria-labelledby="import-resume-title">
        <div className="authDialogHeader">
          <div>
            <p className="authEyebrow">Resume import</p>
            <h2 id="import-resume-title">Import an existing resume</h2>
          </div>
          <button type="button" className="authCloseButton" onClick={resetAndClose} aria-label="Close import" disabled={busy}>
            x
          </button>
        </div>

        <p className="authIntro">
          Upload a PDF or DOCX under 3 MB. ResumeLoomr will create a new resume and place the extracted details into the editor.
        </p>

        <form className="importResumeForm" onSubmit={handleSubmit}>
          <fieldset className="importResumeModeGroup">
            <legend>Import detail</legend>
            <label className={`importResumeModeOption ${importMode === IMPORT_RESUME_MODE_FULL ? 'importResumeModeOption--active' : ''}`}>
              <input
                type="radio"
                name="import-resume-mode"
                value={IMPORT_RESUME_MODE_FULL}
                checked={importMode === IMPORT_RESUME_MODE_FULL}
                onChange={() => setImportMode(IMPORT_RESUME_MODE_FULL)}
                disabled={busy}
              />
              <span>
                <strong>All content</strong>
                <small>Preserve every bullet, award, GPA, and coursework item. The resume may be longer than one page.</small>
              </span>
            </label>
            <label className={`importResumeModeOption ${importMode === IMPORT_RESUME_MODE_ONE_PAGE ? 'importResumeModeOption--active' : ''}`}>
              <input
                type="radio"
                name="import-resume-mode"
                value={IMPORT_RESUME_MODE_ONE_PAGE}
                checked={importMode === IMPORT_RESUME_MODE_ONE_PAGE}
                onChange={() => setImportMode(IMPORT_RESUME_MODE_ONE_PAGE)}
                disabled={busy}
              />
              <span>
                <strong>One page</strong>
                <small>Condense the resume for a shorter draft while keeping each major section represented.</small>
              </span>
            </label>
          </fieldset>

          <label className="importResumeDropzone">
            <input
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={handleFileChange}
              disabled={busy}
            />
            <span className="importResumeDropzoneTitle">
              {selectedFile ? selectedFile.name : 'Choose PDF or DOCX'}
            </span>
            <span className="importResumeDropzoneHint">
              The upload is processed securely on the server. Your AI key is never sent to this browser.
            </span>
          </label>

          {error || fileError ? (
            <p className="authError" role="alert">{error || fileError}</p>
          ) : null}

          <div className="importResumeActions">
            <button type="button" className="button buttonSecondary" onClick={resetAndClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="button buttonPrimary" disabled={!canUpload}>
              Upload
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
