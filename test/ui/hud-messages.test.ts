import { describe, expect, it } from 'bun:test';

import { createPlayer } from '../../src/player/playerSpawn.ts';

import type { Player } from '../../src/player/playerSpawn.ts';

import {
  DOOM1_MAP_NAMES,
  HU_MAXLINELENGTH,
  HU_MSGHEIGHT,
  HU_MSGTIMEOUT,
  HU_MSGWIDTH,
  HU_MSGX,
  HU_MSGY,
  HU_TITLEHEIGHT,
  HU_TITLEX,
  HU_TITLEY,
  HUSTR_E1M1,
  HUSTR_E1M9,
  HUSTR_E2M1,
  HUSTR_E3M9,
  HUSTR_E4M1,
  HUSTR_E4M9,
  TICRATE,
  createHudMessageState,
  getDoom1MapName,
  hudMessageStart,
  requestHudMessageRefresh,
  tickHudMessages,
} from '../../src/ui/hudMessages.ts';

import type { HudMessageState, HudMessageTickContext } from '../../src/ui/hudMessages.ts';

// ── Test helpers ─────────────────────────────────────────────────────

function makePlayer(overrides: Partial<Player> = {}): Player {
  const player = createPlayer();
  Object.assign(player, overrides);
  return player;
}

function makeCtx(player: Player, showMessages = true): HudMessageTickContext {
  return { player, showMessages };
}

// ── Constants ────────────────────────────────────────────────────────

describe('HUD message constants', () => {
  it('TICRATE is 35 tics per second', () => {
    expect(TICRATE).toBe(35);
  });

  it('HU_MSGTIMEOUT is 4 * TICRATE = 140', () => {
    expect(HU_MSGTIMEOUT).toBe(140);
    expect(HU_MSGTIMEOUT).toBe(4 * TICRATE);
  });

  it('HU_MSGX / HU_MSGY are 0/0 (top-left origin)', () => {
    expect(HU_MSGX).toBe(0);
    expect(HU_MSGY).toBe(0);
  });

  it('HU_MSGHEIGHT is 1 line, HU_MSGWIDTH is 64 chars', () => {
    expect(HU_MSGHEIGHT).toBe(1);
    expect(HU_MSGWIDTH).toBe(64);
  });

  it('HU_MAXLINELENGTH is 80 (hu_lib.h constant)', () => {
    expect(HU_MAXLINELENGTH).toBe(80);
  });

  it('HU_TITLE geometry: (0, 160) with height 1', () => {
    expect(HU_TITLEX).toBe(0);
    expect(HU_TITLEY).toBe(160);
    expect(HU_TITLEHEIGHT).toBe(1);
  });
});

// ── Map name table ───────────────────────────────────────────────────

describe('DOOM1_MAP_NAMES table', () => {
  it('has exactly 36 entries (4 episodes * 9 maps)', () => {
    expect(DOOM1_MAP_NAMES).toHaveLength(36);
  });

  it('is frozen (Object.freeze)', () => {
    expect(Object.isFrozen(DOOM1_MAP_NAMES)).toBe(true);
  });

  it('indexes match the vanilla (episode-1)*9 + (map-1) formula', () => {
    expect(DOOM1_MAP_NAMES[0]).toBe(HUSTR_E1M1);
    expect(DOOM1_MAP_NAMES[8]).toBe(HUSTR_E1M9);
    expect(DOOM1_MAP_NAMES[9]).toBe(HUSTR_E2M1);
    expect(DOOM1_MAP_NAMES[26]).toBe(HUSTR_E3M9);
    expect(DOOM1_MAP_NAMES[27]).toBe(HUSTR_E4M1);
    expect(DOOM1_MAP_NAMES[35]).toBe(HUSTR_E4M9);
  });

  it('every entry is a non-empty string with the HUSTR "E?M?: " prefix', () => {
    for (let episode = 1; episode <= 4; episode++) {
      for (let map = 1; map <= 9; map++) {
        const title = DOOM1_MAP_NAMES[(episode - 1) * 9 + (map - 1)]!;
        expect(title.startsWith(`E${episode}M${map}: `)).toBe(true);
        expect(title.length).toBeGreaterThan(`E${episode}M${map}: `.length);
      }
    }
  });
});

describe('getDoom1MapName', () => {
  it('returns HUSTR_E1M1 for (1, 1) — the shareware first level', () => {
    expect(getDoom1MapName(1, 1)).toBe('E1M1: Hangar');
  });

  it('returns HUSTR_E4M9 for (4, 9) — the Ultimate DOOM last secret', () => {
    expect(getDoom1MapName(4, 9)).toBe('E4M9: Fear');
  });

  it('matches the raw DOOM1_MAP_NAMES table for every in-range (episode, map)', () => {
    for (let episode = 1; episode <= 4; episode++) {
      for (let map = 1; map <= 9; map++) {
        expect(getDoom1MapName(episode, map)).toBe(DOOM1_MAP_NAMES[(episode - 1) * 9 + (map - 1)]!);
      }
    }
  });

  it('throws RangeError for episode < 1', () => {
    expect(() => getDoom1MapName(0, 1)).toThrow(RangeError);
  });

  it('throws RangeError for episode > 4', () => {
    expect(() => getDoom1MapName(5, 1)).toThrow(RangeError);
  });

  it('throws RangeError for map < 1', () => {
    expect(() => getDoom1MapName(1, 0)).toThrow(RangeError);
  });

  it('throws RangeError for map > 9', () => {
    expect(() => getDoom1MapName(1, 10)).toThrow(RangeError);
  });

  it('throws RangeError for non-integer episode', () => {
    expect(() => getDoom1MapName(1.5, 1)).toThrow(RangeError);
  });

  it('throws RangeError for non-integer map', () => {
    expect(() => getDoom1MapName(1, 1.5)).toThrow(RangeError);
  });
});

