import AutoResizeTextarea from "../autoResizeTextarea";
import CollapsibleEntryCard from "./collapsibleEntryCard";
import { buildEntrySummary } from "./buildEntrySummary";
import FormFieldError from "./formFieldError";
import { createEditorTargetAttributes } from "../../lib/editorTargets";

export default function CertificationsForm({ certifications = [], section, actions, getFieldError, markTouched, editorTarget }) {
  const entries = section?.entries || certifications;
  const sectionId = section?.id || '';
  const isBlockEditor = Boolean(sectionId);
  const pathFor = (entryId, field) => (
    isBlockEditor ? `sections.${sectionId}.${entryId}.${field}` : `certifications.${entryId}.${field}`
  );
  const editorAttrs = (entryId, field) => createEditorTargetAttributes(pathFor(entryId, field), { entryId });
  const updateEntry = (entryId, field, value) => (
    isBlockEditor
      ? actions.updateSectionBlockEntry(sectionId, entryId, field, value)
      : actions.updateCollectionEntry('certifications', entryId, field, value)
  );
  const addEntry = () => (
    isBlockEditor ? actions.addSectionBlockEntry(sectionId) : actions.addCollectionEntry('certifications')
  );
  const moveEntry = (entryId, direction) => (
    isBlockEditor ? actions.moveSectionBlockEntry(sectionId, entryId, direction) : actions.moveCollectionEntry('certifications', entryId, direction)
  );
  const removeEntry = (entryId) => (
    isBlockEditor ? actions.removeSectionBlockEntry(sectionId, entryId) : actions.removeCollectionEntry('certifications', entryId)
  );

  return (
    <div className="formStack">
      {entries.map((entry, index) => (
        <CollapsibleEntryCard
          key={entry.id}
          summary={buildEntrySummary(
            [entry.name, entry.issuer, entry.years],
            "Add certification, issuer, and date"
          )}
          fallbackSummary="Add certification, issuer, and date"
          expandLabel={`certification ${index + 1}`}
          menuLabel={`Certification ${index + 1} actions`}
          moveUpLabel={`Move certification ${index + 1} up`}
          moveDownLabel={`Move certification ${index + 1} down`}
          removeLabel={`Remove certification ${index + 1}`}
          onMoveUp={() => moveEntry(entry.id, -1)}
          onMoveDown={() => moveEntry(entry.id, 1)}
          onRemove={() => removeEntry(entry.id)}
          disableUp={index === 0}
          disableDown={index === entries.length - 1}
          disableRemove={entries.length === 1}
          expandSignal={editorTarget?.entryId === entry.id ? editorTarget.requestId : 0}
        >
          <form onSubmit={(event) => event.preventDefault()}>
            <div className="fieldGrid fieldGridTwo">
              <div className="field">
                <label htmlFor={`certification-name-${entry.id}`}>Certification</label>
                <input
                  type="text"
                  id={`certification-name-${entry.id}`}
                  {...editorAttrs(entry.id, 'name')}
                  value={entry.name}
                  onChange={(event) => updateEntry(entry.id, 'name', event.target.value)}
                  onBlur={() => markTouched(pathFor(entry.id, 'name'))}
                  placeholder="AWS Certified Cloud Practitioner"
                />
                <FormFieldError message={getFieldError(pathFor(entry.id, 'name'))} />
              </div>

              <div className="field">
                <label htmlFor={`certification-years-${entry.id}`}>Date</label>
                <input
                  type="text"
                  id={`certification-years-${entry.id}`}
                  {...editorAttrs(entry.id, 'years')}
                  value={entry.years}
                  onChange={(event) => updateEntry(entry.id, 'years', event.target.value)}
                  onBlur={() => markTouched(pathFor(entry.id, 'years'))}
                  placeholder="2024"
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor={`certification-issuer-${entry.id}`}>Issuer</label>
              <input
                type="text"
                id={`certification-issuer-${entry.id}`}
                {...editorAttrs(entry.id, 'issuer')}
                value={entry.issuer}
                onChange={(event) => updateEntry(entry.id, 'issuer', event.target.value)}
                onBlur={() => markTouched(pathFor(entry.id, 'issuer'))}
                placeholder="Amazon Web Services"
              />
            </div>

            <div className="field">
              <label htmlFor={`certification-details-${entry.id}`}>Details</label>
              <AutoResizeTextarea
                id={`certification-details-${entry.id}`}
                {...editorAttrs(entry.id, 'details')}
                value={entry.details}
                onChange={(event) => updateEntry(entry.id, 'details', event.target.value)}
                onBlur={() => markTouched(pathFor(entry.id, 'details'))}
                rows={2}
                placeholder="Add optional details like scope, credential ID, or specialization."
              />
            </div>
          </form>
        </CollapsibleEntryCard>
      ))}

      <button className="button buttonSecondary addEntryButton" type="button" onClick={addEntry}>
        Add certification
      </button>
    </div>
  );
}
