import { useState } from 'react';

export default function AuthModal({
  isOpen,
  busy,
  error,
  trustedDevice,
  onTrustedDeviceChange,
  onClose,
  onGoogleSignIn,
  onEmailSignIn,
  onEmailSignUp,
}) {
  const [mode, setMode] = useState('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (!isOpen) {
    return null;
  }

  function handleSubmit(event) {
    event.preventDefault();

    if (mode === 'signin') {
      onEmailSignIn(email, password);
      return;
    }

    onEmailSignUp(email, password);
  }

  return (
    <div className="authOverlay" role="presentation">
      <div className="authBackdrop" onClick={onClose} aria-hidden="true" />
      <section className="authDialog panel" role="dialog" aria-modal="true" aria-labelledby="auth-dialog-title">
        <div className="authDialogHeader">
          <div>
            <p className="authEyebrow">Account sync</p>
            <h2 id="auth-dialog-title">Save resumes across devices</h2>
          </div>
          <button type="button" className="authCloseButton" onClick={onClose} aria-label="Close sign in">
            x
          </button>
        </div>

        <p className="authIntro">
          Sign in to back up your resumes to Firebase and keep this editor open in the background.
        </p>

        <div className="authModeTabs" role="tablist" aria-label="Authentication mode">
          <button
            type="button"
            className={`authModeTab ${mode === 'signin' ? 'isActive' : ''}`}
            onClick={() => setMode('signin')}
            aria-selected={mode === 'signin'}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`authModeTab ${mode === 'signup' ? 'isActive' : ''}`}
            onClick={() => setMode('signup')}
            aria-selected={mode === 'signup'}
          >
            Create account
          </button>
        </div>

        <button type="button" className="button buttonSecondary authGoogleButton" disabled={busy} onClick={onGoogleSignIn}>
          Continue with Google
        </button>

        <div className="authDivider">
          <span>or</span>
        </div>

        <form className="authForm" onSubmit={handleSubmit}>
          <label className="authField">
            <span>Email</span>
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className="authField">
            <span>Password</span>
            <input
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              required
            />
          </label>

          <label className="trustedDeviceOption">
            <input
              type="checkbox"
              checked={trustedDevice}
              onChange={(event) => onTrustedDeviceChange(event.target.checked)}
            />
            <span>
              Trust this device for offline access. Resume data can stay cached in this browser.
            </span>
          </label>

          {error ? (
            <p className="authError" role="alert">{error}</p>
          ) : null}

          <button type="submit" className="button buttonPrimary authSubmitButton" disabled={busy}>
            {busy ? 'Working…' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </section>
    </div>
  );
}
