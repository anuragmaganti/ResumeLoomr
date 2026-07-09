const settingOptions = [
  { id: "textSize", label: "Text size", shortLabel: "Text" },
  { id: "lineSpacing", label: "Line spacing", shortLabel: "Line gap" },
  { id: "entrySpacing", label: "Entry spacing", shortLabel: "Entry gap" },
  { id: "headingSize", label: "Heading size", shortLabel: "Headings" },
  { id: "nameSize", label: "Name size", shortLabel: "Name size" }
];

function formatSettingValue(value) {
  if (value === 0) {
    return "0";
  }

  return value > 0 ? `+${value}` : String(value);
}

export default function EditorSettingsRail({
  settings,
  onAdjustSetting,
  template,
  templateOptions,
  onTemplateChange
}) {
  function renderSettingControl(setting) {
    const value = settings[setting.id];

    return (
      <div className="settingsControl" key={setting.id}>
        <span className="settingsControlLabel">{setting.shortLabel}</span>

        <div className="settingsStepper" role="group" aria-label={setting.label}>
          <button
            type="button"
            className="button buttonSecondary settingsAdjustButton settingsAdjustButton--decrease"
            onClick={() => onAdjustSetting(setting.id, -1)}
            disabled={value <= -5}
            aria-label={`Decrease ${setting.label}`}
          >
            -
          </button>

          <span className="settingsControlValue">{formatSettingValue(value)}</span>

          <button
            type="button"
            className="button buttonSecondary settingsAdjustButton settingsAdjustButton--increase"
            onClick={() => onAdjustSetting(setting.id, 1)}
            disabled={value >= 5}
            aria-label={`Increase ${setting.label}`}
          >
            +
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="settingsRailInner">
      <div className="settingsRailHeader">
        <h2>Settings</h2>
      </div>

      <div className="settingsRailList">
        <div className="settingsTemplateControl settingsControl">
          <span className="settingsControlLabel">Template</span>
          <div className="settingsTemplateSegment" role="group" aria-label="Choose resume template">
            {templateOptions.map((option) => (
              <button
                type="button"
                className={`settingsTemplateOption${template === option.id ? " isActive" : ""}`}
                key={option.id}
                onClick={() => onTemplateChange(option.id)}
                aria-pressed={template === option.id}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {settingOptions.map(renderSettingControl)}
      </div>
    </div>
  );
}
