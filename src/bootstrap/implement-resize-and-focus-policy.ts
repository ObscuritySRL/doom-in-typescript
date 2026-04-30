import { AUDITED_CHOCOLATE_DEFAULT_ASPECT_RATIO_CORRECT, AUDITED_CHOCOLATE_DEFAULT_CLIENT_HEIGHT, AUDITED_CHOCOLATE_DEFAULT_CLIENT_WIDTH, computeCenteredAspectIntegerScalePresentation } from './implement-aspect-and-integer-scale-policy.ts';
import type { AspectIntegerScalePresentation } from './implement-aspect-and-integer-scale-policy.ts';

/**
 * Resize and focus policy for the launch host.
 *
 * Resizes do not create a new game framebuffer or mutate the host window
 * lifecycle. They only recompute the centered integer-scale presentation
 * rectangle already pinned by step 03-016. Focus changes drive the existing
 * grab/input suppression equation: focused, visible, and grab-enabled windows
 * may grab the mouse; unfocused windows release it and suppress gameplay input.
 */

/** Local Chocolate Doom config default for `grabmouse`. */
export const AUDITED_CHOCOLATE_DEFAULT_GRABMOUSE_ENABLED = true;

/** Whether resize may mutate host window decorations at runtime. */
export const VANILLA_MUTATES_WINDOW_DECORATIONS_ON_RESIZE = false;

/** Whether resize may destroy and recreate the host window. */
export const VANILLA_RECREATES_WINDOW_ON_RESIZE = false;

/** Whether gameplay input is accepted while the window is unfocused. */
export const VANILLA_ACCEPTS_INPUT_WHILE_UNFOCUSED = false;

/** All valid mouse-grab transition values in ASCIIbetical order. */
export const RESIZE_FOCUS_MOUSE_GRAB_TRANSITIONS = Object.freeze(['grab', 'none', 'release'] as const);

const ZERO_PRESENTATION: AspectIntegerScalePresentation = Object.freeze({
  displayHeight: 0,
  displayWidth: 0,
  integerScale: 0,
  leftOffset: 0,
  topOffset: 0,
});

export type ResizeFocusMouseGrabTransition = (typeof RESIZE_FOCUS_MOUSE_GRAB_TRANSITIONS)[number];

export interface ResizeFocusPolicyDecision {
  readonly inputSuppressed: boolean;
  readonly mouseGrabbed: boolean;
  readonly presentation: AspectIntegerScalePresentation;
  readonly transition: ResizeFocusMouseGrabTransition;
}

export interface ResizeFocusPolicyInput {
  readonly aspectRatioCorrect: boolean;
  readonly clientHeight: number;
  readonly clientWidth: number;
  readonly grabEnabled: boolean;
  readonly mouseGrabbed: boolean;
  readonly screenVisible: boolean;
  readonly windowFocused: boolean;
}

export interface VanillaResizeFocusPolicyAuditEntry {
  readonly id:
    | 'CHOCOLATE_DEFAULT_GRABMOUSE_IS_ENABLED'
    | 'FOCUS_LOSS_RELEASES_MOUSE_GRAB'
    | 'FOCUS_LOSS_SUPPRESSES_GAMEPLAY_INPUT'
    | 'GRAB_DISABLED_PREVENTS_MOUSE_GRAB'
    | 'MINIMIZED_WINDOW_RELEASES_MOUSE_GRAB'
    | 'RESIZE_DOES_NOT_MUTATE_WINDOW_DECORATIONS'
    | 'RESIZE_DOES_NOT_RECREATE_WINDOW'
    | 'RESIZE_RECOMPUTES_INTEGER_SCALE_PRESENTATION';
  readonly invariant: string;
  readonly referenceSource: 'doom/chocolate-doom.cfg' | 'src/bootstrap/create-win32-window-with-vanilla-framebuffer-contract.ts' | 'src/bootstrap/implement-aspect-and-integer-scale-policy.ts' | 'src/input/focusPolicy.ts';
}

export type VanillaResizeFocusPolicyQueryKind = 'input-suppressed' | 'mouse-grab-transition' | 'mutates-window-decorations-on-resize' | 'presentation' | 'recreates-window-on-resize';

