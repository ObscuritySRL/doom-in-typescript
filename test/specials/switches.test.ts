import { describe, expect, it } from 'bun:test';

import type { GameMode } from '../../src/bootstrap/gameMode.ts';
import type { Button, SwitchCallbacks, SwitchLine, SwitchSide, SwitchTexturePair } from '../../src/specials/switches.ts';
import {
  ALPH_SWITCH_LIST,
  BUTTONTIME,
  ButtonWhere,
  EXIT_SWITCH_SPECIAL,
  MAXBUTTONS,
  MAXSWITCHES,
  SFX_SWTCHN,
  SFX_SWTCHX,
  changeSwitchTexture,
  createButtonList,
  initSwitchList,
  resetButton,
  startButton,
  switchEpisodeForGameMode,
  updateButtons,
} from '../../src/specials/switches.ts';

// ── Harness helpers ─────────────────────────────────────────────────

interface SoundEvent {
  readonly origin: unknown;
  readonly sfx: number;
}

function makeHarness(): { callbacks: SwitchCallbacks; sounds: SoundEvent[] } {
  const sounds: SoundEvent[] = [];
  return {
    callbacks: {
      startSound(origin: unknown, sfx: number) {
        sounds.push({ origin, sfx });
      },
    },
    sounds,
  };
}

function makeSide(options: { top?: number; mid?: number; bottom?: number } = {}): SwitchSide {
  return {
    toptexture: options.top ?? 0,
    midtexture: options.mid ?? 0,
    bottomtexture: options.bottom ?? 0,
  };
}

function makeLine(special: number): SwitchLine {
  return { special };
}

/**
 * Assign deterministic non-zero texture indices so the synthetic
 * switchlist avoids collisions with `0` (the default side slot).
 * Returns a lookup callable + the ordered index sequence for assertions.
 */
function makeTextureLookup(pairs: readonly SwitchTexturePair[]): (name: string) => number {
  const indices = new Map<string, number>();
  let next = 100;
  for (const pair of pairs) {
    if (!indices.has(pair.off)) indices.set(pair.off, next++);
    if (!indices.has(pair.on)) indices.set(pair.on, next++);
  }
  return (name: string) => indices.get(name) ?? -1;
}

// ── Constants ───────────────────────────────────────────────────────

describe('switch constants', () => {
  it('pins vanilla BUTTONTIME, MAXBUTTONS, MAXSWITCHES', () => {
    expect(BUTTONTIME).toBe(35);
    expect(MAXBUTTONS).toBe(16);
    expect(MAXSWITCHES).toBe(50);
  });

  it('pins sfx indices for switch press and release sounds', () => {
    expect(SFX_SWTCHN).toBe(23);
    expect(SFX_SWTCHX).toBe(24);
  });

  it('EXIT_SWITCH_SPECIAL matches vanilla exit-level line special 11', () => {
    expect(EXIT_SWITCH_SPECIAL).toBe(11);
  });

  it('ButtonWhere matches bwhere_e ordering', () => {
    expect(ButtonWhere.top).toBe(0);
    expect(ButtonWhere.middle).toBe(1);
    expect(ButtonWhere.bottom).toBe(2);
  });
});

// ── ALPH_SWITCH_LIST structure ──────────────────────────────────────

