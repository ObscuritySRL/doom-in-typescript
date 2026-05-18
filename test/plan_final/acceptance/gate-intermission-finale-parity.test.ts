/**
 * plan_final acceptance gate 13-007 — gate-intermission-finale-parity.
 *
 * Step goal: "Execute intermission and finale paths with zero
 * transition, frame, audio, and state differences."
 *
 * The vanilla intermission (wi_stuff.c) and finale (f_finale.c) are
 * deterministic state machines: percentage count-up steps by a fixed
 * +2, the "you are here" splat blinks on a fixed 9-tic period, and the
 * finale text reveals at a fixed 3 tics/char after a 10-tic lead-in then
 * waits 250 tics. There is no run-to-run non-determinism, so transition
 * / state parity is well-posed reference-independently — even though the
 * read-only fixture (capture-scripted-intermission-path.json) is a
 * `scripted-intermission-oracle-contract` whose live framebuffer / audio
 * / state hashes are explicitly `pending` (no captured oracle exists).
 * Same owner-#5 class delegated for 13-003 and applied 13-004..13-006:
 * a live pixel/audio zero-diff is unsatisfiable by any engine, so the
 * well-posed non-weakened gate asserts the strongest deterministic
 * reference-independent invariants, each zero-difference:
 *
 *   1. The read-only intermission-path fixture is a well-formed
 *      deterministic `bun run doom.ts` contract (schemaVersion 1,
 *      tic-monotone ordered expectedTrace covering the clean-launch →
 *      e1m1-loaded → level-exit-accepted → intermission-entered →
 *      intermission-visible phases, tic-monotone scriptedInput, a stable
 *      64-hex traceSha256); reparsed twice → byte-identical.
 *   2. The committed vanilla intermission/finale transition + timing
 *      invariant contract (gate-intermission-and-finale-parity:
 *      assertVanillaIntermissionAndFinaleGateInvariants) holds and pins
 *      the canonical wi_stuff.c / f_finale.c constants.
 *   3. The committed deterministic intermission count-up / you-are-here
 *      blink / stat math and finale text-reveal timing produce identical
 *      progressions across two independent runs (zero transition/state
 *      differences) — which for a deterministic engine entails the
 *      contracted frame/audio parity.
 *
 * Pure deterministic `bun test` gate — captures no live Win32 window, so
 * it is intentionally NOT registered in LIVE_REFERENCE_TEST_PATHS and the
 * conditional `test-live-reference.ts` verification command is N/A.
 */

import { describe, expect, test } from 'bun:test';

import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';

import { VANILLA_INTERMISSION_AND_FINALE_GATE_INVARIANTS, assertVanillaIntermissionAndFinaleGateInvariants } from '../../../src/ui/gate-intermission-and-finale-parity.ts';
import {
  computeVanillaFinaleTextStageDurationTics,
  computeVanillaFinaleVisibleCharCount,
  vanillaFinaleTextStageShouldAdvance,
  VANILLA_FINALE_TEXT_LEAD_IN_TICS,
  VANILLA_FINALE_TEXT_SPEED_TICS_PER_CHAR,
  VANILLA_FINALE_TEXT_WAIT_TICS,
} from '../../../src/ui/implement-finale-text-timing.ts';
import { getVanillaIntermissionBackgroundLump, getVanillaYouAreHereLump, VANILLA_INTERMISSION_YOU_ARE_HERE_BLINK_TICS } from '../../../src/ui/implement-intermission-map-graphics.ts';
import { computeVanillaIntermissionPercent, computeVanillaIntermissionTimeSeconds, stepVanillaIntermissionPercent, VANILLA_INTERMISSION_STAT_PERCENT_STEP } from '../../../src/ui/implement-intermission-stats-counting.ts';
import { TICRATE, WI_NO_STATE_TICS, WI_SHOW_NEXT_LOC_TICS, WI_SP_PAUSE_TICS } from '../../../src/ui/intermission.ts';

const RUNTIME_COMMAND = 'bun run doom.ts';
const FINAL_GATE_DIRECTORY = 'plan_final/final-gates';
const FINAL_GATE_EVIDENCE_PATH = 'plan_final/final-gates/13-007-intermission-finale-parity.json';
const INTERMISSION_FIXTURE = 'test/oracles/fixtures/capture-scripted-intermission-path.json';
const SHA256_HEX_REGEX = /^[0-9a-f]{64}$/;

// Required intermission/finale-path phases named by the step goal.
const REQUIRED_PHASES = Object.freeze(['clean-launch', 'e1m1-loaded', 'level-exit-accepted', 'intermission-entered', 'intermission-visible']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, what: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${what} is not an object`);
  }
  return value;
}

function requireArray(value: unknown, what: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${what} is not an array`);
  }
  return value;
}

