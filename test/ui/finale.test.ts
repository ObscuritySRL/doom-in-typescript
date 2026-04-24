import { describe, expect, it } from 'bun:test';

import {
  BUNNY_SCROLL_LUMPS,
  E1_FLAT,
  E1_TEXT,
  E2_ART_LUMP,
  E2_FLAT,
  E2_TEXT,
  E3_FLAT,
  E3_TEXT,
  E4_ART_LUMP,
  E4_FLAT,
  E4_TEXT,
  FINALE_CAST_MAP,
  FINALE_COMMERCIAL_SKIP_DELAY,
  FINALE_TEXT_START_DELAY,
  FinaleStage,
  MAXPLAYERS,
  TEXTSPEED,
  TEXTWAIT,
  createFinaleState,
  getFinaleScreen,
  getVisibleCharacterCount,
  startFinale,
  tickFinale,
} from '../../src/ui/finale.ts';

import type { FinaleInput, FinaleState, FinaleTickResult } from '../../src/ui/finale.ts';

// ── Helpers ──────────────────────────────────────────────────────────

function sharewareInput(): FinaleInput {
  return { anyButtonPressed: false, gameMode: 'shareware', mapNumber: 8 };
}

function commercialInput(mapNumber: number, anyButtonPressed: boolean): FinaleInput {
  return { anyButtonPressed, gameMode: 'commercial', mapNumber };
}

function tickN(state: FinaleState, n: number, input: FinaleInput = sharewareInput()): FinaleTickResult[] {
  const results: FinaleTickResult[] = [];
  for (let i = 0; i < n; i++) results.push(tickFinale(state, input));
  return results;
}

// ── Constants ────────────────────────────────────────────────────────

describe('finale constants', () => {
  it('TEXTSPEED is 3', () => {
    expect(TEXTSPEED).toBe(3);
  });

  it('TEXTWAIT is 250', () => {
    expect(TEXTWAIT).toBe(250);
  });

  it('FINALE_TEXT_START_DELAY is 10', () => {
    expect(FINALE_TEXT_START_DELAY).toBe(10);
  });

  it('FINALE_COMMERCIAL_SKIP_DELAY is 50', () => {
    expect(FINALE_COMMERCIAL_SKIP_DELAY).toBe(50);
  });

  it('FINALE_CAST_MAP is 30', () => {
    expect(FINALE_CAST_MAP).toBe(30);
  });

  it('MAXPLAYERS is 4', () => {
    expect(MAXPLAYERS).toBe(4);
  });

  it('FinaleStage enum matches vanilla finalestage_t', () => {
    expect(FinaleStage.Text).toBe(0);
    expect(FinaleStage.ArtScreen).toBe(1);
    expect(FinaleStage.Cast).toBe(2);
  });

  it('per-episode flats match vanilla F_StartFinale dispatch', () => {
    expect(E1_FLAT).toBe('FLOOR4_8');
    expect(E2_FLAT).toBe('SFLR6_1');
    expect(E3_FLAT).toBe('MFLR8_4');
    expect(E4_FLAT).toBe('MFLR8_3');
  });

  it('art-screen lumps match vanilla episode 2 / 4 dispatch', () => {
    expect(E2_ART_LUMP).toBe('VICTORY2');
    expect(E4_ART_LUMP).toBe('ENDPIC');
  });

  it('bunny scroll lumps are PFUB1 + PFUB2 in order', () => {
    expect(BUNNY_SCROLL_LUMPS).toEqual(['PFUB1', 'PFUB2']);
  });

  it('BUNNY_SCROLL_LUMPS is frozen', () => {
    expect(Object.isFrozen(BUNNY_SCROLL_LUMPS)).toBe(true);
  });

  it('E1_TEXT preserves the double-space after "Deimos base."', () => {
    expect(E1_TEXT).toContain('Deimos base.  Looks like');
  });

  it('E2_TEXT preserves the double-space in "down to  the surface"', () => {
    expect(E2_TEXT).toContain('down to  the surface');
  });

  it('E4_TEXT is all lowercase (retro styling)', () => {
    const firstChar = E4_TEXT.charAt(0);
    expect(firstChar).toBe(firstChar.toLowerCase());
    expect(E4_TEXT.startsWith('the spider mastermind')).toBe(true);
    expect(E4_TEXT).toContain('potential pain and gibbitude');
    expect(E4_TEXT.endsWith('next stop, hell on earth!')).toBe(true);
  });
});

// ── getFinaleScreen ──────────────────────────────────────────────────

