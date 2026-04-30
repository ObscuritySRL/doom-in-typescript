/**
 * Vanilla DOOM 1.9 aspect and integer-scale policy.
 *
 * The renderer owns a 320x200 indexed framebuffer. The display path may
 * either show it uncorrected at 8:5 or apply the VGA CRT correction that
 * stretches 200 scanlines to 240 visible rows, producing 4:3. Presentation
 * is restricted to positive integer multipliers; fractional, subpixel, and
 * HiDPI-derived scale factors are not part of the vanilla contract.
 */

/** Canonical width of the internal framebuffer in pixels. */
export const AUDITED_INTERNAL_FRAMEBUFFER_WIDTH = 320;

/** Canonical height of the internal framebuffer in pixels. */
export const AUDITED_INTERNAL_FRAMEBUFFER_HEIGHT = 200;

/** Canonical visible height after 4:3 aspect correction. */
export const AUDITED_ASPECT_CORRECTED_DISPLAY_HEIGHT = 240;

/** Numerator of the vertical aspect-correction stretch factor. */
export const AUDITED_ASPECT_STRETCH_NUMERATOR = 6;

/** Denominator of the vertical aspect-correction stretch factor. */
export const AUDITED_ASPECT_STRETCH_DENOMINATOR = 5;

/** Corrected display aspect ratio: 320:240. */
export const AUDITED_CORRECTED_DISPLAY_ASPECT_RATIO = 4 / 3;

/** Uncorrected display aspect ratio: 320:200. */
export const AUDITED_UNCORRECTED_DISPLAY_ASPECT_RATIO = 8 / 5;

/** Default Chocolate Doom config value for `aspect_ratio_correct`. */
export const AUDITED_CHOCOLATE_DEFAULT_ASPECT_RATIO_CORRECT = true;

/** Default Chocolate Doom config client height. */
export const AUDITED_CHOCOLATE_DEFAULT_CLIENT_HEIGHT = 480;

/** Default Chocolate Doom config client width. */
export const AUDITED_CHOCOLATE_DEFAULT_CLIENT_WIDTH = 640;

/** Default integer display scale derived from 640x480 with correction on. */
export const AUDITED_CHOCOLATE_DEFAULT_INTEGER_SCALE = 2;

/** Ordered positive integer scale multipliers in the vanilla/X11 scale family. */
export const VANILLA_INTEGER_SCALE_MULTIPLIERS = Object.freeze([1, 2, 3, 4] as const);

/** Whether vanilla accepts fractional display multipliers. */
export const VANILLA_SUPPORTS_FRACTIONAL_DISPLAY_SCALE = false;

/** Whether vanilla uses subpixel positioning while presenting the framebuffer. */
export const VANILLA_SUPPORTS_SUBPIXEL_PRESENTATION = false;

/** Whether vanilla derives an independent scale from host DPI. */
export const VANILLA_SUPPORTS_HIDPI_DISPLAY_SCALE = false;

export type VanillaIntegerScale = (typeof VANILLA_INTEGER_SCALE_MULTIPLIERS)[number];

export interface AspectIntegerScaleDimensions {
  readonly displayHeight: number;
  readonly displayWidth: number;
}

export interface AspectIntegerScalePresentation {
  readonly displayHeight: number;
  readonly displayWidth: number;
  readonly integerScale: VanillaIntegerScale | 0;
  readonly leftOffset: number;
  readonly topOffset: number;
}

export interface VanillaAspectIntegerScaleAuditEntry {
  readonly id:
    | 'ASPECT_CORRECTED_DISPLAY_HEIGHT_IS_240'
    | 'ASPECT_CORRECTION_STRETCH_IS_SIX_FIFTHS'
    | 'CENTERING_USES_INTEGER_PIXEL_OFFSETS'
    | 'CHOCOLATE_DEFAULT_CONFIG_IS_640_BY_480_CORRECTED_2X'
    | 'CORRECTED_DISPLAY_ASPECT_RATIO_IS_FOUR_THIRDS'
    | 'FRACTIONAL_DISPLAY_SCALE_IS_UNSUPPORTED'
    | 'INTERNAL_FRAMEBUFFER_HEIGHT_IS_200'
    | 'INTERNAL_FRAMEBUFFER_WIDTH_IS_320'
    | 'POSITIVE_INTEGER_MULTIPLIERS_ARE_ONE_THROUGH_FOUR'
    | 'SUBPIXEL_AND_HIDPI_PRESENTATION_ARE_UNSUPPORTED'
    | 'UNCORRECTED_DISPLAY_ASPECT_RATIO_IS_EIGHT_FIFTHS';
  readonly invariant: string;
  readonly referenceSourceFile: 'chocolate-doom.cfg' | 'default.cfg' | 'i_video.c' | 'm_menu.c';
}

