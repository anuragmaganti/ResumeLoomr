import { useState } from "react";
import EntryActionMenu from "./entryActionMenu";

export default function CollapsibleEntryCard({
  summary,
  fallbackSummary,
  expandLabel,
  menuLabel,
  moveUpLabel,
  moveDownLabel,
  removeLabel,
  onMoveUp,
  onMoveDown,
  onRemove,
  disableUp = false,
  disableDown = false,
  disableRemove = false,
  children,
}) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const summaryText = summary || fallbackSummary;

  return (
    <fieldset className={`formSection entryCard${isCollapsed ? " isCollapsed" : ""}`}>
      <div className="entryHeader entryHeaderActionsOnly">
        <div className="entryActions">
          {!isCollapsed ? (
            <button
              type="button"
              className="button buttonGhost entryCollapseButton"
              onClick={() => setIsCollapsed(true)}
              aria-label={`Collapse ${expandLabel}`}
            >
              Collapse
            </button>
          ) : null}
          <EntryActionMenu
            menuLabel={menuLabel}
            moveUpLabel={moveUpLabel}
            moveDownLabel={moveDownLabel}
            removeLabel={removeLabel}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            onRemove={onRemove}
            disableUp={disableUp}
            disableDown={disableDown}
            disableRemove={disableRemove}
          />
        </div>
      </div>

      {isCollapsed ? (
        <button
          type="button"
          className="entrySummaryButton"
          onClick={() => setIsCollapsed(false)}
          aria-label={`Expand ${expandLabel}`}
        >
          <span className="entrySummaryText">{summaryText}</span>
          <span className="entrySummaryHint">Expand</span>
        </button>
      ) : (
        children
      )}
    </fieldset>
  );
}
