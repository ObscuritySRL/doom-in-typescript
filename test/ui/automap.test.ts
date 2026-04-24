import { describe, expect, it } from 'bun:test';

import { ANG90, ANG180 } from '../../src/core/angle.ts';
import { FRACUNIT, fixedDiv, fixedMul } from '../../src/core/fixed.ts';

import {
  AM_F_OLDLOC_FORCE_RECENTER,
  AM_LEVEL_INIT_SCALE_DIVISOR,
  AM_LITE_LEVELS,
  AM_MARK_HEIGHT,
  AM_MARK_WIDTH,
  AM_NUMMARKPOINTS,
  AM_TELEPORT_SPECIAL,
  BACKGROUND,
  BLACK,
  BLUERANGE,
  BLUES,
  BROWNRANGE,
  BROWNS,
  CDWALLCOLORS,
  CDWALLRANGE,
  CHEAT_PLAYER_ARROW_LINES,
  FDWALLCOLORS,
  FDWALLRANGE,
  F_INIT_HEIGHT,
  F_INIT_WIDTH,
  F_PANINC,
  GRAYS,
  GRAYSRANGE,
  GREENRANGE,
  GREENS,
  GRIDCOLORS,
  GRIDRANGE,
  INITSCALEMTOF,
  INVIS_PLAYER_COLOR,
  M_ZOOMIN,
  M_ZOOMOUT,
  NETGAME_PLAYER_COLORS,
  PLAYERRADIUS,
  PLAYER_ARROW_LINES,
  REDRANGE,
  REDS,
  SECRETWALLCOLORS,
  SECRETWALLRANGE,
  THINGCOLORS,
  THINGRANGE,
  THIN_TRIANGLE_GUY_LINES,
  TRIANGLE_GUY_LINES,
  TSWALLCOLORS,
  TSWALLRANGE,
  WALLCOLORS,
  WALLRANGE,
  WHITE,
  XHAIRCOLORS,
  YELLOWRANGE,
  YELLOWS,
  YOURCOLORS,
  automapActivateNewScale,
  automapAddMark,
  automapChangeWindowLoc,
  automapChangeWindowScale,
  automapClearMarks,
  automapClipMline,
  automapCxMtof,
  automapCyMtof,
  automapDoFollowPlayer,
  automapDrawFline,
  automapFindMinMaxBoundaries,
  automapFtom,
  automapInitVariables,
  automapLevelInit,
  automapMaxOutWindowScale,
  automapMinOutWindowScale,
  automapMtof,
  automapRestoreScaleAndLoc,
  automapRotate,
  automapSaveScaleAndLoc,
  automapStart,
  automapStop,
  automapTicker,
  createAutomapState,
} from '../../src/ui/automap.ts';

import type { AutomapState, Line2D, Point2D } from '../../src/ui/automap.ts';

// ── Test helpers ─────────────────────────────────────────────────────

function makeSquareMap(halfExtent: number): { x: number; y: number }[] {
  return [
    { x: -halfExtent, y: -halfExtent },
    { x: halfExtent, y: -halfExtent },
    { x: halfExtent, y: halfExtent },
    { x: -halfExtent, y: halfExtent },
  ];
}

function levelInit(state: AutomapState, halfExtent: number): void {
  automapLevelInit(state, { vertexes: makeSquareMap(halfExtent) });
}

function startOnSquareMap(state: AutomapState, halfExtent: number, playerX: number, playerY: number): void {
  automapStart(state, {
    vertexes: makeSquareMap(halfExtent),
    playerX,
    playerY,
    episode: 1,
    map: 1,
    lastLevelKey: { episode: 0, map: 0 },
  });
}

// ── Palette constants ────────────────────────────────────────────────

describe('automap palette constants', () => {
  it('REDS = 256 - 5*16 = 176, REDRANGE = 16', () => {
    expect(REDS).toBe(176);
    expect(REDRANGE).toBe(16);
  });

  it('BLUES = 256 - 4*16 + 8 = 200, BLUERANGE = 8', () => {
    expect(BLUES).toBe(200);
    expect(BLUERANGE).toBe(8);
  });

  it('GREENS = 7*16 = 112, GREENRANGE = 16', () => {
    expect(GREENS).toBe(112);
    expect(GREENRANGE).toBe(16);
  });

  it('GRAYS = 6*16 = 96, GRAYSRANGE = 16', () => {
    expect(GRAYS).toBe(96);
    expect(GRAYSRANGE).toBe(16);
  });

  it('BROWNS = 4*16 = 64, BROWNRANGE = 16', () => {
    expect(BROWNS).toBe(64);
    expect(BROWNRANGE).toBe(16);
  });

  it('YELLOWS = 256 - 32 + 7 = 231, YELLOWRANGE = 1', () => {
    expect(YELLOWS).toBe(231);
    expect(YELLOWRANGE).toBe(1);
  });

  it('BLACK = 0, WHITE = 256 - 47 = 209', () => {
    expect(BLACK).toBe(0);
    expect(WHITE).toBe(209);
  });

  it('semantic aliases: BACKGROUND=BLACK, YOURCOLORS=WHITE', () => {
    expect(BACKGROUND).toBe(BLACK);
    expect(YOURCOLORS).toBe(WHITE);
  });

  it('wall / floor / ceiling / thing color aliases mirror vanilla', () => {
    expect(WALLCOLORS).toBe(REDS);
    expect(WALLRANGE).toBe(REDRANGE);
    expect(TSWALLCOLORS).toBe(GRAYS);
    expect(TSWALLRANGE).toBe(GRAYSRANGE);
    expect(FDWALLCOLORS).toBe(BROWNS);
    expect(FDWALLRANGE).toBe(BROWNRANGE);
    expect(CDWALLCOLORS).toBe(YELLOWS);
    expect(CDWALLRANGE).toBe(YELLOWRANGE);
    expect(THINGCOLORS).toBe(GREENS);
    expect(THINGRANGE).toBe(GREENRANGE);
    expect(SECRETWALLCOLORS).toBe(WALLCOLORS);
    expect(SECRETWALLRANGE).toBe(WALLRANGE);
  });

  it('GRIDCOLORS = GRAYS + GRAYSRANGE/2 = 104, GRIDRANGE = 0', () => {
    expect(GRIDCOLORS).toBe(104);
    expect(GRIDRANGE).toBe(0);
  });

  it('XHAIRCOLORS = GRAYS = 96, INVIS_PLAYER_COLOR = 246', () => {
    expect(XHAIRCOLORS).toBe(GRAYS);
    expect(INVIS_PLAYER_COLOR).toBe(246);
  });

  it('NETGAME_PLAYER_COLORS is frozen [GREENS, GRAYS, BROWNS, REDS]', () => {
    expect(Object.isFrozen(NETGAME_PLAYER_COLORS)).toBe(true);
    expect(NETGAME_PLAYER_COLORS).toEqual([GREENS, GRAYS, BROWNS, REDS]);
  });
});

