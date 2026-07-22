import { useEffect, useLayoutEffect, useState } from 'react';

export function useWorkspaceRailLayout({ railRef, workspaceReady }) {
  const [columns, setColumns] = useState(2);
  const [hasMeasuredColumns, setHasMeasuredColumns] = useState(false);
  const [motionReady, setMotionReady] = useState(false);

  useLayoutEffect(() => {
    const node = railRef.current;

    if (!node || typeof ResizeObserver === 'undefined') {
      // Mark the fallback layout ready when container observation is unavailable.
      setHasMeasuredColumns(true);
      return undefined;
    }

    const updateColumns = () => {
      const value = Number.parseInt(
        getComputedStyle(node).getPropertyValue('--resume-rail-columns'),
        10,
      );
      setColumns(Number.isFinite(value) ? value : 2);
      setHasMeasuredColumns(true);
    };
    const observer = new ResizeObserver(updateColumns);

    observer.observe(node);
    updateColumns();
    return () => observer.disconnect();
  }, [railRef]);

  useEffect(() => {
    if (!workspaceReady || !hasMeasuredColumns) {
      return undefined;
    }

    let secondFrameId = 0;
    const firstFrameId = window.requestAnimationFrame(() => {
      secondFrameId = window.requestAnimationFrame(() => setMotionReady(true));
    });

    return () => {
      window.cancelAnimationFrame(firstFrameId);
      window.cancelAnimationFrame(secondFrameId);
    };
  }, [hasMeasuredColumns, workspaceReady]);

  return {
    columns,
    motionReady: workspaceReady && hasMeasuredColumns && motionReady,
  };
}
