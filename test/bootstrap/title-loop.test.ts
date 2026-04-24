import { describe, expect, it } from 'bun:test';

import type { GameMode } from '../../src/bootstrap/gameMode.ts';
import type { AdvanceAction, DemoAction, PageAction } from '../../src/bootstrap/titleLoop.ts';
import { COMMERCIAL_TITLEPIC_PAGETIC, CYCLE_LENGTH, INTERLUDE_PAGETIC, TITLEPIC_PAGETIC, TitleLoop } from '../../src/bootstrap/titleLoop.ts';
import sequence from '../../reference/manifests/title-sequence.json';

describe('constants', () => {
  it('CYCLE_LENGTH is 6', () => {
    expect(CYCLE_LENGTH).toBe(6);
  });

  it('TITLEPIC_PAGETIC is 170', () => {
    expect(TITLEPIC_PAGETIC).toBe(170);
  });

  it('COMMERCIAL_TITLEPIC_PAGETIC is 35 * 11 = 385', () => {
    expect(COMMERCIAL_TITLEPIC_PAGETIC).toBe(35 * 11);
    expect(COMMERCIAL_TITLEPIC_PAGETIC).toBe(385);
  });

  it('INTERLUDE_PAGETIC is 200', () => {
    expect(INTERLUDE_PAGETIC).toBe(200);
  });
});

describe('construction and initial state', () => {
  it('starts with demosequence -1 matching D_DoomMain initialization', () => {
    const loop = new TitleLoop('shareware');
    expect(loop.demosequence).toBe(-1);
  });

  it('starts with advancedemo true matching D_DoomMain D_AdvanceDemo() call', () => {
    const loop = new TitleLoop('shareware');
    expect(loop.advancedemo).toBe(true);
  });

  it('starts with pagetic 0', () => {
    const loop = new TitleLoop('shareware');
    expect(loop.pagetic).toBe(0);
  });

  it('starts with empty pagename', () => {
    const loop = new TitleLoop('shareware');
    expect(loop.pagename).toBe('');
  });

  it('exposes the game mode', () => {
    const loop = new TitleLoop('shareware');
    expect(loop.gameMode).toBe('shareware');
  });
});

describe('first advance (TITLEPIC)', () => {
  it('advances to demosequence 0', () => {
    const loop = new TitleLoop('shareware');
    loop.doAdvanceDemo();
    expect(loop.demosequence).toBe(0);
  });

  it('returns a page action for TITLEPIC', () => {
    const loop = new TitleLoop('shareware');
    const action = loop.doAdvanceDemo()!;
    expect(action.kind).toBe('page');
    expect((action as PageAction).lumpName).toBe('TITLEPIC');
  });

  it('sets pagetic to 170 for shareware', () => {
    const loop = new TitleLoop('shareware');
    const action = loop.doAdvanceDemo()! as PageAction;
    expect(action.pagetic).toBe(TITLEPIC_PAGETIC);
    expect(loop.pagetic).toBe(TITLEPIC_PAGETIC);
  });

  it('sets musicLump to D_INTRO for non-commercial modes', () => {
    const loop = new TitleLoop('shareware');
    const action = loop.doAdvanceDemo()! as PageAction;
    expect(action.musicLump).toBe('D_INTRO');
  });

  it('clears advancedemo after advancing', () => {
    const loop = new TitleLoop('shareware');
    loop.doAdvanceDemo();
    expect(loop.advancedemo).toBe(false);
  });

  it('sets pagename to TITLEPIC', () => {
    const loop = new TitleLoop('shareware');
    loop.doAdvanceDemo();
    expect(loop.pagename).toBe('TITLEPIC');
  });

  it('returns frozen action', () => {
    const loop = new TitleLoop('shareware');
    const action = loop.doAdvanceDemo()!;
    expect(Object.isFrozen(action)).toBe(true);
  });
});

