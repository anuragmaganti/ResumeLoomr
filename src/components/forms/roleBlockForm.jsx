import FormFieldError from "./formFieldError";
import ReorderableTextList from "./reorderableTextList";
import { createSectionEntryFormBindings } from "./sectionEntryForm";
import SectionEntryList from "./sectionEntryList";

export default function RoleBlockForm({ section, actions, getFieldError, markTouched, editorTarget, placeholderFor }) {
  const { sectionId, pathFor, placeholder, editorAttrs, updateEntry } = createSectionEntryFormBindings({
    section,
    actions,
    placeholderFor,
  });

  return (
    <SectionEntryList
      section={section}
      actions={actions}
      editorTarget={editorTarget}
      entryNoun={`${section.title} entry`}
      fallbackSummary="Add organization, role, and dates"
      getSummaryValues={(entry) => [entry.company, entry.role, entry.location, entry.yearsExp]}
      addLabel="Add role"
    >
      {(entry) => (
        <>
              <div className="fieldGrid fieldGridTwo">
                <div className="field">
                  <label htmlFor={`role-company-${section.id}-${entry.id}`}>Organization</label>
                  <input
                    type="text"
                    id={`role-company-${section.id}-${entry.id}`}
                    {...editorAttrs(entry.id, 'company')}
                    value={entry.company}
                    onChange={(event) => updateEntry(entry.id, 'company', event.target.value)}
                    onBlur={() => markTouched(pathFor(entry.id, 'company'))}
                    placeholder={placeholder(entry.id, 'company', 'Organization or company')}
                  />
                  <FormFieldError message={getFieldError(pathFor(entry.id, 'company'))} />
                </div>

                <div className="field">
                  <label htmlFor={`role-title-${section.id}-${entry.id}`}>Role</label>
                  <input
                    type="text"
                    id={`role-title-${section.id}-${entry.id}`}
                    {...editorAttrs(entry.id, 'role')}
                    value={entry.role}
                    onChange={(event) => updateEntry(entry.id, 'role', event.target.value)}
                    onBlur={() => markTouched(pathFor(entry.id, 'role'))}
                    placeholder={placeholder(entry.id, 'role', 'Role title')}
                  />
                  <FormFieldError message={getFieldError(pathFor(entry.id, 'role'))} />
                </div>
              </div>

              <div className="fieldGrid fieldGridTwo">
                <div className="field">
                  <label htmlFor={`role-location-${section.id}-${entry.id}`}>Location</label>
                  <input
                    type="text"
                    id={`role-location-${section.id}-${entry.id}`}
                    {...editorAttrs(entry.id, 'location')}
                    value={entry.location}
                    onChange={(event) => updateEntry(entry.id, 'location', event.target.value)}
                    onBlur={() => markTouched(pathFor(entry.id, 'location'))}
                    placeholder={placeholder(entry.id, 'location', 'City, State')}
                  />
                </div>

                <div className="field">
                  <label htmlFor={`role-years-${section.id}-${entry.id}`}>Dates</label>
                  <input
                    type="text"
                    id={`role-years-${section.id}-${entry.id}`}
                    {...editorAttrs(entry.id, 'yearsExp')}
                    value={entry.yearsExp}
                    onChange={(event) => updateEntry(entry.id, 'yearsExp', event.target.value)}
                    onBlur={() => markTouched(pathFor(entry.id, 'yearsExp'))}
                    placeholder={placeholder(entry.id, 'yearsExp', '2022 - Present')}
                  />
                  <FormFieldError message={getFieldError(pathFor(entry.id, 'yearsExp'))} />
                </div>
              </div>

              <ReorderableTextList
                label="Highlights"
                items={entry.activities}
                idPrefix={`role-highlights-${section.id}-${entry.id}`}
                pathPrefix={pathFor(entry.id, 'activities')}
                placeholder="Describe a measurable accomplishment or core responsibility."
                placeholderFor={placeholderFor}
                addLabel="Add highlight"
                getFieldError={getFieldError}
                markTouched={markTouched}
                onChangeItem={(activityIndex, value) => actions.updateSectionBlockTextList(sectionId, entry.id, 'activities', activityIndex, value)}
                onMoveItem={(activityIndex, direction) => actions.moveSectionBlockTextListItem(sectionId, entry.id, 'activities', activityIndex, direction)}
                onRemoveItem={(activityIndex) => actions.removeSectionBlockTextListItem(sectionId, entry.id, 'activities', activityIndex)}
                onAddItem={() => actions.addSectionBlockTextListItem(sectionId, entry.id, 'activities')}
              />
        </>
      )}
    </SectionEntryList>
  );
}
