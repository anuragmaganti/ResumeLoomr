import { IMPORT_FILE_TYPES_LABEL } from '../lib/importFileTypes.js';

const PREVIEW_MARGIN_SETTING_MIN = -5;
const PREVIEW_MARGIN_SETTING_MAX = 5;

function ImportStartIcon() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
            <path d="M7 3.5h7l4 4V20.5H7z" />
            <path d="M14 3.5v4h4M12.5 16V10.5m-2.5 2 2.5-2 2.5 2" />
        </svg>
    );
}

function ScratchStartIcon() {
    return (
        <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
            <path d="m5 16.5-.8 3.3 3.3-.8L18 8.5 14.5 5z" />
            <path d="m12.8 6.7 3.5 3.5M8.5 19.5h10.8" />
        </svg>
    );
}

function StartChoiceArrow() {
    return (
        <svg className="emptyStartArrow" aria-hidden="true" viewBox="0 0 18 18" focusable="false">
            <path d="m7 4 5 5-5 5" />
        </svg>
    );
}

function formatMarginValue(value) {
    const numericValue = Number(value) || 0;
    return numericValue === 0 ? '0' : String(numericValue);
}

function MarginControl({ position, settingId, settings, onAdjustSetting, onInteraction }) {
    const value = Number(settings?.[settingId]) || 0;
    const isVerticalControl = position === 'left' || position === 'right';
    const label = settingId === 'horizontalMargins' ? 'Side margin' : 'Top and bottom margin';
    const decreaseControl = {
        delta: -1,
        sign: '-',
        label: `Decrease ${label}`,
        disabled: value <= PREVIEW_MARGIN_SETTING_MIN,
    };
    const increaseControl = {
        delta: 1,
        sign: '+',
        label: `Increase ${label}`,
        disabled: value >= PREVIEW_MARGIN_SETTING_MAX,
    };
    const orderedControls = isVerticalControl
        ? [increaseControl, 'value', decreaseControl]
        : [decreaseControl, 'value', increaseControl];

    function stopControlEvent(event) {
        event.stopPropagation();
    }

    function adjustSetting(event, delta) {
        event.preventDefault();
        event.stopPropagation();
        onInteraction?.();
        onAdjustSetting(settingId, delta);
    }

    function clearPointerFocus(event) {
        const activeElement = document.activeElement;

        if (!activeElement || !event.currentTarget.contains(activeElement)) {
            return;
        }

        if (typeof activeElement.matches === 'function' && activeElement.matches(':focus-visible')) {
            return;
        }

        activeElement.blur?.();
    }

    return (
        <div
            className={`previewMarginZone previewMarginZone--${position}`}
            role="group"
            tabIndex={0}
            aria-label={`${label} preview controls`}
            onPointerDown={stopControlEvent}
            onPointerLeave={clearPointerFocus}
            onClick={stopControlEvent}
        >
            <div
                className={`previewMarginStepper${isVerticalControl ? ' previewMarginStepper--vertical' : ''}`}
                role="group"
                aria-label={`${label} controls`}
            >
                {orderedControls.map((control) => (
                    control === 'value' ? (
                        <span className="previewMarginValue" key="value">{formatMarginValue(value)}</span>
                    ) : (
                        <button
                            type="button"
                            className="previewMarginButton"
                            key={control.sign}
                            onClick={(event) => adjustSetting(event, control.delta)}
                            disabled={control.disabled}
                            aria-label={control.label}
                        >
                            {control.sign}
                        </button>
                    )
                ))}
            </div>
        </div>
    );
}

export function PreviewMarginControls({ settings, hidden = false, onAdjustSetting, onInteraction }) {
    if (hidden || typeof onAdjustSetting !== 'function') {
        return null;
    }

    return (
        <div className="previewMarginControls" aria-hidden={false}>
            <span className="previewMarginHighlight previewMarginHighlight--horizontal" aria-hidden="true" />
            <span className="previewMarginHighlight previewMarginHighlight--vertical" aria-hidden="true" />
            <MarginControl position="top" settingId="verticalMargins" settings={settings} onAdjustSetting={onAdjustSetting} onInteraction={onInteraction} />
            <MarginControl position="right" settingId="horizontalMargins" settings={settings} onAdjustSetting={onAdjustSetting} onInteraction={onInteraction} />
            <MarginControl position="bottom" settingId="verticalMargins" settings={settings} onAdjustSetting={onAdjustSetting} onInteraction={onInteraction} />
            <MarginControl position="left" settingId="horizontalMargins" settings={settings} onAdjustSetting={onAdjustSetting} onInteraction={onInteraction} />
        </div>
    );
}

