import { describe, expect, test } from 'bun:test';

import { ASPECT_CORRECTED_HEIGHT, ASPECT_STRETCH_RATIO, DISPLAY_ASPECT_RATIO, SCREENHEIGHT, SCREENWIDTH, computeActualHeight, computeClientDimensions, computePresentationRect, computeScaleMultiplier } from '../../src/host/windowPolicy.ts';
import type { PresentationRect } from '../../src/host/windowPolicy.ts';

describe('base resolution constants', () => {
  test('SCREENWIDTH is 320', () => {
    expect(SCREENWIDTH).toBe(320);
  });

  test('SCREENHEIGHT is 200', () => {
    expect(SCREENHEIGHT).toBe(200);
  });

  test('framebuffer size is 64000 bytes (F-036 cross-reference)', () => {
    expect(SCREENWIDTH * SCREENHEIGHT).toBe(64_000);
  });

  test('MAXOPENINGS derivation (F-024 cross-reference)', () => {
    expect(SCREENWIDTH * 64).toBe(20_480);
  });
});

describe('aspect ratio constants', () => {
  test('ASPECT_CORRECTED_HEIGHT is 240', () => {
    expect(ASPECT_CORRECTED_HEIGHT).toBe(240);
  });

  test('corrected height is SCREENHEIGHT * 6 / 5', () => {
    expect(ASPECT_CORRECTED_HEIGHT).toBe((SCREENHEIGHT * 6) / 5);
  });

  test('DISPLAY_ASPECT_RATIO is 4/3', () => {
    expect(DISPLAY_ASPECT_RATIO).toBe(4 / 3);
  });

  test('corrected dimensions produce 4:3 ratio', () => {
    expect(SCREENWIDTH / ASPECT_CORRECTED_HEIGHT).toBe(4 / 3);
  });

  test('ASPECT_STRETCH_RATIO is 6/5 = 1.2', () => {
    expect(ASPECT_STRETCH_RATIO).toBe(1.2);
    expect(ASPECT_STRETCH_RATIO).toBe(6 / 5);
  });

  test('stretch ratio links corrected and base heights', () => {
    expect(SCREENHEIGHT * ASPECT_STRETCH_RATIO).toBe(ASPECT_CORRECTED_HEIGHT);
  });

  test('uncorrected aspect ratio is 8:5', () => {
    expect(SCREENWIDTH / SCREENHEIGHT).toBe(8 / 5);
  });
});

describe('computeActualHeight', () => {
  test('returns 240 when aspect correction is enabled', () => {
    expect(computeActualHeight(true)).toBe(240);
  });

  test('returns 200 when aspect correction is disabled', () => {
    expect(computeActualHeight(false)).toBe(200);
  });

  test('corrected height matches ASPECT_CORRECTED_HEIGHT', () => {
    expect(computeActualHeight(true)).toBe(ASPECT_CORRECTED_HEIGHT);
  });

  test('uncorrected height matches SCREENHEIGHT', () => {
    expect(computeActualHeight(false)).toBe(SCREENHEIGHT);
  });
});

describe('computeScaleMultiplier', () => {
  test('reference 640x480 with aspect correction → 2x (F-033)', () => {
    expect(computeScaleMultiplier(640, 480, true)).toBe(2);
  });

  test('1x scale at exact base dimensions with correction', () => {
    expect(computeScaleMultiplier(320, 240, true)).toBe(1);
  });

  test('1x scale at exact base dimensions without correction', () => {
    expect(computeScaleMultiplier(320, 200, false)).toBe(1);
  });

  test('3x scale at 960x720 with correction', () => {
    expect(computeScaleMultiplier(960, 720, true)).toBe(3);
  });

  test('height-limited: wide client reduces scale', () => {
    // 800/320=2.5→2, 480/240=2→2, min(2,2)=2
    expect(computeScaleMultiplier(800, 480, true)).toBe(2);
  });

  test('width-limited: tall client reduces scale', () => {
    // 640/320=2→2, 960/240=4→4, min(2,4)=2
    expect(computeScaleMultiplier(640, 960, true)).toBe(2);
  });

  test('minimum scale is 1 even for undersized client', () => {
    expect(computeScaleMultiplier(100, 100, true)).toBe(1);
  });

  test('minimum scale is 1 for zero dimensions', () => {
    expect(computeScaleMultiplier(0, 0, true)).toBe(1);
  });

  test('without correction: 640x400 = 2x', () => {
    expect(computeScaleMultiplier(640, 400, false)).toBe(2);
  });

  test('without correction: 640x480 = 2x (height has surplus)', () => {
    // 640/320=2, 480/200=2.4→2, min(2,2)=2
    expect(computeScaleMultiplier(640, 480, false)).toBe(2);
  });
});