describe('ALPH_SWITCH_LIST', () => {
  it('has 40 rows in canonical source order', () => {
    expect(ALPH_SWITCH_LIST.length).toBe(40);
  });

  it('every off/on name is SW1…/SW2… with identical suffix', () => {
    for (const pair of ALPH_SWITCH_LIST) {
      expect(pair.off.startsWith('SW1')).toBe(true);
      expect(pair.on.startsWith('SW2')).toBe(true);
      expect(pair.off.slice(3)).toBe(pair.on.slice(3));
    }
  });

  it('episode threshold distribution matches vanilla: 19/10/11', () => {
    const counts = { ep1: 0, ep2: 0, ep3: 0 };
    for (const pair of ALPH_SWITCH_LIST) {
      if (pair.episode === 1) counts.ep1++;
      else if (pair.episode === 2) counts.ep2++;
      else counts.ep3++;
    }
    expect(counts).toEqual({ ep1: 19, ep2: 10, ep3: 11 });
  });

  it('pairs are ordered by ascending episode (ep1 block, ep2 block, ep3 block)', () => {
    let phase = 1;
    for (const pair of ALPH_SWITCH_LIST) {
      expect(pair.episode).toBeGreaterThanOrEqual(phase);
      phase = pair.episode;
    }
  });

  it('is frozen and cannot be mutated externally', () => {
    expect(Object.isFrozen(ALPH_SWITCH_LIST)).toBe(true);
  });

  it('includes the SW1EXIT cycle used by the exit switch', () => {
    const exitPair = ALPH_SWITCH_LIST.find((pair) => pair.off === 'SW1EXIT');
    expect(exitPair).toBeDefined();
    expect(exitPair!.on).toBe('SW2EXIT');
    expect(exitPair!.episode).toBe(1);
  });
});

// ── switchEpisodeForGameMode ────────────────────────────────────────

describe('switchEpisodeForGameMode', () => {
  it('returns 1 for shareware', () => {
    expect(switchEpisodeForGameMode('shareware')).toBe(1);
  });

  it('returns 2 for registered and retail', () => {
    expect(switchEpisodeForGameMode('registered')).toBe(2);
    expect(switchEpisodeForGameMode('retail')).toBe(2);
  });

  it('returns 3 for commercial', () => {
    expect(switchEpisodeForGameMode('commercial')).toBe(3);
  });

  it('returns 1 for indetermined (vanilla initial fallback)', () => {
    expect(switchEpisodeForGameMode('indetermined')).toBe(1);
  });

  it('covers every declared GameMode', () => {
    const modes: readonly GameMode[] = ['commercial', 'indetermined', 'registered', 'retail', 'shareware'];
    for (const mode of modes) {
      const ep = switchEpisodeForGameMode(mode);
      expect(ep === 1 || ep === 2 || ep === 3).toBe(true);
    }
  });
});

// ── initSwitchList ──────────────────────────────────────────────────

describe('initSwitchList', () => {
  it('shareware threshold keeps only the 19 episode-1 pairs', () => {
    const lookup = makeTextureLookup(ALPH_SWITCH_LIST);
    const result = initSwitchList(1, lookup);
    expect(result.numswitches).toBe(19);
    expect(result.switchlist.length).toBe(19 * 2 + 1);
    expect(result.switchlist[result.switchlist.length - 1]).toBe(-1);
  });

  it('registered/retail threshold keeps 29 pairs (episode 1 + 2)', () => {
    const lookup = makeTextureLookup(ALPH_SWITCH_LIST);
    const result = initSwitchList(2, lookup);
    expect(result.numswitches).toBe(29);
    expect(result.switchlist.length).toBe(29 * 2 + 1);
  });

  it('commercial threshold keeps all 40 pairs', () => {
    const lookup = makeTextureLookup(ALPH_SWITCH_LIST);
    const result = initSwitchList(3, lookup);
    expect(result.numswitches).toBe(40);
    expect(result.switchlist.length).toBe(40 * 2 + 1);
  });

  it('interleaves [off, on, off, on, …] in source order', () => {
    const lookup = makeTextureLookup(ALPH_SWITCH_LIST);
    const result = initSwitchList(3, lookup);
    for (let pairIdx = 0; pairIdx < ALPH_SWITCH_LIST.length; pairIdx++) {
      const pair = ALPH_SWITCH_LIST[pairIdx]!;
      expect(result.switchlist[pairIdx * 2]).toBe(lookup(pair.off));
      expect(result.switchlist[pairIdx * 2 + 1]).toBe(lookup(pair.on));
    }
  });

  it('ends with the -1 sentinel matching vanilla switchlist[numswitches*2]', () => {
    const lookup = makeTextureLookup(ALPH_SWITCH_LIST);
    const result = initSwitchList(1, lookup);
    expect(result.switchlist[result.numswitches * 2]).toBe(-1);
  });

  it('freezes the returned switchlist and outer record', () => {
    const lookup = makeTextureLookup(ALPH_SWITCH_LIST);
    const result = initSwitchList(1, lookup);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.switchlist)).toBe(true);
  });

  it('drops pairs whose episode exceeds the threshold, preserving relative order', () => {
    const lookup = makeTextureLookup(ALPH_SWITCH_LIST);
    const ep1 = initSwitchList(1, lookup);
    const ep2 = initSwitchList(2, lookup);
    // Every element present in ep1 is also present at the same index in ep2 (since ep1 pairs come first).
    for (let i = 0; i < ep1.numswitches * 2; i++) {
      expect(ep2.switchlist[i]).toBe(ep1.switchlist[i]!);
    }
  });

  it('passes the exact off/on names to the lookup in canonical order', () => {
    const observed: string[] = [];
    initSwitchList(3, (name: string) => {
      observed.push(name);
      return 1;
    });
    const expected: string[] = [];
    for (const pair of ALPH_SWITCH_LIST) {
      expected.push(pair.off);
      expected.push(pair.on);
    }
    expect(observed).toEqual(expected);
  });
});