describe('getFinaleScreen', () => {
  it('returns episode 1 screen with FLOOR4_8 + E1TEXT + no art', () => {
    const s = getFinaleScreen(1);
    expect(s.episode).toBe(1);
    expect(s.flat).toBe(E1_FLAT);
    expect(s.text).toBe(E1_TEXT);
    expect(s.artLump).toBeNull();
    expect(s.bunnyScroll).toBe(false);
    expect(s.startMusic).toBe('mus_victor');
    expect(s.artScreenMusic).toBeNull();
  });

  it('returns episode 2 screen with VICTORY2 art', () => {
    const s = getFinaleScreen(2);
    expect(s.flat).toBe(E2_FLAT);
    expect(s.text).toBe(E2_TEXT);
    expect(s.artLump).toBe(E2_ART_LUMP);
    expect(s.bunnyScroll).toBe(false);
    expect(s.artScreenMusic).toBeNull();
  });

  it('returns episode 3 screen with bunny scroll + mus_bunny transition', () => {
    const s = getFinaleScreen(3);
    expect(s.flat).toBe(E3_FLAT);
    expect(s.text).toBe(E3_TEXT);
    expect(s.artLump).toBeNull();
    expect(s.bunnyScroll).toBe(true);
    expect(s.startMusic).toBe('mus_victor');
    expect(s.artScreenMusic).toBe('mus_bunny');
  });

  it('returns episode 4 screen with ENDPIC art', () => {
    const s = getFinaleScreen(4);
    expect(s.flat).toBe(E4_FLAT);
    expect(s.text).toBe(E4_TEXT);
    expect(s.artLump).toBe(E4_ART_LUMP);
    expect(s.bunnyScroll).toBe(false);
  });

  it('rejects non-integer, zero, negative, or out-of-range episodes', () => {
    expect(() => getFinaleScreen(0)).toThrow(RangeError);
    expect(() => getFinaleScreen(-1)).toThrow(RangeError);
    expect(() => getFinaleScreen(5)).toThrow(RangeError);
    expect(() => getFinaleScreen(1.5)).toThrow(RangeError);
    expect(() => getFinaleScreen(Number.NaN)).toThrow(RangeError);
  });

  it('returned screen object is frozen (mutation protected)', () => {
    const s = getFinaleScreen(1);
    expect(Object.isFrozen(s)).toBe(true);
  });
});

// ── createFinaleState ────────────────────────────────────────────────

describe('createFinaleState', () => {
  it('returns an inert state (not active, Text stage, count 0, no screen)', () => {
    const state = createFinaleState();
    expect(state.active).toBe(false);
    expect(state.stage).toBe(FinaleStage.Text);
    expect(state.finalecount).toBe(0);
    expect(state.screen).toBeNull();
  });

  it('fresh states are independent', () => {
    const a = createFinaleState();
    const b = createFinaleState();
    a.active = true;
    a.finalecount = 99;
    expect(b.active).toBe(false);
    expect(b.finalecount).toBe(0);
  });
});

// ── startFinale ──────────────────────────────────────────────────────

describe('startFinale', () => {
  it('arms the state with the episode 1 screen + mus_victor music', () => {
    const state = createFinaleState();
    const result = startFinale(state, { episode: 1 });
    expect(state.active).toBe(true);
    expect(state.stage).toBe(FinaleStage.Text);
    expect(state.finalecount).toBe(0);
    expect(state.screen).not.toBeNull();
    expect(state.screen?.episode).toBe(1);
    expect(result.music).toBe('mus_victor');
    expect(result.screen).toBe(state.screen!);
  });

  it('resets finalecount and stage even when restarting from an in-progress state', () => {
    const state = createFinaleState();
    startFinale(state, { episode: 1 });
    state.finalecount = 123;
    const dirtyStage: FinaleStage = FinaleStage.ArtScreen;
    state.stage = dirtyStage;

    startFinale(state, { episode: 2 });
    expect(state.finalecount).toBe(0);
    expect(state.stage as FinaleStage).toBe(FinaleStage.Text);
    expect(state.screen?.episode).toBe(2);
  });

  it('each valid episode (1..4) yields a distinct screen', () => {
    for (const episode of [1, 2, 3, 4]) {
      const state = createFinaleState();
      startFinale(state, { episode });
      expect(state.screen?.episode).toBe(episode);
    }
  });

  it('rejects invalid episode with RangeError', () => {
    const state = createFinaleState();
    expect(() => startFinale(state, { episode: 0 })).toThrow(RangeError);
    expect(() => startFinale(state, { episode: 5 })).toThrow(RangeError);
  });
});