describe('computeClientDimensions', () => {
  test('1x with aspect correction → 320x240', () => {
    const dims = computeClientDimensions(1, true);
    expect(dims.width).toBe(320);
    expect(dims.height).toBe(240);
  });

  test('2x with aspect correction → 640x480 (F-033 reference)', () => {
    const dims = computeClientDimensions(2, true);
    expect(dims.width).toBe(640);
    expect(dims.height).toBe(480);
  });

  test('3x with aspect correction → 960x720', () => {
    const dims = computeClientDimensions(3, true);
    expect(dims.width).toBe(960);
    expect(dims.height).toBe(720);
  });

  test('1x without aspect correction → 320x200', () => {
    const dims = computeClientDimensions(1, false);
    expect(dims.width).toBe(320);
    expect(dims.height).toBe(200);
  });

  test('2x without aspect correction → 640x400', () => {
    const dims = computeClientDimensions(2, false);
    expect(dims.width).toBe(640);
    expect(dims.height).toBe(400);
  });

  test('result is frozen', () => {
    const dims = computeClientDimensions(2, true);
    expect(Object.isFrozen(dims)).toBe(true);
  });

  test('width is always SCREENWIDTH * multiplier', () => {
    for (let scale = 1; scale <= 5; scale++) {
      expect(computeClientDimensions(scale, true).width).toBe(SCREENWIDTH * scale);
      expect(computeClientDimensions(scale, false).width).toBe(SCREENWIDTH * scale);
    }
  });

  test('corrected height is always ASPECT_CORRECTED_HEIGHT * multiplier', () => {
    for (let scale = 1; scale <= 5; scale++) {
      expect(computeClientDimensions(scale, true).height).toBe(ASPECT_CORRECTED_HEIGHT * scale);
    }
  });
});

describe('computePresentationRect — exact fit', () => {
  test('640x480 with correction fills entire client (F-033)', () => {
    const rect = computePresentationRect(640, 480, true);
    expect(rect.x).toBe(0);
    expect(rect.y).toBe(0);
    expect(rect.width).toBe(640);
    expect(rect.height).toBe(480);
  });

  test('320x240 with correction fills entire client', () => {
    const rect = computePresentationRect(320, 240, true);
    expect(rect.x).toBe(0);
    expect(rect.y).toBe(0);
    expect(rect.width).toBe(320);
    expect(rect.height).toBe(240);
  });

  test('320x200 without correction fills entire client', () => {
    const rect = computePresentationRect(320, 200, false);
    expect(rect.x).toBe(0);
    expect(rect.y).toBe(0);
    expect(rect.width).toBe(320);
    expect(rect.height).toBe(200);
  });

  test('640x400 without correction fills entire client', () => {
    const rect = computePresentationRect(640, 400, false);
    expect(rect.x).toBe(0);
    expect(rect.y).toBe(0);
    expect(rect.width).toBe(640);
    expect(rect.height).toBe(400);
  });
});

