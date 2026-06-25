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
  expandSignal = 0,
  children,
}) {
  const [collapseState, setCollapseState] = useState({
    isCollapsed: false,
    collapsedAfterExpandSignal: 0,
  });
  const isForceExpanded = Boolean(expandSignal && expandSignal !== collapseState.collapsedAfterExpandSignal);
  const isVisiblyCollapsed = collapseState.isCollapsed && !isForceExpanded;
  const summaryText = summary || fallbackSummary;

  return (
    <fieldset className={`formSection entryCard${isVisiblyCollapsed ? " isCollapsed" : ""}`}>
      <div className="entryHeader entryHeaderActionsOnly">
        <div className="entryActions">
          {!isVisiblyCollapsed ? (
            <button
              type="button"
              className="button buttonGhost entryCollapseButton"
              onClick={() => {
                setCollapseState({
                  isCollapsed: true,
                  collapsedAfterExpandSignal: expandSignal,
                });
              }}
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

      {isVisiblyCollapsed ? (
        <button
          type="button"
          className="entrySummaryButton"
          onClick={() => {
            setCollapseState({
              isCollapsed: false,
              collapsedAfterExpandSignal: 0,
            });
          }}
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