// ── createButtonList + resetButton ──────────────────────────────────

describe('createButtonList', () => {
  it('allocates MAXBUTTONS slots, each fully zeroed', () => {
    const list = createButtonList();
    expect(list.length).toBe(MAXBUTTONS);
    for (const slot of list) {
      expect(slot.line).toBeNull();
      expect(slot.side).toBeNull();
      expect(slot.where).toBe(ButtonWhere.top);
      expect(slot.btexture).toBe(0);
      expect(slot.btimer).toBe(0);
      expect(slot.soundorg).toBeNull();
    }
  });

  it('each slot is a distinct object (not aliased)', () => {
    const list = createButtonList();
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        expect(list[i]).not.toBe(list[j]!);
      }
    }
  });
});

describe('resetButton', () => {
  it('zeroes every field in place (memset equivalent)', () => {
    const side = makeSide({ top: 100 });
    const line = makeLine(0);
    const slot: Button = {
      line,
      side,
      where: ButtonWhere.bottom,
      btexture: 42,
      btimer: 17,
      soundorg: { id: 'sec' },
    };
    resetButton(slot);
    expect(slot.line).toBeNull();
    expect(slot.side).toBeNull();
    expect(slot.where).toBe(ButtonWhere.top);
    expect(slot.btexture).toBe(0);
    expect(slot.btimer).toBe(0);
    expect(slot.soundorg).toBeNull();
  });
});

// ── startButton (P_StartButton) ─────────────────────────────────────

