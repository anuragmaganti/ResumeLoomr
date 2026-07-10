import { useEffect, useRef, useState } from 'react';

function KeepOnBrowserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect x="3.5" y="4.5" width="17" height="12" rx="2.5" />
      <path d="M8.5 20h7M12 16.5V20m-2.2-9 1.5 1.5 3-3" />
    </svg>
  );
}

function RemoveFromBrowserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M4 7h16M9 7V4.5h6V7m3 0-.7 12H6.7L6 7m4 3.5v5m4-5v5" />
    </svg>
  );
}

function CloudSafeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M7.2 18.5h10a4.3 4.3 0 0 0 .5-8.6A6.2 6.2 0 0 0 6 8.7a4.9 4.9 0 0 0 1.2 9.8Z" />
      <path d="m9.2 13.2 1.8 1.8 3.8-4" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="m5.5 5.5 9 9m0-9-9 9" />
    </svg>
  );
}

export default function SignedOutEditingPrompt({
  isOpen,
  busy,
  onCancel,
  onChoose,
}) {
  const [rememberChoice, setRememberChoice] = useState(false);
  const [pendingChoice, setPendingChoice] = useState(null);
  const dialogRef = useRef(null);
  const keepButtonRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    previousFocusRef.current = document.activeElement;
    const focusFrame = window.requestAnimationFrame(() => keepButtonRef.current?.focus());

    return () => {
      window.cancelAnimationFrame(focusFrame);
      const previousFocus = previousFocusRef.current;

      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus();
      }
    };
  }, [isOpen]);

  if (!isOpen) {
    return null;
  }

  function choose(allow) {
    const skipPrompt = rememberChoice;

    setPendingChoice(allow ? 'keep' : 'remove');
    setRememberChoice(false);
    onChoose({
      allow,
      skipPrompt,
    });
  }

  function cancel() {
    setRememberChoice(false);
    setPendingChoice(null);
    onCancel();
  }

  function handleKeyDown(event) {
    if (event.key === 'Escape') {
      if (!busy) {
        event.preventDefault();
        cancel();
      }
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const focusableElements = dialogRef.current?.querySelectorAll(
      'button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
    );

    if (!focusableElements?.length) {
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  return (
    <div className="authOverlay signedOutPromptOverlay" role="presentation">
      <button
        type="button"
        className="authBackdrop signedOutPromptBackdrop"
        onClick={busy ? undefined : cancel}
        aria-label="Stay signed in"
        tabIndex={-1}
      />
      <section
        className="signedOutPrompt panel"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="signed-out-prompt-title"
        aria-describedby="signed-out-prompt-description signed-out-cloud-note"
        aria-busy={busy}
        onKeyDown={handleKeyDown}
      >
        <header className="signedOutPromptHeader">
          <div>
            <p className="signedOutPromptEyebrow">Sign out</p>
            <h2 id="signed-out-prompt-title">Keep resumes on this browser?</h2>
          </div>
          <button
            type="button"
            className="signedOutPromptClose"
            onClick={cancel}
            aria-label="Stay signed in"
            disabled={busy}
          >
            <CloseIcon />
          </button>
        </header>

        <p className="signedOutPromptIntro" id="signed-out-prompt-description">
          Choose what happens to your local resume copies after you sign out.
        </p>

        <div className="signedOutPromptChoices">
          <button
            ref={keepButtonRef}
            type="button"
            className="signedOutChoice signedOutChoice--keep"
            onClick={() => choose(true)}
            disabled={busy}
          >
            <span className="signedOutChoiceIcon"><KeepOnBrowserIcon /></span>
            <span className="signedOutChoiceCopy">
              <strong>{busy && pendingChoice === 'keep' ? 'Signing out...' : 'Keep on this browser'}</strong>
              <small>Continue editing these resumes here while signed out.</small>
            </span>
            <span className="signedOutChoiceArrow" aria-hidden="true">&rarr;</span>
          </button>

          <button
            type="button"
            className="signedOutChoice signedOutChoice--remove"
            onClick={() => choose(false)}
            disabled={busy}
          >
            <span className="signedOutChoiceIcon"><RemoveFromBrowserIcon /></span>
            <span className="signedOutChoiceCopy">
              <strong>{busy && pendingChoice === 'remove' ? 'Syncing before removal...' : 'Remove from this browser'}</strong>
              <small>Sync first, then clear only this browser&apos;s local copies.</small>
            </span>
            <span className="signedOutChoiceArrow" aria-hidden="true">&rarr;</span>
          </button>
        </div>

        <p className="signedOutCloudNote" id="signed-out-cloud-note">
          <CloudSafeIcon />
          <span>Your cloud resumes are not deleted with either choice.</span>
        </p>

        <label className="signedOutPromptRemember">
          <input
            type="checkbox"
            checked={rememberChoice}
            onChange={(event) => setRememberChoice(event.target.checked)}
            disabled={busy}
          />
          <span className="signedOutRememberCheck" aria-hidden="true">
            <svg viewBox="0 0 14 14" focusable="false"><path d="m3 7.2 2.4 2.4L11 4.4" /></svg>
          </span>
          <span>Remember my choice</span>
        </label>
      </section>
    </div>
  );
}
