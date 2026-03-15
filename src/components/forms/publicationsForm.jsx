import AutoResizeTextarea from "../autoResizeTextarea";
import CollapsibleEntryCard, { buildEntrySummary } from "./collapsibleEntryCard";
import FormFieldError from "./formFieldError";

export default function PublicationsForm({ publications, actions, getFieldError, markTouched }) {
  return (
    <div className="formStack">
      {publications.map((entry, index) => (
        <CollapsibleEntryCard
          key={entry.id}
          summary={buildEntrySummary(
            [entry.title, entry.publisher, entry.years],
            "Add title, publisher, and date"
          )}
          fallbackSummary="Add title, publisher, and date"
          expandLabel={`publication ${index + 1}`}
          menuLabel={`Publication ${index + 1} actions`}
          moveUpLabel={`Move publication ${index + 1} up`}
          moveDownLabel={`Move publication ${index + 1} down`}
          removeLabel={`Remove publication ${index + 1}`}
          onMoveUp={() => actions.moveCollectionEntry('publications', entry.id, -1)}
          onMoveDown={() => actions.moveCollectionEntry('publications', entry.id, 1)}
          onRemove={() => actions.removeCollectionEntry('publications', entry.id)}
          disableUp={index === 0}
          disableDown={index === publications.length - 1}
          disableRemove={publications.length === 1}
        >
          <form onSubmit={(event) => event.preventDefault()}>
            <div className="fieldGrid fieldGridTwo">
              <div className="field">
                <label htmlFor={`publication-title-${entry.id}`}>Title</label>
                <input
                  type="text"
                  id={`publication-title-${entry.id}`}
                  value={entry.title}
                  onChange={(event) => actions.updateCollectionEntry('publications', entry.id, 'title', event.target.value)}
                  onBlur={() => markTouched(`publications.${entry.id}.title`)}
                  placeholder="Designing for clarity in high-density interfaces"
                />
                <FormFieldError message={getFieldError(`publications.${entry.id}.title`)} />
              </div>

              <div className="field">
                <label htmlFor={`publication-years-${entry.id}`}>Date</label>
                <input
                  type="text"
                  id={`publication-years-${entry.id}`}
                  value={entry.years}
                  onChange={(event) => actions.updateCollectionEntry('publications', entry.id, 'years', event.target.value)}
                  onBlur={() => markTouched(`publications.${entry.id}.years`)}
                  placeholder="2024"
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor={`publication-publisher-${entry.id}`}>Publisher or venue</label>
              <input
                type="text"
                id={`publication-publisher-${entry.id}`}
                value={entry.publisher}
                onChange={(event) => actions.updateCollectionEntry('publications', entry.id, 'publisher', event.target.value)}
                onBlur={() => markTouched(`publications.${entry.id}.publisher`)}
                placeholder="Smashing Magazine"
              />
            </div>

            <div className="field">
              <label htmlFor={`publication-details-${entry.id}`}>Details</label>
              <AutoResizeTextarea
                id={`publication-details-${entry.id}`}
                value={entry.details}
                onChange={(event) => actions.updateCollectionEntry('publications', entry.id, 'details', event.target.value)}
                onBlur={() => markTouched(`publications.${entry.id}.details`)}
                rows={2}
                placeholder="Add context like co-authors, publication type, or impact."
              />
            </div>
          </form>
        </CollapsibleEntryCard>
      ))}

      <button className="button buttonSecondary addEntryButton" type="button" onClick={() => actions.addCollectionEntry('publications')}>
        Add publication
      </button>
    </div>
  );
}