describe('startButton', () => {
  it('fills the first free slot with the supplied fields', () => {
    const buttons = createButtonList();
    const line = makeLine(0);
    const side = makeSide();
    const origin = { sector: 1 };
    startButton(buttons, line, side, ButtonWhere.middle, 101, BUTTONTIME, origin);
    expect(buttons[0]!.line).toBe(line);
    expect(buttons[0]!.side).toBe(side);
    expect(buttons[0]!.where).toBe(ButtonWhere.middle);
    expect(buttons[0]!.btexture).toBe(101);
    expect(buttons[0]!.btimer).toBe(BUTTONTIME);
    expect(buttons[0]!.soundorg).toBe(origin);
  });

  it('skips slots that are already active and writes into the first free one', () => {
    const buttons = createButtonList();
    // Pre-occupy slot 0.
    const existingLine = makeLine(0);
    startButton(buttons, existingLine, makeSide(), ButtonWhere.top, 10, 5, { a: 1 });
    const line = makeLine(0);
    startButton(buttons, line, makeSide(), ButtonWhere.bottom, 200, 7, { b: 2 });
    expect(buttons[0]!.line).toBe(existingLine);
    expect(buttons[1]!.line).toBe(line);
    expect(buttons[1]!.btimer).toBe(7);
    expect(buttons[1]!.btexture).toBe(200);
  });

  it('deduplicates by line reference: a repeat press on the same line is ignored', () => {
    const buttons = createButtonList();
    const line = makeLine(0);
    startButton(buttons, line, makeSide(), ButtonWhere.top, 11, BUTTONTIME, { sec: 1 });
    // Second press on the same line: should not allocate a new slot.
    startButton(buttons, line, makeSide(), ButtonWhere.middle, 99, BUTTONTIME, { sec: 2 });
    expect(buttons[0]!.line).toBe(line);
    expect(buttons[0]!.btexture).toBe(11);
    expect(buttons[0]!.where).toBe(ButtonWhere.top);
    expect(buttons[1]!.line).toBeNull();
  });

  it('allocates independently for two distinct line references', () => {
    const buttons = createButtonList();
    const a = makeLine(0);
    const b = makeLine(0);
    startButton(buttons, a, makeSide(), ButtonWhere.top, 1, 5, null);
    startButton(buttons, b, makeSide(), ButtonWhere.top, 2, 5, null);
    expect(buttons[0]!.line).toBe(a);
    expect(buttons[1]!.line).toBe(b);
  });

  it('reuses a slot whose btimer has expired (cleared by updateButtons)', () => {
    const buttons = createButtonList();
    const lineA = makeLine(0);
    startButton(buttons, lineA, makeSide(), ButtonWhere.top, 7, 1, null);
    // Simulate timer expiry: clear slot 0.
    resetButton(buttons[0]!);
    const lineB = makeLine(0);
    startButton(buttons, lineB, makeSide(), ButtonWhere.top, 8, 1, null);
    expect(buttons[0]!.line).toBe(lineB);
    expect(buttons[0]!.btexture).toBe(8);
  });

  it('throws "no button slots left" when every slot is occupied', () => {
    const buttons = createButtonList();
    for (let i = 0; i < MAXBUTTONS; i++) {
      startButton(buttons, makeLine(0), makeSide(), ButtonWhere.top, i, 1, null);
    }
    expect(() => {
      startButton(buttons, makeLine(0), makeSide(), ButtonWhere.top, 0, 1, null);
    }).toThrow(/no button slots left/);
  });
});

// ── changeSwitchTexture: basic toggles ──────────────────────────────

