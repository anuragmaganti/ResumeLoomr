import { PERSONAL_ALIGNMENT_OPTIONS } from '../lib/resumeSettings.js';

const ALIGNMENT_LABELS = {
    left: 'Align personal section left',
    center: 'Align personal section center',
};

const ALIGNMENT_ICON_BARS = {
    left: [
        { x: 3, width: 14 },
        { x: 3, width: 10 },
        { x: 3, width: 13 },
        { x: 3, width: 8 },
    ],
    center: [
        { x: 3, width: 14 },
        { x: 5, width: 10 },
        { x: 3.5, width: 13 },
        { x: 6, width: 8 },
    ],
};

function stopControlEvent(event) {
    event.preventDefault();
    event.stopPropagation();
}

function AlignmentIcon({ alignment }) {
    return (
        <svg
            className="personalAlignmentIcon"
            viewBox="0 0 20 18"
            aria-hidden="true"
            focusable="false"
        >
            {ALIGNMENT_ICON_BARS[alignment].map((bar, index) => (
                <rect
                    key={`${alignment}-${index}`}
                    x={bar.x}
                    y={3 + (index * 3.4)}
                    width={bar.width}
                    height="1.8"
                    rx="0.9"
                />
            ))}
        </svg>
    );
}

export default function PersonalAlignmentControls({ activeAlignment, onAlignmentChange }) {
    return (
        <div
            className="personalAlignmentMenu"
            data-personal-alignment-menu="true"
            aria-label="Personal section alignment"
            onPointerDown={stopControlEvent}
            onMouseDown={stopControlEvent}
            onClick={(event) => event.stopPropagation()}
        >
            {PERSONAL_ALIGNMENT_OPTIONS.map((alignment) => (
                <button
                    key={alignment}
                    type="button"
                    className="personalAlignmentButton"
                    aria-label={ALIGNMENT_LABELS[alignment]}
                    aria-pressed={activeAlignment === alignment}
                    data-personal-alignment-option={alignment}
                    onClick={(event) => {
                        stopControlEvent(event);
                        onAlignmentChange?.(alignment);
                    }}
                >
                    <AlignmentIcon alignment={alignment} />
                </button>
            ))}
        </div>
    );
}
