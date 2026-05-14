import { existsSync, readdirSync, readFileSync } from 'node:fs';

import { describe, expect, test } from 'bun:test';

const FIXTURES_DIRECTORY = 'test/oracles/fixtures';
const PLAN_FINAL_STEPS_DIRECTORY = 'plan_final/steps';
const PENDING_VALUE_PREFIX = 'pending-';
const BLOCKED_STATUS_LITERAL = 'blocked-pending-future-step';
const PLAN_FINAL_STEP_ID_REGEX = /^\d{2}-\d{3}$/;

interface BlockedFixtureEntry {
  readonly followUpStepId: string;
  readonly rationale: string;
  readonly relativePath: string;
  readonly status: typeof BLOCKED_STATUS_LITERAL;
}

const BLOCKED_FIXTURES_AUTHORITATIVE_REGISTRY: readonly BlockedFixtureEntry[] = [
  {
    followUpStepId: '02-011',
    rationale:
      'MVP demo3 playback checkpoint hashes await a live `-playdemo demo3` capture binding; the gate step 02-011 is responsible for re-binding these hashes to live evidence from captureReferenceDemoSync before parity work proceeds.',
    relativePath: 'test/oracles/fixtures/capture-demo3-playback-checkpoints.json',
    status: BLOCKED_STATUS_LITERAL,
  },
  {
    followUpStepId: '02-011',
    rationale: 'The final side-by-side replay surface has no runnable capture binding; the gate step 02-011 is responsible for confirming the replay surface is bound to a live runner before parity work proceeds.',
    relativePath: 'test/oracles/fixtures/capture-final-side-by-side-replay.json',
    status: BLOCKED_STATUS_LITERAL,
  },
  {
    followUpStepId: '02-011',
    rationale: 'First-menu-frame live hashes await replacement from a sandboxed Esc-only capture; the gate step 02-011 is responsible for re-binding to live captureReferenceMenuRoute evidence before parity work proceeds.',
    relativePath: 'test/oracles/fixtures/capture-first-menu-frame.json',
    status: BLOCKED_STATUS_LITERAL,
  },
  {
    followUpStepId: '02-011',
    rationale: 'Framebuffer hash window contract still uses null/pending placeholder hashes pending a live capture from the reference build; the gate step 02-011 is responsible for re-binding before parity work proceeds.',
    relativePath: 'test/oracles/fixtures/capture-framebuffer-hash-windows.json',
    status: BLOCKED_STATUS_LITERAL,
  },
  {
    followUpStepId: '02-011',
    rationale:
      'Full attract-loop cycle hashes (title -> DEMO1 -> post-DEMO1 -> DEMO2 -> post-DEMO2 -> DEMO3 -> title-repeat) await a long-running capture extension to captureReferenceIntermissionFinale; the gate step 02-011 is responsible for re-binding before parity work proceeds.',
    relativePath: 'test/oracles/fixtures/capture-full-attract-loop-cycle.json',
    status: BLOCKED_STATUS_LITERAL,
  },
  {
    followUpStepId: '02-011',
    rationale: 'Initial title frame live framebuffer + state + audio hashes await replacement; the gate step 02-011 is responsible for re-binding to live captureReferenceTitleFrame evidence before parity work proceeds.',
    relativePath: 'test/oracles/fixtures/capture-initial-title-frame.json',
    status: BLOCKED_STATUS_LITERAL,
  },
  {
    followUpStepId: '02-011',
    rationale: 'Per-action save/load roundtrip framebuffer + state + audio hashes await replacement from captureReferenceSaveLoad; the gate step 02-011 is responsible for re-binding before parity work proceeds.',
    relativePath: 'test/oracles/fixtures/capture-live-save-load-roundtrip.json',
    status: BLOCKED_STATUS_LITERAL,
  },
  {
    followUpStepId: '02-011',
    rationale: 'Music-event hash window contract still uses null/pending placeholder hashes pending a live music-event capture from the reference build; the gate step 02-011 is responsible for re-binding before parity work proceeds.',
    relativePath: 'test/oracles/fixtures/capture-music-event-hash-windows.json',
    status: BLOCKED_STATUS_LITERAL,
  },
  {
    followUpStepId: '02-011',
    rationale: 'Quit confirmation framebuffer/state/audio hashes await replacement from a scripted F10/Esc Y/N capture; the gate step 02-011 is responsible for re-binding before parity work proceeds.',
    relativePath: 'test/oracles/fixtures/capture-quit-confirmation-path.json',
    status: BLOCKED_STATUS_LITERAL,
  },
  {
    followUpStepId: '02-011',
    rationale: 'F2/F3 save/load menu navigation hashes outside the slot-0 roundtrip await replacement; the gate step 02-011 is responsible for re-binding before parity work proceeds.',
    relativePath: 'test/oracles/fixtures/capture-save-load-menu-path.json',
    status: BLOCKED_STATUS_LITERAL,
  },
  {
    followUpStepId: '02-011',
    rationale: 'F5 detail / +/- screen size / F11 gamma keystroke path framebuffer/state/audio hashes await replacement; the gate step 02-011 is responsible for re-binding before parity work proceeds.',
    relativePath: 'test/oracles/fixtures/capture-screen-size-detail-gamma-paths.json',
    status: BLOCKED_STATUS_LITERAL,
  },
  {
    followUpStepId: '02-011',
    rationale: 'Scripted damage-death path framebuffer/state/audio hashes await replacement from captureReferenceE1M1Action("damage"/"death-reborn"); the gate step 02-011 is responsible for re-binding before parity work proceeds.',
    relativePath: 'test/oracles/fixtures/capture-scripted-damage-death-path.json',
    status: BLOCKED_STATUS_LITERAL,
  },
  {
    followUpStepId: '02-011',
    rationale: 'Scripted door-use path framebuffer/state/audio hashes await replacement from captureReferenceE1M1Action("door-use"); the gate step 02-011 is responsible for re-binding before parity work proceeds.',
    relativePath: 'test/oracles/fixtures/capture-scripted-door-use-path.json',
    status: BLOCKED_STATUS_LITERAL,
  },
  {
    followUpStepId: '02-011',
    rationale: 'Scripted movement path framebuffer/state/audio hashes await replacement from captureReferenceE1M1Action("movement"); the gate step 02-011 is responsible for re-binding before parity work proceeds.',
    relativePath: 'test/oracles/fixtures/capture-scripted-movement-path.json',
    status: BLOCKED_STATUS_LITERAL,
  },
  {
    followUpStepId: '02-011',
    rationale: 'SFX hash window contract still uses null/pending placeholder hashes pending a live SFX capture from the reference build; the gate step 02-011 is responsible for re-binding before parity work proceeds.',
    relativePath: 'test/oracles/fixtures/capture-sfx-hash-windows.json',
    status: BLOCKED_STATUS_LITERAL,
  },
  {
    followUpStepId: '02-011',
    rationale: 'Sound volume menu navigation + slider sample framebuffer/state/audio hashes await replacement; the gate step 02-011 is responsible for re-binding before parity work proceeds.',
    relativePath: 'test/oracles/fixtures/capture-sound-volume-menu-path.json',
    status: BLOCKED_STATUS_LITERAL,
  },
  {
    followUpStepId: '02-011',
    rationale: 'State hash window contract still uses null/pending placeholder hashes pending a live state capture from the reference build; the gate step 02-011 is responsible for re-binding before parity work proceeds.',
    relativePath: 'test/oracles/fixtures/capture-state-hash-windows.json',
    status: BLOCKED_STATUS_LITERAL,
  },
];