export interface VanillaResizeFocusPolicyResult {
  readonly answeredBoolean: boolean | null;
  readonly answeredMouseGrabTransition: ResizeFocusMouseGrabTransition | null;
  readonly answeredPresentation: AspectIntegerScalePresentation | null;
}

export interface VanillaResizeFocusPolicyProbe extends ResizeFocusPolicyInput {
  readonly expected: VanillaResizeFocusPolicyResult;
  readonly id: string;
  readonly queryKind: VanillaResizeFocusPolicyQueryKind;
}

export interface VanillaResizeFocusPolicyHandler {
  readonly runProbe: (probe: VanillaResizeFocusPolicyProbe) => VanillaResizeFocusPolicyResult;
}

const NULL_RESULT: VanillaResizeFocusPolicyResult = Object.freeze({
  answeredBoolean: null,
  answeredMouseGrabTransition: null,
  answeredPresentation: null,
});

export const VANILLA_RESIZE_FOCUS_POLICY_AUDIT: readonly VanillaResizeFocusPolicyAuditEntry[] = Object.freeze([
  {
    id: 'RESIZE_RECOMPUTES_INTEGER_SCALE_PRESENTATION',
    invariant: 'A client resize recomputes the centered integer-scale presentation rectangle from the existing 320x200 framebuffer; it does not introduce fractional scaling.',
    referenceSource: 'src/bootstrap/implement-aspect-and-integer-scale-policy.ts',
  },
  {
    id: 'RESIZE_DOES_NOT_RECREATE_WINDOW',
    invariant: 'A client resize does not destroy and recreate the host window during gameplay.',
    referenceSource: 'src/bootstrap/create-win32-window-with-vanilla-framebuffer-contract.ts',
  },
  {
    id: 'RESIZE_DOES_NOT_MUTATE_WINDOW_DECORATIONS',
    invariant: 'A client resize does not change host window decorations or toggle fullscreen state.',
    referenceSource: 'src/bootstrap/create-win32-window-with-vanilla-framebuffer-contract.ts',
  },
  {
    id: 'CHOCOLATE_DEFAULT_GRABMOUSE_IS_ENABLED',
    invariant: 'The local Chocolate Doom config has `grabmouse` enabled by default.',
    referenceSource: 'doom/chocolate-doom.cfg',
  },
  {
    id: 'FOCUS_LOSS_RELEASES_MOUSE_GRAB',
    invariant: 'Focus loss releases an already grabbed mouse.',
    referenceSource: 'src/input/focusPolicy.ts',
  },
  {
    id: 'FOCUS_LOSS_SUPPRESSES_GAMEPLAY_INPUT',
    invariant: 'Gameplay input is suppressed while the host window is unfocused.',
    referenceSource: 'src/input/focusPolicy.ts',
  },
  {
    id: 'MINIMIZED_WINDOW_RELEASES_MOUSE_GRAB',
    invariant: 'A minimized or otherwise invisible window releases an already grabbed mouse even when application focus remains true.',
    referenceSource: 'src/input/focusPolicy.ts',
  },
  {
    id: 'GRAB_DISABLED_PREVENTS_MOUSE_GRAB',
    invariant: 'When grabmouse is disabled, focus and visibility alone cannot acquire the mouse grab.',
    referenceSource: 'src/input/focusPolicy.ts',
  },
]);