// ── tickFinale: inactive no-op ──────────────────────────────────────

describe('tickFinale when inactive', () => {
  it('returns all-defaults and does not mutate state', () => {
    const state = createFinaleState();
    const r = tickFinale(state, sharewareInput());
    expect(r.stageChanged).toBe(false);
    expect(r.music).toBeNull();
    expect(r.wipeRequested).toBe(false);
    expect(r.worldDone).toBe(false);
    expect(r.startCast).toBe(false);
    expect(state.finalecount).toBe(0);
    expect(state.active).toBe(false);
  });
});

// ── tickFinale: Text stage counter ──────────────────────────────────

describe('tickFinale Text stage counter', () => {
  it('pre-increments finalecount each tick starting from 0 → 1 → 2 → ...', () => {
    const state = createFinaleState();
    startFinale(state, { episode: 1 });
    expect(state.finalecount).toBe(0);

    tickFinale(state, sharewareInput());
    expect(state.finalecount).toBe(1);

    tickFinale(state, sharewareInput());
    expect(state.finalecount).toBe(2);

    tickN(state, 8);
    expect(state.finalecount).toBe(10);
  });

  it('does not change stage while below threshold', () => {
    const state = createFinaleState();
    startFinale(state, { episode: 1 });
    tickN(state, 100);
    expect(state.stage).toBe(FinaleStage.Text);
  });
});

// ── Visible character count ─────────────────────────────────────────

describe('getVisibleCharacterCount', () => {
  it('is 0 when state is inactive', () => {
    const state = createFinaleState();
    expect(getVisibleCharacterCount(state)).toBe(0);
  });

  it('is 0 for the first 10 tics (lead-in delay)', () => {
    const state = createFinaleState();
    startFinale(state, { episode: 1 });
    for (let i = 0; i < 10; i++) {
      tickFinale(state, sharewareInput());
      expect(getVisibleCharacterCount(state)).toBe(0);
    }
  });

  it('advances by 1 character every TEXTSPEED=3 tics after the lead-in', () => {
    const state = createFinaleState();
    startFinale(state, { episode: 1 });
    // After 10 lead-in tics + 3 typing tics: count === 13, visible = (13-10)/3 = 1
    tickN(state, 10);
    expect(getVisibleCharacterCount(state)).toBe(0);

    tickN(state, 3);
    expect(state.finalecount).toBe(13);
    expect(getVisibleCharacterCount(state)).toBe(1);

    tickN(state, 3);
    expect(state.finalecount).toBe(16);
    expect(getVisibleCharacterCount(state)).toBe(2);

    tickN(state, 3);
    expect(state.finalecount).toBe(19);
    expect(getVisibleCharacterCount(state)).toBe(3);
  });

  it('truncates (finalecount - 10) / TEXTSPEED toward zero on fractional tics', () => {
    const state = createFinaleState();
    startFinale(state, { episode: 1 });
    // At finalecount = 11: (11-10)/3 = 0.33 → 0
    // At finalecount = 12: (12-10)/3 = 0.66 → 0
    // At finalecount = 13: (13-10)/3 = 1.00 → 1
    tickN(state, 11);
    expect(getVisibleCharacterCount(state)).toBe(0);
    tickFinale(state, sharewareInput()); // 12
    expect(getVisibleCharacterCount(state)).toBe(0);
    tickFinale(state, sharewareInput()); // 13
    expect(getVisibleCharacterCount(state)).toBe(1);
  });

  it('clamps to strlen(text) once all characters are visible', () => {
    const state = createFinaleState();
    startFinale(state, { episode: 1 });
    const textLen = E1_TEXT.length;
    // After strlen*TEXTSPEED + 10 tics: all characters should be visible.
    const fullyVisibleTic = textLen * TEXTSPEED + FINALE_TEXT_START_DELAY;
    tickN(state, fullyVisibleTic);
    expect(getVisibleCharacterCount(state)).toBe(textLen);
  });

  it('is 0 once stage has advanced to ArtScreen', () => {
    const state = createFinaleState();
    startFinale(state, { episode: 1 });
    const threshold = E1_TEXT.length * TEXTSPEED + TEXTWAIT;
    tickN(state, threshold + 1);
    expect(state.stage).toBe(FinaleStage.ArtScreen);
    expect(getVisibleCharacterCount(state)).toBe(0);
  });
});

// ── TEXT → ARTSCREEN transition ─────────────────────────────────────

