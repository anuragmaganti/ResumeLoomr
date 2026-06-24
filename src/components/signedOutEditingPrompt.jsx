import { useState } from 'react';

export default function SignedOutEditingPrompt({
  isOpen,
  busy,
  onCancel,
  onChoose,
}) {
  const [rememberChoice, setRememberChoice] = useState(false);

  if (!isOpen) {
    return null;
  }

  function choose(allow) {
    onChoose({
      allow,
      skipPrompt: rememberChoice,
    });
  }

  return (
    <div className="authOverlay" role="presentation">
      <div className="authBackdrop" onClick={onCancel} aria-hidden="true" />
      <section className="authDialog signedOutPrompt panel" role="dialog" aria-modal="true" aria-labelledby="signed-out-prompt-title">
        <div className="authDialogHeader">
          <div>
            <p className="authEyebrow">Before signing out</p>
            <h2 id="signed-out-prompt-title">Edit resumes while signed out?</h2>
          </div>
          <button type="button" className="authCloseButton" onClick={onCancel} aria-label="Cancel sign out">
            x
          </button>
        </div>

        <p className="authIntro">
          Choose Yes to keep local copies of your 10 most recent resumes on this browser so you can keep editing without signing in.
        </p>

        <div className="signedOutPromptNote">
          Click No if multiple people use this device. Your cloud resumes stay safe in your account either way.
        </div>

        <label className="trustedDeviceOption signedOutPromptRemember">
          <input
            type="checkbox"
            checked={rememberChoice}
            onChange={(event) => setRememberChoice(event.target.checked)}
          />
          <span>Don&apos;t ask me again. You can change this later in Settings.</span>
        </label>

        <div className="signedOutPromptActions">
          <button
            type="button"
            className="button buttonDanger"
            onClick={() => choose(false)}
            disabled={busy}
          >
            No, clear this browser
          </button>
          <button
            type="button"
            className="button buttonPrimary"
            onClick={() => choose(true)}
            disabled={busy}
          >
            Yes, keep local editing
          </button>
        </div>
      </section>
    </div>
  );
}