export const VANILLA_RESIZE_FOCUS_POLICY_PROBES: readonly VanillaResizeFocusPolicyProbe[] = Object.freeze([
  {
    aspectRatioCorrect: AUDITED_CHOCOLATE_DEFAULT_ASPECT_RATIO_CORRECT,
    clientHeight: AUDITED_CHOCOLATE_DEFAULT_CLIENT_HEIGHT,
    clientWidth: AUDITED_CHOCOLATE_DEFAULT_CLIENT_WIDTH,
    expected: Object.freeze({
      ...NULL_RESULT,
      answeredPresentation: Object.freeze({
        displayHeight: 480,
        displayWidth: 640,
        integerScale: 2,
        leftOffset: 0,
        topOffset: 0,
      }),
    }),
    grabEnabled: AUDITED_CHOCOLATE_DEFAULT_GRABMOUSE_ENABLED,
    id: 'default-client-presents-corrected-two-scale',
    mouseGrabbed: false,
    queryKind: 'presentation',
    screenVisible: true,
    windowFocused: true,
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
    grabEnabled: true,
    id: 'odd-resize-keeps-centered-integer-scale',
    mouseGrabbed: true,
    queryKind: 'presentation',
    screenVisible: true,
    windowFocused: true,
  },
  {
    aspectRatioCorrect: true,
    clientHeight: 239,
    clientWidth: 320,
    expected: Object.freeze({
      ...NULL_RESULT,
      answeredPresentation: ZERO_PRESENTATION,
    }),
    grabEnabled: true,
    id: 'too-short-client-does-not-fractionally-scale',
    mouseGrabbed: true,
    queryKind: 'presentation',
    screenVisible: true,
    windowFocused: true,
  },
  {
    aspectRatioCorrect: true,
    clientHeight: 480,
    clientWidth: 640,
    expected: Object.freeze({
      ...NULL_RESULT,
      answeredMouseGrabTransition: 'grab',
    }),
    grabEnabled: true,
    id: 'focused-visible-enabled-window-grabs-mouse',
    mouseGrabbed: false,
    queryKind: 'mouse-grab-transition',
    screenVisible: true,
    windowFocused: true,
  },
  {
    aspectRatioCorrect: true,
    clientHeight: 480,
    clientWidth: 640,
    expected: Object.freeze({
      ...NULL_RESULT,
      answeredMouseGrabTransition: 'release',
    }),
    grabEnabled: true,
    id: 'focus-loss-releases-mouse',
    mouseGrabbed: true,
    queryKind: 'mouse-grab-transition',
    screenVisible: true,
    windowFocused: false,
  },
  {
    aspectRatioCorrect: true,
    clientHeight: 480,
    clientWidth: 640,
    expected: Object.freeze({
      ...NULL_RESULT,
      answeredBoolean: true,
    }),
    grabEnabled: true,
    id: 'focus-loss-suppresses-input',
    mouseGrabbed: true,
    queryKind: 'input-suppressed',
    screenVisible: true,
    windowFocused: false,
  },
  {
    aspectRatioCorrect: true,
    clientHeight: 0,
    clientWidth: 0,
    expected: Object.freeze({
      ...NULL_RESULT,
      answeredMouseGrabTransition: 'release',
    }),
    grabEnabled: true,
    id: 'minimized-window-releases-mouse',
    mouseGrabbed: true,
    queryKind: 'mouse-grab-transition',
    screenVisible: false,
    windowFocused: true,
  },
  {
    aspectRatioCorrect: true,
    clientHeight: 480,
    clientWidth: 640,
    expected: Object.freeze({
      ...NULL_RESULT,
      answeredMouseGrabTransition: 'none',
    }),
    grabEnabled: false,
    id: 'grab-disabled-prevents-regrab',
    mouseGrabbed: false,
    queryKind: 'mouse-grab-transition',
    screenVisible: true,
    windowFocused: true,
  },
  {
    aspectRatioCorrect: true,
    clientHeight: 480,
    clientWidth: 640,
    expected: Object.freeze({
      ...NULL_RESULT,
      answeredBoolean: false,
    }),
    grabEnabled: true,
    id: 'resize-does-not-recreate-window',
    mouseGrabbed: true,
    queryKind: 'recreates-window-on-resize',
    screenVisible: true,
    windowFocused: true,
  },
  {
    aspectRatioCorrect: true,
    clientHeight: 480,
    clientWidth: 640,
    expected: Object.freeze({
      ...NULL_RESULT,
      answeredBoolean: false,
    }),
    grabEnabled: true,
    id: 'resize-does-not-mutate-window-decorations',
    mouseGrabbed: true,
    queryKind: 'mutates-window-decorations-on-resize',
    screenVisible: true,
    windowFocused: true,
  },
]);

export const VANILLA_RESIZE_FOCUS_POLICY_PROBE_COUNT = 10;

export const REFERENCE_VANILLA_RESIZE_FOCUS_POLICY_HANDLER: VanillaResizeFocusPolicyHandler = Object.freeze({
  runProbe: deriveExpectedVanillaResizeFocusPolicyResult,
});

