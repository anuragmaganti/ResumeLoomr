import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { getSaveStatusPresentation } from '../lib/saveStatus.js';
import {
  createSignOutStoragePreference,
  getSignOutStorageMode,
} from '../lib/browserConnection.js';
import { trapTabKey } from '../lib/focusTrap.js';

function SaveStatusIcon({ status }) {
  if (status === 'syncing') {
    return (
      <svg key={status} className={`saveStatusIcon saveStatusIcon--${status}`} aria-hidden="true" viewBox="0 0 24 24">
        <path d="M20 7v5h-5" />
        <path d="M4 17v-5h5" />
        <path d="M6.1 9A7 7 0 0 1 17.7 6.6L20 9" />
        <path d="M17.9 15A7 7 0 0 1 6.3 17.4L4 15" />
      </svg>
    );
  }

  if (status === 'synced' || status === 'queued' || status === 'sync-error' || status === 'stale') {
    return (
      <svg key={status} className={`saveStatusIcon saveStatusIcon--${status}`} aria-hidden="true" viewBox="0 0 24 24">
        <path className="saveStatusCloud" d="M17.5 18H7a4 4 0 0 1-.5-8A6 6 0 0 1 18 9.5a4.25 4.25 0 0 1-.5 8.5Z" />
        {status === 'synced' ? <path className="saveStatusCheck" d="m9.2 13 2 2 4-4.5" /> : null}
        {status === 'queued' ? (
          <g className="saveStatusClock">
            <circle cx="16.5" cy="16.5" r="3.5" />
            <path className="saveStatusClockHand" d="M16.5 14.5v2.2l1.4.8" />
          </g>
        ) : null}
        {status === 'sync-error' || status === 'stale' ? (
          <g className="saveStatusAlert">
            <path d="M12 10.5v3" />
            <path d="M12 16.2h.01" />
          </g>
        ) : null}
      </svg>
    );
  }

  if (status === 'conflict') {
    return (
      <svg key={status} className={`saveStatusIcon saveStatusIcon--${status}`} aria-hidden="true" viewBox="0 0 24 24">
        <path d="M12 3.5 21 20H3L12 3.5Z" />
        <path d="M12 9v5" />
        <path d="M12 17h.01" />
      </svg>
    );
  }

  const isSaving = status === 'saving-local';
  const isError = status === 'local-error';
  const isSaved = status === 'saved-local';

  return (
    <svg key={status} className={`saveStatusIcon saveStatusIcon--${status}`} aria-hidden="true" viewBox="0 0 24 24">
      <rect x="3.5" y="4" width="17" height="16" rx="3" />
      <path d="M3.5 14.5h17" />
      <path d="M7 17.3h.01" />
      {isSaving ? <path className="saveStatusArrow" d="M12 7v5m-2-2 2 2 2-2" /> : null}
      {isSaved ? <path className="saveStatusCheck" d="m9.2 10 2 2 4-4.5" /> : null}
      {isError ? (
        <g className="saveStatusAlert">
          <path d="M12 7.2v3.2" />
          <path d="M12 12.5h.01" />
        </g>
      ) : null}
    </svg>
  );
}

function formatAccountName(account, fallback = 'Unknown account') {
  return account?.email || account?.displayName || fallback;
}

function ConnectionIcon({ mode }) {
  return (
    <svg className="connectionSummaryIconGraphic" aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      {mode === 'cloud' ? (
        <>
          <path d="M17.5 18H7a4 4 0 0 1-.5-8A6 6 0 0 1 18 9.5a4.25 4.25 0 0 1-.5 8.5Z" />
          <path d="m9.2 13 2 2 4-4.5" />
        </>
      ) : mode === 'remembered' ? (
        <>
          <rect x="4" y="5" width="16" height="12" rx="2.5" />
          <path d="M8 20h8M12 17v3" />
        </>
      ) : (
        <>
          <rect x="4" y="5" width="16" height="12" rx="2.5" />
          <path d="M9 9.5h6M9 12.5h4" />
        </>
      )}
    </svg>
  );
}