export const VANILLA_ASPECT_INTEGER_SCALE_AUDIT: readonly VanillaAspectIntegerScaleAuditEntry[] = Object.freeze([
  {
    id: 'INTERNAL_FRAMEBUFFER_WIDTH_IS_320',
    invariant: 'The internal framebuffer width is exactly 320 columns before any host presentation scale is applied.',
    referenceSourceFile: 'i_video.c',
  },
  {
    id: 'INTERNAL_FRAMEBUFFER_HEIGHT_IS_200',
    invariant: 'The internal framebuffer height is exactly 200 rows before aspect correction stretches the visible display height.',
    referenceSourceFile: 'i_video.c',
  },
  {
    id: 'ASPECT_CORRECTED_DISPLAY_HEIGHT_IS_240',
    invariant: 'When aspect correction is active, 200 framebuffer rows present as 240 display rows.',
    referenceSourceFile: 'i_video.c',
  },
  {
    id: 'ASPECT_CORRECTION_STRETCH_IS_SIX_FIFTHS',
    invariant: 'The vertical aspect-correction stretch is exactly 6/5, converting 320x200 to a 320x240 display target.',
    referenceSourceFile: 'i_video.c',
  },
  {
    id: 'CORRECTED_DISPLAY_ASPECT_RATIO_IS_FOUR_THIRDS',
    invariant: 'The aspect-corrected display rectangle is 4:3, matching the VGA mode 13h CRT presentation target.',
    referenceSourceFile: 'i_video.c',
  },
  {
    id: 'UNCORRECTED_DISPLAY_ASPECT_RATIO_IS_EIGHT_FIFTHS',
    invariant: 'When aspect correction is disabled, the display rectangle remains 320x200 and therefore 8:5.',
    referenceSourceFile: 'i_video.c',
  },
  {
    id: 'POSITIVE_INTEGER_MULTIPLIERS_ARE_ONE_THROUGH_FOUR',
    invariant: 'The launch display scale family is restricted to positive integer multipliers 1, 2, 3, and 4.',
    referenceSourceFile: 'i_video.c',
  },
  {
    id: 'FRACTIONAL_DISPLAY_SCALE_IS_UNSUPPORTED',
    invariant: 'Fractional display multipliers such as 1.5x and 2.5x are rejected instead of rounded or silently accepted.',
    referenceSourceFile: 'i_video.c',
  },
  {
    id: 'CENTERING_USES_INTEGER_PIXEL_OFFSETS',
    invariant: 'When a client area is larger than the integer-scaled image, the image is centered with whole-pixel offsets.',
    referenceSourceFile: 'i_video.c',
  },
  {
    id: 'SUBPIXEL_AND_HIDPI_PRESENTATION_ARE_UNSUPPORTED',
    invariant: 'Subpixel presentation and independent HiDPI scale factors are outside the vanilla display contract.',
    referenceSourceFile: 'i_video.c',
  },
  {
    id: 'CHOCOLATE_DEFAULT_CONFIG_IS_640_BY_480_CORRECTED_2X',
    invariant: 'The local Chocolate config defaults to aspect_ratio_correct 1 with a 640x480 window, which is corrected 2x output.',
    referenceSourceFile: 'chocolate-doom.cfg',
  },
]);

export type VanillaAspectIntegerScaleQueryKind = 'actual-display-height' | 'chocolate-default-aspect-correct' | 'display-height' | 'display-width' | 'fit-integer-scale' | 'presentation-rectangle' | 'vanilla-supports-fractional-scale';

export interface VanillaAspectIntegerScaleResult {
  readonly answeredBoolean: boolean | null;
  readonly answeredNumber: number | null;
  readonly answeredPresentation: AspectIntegerScalePresentation | null;
}

export interface VanillaAspectIntegerScaleProbe {
  readonly aspectRatioCorrect: boolean | null;
  readonly clientHeight: number | null;
  readonly clientWidth: number | null;
  readonly expected: VanillaAspectIntegerScaleResult;
  readonly id: string;
  readonly queryKind: VanillaAspectIntegerScaleQueryKind;
  readonly scaleMultiplier: VanillaIntegerScale | null;
}

