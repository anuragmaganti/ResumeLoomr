import {
  addSectionBlockEducationCustomSection,
  addSectionBlockEducationProgram,
  addSectionBlockEntry,
  addSectionBlockTextListItem,
  commitSummaryTitle,
  commitSectionTitle,
  dismissSampleInformation,
  moveSectionBlockEducationCustomSection,
  moveSectionBlockEducationProgram,
  moveSectionBlockEntry,
  moveSectionBlockTextListItem,
  removeResumeSectionBlock,
  removeSectionBlockEducationCustomSection,
  removeSectionBlockEducationProgram,
  removeSectionBlockEntry,
  removeSectionBlockTextListItem,
  reorderSectionBlockEntriesToMatch,
  reorderSectionBlockTextListItem,
  setPersonalContactOrder,
  setResumeSettingValue,
  setResumeSummaryWidthPercent,
  setSummaryTitleVisibility,
  setSampleTextListOrder,
  setSectionEntryHeaderLayout,
  updatePersonalField,
  updateResumeSetting,
  updateSampleDisplay,
  updateSectionBlockEducationCustomSection,
  updateSectionBlockEducationProgram,
  updateSectionBlockEntry,
  updateSectionBlockTextList,
  updateSectionTitle,
} from './resume.js';
import { materializeAndReorderSectionBlockEntries } from './resumeSampleProjection.js';

