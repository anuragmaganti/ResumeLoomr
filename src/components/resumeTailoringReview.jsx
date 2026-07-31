import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';

import { summarizeTailoringReview } from '../lib/resumeTailoring.js';

const LABEL_COPY = {
  'role-focused': 'Role focused',
  'keyword-alignment': 'Keyword aligned',
  impact: 'Stronger impact',
  clarity: 'Clearer',
  concise: 'More concise',
  grammar: 'Grammar',
  spelling: 'Spelling',
  reworded: 'Reworded',
  reordered: 'Reordered',
  added: 'Added',
  removed: 'Removed',
};

export function TailoringReviewDock({ review, onApproveAll, onRejectAll, onApply, onCancel }) {
  const counts = summarizeTailoringReview(review);

  return (
    <aside className="tailoringReviewDock" aria-label="Tailoring review">
      <div className="tailoringReviewDockCopy">
        <strong>Review job-match edits</strong>
        <span>{counts.pending} to review · {counts.approved} approved</span>
      </div>
      <div className="tailoringReviewDockActions">
        <button type="button" className="tailoringDockTextButton" onClick={onApproveAll}>Approve all</button>
        <button type="button" className="tailoringDockTextButton" onClick={onRejectAll}>Reject all</button>
        <button type="button" className="button buttonPrimary" onClick={onApply} disabled={counts.approved === 0}>
          Apply {counts.approved || ''}
        </button>
        <button type="button" className="tailoringDockClose" onClick={onCancel} aria-label="Cancel tailoring review">×</button>
      </div>
    </aside>
  );
}

function getPopoverPosition(anchorRect) {
  const width = Math.min(360, window.innerWidth - 24);
  const left = Math.min(
    Math.max(12, anchorRect?.left || 12),
    Math.max(12, window.innerWidth - width - 12),
  );
  const preferredTop = (anchorRect?.bottom || 20) + 8;
  const top = preferredTop + 290 <= window.innerHeight
    ? preferredTop
    : Math.max(12, (anchorRect?.top || 302) - 298);
  return { left, top, width };
}

export function TailoringChangePopover({ review, activeChange, onDecision, onClose }) {
  const popoverRef = useRef(null);
  const change = useMemo(
    () => review?.changes.find((candidate) => candidate.id === activeChange?.changeId) || null,
    [activeChange?.changeId, review],
  );

  useEffect(() => {
    if (!change) return undefined;
    function handlePointerDown(event) {
      if (!popoverRef.current?.contains(event.target)) onClose();
    }
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose();
    }
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', onClose);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', onClose);
    };
  }, [change, onClose]);

  if (!change || typeof document === 'undefined') return null;
  const style = getPopoverPosition(activeChange.anchorRect);
  const before = change.operation === 'add' ? 'New item' : change.target.currentValue;
  const after = change.operation === 'remove'
    ? 'Remove this item'
    : change.operation === 'move'
      ? `Move to position ${(change.position ?? 0) + 1}`
      : change.value;

  return createPortal(
    <aside
      ref={popoverRef}
      className="tailoringChangePopover"
      style={style}
      role="dialog"
      aria-label="Review suggested resume edit"
      data-preview-no-drag="true"
    >
      <div className="tailoringChangeHeader">
        <div className="tailoringChangeLabels">
          {change.labels.map((label) => <span key={label}>{LABEL_COPY[label] || label}</span>)}
        </div>
        <button type="button" onClick={onClose} aria-label="Close suggestion">×</button>
      </div>
      <div className="tailoringChangeDiff">
        <div><span>Before</span><p>{before}</p></div>
        <div><span>Suggested</span><p>{after}</p></div>
      </div>
      {change.note ? <p className="tailoringChangeNote">{change.note}</p> : null}
      <div className="tailoringChangeActions">
        <button
          type="button"
          className={`button buttonSecondary tailoringDecisionButton tailoringDecisionButton--reject${change.decision === 'rejected' ? ' isSelected' : ''}`}
          onClick={() => onDecision(change.id, 'rejected')}
        >
          Reject
        </button>
        <button
          type="button"
          className={`button buttonSecondary tailoringDecisionButton tailoringDecisionButton--approve${change.decision === 'approved' ? ' isSelected' : ''}`}
          onClick={() => onDecision(change.id, 'approved')}
        >
          Approve
        </button>
      </div>
    </aside>,
    document.body,
  );
}
