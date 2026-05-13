import { describe, expect, test } from 'bun:test';

import { INPUT_EVENT_KINDS, MOUSE_BUTTON_MAX, SCANCODE_MAX } from '../../../src/oracles/inputScript.ts';
import format from './define-deterministic-input-stream-format.json';

const STEP_FILE_PATH = 'plan_vanilla_parity/steps/02-009-define-deterministic-input-stream-format.md';
const EVENT_KIND_PATTERN = /^[a-z][a-z0-9-]*[a-z]$/;

describe('format identity and metadata', () => {
  test('declares OR-VP-INPUT-FORMAT-009 oracle id, step 02-009, and oracle lane', () => {
    expect(format.id).toBe('OR-VP-INPUT-FORMAT-009');
    expect(format.stepId).toBe('02-009');
    expect(format.stepTitle).toBe('Define Deterministic Input Stream Format');
    expect(format.lane).toBe('oracle');
  });

  test('points to the existing source module src/oracles/inputScript.ts', () => {
    expect(format.sourceModule).toBe('src/oracles/inputScript.ts');
  });
});

describe('event kinds match the source-level INPUT_EVENT_KINDS', () => {
  test('JSON event kinds equal the source-level list, in order', () => {
    expect(format.eventKinds).toEqual([...INPUT_EVENT_KINDS]);
  });

  test('event kinds are sorted, unique, and match the kebab-case pattern', () => {
    expect([...format.eventKinds].sort()).toEqual([...format.eventKinds]);
    expect(new Set(format.eventKinds).size).toBe(format.eventKinds.length);
    for (const kind of format.eventKinds) {
      expect(kind).toMatch(EVENT_KIND_PATTERN);
    }
  });
});

describe('value range bounds match source-level constants', () => {
  test('scan code range is [0, SCANCODE_MAX]', () => {
    expect(format.scanCodeMin).toBe(0);
    expect(format.scanCodeMax).toBe(SCANCODE_MAX);
    expect(format.scanCodeMax).toBe(255);
  });

  test('mouse button range is [0, MOUSE_BUTTON_MAX]', () => {
    expect(format.mouseButtonMin).toBe(0);
    expect(format.mouseButtonMax).toBe(MOUSE_BUTTON_MAX);
    expect(format.mouseButtonMax).toBe(4);
  });
});

describe('event payload schema covers every declared event kind', () => {
  test('eventPayloads has a key for every event kind', () => {
    const payloadKeys = new Set(Object.keys(format.eventPayloads));
    expect(payloadKeys.size).toBe(format.eventKinds.length);
    for (const kind of format.eventKinds) {
      expect(payloadKeys.has(kind)).toBe(true);
    }
  });

  test('every payload declaration includes tic and kind as the first two fields', () => {
    for (const fieldList of Object.values(format.eventPayloads)) {
      expect(Array.isArray(fieldList)).toBe(true);
      expect((fieldList as readonly string[]).length).toBeGreaterThanOrEqual(2);
      expect((fieldList as readonly string[])[0]).toBe('tic');
      expect((fieldList as readonly string[])[1]).toBe('kind');
    }
  });

  test('mouse-move payload includes deltaX and deltaY', () => {
    const moveFields = format.eventPayloads['mouse-move'] as readonly string[];
    expect(moveFields).toContain('deltaX');
    expect(moveFields).toContain('deltaY');
  });
});

describe('alignment with plan_vanilla_parity step 02-009', () => {
  test('step file write lock pins the format json and test paths to the oracle lane', async () => {
    const stepFileText = await Bun.file(STEP_FILE_PATH).text();
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/define-deterministic-input-stream-format.json');
    expect(stepFileText).toContain('- test/vanilla_parity/oracles/define-deterministic-input-stream-format.test.ts');
    expect(stepFileText).toContain('\n## lane\n\noracle\n');
  });
});

describe('failure-mode validation invariants', () => {
  test('event kind pattern rejects malformed names', () => {
    expect('KeyDown').not.toMatch(EVENT_KIND_PATTERN);
    expect('key_down').not.toMatch(EVENT_KIND_PATTERN);
    expect('-leading').not.toMatch(EVENT_KIND_PATTERN);
    expect('trailing-').not.toMatch(EVENT_KIND_PATTERN);
  });

  test('tic anchor origin is 0-based, not 1-based', () => {
    expect(format.ticAnchorOrigin).toBe('0-based');
  });

  test('event ordering rule is non-decreasing tic with stable insertion order', () => {
    expect(format.eventOrderingRule).toBe('non-decreasing-tic-then-stable-insertion-order');
  });
});