describe('TEXT → ARTSCREEN transition', () => {
  it('fires on the first tick where finalecount > strlen*TEXTSPEED+TEXTWAIT', () => {
    const state = createFinaleState();
    startFinale(state, { episode: 1 });
    const threshold = E1_TEXT.length * TEXTSPEED + TEXTWAIT;

    // Advance exactly `threshold` tics: finalecount = threshold; condition
    // is `> threshold` so no transition yet.
    for (let i = 0; i < threshold; i++) {
      const r = tickFinale(state, sharewareInput());
      expect(r.stageChanged).toBe(false);
    }
    expect(state.stage).toBe(FinaleStage.Text);
    expect(state.finalecount).toBe(threshold);

    // One more tic: finalecount = threshold + 1 > threshold → transition.
    const r = tickFinale(state, sharewareInput());
    expect(r.stageChanged).toBe(true);
    expect(state.stage).toBe(FinaleStage.ArtScreen);
    expect(state.finalecount).toBe(0);
  });

  it('requests a screen wipe on transition', () => {
    const state = createFinaleState();
    startFinale(state, { episode: 1 });
    const threshold = E1_TEXT.length * TEXTSPEED + TEXTWAIT;
    tickN(state, threshold);
    const r = tickFinale(state, sharewareInput());
    expect(r.wipeRequested).toBe(true);
  });

  it('does NOT emit music for episodes 1/2/4', () => {
    for (const episode of [1, 2, 4]) {
      const state = createFinaleState();
      startFinale(state, { episode });
      const threshold = state.screen!.text.length * TEXTSPEED + TEXTWAIT;
      tickN(state, threshold);
      const r = tickFinale(state, sharewareInput());
      expect(r.stageChanged).toBe(true);
      expect(r.music).toBeNull();
    }
  });

  it('emits mus_bunny on transition for episode 3', () => {
    const state = createFinaleState();
    startFinale(state, { episode: 3 });
    const threshold = E3_TEXT.length * TEXTSPEED + TEXTWAIT;
    tickN(state, threshold);
    const r = tickFinale(state, sharewareInput());
    expect(r.stageChanged).toBe(true);
    expect(r.music).toBe('mus_bunny');
  });

  it('after transition, subsequent ticks increment finalecount again (from 1)', () => {
    const state = createFinaleState();
    startFinale(state, { episode: 1 });
    const threshold = E1_TEXT.length * TEXTSPEED + TEXTWAIT;
    tickN(state, threshold + 1);
    expect(state.finalecount).toBe(0);

    tickFinale(state, sharewareInput());
    expect(state.finalecount).toBe(1);
    expect(state.stage).toBe(FinaleStage.ArtScreen);

    tickFinale(state, sharewareInput());
    expect(state.finalecount).toBe(2);
  });

  it('stageChanged is false after the initial transition tick', () => {
    const state = createFinaleState();
    startFinale(state, { episode: 1 });
    const threshold = E1_TEXT.length * TEXTSPEED + TEXTWAIT;
    tickN(state, threshold + 1); // transition tick
    const r = tickFinale(state, sharewareInput());
    expect(r.stageChanged).toBe(false);
  });
});

// ── Shareware button presses are ignored ────────────────────────────

describe('shareware game mode ignores button presses', () => {
  it('does NOT skip on attack/use press (no Doom 1 finale responder)', () => {
    const state = createFinaleState();
    startFinale(state, { episode: 1 });

    const input: FinaleInput = {
      anyButtonPressed: true,
      gameMode: 'shareware',
      mapNumber: 8,
    };

    for (let i = 0; i < 200; i++) {
      const r = tickFinale(state, input);
      expect(r.worldDone).toBe(false);
      expect(r.startCast).toBe(false);
    }
    expect(state.active).toBe(true);
    expect(state.stage).toBe(FinaleStage.Text);
  });
});

// ── Commercial skip gate ────────────────────────────────────────────