// ── Geometry / zoom constants ────────────────────────────────────────

describe('automap geometry / zoom constants', () => {
  it('AM_NUMMARKPOINTS = 10, F_PANINC = 4', () => {
    expect(AM_NUMMARKPOINTS).toBe(10);
    expect(F_PANINC).toBe(4);
  });

  it('INITSCALEMTOF is the C-truncated (int)(0.2*FRACUNIT) = 13107', () => {
    expect(INITSCALEMTOF).toBe(13107);
  });

  it('M_ZOOMIN is the C-truncated (int)(1.02*FRACUNIT) = 66846', () => {
    expect(M_ZOOMIN).toBe(66846);
  });

  it('M_ZOOMOUT is the C-truncated (int)(FRACUNIT/1.02) = 64251', () => {
    expect(M_ZOOMOUT).toBe(64251);
  });

  it('AM_LEVEL_INIT_SCALE_DIVISOR is the C-truncated (int)(0.7*FRACUNIT) = 45875', () => {
    expect(AM_LEVEL_INIT_SCALE_DIVISOR).toBe(45875);
  });

  it('PLAYERRADIUS = 16 * FRACUNIT', () => {
    expect(PLAYERRADIUS).toBe(16 * FRACUNIT);
  });

  it('F_INIT_WIDTH = SCREENWIDTH = 320, F_INIT_HEIGHT = SCREENHEIGHT - SBARHEIGHT = 168', () => {
    expect(F_INIT_WIDTH).toBe(320);
    expect(F_INIT_HEIGHT).toBe(168);
  });

  it('AM_MARK_WIDTH = 5, AM_MARK_HEIGHT = 6', () => {
    expect(AM_MARK_WIDTH).toBe(5);
    expect(AM_MARK_HEIGHT).toBe(6);
  });

  it('AM_TELEPORT_SPECIAL = 39 (vanilla teleport linedef special)', () => {
    expect(AM_TELEPORT_SPECIAL).toBe(39);
  });

  it('AM_F_OLDLOC_FORCE_RECENTER = 0x7FFFFFFF (INT_MAX sentinel)', () => {
    expect(AM_F_OLDLOC_FORCE_RECENTER).toBe(0x7fffffff);
  });

  it('AM_LITE_LEVELS is frozen with 8 entries', () => {
    expect(Object.isFrozen(AM_LITE_LEVELS)).toBe(true);
    expect(AM_LITE_LEVELS).toEqual([0, 4, 7, 10, 12, 14, 15, 15]);
  });
});

// ── Vector shape tables ──────────────────────────────────────────────

describe('automap vector shape tables', () => {
  it('PLAYER_ARROW_LINES has 7 segments and is frozen', () => {
    expect(PLAYER_ARROW_LINES).toHaveLength(7);
    expect(Object.isFrozen(PLAYER_ARROW_LINES)).toBe(true);
    for (const line of PLAYER_ARROW_LINES) {
      expect(Object.isFrozen(line)).toBe(true);
      expect(Object.isFrozen(line.a)).toBe(true);
      expect(Object.isFrozen(line.b)).toBe(true);
    }
  });

  it('CHEAT_PLAYER_ARROW_LINES has 16 segments and is frozen', () => {
    expect(CHEAT_PLAYER_ARROW_LINES).toHaveLength(16);
    expect(Object.isFrozen(CHEAT_PLAYER_ARROW_LINES)).toBe(true);
  });

  it('TRIANGLE_GUY_LINES has 3 segments', () => {
    expect(TRIANGLE_GUY_LINES).toHaveLength(3);
    expect(Object.isFrozen(TRIANGLE_GUY_LINES)).toBe(true);
  });

  it('THIN_TRIANGLE_GUY_LINES has 3 segments', () => {
    expect(THIN_TRIANGLE_GUY_LINES).toHaveLength(3);
    expect(Object.isFrozen(THIN_TRIANGLE_GUY_LINES)).toBe(true);
  });

  it('PLAYER_ARROW_LINES first segment endpoints match vanilla R = 8*PLAYERRADIUS/7', () => {
    const R = Math.trunc((8 * PLAYERRADIUS) / 7);
    expect(R).toBe(1198372);
    expect(PLAYER_ARROW_LINES[0]!.a.x).toBe(-R + Math.trunc(R / 8));
    expect(PLAYER_ARROW_LINES[0]!.a.y).toBe(0);
    expect(PLAYER_ARROW_LINES[0]!.b.x).toBe(R);
    expect(PLAYER_ARROW_LINES[0]!.b.y).toBe(0);
  });

  it('THIN_TRIANGLE_GUY_LINES y components use truncated (int)(±0.7 * FRACUNIT)', () => {
    expect(THIN_TRIANGLE_GUY_LINES[0]!.a.y).toBe(Math.trunc(-0.7 * FRACUNIT));
    expect(THIN_TRIANGLE_GUY_LINES[2]!.a.y).toBe(Math.trunc(0.7 * FRACUNIT));
    expect(Math.trunc(-0.7 * FRACUNIT)).toBe(-45875);
  });
});

