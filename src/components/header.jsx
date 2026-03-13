import { useRef } from 'react';

export default function Header({
    template,
    templateOptions,
    onTemplateChange,
    onImportFile,
    onExport,
    onReset,
    onPrint,
    saveState,
    saveLabel,
    issueCount,
}) {
    const fileInputRef = useRef(null);

    return (
        <header className="topbar panel">
            <div className="brand">
                <div className="brandMark" aria-hidden="true">R</div>
                <div className="brandCopy">
                    <p className="kicker">Resume builder</p>
                    <h1>ResumeLoomr</h1>
                    <p className="brandSubcopy">A production-ready editor for focused resume writing, review, and export.</p>
                </div>
            </div>

            <div className="topbarSide">
                <div className="topbarMeta">
                    <span className={`statusBadge statusBadge--${saveState}`}>
                        {saveLabel}
                    </span>
                    <span className={`statusBadge ${issueCount > 0 ? 'statusBadge--warning' : 'statusBadge--success'}`}>
                        {issueCount > 0 ? `${issueCount} field${issueCount === 1 ? '' : 's'} to review` : 'Ready to export'}
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

                    <input
                        ref={fileInputRef}
                        className="visuallyHidden"
                        type="file"
                        accept="application/json"
                        onChange={(event) => {
                            const [file] = event.target.files || [];
                            onImportFile(file);
                            event.target.value = '';
                        }}
                    />

                    <div className="toolbarActions">
                        <button type="button" className="button buttonSecondary" onClick={() => fileInputRef.current?.click()}>
                            Import JSON
                        </button>
                        <button type="button" className="button buttonSecondary" onClick={onExport}>
                            Export JSON
                        </button>
                        <button type="button" className="button buttonGhost" onClick={onReset}>
                            New draft
                        </button>
                        <button type="button" className="button buttonPrimary printButton" onClick={onPrint}>
                            Print resume
                        </button>
                    </div>
                </div>
            </div>
        </header>
    )
}
