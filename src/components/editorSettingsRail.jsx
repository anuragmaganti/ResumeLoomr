import SettingsRailControls from './settingsRailControls.jsx';

const settingOptions = [
  { id: "textSize", label: "Text size", shortLabel: "Text" },
  { id: "lineSpacing", label: "Line spacing", shortLabel: "Line gap" },
  { id: "entrySpacing", label: "Entry spacing", shortLabel: "Entry gap" },
  { id: "headingSize", label: "Heading size", shortLabel: "Headings" },
  { id: "nameSize", label: "Name size", shortLabel: "Name size" }
];

export default function EditorSettingsRail({
  settings,
  onAdjustSetting,
  template,
  templateOptions,
  onTemplateChange
}) {
  return (
    <SettingsRailControls
      settings={settings}
      settingOptions={settingOptions}
      template={template}
      templateOptions={templateOptions}
      templateLabel="Choose resume template"
      directionalStepperStyles
      onTemplateChange={onTemplateChange}
      onAdjustSetting={onAdjustSetting}
    />
  );
}