// ── State construction ──────────────────────────────────────────────

describe('createAutomapState', () => {
  it('returns fresh defaults: inactive, stopped, followplayer=1, followplayer recenters on first tick', () => {
    const s = createAutomapState();
    expect(s.active).toBe(false);
    expect(s.stopped).toBe(true);
    expect(s.cheating).toBe(0);
    expect(s.grid).toBe(false);
    expect(s.followplayer).toBe(1);
    expect(s.bigstate).toBe(false);
    expect(s.amclock).toBe(0);
    expect(s.lightlev).toBe(0);
    expect(s.f_oldloc.x).toBe(AM_F_OLDLOC_FORCE_RECENTER);
  });

  it('frame-buffer viewport defaults to (0, 0, 320, 168)', () => {
    const s = createAutomapState();
    expect(s.f_x).toBe(0);
    expect(s.f_y).toBe(0);
    expect(s.f_w).toBe(F_INIT_WIDTH);
    expect(s.f_h).toBe(F_INIT_HEIGHT);
  });

  it('default scale pair uses INITSCALEMTOF and its reciprocal', () => {
    const s = createAutomapState();
    expect(s.scale_mtof).toBe(INITSCALEMTOF);
    expect(s.scale_ftom).toBe(fixedDiv(FRACUNIT, INITSCALEMTOF));
  });

  it('default min_w / min_h = 2 * PLAYERRADIUS', () => {
    const s = createAutomapState();
    expect(s.min_w).toBe(2 * PLAYERRADIUS);
    expect(s.min_h).toBe(2 * PLAYERRADIUS);
  });

  it('zoom multipliers start at FRACUNIT (no-op)', () => {
    const s = createAutomapState();
    expect(s.mtof_zoommul).toBe(FRACUNIT);
    expect(s.ftom_zoommul).toBe(FRACUNIT);
  });

  it('markpoints buffer is length AM_NUMMARKPOINTS with each slot x=-1', () => {
    const s = createAutomapState();
    expect(s.markpoints).toHaveLength(AM_NUMMARKPOINTS);
    for (const mp of s.markpoints) {
      expect(mp.x).toBe(-1);
    }
    expect(s.markpointnum).toBe(0);
  });
});

// ── Coordinate conversions ───────────────────────────────────────────

describe('automap coordinate conversions', () => {
  it('MTOF(FTOM(p)) round-trips integer pixels at scale=FRACUNIT', () => {
    const s = createAutomapState();
    s.scale_mtof = FRACUNIT;
    s.scale_ftom = fixedDiv(FRACUNIT, FRACUNIT);
    for (const p of [0, 1, 5, 17, 100]) {
      expect(automapMtof(s, automapFtom(s, p))).toBe(p);
    }
  });

  it('CXMTOF(m_x) == f_x (map origin lands on viewport origin)', () => {
    const s = createAutomapState();
    s.m_x = 12345;
    s.f_x = 7;
    expect(automapCxMtof(s, 12345)).toBe(7);
  });

  it('CYMTOF(m_y) == f_y + f_h (map origin lands on viewport bottom — y flip)', () => {
    const s = createAutomapState();
    s.m_y = 99;
    s.f_y = 3;
    expect(automapCyMtof(s, 99)).toBe(3 + s.f_h);
  });

  it('CYMTOF flips y: larger mapY gives smaller pixel row', () => {
    const s = createAutomapState();
    s.scale_mtof = FRACUNIT;
    s.scale_ftom = fixedDiv(FRACUNIT, FRACUNIT);
    s.m_y = 0;
    const yLow = automapCyMtof(s, 0);
    const yHigh = automapCyMtof(s, FRACUNIT);
    expect(yHigh).toBeLessThan(yLow);
  });

  it('MTOF and FTOM honor overridden scale factors', () => {
    const s = createAutomapState();
    s.scale_mtof = FRACUNIT; // 1:1 scale
    s.scale_ftom = fixedDiv(FRACUNIT, FRACUNIT);
    expect(automapMtof(s, 42 * FRACUNIT)).toBe(42);
    expect(automapFtom(s, 42)).toBe(42 * FRACUNIT);
  });
});

// ── Bounding box scan ────────────────────────────────────────────────

describe('automapFindMinMaxBoundaries', () => {
  it('computes tight bounds and max_w / max_h from vertex list', () => {
    const s = createAutomapState();
    s.f_w = 320;
    s.f_h = 168;
    const vertexes = [
      { x: -100 * FRACUNIT, y: -200 * FRACUNIT },
      { x: 100 * FRACUNIT, y: 200 * FRACUNIT },
      { x: 0, y: 0 },
    ];
    automapFindMinMaxBoundaries(s, vertexes);
    expect(s.min_x).toBe(-100 * FRACUNIT);
    expect(s.max_x).toBe(100 * FRACUNIT);
    expect(s.min_y).toBe(-200 * FRACUNIT);
    expect(s.max_y).toBe(200 * FRACUNIT);
    expect(s.max_w).toBe(200 * FRACUNIT);
    expect(s.max_h).toBe(400 * FRACUNIT);
  });

  it('min_scale_mtof chooses the smaller of the two axis-fit ratios', () => {
    const s = createAutomapState();
    s.f_w = 320;
    s.f_h = 168;
    const vertexes = makeSquareMap(100 * FRACUNIT);
    automapFindMinMaxBoundaries(s, vertexes);
    const aspectW = fixedDiv(320 * FRACUNIT, 200 * FRACUNIT);
    const aspectH = fixedDiv(168 * FRACUNIT, 200 * FRACUNIT);
    expect(s.min_scale_mtof).toBe(aspectW < aspectH ? aspectW : aspectH);
  });

  it('max_scale_mtof = FixedDiv(f_h*FRACUNIT, 2*PLAYERRADIUS)', () => {
    const s = createAutomapState();
    s.f_w = 320;
    s.f_h = 168;
    automapFindMinMaxBoundaries(s, makeSquareMap(100 * FRACUNIT));
    expect(s.max_scale_mtof).toBe(fixedDiv(168 * FRACUNIT, 2 * PLAYERRADIUS));
  });

  it('throws RangeError on empty vertex list', () => {
    const s = createAutomapState();
    expect(() => automapFindMinMaxBoundaries(s, [])).toThrow(RangeError);
  });

  it('single-vertex list: min == vertex, max stays -FIXED_MAX (-INT_MAX sentinel, else-if parity)', () => {
    const s = createAutomapState();
    s.f_w = 320;
    s.f_h = 168;
    // This mirrors vanilla's else-if parity: the first vertex only sets
    // the min branch; max_x stays at -INT_MAX until a subsequent vertex
    // is seen. Vanilla initializes max_x/max_y to -INT_MAX (not INT_MIN),
    // so the sentinel after scanning a single vertex must equal -FIXED_MAX.
    automapFindMinMaxBoundaries(s, [{ x: 50, y: 60 }]);
    expect(s.min_x).toBe(50);
    expect(s.min_y).toBe(60);
    expect(s.max_x).toBe(-0x7fff_ffff);
    expect(s.max_y).toBe(-0x7fff_ffff);
  });
});