export interface VanillaAspectIntegerScaleHandler {
  readonly runProbe: (probe: VanillaAspectIntegerScaleProbe) => VanillaAspectIntegerScaleResult;
}

const NULL_RESULT: VanillaAspectIntegerScaleResult = Object.freeze({
  answeredBoolean: null,
  answeredNumber: null,
  answeredPresentation: null,
});

const DESCENDING_VANILLA_INTEGER_SCALE_MULTIPLIERS = Object.freeze([4, 3, 2, 1] as const);

/**
 * Return whether a value is one of the canonical vanilla integer scales.
 *
 * @param scaleMultiplier - Candidate display multiplier.
 * @returns True only for 1, 2, 3, or 4.
 * @example
 * ```ts
 * isVanillaIntegerScale(2); // true
 * isVanillaIntegerScale(2.5); // false
 * ```
 */
export function isVanillaIntegerScale(scaleMultiplier: number): scaleMultiplier is VanillaIntegerScale {
  return scaleMultiplier === 1 || scaleMultiplier === 2 || scaleMultiplier === 3 || scaleMultiplier === 4;
}

/**
 * Validate and return a canonical vanilla integer scale.
 *
 * @param scaleMultiplier - Candidate display multiplier.
 * @returns The narrowed vanilla integer scale.
 * @example
 * ```ts
 * requireVanillaIntegerScale(2); // 2
 * ```
 */
export function requireVanillaIntegerScale(scaleMultiplier: number): VanillaIntegerScale {
  if (isVanillaIntegerScale(scaleMultiplier)) {
    return scaleMultiplier;
  }

  throw new RangeError(`scale multiplier must be one of 1, 2, 3, or 4; got ${scaleMultiplier}.`);
}

/**
 * Compute the effective display height before integer scaling.
 *
 * @param aspectRatioCorrect - Whether 4:3 vertical correction is active.
 * @returns 240 when corrected, otherwise 200.
 * @example
 * ```ts
 * computeAspectCorrectedDisplayHeight(true); // 240
 * ```
 */
export function computeAspectCorrectedDisplayHeight(aspectRatioCorrect: boolean): number {
  return aspectRatioCorrect ? AUDITED_ASPECT_CORRECTED_DISPLAY_HEIGHT : AUDITED_INTERNAL_FRAMEBUFFER_HEIGHT;
}

/**
 * Compute exact integer-scaled display dimensions.
 *
 * @param scaleMultiplier - Vanilla integer scale multiplier.
 * @param aspectRatioCorrect - Whether 4:3 vertical correction is active.
 * @returns Width and height after integer scaling.
 * @example
 * ```ts
 * computeAspectIntegerScaleDimensions(2, true); // { displayHeight: 480, displayWidth: 640 }
 * ```
 */
export function computeAspectIntegerScaleDimensions(scaleMultiplier: number, aspectRatioCorrect: boolean): AspectIntegerScaleDimensions {
  const integerScale = requireVanillaIntegerScale(scaleMultiplier);
  const displayHeight = computeAspectCorrectedDisplayHeight(aspectRatioCorrect) * integerScale;
  const displayWidth = AUDITED_INTERNAL_FRAMEBUFFER_WIDTH * integerScale;

  return Object.freeze({
    displayHeight,
    displayWidth,
  });
}

/**
 * Compute the largest vanilla integer scale that fits in a client area.
 *
 * @param clientWidth - Client-area width in pixels.
 * @param clientHeight - Client-area height in pixels.
 * @param aspectRatioCorrect - Whether 4:3 vertical correction is active.
 * @returns The largest fitting integer scale, or null when no 1x image fits.
 * @example
 * ```ts
 * computeFitIntegerScale(1024, 768, true); // 3
 * ```
 */
export function computeFitIntegerScale(clientWidth: number, clientHeight: number, aspectRatioCorrect: boolean): VanillaIntegerScale | null {
  if (clientWidth <= 0 || clientHeight <= 0) {
    return null;
  }

  const actualDisplayHeight = computeAspectCorrectedDisplayHeight(aspectRatioCorrect);

  for (const scaleMultiplier of DESCENDING_VANILLA_INTEGER_SCALE_MULTIPLIERS) {
    if (AUDITED_INTERNAL_FRAMEBUFFER_WIDTH * scaleMultiplier <= clientWidth && actualDisplayHeight * scaleMultiplier <= clientHeight) {
      return scaleMultiplier;
    }
  }

  return null;
}