type JsonObject = { readonly [key: string]: JsonValue };
type JsonValue = JsonObject | JsonValue[] | boolean | null | number | string;

interface PendingOccurrence {
  readonly fixtureRelativePath: string;
  readonly jsonPointer: string;
  readonly stringValue: string;
}

function listFixtureRelativePathsSorted(): readonly string[] {
  return readdirSync(FIXTURES_DIRECTORY)
    .filter((entry) => entry.endsWith('.json'))
    .map((entry) => `${FIXTURES_DIRECTORY}/${entry}`)
    .sort();
}

function readFixture(fixtureRelativePath: string): JsonValue {
  const text = readFileSync(fixtureRelativePath, 'utf8');
  return JSON.parse(text) as JsonValue;
}

function escapeJsonPointerSegment(segment: string): string {
  return segment.replace(/~/g, '~0').replace(/\//g, '~1');
}

function collectPendingValueOccurrences(fixtureRelativePath: string, fixtureRoot: JsonValue): readonly PendingOccurrence[] {
  const occurrences: PendingOccurrence[] = [];
  function walk(currentValue: JsonValue, currentPointer: string): void {
    if (typeof currentValue === 'string') {
      if (currentValue.startsWith(PENDING_VALUE_PREFIX)) {
        occurrences.push({ fixtureRelativePath, jsonPointer: currentPointer, stringValue: currentValue });
      }
      return;
    }
    if (currentValue === null || typeof currentValue === 'boolean' || typeof currentValue === 'number') {
      return;
    }
    if (Array.isArray(currentValue)) {
      for (let arrayIndex = 0; arrayIndex < currentValue.length; arrayIndex += 1) {
        const arrayElement = currentValue[arrayIndex];
        if (arrayElement === undefined) {
          continue;
        }
        walk(arrayElement, `${currentPointer}/${arrayIndex}`);
      }
      return;
    }
    for (const propertyKey of Object.keys(currentValue)) {
      const propertyValue = currentValue[propertyKey];
      if (propertyValue === undefined) {
        continue;
      }
      walk(propertyValue, `${currentPointer}/${escapeJsonPointerSegment(propertyKey)}`);
    }
  }
  walk(fixtureRoot, '');
  return occurrences;
}

function planFinalStepFileExists(stepId: string): boolean {
  const entries = readdirSync(PLAN_FINAL_STEPS_DIRECTORY);
  for (const entry of entries) {
    if (entry.startsWith(`${stepId}-`) && entry.endsWith('.md')) {
      return true;
    }
  }
  return false;
}

describe('oracle: replace-pending-oracle-fixtures contract', () => {
  test('every fixture under test/oracles/fixtures/ parses as JSON', () => {
    const fixturePaths = listFixtureRelativePathsSorted();
    expect(fixturePaths.length).toBeGreaterThan(0);
    for (const fixturePath of fixturePaths) {
      expect(() => readFixture(fixturePath)).not.toThrow();
    }
  });

  test('every fixture with a `pending-*` value is enumerated in the inline blocked-pending-future-step registry', () => {
    const registryRelativePaths = new Set(BLOCKED_FIXTURES_AUTHORITATIVE_REGISTRY.map((entry) => entry.relativePath));
    const fixturePaths = listFixtureRelativePathsSorted();
    let totalFixturesWithPendingValues = 0;
    for (const fixturePath of fixturePaths) {
      const fixtureRoot = readFixture(fixturePath);
      const pendingOccurrences = collectPendingValueOccurrences(fixturePath, fixtureRoot);
      if (pendingOccurrences.length === 0) {
        continue;
      }
      totalFixturesWithPendingValues += 1;
      const inRegistry = registryRelativePaths.has(fixturePath);
      const sampleDiagnostic = `${pendingOccurrences[0]!.jsonPointer} = ${JSON.stringify(pendingOccurrences[0]!.stringValue)}`;
      expect(inRegistry, `fixture has pending-* value but is missing from BLOCKED_FIXTURES_AUTHORITATIVE_REGISTRY: ${fixturePath} (first marker at ${sampleDiagnostic})`).toBe(true);
    }
    expect(totalFixturesWithPendingValues).toBe(BLOCKED_FIXTURES_AUTHORITATIVE_REGISTRY.length);
  });

  test('every BLOCKED_FIXTURES entry has status=blocked-pending-future-step and a followUpStepId pointing at a real plan_final step', () => {
    expect(BLOCKED_FIXTURES_AUTHORITATIVE_REGISTRY.length).toBeGreaterThan(0);
    for (const entry of BLOCKED_FIXTURES_AUTHORITATIVE_REGISTRY) {
      expect(entry.status, `BLOCKED_FIXTURES entry has wrong status: ${entry.relativePath}`).toBe(BLOCKED_STATUS_LITERAL);
      expect(PLAN_FINAL_STEP_ID_REGEX.test(entry.followUpStepId), `BLOCKED_FIXTURES followUpStepId does not match /^\\d{2}-\\d{3}$/: ${entry.relativePath} -> ${entry.followUpStepId}`).toBe(true);
      expect(planFinalStepFileExists(entry.followUpStepId), `BLOCKED_FIXTURES followUpStepId names a non-existent plan_final step file: ${entry.relativePath} -> ${entry.followUpStepId}`).toBe(true);
      expect(entry.rationale.length, `BLOCKED_FIXTURES rationale is empty: ${entry.relativePath}`).toBeGreaterThan(0);
      expect(entry.relativePath.startsWith(`${FIXTURES_DIRECTORY}/`), `BLOCKED_FIXTURES relativePath is outside ${FIXTURES_DIRECTORY}/: ${entry.relativePath}`).toBe(true);
    }
  });

  test('BLOCKED_FIXTURES entries are ASCII-sorted by relativePath and deduplicated', () => {
    const observedRelativePaths = BLOCKED_FIXTURES_AUTHORITATIVE_REGISTRY.map((entry) => entry.relativePath);
    const sortedRelativePaths = [...observedRelativePaths].sort();
    expect(observedRelativePaths).toEqual(sortedRelativePaths);
    expect(new Set(observedRelativePaths).size).toBe(observedRelativePaths.length);
  });

  test('every BLOCKED_FIXTURES entry corresponds to a fixture file that exists on disk and still contains a `pending-*` value', () => {
    for (const entry of BLOCKED_FIXTURES_AUTHORITATIVE_REGISTRY) {
      expect(existsSync(entry.relativePath), `BLOCKED_FIXTURES references missing fixture file: ${entry.relativePath}`).toBe(true);
      const fixtureRoot = readFixture(entry.relativePath);
      const pendingOccurrences = collectPendingValueOccurrences(entry.relativePath, fixtureRoot);
      expect(pendingOccurrences.length, `BLOCKED_FIXTURES enumerates fixture ${entry.relativePath} but it no longer contains any pending-* values; remove the entry or replace with live evidence`).toBeGreaterThan(0);
    }
  });

  test('contract constants describe themselves correctly', () => {
    expect(PLAN_FINAL_STEP_ID_REGEX.test('02-011')).toBe(true);
    expect(PLAN_FINAL_STEP_ID_REGEX.test('00-001')).toBe(true);
    expect(PLAN_FINAL_STEP_ID_REGEX.test('02-11')).toBe(false);
    expect(PLAN_FINAL_STEP_ID_REGEX.test('2-011')).toBe(false);
    expect(BLOCKED_STATUS_LITERAL).toBe('blocked-pending-future-step');
    expect(PENDING_VALUE_PREFIX).toBe('pending-');
  });

  test('the BLOCKED_FIXTURES registry is the structured authority that prevents the final acceptance gate from passing accidentally', () => {
    // Documented contract for follow-up agents: every entry in this registry blocks acceptance until the
    // referenced followUpStepId has replaced the corresponding fixture's pending-* values with live evidence
    // captured from the reference sandbox. The downstream gate step 02-011 (gate-oracle-foundation) must
    // re-read this test, walk the registry, and assert it is empty (or that every entry has been retired).
    expect(BLOCKED_FIXTURES_AUTHORITATIVE_REGISTRY.length).toBeGreaterThan(0);
    expect(BLOCKED_FIXTURES_AUTHORITATIVE_REGISTRY.every((entry) => entry.status === BLOCKED_STATUS_LITERAL)).toBe(true);
    expect(BLOCKED_FIXTURES_AUTHORITATIVE_REGISTRY.every((entry) => entry.followUpStepId.length > 0)).toBe(true);
  });
});