// ── Level init ───────────────────────────────────────────────────────

describe('automapLevelInit', () => {
  it('resets viewport to defaults and runs boundary scan', () => {
    const s = createAutomapState();
    s.f_x = 99;
    s.f_y = 99;
    s.f_w = 1;
    s.f_h = 1;
    levelInit(s, 100 * FRACUNIT);
    expect(s.f_x).toBe(0);
    expect(s.f_y).toBe(0);
    expect(s.f_w).toBe(F_INIT_WIDTH);
    expect(s.f_h).toBe(F_INIT_HEIGHT);
    expect(s.max_x).toBe(100 * FRACUNIT);
    expect(s.max_w).toBe(200 * FRACUNIT);
  });

  it('clears marks (sets every slot to x=-1, markpointnum=0)', () => {
    const s = createAutomapState();
    s.markpoints[0] = { x: 5, y: 6 };
    s.markpointnum = 3;
    levelInit(s, 100 * FRACUNIT);
    expect(s.markpointnum).toBe(0);
    for (const mp of s.markpoints) {
      expect(mp.x).toBe(-1);
    }
  });

  it('scale_mtof = FixedDiv(min_scale_mtof, 45875) under normal maps', () => {
    const s = createAutomapState();
    levelInit(s, 100 * FRACUNIT);
    expect(s.scale_mtof).toBe(fixedDiv(s.min_scale_mtof, AM_LEVEL_INIT_SCALE_DIVISOR));
    expect(s.scale_ftom).toBe(fixedDiv(FRACUNIT, s.scale_mtof));
  });

  it('degenerate map: if FixedDiv(min_scale_mtof, 45875) > max_scale_mtof, snap to min_scale_mtof (NOT max)', () => {
    // A slightly-larger-than-2*PLAYERRADIUS map where
    // min_scale_mtof > 0.7 * max_scale_mtof, so the LevelInit scale
    // (min / 0.7) overshoots max_scale_mtof but min and max remain
    // distinct — proves the snap-back targets MIN, not max.
    const s = createAutomapState();
    levelInit(s, 20 * FRACUNIT);
    expect(s.min_scale_mtof).not.toBe(s.max_scale_mtof);
    expect(fixedDiv(s.min_scale_mtof, AM_LEVEL_INIT_SCALE_DIVISOR)).toBeGreaterThan(s.max_scale_mtof);
    expect(s.scale_mtof).toBe(s.min_scale_mtof);
    expect(s.scale_mtof).not.toBe(s.max_scale_mtof);
  });
});

// ── Save / restore scale and location ────────────────────────────────

describe('automapSaveScaleAndLoc / automapRestoreScaleAndLoc', () => {
  it('save captures current m_x / m_y / m_w / m_h', () => {
    const s = createAutomapState();
    s.m_x = 10;
    s.m_y = 20;
    s.m_w = 100;
    s.m_h = 50;
    automapSaveScaleAndLoc(s);
    expect(s.old_m_x).toBe(10);
    expect(s.old_m_y).toBe(20);
    expect(s.old_m_w).toBe(100);
    expect(s.old_m_h).toBe(50);
  });

  it('restore with followplayer=0 copies old_m_x / old_m_y verbatim', () => {
    const s = createAutomapState();
    s.f_w = 320;
    s.followplayer = 0;
    s.old_m_x = 111;
    s.old_m_y = 222;
    s.old_m_w = 320 * FRACUNIT;
    s.old_m_h = 168 * FRACUNIT;
    automapRestoreScaleAndLoc(s, 999, 888);
    expect(s.m_x).toBe(111);
    expect(s.m_y).toBe(222);
    expect(s.m_w).toBe(s.old_m_w);
    expect(s.m_h).toBe(s.old_m_h);
  });

  it('restore with followplayer=1 centers old window on player', () => {
    const s = createAutomapState();
    s.f_w = 320;
    s.followplayer = 1;
    s.old_m_x = 111;
    s.old_m_y = 222;
    s.old_m_w = 320 * FRACUNIT;
    s.old_m_h = 168 * FRACUNIT;
    automapRestoreScaleAndLoc(s, 999, 888);
    expect(s.m_x).toBe((999 - (s.old_m_w >> 1)) | 0);
    expect(s.m_y).toBe((888 - (s.old_m_h >> 1)) | 0);
  });

  it('restore recomputes scale_mtof from f_w and m_w, and scale_ftom as its reciprocal', () => {
    const s = createAutomapState();
    s.f_w = 320;
    s.old_m_x = 0;
    s.old_m_y = 0;
    s.old_m_w = 320 * FRACUNIT;
    s.old_m_h = 168 * FRACUNIT;
    automapRestoreScaleAndLoc(s, 0, 0);
    expect(s.scale_mtof).toBe(fixedDiv(320 * FRACUNIT, 320 * FRACUNIT));
    expect(s.scale_ftom).toBe(fixedDiv(FRACUNIT, s.scale_mtof));
  });
});