describe('computePresentationRect — pillarbox', () => {
  test('wider-than-4:3 client with correction produces pillarbox', () => {
    // 800x480: source aspect = 4/3 ≈ 1.333, client aspect = 800/480 ≈ 1.667
    const rect = computePresentationRect(800, 480, true);
    expect(rect.width).toBe(640); // 480 * 4/3 = 640
    expect(rect.height).toBe(480);
    expect(rect.x).toBe(80); // (800 - 640) / 2 = 80
    expect(rect.y).toBe(0);
  });

  test('1920x1080 with correction produces pillarbox', () => {
    // 16:9 display, 4:3 content
    const rect = computePresentationRect(1920, 1080, true);
    expect(rect.width).toBe(1440); // 1080 * 4/3 = 1440
    expect(rect.height).toBe(1080);
    expect(rect.x).toBe(240); // (1920 - 1440) / 2 = 240
    expect(rect.y).toBe(0);
  });

  test('pillarbox image is horizontally centered', () => {
    const rect = computePresentationRect(1000, 480, true);
    // With rounding, x + width + x should approximately equal clientWidth
    expect(rect.x + rect.width + rect.x).toBeCloseTo(1000, 0);
  });
});

describe('computePresentationRect — letterbox', () => {
  test('taller-than-4:3 client with correction produces letterbox', () => {
    // 640x600: source aspect = 4/3 ≈ 1.333, client aspect = 640/600 ≈ 1.067
    const rect = computePresentationRect(640, 600, true);
    expect(rect.width).toBe(640);
    expect(rect.height).toBe(480); // 640 / (4/3) = 480
    expect(rect.x).toBe(0);
    expect(rect.y).toBe(60); // (600 - 480) / 2 = 60
  });

  test('4:3 content in square window with correction', () => {
    // 480x480: client is square (1:1), content is 4:3
    const rect = computePresentationRect(480, 480, true);
    expect(rect.width).toBe(480);
    expect(rect.height).toBe(360); // 480 / (4/3) = 360
    expect(rect.x).toBe(0);
    expect(rect.y).toBe(60); // (480 - 360) / 2 = 60
  });

  test('letterbox image is vertically centered', () => {
    const rect = computePresentationRect(640, 800, true);
    expect(rect.y + rect.height + rect.y).toBeCloseTo(800, 0);
  });
});

describe('computePresentationRect — without correction', () => {
  test('8:5 source in 16:9 window produces pillarbox', () => {
    // source aspect = 320/200 = 8/5 = 1.6, client aspect = 16/9 ≈ 1.778
    const rect = computePresentationRect(1920, 1080, false);
    expect(rect.width).toBe(1728); // 1080 * 8/5 = 1728
    expect(rect.height).toBe(1080);
    expect(rect.x).toBe(96); // (1920 - 1728) / 2 = 96
    expect(rect.y).toBe(0);
  });

  test('8:5 source in 4:3 window produces letterbox', () => {
    // source aspect = 8/5 = 1.6, client aspect = 4/3 ≈ 1.333
    const rect = computePresentationRect(640, 480, false);
    expect(rect.width).toBe(640);
    expect(rect.height).toBe(400); // 640 / (8/5) = 400
    expect(rect.x).toBe(0);
    expect(rect.y).toBe(40); // (480 - 400) / 2 = 40
  });
});

describe('computePresentationRect — edge cases', () => {
  test('zero width returns zero rect', () => {
    const rect = computePresentationRect(0, 480, true);
    expect(rect.x).toBe(0);
    expect(rect.y).toBe(0);
    expect(rect.width).toBe(0);
    expect(rect.height).toBe(0);
  });

  test('zero height returns zero rect', () => {
    const rect = computePresentationRect(640, 0, true);
    expect(rect.x).toBe(0);
    expect(rect.y).toBe(0);
    expect(rect.width).toBe(0);
    expect(rect.height).toBe(0);
  });

  test('negative dimensions return zero rect', () => {
    const rect = computePresentationRect(-1, -1, true);
    expect(rect.x).toBe(0);
    expect(rect.y).toBe(0);
    expect(rect.width).toBe(0);
    expect(rect.height).toBe(0);
  });

  test('very small client still produces valid rect', () => {
    const rect = computePresentationRect(1, 1, true);
    expect(rect.width).toBeGreaterThanOrEqual(0);
    expect(rect.height).toBeGreaterThanOrEqual(0);
  });

  test('result is frozen', () => {
    const rect = computePresentationRect(640, 480, true);
    expect(Object.isFrozen(rect)).toBe(true);
  });

  test('zero-dimension result is frozen', () => {
    const rect = computePresentationRect(0, 0, true);
    expect(Object.isFrozen(rect)).toBe(true);
  });
});