describe('changeSwitchTexture: basic top/mid/bottom toggles', () => {
  // Build a trivial switchlist: [10, 11, 20, 21, 30, 31, -1] with 3 pairs.
  const switchlist = Object.freeze([10, 11, 20, 21, 30, 31, -1]);
  const numswitches = 3;

  it('flips the OFF texture on top → ON via i ^ 1', () => {
    const buttons = createButtonList();
    const { callbacks, sounds } = makeHarness();
    const line = makeLine(0);
    const side = makeSide({ top: 10, mid: 999, bottom: 999 });
    changeSwitchTexture(line, side, false, switchlist, numswitches, buttons, callbacks, null);
    expect(side.toptexture).toBe(11);
    expect(side.midtexture).toBe(999);
    expect(side.bottomtexture).toBe(999);
    expect(sounds).toEqual([{ origin: null, sfx: SFX_SWTCHN }]);
  });

  it('flips the ON texture back to OFF (odd index → i ^ 1 is even)', () => {
    const buttons = createButtonList();
    const { callbacks } = makeHarness();
    const line = makeLine(0);
    const side = makeSide({ top: 11, mid: 999, bottom: 999 });
    changeSwitchTexture(line, side, false, switchlist, numswitches, buttons, callbacks, null);
    expect(side.toptexture).toBe(10);
  });

  it('flips mid when top does not match', () => {
    const buttons = createButtonList();
    const { callbacks } = makeHarness();
    const line = makeLine(0);
    const side = makeSide({ top: 999, mid: 20, bottom: 999 });
    changeSwitchTexture(line, side, false, switchlist, numswitches, buttons, callbacks, null);
    expect(side.toptexture).toBe(999);
    expect(side.midtexture).toBe(21);
    expect(side.bottomtexture).toBe(999);
  });

  it('flips bottom when neither top nor mid matches', () => {
    const buttons = createButtonList();
    const { callbacks } = makeHarness();
    const line = makeLine(0);
    const side = makeSide({ top: 999, mid: 999, bottom: 30 });
    changeSwitchTexture(line, side, false, switchlist, numswitches, buttons, callbacks, null);
    expect(side.bottomtexture).toBe(31);
  });

  it('leaves everything untouched when no slot matches', () => {
    const buttons = createButtonList();
    const { callbacks, sounds } = makeHarness();
    const line = makeLine(42);
    const side = makeSide({ top: 777, mid: 888, bottom: 999 });
    changeSwitchTexture(line, side, false, switchlist, numswitches, buttons, callbacks, null);
    expect(side.toptexture).toBe(777);
    expect(side.midtexture).toBe(888);
    expect(side.bottomtexture).toBe(999);
    expect(sounds).toEqual([]);
    expect(line.special).toBe(0); // still cleared because useAgain === false
  });

  it('is a no-op on numswitches=0 (empty switchlist: only the -1 sentinel)', () => {
    const emptyList = Object.freeze([-1]);
    const buttons = createButtonList();
    const { callbacks, sounds } = makeHarness();
    const line = makeLine(42);
    const side = makeSide({ top: 10, mid: 20, bottom: 30 });
    changeSwitchTexture(line, side, false, emptyList, 0, buttons, callbacks, null);
    expect(side.toptexture).toBe(10);
    expect(side.midtexture).toBe(20);
    expect(side.bottomtexture).toBe(30);
    expect(sounds).toEqual([]);
    expect(line.special).toBe(0);
    expect(buttons[0]!.line).toBeNull();
  });

  it('ignores the -1 sentinel slot at switchlist[numswitches*2] even when side texture is -1', () => {
    // numswitches covers only the real pairs; i < numswitches*2 never reads the sentinel.
    const buttons = createButtonList();
    const { callbacks, sounds } = makeHarness();
    const side = makeSide({ top: -1, mid: -1, bottom: -1 });
    changeSwitchTexture(makeLine(0), side, false, switchlist, numswitches, buttons, callbacks, null);
    expect(side.toptexture).toBe(-1);
    expect(side.midtexture).toBe(-1);
    expect(side.bottomtexture).toBe(-1);
    expect(sounds).toEqual([]);
  });
});

// ── changeSwitchTexture: cascade priority ──────────────────────────

describe('changeSwitchTexture cascade priority', () => {
  const switchlist = Object.freeze([10, 11, 20, 21, -1]);
  const numswitches = 2;

  it('top wins over mid and bottom when all three carry the same off texture', () => {
    const buttons = createButtonList();
    const { callbacks } = makeHarness();
    const line = makeLine(0);
    const side = makeSide({ top: 10, mid: 10, bottom: 10 });
    changeSwitchTexture(line, side, false, switchlist, numswitches, buttons, callbacks, null);
    expect(side.toptexture).toBe(11);
    expect(side.midtexture).toBe(10); // untouched
    expect(side.bottomtexture).toBe(10); // untouched
  });

  it('mid wins over bottom when the top does not match', () => {
    const buttons = createButtonList();
    const { callbacks } = makeHarness();
    const line = makeLine(0);
    const side = makeSide({ top: 999, mid: 20, bottom: 20 });
    changeSwitchTexture(line, side, false, switchlist, numswitches, buttons, callbacks, null);
    expect(side.midtexture).toBe(21);
    expect(side.bottomtexture).toBe(20); // untouched
  });

  it('first matching switchlist pair wins when the side uses two different switches', () => {
    // Side has pair-1 top and pair-0 bot. Pair-0 lives at i=0,1 (earlier), so bottom should flip at i=0.
    const buttons = createButtonList();
    const { callbacks } = makeHarness();
    const line = makeLine(0);
    const side = makeSide({ top: 20, mid: 999, bottom: 10 });
    changeSwitchTexture(line, side, false, switchlist, numswitches, buttons, callbacks, null);
    // At i=0 (slot 10): top != 10, mid != 10, bottom == 10 → bottom flips. Loop returns.
    expect(side.bottomtexture).toBe(11);
    expect(side.toptexture).toBe(20); // untouched — pair-1 never evaluated
  });
});