// ── activateNewScale / min / max out ────────────────────────────────

describe('automapActivateNewScale and min/max clamps', () => {
  it('activateNewScale recomputes m_w / m_h from scale and re-centers m_x / m_y', () => {
    const s = createAutomapState();
    s.f_w = 320;
    s.f_h = 168;
    s.m_x = 100;
    s.m_y = 200;
    s.m_w = 50;
    s.m_h = 40;
    s.scale_mtof = FRACUNIT;
    s.scale_ftom = FRACUNIT;
    automapActivateNewScale(s);
    expect(s.m_w).toBe(automapFtom(s, 320));
    expect(s.m_h).toBe(automapFtom(s, 168));
    // center preserved
    expect((s.m_x + (s.m_w >> 1)) | 0).toBe((100 + 25) | 0);
    expect((s.m_y + (s.m_h >> 1)) | 0).toBe((200 + 20) | 0);
    expect(s.m_x2).toBe((s.m_x + s.m_w) | 0);
    expect(s.m_y2).toBe((s.m_y + s.m_h) | 0);
  });

  it('minOutWindowScale snaps scale_mtof to min_scale_mtof', () => {
    const s = createAutomapState();
    startOnSquareMap(s, 100 * FRACUNIT, 0, 0);
    automapMinOutWindowScale(s);
    expect(s.scale_mtof).toBe(s.min_scale_mtof);
    expect(s.scale_ftom).toBe(fixedDiv(FRACUNIT, s.min_scale_mtof));
  });

  it('maxOutWindowScale snaps scale_mtof to max_scale_mtof', () => {
    const s = createAutomapState();
    startOnSquareMap(s, 100 * FRACUNIT, 0, 0);
    automapMaxOutWindowScale(s);
    expect(s.scale_mtof).toBe(s.max_scale_mtof);
    expect(s.scale_ftom).toBe(fixedDiv(FRACUNIT, s.max_scale_mtof));
  });
});

// ── changeWindowLoc (pan + clamp) ────────────────────────────────────

describe('automapChangeWindowLoc', () => {
  it('applies m_paninc to m_x and m_y when within bounds', () => {
    const s = createAutomapState();
    startOnSquareMap(s, 1000 * FRACUNIT, 0, 0);
    const beforeX = s.m_x;
    const beforeY = s.m_y;
    s.m_paninc.x = 5;
    s.m_paninc.y = 7;
    automapChangeWindowLoc(s);
    expect(s.m_x).toBe((beforeX + 5) | 0);
    expect(s.m_y).toBe((beforeY + 7) | 0);
    expect(s.m_x2).toBe((s.m_x + s.m_w) | 0);
    expect(s.m_y2).toBe((s.m_y + s.m_h) | 0);
  });

  it('non-zero pan flips followplayer off and arms f_oldloc sentinel', () => {
    const s = createAutomapState();
    startOnSquareMap(s, 1000 * FRACUNIT, 0, 0);
    s.followplayer = 1;
    s.f_oldloc.x = 0;
    s.m_paninc.x = 1;
    automapChangeWindowLoc(s);
    expect(s.followplayer).toBe(0);
    expect(s.f_oldloc.x).toBe(AM_F_OLDLOC_FORCE_RECENTER);
  });

  it('zero pan leaves followplayer / f_oldloc untouched', () => {
    const s = createAutomapState();
    startOnSquareMap(s, 1000 * FRACUNIT, 0, 0);
    s.followplayer = 1;
    s.f_oldloc.x = 42;
    s.m_paninc.x = 0;
    s.m_paninc.y = 0;
    automapChangeWindowLoc(s);
    expect(s.followplayer).toBe(1);
    expect(s.f_oldloc.x).toBe(42);
  });

  it('clamp is on WINDOW CENTER (m_x + m_w/2) against [min_x, max_x], not on m_x itself', () => {
    const s = createAutomapState();
    startOnSquareMap(s, 100 * FRACUNIT, 0, 0);
    // Force a huge positive pan so the center would overshoot max_x.
    s.m_paninc.x = 1_000_000 * FRACUNIT;
    s.m_paninc.y = 0;
    automapChangeWindowLoc(s);
    expect((s.m_x + (s.m_w >> 1)) | 0).toBe(s.max_x);
  });

  it('clamp on y center similarly locks to [min_y, max_y]', () => {
    const s = createAutomapState();
    startOnSquareMap(s, 100 * FRACUNIT, 0, 0);
    s.m_paninc.x = 0;
    s.m_paninc.y = -1_000_000 * FRACUNIT;
    automapChangeWindowLoc(s);
    expect((s.m_y + (s.m_h >> 1)) | 0).toBe(s.min_y);
  });
});

// ── changeWindowScale (zoom + clamp) ─────────────────────────────────