function StorageChoiceIcon({ mode }) {
  return (
    <svg className="storageChoiceIcon" aria-hidden="true" viewBox="0 0 20 20" focusable="false">
      {mode === 'ask' ? (
        <>
          <circle cx="10" cy="10" r="7" />
          <path d="M8.2 7.8A2.1 2.1 0 0 1 10.3 6c1.3 0 2.3.8 2.3 2 0 1.8-2.1 1.9-2.1 3.4M10.5 14h.01" />
        </>
      ) : mode === 'keep' ? (
        <>
          <rect x="3" y="4" width="14" height="12" rx="2.5" />
          <path d="M3 11h14M6 13.5h.01" />
        </>
      ) : (
        <>
          <path d="M4 6h12M8 3.5h4M6 6l.7 10h6.6L14 6" />
          <path d="M8.5 9v4M11.5 9v4" />
        </>
      )}
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 18 18" focusable="false">
      <path d="m5 5 8 8M13 5l-8 8" />
    </svg>
  );
}

export default function AccountSettings({
  isOpen,
  saveState,
  syncState,
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
  const launcherRef = useRef(null);
  const panelRef = useRef(null);
  const closeSettingsFromEffect = useEffectEvent(() => {
    setIsConfirmingDisconnect(false);
    onClose();
    window.requestAnimationFrame(() => launcherRef.current?.focus({ preventScroll: true }));
  });
  const activeAccount = authUser
    ? {
        uid: authUser.uid,
        email: authUser.email || '',
        displayName: authUser.displayName || '',
      }
    : connectedAccount;
  const accountName = formatAccountName(activeAccount);
  const isSignedIn = Boolean(authUser);
  const saveStatus = getSaveStatusPresentation({
    saveState,
    syncState,
    cloudMode: isSignedIn,
  });
  const hasRememberedAccount = Boolean(connectedAccount?.uid);
  const hasAccountContext = isSignedIn || hasRememberedAccount;
  const connectionStatus = isSignedIn
    ? {
        mode: 'cloud',
        label: 'Cloud sync on',
        account: accountName,
        description: 'Changes save to this browser first, then sync to your account.',
      }
    : hasRememberedAccount
      ? {
          mode: 'remembered',
          label: 'Signed out',
          account: accountName,
          description: 'This browser remembers the last connected account and may contain local resumes.',
        }
      : {
          mode: 'local',
          label: 'This browser only',
          account: 'Not signed in',
          description: 'Resumes are stored locally until you sign in for cloud backup.',
        };
  const signOutMode = getSignOutStorageMode(signedOutEditingPreference);
  const disconnectTitle = 'Remove data from this browser?';
  const disconnectBody = isSignedIn
    ? 'Pending changes are synced first. Then you are signed out and local resumes and account details are removed from this browser. Cloud resumes are not deleted.'
    : 'Local resumes and the remembered account are removed from this browser. Changes that exist only here cannot be recovered. Cloud resumes are not deleted.';

  function closeSettings({ restoreFocus = true } = {}) {
    setIsConfirmingDisconnect(false);
    onClose();

    if (restoreFocus) {
      window.requestAnimationFrame(() => launcherRef.current?.focus({ preventScroll: true }));
    }
  }

  async function confirmDisconnect() {
    await onDisconnectBrowser();
  }

  function handleThemeToggle() {
    setIsThemeAnimating(true);
    onToggleTheme();
  }

  function updateSignOutMode(mode) {
    onSignedOutEditingPreferenceChange(
      createSignOutStoragePreference(mode, signedOutEditingPreference),
    );
  }

  function handlePanelKeyDown(event) {
    trapTabKey(event, panelRef.current);
  }

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const frameId = window.requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true }));

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeSettingsFromEffect();
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.cancelAnimationFrame(frameId);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <>
      <div
        className={`floatingSaveStatus statusBadge statusBadge--${saveStatus.id}`}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        <SaveStatusIcon status={saveStatus.id} />
        <span>{saveStatus.label}</span>
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
        ref={launcherRef}
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
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="account-settings-title"
            tabIndex={-1}
            onKeyDown={handlePanelKeyDown}
          >
            <div className="accountSettingsHeader">
              <h2 id="account-settings-title">Settings</h2>
              <button type="button" className="accountSettingsClose" onClick={closeSettings} aria-label="Close settings">
                <CloseIcon />
              </button>
            </div>

            <div className="connectionSummary">
              <span className={`connectionSummaryIcon is-${connectionStatus.mode}`} aria-hidden="true">
                <ConnectionIcon mode={connectionStatus.mode} />
              </span>
              <div className="connectionSummaryCopy">
                <div className="connectionStatusRow">
                  <span className={`connectionStatusDot is-${connectionStatus.mode}`} aria-hidden="true" />
                  <span>{connectionStatus.label}</span>
                </div>
                <p className="connectionAccount">{connectionStatus.account}</p>
                <p className="connectionDescription">{connectionStatus.description}</p>
              </div>
            </div>

            {hasAccountContext ? (
              <fieldset className="signOutBehaviorSection">
                <legend>When I sign out</legend>
                <p className="accountSettingsSectionIntro">Choose what this browser should do with local resume copies.</p>

                <div className="signOutBehaviorOptions">
                  <label className={`signOutBehaviorOption${signOutMode === 'ask' ? ' isSelected' : ''}`}>
                    <input
                      type="radio"
                      name="sign-out-behavior"
                      value="ask"
                      checked={signOutMode === 'ask'}
                      onChange={() => updateSignOutMode('ask')}
                    />
                    <span className="storageChoiceIconWrap" aria-hidden="true"><StorageChoiceIcon mode="ask" /></span>
                    <span className="signOutBehaviorCopy">
                      <strong>Ask every time</strong>
                      <small>Choose whether to keep or clear local copies when signing out.</small>
                    </span>
                    <span className="signOutBehaviorCheck" aria-hidden="true" />
                  </label>

                  <label className={`signOutBehaviorOption${signOutMode === 'keep' ? ' isSelected' : ''}`}>
                    <input
                      type="radio"
                      name="sign-out-behavior"
                      value="keep"
                      checked={signOutMode === 'keep'}
                      onChange={() => updateSignOutMode('keep')}
                    />
                    <span className="storageChoiceIconWrap" aria-hidden="true"><StorageChoiceIcon mode="keep" /></span>
                    <span className="signOutBehaviorCopy">
                      <strong>Keep resumes here</strong>
                      <small>Sign out and continue editing on this browser.</small>
                    </span>
                    <span className="signOutBehaviorCheck" aria-hidden="true" />
                  </label>

                  <label className={`signOutBehaviorOption${signOutMode === 'clear' ? ' isSelected' : ''}`}>
                    <input
                      type="radio"
                      name="sign-out-behavior"
                      value="clear"
                      checked={signOutMode === 'clear'}
                      onChange={() => updateSignOutMode('clear')}
                    />
                    <span className="storageChoiceIconWrap" aria-hidden="true"><StorageChoiceIcon mode="clear" /></span>
                    <span className="signOutBehaviorCopy">
                      <strong>Clear this browser</strong>
                      <small>Sync first, then remove local copies. Cloud resumes stay safe.</small>
                    </span>
                    <span className="signOutBehaviorCheck" aria-hidden="true" />
                  </label>
                </div>
              </fieldset>
            ) : null}

            {!isSignedIn && !hasRememberedAccount ? (
              <button
                type="button"
                className="button buttonPrimary accountSettingsPrimary"
                onClick={onOpenAuth}
                disabled={!firebaseEnabled || busy}
              >
                Sign in for cloud backup
              </button>
            ) : null}

            {isSignedIn || hasRememberedAccount ? (
              <div className={`browserDataSection${isConfirmingDisconnect ? ' isConfirming' : ''}`}>
                {isConfirmingDisconnect ? (
                  <>
                    <div className="browserDataCopy">
                      <h3>{disconnectTitle}</h3>
                      <p>{disconnectBody}</p>
                    </div>
                    <div className="browserDataActions">
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
                        {busy ? 'Removing…' : 'Remove data'}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="browserDataCopy">
                      <h3>Browser data</h3>
                      <p>Remove local resumes and forget this account on this browser. Cloud resumes are not deleted.</p>
                    </div>
                    <button
                      type="button"
                      className="browserDataRemoveButton"
                      onClick={() => setIsConfirmingDisconnect(true)}
                      disabled={busy}
                    >
                      Remove from this browser
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
