import { COVER_LETTER_TEMPLATE_OPTIONS } from '../lib/coverLetter.js';

const settings = [
  { id: 'textSize', label: 'Text' },
  { id: 'lineGap', label: 'Line gap' },
  { id: 'paragraphGap', label: 'Paragraph gap' },
  { id: 'nameSize', label: 'Name size' },
];

export default function CoverLetterSettingsRail({ coverLetter, template, onTemplateChange, onAdjustSetting }) {
  return (
    <div className="settingsRailInner coverLetterSettingsRail">
      <div className="settingsRailList">
        <div className="settingsTemplateControl settingsControl">
          <span className="settingsControlLabel">Template</span>
          <div className="settingsTemplateSegment" role="group" aria-label="Choose cover letter template">
            {COVER_LETTER_TEMPLATE_OPTIONS.map((option) => (
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
        {settings.map((setting) => {
          const value = Number(coverLetter.settings[setting.id]) || 0;
          return (
            <div className="settingsControl" key={setting.id}>
              <span className="settingsControlLabel">{setting.label}</span>
              <div className="settingsStepper" role="group" aria-label={setting.label}>
                <button
                  type="button"
                  className="button buttonSecondary settingsAdjustButton"
                  onClick={() => onAdjustSetting(setting.id, -1)}
                  disabled={value <= -5}
                  aria-label={`Decrease ${setting.label}`}
                >−</button>
                <span className="settingsControlValue">{value}</span>
                <button
                  type="button"
                  className="button buttonSecondary settingsAdjustButton"
                  onClick={() => onAdjustSetting(setting.id, 1)}
                  disabled={value >= 5}
                  aria-label={`Increase ${setting.label}`}
                >+</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