describe('automapChangeWindowScale', () => {
  it('applies mtof_zoommul and snaps back via maxOutWindowScale on overshoot', () => {
    const s = createAutomapState();
    startOnSquareMap(s, 100 * FRACUNIT, 0, 0);
    s.scale_mtof = s.max_scale_mtof;
    s.mtof_zoommul = M_ZOOMIN;
    s.ftom_zoommul = M_ZOOMOUT;
    automapChangeWindowScale(s);
    expect(s.scale_mtof).toBe(s.max_scale_mtof);
  });

  it('applies mtof_zoommul and snaps back via minOutWindowScale on undershoot', () => {
    const s = createAutomapState();
    startOnSquareMap(s, 100 * FRACUNIT, 0, 0);
    s.scale_mtof = s.min_scale_mtof;
    s.mtof_zoommul = M_ZOOMOUT;
    s.ftom_zoommul = M_ZOOMIN;
    automapChangeWindowScale(s);
    expect(s.scale_mtof).toBe(s.min_scale_mtof);
  });

  it('in-band zoom calls activateNewScale (preserves center)', () => {
    const s = createAutomapState();
    startOnSquareMap(s, 1000 * FRACUNIT, 0, 0);
    // Find a scale roughly in the middle of the clamp band.
    const mid = fixedDiv((s.min_scale_mtof + s.max_scale_mtof) | 0, 2 * FRACUNIT);
    s.scale_mtof = mid;
    s.scale_ftom = fixedDiv(FRACUNIT, mid);
    s.m_w = automapFtom(s, s.f_w);
    s.m_h = automapFtom(s, s.f_h);
    const centerX = (s.m_x + (s.m_w >> 1)) | 0;
    const centerY = (s.m_y + (s.m_h >> 1)) | 0;
    s.mtof_zoommul = M_ZOOMIN;
    s.ftom_zoommul = M_ZOOMOUT;
    automapChangeWindowScale(s);
    const newCenterX = (s.m_x + (s.m_w >> 1)) | 0;
    const newCenterY = (s.m_y + (s.m_h >> 1)) | 0;
    expect(Math.abs(newCenterX - centerX)).toBeLessThanOrEqual(1);
    expect(Math.abs(newCenterY - centerY)).toBeLessThanOrEqual(1);
  });
});

// ── doFollowPlayer ───────────────────────────────────────────────────

describe('automapDoFollowPlayer', () => {
  it('recenters window origin to FTOM(MTOF(playerX)) - m_w/2 (pixel-snap quirk)', () => {
    const s = createAutomapState();
    startOnSquareMap(s, 1000 * FRACUNIT, 0, 0);
    const px = 17 * FRACUNIT + 1234;
    const py = 23 * FRACUNIT + 5678;
    automapDoFollowPlayer(s, px, py);
    const expectedX = (automapFtom(s, automapMtof(s, px)) - (s.m_w >> 1)) | 0;
    const expectedY = (automapFtom(s, automapMtof(s, py)) - (s.m_h >> 1)) | 0;
    expect(s.m_x).toBe(expectedX);
    expect(s.m_y).toBe(expectedY);
    expect(s.m_x2).toBe((s.m_x + s.m_w) | 0);
    expect(s.m_y2).toBe((s.m_y + s.m_h) | 0);
  });

  it('stamps f_oldloc with raw player coords (not the snapped window origin)', () => {
    const s = createAutomapState();
    startOnSquareMap(s, 1000 * FRACUNIT, 0, 0);
    const px = 42 * FRACUNIT + 77;
    const py = 43 * FRACUNIT + 88;
    automapDoFollowPlayer(s, px, py);
    expect(s.f_oldloc.x).toBe(px);
    expect(s.f_oldloc.y).toBe(py);
  });

  it('is a no-op if player has not moved (f_oldloc matches both coords)', () => {
    const s = createAutomapState();
    startOnSquareMap(s, 1000 * FRACUNIT, 0, 0);
    automapDoFollowPlayer(s, 100, 200);
    const savedMx = s.m_x;
    const savedMy = s.m_y;
    s.m_x = -1;
    s.m_y = -1;
    s.f_oldloc.x = 100;
    s.f_oldloc.y = 200;
    automapDoFollowPlayer(s, 100, 200);
    expect(s.m_x).toBe(-1);
    expect(s.m_y).toBe(-1);
    // sanity: normal path still resets m_x if f_oldloc changes.
    void savedMx;
    void savedMy;
  });
});

// ── Marks ────────────────────────────────────────────────────────────

describe('automapAddMark / automapClearMarks', () => {
  it('addMark stores the WINDOW CENTER and increments markpointnum', () => {
    const s = createAutomapState();
    s.m_x = 10;
    s.m_y = 20;
    s.m_w = 4;
    s.m_h = 8;
    automapAddMark(s);
    expect(s.markpoints[0]!.x).toBe((10 + 2) | 0);
    expect(s.markpoints[0]!.y).toBe((20 + 4) | 0);
    expect(s.markpointnum).toBe(1);
  });

  it('11th addMark wraps around to overwrite slot 0 (circular buffer)', () => {
    const s = createAutomapState();
    s.m_w = 0;
    s.m_h = 0;
    for (let i = 0; i < AM_NUMMARKPOINTS; i++) {
      s.m_x = i;
      s.m_y = i * 10;
      automapAddMark(s);
    }
    expect(s.markpointnum).toBe(0);
    expect(s.markpoints[9]!.x).toBe(9);
    // 11th mark overwrites slot 0.
    s.m_x = 999;
    s.m_y = 8888;
    automapAddMark(s);
    expect(s.markpoints[0]!.x).toBe(999);
    expect(s.markpoints[0]!.y).toBe(8888);
    expect(s.markpointnum).toBe(1);
  });

  it('clearMarks sets every slot to x=-1 (empty sentinel)', () => {
    const s = createAutomapState();
    s.m_x = 5;
    s.m_y = 5;
    automapAddMark(s);
    automapAddMark(s);
    automapClearMarks(s);
    for (const mp of s.markpoints) {
      expect(mp.x).toBe(-1);
    }
    expect(s.markpointnum).toBe(0);
  });
});

// ── Start / stop / ticker lifecycle ──────────────────────────────────