describe('full shareware cycle', () => {
  function advanceTo(loop: TitleLoop, targetSequence: number): AdvanceAction {
    let action: AdvanceAction | null = null;
    while (loop.demosequence < targetSequence || loop.demosequence === -1) {
      loop.requestAdvance();
      action = loop.doAdvanceDemo();
    }
    return action!;
  }

  it('state 0: TITLEPIC page with D_INTRO music', () => {
    const loop = new TitleLoop('shareware');
    const action = loop.doAdvanceDemo()! as PageAction;
    expect(action.kind).toBe('page');
    expect(action.lumpName).toBe('TITLEPIC');
    expect(action.pagetic).toBe(170);
    expect(action.musicLump).toBe('D_INTRO');
  });

  it('state 1: DEMO1 playback', () => {
    const loop = new TitleLoop('shareware');
    const action = advanceTo(loop, 1) as DemoAction;
    expect(action.kind).toBe('demo');
    expect(action.demoLump).toBe('DEMO1');
  });

  it('state 2: CREDIT page with inherited music', () => {
    const loop = new TitleLoop('shareware');
    const action = advanceTo(loop, 2) as PageAction;
    expect(action.kind).toBe('page');
    expect(action.lumpName).toBe('CREDIT');
    expect(action.pagetic).toBe(200);
    expect(action.musicLump).toBeNull();
  });

  it('state 3: DEMO2 playback', () => {
    const loop = new TitleLoop('shareware');
    const action = advanceTo(loop, 3) as DemoAction;
    expect(action.kind).toBe('demo');
    expect(action.demoLump).toBe('DEMO2');
  });

  it('state 4: HELP2 page for shareware with inherited music', () => {
    const loop = new TitleLoop('shareware');
    const action = advanceTo(loop, 4) as PageAction;
    expect(action.kind).toBe('page');
    expect(action.lumpName).toBe('HELP2');
    expect(action.pagetic).toBe(200);
    expect(action.musicLump).toBeNull();
  });

  it('state 5: DEMO3 playback', () => {
    const loop = new TitleLoop('shareware');
    const action = advanceTo(loop, 5) as DemoAction;
    expect(action.kind).toBe('demo');
    expect(action.demoLump).toBe('DEMO3');
  });

  it('produces exactly 3 page and 3 demo actions per cycle', () => {
    const loop = new TitleLoop('shareware');
    let pageCount = 0;
    let demoCount = 0;
    for (let index = 0; index < CYCLE_LENGTH; index++) {
      loop.requestAdvance();
      const action = loop.doAdvanceDemo()!;
      if (action.kind === 'page') pageCount++;
      if (action.kind === 'demo') demoCount++;
    }
    expect(pageCount).toBe(3);
    expect(demoCount).toBe(3);
  });

  it('alternates page and demo states', () => {
    const loop = new TitleLoop('shareware');
    for (let index = 0; index < CYCLE_LENGTH; index++) {
      loop.requestAdvance();
      const action = loop.doAdvanceDemo()!;
      const expected = index % 2 === 0 ? 'page' : 'demo';
      expect(action.kind).toBe(expected);
    }
  });
});

describe('cycle wrapping', () => {
  it('wraps demosequence back to 0 after state 5', () => {
    const loop = new TitleLoop('shareware');
    for (let index = 0; index < CYCLE_LENGTH; index++) {
      loop.requestAdvance();
      loop.doAdvanceDemo();
    }
    expect(loop.demosequence).toBe(5);
    loop.requestAdvance();
    loop.doAdvanceDemo();
    expect(loop.demosequence).toBe(0);
  });

  it('second cycle produces identical TITLEPIC action', () => {
    const loop = new TitleLoop('shareware');
    const firstAction = loop.doAdvanceDemo()! as PageAction;
    for (let index = 1; index < CYCLE_LENGTH; index++) {
      loop.requestAdvance();
      loop.doAdvanceDemo();
    }
    loop.requestAdvance();
    const secondAction = loop.doAdvanceDemo()! as PageAction;
    expect(secondAction.lumpName).toBe(firstAction.lumpName);
    expect(secondAction.pagetic).toBe(firstAction.pagetic);
    expect(secondAction.musicLump).toBe(firstAction.musicLump);
  });

  it('third full cycle starts at demosequence 0', () => {
    const loop = new TitleLoop('shareware');
    for (let index = 0; index < CYCLE_LENGTH * 2; index++) {
      loop.requestAdvance();
      loop.doAdvanceDemo();
    }
    loop.requestAdvance();
    loop.doAdvanceDemo();
    expect(loop.demosequence).toBe(0);
  });
});