/**
 * Compute a centered, integer-scaled presentation rectangle.
 *
 * @param clientWidth - Client-area width in pixels.
 * @param clientHeight - Client-area height in pixels.
 * @param aspectRatioCorrect - Whether 4:3 vertical correction is active.
 * @returns Centered integer-scale presentation details.
 * @example
 * ```ts
 * computeCenteredAspectIntegerScalePresentation(1024, 768, true);
 * // { displayHeight: 720, displayWidth: 960, integerScale: 3, leftOffset: 32, topOffset: 24 }
 * ```
 */
export function computeCenteredAspectIntegerScalePresentation(clientWidth: number, clientHeight: number, aspectRatioCorrect: boolean): AspectIntegerScalePresentation {
  const integerScale = computeFitIntegerScale(clientWidth, clientHeight, aspectRatioCorrect);

  if (integerScale === null) {
    return Object.freeze({
      displayHeight: 0,
      displayWidth: 0,
      integerScale: 0,
      leftOffset: 0,
      topOffset: 0,
    });
  }

  const { displayHeight, displayWidth } = computeAspectIntegerScaleDimensions(integerScale, aspectRatioCorrect);
  const leftOffset = Math.floor((clientWidth - displayWidth) / 2);
  const topOffset = Math.floor((clientHeight - displayHeight) / 2);

  return Object.freeze({
    displayHeight,
    displayWidth,
    integerScale,
    leftOffset,
    topOffset,
  });
}

function referenceVanillaAspectIntegerScaleProbe(probe: VanillaAspectIntegerScaleProbe): VanillaAspectIntegerScaleResult {
  switch (probe.queryKind) {
    case 'actual-display-height': {
      return Object.freeze({
        ...NULL_RESULT,
        answeredNumber: computeAspectCorrectedDisplayHeight(probe.aspectRatioCorrect ?? AUDITED_CHOCOLATE_DEFAULT_ASPECT_RATIO_CORRECT),
      });
    }
    case 'chocolate-default-aspect-correct': {
      return Object.freeze({
        ...NULL_RESULT,
        answeredBoolean: AUDITED_CHOCOLATE_DEFAULT_ASPECT_RATIO_CORRECT,
      });
    }
    case 'display-height': {
      return Object.freeze({
        ...NULL_RESULT,
        answeredNumber: computeAspectIntegerScaleDimensions(probe.scaleMultiplier ?? AUDITED_CHOCOLATE_DEFAULT_INTEGER_SCALE, probe.aspectRatioCorrect ?? AUDITED_CHOCOLATE_DEFAULT_ASPECT_RATIO_CORRECT).displayHeight,
      });
    }
    case 'display-width': {
      return Object.freeze({
        ...NULL_RESULT,
        answeredNumber: computeAspectIntegerScaleDimensions(probe.scaleMultiplier ?? AUDITED_CHOCOLATE_DEFAULT_INTEGER_SCALE, probe.aspectRatioCorrect ?? AUDITED_CHOCOLATE_DEFAULT_ASPECT_RATIO_CORRECT).displayWidth,
      });
    }
    case 'fit-integer-scale': {
      return Object.freeze({
        ...NULL_RESULT,
        answeredNumber: computeFitIntegerScale(
          probe.clientWidth ?? AUDITED_CHOCOLATE_DEFAULT_CLIENT_WIDTH,
          probe.clientHeight ?? AUDITED_CHOCOLATE_DEFAULT_CLIENT_HEIGHT,
          probe.aspectRatioCorrect ?? AUDITED_CHOCOLATE_DEFAULT_ASPECT_RATIO_CORRECT,
        ),
      });
    }
    case 'presentation-rectangle': {
      return Object.freeze({
        ...NULL_RESULT,
        answeredPresentation: computeCenteredAspectIntegerScalePresentation(
          probe.clientWidth ?? AUDITED_CHOCOLATE_DEFAULT_CLIENT_WIDTH,
          probe.clientHeight ?? AUDITED_CHOCOLATE_DEFAULT_CLIENT_HEIGHT,
          probe.aspectRatioCorrect ?? AUDITED_CHOCOLATE_DEFAULT_ASPECT_RATIO_CORRECT,
        ),
      });
    }
    case 'vanilla-supports-fractional-scale': {
      return Object.freeze({
        ...NULL_RESULT,
        answeredBoolean: VANILLA_SUPPORTS_FRACTIONAL_DISPLAY_SCALE,
      });
    }
  }
}

