import { describe, expect, test } from 'bun:test';

import { FocusPolicy } from '../../../src/input/focusPolicy.ts';
import {
  AUDITED_CHOCOLATE_DEFAULT_GRABMOUSE_ENABLED,
  REFERENCE_VANILLA_RESIZE_FOCUS_POLICY_HANDLER,
  VANILLA_ACCEPTS_INPUT_WHILE_UNFOCUSED,
  VANILLA_MUTATES_WINDOW_DECORATIONS_ON_RESIZE,
  VANILLA_RECREATES_WINDOW_ON_RESIZE,
  VANILLA_RESIZE_FOCUS_POLICY_AUDIT,
  VANILLA_RESIZE_FOCUS_POLICY_PROBE_COUNT,
  VANILLA_RESIZE_FOCUS_POLICY_PROBES,
  crossCheckVanillaResizeFocusPolicy,
  deriveExpectedVanillaResizeFocusPolicyResult,
  evaluateResizeFocusPolicy,
} from '../../../src/bootstrap/implement-resize-and-focus-policy.ts';
import type { VanillaResizeFocusPolicyHandler } from '../../../src/bootstrap/implement-resize-and-focus-policy.ts';

describe('STEP 03-017 implement-resize-and-focus-policy', () => {
  test('pins the resize and focus audit clauses with local evidence sources', () => {
    expect(VANILLA_RESIZE_FOCUS_POLICY_AUDIT).toHaveLength(8);
    expect(VANILLA_RESIZE_FOCUS_POLICY_AUDIT.map((entry) => entry.id)).toEqual([
      'RESIZE_RECOMPUTES_INTEGER_SCALE_PRESENTATION',
      'RESIZE_DOES_NOT_RECREATE_WINDOW',
      'RESIZE_DOES_NOT_MUTATE_WINDOW_DECORATIONS',
      'CHOCOLATE_DEFAULT_GRABMOUSE_IS_ENABLED',
      'FOCUS_LOSS_RELEASES_MOUSE_GRAB',
      'FOCUS_LOSS_SUPPRESSES_GAMEPLAY_INPUT',
      'MINIMIZED_WINDOW_RELEASES_MOUSE_GRAB',
      'GRAB_DISABLED_PREVENTS_MOUSE_GRAB',
    ]);
    expect(new Set(VANILLA_RESIZE_FOCUS_POLICY_AUDIT.map((entry) => entry.referenceSource))).toEqual(
      new Set(['doom/chocolate-doom.cfg', 'src/bootstrap/create-win32-window-with-vanilla-framebuffer-contract.ts', 'src/bootstrap/implement-aspect-and-integer-scale-policy.ts', 'src/input/focusPolicy.ts']),
    );
  });

  test('evaluates the default visible focused window as corrected 2x with initial grab', () => {
    expect(AUDITED_CHOCOLATE_DEFAULT_GRABMOUSE_ENABLED).toBe(true);

    const decision = evaluateResizeFocusPolicy({
      aspectRatioCorrect: true,
      clientHeight: 480,
      clientWidth: 640,
      grabEnabled: true,
      mouseGrabbed: false,
      screenVisible: true,
      windowFocused: true,
    });

    expect(decision).toEqual({
      inputSuppressed: false,
      mouseGrabbed: true,
      presentation: {
        displayHeight: 480,
        displayWidth: 640,
        integerScale: 2,
        leftOffset: 0,
        topOffset: 0,
      },
      transition: 'grab',
    });
  });

  test('keeps resize presentation on whole-pixel integer scale', () => {
    const decision = evaluateResizeFocusPolicy({
      aspectRatioCorrect: true,
      clientHeight: 769,
      clientWidth: 1025,
      grabEnabled: true,
      mouseGrabbed: true,
      screenVisible: true,
      windowFocused: true,
    });

    expect(decision.presentation).toEqual({
      displayHeight: 720,
      displayWidth: 960,
      integerScale: 3,
      leftOffset: 32,
      topOffset: 24,
    });
    expect(Number.isInteger(decision.presentation.leftOffset)).toBe(true);
    expect(Number.isInteger(decision.presentation.topOffset)).toBe(true);
  });

  test('rejects too-small clients instead of using a fractional resize scale', () => {
    const decision = evaluateResizeFocusPolicy({
      aspectRatioCorrect: true,
      clientHeight: 239,
      clientWidth: 320,
      grabEnabled: true,
      mouseGrabbed: true,
      screenVisible: true,
      windowFocused: true,
    });

    expect(decision.presentation).toEqual({
      displayHeight: 0,
      displayWidth: 0,
      integerScale: 0,
      leftOffset: 0,
      topOffset: 0,
    });
    expect(decision.transition).toBe('none');
  });

  test('suppresses input and releases mouse grab on focus loss', () => {
    expect(VANILLA_ACCEPTS_INPUT_WHILE_UNFOCUSED).toBe(false);

    const decision = evaluateResizeFocusPolicy({
      aspectRatioCorrect: true,
      clientHeight: 480,
      clientWidth: 640,
      grabEnabled: true,
      mouseGrabbed: true,
      screenVisible: true,
      windowFocused: false,
    });

    expect(decision.inputSuppressed).toBe(true);
    expect(decision.mouseGrabbed).toBe(false);
    expect(decision.transition).toBe('release');
  });

  test('releases mouse grab while minimized without treating the app as unfocused', () => {
    const decision = evaluateResizeFocusPolicy({
      aspectRatioCorrect: true,
      clientHeight: 0,
      clientWidth: 0,
      grabEnabled: true,
      mouseGrabbed: true,
      screenVisible: false,
      windowFocused: true,
    });

    expect(decision.inputSuppressed).toBe(false);
    expect(decision.mouseGrabbed).toBe(false);
    expect(decision.presentation).toEqual({
      displayHeight: 0,
      displayWidth: 0,
      integerScale: 0,
      leftOffset: 0,
      topOffset: 0,
    });
    expect(decision.transition).toBe('release');
  });

  test('does not acquire mouse grab when grabmouse is disabled', () => {
    const decision = evaluateResizeFocusPolicy({
      aspectRatioCorrect: true,
      clientHeight: 480,
      clientWidth: 640,
      grabEnabled: false,
      mouseGrabbed: false,
      screenVisible: true,
      windowFocused: true,
    });

    expect(decision.mouseGrabbed).toBe(false);
    expect(decision.transition).toBe('none');
  });

  test('matches the runtime focus state machine for focus and visibility transitions', () => {
    const focusPolicy = new FocusPolicy();

    expect(focusPolicy.evaluate()).toBe('grab');
    expect(focusPolicy.handleActivateApp(0)).toBe('release');
    expect(focusPolicy.inputSuppressed).toBe(true);
    expect(focusPolicy.handleActivateApp(1)).toBe('grab');
    expect(focusPolicy.setScreenVisible(false)).toBe('release');
    expect(focusPolicy.inputSuppressed).toBe(false);
    expect(focusPolicy.setScreenVisible(true)).toBe('grab');
    expect(focusPolicy.setGrabEnabled(false)).toBe('release');
    expect(focusPolicy.handleActivateApp(1)).toBe('none');
  });

  test('cross-checks every resize and focus probe against the reference handler', () => {
    expect(VANILLA_RESIZE_FOCUS_POLICY_PROBE_COUNT).toBe(10);
    expect(VANILLA_RESIZE_FOCUS_POLICY_PROBES).toHaveLength(VANILLA_RESIZE_FOCUS_POLICY_PROBE_COUNT);
    expect(crossCheckVanillaResizeFocusPolicy(REFERENCE_VANILLA_RESIZE_FOCUS_POLICY_HANDLER)).toEqual([]);

    for (const probe of VANILLA_RESIZE_FOCUS_POLICY_PROBES) {
      expect(deriveExpectedVanillaResizeFocusPolicyResult(probe)).toEqual(probe.expected);
    }
  });

  test('reports stable failures for a non-vanilla resize/focus handler', () => {
    const brokenHandler: VanillaResizeFocusPolicyHandler = {
      runProbe(probe) {
        const expected = deriveExpectedVanillaResizeFocusPolicyResult(probe);

        if (probe.id === 'odd-resize-keeps-centered-integer-scale') {
          return {
            ...expected,
            answeredPresentation: {
              displayHeight: 769,
              displayWidth: 1025,
              integerScale: 0,
              leftOffset: 0,
              topOffset: 0,
            },
          };
        }

        if (probe.id === 'focus-loss-suppresses-input') {
          return {
            ...expected,
            answeredBoolean: false,
          };
        }

        return expected;
      },
    };

    expect(crossCheckVanillaResizeFocusPolicy(brokenHandler)).toEqual(['probe:odd-resize-keeps-centered-integer-scale:answeredPresentation:value-mismatch', 'probe:focus-loss-suppresses-input:answeredBoolean:value-mismatch']);
  });

  test('pins resize as presentation-only without window lifecycle mutation', () => {
    expect(VANILLA_MUTATES_WINDOW_DECORATIONS_ON_RESIZE).toBe(false);
    expect(VANILLA_RECREATES_WINDOW_ON_RESIZE).toBe(false);
  });
});
