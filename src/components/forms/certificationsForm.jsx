import AutoResizeTextarea from "../autoResizeTextarea";
import CollapsibleEntryCard from "./collapsibleEntryCard";
import { buildEntrySummary } from "./buildEntrySummary";
import FormFieldError from "./formFieldError";

export default function CertificationsForm({ certifications, actions, getFieldError, markTouched }) {
  return (
    <div className="formStack">
      {certifications.map((entry, index) => (
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
          onMoveUp={() => actions.moveCollectionEntry('certifications', entry.id, -1)}
          onMoveDown={() => actions.moveCollectionEntry('certifications', entry.id, 1)}
          onRemove={() => actions.removeCollectionEntry('certifications', entry.id)}
          disableUp={index === 0}
          disableDown={index === certifications.length - 1}
          disableRemove={certifications.length === 1}
        >
          <form onSubmit={(event) => event.preventDefault()}>
            <div className="fieldGrid fieldGridTwo">
              <div className="field">
                <label htmlFor={`certification-name-${entry.id}`}>Certification</label>
                <input
                  type="text"
                  id={`certification-name-${entry.id}`}
                  value={entry.name}
                  onChange={(event) => actions.updateCollectionEntry('certifications', entry.id, 'name', event.target.value)}
                  onBlur={() => markTouched(`certifications.${entry.id}.name`)}
                  placeholder="AWS Certified Cloud Practitioner"
                />
                <FormFieldError message={getFieldError(`certifications.${entry.id}.name`)} />
              </div>

              <div className="field">
                <label htmlFor={`certification-years-${entry.id}`}>Date</label>
                <input
                  type="text"
                  id={`certification-years-${entry.id}`}
                  value={entry.years}
                  onChange={(event) => actions.updateCollectionEntry('certifications', entry.id, 'years', event.target.value)}
                  onBlur={() => markTouched(`certifications.${entry.id}.years`)}
                  placeholder="2024"
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor={`certification-issuer-${entry.id}`}>Issuer</label>
              <input
                type="text"
                id={`certification-issuer-${entry.id}`}
                value={entry.issuer}
                onChange={(event) => actions.updateCollectionEntry('certifications', entry.id, 'issuer', event.target.value)}
                onBlur={() => markTouched(`certifications.${entry.id}.issuer`)}
                placeholder="Amazon Web Services"
              />
            </div>

            <div className="field">
              <label htmlFor={`certification-details-${entry.id}`}>Details</label>
              <AutoResizeTextarea
                id={`certification-details-${entry.id}`}
                value={entry.details}
                onChange={(event) => actions.updateCollectionEntry('certifications', entry.id, 'details', event.target.value)}
                onBlur={() => markTouched(`certifications.${entry.id}.details`)}
                rows={2}
                placeholder="Add optional details like scope, credential ID, or specialization."
              />
            </div>
          </form>
        </CollapsibleEntryCard>
      ))}

      <button className="button buttonSecondary addEntryButton" type="button" onClick={() => actions.addCollectionEntry('certifications')}>
        Add certification
      </button>
    </div>
  );
}