describe('pageTicker', () => {
  it('decrements pagetic by 1', () => {
    const loop = new TitleLoop('shareware');
    loop.doAdvanceDemo();
    const initial = loop.pagetic;
    loop.pageTicker();
    expect(loop.pagetic).toBe(initial - 1);
  });

  it('does not set advancedemo while pagetic >= 0', () => {
    const loop = new TitleLoop('shareware');
    loop.doAdvanceDemo();
    expect(loop.advancedemo).toBe(false);
    loop.pageTicker();
    expect(loop.advancedemo).toBe(false);
    expect(loop.pagetic).toBeGreaterThanOrEqual(0);
  });

  it('sets advancedemo when pagetic drops below 0', () => {
    const loop = new TitleLoop('shareware');
    loop.doAdvanceDemo();
    for (let tic = 0; tic <= TITLEPIC_PAGETIC; tic++) {
      loop.pageTicker();
    }
    expect(loop.pagetic).toBe(-1);
    expect(loop.advancedemo).toBe(true);
  });

  it('requires exactly pagetic+1 calls to trigger advance (--pagetic < 0)', () => {
    const loop = new TitleLoop('shareware');
    loop.doAdvanceDemo();
    const initialPagetic = loop.pagetic;
    for (let tic = 0; tic < initialPagetic; tic++) {
      loop.pageTicker();
      expect(loop.advancedemo).toBe(false);
    }
    loop.pageTicker();
    expect(loop.advancedemo).toBe(true);
  });

  it('matches C pre-decrement semantics: --pagetic < 0', () => {
    const loop = new TitleLoop('shareware');
    loop.doAdvanceDemo();
    let callCount = 0;
    while (!loop.advancedemo) {
      loop.pageTicker();
      callCount++;
    }
    expect(callCount).toBe(TITLEPIC_PAGETIC + 1);
    expect(loop.pagetic).toBe(-1);
  });
});

describe('requestAdvance', () => {
  it('sets advancedemo to true', () => {
    const loop = new TitleLoop('shareware');
    loop.doAdvanceDemo();
    expect(loop.advancedemo).toBe(false);
    loop.requestAdvance();
    expect(loop.advancedemo).toBe(true);
  });

  it('is idempotent', () => {
    const loop = new TitleLoop('shareware');
    loop.doAdvanceDemo();
    loop.requestAdvance();
    loop.requestAdvance();
    expect(loop.advancedemo).toBe(true);
  });
});

describe('doAdvanceDemo with no pending advance', () => {
  it('returns null when advancedemo is false', () => {
    const loop = new TitleLoop('shareware');
    loop.doAdvanceDemo();
    const result = loop.doAdvanceDemo();
    expect(result).toBeNull();
  });

  it('does not change demosequence when advancedemo is false', () => {
    const loop = new TitleLoop('shareware');
    loop.doAdvanceDemo();
    const seq = loop.demosequence;
    loop.doAdvanceDemo();
    expect(loop.demosequence).toBe(seq);
  });
});

describe('retail game mode', () => {
  it('uses D_INTRO music at state 0', () => {
    const loop = new TitleLoop('retail');
    const action = loop.doAdvanceDemo()! as PageAction;
    expect(action.musicLump).toBe('D_INTRO');
  });

  it('uses TITLEPIC_PAGETIC at state 0 (not commercial)', () => {
    const loop = new TitleLoop('retail');
    const action = loop.doAdvanceDemo()! as PageAction;
    expect(action.pagetic).toBe(TITLEPIC_PAGETIC);
  });

  it('uses CREDIT (not HELP2) at state 4', () => {
    const loop = new TitleLoop('retail');
    for (let index = 0; index < 5; index++) {
      loop.requestAdvance();
      loop.doAdvanceDemo();
    }
    expect(loop.demosequence).toBe(4);
    expect(loop.pagename).toBe('CREDIT');
  });
});

describe('registered game mode', () => {
  it('uses HELP2 at state 4 (same as shareware)', () => {
    const loop = new TitleLoop('registered');
    for (let index = 0; index < 5; index++) {
      loop.requestAdvance();
      loop.doAdvanceDemo();
    }
    expect(loop.demosequence).toBe(4);
    expect(loop.pagename).toBe('HELP2');
  });
});