export const VANILLA_ASPECT_INTEGER_SCALE_PROBES: readonly VanillaAspectIntegerScaleProbe[] = Object.freeze([
  {
    aspectRatioCorrect: true,
    clientHeight: null,
    clientWidth: null,
    expected: Object.freeze({
      ...NULL_RESULT,
      answeredNumber: AUDITED_ASPECT_CORRECTED_DISPLAY_HEIGHT,
    }),
    id: 'actual-height-corrected-is-240',
    queryKind: 'actual-display-height',
    scaleMultiplier: null,
  },
  {
    aspectRatioCorrect: false,
    clientHeight: null,
    clientWidth: null,
    expected: Object.freeze({
      ...NULL_RESULT,
      answeredNumber: AUDITED_INTERNAL_FRAMEBUFFER_HEIGHT,
    }),
    id: 'actual-height-uncorrected-is-200',
    queryKind: 'actual-display-height',
    scaleMultiplier: null,
  },
  {
    aspectRatioCorrect: true,
    clientHeight: null,
    clientWidth: null,
    expected: Object.freeze({
      ...NULL_RESULT,
      answeredNumber: AUDITED_CHOCOLATE_DEFAULT_CLIENT_WIDTH,
    }),
    id: 'default-corrected-two-scale-width-is-640',
    queryKind: 'display-width',
    scaleMultiplier: AUDITED_CHOCOLATE_DEFAULT_INTEGER_SCALE,
  },
  {
    aspectRatioCorrect: true,
    clientHeight: null,
    clientWidth: null,
    expected: Object.freeze({
      ...NULL_RESULT,
      answeredNumber: AUDITED_CHOCOLATE_DEFAULT_CLIENT_HEIGHT,
    }),
    id: 'default-corrected-two-scale-height-is-480',
    queryKind: 'display-height',
    scaleMultiplier: AUDITED_CHOCOLATE_DEFAULT_INTEGER_SCALE,
  },
  {
    aspectRatioCorrect: true,
    clientHeight: AUDITED_CHOCOLATE_DEFAULT_CLIENT_HEIGHT,
    clientWidth: AUDITED_CHOCOLATE_DEFAULT_CLIENT_WIDTH,
    expected: Object.freeze({
      ...NULL_RESULT,
      answeredNumber: AUDITED_CHOCOLATE_DEFAULT_INTEGER_SCALE,
    }),
    id: 'default-client-fits-two-scale',
    queryKind: 'fit-integer-scale',
    scaleMultiplier: null,
  },
  {
    aspectRatioCorrect: true,
    clientHeight: 768,
    clientWidth: 1024,
    expected: Object.freeze({
      ...NULL_RESULT,
      answeredPresentation: Object.freeze({
        displayHeight: 720,
        displayWidth: 960,
        integerScale: 3,
        leftOffset: 32,
        topOffset: 24,
      }),
    }),
    id: 'wide-client-centers-three-scale-with-integer-bars',
    queryKind: 'presentation-rectangle',
    scaleMultiplier: null,
  },
  {
    aspectRatioCorrect: true,
    clientHeight: 769,
    clientWidth: 1025,
    expected: Object.freeze({
      ...NULL_RESULT,
      answeredPresentation: Object.freeze({
        displayHeight: 720,
        displayWidth: 960,
        integerScale: 3,
        leftOffset: 32,
        topOffset: 24,
      }),
    }),
    id: 'odd-client-centers-three-scale-with-floor-integer-bars',
    queryKind: 'presentation-rectangle',
    scaleMultiplier: null,
  },
  {
    aspectRatioCorrect: true,
    clientHeight: 240,
    clientWidth: 319,
    expected: Object.freeze({
      ...NULL_RESULT,
      answeredPresentation: Object.freeze({
        displayHeight: 0,
        displayWidth: 0,
        integerScale: 0,
        leftOffset: 0,
        topOffset: 0,
      }),
    }),
    id: 'too-narrow-client-does-not-use-fractional-scale',
    queryKind: 'presentation-rectangle',
    scaleMultiplier: null,
  },
  {
    aspectRatioCorrect: true,
    clientHeight: 239,
    clientWidth: 320,
    expected: Object.freeze({
      ...NULL_RESULT,
      answeredPresentation: Object.freeze({
        displayHeight: 0,
        displayWidth: 0,
        integerScale: 0,
        leftOffset: 0,
        topOffset: 0,
      }),
    }),
    id: 'too-short-corrected-client-does-not-use-fractional-scale',
    queryKind: 'presentation-rectangle',
    scaleMultiplier: null,
  },
  {
    aspectRatioCorrect: false,
    clientHeight: 600,
    clientWidth: 960,
    expected: Object.freeze({
      ...NULL_RESULT,
      answeredPresentation: Object.freeze({
        displayHeight: 600,
        displayWidth: 960,
        integerScale: 3,
        leftOffset: 0,
        topOffset: 0,
      }),
    }),
    id: 'uncorrected-client-can-fit-three-scale',
    queryKind: 'presentation-rectangle',
    scaleMultiplier: null,
  },
  {
    aspectRatioCorrect: null,
    clientHeight: null,
    clientWidth: null,
    expected: Object.freeze({
      ...NULL_RESULT,
      answeredBoolean: false,
    }),
    id: 'vanilla-rejects-fractional-scales',
    queryKind: 'vanilla-supports-fractional-scale',
    scaleMultiplier: null,
  },
  {
    aspectRatioCorrect: null,
    clientHeight: null,
    clientWidth: null,
    expected: Object.freeze({
      ...NULL_RESULT,
      answeredBoolean: true,
    }),
    id: 'chocolate-default-config-enables-aspect-correction',
    queryKind: 'chocolate-default-aspect-correct',
    scaleMultiplier: null,
  },
]);