describe('reference config cross-reference (F-033)', () => {
  test('reference display 640x480 is 2x scale of 320x240', () => {
    const dims = computeClientDimensions(2, true);
    expect(dims.width).toBe(640);
    expect(dims.height).toBe(480);
  });

  test('reference scale multiplier is 2', () => {
    expect(computeScaleMultiplier(640, 480, true)).toBe(2);
  });

  test('reference display fills client exactly', () => {
    const rect = computePresentationRect(640, 480, true);
    expect(rect.x).toBe(0);
    expect(rect.y).toBe(0);
    expect(rect.width).toBe(640);
    expect(rect.height).toBe(480);
  });

  test('scale roundtrip: computeClientDimensions → computeScaleMultiplier', () => {
    for (let scale = 1; scale <= 5; scale++) {
      const dims = computeClientDimensions(scale, true);
      expect(computeScaleMultiplier(dims.width, dims.height, true)).toBe(scale);
    }
  });

  test('scale roundtrip without correction', () => {
    for (let scale = 1; scale <= 5; scale++) {
      const dims = computeClientDimensions(scale, false);
      expect(computeScaleMultiplier(dims.width, dims.height, false)).toBe(scale);
    }
  });
});

describe('parity-sensitive edge cases', () => {
  test('aspect-corrected rect maintains 4:3 within rounding tolerance', () => {
    const rect = computePresentationRect(1920, 1080, true);
    const rectAspect = rect.width / rect.height;
    expect(Math.abs(rectAspect - 4 / 3)).toBeLessThan(0.01);
  });

  test('uncorrected rect maintains 8:5 within rounding tolerance', () => {
    const rect = computePresentationRect(1920, 1080, false);
    const rectAspect = rect.width / rect.height;
    expect(Math.abs(rectAspect - 8 / 5)).toBeLessThan(0.01);
  });

  test('presentation rect never exceeds client area', () => {
    const testCases = [
      [640, 480],
      [800, 600],
      [1024, 768],
      [1920, 1080],
      [2560, 1440],
      [100, 500],
      [500, 100],
    ] as const;
    for (const [width, height] of testCases) {
      for (const aspect of [true, false]) {
        const rect = computePresentationRect(width, height, aspect);
        expect(rect.x).toBeGreaterThanOrEqual(0);
        expect(rect.y).toBeGreaterThanOrEqual(0);
        expect(rect.x + rect.width).toBeLessThanOrEqual(width + 1);
        expect(rect.y + rect.height).toBeLessThanOrEqual(height + 1);
      }
    }
  });

  test('PresentationRect type is structurally satisfied', () => {
    const rect: PresentationRect = computePresentationRect(640, 480, true);
    expect(typeof rect.x).toBe('number');
    expect(typeof rect.y).toBe('number');
    expect(typeof rect.width).toBe('number');
    expect(typeof rect.height).toBe('number');
  });

  test('corrected and uncorrected differ in height for same client', () => {
    const corrected = computePresentationRect(1920, 1080, true);
    const uncorrected = computePresentationRect(1920, 1080, false);
    // Both use full height for 16:9 widescreen, but widths differ
    expect(corrected.width).not.toBe(uncorrected.width);
  });

  test('scale multiplier consistency: larger client → equal or larger scale', () => {
    const scale1 = computeScaleMultiplier(640, 480, true);
    const scale2 = computeScaleMultiplier(1280, 960, true);
    expect(scale2).toBeGreaterThanOrEqual(scale1);
  });

  test('integer scale dimensions always produce exact-fit rect', () => {
    for (let scale = 1; scale <= 5; scale++) {
      const dims = computeClientDimensions(scale, true);
      const rect = computePresentationRect(dims.width, dims.height, true);
      expect(rect.x).toBe(0);
      expect(rect.y).toBe(0);
      expect(rect.width).toBe(dims.width);
      expect(rect.height).toBe(dims.height);
    }
  });
});
