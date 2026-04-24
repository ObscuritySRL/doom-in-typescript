import { describe, expect, test } from 'bun:test';

import { EMPTY_DEMO_PLAYBACK_SCRIPT, EMPTY_TITLE_LOOP_SCRIPT, INPUT_EVENT_KINDS, MOUSE_BUTTON_MAX, SCANCODE_MAX } from '../../src/oracles/inputScript.ts';
import type { InputEventKind, InputScriptArtifact, InputScriptEvent, InputScriptPayload, KeyDownEvent, KeyUpEvent, MouseButtonDownEvent, MouseButtonUpEvent, MouseMoveEvent, QuitEvent } from '../../src/oracles/inputScript.ts';
import { ORACLE_KINDS } from '../../src/oracles/schema.ts';
import type { OracleArtifact } from '../../src/oracles/schema.ts';
import { PRIMARY_TARGET } from '../../src/reference/target.ts';

describe('INPUT_EVENT_KINDS', () => {
  test('contains exactly 6 event kinds', () => {
    expect(INPUT_EVENT_KINDS).toHaveLength(6);
  });

  test('includes all expected kinds', () => {
    const expected: InputEventKind[] = ['key-down', 'key-up', 'mouse-button-down', 'mouse-button-up', 'mouse-move', 'quit'];
    for (const kind of expected) {
      expect(INPUT_EVENT_KINDS).toContain(kind);
    }
  });

  test('is ASCIIbetically sorted', () => {
    const sorted = [...INPUT_EVENT_KINDS].sort();
    expect(INPUT_EVENT_KINDS).toEqual(sorted);
  });

  test('contains no duplicates', () => {
    const unique = new Set(INPUT_EVENT_KINDS);
    expect(unique.size).toBe(INPUT_EVENT_KINDS.length);
  });

  test('is frozen', () => {
    expect(Object.isFrozen(INPUT_EVENT_KINDS)).toBe(true);
  });
});

describe('constants', () => {
  test('SCANCODE_MAX is 0xFF (single byte range)', () => {
    expect(SCANCODE_MAX).toBe(0xff);
    expect(SCANCODE_MAX).toBe(255);
  });

  test('MOUSE_BUTTON_MAX is 4 (5-button SDL support)', () => {
    expect(MOUSE_BUTTON_MAX).toBe(4);
  });
});

describe('ORACLE_KINDS cross-reference', () => {
  test('input-script is a registered oracle kind', () => {
    expect(ORACLE_KINDS).toContain('input-script');
  });
});

describe('EMPTY_TITLE_LOOP_SCRIPT', () => {
  test('targets title-loop run mode', () => {
    expect(EMPTY_TITLE_LOOP_SCRIPT.targetRunMode).toBe('title-loop');
  });

  test('has zero totalTics (no explicit duration limit)', () => {
    expect(EMPTY_TITLE_LOOP_SCRIPT.totalTics).toBe(0);
  });

  test('has empty events array', () => {
    expect(EMPTY_TITLE_LOOP_SCRIPT.events).toHaveLength(0);
  });

  test('ticRateHz matches PRIMARY_TARGET', () => {
    expect(EMPTY_TITLE_LOOP_SCRIPT.ticRateHz).toBe(PRIMARY_TARGET.ticRateHz);
    expect(EMPTY_TITLE_LOOP_SCRIPT.ticRateHz).toBe(35);
  });

  test('has non-empty description', () => {
    expect(EMPTY_TITLE_LOOP_SCRIPT.description.length).toBeGreaterThan(0);
  });

  test('is frozen at top level and nested events array', () => {
    expect(Object.isFrozen(EMPTY_TITLE_LOOP_SCRIPT)).toBe(true);
    expect(Object.isFrozen(EMPTY_TITLE_LOOP_SCRIPT.events)).toBe(true);
  });
});

describe('EMPTY_DEMO_PLAYBACK_SCRIPT', () => {
  test('targets demo-playback run mode', () => {
    expect(EMPTY_DEMO_PLAYBACK_SCRIPT.targetRunMode).toBe('demo-playback');
  });

  test('has zero totalTics', () => {
    expect(EMPTY_DEMO_PLAYBACK_SCRIPT.totalTics).toBe(0);
  });

  test('has empty events array', () => {
    expect(EMPTY_DEMO_PLAYBACK_SCRIPT.events).toHaveLength(0);
  });

  test('ticRateHz matches PRIMARY_TARGET', () => {
    expect(EMPTY_DEMO_PLAYBACK_SCRIPT.ticRateHz).toBe(PRIMARY_TARGET.ticRateHz);
  });

  test('is frozen at top level and nested events array', () => {
    expect(Object.isFrozen(EMPTY_DEMO_PLAYBACK_SCRIPT)).toBe(true);
    expect(Object.isFrozen(EMPTY_DEMO_PLAYBACK_SCRIPT.events)).toBe(true);
  });
});