// ── changeSwitchTexture: useAgain semantics ────────────────────────

describe('changeSwitchTexture useAgain semantics', () => {
  const switchlist = Object.freeze([10, 11, -1]);
  const numswitches = 1;

  it('useAgain=false clears line.special and does NOT enqueue a button', () => {
    const buttons = createButtonList();
    const { callbacks } = makeHarness();
    const line = makeLine(42);
    const side = makeSide({ top: 10 });
    changeSwitchTexture(line, side, false, switchlist, numswitches, buttons, callbacks, null);
    expect(line.special).toBe(0);
    expect(buttons[0]!.btimer).toBe(0);
    expect(buttons[0]!.line).toBeNull();
  });

  it('useAgain=true keeps line.special and enqueues a BUTTONTIME-armed slot', () => {
    const buttons = createButtonList();
    const { callbacks } = makeHarness();
    const line = makeLine(42);
    const side = makeSide({ top: 10 });
    const origin = { sec: 7 };
    changeSwitchTexture(line, side, true, switchlist, numswitches, buttons, callbacks, origin);
    expect(line.special).toBe(42);
    expect(buttons[0]!.line).toBe(line);
    expect(buttons[0]!.side).toBe(side);
    expect(buttons[0]!.where).toBe(ButtonWhere.top);
    expect(buttons[0]!.btexture).toBe(10); // original off texture
    expect(buttons[0]!.btimer).toBe(BUTTONTIME);
    expect(buttons[0]!.soundorg).toBe(origin);
  });

  it('useAgain=true preserves the btexture that matched (not the replacement)', () => {
    const buttons = createButtonList();
    const { callbacks } = makeHarness();
    const line = makeLine(42);
    const side = makeSide({ mid: 11 }); // already-pressed variant
    changeSwitchTexture(line, side, true, switchlist, numswitches, buttons, callbacks, null);
    expect(side.midtexture).toBe(10);
    expect(buttons[0]!.btexture).toBe(11); // preserves the matched frame
    expect(buttons[0]!.where).toBe(ButtonWhere.middle);
  });
});

// ── changeSwitchTexture: exit-switch sound quirk ────────────────────

describe('changeSwitchTexture exit-switch sound quirk', () => {
  const switchlist = Object.freeze([10, 11, -1]);
  const numswitches = 1;

  it('special 11 with useAgain=false emits sfx_swtchn because line.special is cleared before the check', () => {
    const buttons = createButtonList();
    const { callbacks, sounds } = makeHarness();
    const line = makeLine(EXIT_SWITCH_SPECIAL);
    const side = makeSide({ top: 10 });
    changeSwitchTexture(line, side, false, switchlist, numswitches, buttons, callbacks, null);
    expect(sounds.length).toBe(1);
    expect(sounds[0]!.sfx).toBe(SFX_SWTCHN);
    expect(line.special).toBe(0);
  });

  it('special 11 with useAgain=true emits sfx_swtchx (line.special preserved)', () => {
    const buttons = createButtonList();
    const { callbacks, sounds } = makeHarness();
    const line = makeLine(EXIT_SWITCH_SPECIAL);
    const side = makeSide({ top: 10 });
    changeSwitchTexture(line, side, true, switchlist, numswitches, buttons, callbacks, null);
    expect(sounds.length).toBe(1);
    expect(sounds[0]!.sfx).toBe(SFX_SWTCHX);
    expect(line.special).toBe(EXIT_SWITCH_SPECIAL);
  });

  it('non-11 specials always emit sfx_swtchn regardless of useAgain', () => {
    const buttons = createButtonList();
    const { callbacks, sounds } = makeHarness();
    changeSwitchTexture(makeLine(42), makeSide({ top: 10 }), false, switchlist, numswitches, buttons, callbacks, null);
    changeSwitchTexture(makeLine(42), makeSide({ top: 10 }), true, switchlist, numswitches, buttons, callbacks, null);
    expect(sounds.map((e) => e.sfx)).toEqual([SFX_SWTCHN, SFX_SWTCHN]);
  });
});

