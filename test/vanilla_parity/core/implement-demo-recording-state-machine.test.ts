import { describe, expect, test } from 'bun:test';

import { VANILLA_DEMO_RECORDING_PHASES, stepDemoRecording } from '../../../src/core/implement-demo-recording-state-machine.ts';

describe('vanilla demo recording state machine', () => {
  test('four phases, sorted, unique', () => {
    expect(VANILLA_DEMO_RECORDING_PHASES).toEqual(['error', 'finalized', 'idle', 'writing']);
    expect(new Set(VANILLA_DEMO_RECORDING_PHASES).size).toBe(VANILLA_DEMO_RECORDING_PHASES.length);
  });

  test('idle + request_record -> writing', () => {
    expect(stepDemoRecording({ currentPhase: 'idle', event: 'request_record' })).toBe('writing');
  });

  test('idle + unsupported_flag_combo -> error', () => {
    expect(stepDemoRecording({ currentPhase: 'idle', event: 'unsupported_flag_combo' })).toBe('error');
  });

  test('writing + append_ticcmd stays in writing', () => {
    expect(stepDemoRecording({ currentPhase: 'writing', event: 'append_ticcmd' })).toBe('writing');
  });

  test('writing + finalize_demo -> finalized', () => {
    expect(stepDemoRecording({ currentPhase: 'writing', event: 'finalize_demo' })).toBe('finalized');
  });

  test('writing + write_failed -> error', () => {
    expect(stepDemoRecording({ currentPhase: 'writing', event: 'write_failed' })).toBe('error');
  });

  test('terminal phases are sticky on unrelated events', () => {
    expect(stepDemoRecording({ currentPhase: 'error', event: 'append_ticcmd' })).toBe('error');
    expect(stepDemoRecording({ currentPhase: 'finalized', event: 'append_ticcmd' })).toBe('finalized');
  });
});
