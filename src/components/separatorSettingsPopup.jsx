import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const POPUP_MARGIN = 12;
const POPUP_OFFSET = 10;

const separatorControls = [
  {
    key: 'Tone',
    label: 'Color',
    min: 0,
    max: 100,
    step: 1,
    marks: [
      { value: 0, label: 'None' },
      { value: 25, label: 'Light' },
      { value: 50, label: 'Gray' },
      { value: 75, label: 'Dark' },
      { value: 100, label: 'Black' },
    ],
    valueLabel(value) {
      if (value <= 0) return 'None';
      if (value < 38) return 'Light';
      if (value < 63) return 'Gray';
      if (value < 88) return 'Dark';
      return 'Black';
    },
  },
  {
    key: 'Weight',
    label: 'Width',
    min: 1,
    max: 5,
    step: 1,
    marks: [
      { value: 1, label: 'Hairline' },
      { value: 2, label: 'Thin' },
      { value: 3, label: 'Standard' },
      { value: 4, label: 'Strong' },
      { value: 5, label: 'Thick' },
    ],
    valueLabel(value) {
      return ['Hairline', 'Thin', 'Standard', 'Strong', 'Thick'][Math.max(1, Math.min(5, value)) - 1] || 'Thin';
    },
  },
  {
    key: 'Gap',
    label: 'Section gap',
    min: -5,
    max: 5,
    step: 1,
    marks: [
      { value: -5, label: 'Tight' },
      { value: -2, label: 'Snug' },
      { value: 0, label: 'Default' },
      { value: 2, label: 'Open' },
      { value: 5, label: 'Spacious' },
    ],
    valueLabel(value) {
      if (value <= -4) return 'Tight';
      if (value < 0) return 'Snug';
      if (value === 0) return 'Default';
      if (value < 4) return 'Open';
      return 'Spacious';
    },
  },
];

const defaultValues = {
  Tone: 50,
  Weight: 2,
  Gap: 0,
};

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
      className="separatorSettingsPopup"
      style={{ left: `${position.left}px`, top: `${position.top}px` }}
      role="dialog"
      aria-label={title}
      tabIndex={-1}
    >
      <div className="separatorSettingsTitle">{title}</div>
      <div className="separatorSettingsControls">
        {controls.map((control) => {
          const value = settings?.[control.settingId] ?? defaultValues[control.key];

          return (
            <label className="separatorSliderControl" key={control.settingId}>
              <span className="separatorSliderHeader">
                <span>{control.label}</span>
                <span>{control.valueLabel(value)}</span>
              </span>
              <input
                type="range"
                min={control.min}
                max={control.max}
                step={control.step}
                value={value}
                onChange={(event) => onChange(control.settingId, Number(event.target.value))}
              />
              <span className="separatorSliderMarks" aria-hidden="true">
                {control.marks.map((mark) => (
                  <span key={`${control.settingId}-${mark.value}`}>{mark.label}</span>
                ))}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );

  return createPortal(popup, document.body);
}