describe('commercial-mode skip', () => {
  it('ignores button presses while finalecount <= FINALE_COMMERCIAL_SKIP_DELAY', () => {
    const state = createFinaleState();
    startFinale(state, { episode: 1 });

    for (let i = 0; i < FINALE_COMMERCIAL_SKIP_DELAY; i++) {
      const r = tickFinale(state, commercialInput(5, true));
      expect(r.worldDone).toBe(false);
      expect(r.startCast).toBe(false);
    }
    expect(state.active).toBe(true);
    expect(state.finalecount).toBe(FINALE_COMMERCIAL_SKIP_DELAY);
  });

  it('fires worldDone on non-cast commercial map after 50-tic delay', () => {
    const state = createFinaleState();
    startFinale(state, { episode: 1 });
    // Skip 51 tics without button press, then press on tic 52.
    tickN(state, FINALE_COMMERCIAL_SKIP_DELAY + 1, commercialInput(5, false));
    expect(state.finalecount).toBe(FINALE_COMMERCIAL_SKIP_DELAY + 1);
    const r = tickFinale(state, commercialInput(5, true));
    expect(r.worldDone).toBe(true);
    expect(r.startCast).toBe(false);
    expect(state.active).toBe(false);
  });

  it('fires startCast on MAP30 after 50-tic delay', () => {
    const state = createFinaleState();
    startFinale(state, { episode: 1 });
    tickN(state, FINALE_COMMERCIAL_SKIP_DELAY + 1, commercialInput(FINALE_CAST_MAP, false));
    const r = tickFinale(state, commercialInput(FINALE_CAST_MAP, true));
    expect(r.startCast).toBe(true);
    expect(r.worldDone).toBe(false);
    expect(state.stage).toBe(FinaleStage.Cast);
    expect(state.finalecount).toBe(0);
    expect(state.active).toBe(true);
  });

  it('no button pressed: no skip even after 50-tic delay', () => {
    const state = createFinaleState();
    startFinale(state, { episode: 1 });
    for (let i = 0; i < 200; i++) {
      const r = tickFinale(state, commercialInput(5, false));
      expect(r.worldDone).toBe(false);
      expect(r.startCast).toBe(false);
    }
  });
});

// ── End-to-end Doom 1 E1M8 finale ────────────────────────────────────

describe('end-to-end Doom 1 episode 1 finale', () => {
  it('types the full text, then auto-advances to ArtScreen, then idles forever', () => {
    const state = createFinaleState();
    const startResult = startFinale(state, { episode: 1 });
    expect(startResult.music).toBe('mus_victor');
    expect(state.screen?.flat).toBe('FLOOR4_8');

    // Lead-in: 10 tics with 0 visible.
    tickN(state, 10);
    expect(getVisibleCharacterCount(state)).toBe(0);

    // Type the full text: takes strlen * TEXTSPEED tics after lead-in.
    const textLen = E1_TEXT.length;
    tickN(state, textLen * TEXTSPEED);
    expect(getVisibleCharacterCount(state)).toBe(textLen);
    expect(state.finalecount).toBe(FINALE_TEXT_START_DELAY + textLen * TEXTSPEED);

    // Post-text pause: the transition fires on `finalecount > threshold`
    // where threshold = strlen*TEXTSPEED + TEXTWAIT.  After lead-in +
    // typing we're at finalecount = 10 + strlen*TEXTSPEED, so the remaining
    // pause is TEXTWAIT - 10 = 240 tics (the 10-tic lead-in ate into the
    // wait window).  One more tic after that fires the transition.
    const remainingPause = TEXTWAIT - FINALE_TEXT_START_DELAY;
    tickN(state, remainingPause);
    expect(state.stage).toBe(FinaleStage.Text);
    expect(state.finalecount).toBe(textLen * TEXTSPEED + TEXTWAIT);

    // One more tic → transition.
    const transitionResult = tickFinale(state, sharewareInput());
    expect(transitionResult.stageChanged).toBe(true);
    expect(transitionResult.wipeRequested).toBe(true);
    expect(transitionResult.music).toBeNull();
    expect(state.stage).toBe(FinaleStage.ArtScreen);

    // Idle forever on ArtScreen (shareware has no next episode).
    for (let i = 0; i < 500; i++) {
      const r = tickFinale(state, sharewareInput());
      expect(r.stageChanged).toBe(false);
      expect(r.worldDone).toBe(false);
    }
    expect(state.stage).toBe(FinaleStage.ArtScreen);
    expect(state.finalecount).toBe(500);
    expect(state.active).toBe(true);
  });

  it('episode 3 swaps music to mus_bunny on the transition tick', () => {
    const state = createFinaleState();
    startFinale(state, { episode: 3 });
    const threshold = E3_TEXT.length * TEXTSPEED + TEXTWAIT;
    tickN(state, threshold);
    const r = tickFinale(state, sharewareInput());
    expect(r.stageChanged).toBe(true);
    expect(r.music).toBe('mus_bunny');
    // Subsequent tics don't re-emit.
    const r2 = tickFinale(state, sharewareInput());
    expect(r2.music).toBeNull();
  });
});
