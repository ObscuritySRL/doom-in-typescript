import { describe, expect, test } from 'bun:test';

import { VANILLA_ATTRACT_LOOP_SEQUENCE, VANILLA_PAGE_TIME_TICS, decideLaunchOutcome } from '../../../src/bootstrap/implement-clean-launch-to-title-loop.ts';

describe('vanilla clean launch to title loop contract', () => {
  test('attract loop sequence pins titlepic/demo1/credit/demo2/titlepic/demo3', () => {
    expect(VANILLA_ATTRACT_LOOP_SEQUENCE).toEqual(['titlepic', 'demo1', 'credit', 'demo2', 'titlepic', 'demo3']);
  });

  test('PAGETIME is 200 tics (vanilla d_main.c)', () => {
    expect(VANILLA_PAGE_TIME_TICS).toBe(200);
  });

  test('clean launch (no args) decides title-loop', () => {
    expect(decideLaunchOutcome({ fileArg: null, warpArg: null, loadgameArg: null, playdemoArg: null })).toBe('title-loop');
  });

  test('-warp E1M2 decides warped-into-map', () => {
    expect(decideLaunchOutcome({ fileArg: null, warpArg: '1 2', loadgameArg: null, playdemoArg: null })).toBe('warped-into-map');
  });

  test('-loadgame 0 decides loaded-game', () => {
    expect(decideLaunchOutcome({ fileArg: null, warpArg: null, loadgameArg: '0', playdemoArg: null })).toBe('loaded-game');
  });

  test('-playdemo demo1 decides played-demo', () => {
    expect(decideLaunchOutcome({ fileArg: null, warpArg: null, loadgameArg: null, playdemoArg: 'demo1' })).toBe('played-demo');
  });

  test('warp takes precedence over loadgame and playdemo', () => {
    expect(decideLaunchOutcome({ fileArg: null, warpArg: '1 1', loadgameArg: '0', playdemoArg: 'demo1' })).toBe('warped-into-map');
  });
});