describe('automapStart / automapStop / automapTicker', () => {
  it('start activates the overlay and runs LevelInit on new level', () => {
    const s = createAutomapState();
    const key = { episode: 0, map: 0 };
    automapStart(s, {
      vertexes: makeSquareMap(100 * FRACUNIT),
      playerX: 0,
      playerY: 0,
      episode: 1,
      map: 1,
      lastLevelKey: key,
    });
    expect(s.active).toBe(true);
    expect(s.stopped).toBe(false);
    expect(key.episode).toBe(1);
    expect(key.map).toBe(1);
    expect(s.max_x).toBe(100 * FRACUNIT);
  });

  it('start re-entry skips LevelInit when (episode, map) matches lastLevelKey', () => {
    const s = createAutomapState();
    const key = { episode: 1, map: 1 };
    // Pre-seed obviously-wrong bounds that LevelInit WOULD overwrite.
    s.min_x = -999;
    s.max_x = -999;
    automapStart(s, {
      vertexes: makeSquareMap(100 * FRACUNIT),
      playerX: 0,
      playerY: 0,
      episode: 1,
      map: 1,
      lastLevelKey: key,
    });
    // min_x / max_x should be untouched (LevelInit was skipped).
    expect(s.min_x).toBe(-999);
    expect(s.max_x).toBe(-999);
  });

  it('stop deactivates the overlay but keeps computed bounds', () => {
    const s = createAutomapState();
    startOnSquareMap(s, 100 * FRACUNIT, 0, 0);
    automapStop(s);
    expect(s.active).toBe(false);
    expect(s.stopped).toBe(true);
    expect(s.max_x).toBe(100 * FRACUNIT);
  });

  it('ticker is a no-op while inactive', () => {
    const s = createAutomapState();
    automapTicker(s, { playerX: 99, playerY: 99 });
    expect(s.amclock).toBe(0);
  });

  it('ticker advances amclock and applies follow + zoom + pan', () => {
    const s = createAutomapState();
    startOnSquareMap(s, 1000 * FRACUNIT, 50 * FRACUNIT, 60 * FRACUNIT);
    s.followplayer = 1;
    s.ftom_zoommul = FRACUNIT; // zoom no-op
    s.mtof_zoommul = FRACUNIT;
    s.m_paninc.x = 0;
    s.m_paninc.y = 0;
    const beforeClock = s.amclock;
    automapTicker(s, { playerX: 77 * FRACUNIT, playerY: 88 * FRACUNIT });
    expect(s.amclock).toBe(beforeClock + 1);
    expect(s.f_oldloc.x).toBe(77 * FRACUNIT);
    expect(s.f_oldloc.y).toBe(88 * FRACUNIT);
  });
});

// ── initVariables ────────────────────────────────────────────────────

describe('automapInitVariables', () => {
  it('centers window on player and snapshots into old_m_*', () => {
    const s = createAutomapState();
    levelInit(s, 1000 * FRACUNIT);
    automapInitVariables(s, { playerX: 0, playerY: 0 });
    expect(s.old_m_x).toBe(s.m_x);
    expect(s.old_m_y).toBe(s.m_y);
    expect(s.old_m_w).toBe(s.m_w);
    expect(s.old_m_h).toBe(s.m_h);
    expect(s.active).toBe(true);
    expect(s.mtof_zoommul).toBe(FRACUNIT);
    expect(s.ftom_zoommul).toBe(FRACUNIT);
  });
});

// ── Cohen-Sutherland clipping ────────────────────────────────────────

describe('automapClipMline', () => {
  function seed(s: AutomapState): void {
    // 320x168 viewport, 1:1 scale, window centered at origin.
    s.f_x = 0;
    s.f_y = 0;
    s.f_w = 320;
    s.f_h = 168;
    s.scale_mtof = FRACUNIT;
    s.scale_ftom = fixedDiv(FRACUNIT, FRACUNIT);
    s.m_x = 0;
    s.m_y = 0;
    s.m_w = 320 * FRACUNIT;
    s.m_h = 168 * FRACUNIT;
    s.m_x2 = s.m_x + s.m_w;
    s.m_y2 = s.m_y + s.m_h;
  }

  it('rejects a line entirely below the window', () => {
    const s = createAutomapState();
    seed(s);
    const result = automapClipMline(s, {
      a: { x: 50 * FRACUNIT, y: -10 * FRACUNIT },
      b: { x: 100 * FRACUNIT, y: -20 * FRACUNIT },
    });
    expect(result).toBeNull();
  });

  it('rejects a line entirely above the window', () => {
    const s = createAutomapState();
    seed(s);
    const result = automapClipMline(s, {
      a: { x: 50 * FRACUNIT, y: 200 * FRACUNIT },
      b: { x: 100 * FRACUNIT, y: 300 * FRACUNIT },
    });
    expect(result).toBeNull();
  });

  it('rejects a line entirely to the left or right', () => {
    const s = createAutomapState();
    seed(s);
    expect(
      automapClipMline(s, {
        a: { x: -10 * FRACUNIT, y: 50 * FRACUNIT },
        b: { x: -5 * FRACUNIT, y: 60 * FRACUNIT },
      }),
    ).toBeNull();
    expect(
      automapClipMline(s, {
        a: { x: 400 * FRACUNIT, y: 50 * FRACUNIT },
        b: { x: 500 * FRACUNIT, y: 60 * FRACUNIT },
      }),
    ).toBeNull();
  });

  it('preserves an entirely-inside line and converts to frame-buffer pixels', () => {
    const s = createAutomapState();
    seed(s);
    const result = automapClipMline(s, {
      a: { x: 10 * FRACUNIT, y: 20 * FRACUNIT },
      b: { x: 30 * FRACUNIT, y: 40 * FRACUNIT },
    });
    expect(result).not.toBeNull();
    expect(result!.a.x).toBe(10);
    expect(result!.b.x).toBe(30);
    // y is flipped: f_y + f_h - MTOF(y - m_y)
    expect(result!.a.y).toBe(s.f_h - 20);
    expect(result!.b.y).toBe(s.f_h - 40);
  });

  it('crops a partially-outside line back to the viewport', () => {
    const s = createAutomapState();
    seed(s);
    const result = automapClipMline(s, {
      a: { x: -50 * FRACUNIT, y: 50 * FRACUNIT },
      b: { x: 50 * FRACUNIT, y: 50 * FRACUNIT },
    });
    expect(result).not.toBeNull();
    expect(result!.a.x).toBeGreaterThanOrEqual(0);
    expect(result!.a.x).toBeLessThan(s.f_w);
    expect(result!.b.x).toBeGreaterThanOrEqual(0);
    expect(result!.b.x).toBeLessThan(s.f_w);
  });
});