export const VANILLA_ASPECT_INTEGER_SCALE_PROBE_COUNT = 12;

export const REFERENCE_VANILLA_ASPECT_INTEGER_SCALE_HANDLER: VanillaAspectIntegerScaleHandler = Object.freeze({
  runProbe: referenceVanillaAspectIntegerScaleProbe,
});

/**
 * Cross-check a handler against the pinned aspect/integer-scale probes.
 *
 * @param handler - Probe handler under test.
 * @returns Stable failure identifiers; an empty list means every probe matched.
 * @example
 * ```ts
 * crossCheckVanillaAspectIntegerScale(REFERENCE_VANILLA_ASPECT_INTEGER_SCALE_HANDLER); // []
 * ```
 */
export function crossCheckVanillaAspectIntegerScale(handler: VanillaAspectIntegerScaleHandler): readonly string[] {
  const failures: string[] = [];

  for (const probe of VANILLA_ASPECT_INTEGER_SCALE_PROBES) {
    const result = handler.runProbe(probe);

    if (result.answeredBoolean !== probe.expected.answeredBoolean) {
      failures.push(`probe:${probe.id}:answeredBoolean:value-mismatch`);
    }
    if (result.answeredNumber !== probe.expected.answeredNumber) {
      failures.push(`probe:${probe.id}:answeredNumber:value-mismatch`);
    }
    if (!presentationEquals(result.answeredPresentation, probe.expected.answeredPresentation)) {
      failures.push(`probe:${probe.id}:answeredPresentation:value-mismatch`);
    }
  }

  return failures;
}

/**
 * Derive a canonical expected result for one probe.
 *
 * @param probe - Probe to answer with the reference policy.
 * @returns The canonical vanilla aspect/integer-scale result.
 * @example
 * ```ts
 * const [probe] = VANILLA_ASPECT_INTEGER_SCALE_PROBES;
 * deriveExpectedVanillaAspectIntegerScaleResult(probe);
 * ```
 */
export function deriveExpectedVanillaAspectIntegerScaleResult(probe: VanillaAspectIntegerScaleProbe): VanillaAspectIntegerScaleResult {
  return referenceVanillaAspectIntegerScaleProbe(probe);
}

function presentationEquals(leftPresentation: AspectIntegerScalePresentation | null, rightPresentation: AspectIntegerScalePresentation | null): boolean {
  if (leftPresentation === null || rightPresentation === null) {
    return leftPresentation === rightPresentation;
  }

  return (
    leftPresentation.displayHeight === rightPresentation.displayHeight &&
    leftPresentation.displayWidth === rightPresentation.displayWidth &&
    leftPresentation.integerScale === rightPresentation.integerScale &&
    leftPresentation.leftOffset === rightPresentation.leftOffset &&
    leftPresentation.topOffset === rightPresentation.topOffset
  );
}
