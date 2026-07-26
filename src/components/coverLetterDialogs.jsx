import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { COVER_LETTER_TEMPLATE_OPTIONS } from '../lib/coverLetter.js';
import { trapTabKey } from '../lib/focusTrap.js';

function TemplateMiniature({ template }) {
  return (
    <span className={`coverLetterTemplateMiniature coverLetterTemplateMiniature--${template}`} aria-hidden="true">
      <span className="coverLetterTemplateMiniName" />
      <span className="coverLetterTemplateMiniContact" />
      <span className="coverLetterTemplateMiniRecipient" />
      <span className="coverLetterTemplateMiniLine coverLetterTemplateMiniLine--wide" />
      <span className="coverLetterTemplateMiniLine" />
      <span className="coverLetterTemplateMiniLine coverLetterTemplateMiniLine--short" />
      <span className="coverLetterTemplateMiniSignature" />
    </span>
  );
}

export function CoverLetterTemplateDialog({
  isOpen,
  initialTemplate = 'compact',
  busy = false,
  onClose,
  onCreate,
}) {
  const dialogRef = useRef(null);
  const [selectedTemplate, setSelectedTemplate] = useState(initialTemplate);

  useEffect(() => {
    if (!isOpen) return undefined;
    const frameId = window.requestAnimationFrame(() => dialogRef.current?.querySelector('button')?.focus());

    function handleKeyDown(event) {
      if (event.key === 'Escape' && !busy) {
        event.preventDefault();
        onClose();
        return;
      }
      trapTabKey(event, dialogRef.current);
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frameId);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [busy, initialTemplate, isOpen, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div className="authOverlay coverLetterTemplateOverlay">
      <button type="button" className="authBackdrop" onClick={onClose} aria-label="Close template chooser" disabled={busy} />
      <section
        ref={dialogRef}
        className="authDialog panel coverLetterTemplateDialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cover-letter-template-title"
      >
        <div className="authDialogHeader">
          <div>
            <p className="coverLetterDialogEyebrow">Cover letter</p>
            <h2 id="cover-letter-template-title">Choose a template</h2>
          </div>
          <button type="button" className="authCloseButton" onClick={onClose} aria-label="Close" disabled={busy}>×</button>
        </div>
        <div className="coverLetterTemplateGrid" role="radiogroup" aria-label="Cover letter templates">
          {COVER_LETTER_TEMPLATE_OPTIONS.map((option) => (
            <button
              type="button"
              role="radio"
              aria-checked={selectedTemplate === option.id}
              className={`coverLetterTemplateCard${selectedTemplate === option.id ? ' isSelected' : ''}`}
              key={option.id}
              onClick={() => setSelectedTemplate(option.id)}
            >
              <TemplateMiniature template={option.id} />
              <span className="coverLetterTemplateName">{option.label}</span>
            </button>
          ))}
        </div>
        <div className="coverLetterDialogActions">
          <button type="button" className="button buttonSecondary" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className="button buttonPrimary" onClick={() => onCreate(selectedTemplate)} disabled={busy}>
            {busy ? 'Creating…' : 'Create cover letter'}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

export function CoverLetterDeleteDialog({ letter, busy = false, onCancel, onConfirm }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!letter) return undefined;
    const frameId = window.requestAnimationFrame(() => dialogRef.current?.querySelector('[data-cancel]')?.focus());
    function handleKeyDown(event) {
      if (event.key === 'Escape' && !busy) {
        event.preventDefault();
        onCancel();
        return;
      }
      trapTabKey(event, dialogRef.current);
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frameId);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [busy, letter, onCancel]);

  if (!letter || typeof document === 'undefined') return null;

  return createPortal(
    <div className="authOverlay">
      <button type="button" className="authBackdrop" onClick={onCancel} aria-label="Cancel cover letter deletion" disabled={busy} />
      <section ref={dialogRef} className="authDialog panel coverLetterDeleteDialog" role="alertdialog" aria-modal="true" aria-labelledby="cover-letter-delete-title">
        <div className="coverLetterDeleteIcon" aria-hidden="true">×</div>
        <h2 id="cover-letter-delete-title">Delete {letter.name || 'cover letter'}?</h2>
        <p>The attached resume will stay in your workspace. This cover letter will be removed from this browser and your synced account.</p>
        <div className="coverLetterDialogActions">
          <button data-cancel type="button" className="button buttonSecondary" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className="button buttonDanger" onClick={onConfirm} disabled={busy}>{busy ? 'Deleting…' : 'Delete cover letter'}</button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