// ── Constructors / Resetters ─────────────────────────────────────────

describe('createHudMessageState', () => {
  it('returns every field at its vanilla HU_Init default', () => {
    const state = createHudMessageState();
    expect(state.currentMessage).toBe(null);
    expect(state.messageOn).toBe(false);
    expect(state.messageCounter).toBe(0);
    expect(state.messageProtected).toBe(false);
    expect(state.messageForce).toBe(false);
    expect(state.mapTitle).toBe(null);
  });

  it('returns a distinct mutable object on each call', () => {
    const a = createHudMessageState();
    const b = createHudMessageState();
    expect(a).not.toBe(b);
    a.messageCounter = 42;
    expect(b.messageCounter).toBe(0);
  });
});

describe('hudMessageStart', () => {
  it('clears every transient field and leaves mapTitle null by default', () => {
    const state: HudMessageState = {
      currentMessage: 'old',
      messageOn: true,
      messageCounter: 99,
      messageProtected: true,
      messageForce: true,
      mapTitle: 'E1M1: Hangar',
    };
    hudMessageStart(state);
    expect(state.currentMessage).toBe(null);
    expect(state.messageOn).toBe(false);
    expect(state.messageCounter).toBe(0);
    expect(state.messageProtected).toBe(false);
    expect(state.messageForce).toBe(false);
    expect(state.mapTitle).toBe(null);
  });

  it('binds a new map title when given one', () => {
    const state = createHudMessageState();
    hudMessageStart(state, getDoom1MapName(1, 1));
    expect(state.mapTitle).toBe('E1M1: Hangar');
  });

  it('prevents a protected message from the previous level leaking into the new level', () => {
    const state: HudMessageState = {
      currentMessage: 'Chat from E1M1',
      messageOn: true,
      messageCounter: 30,
      messageProtected: true,
      messageForce: false,
      mapTitle: 'E1M1: Hangar',
    };
    hudMessageStart(state, 'E1M2: Nuclear Plant');
    expect(state.messageProtected).toBe(false);
    expect(state.messageOn).toBe(false);
    expect(state.messageCounter).toBe(0);
    expect(state.mapTitle).toBe('E1M2: Nuclear Plant');
  });
});

describe('requestHudMessageRefresh', () => {
  it('sets messageForce on an idle state', () => {
    const state = createHudMessageState();
    requestHudMessageRefresh(state);
    expect(state.messageForce).toBe(true);
  });

  it('is idempotent when messageForce is already true', () => {
    const state = createHudMessageState();
    state.messageForce = true;
    requestHudMessageRefresh(state);
    expect(state.messageForce).toBe(true);
  });
});

// ── Ticker ───────────────────────────────────────────────────────────

describe('tickHudMessages: normal display path', () => {
  it('displays a pending player.message on the next tic and drains it', () => {
    const state = createHudMessageState();
    const player = makePlayer({ message: 'Picked up a medikit.' });
    tickHudMessages(state, makeCtx(player));

    expect(state.currentMessage).toBe('Picked up a medikit.');
    expect(state.messageOn).toBe(true);
    expect(state.messageCounter).toBe(HU_MSGTIMEOUT);
    expect(state.messageProtected).toBe(false);
    expect(state.messageForce).toBe(false);
    expect(player.message).toBe(null);
  });

  it('does nothing when player.message is null and no force is armed', () => {
    const state = createHudMessageState();
    const player = makePlayer();
    tickHudMessages(state, makeCtx(player));
    expect(state.currentMessage).toBe(null);
    expect(state.messageOn).toBe(false);
    expect(state.messageCounter).toBe(0);
  });
});