// ── changeSwitchTexture: soundorg quirk ────────────────────────────

describe('changeSwitchTexture soundorg quirk (buttonlist->soundorg)', () => {
  const switchlist = Object.freeze([10, 11, -1]);
  const numswitches = 1;

  it('plays press sound at buttons[0].soundorg === null on a fresh level', () => {
    const buttons = createButtonList();
    const { callbacks, sounds } = makeHarness();
    const line = makeLine(42);
    const side = makeSide({ top: 10 });
    // The new button will fill buttons[0] AFTER the sound plays; the
    // soundorg passed to startSound is still the PRE-press value (null).
    changeSwitchTexture(line, side, true, switchlist, numswitches, buttons, callbacks, { id: 'newOrigin' });
    expect(sounds.length).toBe(1);
    expect(sounds[0]!.origin).toBeNull();
  });

  it("plays press sound at the first active button's soundorg once any button exists", () => {
    const buttons = createButtonList();
    const { callbacks, sounds } = makeHarness();
    const staleOrigin = { id: 'stale' };
    startButton(buttons, makeLine(0), makeSide(), ButtonWhere.top, 0, 99, staleOrigin);
    // Now press a DIFFERENT switch; vanilla quirk makes it emit from buttons[0].soundorg.
    changeSwitchTexture(makeLine(42), makeSide({ top: 10 }), false, switchlist, numswitches, buttons, callbacks, { id: 'newOrigin' });
    expect(sounds[0]!.origin).toBe(staleOrigin);
  });
});

// ── updateButtons (P_UpdateSpecials button half) ───────────────────

