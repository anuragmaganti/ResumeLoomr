import AutoResizeTextarea from "../autoResizeTextarea";
import CollapsibleEntryCard, { buildEntrySummary } from "./collapsibleEntryCard";
import FormFieldError from "./formFieldError";
import ReorderableTextList from "./reorderableTextList";

export default function ProjectsForm({ projects, actions, getFieldError, markTouched }) {
  return (
    <div className="formStack">
      {projects.map((entry, index) => (
        <CollapsibleEntryCard
          key={entry.id}
          summary={buildEntrySummary(
            [entry.name, entry.subtitle || entry.summary, entry.years],
            "Add a project name and details"
          )}
          fallbackSummary="Add a project name and details"
          expandLabel={`project ${index + 1}`}
          menuLabel={`Project ${index + 1} actions`}
          moveUpLabel={`Move project ${index + 1} up`}
          moveDownLabel={`Move project ${index + 1} down`}
          removeLabel={`Remove project ${index + 1}`}
          onMoveUp={() => actions.moveCollectionEntry('projects', entry.id, -1)}
          onMoveDown={() => actions.moveCollectionEntry('projects', entry.id, 1)}
          onRemove={() => actions.removeCollectionEntry('projects', entry.id)}
          disableUp={index === 0}
          disableDown={index === projects.length - 1}
          disableRemove={projects.length === 1}
        >
          <form onSubmit={(event) => event.preventDefault()}>
            <div className="fieldGrid fieldGridTwo">
              <div className="field">
                <label htmlFor={`project-name-${entry.id}`}>Project name</label>
                <input
                  type="text"
                  id={`project-name-${entry.id}`}
                  value={entry.name}
                  onChange={(event) => actions.updateCollectionEntry('projects', entry.id, 'name', event.target.value)}
                  onBlur={() => markTouched(`projects.${entry.id}.name`)}
                  placeholder="ResumeLoomr"
                />
                <FormFieldError message={getFieldError(`projects.${entry.id}.name`)} />
              </div>

              <div className="field">
                <label htmlFor={`project-years-${entry.id}`}>Dates</label>
                <input
                  type="text"
                  id={`project-years-${entry.id}`}
                  value={entry.years}
                  onChange={(event) => actions.updateCollectionEntry('projects', entry.id, 'years', event.target.value)}
                  onBlur={() => markTouched(`projects.${entry.id}.years`)}
                  placeholder="2025 - Present"
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor={`project-subtitle-${entry.id}`}>Subtitle or stack</label>
              <input
                type="text"
                id={`project-subtitle-${entry.id}`}
                value={entry.subtitle}
                onChange={(event) => actions.updateCollectionEntry('projects', entry.id, 'subtitle', event.target.value)}
                onBlur={() => markTouched(`projects.${entry.id}.subtitle`)}
                placeholder="React, Vite, plain CSS"
              />
            </div>

            <div className="field">
              <label htmlFor={`project-summary-${entry.id}`}>Summary</label>
              <AutoResizeTextarea
                id={`project-summary-${entry.id}`}
                value={entry.summary}
                onChange={(event) => actions.updateCollectionEntry('projects', entry.id, 'summary', event.target.value)}
                onBlur={() => markTouched(`projects.${entry.id}.summary`)}
                rows={2}
                placeholder="Summarize what the project is, who it served, or what made it notable."
              />
            </div>

            <ReorderableTextList
              label="Highlights"
              items={entry.highlights}
              idPrefix={`project-highlights-${entry.id}`}
              pathPrefix={`projects.${entry.id}.highlights`}
              placeholder="Add a measurable project outcome or implementation detail."
              addLabel="Add highlight"
              getFieldError={getFieldError}
              markTouched={markTouched}
              onChangeItem={(itemIndex, value) => actions.updateCollectionTextList('projects', entry.id, 'highlights', itemIndex, value)}
              onMoveItem={(itemIndex, direction) => actions.moveCollectionTextListItem('projects', entry.id, 'highlights', itemIndex, direction)}
              onRemoveItem={(itemIndex) => actions.removeCollectionTextListItem('projects', entry.id, 'highlights', itemIndex)}
              onAddItem={() => actions.addCollectionTextListItem('projects', entry.id, 'highlights')}
            />
          </form>
        </CollapsibleEntryCard>
      ))}

      <button className="button buttonSecondary addEntryButton" type="button" onClick={() => actions.addCollectionEntry('projects')}>
        Add project
      </button>
    </div>
  );
}
