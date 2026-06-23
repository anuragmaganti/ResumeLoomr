import { useState } from 'react';

function formatAccountName(account, fallback = 'Unknown account') {
  return account?.email || account?.displayName || fallback;
}

function formatConnectionDate(value) {
  const date = new Date(value);

  if (!value || Number.isNaN(date.getTime())) {
    return 'Not recorded';
  }

  return date.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function AccountSettings({
  isOpen,
  authUser,
  connectedAccount,
  firebaseEnabled,
  trustedDevice,
  syncState,
  busy,
  onOpen,
  onClose,
  onOpenAuth,
  onDisconnectBrowser,
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
                <p className="accountSettingsEyebrow">Browser settings</p>
                <h2 id="account-settings-title">Connection</h2>
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

            <dl className="connectionDetails">
              <div>
                <dt>Cloud sync</dt>
                <dd>{isSignedIn ? syncState || 'ready' : 'Off'}</dd>
              </div>
              <div>
                <dt>Offline storage</dt>
                <dd>{trustedDevice ? 'Trusted browser cache' : 'This browser only'}</dd>
              </div>
              <div>
                <dt>Last connected</dt>
                <dd>{formatConnectionDate(connectedAccount?.lastConnectedAt)}</dd>
              </div>
            </dl>

            <div className="accountSettingsNote">
              <strong>How this works</strong>
              <p>
                Local browser data keeps the editor fast. When signed in, cloud sync backs up your resumes and makes them available on other devices.
              </p>
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
                      <h3>Use this browser locally again</h3>
                      <p>Remove the account link and local resume copies from this browser. Cloud data is not deleted.</p>
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
