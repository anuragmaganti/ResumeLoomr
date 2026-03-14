export default function Header({
    saveState,
    saveLabel,
    issueCount,
}) {
    return (
        <header className="topbar panel">
            <div className="brand">
                <div className="brandMark" aria-hidden="true">R</div>
                <div className="brandCopy">
                    <h1>ResumeLoomr</h1>
                    <p className="brandSubcopy">Write your resume, review it live, and print a polished result in one place.</p>
                </div>
            </div>

            <div className="topbarSide">
                <div className="topbarMeta">
                    <span className={`statusBadge statusBadge--${saveState}`}>
                        {saveLabel}
                    </span>
                    <span className={`statusBadge ${issueCount > 0 ? 'statusBadge--warning' : 'statusBadge--success'}`}>
                        {issueCount > 0 ? `${issueCount} field${issueCount === 1 ? '' : 's'} to review` : 'Ready to print'}
                    </span>
                </div>
            </div>
        </header>
    )
}
