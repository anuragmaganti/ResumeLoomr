import { useEffect, useLayoutEffect, useState } from 'react';

import {
  PRINT_PAGE_HEIGHT_PX,
  PRINT_PAGE_WIDTH_PX,
  calculatePreviewPageBreaks,
} from '../lib/previewPagination.js';
import {
  collectPreviewBreakCandidates,
  getPreviewStickyTop,
  measurePreviewContentFlowHeight,
  metricsAreEqual,
  parseCssLengthToPixels,
} from './resumePreviewGeometry.js';

const PAGE_FIT_TOLERANCE_PX = 3;
const EMPTY_PAGE_METRICS = {
  pageWidth: 0,
  pageHeight: 0,
  contentHeight: 0,
  pageCount: 1,
  pageBreaks: [],
  scale: 1,
  layoutWidth: 0,
};

export function useWrappedEntryHeaderSeparators({
  activeHeaderLayout,
  presentationVars,
  previewModel,
  resumeRootRef,
}) {
  useLayoutEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    let frameId = 0;

    function updateWrappedHeaderSeparators() {
      const root = resumeRootRef.current;

      if (!root) {
        return;
      }

      root.querySelectorAll('[data-entry-header-side="true"]').forEach((sideElement) => {
        const items = Array.from(sideElement.querySelectorAll('[data-entry-header-item="true"]'));

        items.forEach((item, index) => {
          const separator = item.querySelector('.entryHeaderFieldSeparator');

          if (!separator) {
            return;
          }

          const previousItem = items[index - 1];
          const shouldHideSeparator = previousItem
            ? item.getBoundingClientRect().top > previousItem.getBoundingClientRect().top + 1
            : false;

          separator.classList.toggle('entryHeaderFieldSeparator--wrapped', shouldHideSeparator);
        });
      });
    }

    function scheduleUpdate() {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updateWrappedHeaderSeparators);
    }

    scheduleUpdate();
    window.addEventListener('resize', scheduleUpdate);

    let resizeObserver;

    if (typeof ResizeObserver !== 'undefined' && resumeRootRef.current) {
      resizeObserver = new ResizeObserver(scheduleUpdate);
      resizeObserver.observe(resumeRootRef.current);
    }

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', scheduleUpdate);
      resizeObserver?.disconnect();
    };
  }, [activeHeaderLayout, presentationVars, previewModel, resumeRootRef]);
}

export function useResumePreviewPageMetrics({
  frameRef,
  presentationVars,
  previewModel,
  resumeRootRef,
}) {
  const [pageMetrics, setPageMetrics] = useState(EMPTY_PAGE_METRICS);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    let frameId = 0;

    function readPageMetrics() {
      const resumeElement = resumeRootRef.current;
      const frameElement = frameRef.current;

      if (!resumeElement || !frameElement) {
        setPageMetrics((current) => (
          metricsAreEqual(current, EMPTY_PAGE_METRICS) ? current : EMPTY_PAGE_METRICS
        ));
        return;
      }

      const styles = window.getComputedStyle(resumeElement);
      const frameRect = frameElement.getBoundingClientRect();
      const availableWidth = Math.max(240, frameElement.clientWidth || frameRect.width);
      const pageWidth = PRINT_PAGE_WIDTH_PX;
      const pageHeight = PRINT_PAGE_HEIGHT_PX;
      const paddingTop = parseCssLengthToPixels(styles.paddingTop);
      const paddingBottom = parseCssLengthToPixels(styles.paddingBottom);
      const printableHeight = Math.max(1, pageHeight - paddingTop - paddingBottom);
      const measuredContentFlowHeight = measurePreviewContentFlowHeight(
        resumeElement,
        paddingTop,
        resumeElement.scrollHeight - paddingTop - paddingBottom,
      );
      const contentFlowHeight = previewModel.hasContent
        ? Math.max(printableHeight, measuredContentFlowHeight - PAGE_FIT_TOLERANCE_PX)
        : printableHeight;
      const pageBreaks = previewModel.hasContent
        ? calculatePreviewPageBreaks({
          contentHeight: contentFlowHeight,
          printableHeight,
          breakCandidates: collectPreviewBreakCandidates(resumeElement, paddingTop),
        })
        : [];
      const markerBreaks = pageBreaks.map((pageBreak) => Math.round(paddingTop + pageBreak));
      const pageCount = markerBreaks.length + 1;
      const contentHeight = Math.max(pageHeight, paddingTop + contentFlowHeight + paddingBottom);
      const availableHeight = Math.max(
        320,
        window.innerHeight - getPreviewStickyTop(frameElement) - 24,
      );
      const fitPageHeightScale = Math.min(availableHeight / pageHeight, 1);
      const widthScale = Math.min(availableWidth / pageWidth, 1);
      const fullPageScale = Math.min(widthScale, fitPageHeightScale, 1);
      const scale = Math.max(0.35, fullPageScale);
      const layoutScale = Math.max(0.35, fitPageHeightScale);
      const nextMetrics = {
        pageWidth: Math.round(pageWidth),
        pageHeight: Math.round(pageHeight),
        contentHeight: Math.round(contentHeight),
        pageCount,
        pageBreaks: markerBreaks,
        scale: Number(scale.toFixed(4)),
        layoutWidth: Math.round(pageWidth * layoutScale),
      };

      setPageMetrics((current) => (metricsAreEqual(current, nextMetrics) ? current : nextMetrics));
    }

    function scheduleRead() {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(readPageMetrics);
    }

    scheduleRead();
    window.addEventListener('resize', scheduleRead);

    let resizeObserver;

    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(scheduleRead);

      if (resumeRootRef.current) {
        resizeObserver.observe(resumeRootRef.current);
      }

      if (frameRef.current) {
        resizeObserver.observe(frameRef.current);
      }
    }

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', scheduleRead);
      resizeObserver?.disconnect();
    };
  }, [frameRef, presentationVars, previewModel, resumeRootRef]);

  return pageMetrics;
}

export function useResumePrintPageRule(printPageRule) {
  useLayoutEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const styleId = 'resumeloomr-print-page-rule';
    let styleElement = document.getElementById(styleId);

    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      styleElement.media = 'print';
      document.head.appendChild(styleElement);
    }

    styleElement.textContent = printPageRule;

    return () => {
      if (styleElement?.parentNode && styleElement.textContent === printPageRule) {
        styleElement.parentNode.removeChild(styleElement);
      }
    };
  }, [printPageRule]);
}