describe('InputScriptEvent discriminated union', () => {
  test('key-down event narrows to KeyDownEvent with scanCode', () => {
    const event: InputScriptEvent = {
      tic: 0,
      kind: 'key-down',
      scanCode: 0x39,
    };
    if (event.kind === 'key-down') {
      expect(event.scanCode).toBe(0x39);
    }
  });

  test('key-up event narrows to KeyUpEvent with scanCode', () => {
    const event: InputScriptEvent = {
      tic: 10,
      kind: 'key-up',
      scanCode: 0x39,
    };
    if (event.kind === 'key-up') {
      expect(event.scanCode).toBe(0x39);
    }
  });

  test('mouse-move event narrows to MouseMoveEvent with deltas', () => {
    const event: InputScriptEvent = {
      tic: 5,
      kind: 'mouse-move',
      deltaX: -3,
      deltaY: 7,
    };
    if (event.kind === 'mouse-move') {
      expect(event.deltaX).toBe(-3);
      expect(event.deltaY).toBe(7);
    }
  });

  test('mouse-button-down event narrows to MouseButtonDownEvent', () => {
    const event: InputScriptEvent = {
      tic: 15,
      kind: 'mouse-button-down',
      button: 0,
    };
    if (event.kind === 'mouse-button-down') {
      expect(event.button).toBe(0);
    }
  });

  test('quit event narrows to QuitEvent with no extra fields', () => {
    const event: InputScriptEvent = { tic: 100, kind: 'quit' };
    expect(event.kind).toBe('quit');
    expect(event.tic).toBe(100);
  });
});

describe('InputScriptPayload well-formed acceptance', () => {
  test('accepts a multi-event script with ascending tic order', () => {
    const script: InputScriptPayload = {
      description: 'Test script with multiple event types',
      targetRunMode: 'demo-playback',
      totalTics: 50,
      ticRateHz: 35,
      events: [
        { tic: 0, kind: 'key-down', scanCode: 0xc8 },
        { tic: 5, kind: 'mouse-move', deltaX: 10, deltaY: 0 },
        { tic: 10, kind: 'key-up', scanCode: 0xc8 },
        { tic: 10, kind: 'mouse-button-down', button: 0 },
        { tic: 15, kind: 'mouse-button-up', button: 0 },
        { tic: 49, kind: 'quit' },
      ],
    };
    expect(script.events).toHaveLength(6);
    expect(script.totalTics).toBe(50);
  });

  test('allows multiple events at the same tic', () => {
    const script: InputScriptPayload = {
      description: 'Simultaneous key press and mouse click',
      targetRunMode: 'title-loop',
      totalTics: 10,
      ticRateHz: 35,
      events: [
        { tic: 0, kind: 'key-down', scanCode: 0x39 },
        { tic: 0, kind: 'mouse-button-down', button: 0 },
        { tic: 0, kind: 'mouse-move', deltaX: 5, deltaY: -2 },
      ],
    };
    const tics = script.events.map((event) => event.tic);
    expect(tics).toEqual([0, 0, 0]);
  });
});

describe('parity-sensitive edge cases', () => {
  test('scan code boundary values are representable (0 and SCANCODE_MAX)', () => {
    const minEvent: KeyDownEvent = { tic: 0, kind: 'key-down', scanCode: 0 };
    const maxEvent: KeyUpEvent = {
      tic: 1,
      kind: 'key-up',
      scanCode: SCANCODE_MAX,
    };
    expect(minEvent.scanCode).toBe(0);
    expect(maxEvent.scanCode).toBe(255);
  });

  test('mouse button boundary values are representable (0 and MOUSE_BUTTON_MAX)', () => {
    const leftClick: MouseButtonDownEvent = {
      tic: 0,
      kind: 'mouse-button-down',
      button: 0,
    };
    const extraButton: MouseButtonUpEvent = {
      tic: 1,
      kind: 'mouse-button-up',
      button: MOUSE_BUTTON_MAX,
    };
    expect(leftClick.button).toBe(0);
    expect(extraButton.button).toBe(4);
  });

  test('mouse deltas can be negative (leftward and backward)', () => {
    const event: MouseMoveEvent = {
      tic: 0,
      kind: 'mouse-move',
      deltaX: -100,
      deltaY: -50,
    };
    expect(event.deltaX).toBeLessThan(0);
    expect(event.deltaY).toBeLessThan(0);
  });

  test('quit event can serve as the final event in a bounded script', () => {
    const script: InputScriptPayload = {
      description: 'Script terminated by explicit quit',
      targetRunMode: 'title-loop',
      totalTics: 101,
      ticRateHz: 35,
      events: [
        { tic: 0, kind: 'key-down', scanCode: 0x01 },
        { tic: 100, kind: 'quit' },
      ],
    };
    const lastEvent = script.events[script.events.length - 1];
    expect(lastEvent.kind).toBe('quit');
    expect(lastEvent.tic).toBeLessThan(script.totalTics);
  });
});

describe('compile-time type satisfaction', () => {
  test('InputScriptArtifact wraps InputScriptPayload in OracleArtifact envelope', () => {
    const artifact: InputScriptArtifact = {
      kind: 'input-script',
      version: 1,
      generatedAt: '2026-04-12T00:00:00Z',
      sourceHash: '0'.repeat(64),
      payload: EMPTY_TITLE_LOOP_SCRIPT,
    };
    expect(artifact.kind).toBe('input-script');
    expect(artifact.version).toBe(1);
    expect(artifact.payload).toBe(EMPTY_TITLE_LOOP_SCRIPT);
  });

  test('InputScriptArtifact satisfies OracleArtifact<InputScriptPayload>', () => {
    const artifact: OracleArtifact<InputScriptPayload> = {
      kind: 'input-script',
      version: 1,
      generatedAt: '2026-04-12T00:00:00Z',
      sourceHash: 'A'.repeat(64),
      payload: EMPTY_DEMO_PLAYBACK_SCRIPT,
    };
    expect(artifact.payload.targetRunMode).toBe('demo-playback');
  });
});
