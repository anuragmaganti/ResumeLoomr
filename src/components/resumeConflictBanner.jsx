export default function ResumeConflictBanner({
  conflict,
  onUseSavedVersion,
  onKeepLocalEdits,
  onSaveAsCopy,
}) {
  if (!conflict) {
    return null;
  }

  const documentLabel = conflict.type === 'coverLetter' ? 'cover letter' : 'resume';

  return (
    <div className="conflictBanner" role="alert">
      <div>
        <strong>This {documentLabel} changed in another tab or device.</strong>
        <span>Choose which version to keep before continuing.</span>
      </div>
      <div className="conflictActions">
        <button type="button" className="button buttonSecondary" onClick={onUseSavedVersion}>
          Use saved version
        </button>
        <button type="button" className="button buttonSecondary" onClick={onKeepLocalEdits}>
          Keep my edits
        </button>
        <button type="button" className="button buttonPrimary" onClick={onSaveAsCopy}>
          Save as copy
        </button>
      </div>
    </div>
  );
}