describe('commercial game mode', () => {
  it('uses COMMERCIAL_TITLEPIC_PAGETIC at state 0', () => {
    const loop = new TitleLoop('commercial');
    const action = loop.doAdvanceDemo()! as PageAction;
    expect(action.pagetic).toBe(COMMERCIAL_TITLEPIC_PAGETIC);
    expect(loop.pagetic).toBe(385);
  });

  it('uses D_DM2TTL music at state 0', () => {
    const loop = new TitleLoop('commercial');
    const action = loop.doAdvanceDemo()! as PageAction;
    expect(action.musicLump).toBe('D_DM2TTL');
  });

  it('uses TITLEPIC with D_DM2TTL music at state 4', () => {
    const loop = new TitleLoop('commercial');
    for (let index = 0; index < 5; index++) {
      loop.requestAdvance();
      loop.doAdvanceDemo();
    }
    expect(loop.demosequence).toBe(4);
    expect(loop.pagename).toBe('TITLEPIC');
  });

  it('state 4 returns page action with TITLEPIC and D_DM2TTL', () => {
    const loop = new TitleLoop('commercial');
    let action: AdvanceAction | null = null;
    for (let index = 0; index < 5; index++) {
      loop.requestAdvance();
      action = loop.doAdvanceDemo();
    }
    expect(action!.kind).toBe('page');
    expect((action as PageAction).lumpName).toBe('TITLEPIC');
    expect((action as PageAction).musicLump).toBe('D_DM2TTL');
    expect((action as PageAction).pagetic).toBe(INTERLUDE_PAGETIC);
  });
});

describe('cross-reference with title-sequence.json', () => {
  it('cycle length matches', () => {
    expect(CYCLE_LENGTH).toBe(sequence.cycleLength);
  });

  it('shareware state 0 matches TITLEPIC entry', () => {
    const loop = new TitleLoop('shareware');
    const action = loop.doAdvanceDemo()! as PageAction;
    const state = sequence.states[0]!;
    expect(action.lumpName).toBe(state.lumpName!);
    expect(action.pagetic).toBe(state.durationTics);
    expect(action.musicLump).toBe(state.musicLump);
  });

  it('all 6 shareware states match sequence manifest', () => {
    const loop = new TitleLoop('shareware');
    for (let index = 0; index < CYCLE_LENGTH; index++) {
      loop.requestAdvance();
      const action = loop.doAdvanceDemo()!;
      const state = sequence.states[index]!;
      expect(action.kind).toBe(state.type as 'demo' | 'page');

      if (action.kind === 'page') {
        const pageAction = action as PageAction;
        expect(pageAction.lumpName).toBe(state.lumpName!);
        expect(pageAction.pagetic).toBe(state.durationTics);
        expect(pageAction.musicLump).toBe(state.musicLump);
      } else {
        const demoAction = action as DemoAction;
        expect(demoAction.demoLump).toBe(state.demoLump!);
      }
    }
  });

  it('demo lump names match DEMO1, DEMO2, DEMO3 in order', () => {
    const loop = new TitleLoop('shareware');
    const demoLumps: string[] = [];
    for (let index = 0; index < CYCLE_LENGTH; index++) {
      loop.requestAdvance();
      const action = loop.doAdvanceDemo()!;
      if (action.kind === 'demo') {
        demoLumps.push((action as DemoAction).demoLump);
      }
    }
    expect(demoLumps).toEqual(['DEMO1', 'DEMO2', 'DEMO3']);
  });

  it('page lump names match TITLEPIC, CREDIT, HELP2 for shareware', () => {
    const loop = new TitleLoop('shareware');
    const pageLumps: string[] = [];
    for (let index = 0; index < CYCLE_LENGTH; index++) {
      loop.requestAdvance();
      const action = loop.doAdvanceDemo()!;
      if (action.kind === 'page') {
        pageLumps.push((action as PageAction).lumpName);
      }
    }
    expect(pageLumps).toEqual(['TITLEPIC', 'CREDIT', 'HELP2']);
  });
});

