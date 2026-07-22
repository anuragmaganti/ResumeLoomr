import CollapsibleEntryCard from './collapsibleEntryCard.jsx';
import { buildEntrySummary } from './buildEntrySummary.js';

function capitalizeLabel(value) {
  const label = String(value || 'entry');
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}

export default function SectionEntryList({
  section,
  actions,
  editorTarget,
  entryNoun,
  actionNoun = entryNoun,
  fallbackSummary,
  getSummaryValues,
  addLabel,
  children,
}) {
  const entries = section.entries || [];
  const actionLabel = capitalizeLabel(actionNoun);

  return (
    <div className="formStack">
      {entries.map((entry, index) => (
        <CollapsibleEntryCard
          key={entry.id}
          summary={buildEntrySummary(getSummaryValues(entry), fallbackSummary)}
          fallbackSummary={fallbackSummary}
          expandLabel={`${entryNoun} ${index + 1}`}
          menuLabel={`${actionLabel} ${index + 1} actions`}
          moveUpLabel={`Move ${actionNoun} ${index + 1} up`}
          moveDownLabel={`Move ${actionNoun} ${index + 1} down`}
          removeLabel={`Remove ${actionNoun} ${index + 1}`}
          onMoveUp={() => actions.moveSectionBlockEntry(section.id, entry.id, -1)}
          onMoveDown={() => actions.moveSectionBlockEntry(section.id, entry.id, 1)}
          onRemove={() => actions.removeSectionBlockEntry(section.id, entry.id)}
          disableUp={index === 0}
          disableDown={index === entries.length - 1}
          disableRemove={entries.length === 1}
          expandSignal={editorTarget?.entryId === entry.id ? editorTarget.requestId : 0}
        >
          <form onSubmit={(event) => event.preventDefault()}>
            {children(entry, index)}
          </form>
        </CollapsibleEntryCard>
      ))}

      <button
        className="button buttonSecondary addEntryButton"
        type="button"
        onClick={() => actions.addSectionBlockEntry(section.id)}
      >
        {addLabel}
      </button>
    </div>
  );
}
