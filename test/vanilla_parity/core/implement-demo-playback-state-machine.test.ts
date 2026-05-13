import { describe, expect, test } from 'bun:test';

import { VANILLA_DEMO_PLAYBACK_PHASES, stepDemoPlayback } from '../../../src/core/implement-demo-playback-state-machine.ts';

describe('vanilla demo playback state machine', () => {
  test('five phases, sorted, unique', () => {
    expect(VANILLA_DEMO_PLAYBACK_PHASES).toEqual(['error', 'idle', 'loading', 'playing', 'stopped']);
    expect(new Set(VANILLA_DEMO_PLAYBACK_PHASES).size).toBe(VANILLA_DEMO_PLAYBACK_PHASES.length);
  });

  test('idle + load_demo -> loading', () => {
    expect(stepDemoPlayback({ currentPhase: 'idle', event: 'load_demo' })).toBe('loading');
  });

  test('loading + start_playback -> playing', () => {
    expect(stepDemoPlayback({ currentPhase: 'loading', event: 'start_playback' })).toBe('playing');
  });

  test('loading + header_parse_failed -> error', () => {
    expect(stepDemoPlayback({ currentPhase: 'loading', event: 'header_parse_failed' })).toBe('error');
  });

  test('playing + tick_advance stays in playing', () => {
    expect(stepDemoPlayback({ currentPhase: 'playing', event: 'tick_advance' })).toBe('playing');
  });

  test('playing + reach_terminator -> stopped', () => {
    expect(stepDemoPlayback({ currentPhase: 'playing', event: 'reach_terminator' })).toBe('stopped');
  });

  test('playing + ticcmd_parse_failed -> error', () => {
    expect(stepDemoPlayback({ currentPhase: 'playing', event: 'ticcmd_parse_failed' })).toBe('error');
  });

  test('playing + request_stop -> stopped', () => {
    expect(stepDemoPlayback({ currentPhase: 'playing', event: 'request_stop' })).toBe('stopped');
  });

  test('terminal phases (error, stopped) are sticky on unrelated events', () => {
    expect(stepDemoPlayback({ currentPhase: 'error', event: 'tick_advance' })).toBe('error');
    expect(stepDemoPlayback({ currentPhase: 'stopped', event: 'tick_advance' })).toBe('stopped');
  });
});
