import { describe, expect, test } from 'bun:test';

import { ASPECT_CORRECTED_HEIGHT, ASPECT_STRETCH_RATIO, DISPLAY_ASPECT_RATIO, SCREENHEIGHT, SCREENWIDTH, computeClientDimensions } from '../../../src/host/windowPolicy.ts';
import {
  AUDITED_ASPECT_CORRECTED_DISPLAY_HEIGHT,
  AUDITED_ASPECT_STRETCH_DENOMINATOR,
  AUDITED_ASPECT_STRETCH_NUMERATOR,
  AUDITED_CHOCOLATE_DEFAULT_ASPECT_RATIO_CORRECT,
  AUDITED_CHOCOLATE_DEFAULT_CLIENT_HEIGHT,
  AUDITED_CHOCOLATE_DEFAULT_CLIENT_WIDTH,
  AUDITED_CHOCOLATE_DEFAULT_INTEGER_SCALE,
  AUDITED_CORRECTED_DISPLAY_ASPECT_RATIO,
  AUDITED_INTERNAL_FRAMEBUFFER_HEIGHT,
  AUDITED_INTERNAL_FRAMEBUFFER_WIDTH,
  AUDITED_UNCORRECTED_DISPLAY_ASPECT_RATIO,
  REFERENCE_VANILLA_ASPECT_INTEGER_SCALE_HANDLER,
  VANILLA_ASPECT_INTEGER_SCALE_AUDIT,
  VANILLA_ASPECT_INTEGER_SCALE_PROBE_COUNT,
  VANILLA_ASPECT_INTEGER_SCALE_PROBES,
  VANILLA_INTEGER_SCALE_MULTIPLIERS,
  VANILLA_SUPPORTS_FRACTIONAL_DISPLAY_SCALE,
  VANILLA_SUPPORTS_HIDPI_DISPLAY_SCALE,
  VANILLA_SUPPORTS_SUBPIXEL_PRESENTATION,
  computeAspectCorrectedDisplayHeight,
  computeAspectIntegerScaleDimensions,
  computeCenteredAspectIntegerScalePresentation,
  computeFitIntegerScale,
  crossCheckVanillaAspectIntegerScale,
  deriveExpectedVanillaAspectIntegerScaleResult,
  isVanillaIntegerScale,
  requireVanillaIntegerScale,
} from '../../../src/bootstrap/implement-aspect-and-integer-scale-policy.ts';
import type { VanillaAspectIntegerScaleHandler, VanillaAspectIntegerScaleProbe, VanillaAspectIntegerScaleResult } from '../../../src/bootstrap/implement-aspect-and-integer-scale-policy.ts';

