export default function Header({
    template,
    templateOptions,
    onTemplateChange,
    onPrint,
    saveState,
    saveLabel,
    issueCount,
}) {
    return (
        <header className="topbar panel">
            <div className="brand">
                <div className="brandMark" aria-hidden="true">R</div>
                <div className="brandCopy">
                    <p className="kicker">Resume builder</p>
                    <h1>ResumeLoomr</h1>
                    <p className="brandSubcopy">A production-ready editor for focused resume writing, review, and printing.</p>
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

                <div className="toolbar">
                    <label className="toolbarField">
                        <span className="toolbarLabel">Template</span>
                        <select
                            className="toolbarSelect"
                            value={template}
                            onChange={(event) => onTemplateChange(event.target.value)}
                            aria-label="Choose resume template"
                        >
                            {templateOptions.map((option) => (
                                <option key={option.id} value={option.id}>
                                    {option.label}
                                </option>
                            ))}
                        </select>
                    </label>

                    <div className="toolbarActions">
                        <button type="button" className="button buttonPrimary printButton" onClick={onPrint}>
                            Print resume
                        </button>
                    </div>
                </div>
            </div>
        </header>
    )
}