describe('tickHudMessages: counter decrement and expiry', () => {
  it('counter 0 does NOT decrement (vanilla short-circuit)', () => {
    const state = createHudMessageState();
    const player = makePlayer();
    tickHudMessages(state, makeCtx(player));
    expect(state.messageCounter).toBe(0);
  });

  it('counter decrements one per tic and messageOn stays true until the counter reaches 0', () => {
    const state = createHudMessageState();
    const player = makePlayer({ message: 'Argh!' });
    tickHudMessages(state, makeCtx(player));
    expect(state.messageCounter).toBe(HU_MSGTIMEOUT);
    expect(state.messageOn).toBe(true);

    for (let i = 0; i < HU_MSGTIMEOUT - 1; i++) {
      tickHudMessages(state, makeCtx(player));
    }
    expect(state.messageCounter).toBe(1);
    expect(state.messageOn).toBe(true);

    tickHudMessages(state, makeCtx(player));
    expect(state.messageCounter).toBe(0);
    expect(state.messageOn).toBe(false);
    expect(state.messageProtected).toBe(false);
  });

  it('leaves currentMessage populated after expiry (draw layer may render trailing frame)', () => {
    const state = createHudMessageState();
    const player = makePlayer({ message: 'Argh!' });
    tickHudMessages(state, makeCtx(player));
    for (let i = 0; i < HU_MSGTIMEOUT; i++) {
      tickHudMessages(state, makeCtx(player));
    }
    expect(state.messageOn).toBe(false);
    expect(state.currentMessage).toBe('Argh!');
  });
});

describe('tickHudMessages: protected-message hold', () => {
  it('holds a new player.message on the player while the current message is protected', () => {
    const state = createHudMessageState();
    const player = makePlayer({ message: 'Say: hi everyone' });
    // Protect the first message via the refresh key pathway.
    requestHudMessageRefresh(state);
    tickHudMessages(state, makeCtx(player));
    expect(state.currentMessage).toBe('Say: hi everyone');
    expect(state.messageProtected).toBe(true);

    player.message = 'Picked up a medikit.';
    tickHudMessages(state, makeCtx(player));
    expect(state.currentMessage).toBe('Say: hi everyone');
    expect(player.message).toBe('Picked up a medikit.');
  });

  it('releases the hold and displays the queued message once the protected counter expires', () => {
    const state = createHudMessageState();
    const player = makePlayer({ message: 'Say: hi everyone' });
    requestHudMessageRefresh(state);
    tickHudMessages(state, makeCtx(player));
    expect(state.messageProtected).toBe(true);

    player.message = 'Picked up a medikit.';
    for (let i = 0; i < HU_MSGTIMEOUT; i++) {
      tickHudMessages(state, makeCtx(player));
    }
    // At this point the protected message has expired and the queued
    // pickup was displayed on the last tic.
    expect(state.currentMessage).toBe('Picked up a medikit.');
    expect(state.messageOn).toBe(true);
    expect(state.messageProtected).toBe(false);
    expect(player.message).toBeNull();
  });
});

describe('tickHudMessages: messageForce override and inheritance', () => {
  it('forces display over a protected message AND inherits protection', () => {
    const state = createHudMessageState();
    const player = makePlayer({ message: 'Protected chat' });
    requestHudMessageRefresh(state);
    tickHudMessages(state, makeCtx(player));
    expect(state.messageProtected).toBe(true);

    player.message = 'Forced pickup';
    requestHudMessageRefresh(state);
    tickHudMessages(state, makeCtx(player));
    expect(state.currentMessage).toBe('Forced pickup');
    expect(state.messageProtected).toBe(true);
    expect(state.messageForce).toBe(false);
    expect(state.messageCounter).toBe(HU_MSGTIMEOUT);
  });

  it('the inherited force-turned-protection itself expires after HU_MSGTIMEOUT', () => {
    const state = createHudMessageState();
    const player = makePlayer({ message: 'Forced' });
    requestHudMessageRefresh(state);
    tickHudMessages(state, makeCtx(player));
    for (let i = 0; i < HU_MSGTIMEOUT; i++) {
      tickHudMessages(state, makeCtx(player));
    }
    expect(state.messageOn).toBe(false);
    expect(state.messageProtected).toBe(false);
  });
});

describe('tickHudMessages: showMessages suppression', () => {
  it('showMessages=false silences non-forced messages (keeps player.message queued)', () => {
    const state = createHudMessageState();
    const player = makePlayer({ message: 'Picked up a medikit.' });
    tickHudMessages(state, makeCtx(player, false));
    expect(state.currentMessage).toBe(null);
    expect(state.messageOn).toBe(false);
    expect(player.message).toBe('Picked up a medikit.');
  });

  it('showMessages=false + messageForce still forces exactly one display', () => {
    const state = createHudMessageState();
    const player = makePlayer({ message: 'Forced.' });
    requestHudMessageRefresh(state);
    tickHudMessages(state, makeCtx(player, false));
    expect(state.currentMessage).toBe('Forced.');
    expect(state.messageOn).toBe(true);
    expect(state.messageForce).toBe(false);
    expect(state.messageProtected).toBe(true);
    expect(player.message).toBe(null);
  });
});

describe('tickHudMessages: force flag persistence when no message is pending', () => {
  it('force stays armed across an idle tick and fires on the next queued message', () => {
    const state = createHudMessageState();
    const player = makePlayer();
    requestHudMessageRefresh(state);

    tickHudMessages(state, makeCtx(player));
    expect(state.messageForce).toBe(true);
    expect(state.currentMessage).toBe(null);

    player.message = 'Eventual pickup';
    tickHudMessages(state, makeCtx(player));
    expect(state.currentMessage).toBe('Eventual pickup');
    expect(state.messageProtected).toBe(true);
    expect(state.messageForce).toBe(false);
    expect(player.message).toBeNull();
  });
});
