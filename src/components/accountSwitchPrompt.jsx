function formatAccountName(account, fallback = 'this account') {
  return account?.email || account?.displayName || fallback;
}

export default function AccountSwitchPrompt({
  isOpen,
  previousAccount,
  nextAccount,
  busy,
  onImportLocalData,
  onClearLocalData,
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="authOverlay" role="presentation">
      <div className="authBackdrop" aria-hidden="true" />
      <section className="authDialog accountSwitchPrompt panel" role="dialog" aria-modal="true" aria-labelledby="account-switch-title">
        <div className="authDialogHeader">
          <div>
            <p className="authEyebrow">Account switch</p>
            <h2 id="account-switch-title">What should happen to this browser&apos;s resumes?</h2>
          </div>
        </div>

        <p className="authIntro">
          This browser has local resume copies from {formatAccountName(previousAccount)}. You just signed in as {formatAccountName(nextAccount)}.
        </p>

        <div className="signedOutPromptNote">
          Choose Import only if these browser resumes should be added to the signed-in account. Choose Clear on shared computers or if these resumes belong to someone else.
        </div>

        <div className="accountSwitchActions">
          <button
            type="button"
            className="button buttonDanger"
            onClick={onClearLocalData}
            disabled={busy}
          >
            Clear browser resumes
          </button>
          <button
            type="button"
            className="button buttonPrimary"
            onClick={onImportLocalData}
            disabled={busy}
          >
            Import into this account
          </button>
        </div>
      </section>
    </div>
  );
}
