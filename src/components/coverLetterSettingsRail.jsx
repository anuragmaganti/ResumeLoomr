import { COVER_LETTER_TEMPLATE_OPTIONS } from '../lib/coverLetter.js';
import SettingsRailControls from './settingsRailControls.jsx';

const settings = [
  { id: 'textSize', label: 'Text' },
  { id: 'lineGap', label: 'Line gap' },
  { id: 'paragraphGap', label: 'Paragraph gap' },
  { id: 'nameSize', label: 'Name size' },
];

export default function CoverLetterSettingsRail({ coverLetter, template, onTemplateChange, onAdjustSetting }) {
  return (
    <SettingsRailControls
      className="coverLetterSettingsRail"
      settings={coverLetter.settings}
      settingOptions={settings}
      template={template}
      templateOptions={COVER_LETTER_TEMPLATE_OPTIONS}
      templateLabel="Choose cover letter template"
      onTemplateChange={onTemplateChange}
      onAdjustSetting={onAdjustSetting}
    />
  );
}