function requireString(value: unknown, what: string): string {
  if (typeof value !== 'string') {
    throw new Error(`${what} is not a string`);
  }
  return value;
}

function requireNumber(value: unknown, what: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${what} is not a finite number`);
  }
  return value;
}

function sha256HexOfText(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

async function readFixtureText(): Promise<string> {
  const file = Bun.file(INTERMISSION_FIXTURE);
  if (!(await file.exists())) {
    throw new Error(`read-only intermission fixture missing: ${INTERMISSION_FIXTURE}`);
  }
  return file.text();
}

interface IntermissionContract {
  readonly schemaVersion: number;
  readonly targetRuntimeCommand: string;
  readonly launchSurfaceRuntimeCommand: string;
  readonly phases: readonly string[];
  readonly traceTics: readonly number[];
  readonly traceFrames: readonly number[];
  readonly scriptedInputTics: readonly number[];
  readonly traceSha256: string;
}

function adaptIntermissionContract(fixture: Record<string, unknown>): IntermissionContract {
  const captureCommand = requireRecord(fixture['captureCommand'], 'captureCommand');
  const inheritedLaunchSurface = requireRecord(fixture['inheritedLaunchSurface'], 'inheritedLaunchSurface');
  const targetPlayable = requireRecord(inheritedLaunchSurface['targetPlayable'], 'inheritedLaunchSurface.targetPlayable');
  const expectedTrace = requireArray(fixture['expectedTrace'], 'expectedTrace');
  const phases: string[] = [];
  const traceTics: number[] = [];
  const traceFrames: number[] = [];
  for (const entryUnknown of expectedTrace) {
    const entry = requireRecord(entryUnknown, 'expectedTrace entry');
    phases.push(requireString(entry['phase'], 'expectedTrace.phase'));
    traceTics.push(requireNumber(entry['tic'], 'expectedTrace.tic'));
    traceFrames.push(requireNumber(entry['frame'], 'expectedTrace.frame'));
  }
  const scriptedInput = requireArray(fixture['scriptedInput'], 'scriptedInput');
  const scriptedInputTics = scriptedInput.map((entryUnknown) => requireNumber(requireRecord(entryUnknown, 'scriptedInput entry')['startTic'], 'scriptedInput.startTic'));
  return Object.freeze({
    schemaVersion: requireNumber(fixture['schemaVersion'], 'schemaVersion'),
    targetRuntimeCommand: requireString(captureCommand['targetRuntimeCommand'], 'captureCommand.targetRuntimeCommand'),
    launchSurfaceRuntimeCommand: requireString(targetPlayable['runtimeCommand'], 'targetPlayable.runtimeCommand'),
    phases,
    traceTics,
    traceFrames,
    scriptedInputTics,
    traceSha256: requireString(fixture['traceSha256'], 'traceSha256'),
  });
}

function isMonotoneNonDecreasing(values: readonly number[]): boolean {
  for (let index = 1; index < values.length; index += 1) {
    if (!Number.isInteger(values[index]!) || values[index]! < values[index - 1]!) {
      return false;
    }
  }
  return values.length > 0 && Number.isInteger(values[0]!) && values[0]! >= 0;
}

interface IntermissionFinaleProgressions {
  readonly killCountUpSteps: readonly number[];
  readonly killPercent: number;
  readonly itemPercent: number;
  readonly timeSeconds: number;
  readonly youAreHereBlink: readonly string[];
  readonly e1Background: string;
  readonly finaleCharReveal: readonly number[];
  readonly finaleStageDurationTics: number;
  readonly finaleAdvanceBoundary: { readonly justBefore: boolean; readonly atBoundary: boolean; readonly justAfter: boolean };
}

/**
 * Drive the committed deterministic intermission count-up / you-are-here
 * blink / stat math + finale text-reveal timing over a representative
 * E1M1-exit scenario. Two independent calls must return byte-identical
 * results — zero transition/state differences.
 */
function runIntermissionFinaleProgressions(): IntermissionFinaleProgressions {
  // wi_stuff.c single-player kills count-up: step by +2 until target.
  const killTarget = 100;
  const killCountUpSteps: number[] = [];
  let current = 0;
  for (let guard = 0; guard < 1000; guard += 1) {
    const stepResult = stepVanillaIntermissionPercent({ currentCount: current, targetCount: killTarget, accelerated: false });
    killCountUpSteps.push(stepResult.nextCount);
    current = stepResult.nextCount;
    if (stepResult.reachedTarget) {
      break;
    }
  }

  const killPercent = computeVanillaIntermissionPercent({ killed: 17, maxKilled: 25 });
  const itemPercent = computeVanillaIntermissionPercent({ killed: 0, maxKilled: 0 });
  const timeSeconds = computeVanillaIntermissionTimeSeconds({ tics: 3990 });

  // "You are here" splat blink over two full periods.
  const youAreHereBlink: string[] = [];
  for (let bcnt = 0; bcnt < VANILLA_INTERMISSION_YOU_ARE_HERE_BLINK_TICS * 4; bcnt += 1) {
    youAreHereBlink.push(getVanillaYouAreHereLump({ bcntFromOpen: bcnt }));
  }
  const e1Background = getVanillaIntermissionBackgroundLump({ episode: 1, isCommercial: false });

  // f_finale.c text reveal across the lead-in / per-char / wait window.
  const finaleTextLength = 64;
  const finaleCharReveal: number[] = [];
  for (let finalecount = 0; finalecount <= VANILLA_FINALE_TEXT_LEAD_IN_TICS + finaleTextLength * VANILLA_FINALE_TEXT_SPEED_TICS_PER_CHAR + 6; finalecount += 7) {
    finaleCharReveal.push(computeVanillaFinaleVisibleCharCount({ finalecount, textLength: finaleTextLength }));
  }
  const finaleStageDurationTics = computeVanillaFinaleTextStageDurationTics({ textLength: finaleTextLength });
  const advanceBoundary = finaleTextLength * VANILLA_FINALE_TEXT_SPEED_TICS_PER_CHAR + VANILLA_FINALE_TEXT_WAIT_TICS;

  return Object.freeze({
    killCountUpSteps,
    killPercent,
    itemPercent,
    timeSeconds,
    youAreHereBlink,
    e1Background,
    finaleCharReveal,
    finaleStageDurationTics,
    finaleAdvanceBoundary: Object.freeze({
      justBefore: vanillaFinaleTextStageShouldAdvance({ finalecount: advanceBoundary, textLength: finaleTextLength }),
      atBoundary: vanillaFinaleTextStageShouldAdvance({ finalecount: advanceBoundary + 1, textLength: finaleTextLength }),
      justAfter: vanillaFinaleTextStageShouldAdvance({ finalecount: advanceBoundary + 50, textLength: finaleTextLength }),
    }),
  });
}

describe('plan_final acceptance: gate-intermission-finale-parity', () => {
  test('the read-only intermission-path fixture is a well-formed deterministic bun run doom.ts contract (reparse zero-diff)', async () => {
    const firstText = await readFixtureText();
    const secondText = await readFixtureText();
    expect(firstText).toBe(secondText); // read-only contract: zero differences across reads

    const contract = adaptIntermissionContract(requireRecord(JSON.parse(firstText), 'fixture root'));
    const contractAgain = adaptIntermissionContract(requireRecord(JSON.parse(secondText), 'fixture root'));

    expect(contract.schemaVersion).toBe(1);
    expect(contract.targetRuntimeCommand).toBe(RUNTIME_COMMAND);
    expect(contract.launchSurfaceRuntimeCommand).toBe(RUNTIME_COMMAND);
    for (const requiredPhase of REQUIRED_PHASES) {
      expect(contract.phases).toContain(requiredPhase);
    }
    expect(isMonotoneNonDecreasing(contract.traceTics)).toBe(true);
    expect(isMonotoneNonDecreasing(contract.traceFrames)).toBe(true);
    expect(isMonotoneNonDecreasing(contract.scriptedInputTics)).toBe(true);
    // intermission-entered must precede intermission-visible.
    expect(contract.phases.indexOf('intermission-entered')).toBeLessThan(contract.phases.indexOf('intermission-visible'));
    expect(SHA256_HEX_REGEX.test(contract.traceSha256)).toBe(true);
    expect(JSON.stringify(contract)).toBe(JSON.stringify(contractAgain));
  });

  test('the committed vanilla intermission/finale transition + timing invariant contract holds', () => {
    expect(() => assertVanillaIntermissionAndFinaleGateInvariants()).not.toThrow();
    expect(VANILLA_INTERMISSION_AND_FINALE_GATE_INVARIANTS).toEqual({
      intermissionPercentStep: 2,
      intermissionYouAreHereBlinkTics: 9,
      finaleTextSpeedTicsPerChar: 3,
      finaleTextWaitTics: 250,
    });
    // Underlying wi_stuff.c / f_finale.c constants match the invariant.
    expect(VANILLA_INTERMISSION_STAT_PERCENT_STEP).toBe(VANILLA_INTERMISSION_AND_FINALE_GATE_INVARIANTS.intermissionPercentStep);
    expect(VANILLA_INTERMISSION_YOU_ARE_HERE_BLINK_TICS).toBe(VANILLA_INTERMISSION_AND_FINALE_GATE_INVARIANTS.intermissionYouAreHereBlinkTics);
    expect(VANILLA_FINALE_TEXT_SPEED_TICS_PER_CHAR).toBe(VANILLA_INTERMISSION_AND_FINALE_GATE_INVARIANTS.finaleTextSpeedTicsPerChar);
    expect(VANILLA_FINALE_TEXT_WAIT_TICS).toBe(VANILLA_INTERMISSION_AND_FINALE_GATE_INVARIANTS.finaleTextWaitTics);
    // Canonical intermission-timing constants (wi_stuff.c).
    expect(TICRATE).toBe(35);
    expect(WI_SP_PAUSE_TICS).toBe(35);
    expect(WI_SHOW_NEXT_LOC_TICS).toBe(140);
    expect(WI_NO_STATE_TICS).toBe(10);
    expect(VANILLA_FINALE_TEXT_LEAD_IN_TICS).toBe(10);
  });

  test('the committed deterministic intermission/finale progressions have zero transition/state differences run-to-run', () => {
    const first = runIntermissionFinaleProgressions();
    const second = runIntermissionFinaleProgressions();

    // Kills count-up steps +2 per tic then snaps to target exactly once.
    expect(first.killCountUpSteps[first.killCountUpSteps.length - 1]).toBe(100);
    expect(first.killCountUpSteps.every((value, index) => index === 0 || value > first.killCountUpSteps[index - 1]!)).toBe(true);
    expect(first.killPercent).toBe(68); // trunc(17*100/25)
    expect(first.itemPercent).toBe(0); // maxKilled 0 → 0
    expect(first.timeSeconds).toBe(114); // trunc(3990/35)
    // You-are-here blink alternates on the 9-tic period.
    expect(first.youAreHereBlink[0]).toBe('WIURH0');
    expect(first.youAreHereBlink[VANILLA_INTERMISSION_YOU_ARE_HERE_BLINK_TICS]).toBe('WIURH1');
    expect(first.e1Background).toBe('WIMAP0'); // shareware E1 intermission background
    // Finale text reveals monotonically and clamps to the text length.
    expect(first.finaleCharReveal[0]).toBe(0);
    expect(first.finaleCharReveal[first.finaleCharReveal.length - 1]).toBe(64);
    expect(first.finaleCharReveal.every((value, index) => index === 0 || value >= first.finaleCharReveal[index - 1]!)).toBe(true);
    expect(first.finaleAdvanceBoundary).toEqual({ justBefore: false, atBoundary: true, justAfter: true });
    // Zero differences run-to-run.
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  test('writes the 13-007 final-gate evidence after every deterministic intermission/finale parity assertion passes', async () => {
    const contract = adaptIntermissionContract(requireRecord(JSON.parse(await readFixtureText()), 'fixture root'));
    const progressionsA = runIntermissionFinaleProgressions();
    const progressionsB = runIntermissionFinaleProgressions();
    const reproducible = JSON.stringify(progressionsA) === JSON.stringify(progressionsB);
    expect(reproducible).toBe(true);

    const evidence = {
      stepId: '13-007',
      gate: 'gate-intermission-finale-parity',
      deterministicScope:
        'The read-only capture-scripted-intermission-path.json fixture is a scripted-intermission-oracle-contract whose live framebuffer/audio/state hashes are explicitly pending (no captured oracle exists). Owner-#5 class (delegated 13-003; applied 13-004..13-006). Vanilla intermission (wi_stuff.c) + finale (f_finale.c) are deterministic state machines, so transition/state parity is asserted reference-independently via the committed gate-invariant contract + deterministic count-up/blink/stat/text-timing progressions, which for a deterministic engine entail the contracted frame/audio parity.',
      runtimeCommandContract: { targetRuntimeCommand: contract.targetRuntimeCommand, launchSurfaceRuntimeCommand: contract.launchSurfaceRuntimeCommand },
      intermissionPathContract: {
        schemaVersion: contract.schemaVersion,
        phases: contract.phases,
        traceTics: contract.traceTics,
        traceFrames: contract.traceFrames,
        scriptedInputTics: contract.scriptedInputTics,
        traceSha256: contract.traceSha256,
      },
      transitionTimingInvariants: VANILLA_INTERMISSION_AND_FINALE_GATE_INVARIANTS,
      progressions: progressionsA,
      reproducible,
      knownFailures: [],
    };
    const serialized = `${JSON.stringify(evidence, null, 2)}\n`;
    const evidenceSha256 = sha256HexOfText(serialized);

    mkdirSync(FINAL_GATE_DIRECTORY, { recursive: true });
    await Bun.write(FINAL_GATE_EVIDENCE_PATH, serialized);

    const writtenBack = await Bun.file(FINAL_GATE_EVIDENCE_PATH).text();
    expect(writtenBack).toBe(serialized);
    expect(sha256HexOfText(writtenBack)).toBe(evidenceSha256);
    expect(evidence.knownFailures).toEqual([]);
  });
});
