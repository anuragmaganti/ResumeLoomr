import { useRef } from 'react';
import { createPortal } from 'react-dom';

import { useDismissibleLayer } from '../hooks/useDismissibleLayer.js';

const LABEL_COPY = {
  'keyword-alignment': 'Keyword aligned',
  impact: 'Stronger impact',
  clarity: 'Clearer',
  concise: 'More concise',
};
const DECISION_OPTIONS = [['rejected', 'Reject'], ['approved', 'Approve']];

function labelCopy(label) {
  const copy = LABEL_COPY[label] || label.replaceAll('-', ' ');
  return `${copy.charAt(0).toUpperCase()}${copy.slice(1)}`;
}

export function TailoringChangeText({ change, children, onOpen }) {
  if (!change) return children;

  function openChange(event) {
    event.preventDefault();
    event.stopPropagation();
    onOpen?.(change.id, event.currentTarget.getBoundingClientRect());
  }

  return (
    <span
      className={`tailoringPreviewChange tailoringPreviewChange--${change.operation} is-${change.decision}`}
      data-tailoring-change-id={change.id}
      data-preview-no-drag="true"
      role="button"
      tabIndex="0"
      onPointerDown={(event) => event.stopPropagation()}
      onClick={openChange}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') openChange(event);
      }}
    >
      {children}
    </span>
  );
}

export function TailoringReviewDock({ review, onApproveAll, onRejectAll, onApply, onCancel }) {
  const counts = { approved: 0, pending: 0 };
  for (const change of review.changes) {
    if (change.decision in counts) counts[change.decision] += 1;
  }

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
  const change = review?.changes.find((candidate) => candidate.id === activeChange?.changeId) || null;

  useDismissibleLayer({
    closeOnResize: true,
    enabled: Boolean(change),
    eventTarget: 'window',
    layerRef: popoverRef,
    onDismiss: onClose,
  });

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
          {change.labels.map((label) => <span key={label}>{labelCopy(label)}</span>)}
        </div>
        <button type="button" onClick={onClose} aria-label="Close suggestion">×</button>
      </div>
      <div className="tailoringChangeDiff">
        <div><span>Before</span><p>{before}</p></div>
        <div><span>Suggested</span><p>{after}</p></div>
      </div>
      {change.note ? <p className="tailoringChangeNote">{change.note}</p> : null}
      <div className="tailoringChangeActions">
        {DECISION_OPTIONS.map(([decision, label]) => (
          <button
            type="button"
            className={`button buttonSecondary tailoringDecisionButton tailoringDecisionButton--${decision === 'rejected' ? 'reject' : 'approve'}${change.decision === decision ? ' isSelected' : ''}`}
            key={decision}
            onClick={() => onDecision(change.id, decision)}
          >
            {label}
          </button>
        ))}
      </div>
    </aside>,
    document.body,
  );
}
