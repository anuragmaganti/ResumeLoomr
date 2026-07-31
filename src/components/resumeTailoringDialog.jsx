import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useDialogKeyboard } from '../hooks/useDialogKeyboard.js';
import {
  JOB_LISTING_FILE_ACCEPT,
  JOB_LISTING_FILE_MAX_MEGABYTES,
  normalizePublicJobListingUrl,
  validateJobListingFile,
} from '../lib/jobListingInput.js';
import { trimText } from '../lib/text.js';

const SOURCE_OPTIONS = [
  { id: 'url', label: 'Link' },
  { id: 'file', label: 'Upload' },
  { id: 'text', label: 'Paste' },
];

export default function ResumeTailoringDialog({
  busy,
  error,
  onClose,
  onSubmit,
}) {
  const dialogRef = useRef(null);
  const [sourceType, setSourceType] = useState('url');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState(null);
  const [listingText, setListingText] = useState('');
  const [instructions, setInstructions] = useState('');
  const [validationError, setValidationError] = useState('');

  useDialogKeyboard({ busy, dialogRef, initialFocus: 'input, textarea, button', onClose });

  if (typeof document === 'undefined') return null;

  function prepareSource() {
    if (sourceType === 'url') {
      const normalizedUrl = normalizePublicJobListingUrl(url);
      return normalizedUrl
        ? { type: 'url', url: normalizedUrl }
        : 'Enter a complete, public job listing URL.';
    }
    if (sourceType === 'file') {
      return validateJobListingFile(file) || { type: 'file', file };
    }
    const text = trimText(listingText);
    return text.length >= 80
      ? { type: 'text', text }
      : 'Paste more of the job listing so the role can be matched accurately.';
  }

  function handleSubmit(event) {
    event.preventDefault();
    const source = prepareSource();
    if (typeof source === 'string') {
      setValidationError(source);
      return;
    }

    setValidationError('');
    onSubmit({
      source,
      instructions: trimText(instructions),
    });
  }

  return createPortal(
    <div className="authOverlay resumeTailoringOverlay">
      <button type="button" className="authBackdrop" onClick={onClose} aria-label="Close job tailoring" disabled={busy} />
      <section
        ref={dialogRef}
        className="authDialog panel resumeTailoringDialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="resume-tailoring-title"
      >
        <div className="authDialogHeader importResumeHeader">
          <h2 id="resume-tailoring-title">Tailor your resume to a job</h2>
          <button type="button" className="authCloseButton" onClick={onClose} aria-label="Close" disabled={busy}>×</button>
        </div>

        <form className="resumeTailoringForm" onSubmit={handleSubmit}>
          <div className="authModeTabs resumeTailoringSourceTabs" role="tablist" aria-label="Job listing source">
            {SOURCE_OPTIONS.map((option) => (
              <button
                type="button"
                role="tab"
                aria-selected={sourceType === option.id}
                className={`authModeTab${sourceType === option.id ? ' isActive' : ''}`}
                key={option.id}
                onClick={() => {
                  setSourceType(option.id);
                  setValidationError('');
                }}
                disabled={busy}
              >
                {option.label}
              </button>
            ))}
          </div>

          <div className="resumeTailoringSourcePanel">
            {sourceType === 'url' ? (
              <label className="authField resumeTailoringField">
                <span>Job listing link</span>
                <input
                  type="url"
                  inputMode="url"
                  autoComplete="url"
                  placeholder="https://company.com/jobs/software-engineer"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  disabled={busy}
                />
              </label>
            ) : null}
            {sourceType === 'file' ? (
              <label className={`resumeTailoringFile${file ? ' hasFile' : ''}`}>
                <input
                  type="file"
                  accept={JOB_LISTING_FILE_ACCEPT}
                  onChange={(event) => setFile(event.target.files?.[0] || null)}
                  disabled={busy}
                />
                <span className="resumeTailoringFileIcon" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M7 3.75h7l4 4V20H7zM14 3.75v4h4M12.5 10.5v5m0-5-2 2m2-2 2 2" /></svg>
                </span>
                <span><strong>{file?.name || 'Choose PDF or DOCX'}</strong><small>Up to {JOB_LISTING_FILE_MAX_MEGABYTES} MB</small></span>
              </label>
            ) : null}
            {sourceType === 'text' ? (
              <label className="authField resumeTailoringField">
                <span>Job listing text</span>
                <textarea
                  rows="8"
                  placeholder="Paste the responsibilities, qualifications, and role description here."
                  value={listingText}
                  onChange={(event) => setListingText(event.target.value)}
                  disabled={busy}
                />
              </label>
            ) : null}
          </div>

          <label className="authField resumeTailoringField">
            <span>Additional direction <small>Optional</small></span>
            <textarea
              rows="3"
              placeholder="Examples: Emphasize backend engineering; keep the tone concise; prioritize AWS and distributed systems; target senior-level scope; preserve my current summary length."
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              disabled={busy}
            />
          </label>

          {validationError || error ? <p className="authError" role="alert">{validationError || error}</p> : null}

          <div className="resumeTailoringPrivacy">
            Contact details, dates, locations, layout settings, and storage metadata are not sent for tailoring.
          </div>
          <div className="importResumeActions resumeTailoringActions">
            <button type="button" className="button buttonSecondary" onClick={onClose} disabled={busy}>Cancel</button>
            <button type="submit" className="button buttonPrimary" disabled={busy}>
              {busy ? 'Generating suggestions…' : 'Generate suggestions'}
            </button>
          </div>
        </form>
      </section>
    </div>,
    document.body,
  );
}
