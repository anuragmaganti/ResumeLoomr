import BrandMark from "./brandMark";

export default function Header({
    saveState,
    saveLabel,
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
                </div>
            </div>
        </header>
    )
}