describe('vanilla parity launch: aspect and integer scale policy', () => {
  test('pins the canonical aspect and scale constants', () => {
    expect(AUDITED_INTERNAL_FRAMEBUFFER_WIDTH).toBe(320);
    expect(AUDITED_INTERNAL_FRAMEBUFFER_HEIGHT).toBe(200);
    expect(AUDITED_ASPECT_CORRECTED_DISPLAY_HEIGHT).toBe(240);
    expect(AUDITED_ASPECT_STRETCH_NUMERATOR / AUDITED_ASPECT_STRETCH_DENOMINATOR).toBe(6 / 5);
    expect(AUDITED_CORRECTED_DISPLAY_ASPECT_RATIO).toBe(4 / 3);
    expect(AUDITED_UNCORRECTED_DISPLAY_ASPECT_RATIO).toBe(8 / 5);
    expect(AUDITED_CHOCOLATE_DEFAULT_ASPECT_RATIO_CORRECT).toBe(true);
    expect(AUDITED_CHOCOLATE_DEFAULT_CLIENT_HEIGHT).toBe(480);
    expect(AUDITED_CHOCOLATE_DEFAULT_CLIENT_WIDTH).toBe(640);
    expect(AUDITED_CHOCOLATE_DEFAULT_INTEGER_SCALE).toBe(2);
    expect(VANILLA_INTEGER_SCALE_MULTIPLIERS).toEqual([1, 2, 3, 4]);
    expect(VANILLA_SUPPORTS_FRACTIONAL_DISPLAY_SCALE).toBe(false);
    expect(VANILLA_SUPPORTS_HIDPI_DISPLAY_SCALE).toBe(false);
    expect(VANILLA_SUPPORTS_SUBPIXEL_PRESENTATION).toBe(false);
  });

  test('agrees with the existing host framebuffer constants', () => {
    expect(SCREENWIDTH).toBe(AUDITED_INTERNAL_FRAMEBUFFER_WIDTH);
    expect(SCREENHEIGHT).toBe(AUDITED_INTERNAL_FRAMEBUFFER_HEIGHT);
    expect(ASPECT_CORRECTED_HEIGHT).toBe(AUDITED_ASPECT_CORRECTED_DISPLAY_HEIGHT);
    expect(ASPECT_STRETCH_RATIO).toBe(AUDITED_ASPECT_STRETCH_NUMERATOR / AUDITED_ASPECT_STRETCH_DENOMINATOR);
    expect(DISPLAY_ASPECT_RATIO).toBe(AUDITED_CORRECTED_DISPLAY_ASPECT_RATIO);
    expect(computeClientDimensions(AUDITED_CHOCOLATE_DEFAULT_INTEGER_SCALE, true)).toEqual({
      height: AUDITED_CHOCOLATE_DEFAULT_CLIENT_HEIGHT,
      width: AUDITED_CHOCOLATE_DEFAULT_CLIENT_WIDTH,
    });
  });

  test('locks the local config evidence for the corrected 640x480 default', async () => {
    const chocolateDoomConfigText = await Bun.file('doom/chocolate-doom.cfg').text();
    const defaultConfigText = await Bun.file('doom/default.cfg').text();

    expect(chocolateDoomConfigText).toMatch(/^aspect_ratio_correct\s+1$/m);
    expect(chocolateDoomConfigText).toMatch(/^screen_height\s+480$/m);
    expect(chocolateDoomConfigText).toMatch(/^screen_width\s+640$/m);
    expect(defaultConfigText).toMatch(/^screenblocks\s+9$/m);
    expect(defaultConfigText).not.toMatch(/^aspect_ratio_correct\b/m);
  });

  test('declares a unique audit ledger for the policy surface', () => {
    const auditIds = VANILLA_ASPECT_INTEGER_SCALE_AUDIT.map((entry) => entry.id);

    expect(VANILLA_ASPECT_INTEGER_SCALE_AUDIT).toHaveLength(11);
    expect(new Set(auditIds).size).toBe(VANILLA_ASPECT_INTEGER_SCALE_AUDIT.length);
    expect(auditIds).toEqual([
      'INTERNAL_FRAMEBUFFER_WIDTH_IS_320',
      'INTERNAL_FRAMEBUFFER_HEIGHT_IS_200',
      'ASPECT_CORRECTED_DISPLAY_HEIGHT_IS_240',
      'ASPECT_CORRECTION_STRETCH_IS_SIX_FIFTHS',
      'CORRECTED_DISPLAY_ASPECT_RATIO_IS_FOUR_THIRDS',
      'UNCORRECTED_DISPLAY_ASPECT_RATIO_IS_EIGHT_FIFTHS',
      'POSITIVE_INTEGER_MULTIPLIERS_ARE_ONE_THROUGH_FOUR',
      'FRACTIONAL_DISPLAY_SCALE_IS_UNSUPPORTED',
      'CENTERING_USES_INTEGER_PIXEL_OFFSETS',
      'SUBPIXEL_AND_HIDPI_PRESENTATION_ARE_UNSUPPORTED',
      'CHOCOLATE_DEFAULT_CONFIG_IS_640_BY_480_CORRECTED_2X',
    ]);

    for (const entry of VANILLA_ASPECT_INTEGER_SCALE_AUDIT) {
      expect(['chocolate-doom.cfg', 'default.cfg', 'i_video.c', 'm_menu.c']).toContain(entry.referenceSourceFile);
      expect(entry.invariant.length).toBeGreaterThan(40);
    }
  });

  test('computes corrected and uncorrected display heights', () => {
    expect(computeAspectCorrectedDisplayHeight(true)).toBe(240);
    expect(computeAspectCorrectedDisplayHeight(false)).toBe(200);
  });

  test('accepts only vanilla integer scale multipliers', () => {
    expect(isVanillaIntegerScale(1)).toBe(true);
    expect(isVanillaIntegerScale(2)).toBe(true);
    expect(isVanillaIntegerScale(3)).toBe(true);
    expect(isVanillaIntegerScale(4)).toBe(true);
    expect(isVanillaIntegerScale(0)).toBe(false);
    expect(isVanillaIntegerScale(1.5)).toBe(false);
    expect(isVanillaIntegerScale(5)).toBe(false);

    expect(requireVanillaIntegerScale(3)).toBe(3);
    expect(() => requireVanillaIntegerScale(2.5)).toThrow(RangeError);
    expect(() => requireVanillaIntegerScale(0)).toThrow('scale multiplier must be one of 1, 2, 3, or 4');
  });

  test('computes exact scaled display dimensions', () => {
    expect(computeAspectIntegerScaleDimensions(1, true)).toEqual({
      displayHeight: 240,
      displayWidth: 320,
    });
    expect(computeAspectIntegerScaleDimensions(2, true)).toEqual({
      displayHeight: 480,
      displayWidth: 640,
    });
    expect(computeAspectIntegerScaleDimensions(3, false)).toEqual({
      displayHeight: 600,
      displayWidth: 960,
    });
    expect(() => computeAspectIntegerScaleDimensions(1.5, true)).toThrow(RangeError);
  });

  test('chooses the largest integer scale that fits', () => {
    expect(computeFitIntegerScale(640, 480, true)).toBe(2);
    expect(computeFitIntegerScale(1024, 768, true)).toBe(3);
    expect(computeFitIntegerScale(3840, 2160, true)).toBe(4);
    expect(computeFitIntegerScale(960, 600, true)).toBe(2);
    expect(computeFitIntegerScale(960, 600, false)).toBe(3);
    expect(computeFitIntegerScale(319, 240, true)).toBeNull();
    expect(computeFitIntegerScale(640, 0, true)).toBeNull();
  });

  test('centers integer-scaled presentation without fractional stretch', () => {
    expect(computeCenteredAspectIntegerScalePresentation(640, 480, true)).toEqual({
      displayHeight: 480,
      displayWidth: 640,
      integerScale: 2,
      leftOffset: 0,
      topOffset: 0,
    });
    expect(computeCenteredAspectIntegerScalePresentation(1024, 768, true)).toEqual({
      displayHeight: 720,
      displayWidth: 960,
      integerScale: 3,
      leftOffset: 32,
      topOffset: 24,
    });
    expect(computeCenteredAspectIntegerScalePresentation(1025, 769, true)).toEqual({
      displayHeight: 720,
      displayWidth: 960,
      integerScale: 3,
      leftOffset: 32,
      topOffset: 24,
    });
    expect(computeCenteredAspectIntegerScalePresentation(800, 480, true)).toEqual({
      displayHeight: 480,
      displayWidth: 640,
      integerScale: 2,
      leftOffset: 80,
      topOffset: 0,
    });
    expect(computeCenteredAspectIntegerScalePresentation(640, 500, true)).toEqual({
      displayHeight: 480,
      displayWidth: 640,
      integerScale: 2,
      leftOffset: 0,
      topOffset: 10,
    });
    expect(computeCenteredAspectIntegerScalePresentation(319, 240, true)).toEqual({
      displayHeight: 0,
      displayWidth: 0,
      integerScale: 0,
      leftOffset: 0,
      topOffset: 0,
    });
  });

  test('runs the reference handler through every pinned probe', () => {
    expect(VANILLA_ASPECT_INTEGER_SCALE_PROBES).toHaveLength(VANILLA_ASPECT_INTEGER_SCALE_PROBE_COUNT);
    expect(crossCheckVanillaAspectIntegerScale(REFERENCE_VANILLA_ASPECT_INTEGER_SCALE_HANDLER)).toEqual([]);

    for (const probe of VANILLA_ASPECT_INTEGER_SCALE_PROBES) {
      expect(deriveExpectedVanillaAspectIntegerScaleResult(probe)).toEqual(probe.expected);
    }
  });

  test('detects a handler that accepts fractional scale', () => {
    const fractionalScaleHandler: VanillaAspectIntegerScaleHandler = {
      runProbe: (probe: VanillaAspectIntegerScaleProbe): VanillaAspectIntegerScaleResult => {
        if (probe.queryKind === 'vanilla-supports-fractional-scale') {
          return {
            answeredBoolean: true,
            answeredNumber: null,
            answeredPresentation: null,
          };
        }

        return deriveExpectedVanillaAspectIntegerScaleResult(probe);
      },
    };

    expect(crossCheckVanillaAspectIntegerScale(fractionalScaleHandler)).toContain('probe:vanilla-rejects-fractional-scales:answeredBoolean:value-mismatch');
  });

  test('detects a handler that fills a non-integer presentation rectangle', () => {
    const fractionalPresentationHandler: VanillaAspectIntegerScaleHandler = {
      runProbe: (probe: VanillaAspectIntegerScaleProbe): VanillaAspectIntegerScaleResult => {
        if (probe.id === 'wide-client-centers-three-scale-with-integer-bars') {
          return {
            answeredBoolean: null,
            answeredNumber: null,
            answeredPresentation: {
              displayHeight: 768,
              displayWidth: 1024,
              integerScale: 3,
              leftOffset: 0,
              topOffset: 0,
            },
          };
        }

        return deriveExpectedVanillaAspectIntegerScaleResult(probe);
      },
    };

    expect(crossCheckVanillaAspectIntegerScale(fractionalPresentationHandler)).toContain('probe:wide-client-centers-three-scale-with-integer-bars:answeredPresentation:value-mismatch');
  });

  test('detects a handler that centers with subpixel offsets', () => {
    const subpixelOffsetHandler: VanillaAspectIntegerScaleHandler = {
      runProbe: (probe: VanillaAspectIntegerScaleProbe): VanillaAspectIntegerScaleResult => {
        if (probe.id === 'odd-client-centers-three-scale-with-floor-integer-bars') {
          return {
            answeredBoolean: null,
            answeredNumber: null,
            answeredPresentation: {
              displayHeight: 720,
              displayWidth: 960,
              integerScale: 3,
              leftOffset: 32.5,
              topOffset: 24.5,
            },
          };
        }

        return deriveExpectedVanillaAspectIntegerScaleResult(probe);
      },
    };

    expect(crossCheckVanillaAspectIntegerScale(subpixelOffsetHandler)).toContain('probe:odd-client-centers-three-scale-with-floor-integer-bars:answeredPresentation:value-mismatch');
  });
});
