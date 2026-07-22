import test from 'node:test';
import assert from 'node:assert/strict';

import {
  isMobilePreviewEditingViewport,
  metricsAreEqual,
  mobileProxyStylesMatch,
  parseCssLengthToPixels,
  parseCssPixelValue,
} from '../src/components/resumePreviewGeometry.js';

test('preview geometry parses pixel and physical CSS lengths', () => {
  assert.equal(parseCssPixelValue('12.5px'), 12.5);
  assert.equal(parseCssPixelValue('auto', 7), 7);
  assert.equal(parseCssLengthToPixels('0.5in'), 48);
  assert.equal(parseCssLengthToPixels('24px'), 24);
  assert.equal(parseCssLengthToPixels('invalid', 9), 9);
});

test('preview metric equality includes scale and page-break positions', () => {
  const metrics = {
    pageWidth: 816,
    pageHeight: 1056,
    contentHeight: 900,
    pageCount: 2,
    layoutWidth: 816,
    scale: 0.75,
    pageBreaks: [800],
  };

  assert.equal(metricsAreEqual(metrics, { ...metrics, scale: 0.7505 }), true);
  assert.equal(metricsAreEqual(metrics, { ...metrics, scale: 0.752 }), false);
  assert.equal(metricsAreEqual(metrics, { ...metrics, pageBreaks: [799] }), false);
});

test('mobile proxy style comparisons avoid redundant session updates', () => {
  const style = { top: '12px', left: '20px', width: '100px' };

  assert.equal(mobileProxyStylesMatch(style, { ...style }), true);
  assert.equal(mobileProxyStylesMatch(style, { ...style, width: '101px' }), false);
  assert.equal(mobileProxyStylesMatch(null, null), true);
  assert.equal(isMobilePreviewEditingViewport(), false);
});
