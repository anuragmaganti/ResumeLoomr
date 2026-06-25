import { useState } from 'react';

function formatAccountName(account, fallback = 'Unknown account') {
  return account?.email || account?.displayName || fallback;
}

export default function AccountSettings({
  isOpen,
  authUser,
  connectedAccount,
  firebaseEnabled,
  trustedDevice,
  signedOutEditingPreference,
  busy,
  onOpen,
  onClose,
  onOpenAuth,
  onDisconnectBrowser,
  onSignedOutEditingPreferenceChange,
}) {
  const [isConfirmingDisconnect, setIsConfirmingDisconnect] = useState(false);
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
    ? trustedDevice
      ? 'Signed in on a trusted browser'
      : 'Signed in for this browser session'
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

  return (
    <>
      <button
        type="button"
        className="settingsLauncher"
        onClick={onOpen}
        aria-label="Open account and browser settings"
        aria-expanded={isOpen}
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
          <path d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6Zm8.2 4.6-.1-1.6-2.1-.7a6.8 6.8 0 0 0-.6-1.5l1-2-1.2-1.1-2 .9a7.2 7.2 0 0 0-1.5-.6L13 4h-2l-.7 2.2c-.5.1-1 .3-1.5.6l-2-.9-1.2 1.1 1 2c-.3.5-.5 1-.6 1.5l-2.1.7-.1 1.6 2.2.8c.1.5.3 1 .6 1.5l-1 2 1.2 1.1 2-.9c.5.3 1 .5 1.5.6L11 20h2l.7-2.1c.5-.1 1-.3 1.5-.6l2 .9 1.2-1.1-1-2c.3-.5.5-1 .6-1.5l2.2-.8Z" />
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
                  Stores the first 10 resumes in your resume rail on this browser so you can edit without signing in. Turn off on shared computers.
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
