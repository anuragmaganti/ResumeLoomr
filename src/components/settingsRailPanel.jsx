import { useEffect, useId, useState } from 'react';

const COMPACT_SETTINGS_QUERY = '(max-width: 980px)';

function useCompactSettingsRail() {
  const [isCompact, setIsCompact] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia(COMPACT_SETTINGS_QUERY).matches
  ));

  useEffect(() => {
    const mediaQuery = window.matchMedia(COMPACT_SETTINGS_QUERY);
    const updateMatch = () => setIsCompact(mediaQuery.matches);

    updateMatch();
    mediaQuery.addEventListener('change', updateMatch);
    return () => mediaQuery.removeEventListener('change', updateMatch);
  }, []);

  return isCompact;
}

export default function SettingsRailPanel({
  children,
  className = '',
  isDisabled = false,
  onPointerDownCapture,
  onClickCapture,
  onFocusCapture,
  overlay = null,
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const contentId = useId();
  const isCompact = useCompactSettingsRail();
  const isCollapsed = isCompact && !isExpanded;

  return (
    <aside
      className={['settingsRail panel', isExpanded ? 'isExpanded' : '', isDisabled ? 'isStartPending' : '', className]
        .filter(Boolean)
        .join(' ')}
      aria-disabled={isDisabled || undefined}
      onPointerDownCapture={onPointerDownCapture}
      onClickCapture={onClickCapture}
      onFocusCapture={onFocusCapture}
    >
      <button
        type="button"
        className="settingsRailToggle"
        aria-expanded={isExpanded}
        aria-controls={contentId}
        onClick={() => setIsExpanded((expanded) => !expanded)}
      >
        <span>Settings</span>
        <span className="settingsRailToggleIcon" aria-hidden="true" />
      </button>
      <div
        id={contentId}
        className="settingsRailCollapse"
        aria-hidden={isCollapsed || undefined}
        inert={isCollapsed}
      >
        <div className="settingsRailCollapseClip">
          <div className="settingsRailCollapseContent">{children}</div>
        </div>
      </div>
      {overlay}
    </aside>
  );
}
