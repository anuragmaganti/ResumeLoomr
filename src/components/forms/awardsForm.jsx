import AutoResizeTextarea from "../autoResizeTextarea";
import CollapsibleEntryCard, { buildEntrySummary } from "./collapsibleEntryCard";
import FormFieldError from "./formFieldError";

export default function AwardsForm({ awards, actions, getFieldError, markTouched }) {
  return (
    <div className="formStack">
      {awards.map((entry, index) => (
        <CollapsibleEntryCard
          key={entry.id}
          summary={buildEntrySummary(
            [entry.title, entry.issuer, entry.years],
            "Add award, issuer, and date"
          )}
          fallbackSummary="Add award, issuer, and date"
          expandLabel={`award ${index + 1}`}
          menuLabel={`Award ${index + 1} actions`}
          moveUpLabel={`Move award ${index + 1} up`}
          moveDownLabel={`Move award ${index + 1} down`}
          removeLabel={`Remove award ${index + 1}`}
          onMoveUp={() => actions.moveCollectionEntry('awards', entry.id, -1)}
          onMoveDown={() => actions.moveCollectionEntry('awards', entry.id, 1)}
          onRemove={() => actions.removeCollectionEntry('awards', entry.id)}
          disableUp={index === 0}
          disableDown={index === awards.length - 1}
          disableRemove={awards.length === 1}
        >
          <form onSubmit={(event) => event.preventDefault()}>
            <div className="fieldGrid fieldGridTwo">
              <div className="field">
                <label htmlFor={`award-title-${entry.id}`}>Award</label>
                <input
                  type="text"
                  id={`award-title-${entry.id}`}
                  value={entry.title}
                  onChange={(event) => actions.updateCollectionEntry('awards', entry.id, 'title', event.target.value)}
                  onBlur={() => markTouched(`awards.${entry.id}.title`)}
                  placeholder="Employee of the Year"
                />
                <FormFieldError message={getFieldError(`awards.${entry.id}.title`)} />
              </div>

              <div className="field">
                <label htmlFor={`award-years-${entry.id}`}>Date</label>
                <input
                  type="text"
                  id={`award-years-${entry.id}`}
                  value={entry.years}
                  onChange={(event) => actions.updateCollectionEntry('awards', entry.id, 'years', event.target.value)}
                  onBlur={() => markTouched(`awards.${entry.id}.years`)}
                  placeholder="2024"
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor={`award-issuer-${entry.id}`}>Issuer</label>
              <input
                type="text"
                id={`award-issuer-${entry.id}`}
                value={entry.issuer}
                onChange={(event) => actions.updateCollectionEntry('awards', entry.id, 'issuer', event.target.value)}
                onBlur={() => markTouched(`awards.${entry.id}.issuer`)}
                placeholder="Acme Inc."
              />
            </div>

            <div className="field">
              <label htmlFor={`award-details-${entry.id}`}>Details</label>
              <AutoResizeTextarea
                id={`award-details-${entry.id}`}
                value={entry.details}
                onChange={(event) => actions.updateCollectionEntry('awards', entry.id, 'details', event.target.value)}
                onBlur={() => markTouched(`awards.${entry.id}.details`)}
                rows={2}
                placeholder="Add context about why the award matters."
              />
            </div>
          </form>
        </CollapsibleEntryCard>
      ))}

      <button className="button buttonSecondary addEntryButton" type="button" onClick={() => actions.addCollectionEntry('awards')}>
        Add award
      </button>
    </div>
  );
}