describe('parity-sensitive edge cases', () => {
  it('demosequence wraps via modulo not reset (faithful to C arithmetic)', () => {
    const loop = new TitleLoop('shareware');
    for (let index = 0; index < CYCLE_LENGTH + 1; index++) {
      loop.requestAdvance();
      loop.doAdvanceDemo();
    }
    expect(loop.demosequence).toBe(0);
    expect(loop.demosequence).toBe((CYCLE_LENGTH + 1 - 1) % CYCLE_LENGTH);
  });

  it('pageTicker uses pre-decrement < 0 (not <= 0) matching C --pagetic < 0', () => {
    const loop = new TitleLoop('shareware');
    loop.doAdvanceDemo();
    for (let tic = 0; tic < TITLEPIC_PAGETIC; tic++) {
      loop.pageTicker();
    }
    expect(loop.pagetic).toBe(0);
    expect(loop.advancedemo).toBe(false);
    loop.pageTicker();
    expect(loop.pagetic).toBe(-1);
    expect(loop.advancedemo).toBe(true);
  });

  it('pagetic values are hardcoded not configurable (F-025)', () => {
    const shareware = new TitleLoop('shareware');
    shareware.doAdvanceDemo();
    expect(shareware.pagetic).toBe(170);

    const commercial = new TitleLoop('commercial');
    commercial.doAdvanceDemo();
    expect(commercial.pagetic).toBe(385);
  });

  it('only TITLEPIC explicitly starts music; other pages inherit (F-025)', () => {
    const loop = new TitleLoop('shareware');
    const musicActions: (string | null)[] = [];
    for (let index = 0; index < CYCLE_LENGTH; index++) {
      loop.requestAdvance();
      const action = loop.doAdvanceDemo()!;
      if (action.kind === 'page') {
        musicActions.push((action as PageAction).musicLump);
      }
    }
    expect(musicActions[0]).toBe('D_INTRO');
    expect(musicActions[1]).toBeNull();
    expect(musicActions[2]).toBeNull();
  });

  it('state 4 differs by game mode (F-030: shareware=HELP2, retail=CREDIT, commercial=TITLEPIC)', () => {
    const modes: GameMode[] = ['commercial', 'registered', 'retail', 'shareware'];
    const expectedState4Lumps: Record<string, string> = {
      commercial: 'TITLEPIC',
      registered: 'HELP2',
      retail: 'CREDIT',
      shareware: 'HELP2',
    };
    for (const mode of modes) {
      const loop = new TitleLoop(mode);
      for (let index = 0; index < 5; index++) {
        loop.requestAdvance();
        loop.doAdvanceDemo();
      }
      expect(loop.pagename).toBe(expectedState4Lumps[mode]);
    }
  });

  it('indetermined mode uses HELP2 at state 4 (same as shareware/registered)', () => {
    const loop = new TitleLoop('indetermined');
    for (let index = 0; index < 5; index++) {
      loop.requestAdvance();
      loop.doAdvanceDemo();
    }
    expect(loop.pagename).toBe('HELP2');
  });

  it('demo actions do not modify pagename or pagetic', () => {
    const loop = new TitleLoop('shareware');
    loop.doAdvanceDemo();
    const pageticBefore = loop.pagetic;
    const pagenameBefore = loop.pagename;
    loop.requestAdvance();
    const demoAction = loop.doAdvanceDemo()!;
    expect(demoAction.kind).toBe('demo');
    expect(loop.pagetic).toBe(pageticBefore);
    expect(loop.pagename).toBe(pagenameBefore);
  });

  it('all returned actions are frozen', () => {
    const loop = new TitleLoop('shareware');
    for (let index = 0; index < CYCLE_LENGTH; index++) {
      loop.requestAdvance();
      const action = loop.doAdvanceDemo()!;
      expect(Object.isFrozen(action)).toBe(true);
    }
  });

  it('commercial state 4 pagetic is INTERLUDE_PAGETIC (200) not COMMERCIAL_TITLEPIC_PAGETIC (385)', () => {
    const loop = new TitleLoop('commercial');
    let action: AdvanceAction | null = null;
    for (let index = 0; index < 5; index++) {
      loop.requestAdvance();
      action = loop.doAdvanceDemo();
    }
    expect((action as PageAction).pagetic).toBe(INTERLUDE_PAGETIC);
    expect(loop.pagetic).toBe(200);
  });
});
