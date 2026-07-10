import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const POPUP_MARGIN = 12;
const POPUP_OFFSET = 10;

function CloseIcon() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <path d="m5 5 8 8m0-8-8 8" />
    </svg>
  );
}

function ControlIcon({ type }) {
  if (type === 'tone') {
    return (
      <svg viewBox="0 0 18 18" aria-hidden="true" focusable="false">
        <path d="M3 9h12" />
        <circle cx="12.5" cy="9" r="2.25" />
      </svg>
    );
  }

  if (type === 'weight') {
    return (
      <svg viewBox="0 0 18 18" aria-hidden="true" focusable="false">
        <path d="M3 6.25h12M3 11.75h12" />
      </svg>
    );
  }

  if (type === 'gap') {
    return (
      <svg viewBox="0 0 18 18" aria-hidden="true" focusable="false">
        <path d="M3 5h12M3 13h12M9 7.25v3.5m-1.6-2L9 7.15l1.6 1.6M7.4 9.25 9 10.85l1.6-1.6" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <path d="M3 5.5h12M3 12.5h12" />
      <circle cx="6" cy="5.5" r="1.5" />
      <circle cx="12" cy="12.5" r="1.5" />
    </svg>
  );
}

function createNumberMarks(min, max) {
  return Array.from({ length: max - min + 1 }, (_, index) => {
    const value = min + index;

    return { value, label: String(value) };
  });
}

function getMarkPosition(markValue, min, max) {
  if (max <= min) {
    return '0%';
  }

  return `${((markValue - min) / (max - min)) * 100}%`;
}

function clampNumber(value, min, max) {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.max(min, Math.min(max, value));
}

const separatorControls = [
  {
    key: 'Tone',
    label: 'Color',
    icon: 'tone',
    min: 0,
    max: 10,
    step: 1,
    marks: createNumberMarks(0, 10),
    fromSetting(value) {
      return Math.round(clampNumber(value, 0, 100) / 10);
    },
    toSetting(value) {
      return clampNumber(value, 0, 10) * 10;
    },
    valueLabel(value) {
      if (value <= 0) return 'None';
      if (value <= 3) return 'Light';
      if (value <= 6) return 'Gray';
      if (value <= 8) return 'Dark';
      return 'Black';
    },
  },
  {
    key: 'Weight',
    label: 'Width',
    icon: 'weight',
    min: 1,
    max: 5,
    step: 1,
    marks: createNumberMarks(1, 5),
    valueLabel(value) {
      return ['Hairline', 'Thin', 'Standard', 'Strong', 'Thick'][Math.max(1, Math.min(5, value)) - 1] || 'Thin';
    },
  },
  {
    key: 'Gap',
    label: 'Section gap',
    icon: 'gap',
    min: 0,
    max: 10,
    step: 1,
    marks: createNumberMarks(0, 10),
    fromSetting(value) {
      return Math.round(clampNumber(value, -5, 5) + 5);
    },
    toSetting(value) {
      return clampNumber(value, 0, 10) - 5;
    },
    valueLabel(value) {
      if (value <= 1) return 'Tight';
      if (value <= 3) return 'Snug';
      if (value === 4) return 'Default';
      if (value <= 5) return 'Standard';
      if (value <= 8) return 'Open';
      return 'Spacious';
    },
  },
];

const defaultValues = {
  Tone: 50,
  Weight: 2,
  Gap: -1,
};

const sectionSeparatorPositionOptions = [
  { value: 'aboveSectionName', label: 'Above section name' },
  { value: 'belowSectionName', label: 'Below section name' },
];

function settingIdFor(scope, key) {
  const prefix = scope === 'personal' ? 'personalSeparator' : 'sectionSeparator';
  return `${prefix}${key}`;
}

function getPopupPosition(anchor, popupRect) {
  const viewportWidth = window.innerWidth || 0;
  const viewportHeight = window.innerHeight || 0;
  const width = popupRect.width || 280;
  const height = popupRect.height || 260;
  const preferredLeft = anchor.x + POPUP_OFFSET;
  const preferredTop = anchor.y + POPUP_OFFSET;
  const flippedLeft = anchor.x - width - POPUP_OFFSET;
  const flippedTop = anchor.y - height - POPUP_OFFSET;
  const left = preferredLeft + width + POPUP_MARGIN <= viewportWidth ? preferredLeft : flippedLeft;
  const top = preferredTop + height + POPUP_MARGIN <= viewportHeight ? preferredTop : flippedTop;

  return {
    left: Math.max(POPUP_MARGIN, Math.min(left, viewportWidth - width - POPUP_MARGIN)),
    top: Math.max(POPUP_MARGIN, Math.min(top, viewportHeight - height - POPUP_MARGIN)),
  };
}

export default function SeparatorSettingsPopup({
  anchor,
  settings,
  onChange,
  onClose,
}) {
  const popupRef = useRef(null);
  const [position, setPosition] = useState(() => ({ left: anchor.x + POPUP_OFFSET, top: anchor.y + POPUP_OFFSET }));
  const title = anchor.scope === 'personal' ? 'Personal separator' : 'Section separators';
  const controls = useMemo(() => separatorControls.map((control) => ({
    ...control,
    settingId: settingIdFor(anchor.scope, control.key),
  })), [anchor.scope]);

  useLayoutEffect(() => {
    const popupElement = popupRef.current;

    if (!popupElement) {
      return;
    }

    setPosition(getPopupPosition(anchor, popupElement.getBoundingClientRect()));
  }, [anchor]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!popupRef.current?.contains(event.target)) {
        onClose();
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    }

    window.addEventListener('resize', onClose);
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('resize', onClose);
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    popupRef.current?.focus();
  }, []);

  if (typeof document === 'undefined') {
    return null;
  }

  const popup = (
    <div
      ref={popupRef}
      className={`separatorSettingsPopup separatorSettingsPopup--${anchor.scope}`}
      style={{ left: `${position.left}px`, top: `${position.top}px` }}
      role="dialog"
      aria-label={title}
      tabIndex={-1}
    >
      <header className="separatorSettingsHeader">
        <div className="separatorSettingsHeading">
          <span className="separatorSettingsHeaderIcon"><ControlIcon type="position" /></span>
          <div>
            <h2>{title}</h2>
            <span>{anchor.scope === 'personal' ? 'Personal only' : 'All sections'}</span>
          </div>
        </div>
        <button
          type="button"
          className="separatorSettingsClose"
          onClick={() => onClose()}
          aria-label={`Close ${title.toLowerCase()}`}
        >
          <CloseIcon />
        </button>
      </header>
      <div className="separatorSettingsControls">
        {controls.map((control) => {
          const storedValue = settings?.[control.settingId] ?? defaultValues[control.key];
          const value = control.fromSetting ? control.fromSetting(storedValue) : storedValue;
          const valueLabel = control.valueLabel(value);
          const unitLabel = `${value}/${control.max}`;
          const sliderProgress = getMarkPosition(value, control.min, control.max);

          return (
            <label className="separatorSliderControl" key={control.settingId}>
              <span className="separatorSliderHeader">
                <span className="separatorSliderLabel">
                  <span className="separatorControlIcon"><ControlIcon type={control.icon} /></span>
                  <span>{control.label}</span>
                </span>
                <span className="separatorSliderValue">{valueLabel}</span>
              </span>
              <input
                type="range"
                min={control.min}
                max={control.max}
                step={control.step}
                value={value}
                aria-valuetext={`${unitLabel}, ${valueLabel}`}
                style={{ '--separator-slider-progress': sliderProgress }}
                onChange={(event) => {
                  const nextValue = Number(event.target.value);
                  onChange(control.settingId, control.toSetting ? control.toSetting(nextValue) : nextValue);
                }}
              />
              <span
                className="separatorSliderMarks"
                aria-hidden="true"
                style={{ '--separator-mark-count': control.marks.length }}
              >
                {control.marks.map((mark) => (
                  <span
                    className={mark.value === value ? 'isActive' : undefined}
                    key={`${control.settingId}-${mark.value}`}
                  >
                    {mark.label}
                  </span>
                ))}
              </span>
            </label>
          );
        })}
        {anchor.scope === 'section' && (
          <div className="separatorPositionControl">
            <span className="separatorSliderHeader">
              <span className="separatorSliderLabel">
                <span className="separatorControlIcon"><ControlIcon type="position" /></span>
                <span>Position</span>
              </span>
            </span>
            <div className="separatorPositionSegment" role="group" aria-label="Section separator position">
              {sectionSeparatorPositionOptions.map((option) => (
                <button
                  type="button"
                  className={`separatorPositionOption${settings?.sectionSeparatorPosition === option.value ? ' isActive' : ''}`}
                  key={option.value}
                  onClick={() => onChange('sectionSeparatorPosition', option.value)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(popup, document.body);
}