export function createResumeEditorActions({
  updateResume,
  addResumeSection,
  prepareTransientSampleEntry,
  endTransientSampleEntry,
  endTransientSampleEntryUnless,
}) {
  return {
    updatePersonalField(field, value) {
      updateResume((resume) => updatePersonalField(resume, field, value));
    },
    updateSectionTitle(sectionId, value) {
      updateResume((resume) => updateSectionTitle(resume, sectionId, value));
    },
    commitSectionTitle(sectionId) {
      updateResume((resume) => commitSectionTitle(resume, sectionId));
    },
    commitSummaryTitle() {
      updateResume((resume) => commitSummaryTitle(resume));
    },
    updateResumeSetting(settingId, delta) {
      updateResume((resume) => updateResumeSetting(resume, settingId, delta));
    },
    setSummaryWidthPercent(widthPercent) {
      updateResume((resume) => setResumeSummaryWidthPercent(resume, widthPercent));
    },
    setResumeSettingValue(settingId, value) {
      updateResume((resume) => setResumeSettingValue(resume, settingId, value));
    },
    setSummaryTitleVisibility(isVisible) {
      updateResume((resume) => setSummaryTitleVisibility(resume, isVisible));
    },
    setPersonalContactOrder(orderedFields) {
      updateResume((resume) => setPersonalContactOrder(resume, orderedFields));
    },
    setSectionEntryHeaderLayout(sectionId, layout) {
      updateResume((resume) => setSectionEntryHeaderLayout(resume, sectionId, layout));
    },
    startFromScratch() {
      updateResume((resume) => updateSampleDisplay(resume, { hasStarted: true }));
    },
    setSampleInformationVisible(showInformation) {
      endTransientSampleEntry();
      updateResume((resume) => updateSampleDisplay(resume, {
        hasStarted: true,
        showInformation,
      }));
    },
    dismissSampleInformation() {
      endTransientSampleEntry();
      updateResume((resume) => dismissSampleInformation(resume));
    },
    setSampleTextListOrder(orderKey, orderedSourceIndexes) {
      updateResume((resume) => setSampleTextListOrder(resume, orderKey, orderedSourceIndexes));
    },
    addResumeSection,
    removeResumeSection(sectionId) {
      endTransientSampleEntry();
      updateResume((resume) => removeResumeSectionBlock(resume, sectionId));
    },
    updateSectionBlockEntry(sectionId, entryId, field, value) {
      updateResume((resume) => updateSectionBlockEntry(resume, sectionId, entryId, field, value));
    },
    addSectionBlockEntry(sectionId) {
      updateResume((resume) => addSectionBlockEntry(resume, sectionId));
    },
    moveSectionBlockEntry(sectionId, entryId, direction) {
      updateResume((resume) => moveSectionBlockEntry(resume, sectionId, entryId, direction));
    },
    reorderSectionEntries(sectionId, nextEntryIds) {
      updateResume((resume) => reorderSectionBlockEntriesToMatch(resume, sectionId, nextEntryIds));
    },
    materializeAndReorderSectionEntries(sectionId, nextEntryIds, sampleEntryBindings) {
      endTransientSampleEntry();
      updateResume((resume) => (
        materializeAndReorderSectionBlockEntries(resume, sectionId, nextEntryIds, sampleEntryBindings)
      ));
    },
    removeSectionBlockEntry(sectionId, entryId) {
      updateResume((resume) => removeSectionBlockEntry(resume, sectionId, entryId));
    },
    updateSectionBlockTextList(sectionId, entryId, field, itemIndex, value) {
      updateResume((resume) => updateSectionBlockTextList(resume, sectionId, entryId, field, itemIndex, value));
    },
    addSectionBlockTextListItem(sectionId, entryId, field) {
      updateResume((resume) => addSectionBlockTextListItem(resume, sectionId, entryId, field));
    },
    moveSectionBlockTextListItem(sectionId, entryId, field, itemIndex, direction) {
      updateResume((resume) => moveSectionBlockTextListItem(resume, sectionId, entryId, field, itemIndex, direction));
    },
    reorderSectionTextList(sectionId, entryId, field, fromIndex, toIndex) {
      updateResume((resume) => reorderSectionBlockTextListItem(resume, sectionId, entryId, field, fromIndex, toIndex));
    },
    removeSectionBlockTextListItem(sectionId, entryId, field, itemIndex) {
      updateResume((resume) => removeSectionBlockTextListItem(resume, sectionId, entryId, field, itemIndex));
    },
    updateSectionBlockEducationCustomSection(sectionId, entryId, sectionIndex, field, value) {
      updateResume((resume) => updateSectionBlockEducationCustomSection(
        resume,
        sectionId,
        entryId,
        sectionIndex,
        field,
        value,
      ));
    },
    addSectionBlockEducationCustomSection(sectionId, entryId) {
      updateResume((resume) => addSectionBlockEducationCustomSection(resume, sectionId, entryId));
    },
    moveSectionBlockEducationCustomSection(sectionId, entryId, sectionIndex, direction) {
      updateResume((resume) => moveSectionBlockEducationCustomSection(
        resume,
        sectionId,
        entryId,
        sectionIndex,
        direction,
      ));
    },
    removeSectionBlockEducationCustomSection(sectionId, entryId, sectionIndex) {
      updateResume((resume) => removeSectionBlockEducationCustomSection(resume, sectionId, entryId, sectionIndex));
    },
    updateSectionBlockEducationProgram(sectionId, entryId, programIndex, field, value) {
      updateResume((resume) => updateSectionBlockEducationProgram(
        resume,
        sectionId,
        entryId,
        programIndex,
        field,
        value,
      ));
    },
    addSectionBlockEducationProgram(sectionId, entryId) {
      updateResume((resume) => addSectionBlockEducationProgram(resume, sectionId, entryId));
    },
    moveSectionBlockEducationProgram(sectionId, entryId, programIndex, direction) {
      updateResume((resume) => moveSectionBlockEducationProgram(
        resume,
        sectionId,
        entryId,
        programIndex,
        direction,
      ));
    },
    removeSectionBlockEducationProgram(sectionId, entryId, programIndex) {
      updateResume((resume) => removeSectionBlockEducationProgram(resume, sectionId, entryId, programIndex));
    },
    prepareTransientSampleEntry,
    endTransientSampleEntry,
    endTransientSampleEntryUnless,
  };
}