/**
 * Evaluate the resize/focus policy for one client and focus state.
 *
 * @param input - Client dimensions and focus/grab state.
 * @returns Presentation, input suppression, and mouse-grab transition decision.
 * @example
 * ```ts
 * evaluateResizeFocusPolicy({
 *   aspectRatioCorrect: true,
 *   clientHeight: 480,
 *   clientWidth: 640,
 *   grabEnabled: true,
 *   mouseGrabbed: false,
 *   screenVisible: true,
 *   windowFocused: true,
 * }).transition; // "grab"
 * ```
 */
export function evaluateResizeFocusPolicy(input: ResizeFocusPolicyInput): ResizeFocusPolicyDecision {
  const shouldGrabMouse = input.grabEnabled && input.screenVisible && input.windowFocused;
  const transition = computeMouseGrabTransition(shouldGrabMouse, input.mouseGrabbed);
  const presentation = input.screenVisible ? computeCenteredAspectIntegerScalePresentation(input.clientWidth, input.clientHeight, input.aspectRatioCorrect) : ZERO_PRESENTATION;

  return Object.freeze({
    inputSuppressed: !input.windowFocused,
    mouseGrabbed: shouldGrabMouse,
    presentation,
    transition,
  });
}

/**
 * Cross-check a resize/focus handler against the pinned probes.
 *
 * @param handler - Candidate handler to verify.
 * @returns Stable probe failure identifiers; empty when all probes match.
 * @example
 * ```ts
 * crossCheckVanillaResizeFocusPolicy(REFERENCE_VANILLA_RESIZE_FOCUS_POLICY_HANDLER); // []
 * ```
 */
export function crossCheckVanillaResizeFocusPolicy(handler: VanillaResizeFocusPolicyHandler): readonly string[] {
  const failures: string[] = [];

  for (const probe of VANILLA_RESIZE_FOCUS_POLICY_PROBES) {
    const result = handler.runProbe(probe);

    if (result.answeredBoolean !== probe.expected.answeredBoolean) {
      failures.push(`probe:${probe.id}:answeredBoolean:value-mismatch`);
    }
    if (result.answeredMouseGrabTransition !== probe.expected.answeredMouseGrabTransition) {
      failures.push(`probe:${probe.id}:answeredMouseGrabTransition:value-mismatch`);
    }
    if (!presentationEquals(result.answeredPresentation, probe.expected.answeredPresentation)) {
      failures.push(`probe:${probe.id}:answeredPresentation:value-mismatch`);
    }
  }

  return failures;
}

/**
 * Derive the expected answer for a resize/focus probe.
 *
 * @param probe - Probe to answer.
 * @returns Canonical answer for the probe's query kind.
 * @example
 * ```ts
 * const [probe] = VANILLA_RESIZE_FOCUS_POLICY_PROBES;
 * deriveExpectedVanillaResizeFocusPolicyResult(probe);
 * ```
 */
export function deriveExpectedVanillaResizeFocusPolicyResult(probe: VanillaResizeFocusPolicyProbe): VanillaResizeFocusPolicyResult {
  const decision = evaluateResizeFocusPolicy(probe);

  switch (probe.queryKind) {
    case 'input-suppressed': {
      return Object.freeze({
        ...NULL_RESULT,
        answeredBoolean: decision.inputSuppressed,
      });
    }
    case 'mouse-grab-transition': {
      return Object.freeze({
        ...NULL_RESULT,
        answeredMouseGrabTransition: decision.transition,
      });
    }
    case 'mutates-window-decorations-on-resize': {
      return Object.freeze({
        ...NULL_RESULT,
        answeredBoolean: VANILLA_MUTATES_WINDOW_DECORATIONS_ON_RESIZE,
      });
    }
    case 'presentation': {
      return Object.freeze({
        ...NULL_RESULT,
        answeredPresentation: decision.presentation,
      });
    }
    case 'recreates-window-on-resize': {
      return Object.freeze({
        ...NULL_RESULT,
        answeredBoolean: VANILLA_RECREATES_WINDOW_ON_RESIZE,
      });
    }
  }
}

function computeMouseGrabTransition(shouldGrabMouse: boolean, mouseGrabbed: boolean): ResizeFocusMouseGrabTransition {
  if (shouldGrabMouse && !mouseGrabbed) {
    return 'grab';
  }
  if (!shouldGrabMouse && mouseGrabbed) {
    return 'release';
  }
  return 'none';
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