export function PreviewPageMarkers({ hasContent, pageBreaks }) {
    if (!hasContent || pageBreaks.length === 0) {
        return null;
    }

    return (
        <div className="resumePageMarkers" aria-hidden="true">
            {pageBreaks.map((pageBreak, index) => {
                const pageNumber = index + 2;

                return (
                    <div
                        className="resumePageMarker"
                        key={`page-marker-${pageNumber}`}
                        style={{ top: `${pageBreak}px` }}
                    >
                        <span>Page {pageNumber}</span>
                    </div>
                );
            })}
        </div>
    );
}

export function SampleInformationToggle({
    enabled,
    personalAlignment,
    showSampleInformation,
    onToggleSampleInformation,
    onDismissSampleInformation,
}) {
    if (!enabled || !onToggleSampleInformation || !onDismissSampleInformation) {
        return null;
    }

    const positionClassName = personalAlignment === 'left'
        ? ' sampleInformationToggle--personalLeft'
        : '';

    return (
        <div
            className={`sampleInformationToggle${positionClassName}${showSampleInformation ? '' : ' sampleInformationToggle--hiddenUntilHover'}`}
            data-dnd-no-drag="true"
            onPointerDown={(event) => event.stopPropagation()}
        >
            <label className="sampleInformationToggleRow">
                <input
                    type="checkbox"
                    checked={showSampleInformation}
                    onChange={(event) => onToggleSampleInformation(event.target.checked)}
                />
                <span aria-hidden="true" className="sampleInformationSwitch" />
                <span>Show sample information</span>
            </label>
            <button
                type="button"
                className="sampleInformationDelete"
                onClick={(event) => {
                    event.stopPropagation();
                    onDismissSampleInformation();
                }}
                aria-label="Permanently delete sample information for this resume"
            >
                Delete sample information
            </button>
        </div>
    );
}

export function EmptyResumeChoice({
    visible,
    nudgeCount,
    isImportingResume,
    onImportResume,
    onStartFromScratch,
}) {
    if (!visible) {
        return null;
    }

    const nudgeAttributes = nudgeCount > 0
        ? { 'data-empty-choice-nudge': nudgeCount % 2 === 0 ? 'even' : 'odd' }
        : {};

    return (
        <div className="resumeEmptyChoiceOverlay">
            <div
                className="resumeEmptyActions"
                aria-label="Choose how to start this resume"
                {...nudgeAttributes}
            >
                <h2 className="resumeStartHeading">How would you like to start?</h2>
                <div className="resumeStartOptions">
                    <button
                        type="button"
                        className="emptyStartOption emptyStartOption--import"
                        onClick={onImportResume}
                        disabled={isImportingResume}
                    >
                        <span className="emptyStartIcon" aria-hidden="true">
                            {isImportingResume ? <span className="buttonSpinner" /> : <ImportStartIcon />}
                        </span>
                        <span className="emptyStartCopy">
                            <strong>{isImportingResume ? 'Processing resume…' : 'Import resume'}</strong>
                            <small>Use AI to organize a {IMPORT_FILE_TYPES_LABEL} into editable sections.</small>
                        </span>
                        <StartChoiceArrow />
                    </button>

                    <button
                        type="button"
                        className="emptyStartOption emptyStartOption--scratch"
                        onClick={onStartFromScratch}
                        disabled={isImportingResume}
                    >
                        <span className="emptyStartIcon" aria-hidden="true"><ScratchStartIcon /></span>
                        <span className="emptyStartCopy">
                            <strong>Start from scratch</strong>
                            <small>Open the editor and build your resume section by section.</small>
                        </span>
                        <StartChoiceArrow />
                    </button>
                </div>
            </div>
        </div>
    );
}
