function stepperButtonClass(direction, directionalStyles) {
  return [
    'button buttonSecondary settingsAdjustButton',
    directionalStyles ? `settingsAdjustButton--${direction}` : '',
  ].filter(Boolean).join(' ');
}

export default function SettingsRailControls({
  className = '',
  settings,
  settingOptions,
  template,
  templateOptions,
  templateLabel,
  directionalStepperStyles = false,
  onTemplateChange,
  onAdjustSetting,
}) {
  return (
    <div className={['settingsRailInner', className].filter(Boolean).join(' ')}>
      <div className="settingsRailList">
        <div className="settingsTemplateControl settingsControl">
          <span className="settingsControlLabel">Template</span>
          <div className="settingsTemplateSegment" role="group" aria-label={templateLabel}>
            {templateOptions.map((option) => (
              <button
                type="button"
                className={`settingsTemplateOption${template === option.id ? ' isActive' : ''}`}
                key={option.id}
                onClick={() => onTemplateChange(option.id)}
                aria-pressed={template === option.id}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {settingOptions.map((setting) => {
          const value = Number(settings[setting.id]) || 0;
          const label = setting.label;

          return (
            <div className="settingsControl" key={setting.id}>
              <span className="settingsControlLabel">{setting.shortLabel || label}</span>
              <div className="settingsStepper" role="group" aria-label={label}>
                <button
                  type="button"
                  className={stepperButtonClass('decrease', directionalStepperStyles)}
                  onClick={() => onAdjustSetting(setting.id, -1)}
                  disabled={value <= -5}
                  aria-label={`Decrease ${label}`}
                >
                  −
                </button>
                <span className="settingsControlValue">{value}</span>
                <button
                  type="button"
                  className={stepperButtonClass('increase', directionalStepperStyles)}
                  onClick={() => onAdjustSetting(setting.id, 1)}
                  disabled={value >= 5}
                  aria-label={`Increase ${label}`}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
