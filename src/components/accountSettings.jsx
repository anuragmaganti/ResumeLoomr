import { useState } from 'react';

function formatAccountName(account, fallback = 'Unknown account') {
  return account?.email || account?.displayName || fallback;
}

export default function AccountSettings({
  isOpen,
  saveState,
  saveLabel,
  theme,
  authUser,
  connectedAccount,
  firebaseEnabled,
  signedOutEditingPreference,
  busy,
  onOpen,
  onClose,
  onToggleTheme,
  onOpenAuth,
  onDisconnectBrowser,
  onSignedOutEditingPreferenceChange,
}) {
  const [isConfirmingDisconnect, setIsConfirmingDisconnect] = useState(false);
  const [isThemeAnimating, setIsThemeAnimating] = useState(false);
  const activeAccount = authUser
    ? {
        uid: authUser.uid,
        email: authUser.email || '',
        displayName: authUser.displayName || '',
      }
    : connectedAccount;
  const accountName = formatAccountName(activeAccount);
  const isSignedIn = Boolean(authUser);
  const hasRememberedAccount = Boolean(connectedAccount?.uid);
  const connectionMode = isSignedIn
    ? 'Signed in and syncing to your account'
    : hasRememberedAccount
      ? 'Signed out, but this browser has local resume data from an account'
      : 'Local-only browser';
  const disconnectTitle = isSignedIn ? 'Disconnect this browser?' : 'Clear local resume data?';
  const disconnectBody = isSignedIn
    ? 'This signs you out, removes local resume data and account connection markers from this browser, and returns the app to a fresh local-only workspace. Your cloud resumes stay in your account.'
    : 'This removes the local resumes and saved account connection from this browser, then starts a fresh local-only workspace. This cannot be undone from this browser.';

  function closeSettings() {
    setIsConfirmingDisconnect(false);
    onClose();
  }

  async function confirmDisconnect() {
    await onDisconnectBrowser();
  }

  function handleThemeToggle() {
    setIsThemeAnimating(true);
    onToggleTheme();
  }

  return (
    <>
      <div className={`floatingSaveStatus statusBadge statusBadge--${saveState}`} role="status">
        {saveLabel}
      </div>

      <button
        type="button"
        className={[
          'floatingThemeToggle',
          `is-${theme}`,
          isThemeAnimating ? 'isAnimating' : '',
        ].filter(Boolean).join(' ')}
        onClick={handleThemeToggle}
        onAnimationEnd={() => setIsThemeAnimating(false)}
        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
        aria-pressed={theme === 'dark'}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
          <g className="themeSunRays">
            <path d="M12 2.8v2" />
            <path d="M12 19.2v2" />
            <path d="m4.8 4.8 1.4 1.4" />
            <path d="m17.8 17.8 1.4 1.4" />
            <path d="M2.8 12h2" />
            <path d="M19.2 12h2" />
            <path d="m4.8 19.2 1.4-1.4" />
            <path d="m17.8 6.2 1.4-1.4" />
          </g>
          <circle className="themeSunCore" cx="12" cy="12" r="4.1" />
          <path className="themeMoon" d="M18.4 14.3A6.9 6.9 0 0 1 9.7 5.6 7 7 0 1 0 18.4 14.3Z" />
        </svg>
      </button>

      <button
        type="button"
        className="settingsLauncher"
        onClick={onOpen}
        aria-label="Open account and browser settings"
        aria-expanded={isOpen}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
          <path d="M9.2 4.5 9.8 2h4.4l.6 2.5c.5.2.9.3 1.3.6l2.3-1.1 2.2 3.8-2 1.5c.1.5.2.9.2 1.4s-.1.9-.2 1.4l2 1.5-2.2 3.8-2.3-1.1c-.4.3-.8.5-1.3.6l-.6 2.5H9.8l-.6-2.5c-.5-.2-.9-.3-1.3-.6l-2.3 1.1-2.2-3.8 2-1.5c-.1-.5-.2-.9-.2-1.4s.1-.9.2-1.4l-2-1.5L5.6 4l2.3 1.1c.4-.3.8-.5 1.3-.6Z" />
          <circle cx="12" cy="12" r="3.1" />
        </svg>
      </button>

      {isOpen ? (
        <div className="accountSettingsOverlay" role="presentation">
          <button type="button" className="accountSettingsBackdrop" onClick={closeSettings} aria-label="Close settings" />
          <section
            className="accountSettingsPanel panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-settings-title"
          >
            <div className="accountSettingsHeader">
              <div>
                <h2 id="account-settings-title">Settings</h2>
              </div>
              <button type="button" className="authCloseButton" onClick={closeSettings} aria-label="Close settings">
                x
              </button>
            </div>

            <div className="connectionSummary">
              <div className={`connectionOrb ${isSignedIn ? 'isCloud' : hasRememberedAccount ? 'isRemembered' : ''}`} aria-hidden="true" />
              <div>
                <p className="connectionMode">{connectionMode}</p>
                <p className="connectionAccount">
                  {isSignedIn || hasRememberedAccount ? accountName : 'No account connected'}
                </p>
              </div>
            </div>

            <div className="signedOutEditingSettings">
              <div>
                <h3>Keep resumes available after sign out</h3>
                <p>
                  Stores resumes on this browser so you can edit without signing in. Turn off on shared computers.
                </p>
              </div>
              <label className="settingsCheckboxRow">
                <input
                  type="checkbox"
                  checked={signedOutEditingPreference.allow}
                  onChange={(event) => onSignedOutEditingPreferenceChange({
                    ...signedOutEditingPreference,
                    allow: event.target.checked,
                  })}
                />
                <span>
                  Keep resumes available after sign out
                </span>
              </label>
              <label className="settingsCheckboxRow">
                <input
                  type="checkbox"
                  checked={!signedOutEditingPreference.skipPrompt}
                  onChange={(event) => onSignedOutEditingPreferenceChange({
                    ...signedOutEditingPreference,
                    skipPrompt: !event.target.checked,
                  })}
                />
                <span>
                  Ask me when I sign out. If you turn this off, this setting will be used automatically.
                </span>
              </label>
              {!signedOutEditingPreference.allow ? (
                <p className="signedOutEditingWarning">
                  When you sign out, local resume copies will be cleared from this browser after cloud sync finishes.
                </p>
              ) : null}
            </div>

            {!isSignedIn && !hasRememberedAccount ? (
              <button
                type="button"
                className="button buttonPrimary accountSettingsPrimary"
                onClick={onOpenAuth}
                disabled={!firebaseEnabled || busy}
              >
                Sign in to sync
              </button>
            ) : null}

            {isSignedIn || hasRememberedAccount ? (
              <div className="disconnectBox">
                {isConfirmingDisconnect ? (
                  <>
                    <div>
                      <h3>{disconnectTitle}</h3>
                      <p>{disconnectBody}</p>
                    </div>
                    <div className="disconnectActions">
                      <button
                        type="button"
                        className="button buttonGhost"
                        onClick={() => setIsConfirmingDisconnect(false)}
                        disabled={busy}
                      >
                        Keep connection
                      </button>
                      <button
                        type="button"
                        className="button buttonDanger"
                        onClick={confirmDisconnect}
                        disabled={busy}
                      >
                        {busy ? 'Clearing…' : 'Clear this browser'}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <h3>Remove account from this browser</h3>
                      <p>Clears local resume copies and account connection on this browser only. Your cloud resumes are not deleted.</p>
                    </div>
                    <button
                      type="button"
                      className="button buttonDanger accountSettingsDanger"
                      onClick={() => setIsConfirmingDisconnect(true)}
                      disabled={busy}
                    >
                      Disconnect browser
                    </button>
                  </>
                )}
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
