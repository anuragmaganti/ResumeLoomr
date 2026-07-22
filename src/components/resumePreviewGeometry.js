import { CSS_PIXELS_PER_INCH } from '../lib/previewPagination.js';

const FIRST_SECTION_ENTRY_SNAP_DISTANCE_PX = 144;

export function parseCssPixelValue(value, fallback = 0) {
    const parsed = Number.parseFloat(value);

    return Number.isFinite(parsed) ? parsed : fallback;
}

export function parseCssLengthToPixels(value, fallback = 0) {
    const text = String(value || '').trim().toLowerCase();
    const parsed = Number.parseFloat(text);

    if (!Number.isFinite(parsed)) {
        return fallback;
    }

    if (text.endsWith('in')) {
        return parsed * CSS_PIXELS_PER_INCH;
    }

    return parsed;
}

export function getPreviewStickyTop(frameElement) {
    const frameStyles = window.getComputedStyle(frameElement);
    const stickyTop = parseCssPixelValue(frameStyles.top, 0);

    return Number.isFinite(stickyTop) ? stickyTop : 0;
}

export function metricsAreEqual(current, next) {
    return (
        current.pageWidth === next.pageWidth &&
        current.pageHeight === next.pageHeight &&
        current.contentHeight === next.contentHeight &&
        current.pageCount === next.pageCount &&
        current.layoutWidth === next.layoutWidth &&
        Math.abs(current.scale - next.scale) < 0.001 &&
        current.pageBreaks.length === next.pageBreaks.length &&
        current.pageBreaks.every((pageBreak, index) => pageBreak === next.pageBreaks[index])
    );
}

function getPreviewScaleFromElement(resumeElement) {
    const shellElement = resumeElement.closest('.previewPageScaleShell');
    const shellStyles = shellElement ? window.getComputedStyle(shellElement) : null;
    const scale = parseCssPixelValue(shellStyles?.getPropertyValue('--preview-page-scale'), 1);

    return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

export function isMobilePreviewEditingViewport() {
    return typeof window !== 'undefined'
        && window.matchMedia('(max-width: 980px)').matches;
}

export function getMobileEditorProxyStyle(valueElement, resumeElement) {
    if (!valueElement || !resumeElement || typeof window === 'undefined') {
        return null;
    }

    const rect = valueElement.getBoundingClientRect();
    const computedStyle = window.getComputedStyle(valueElement);
    const previewScale = getPreviewScaleFromElement(resumeElement);
    const renderedFontSize = Math.max(1, parseCssPixelValue(computedStyle.fontSize, 16));
    const internalFontSize = Math.max(16, renderedFontSize);
    const proxyScale = Math.max(0.01, previewScale * (renderedFontSize / internalFontSize));
    const renderedLineHeight = parseCssPixelValue(computedStyle.lineHeight, renderedFontSize * 1.2);
    const internalLineHeight = renderedLineHeight * (internalFontSize / renderedFontSize);
    const renderedLetterSpacing = computedStyle.letterSpacing === 'normal'
        ? 0
        : parseCssPixelValue(computedStyle.letterSpacing, 0);

    return {
        top: `${rect.top}px`,
        left: `${rect.left}px`,
        width: `${Math.max(1, rect.width / proxyScale)}px`,
        height: `${Math.max(internalLineHeight, rect.height / proxyScale)}px`,
        fontFamily: computedStyle.fontFamily,
        fontSize: `${internalFontSize}px`,
        fontStyle: computedStyle.fontStyle,
        fontWeight: computedStyle.fontWeight,
        letterSpacing: `${renderedLetterSpacing * (internalFontSize / renderedFontSize)}px`,
        lineHeight: `${internalLineHeight}px`,
        textAlign: computedStyle.textAlign,
        textTransform: computedStyle.textTransform,
        transform: `scale(${proxyScale})`,
        transformOrigin: 'top left',
    };
}

export function mobileProxyStylesMatch(currentStyle, nextStyle) {
    if (!currentStyle || !nextStyle) {
        return currentStyle === nextStyle;
    }

    const keys = Object.keys(nextStyle);
    return keys.length === Object.keys(currentStyle).length
        && keys.every((key) => currentStyle[key] === nextStyle[key]);
}

function getCandidateBounds(element, resumeRect, previewScale, paddingTop) {
    const rect = element.getBoundingClientRect();
    const top = ((rect.top - resumeRect.top) / previewScale) - paddingTop;
    const bottom = ((rect.bottom - resumeRect.top) / previewScale) - paddingTop;

    return { top, bottom };
}

export function collectPreviewBreakCandidates(resumeElement, paddingTop) {
    const resumeRect = resumeElement.getBoundingClientRect();
    const previewScale = getPreviewScaleFromElement(resumeElement);
    const candidates = [];

    resumeElement.querySelectorAll('[data-page-break-kind="entry"]').forEach((entryElement) => {
        const sectionElement = entryElement.closest('[data-page-break-kind="section"]');
        const firstSectionEntry = sectionElement?.querySelector('[data-page-break-kind="entry"]');
        const isFirstSectionEntry = firstSectionEntry === entryElement;

        candidates.push({
            ...getCandidateBounds(entryElement, resumeRect, previewScale, paddingTop),
            priority: 2,
            snapDistance: isFirstSectionEntry ? FIRST_SECTION_ENTRY_SNAP_DISTANCE_PX : undefined,
        });
    });

    resumeElement.querySelectorAll('[data-page-break-kind="item"]').forEach((itemElement) => {
        candidates.push({
            ...getCandidateBounds(itemElement, resumeRect, previewScale, paddingTop),
            priority: 3,
        });
    });

    return candidates;
}

export function measurePreviewContentFlowHeight(resumeElement, paddingTop, fallbackHeight) {
    const contentElement = resumeElement.querySelector('[data-preview-page-content="true"]');

    if (!contentElement) {
        return fallbackHeight;
    }

    const resumeRect = resumeElement.getBoundingClientRect();
    const contentRect = contentElement.getBoundingClientRect();
    const previewScale = getPreviewScaleFromElement(resumeElement);
    const contentBottom = ((contentRect.bottom - resumeRect.top) / previewScale) - paddingTop;

    return Math.max(0, contentBottom);
}