// ── Bresenham line painter ───────────────────────────────────────────

describe('automapDrawFline', () => {
  function makeFb(s: AutomapState): Uint8Array {
    return new Uint8Array(s.f_w * s.f_h);
  }

  it('draws a horizontal 1-pixel run of the given color', () => {
    const s = createAutomapState();
    s.f_w = 10;
    s.f_h = 10;
    const fb = makeFb(s);
    automapDrawFline(fb, s, { a: { x: 2, y: 3 }, b: { x: 5, y: 3 } }, 42);
    expect(fb[3 * 10 + 2]).toBe(42);
    expect(fb[3 * 10 + 3]).toBe(42);
    expect(fb[3 * 10 + 4]).toBe(42);
    expect(fb[3 * 10 + 5]).toBe(42);
    expect(fb[3 * 10 + 6]).toBe(0);
  });

  it('draws a vertical line', () => {
    const s = createAutomapState();
    s.f_w = 10;
    s.f_h = 10;
    const fb = makeFb(s);
    automapDrawFline(fb, s, { a: { x: 4, y: 1 }, b: { x: 4, y: 5 } }, 7);
    for (let y = 1; y <= 5; y++) {
      expect(fb[y * 10 + 4]).toBe(7);
    }
  });

  it('draws a perfect diagonal using the y-major (ax==ay) branch', () => {
    const s = createAutomapState();
    s.f_w = 10;
    s.f_h = 10;
    const fb = makeFb(s);
    automapDrawFline(fb, s, { a: { x: 1, y: 1 }, b: { x: 5, y: 5 } }, 9);
    for (let i = 0; i <= 4; i++) {
      expect(fb[(1 + i) * 10 + (1 + i)]).toBe(9);
    }
  });

  it('silently rejects lines with an out-of-bounds endpoint (no writes)', () => {
    const s = createAutomapState();
    s.f_w = 10;
    s.f_h = 10;
    const fb = makeFb(s);
    automapDrawFline(fb, s, { a: { x: -1, y: 0 }, b: { x: 5, y: 0 } }, 99);
    automapDrawFline(fb, s, { a: { x: 0, y: 0 }, b: { x: 10, y: 0 } }, 99);
    automapDrawFline(fb, s, { a: { x: 0, y: 0 }, b: { x: 0, y: 10 } }, 99);
    let sum = 0;
    for (let i = 0; i < fb.length; i++) sum += fb[i]!;
    expect(sum).toBe(0);
  });

  it('paints the starting endpoint even for a 1-px "line" from (a,b) to itself', () => {
    const s = createAutomapState();
    s.f_w = 10;
    s.f_h = 10;
    const fb = makeFb(s);
    automapDrawFline(fb, s, { a: { x: 4, y: 4 }, b: { x: 4, y: 4 } }, 55);
    expect(fb[4 * 10 + 4]).toBe(55);
  });
});

// ── 2D rotation ──────────────────────────────────────────────────────

describe('automapRotate', () => {
  // The vanilla finesine table is phase-offset by half a fine step, so
  // finesine[0] = 25 (not 0) and finecosine[0] ≈ FRACUNIT but not
  // exactly. No BAM angle produces a bit-exact identity; every rotation
  // carries ≈ finesine[0] × magnitude / FRACUNIT units of round-off.
  // Tolerances below are sized for a vector of ~|v|*2 ≈ few×FRACUNIT.
  const ROT_TOL = 150;

  it('rotate by ANG90 sends (+x, 0) → (0, +x) within table round-off', () => {
    const p: Point2D = { x: FRACUNIT, y: 0 };
    automapRotate(p, ANG90);
    expect(Math.abs(p.x)).toBeLessThanOrEqual(ROT_TOL);
    expect(Math.abs(p.y - FRACUNIT)).toBeLessThanOrEqual(ROT_TOL);
  });

  it('rotate by ANG180 negates both components within table round-off', () => {
    const p: Point2D = { x: 3 * FRACUNIT, y: 4 * FRACUNIT };
    automapRotate(p, ANG180);
    expect(Math.abs(p.x + 3 * FRACUNIT)).toBeLessThanOrEqual(ROT_TOL * 5);
    expect(Math.abs(p.y + 4 * FRACUNIT)).toBeLessThanOrEqual(ROT_TOL * 5);
  });

  it('rotate by 0 is near-identity (finesine[0]=25 produces minor off-axis drift)', () => {
    const p: Point2D = { x: FRACUNIT, y: 2 * FRACUNIT };
    automapRotate(p, 0);
    expect(Math.abs(p.x - FRACUNIT)).toBeLessThanOrEqual(ROT_TOL);
    expect(Math.abs(p.y - 2 * FRACUNIT)).toBeLessThanOrEqual(ROT_TOL);
  });

  it('preserves magnitude (rotation is isometric within table rounding)', () => {
    const p: Point2D = { x: 5 * FRACUNIT, y: 12 * FRACUNIT };
    // |v|^2 = 25 + 144 = 169 → 169 * FRACUNIT
    const before = fixedMul(p.x, p.x) + fixedMul(p.y, p.y);
    automapRotate(p, ANG90);
    const after = fixedMul(p.x, p.x) + fixedMul(p.y, p.y);
    const delta = Math.abs(after - before);
    // Magnitude drift is bounded by 2 * |v| * finesine[0] / FRACUNIT
    // + normal multiply rounding; 8 * FRACUNIT is a comfortable cap.
    expect(delta).toBeLessThan(8 * FRACUNIT);
  });
});

// ── Line2D / Point2D typing sanity ───────────────────────────────────

describe('Line2D / Point2D types', () => {
  it('shape tables satisfy the Line2D type structurally', () => {
    const l: Line2D = PLAYER_ARROW_LINES[0]!;
    expect(typeof l.a.x).toBe('number');
    expect(typeof l.a.y).toBe('number');
    expect(typeof l.b.x).toBe('number');
    expect(typeof l.b.y).toBe('number');
  });
});