describe('updateButtons', () => {
  const switchlist = Object.freeze([10, 11, -1]);
  const numswitches = 1;

  it('leaves inactive slots untouched', () => {
    const buttons = createButtonList();
    const { callbacks, sounds } = makeHarness();
    updateButtons(buttons, callbacks);
    for (const slot of buttons) {
      expect(slot.btimer).toBe(0);
    }
    expect(sounds).toEqual([]);
  });

  it('decrements btimer each tic without triggering restore until zero', () => {
    const buttons = createButtonList();
    const { callbacks, sounds } = makeHarness();
    const side = makeSide({ top: 11 });
    startButton(buttons, makeLine(0), side, ButtonWhere.top, 10, 3, { id: 'x' });
    updateButtons(buttons, callbacks);
    expect(buttons[0]!.btimer).toBe(2);
    updateButtons(buttons, callbacks);
    expect(buttons[0]!.btimer).toBe(1);
    expect(sounds).toEqual([]);
    expect(side.toptexture).toBe(11); // not restored yet
  });

  it('restores original top texture and emits sfx_swtchn when timer hits zero', () => {
    const buttons = createButtonList();
    const { callbacks, sounds } = makeHarness();
    const side = makeSide({ top: 11 });
    const origin = { sec: 5 };
    startButton(buttons, makeLine(0), side, ButtonWhere.top, 10, 1, origin);
    updateButtons(buttons, callbacks);
    expect(side.toptexture).toBe(10);
    expect(sounds.length).toBe(1);
    expect(sounds[0]).toEqual({ origin, sfx: SFX_SWTCHN });
  });

  it('restores original middle texture when where === middle', () => {
    const buttons = createButtonList();
    const { callbacks } = makeHarness();
    const side = makeSide({ mid: 11 });
    startButton(buttons, makeLine(0), side, ButtonWhere.middle, 10, 1, null);
    updateButtons(buttons, callbacks);
    expect(side.midtexture).toBe(10);
  });

  it('restores original bottom texture when where === bottom', () => {
    const buttons = createButtonList();
    const { callbacks } = makeHarness();
    const side = makeSide({ bottom: 11 });
    startButton(buttons, makeLine(0), side, ButtonWhere.bottom, 10, 1, null);
    updateButtons(buttons, callbacks);
    expect(side.bottomtexture).toBe(10);
  });

  it('resets the slot to a reusable zero state after restore', () => {
    const buttons = createButtonList();
    const { callbacks } = makeHarness();
    const side = makeSide({ top: 11 });
    startButton(buttons, makeLine(0), side, ButtonWhere.top, 10, 1, { sec: 1 });
    updateButtons(buttons, callbacks);
    expect(buttons[0]!.btimer).toBe(0);
    expect(buttons[0]!.line).toBeNull();
    expect(buttons[0]!.side).toBeNull();
    expect(buttons[0]!.btexture).toBe(0);
    expect(buttons[0]!.soundorg).toBeNull();
  });

  it('always emits sfx_swtchn on release, even for the exit switch that pressed with sfx_swtchx', () => {
    const buttons = createButtonList();
    const { callbacks, sounds } = makeHarness();
    const side = makeSide({ top: 10 });
    // Simulate an exit switch (special 11) pressed with useAgain=true (non-vanilla but valid).
    const line = makeLine(EXIT_SWITCH_SPECIAL);
    changeSwitchTexture(line, side, true, switchlist, numswitches, buttons, callbacks, { sec: 1 });
    // Drain the press event.
    const pressSfx = sounds.shift();
    expect(pressSfx!.sfx).toBe(SFX_SWTCHX);
    buttons[0]!.btimer = 1;
    updateButtons(buttons, callbacks);
    expect(sounds.length).toBe(1);
    expect(sounds[0]!.sfx).toBe(SFX_SWTCHN);
  });

  it('ticks multiple active slots independently in one pass', () => {
    const buttons = createButtonList();
    const { callbacks, sounds } = makeHarness();
    const sideA = makeSide({ top: 11 });
    const sideB = makeSide({ mid: 21 });
    const originA = { id: 'A' };
    const originB = { id: 'B' };
    startButton(buttons, makeLine(0), sideA, ButtonWhere.top, 10, 1, originA);
    startButton(buttons, makeLine(0), sideB, ButtonWhere.middle, 20, 2, originB);
    updateButtons(buttons, callbacks);
    expect(sideA.toptexture).toBe(10); // restored
    expect(sideB.midtexture).toBe(21); // not yet
    expect(buttons[1]!.btimer).toBe(1);
    updateButtons(buttons, callbacks);
    expect(sideB.midtexture).toBe(20);
    expect(sounds.map((e) => e.origin)).toEqual([originA, originB]);
  });
});

// ── round-trip: press + timer + restore ─────────────────────────────

describe('switch press → timer → restore round trip', () => {
  it('reproduces the full BUTTONTIME lifecycle: press flips, timer ticks, restore reverts', () => {
    const switchlist = Object.freeze([10, 11, -1]);
    const numswitches = 1;
    const buttons = createButtonList();
    const { callbacks, sounds } = makeHarness();
    const line = makeLine(42);
    const side = makeSide({ top: 10 });
    const origin = { sec: 99 };

    changeSwitchTexture(line, side, true, switchlist, numswitches, buttons, callbacks, origin);

    expect(side.toptexture).toBe(11);
    expect(buttons[0]!.btimer).toBe(BUTTONTIME);
    expect(sounds.length).toBe(1);

    // Run exactly BUTTONTIME update cycles.
    for (let t = 0; t < BUTTONTIME; t++) {
      updateButtons(buttons, callbacks);
    }

    expect(side.toptexture).toBe(10);
    expect(buttons[0]!.btimer).toBe(0);
    // Two total sounds: press + restore.
    expect(sounds.length).toBe(2);
    expect(sounds[0]!.sfx).toBe(SFX_SWTCHN);
    expect(sounds[1]!.sfx).toBe(SFX_SWTCHN);
    expect(sounds[1]!.origin).toBe(origin);
  });
});
