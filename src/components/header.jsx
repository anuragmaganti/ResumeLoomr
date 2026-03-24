import BrandMark from "./brandMark";

export default function Header({
    saveState,
    saveLabel,
    theme,
    onToggleTheme,
    template,
    templateOptions,
    onTemplateChange,
    onPrint,
}) {
    return (
        <header className="topbar panel">
            <div className="brand">
                <div className="brandMark" aria-hidden="true">
                    <BrandMark />
                </div>
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
                    <button
                        type="button"
                        className="button buttonSecondary themeToggle"
                        onClick={onToggleTheme}
                        aria-pressed={theme === 'dark'}
                        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                    >
                        <span className={`themeToggleKnob themeToggleKnob--${theme}`} aria-hidden="true" />
                        <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
                    </button>
                    <label className="visuallyHidden" htmlFor="header-template-select">
                        Template
                    </label>
                    <select
                        id="header-template-select"
                        className="toolbarSelect topbarTemplateSelect"
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
                    <button type="button" className="button buttonPrimary printButton" onClick={onPrint}>
                        Print resume
                    </button>
                </div>
            </div>
        </header>
    )
}
