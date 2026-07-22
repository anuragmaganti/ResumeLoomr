function NoticeToastIcon({ isSyncError }) {
  if (isSyncError) {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
        <path d="M7.2 17.5H5.8a3.3 3.3 0 0 1-.45-6.57A6.5 6.5 0 0 1 18 9.65a4 4 0 0 1 .2 7.85h-1.4" />
        <path d="m9 15 6 6M15 15l-6 6" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M12 3.5 21 20H3z" />
      <path d="M12 9v4.5M12 17h.01" />
    </svg>
  );
}

function NoticeDismissIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 18 18" focusable="false">
      <path d="m5 5 8 8M13 5l-8 8" />
    </svg>
  );
}

function getNoticePresentation(notice, syncState) {
  const isSyncError = syncState === 'error';
  const isCloudUnavailable = isSyncError && notice?.message === 'Cloud sync is unavailable. Your local draft is still editable.';
  const isLimitedBrowserStorage = notice?.id === 'limited-browser-storage';

  return {
    isSyncError,
    showRetry: isSyncError && !isLimitedBrowserStorage,
    title: isLimitedBrowserStorage
      ? 'Limited browser storage'
      : (isCloudUnavailable ? 'Cloud sync unavailable' : ''),
    message: isCloudUnavailable ? 'Your work is saved locally and remains editable.' : notice?.message,
  };
}

export default function NoticeToast({ notice, syncState, onRetry, onDismiss }) {
  if (!notice) {
    return null;
  }

  const presentation = getNoticePresentation(notice, syncState);

  return (
    <div
      className={`noticeToast noticeToast--${notice.tone}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="noticeToastIcon">
        <NoticeToastIcon isSyncError={presentation.isSyncError} />
      </span>
      <span className="noticeToastCopy">
        {presentation.title ? <strong>{presentation.title}</strong> : null}
        <span>{presentation.message}</span>
      </span>
      <span className="noticeToastActions">
        {presentation.showRetry ? (
          <button type="button" className="noticeToastRetry" onClick={onRetry}>
            Retry
          </button>
        ) : null}
        <button
          type="button"
          className="noticeToastDismiss"
          onClick={onDismiss}
          aria-label="Dismiss message"
        >
          <NoticeDismissIcon />
        </button>
      </span>
    </div>
  );
}
