import ResumeWorkspaceRail from './resumeWorkspaceRail';

function PrintIcon() {
  return (
    <svg className="topbarActionIcon" aria-hidden="true" viewBox="0 0 20 20" focusable="false">
      <path d="M6 7V3.75h8V7M6 14H4.75A1.75 1.75 0 0 1 3 12.25v-3.5A1.75 1.75 0 0 1 4.75 7h10.5A1.75 1.75 0 0 1 17 8.75v3.5A1.75 1.75 0 0 1 15.25 14H14" />
      <path d="M6 11.5h8v4.75H6z" />
      <path d="M14.75 9.5h.01" />
    </svg>
  );
}

function AccountIcon({ signedIn }) {
  return (
    <svg className="topbarActionIcon" aria-hidden="true" viewBox="0 0 20 20" focusable="false">
      {signedIn ? (
        <>
          <path d="M8.5 4.25h-3A1.75 1.75 0 0 0 3.75 6v8a1.75 1.75 0 0 0 1.75 1.75h3" />
          <path d="M11.75 6.5 15.25 10l-3.5 3.5M7.5 10h7.25" />
        </>
      ) : (
        <>
          <circle cx="10" cy="7" r="3" />
          <path d="M4.75 16c.65-2.55 2.4-3.75 5.25-3.75s4.6 1.2 5.25 3.75" />
        </>
      )}
    </svg>
  );
}

export default function Header({
  onPrint,
  resumeList,
  workspaceOrganization,
  activeResumeId,
  canAddResume,
  canDeleteActiveResume,
  onSetActiveResume,
  onCreateResume,
  onDuplicateResume,
  onRenameResume,
  onCreateResumeFolder,
  onRenameResumeFolder,
  onSetResumeOrganization,
  onDeleteResume,
  workspaceReady,
  authUser,
  authReady,
  firebaseEnabled,
  onOpenAuth,
  onSignOut,
}) {
  return (
    <div className="headerStack">
      <header className="topbar panel">
        <div className="brand">
          <span className="visuallyHidden">ResumeLoomr</span>
          <img className="brandLogo brandLogo--light" src="/loomr-logo-light.png" alt="" aria-hidden="true" />
          <img className="brandLogo brandLogo--dark" src="/loomr-logo-dark.png" alt="" aria-hidden="true" />
        </div>

        <div className="topbarSide">
          <div className="topbarMeta">
            <button type="button" className="button buttonSecondary printButton" onClick={onPrint}>
              <PrintIcon />
              Print/Save
            </button>
            {authUser ? (
              <button type="button" className="button buttonSecondary accountButton" onClick={onSignOut}>
                <AccountIcon signedIn />
                Sign out
              </button>
            ) : (
              <button
                type="button"
                className="button buttonSecondary accountButton"
                onClick={onOpenAuth}
                disabled={!authReady || !firebaseEnabled}
                title={firebaseEnabled ? 'Sign in to sync resumes' : 'Firebase is not configured yet'}
              >
                <AccountIcon signedIn={false} />
                Sign in
              </button>
            )}
          </div>
        </div>
      </header>

      <ResumeWorkspaceRail
        resumeList={resumeList}
        organization={workspaceOrganization}
        activeResumeId={activeResumeId}
        canAddResume={canAddResume}
        canDeleteActiveResume={canDeleteActiveResume}
        onSetActiveResume={onSetActiveResume}
        onCreateResume={onCreateResume}
        onDuplicateResume={onDuplicateResume}
        onRenameResume={onRenameResume}
        onCreateResumeFolder={onCreateResumeFolder}
        onRenameResumeFolder={onRenameResumeFolder}
        onSetResumeOrganization={onSetResumeOrganization}
        onDeleteResume={onDeleteResume}
        workspaceReady={workspaceReady}
        authUser={authUser}
      />
    </div>
  );
}
