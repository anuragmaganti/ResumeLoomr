import { useState } from "react";

const settingOptions = [
  { id: "textSize", label: "Text size" },
  { id: "horizontalMargins", label: "Horizontal margins" },
  { id: "verticalMargins", label: "Vertical margins" }
];

const advancedSettingOptions = [
  { id: "lineSpacing", label: "Line spacing" },
  { id: "sectionSpacing", label: "Section spacing" },
  { id: "entrySpacing", label: "Entry spacing" },
  { id: "headingSize", label: "Heading size" },
  { id: "nameSize", label: "Name size" }
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
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  function renderSettingControl(setting) {
    const value = settings[setting.id];

    return (
      <div className="settingsControl" key={setting.id}>
        <span className="settingsControlLabel">{setting.label}</span>

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
        <label className="settingsTemplateControl settingsControl" htmlFor="settings-template-select">
          <span className="settingsControlLabel">Template</span>
          <select
            id="settings-template-select"
            className="toolbarSelect settingsTemplateSelect"
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

        {settingOptions.map(renderSettingControl)}

        <button
          type="button"
          className="settingsControl settingsControlToggle"
          onClick={() => setIsAdvancedOpen((current) => !current)}
          aria-expanded={isAdvancedOpen}
          aria-controls="advanced-settings-group"
        >
          <span className="settingsControlLabel">
            {isAdvancedOpen ? "Collapse" : "Advanced Settings"}
          </span>
        </button>

        <div
          id="advanced-settings-group"
          className={`settingsAdvancedGroup${isAdvancedOpen ? " isExpanded" : ""}`}
        >
          <div className="settingsAdvancedContent">
            {advancedSettingOptions.map(renderSettingControl)}
          </div>
        </div>
      </div>
    </div>
  );
}
