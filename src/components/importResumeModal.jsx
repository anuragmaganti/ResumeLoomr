import { useState } from 'react';
import { validateImportResumeFile } from '../lib/importResume.js';

export default function ImportResumeModal({
  isOpen,
  busy,
  onClose,
  onUpload,
}) {
  const [selectedFile, setSelectedFile] = useState(null);
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
    onUpload(selectedFile);
  }

  return (
    <div className="authOverlay importResumeOverlay" role="presentation">
      <div className="authBackdrop" onClick={resetAndClose} aria-hidden="true" />
      <section className="authDialog importResumeDialog panel" role="dialog" aria-modal="true" aria-labelledby="import-resume-title">
        <div className="authDialogHeader importResumeHeader">
          <h2 id="import-resume-title">Import an existing resume</h2>
          <button type="button" className="authCloseButton" onClick={resetAndClose} aria-label="Close import" disabled={busy}>
            x
          </button>
        </div>

        <p className="authIntro">
          Upload a PDF, DOCX, PNG, JPG, or JPEG under 3 MB. ResumeLoomr will create a new resume and place the extracted details into the editor.
        </p>

        <form className="importResumeForm" onSubmit={handleSubmit}>
          <label className={`importResumeDropzone${selectedFile ? ' hasFile' : ''}`} aria-label="Choose resume file to import">
            <input
              type="file"
              accept=".pdf,.docx,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg"
              onChange={handleFileChange}
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
            {selectedFile ? (
              <span className="importResumeDropzoneTitle">
                {selectedFile.name}
              </span>
            ) : null}
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
