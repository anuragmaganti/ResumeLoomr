import { useEffect, useState } from 'react';

const STACKED_WORKSPACE_BREAKPOINT_PX = 980;

export function useEditorStageMaxHeight({ panelRef, template, previewModel }) {
  const [maxHeight, setMaxHeight] = useState(null);

  useEffect(() => {
    function syncHeight() {
      if (window.innerWidth <= STACKED_WORKSPACE_BREAKPOINT_PX) {
        setMaxHeight(null);
        return;
      }

      const previewPanelHeight = panelRef.current?.offsetHeight ?? 0;
      setMaxHeight(previewPanelHeight > 0 ? previewPanelHeight : null);
    }

    syncHeight();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', syncHeight);
      return () => window.removeEventListener('resize', syncHeight);
    }

    const observer = new ResizeObserver(syncHeight);

    if (panelRef.current) {
      observer.observe(panelRef.current);
    }

    window.addEventListener('resize', syncHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', syncHeight);
    };
  }, [panelRef, previewModel, template]);

  return maxHeight;
}
