import { describe, expect, it } from 'bun:test';

import { PowerType } from '../../src/player/playerSpawn.ts';
import type { SectorSpecialCallbacks, SectorSpecialPlayer, SectorSpecialSector } from '../../src/specials/sectorSpecials.ts';
import {
  CF_GODMODE,
  DAMAGE_EXIT_SUPER,
  DAMAGE_HELLSLIME,
  DAMAGE_NUKAGE,
  DAMAGE_STROBE_SUPER,
  DAMAGE_TICK_MASK,
  EXIT_DAMAGE_HEALTH_THRESHOLD,
  IRONFEET_BYPASS_THRESHOLD,
  SectorSpecial,
  playerInSpecialSector,
} from '../../src/specials/sectorSpecials.ts';

// ── Harness helpers ─────────────────────────────────────────────────

interface HarnessEvent {
  readonly kind: 'damage' | 'exit' | 'random';
  readonly value?: number;
}

function makeHarness(randomValues: readonly number[] = []): {
  callbacks: SectorSpecialCallbacks;
  events: HarnessEvent[];
} {
  const events: HarnessEvent[] = [];
  const queue = [...randomValues];
  return {
    callbacks: {
      damage(amount: number) {
        events.push({ kind: 'damage', value: amount });
      },
      exitLevel() {
        events.push({ kind: 'exit' });
      },
      random() {
        const v = queue.shift();
        if (v === undefined) {
          throw new Error('random queue exhausted');
        }
        events.push({ kind: 'random', value: v });
        return v;
      },
    },
    events,
  };
}

function makePlayer(overrides: Partial<{ z: number; powers: number[]; cheats: number; health: number; secretcount: number }> = {}): SectorSpecialPlayer {
  const powers = overrides.powers ?? [0, 0, 0, 0, 0, 0];
  return {
    mo: { z: overrides.z ?? 0 },
    powers,
    cheats: overrides.cheats ?? 0,
    health: overrides.health ?? 100,
    secretcount: overrides.secretcount ?? 0,
  };
}

function makeSector(special: number, floorheight = 0): SectorSpecialSector {
  return { floorheight, special };
}

// ── Constants ───────────────────────────────────────────────────────

describe('sector special constants', () => {
  it('pins the leveltime damage-tick mask to 0x1f', () => {
    expect(DAMAGE_TICK_MASK).toBe(0x1f);
  });

  it('pins vanilla CF_GODMODE bit to 2', () => {
    expect(CF_GODMODE).toBe(2);
  });

  it('pins ironfeet bypass threshold to vanilla P_Random()<5', () => {
    expect(IRONFEET_BYPASS_THRESHOLD).toBe(5);
  });

  it('pins case-11 health-exit threshold to vanilla <=10', () => {
    expect(EXIT_DAMAGE_HEALTH_THRESHOLD).toBe(10);
  });

  it('pins per-case damage amounts', () => {
    expect(DAMAGE_HELLSLIME).toBe(10);
    expect(DAMAGE_NUKAGE).toBe(5);
    expect(DAMAGE_STROBE_SUPER).toBe(20);
    expect(DAMAGE_EXIT_SUPER).toBe(20);
  });

  it('pins the enum ids for every dispatchable sector special', () => {
    expect(SectorSpecial.strobeHurt).toBe(4);
    expect(SectorSpecial.hellslimeDamage).toBe(5);
    expect(SectorSpecial.nukageDamage).toBe(7);
    expect(SectorSpecial.secretSector).toBe(9);
    expect(SectorSpecial.exitSuperDamage).toBe(11);
    expect(SectorSpecial.superHellslimeDamage).toBe(16);
  });
});

// ── Airborne guard ──────────────────────────────────────────────────

describe('airborne guard', () => {
  it('no damage fires when player.mo.z is above floorheight', () => {
    const { callbacks, events } = makeHarness();
    const player = makePlayer({ z: 64 });
    const sector = makeSector(SectorSpecial.nukageDamage, 0);
    playerInSpecialSector(player, sector, 0, callbacks);
    expect(events).toEqual([]);
  });

  it('no secret is credited while airborne', () => {
    const { callbacks, events } = makeHarness();
    const player = makePlayer({ z: 8 });
    const sector = makeSector(SectorSpecial.secretSector, 0);
    playerInSpecialSector(player, sector, 0, callbacks);
    expect(events).toEqual([]);
    expect(player.secretcount).toBe(0);
    expect(sector.special).toBe(SectorSpecial.secretSector);
  });

  it('no exit fires while airborne even at 0 health', () => {
    const { callbacks, events } = makeHarness();
    const player = makePlayer({ z: 1, health: 0 });
    const sector = makeSector(SectorSpecial.exitSuperDamage, 0);
    playerInSpecialSector(player, sector, 0, callbacks);
    expect(events).toEqual([]);
  });

  it('fires when z equals floorheight at a non-zero floor', () => {
    const { callbacks, events } = makeHarness();
    const player = makePlayer({ z: 128 });
    const sector = makeSector(SectorSpecial.nukageDamage, 128);
    playerInSpecialSector(player, sector, 0, callbacks);
    expect(events).toEqual([{ kind: 'damage', value: DAMAGE_NUKAGE }]);
  });

  it('fires at negative floor heights when feet are negative too', () => {
    const { callbacks, events } = makeHarness();
    const player = makePlayer({ z: -256 });
    const sector = makeSector(SectorSpecial.hellslimeDamage, -256);
    playerInSpecialSector(player, sector, 0, callbacks);
    expect(events).toEqual([{ kind: 'damage', value: DAMAGE_HELLSLIME }]);
  });
});

// ── Hellslime (special 5) ───────────────────────────────────────────

describe('case 5 — hellslime damage', () => {
  it('damages 10 when not suited on a tick tic', () => {
    const { callbacks, events } = makeHarness();
    const player = makePlayer();
    const sector = makeSector(SectorSpecial.hellslimeDamage);
    playerInSpecialSector(player, sector, 0, callbacks);
    expect(events).toEqual([{ kind: 'damage', value: 10 }]);
  });

  it('no damage when suited, even on a tick tic', () => {
    const { callbacks, events } = makeHarness();
    const powers = [0, 0, 0, 1, 0, 0];
    powers[PowerType.IRONFEET] = 1800;
    const player = makePlayer({ powers });
    const sector = makeSector(SectorSpecial.hellslimeDamage);
    playerInSpecialSector(player, sector, 0, callbacks);
    expect(events).toEqual([]);
  });

  it('no damage when not a tick tic (leveltime & 0x1f !== 0)', () => {
    const { callbacks, events } = makeHarness();
    const player = makePlayer();
    const sector = makeSector(SectorSpecial.hellslimeDamage);
    playerInSpecialSector(player, sector, 1, callbacks);
    expect(events).toEqual([]);
  });

  it('leveltime==32 fires (next cadence boundary)', () => {
    const { callbacks, events } = makeHarness();
    const player = makePlayer();
    const sector = makeSector(SectorSpecial.hellslimeDamage);
    playerInSpecialSector(player, sector, 32, callbacks);
    expect(events).toEqual([{ kind: 'damage', value: 10 }]);
  });

  it('leveltime==31 does not fire but leveltime==0 does — 32-tic cadence', () => {
    const player = makePlayer();
    const sector = makeSector(SectorSpecial.hellslimeDamage);
    const h31 = makeHarness();
    playerInSpecialSector(player, sector, 31, h31.callbacks);
    expect(h31.events).toEqual([]);
    const h0 = makeHarness();
    playerInSpecialSector(player, sector, 0, h0.callbacks);
    expect(h0.events).toEqual([{ kind: 'damage', value: 10 }]);
  });

  it('does NOT consume random stream when ironfeet is off', () => {
    const { callbacks, events } = makeHarness();
    const player = makePlayer();
    const sector = makeSector(SectorSpecial.hellslimeDamage);
    playerInSpecialSector(player, sector, 0, callbacks);
    expect(events.some((e) => e.kind === 'random')).toBe(false);
  });
});

// ── Nukage (special 7) ──────────────────────────────────────────────

describe('case 7 — nukage damage', () => {
  it('damages 5 when not suited on a tick tic', () => {
    const { callbacks, events } = makeHarness();
    const player = makePlayer();
    const sector = makeSector(SectorSpecial.nukageDamage);
    playerInSpecialSector(player, sector, 0, callbacks);
    expect(events).toEqual([{ kind: 'damage', value: 5 }]);
  });

  it('no damage when suited, regardless of leveltime', () => {
    const { callbacks, events } = makeHarness();
    const powers = [0, 0, 0, 60, 0, 0];
    const player = makePlayer({ powers });
    const sector = makeSector(SectorSpecial.nukageDamage);
    playerInSpecialSector(player, sector, 0, callbacks);
    playerInSpecialSector(player, sector, 32, callbacks);
    expect(events).toEqual([]);
  });

  it('does not draw P_Random regardless of ironfeet state', () => {
    const { callbacks, events } = makeHarness();
    const powers = [0, 0, 0, 100, 0, 0];
    const player = makePlayer({ powers });
    const sector = makeSector(SectorSpecial.nukageDamage);
    playerInSpecialSector(player, sector, 0, callbacks);
    expect(events.some((e) => e.kind === 'random')).toBe(false);
  });
});

// ── Strobe hurt & super hellslime (specials 4 and 16) ──────────────

describe('cases 4 and 16 — strobe hurt / super hellslime', () => {
  for (const special of [SectorSpecial.strobeHurt, SectorSpecial.superHellslimeDamage] as const) {
    it(`special ${special}: damages 20 when not suited on a tick tic (no random draw)`, () => {
      const { callbacks, events } = makeHarness();
      const player = makePlayer();
      const sector = makeSector(special);
      playerInSpecialSector(player, sector, 0, callbacks);
      expect(events).toEqual([{ kind: 'damage', value: 20 }]);
      expect(events.some((e) => e.kind === 'random')).toBe(false);
    });

    it(`special ${special}: draws random when suited — P_Random<5 damages on tick tic`, () => {
      const { callbacks, events } = makeHarness([4]);
      const powers = [0, 0, 0, 60, 0, 0];
      const player = makePlayer({ powers });
      const sector = makeSector(special);
      playerInSpecialSector(player, sector, 0, callbacks);
      expect(events).toEqual([
        { kind: 'random', value: 4 },
        { kind: 'damage', value: 20 },
      ]);
    });

    it(`special ${special}: P_Random==5 does NOT trigger damage (strict <)`, () => {
      const { callbacks, events } = makeHarness([5]);
      const powers = [0, 0, 0, 60, 0, 0];
      const player = makePlayer({ powers });
      const sector = makeSector(special);
      playerInSpecialSector(player, sector, 0, callbacks);
      expect(events).toEqual([{ kind: 'random', value: 5 }]);
    });

    it(`special ${special}: P_Random<5 but NOT tick tic consumes random and skips damage`, () => {
      const { callbacks, events } = makeHarness([0]);
      const powers = [0, 0, 0, 60, 0, 0];
      const player = makePlayer({ powers });
      const sector = makeSector(special);
      playerInSpecialSector(player, sector, 1, callbacks);
      expect(events).toEqual([{ kind: 'random', value: 0 }]);
    });

    it(`special ${special}: suited with high random — no damage, random still drawn`, () => {
      const { callbacks, events } = makeHarness([250]);
      const powers = [0, 0, 0, 1, 0, 0];
      const player = makePlayer({ powers });
      const sector = makeSector(special);
      playerInSpecialSector(player, sector, 0, callbacks);
      expect(events).toEqual([{ kind: 'random', value: 250 }]);
    });
  }

  it('cases 4 and 16 share the exact same dispatch body', () => {
    const s4 = makeHarness([3]);
    const s16 = makeHarness([3]);
    const powers = [0, 0, 0, 50, 0, 0];
    playerInSpecialSector(makePlayer({ powers }), makeSector(SectorSpecial.strobeHurt), 0, s4.callbacks);
    playerInSpecialSector(makePlayer({ powers }), makeSector(SectorSpecial.superHellslimeDamage), 0, s16.callbacks);
    expect(s4.events).toEqual(s16.events);
  });
});

// ── Secret (special 9) ──────────────────────────────────────────────

describe('case 9 — secret sector', () => {
  it('increments secretcount and clears sector.special on touch', () => {
    const { callbacks, events } = makeHarness();
    const player = makePlayer();
    const sector = makeSector(SectorSpecial.secretSector);
    playerInSpecialSector(player, sector, 0, callbacks);
    expect(player.secretcount).toBe(1);
    expect(sector.special).toBe(0);
    expect(events).toEqual([]);
  });

  it('does not apply the leveltime tick gate — credits on any tic', () => {
    const { callbacks } = makeHarness();
    const player = makePlayer();
    const sector = makeSector(SectorSpecial.secretSector);
    playerInSpecialSector(player, sector, 7, callbacks);
    expect(player.secretcount).toBe(1);
    expect(sector.special).toBe(0);
  });

  it('does not draw P_Random', () => {
    const { callbacks, events } = makeHarness();
    const player = makePlayer();
    const sector = makeSector(SectorSpecial.secretSector);
    playerInSpecialSector(player, sector, 0, callbacks);
    expect(events.some((e) => e.kind === 'random')).toBe(false);
  });

  it('stacks secretcount across distinct secret sectors', () => {
    const { callbacks } = makeHarness();
    const player = makePlayer({ secretcount: 3 });
    const secretA = makeSector(SectorSpecial.secretSector);
    const secretB = makeSector(SectorSpecial.secretSector);
    playerInSpecialSector(player, secretA, 0, callbacks);
    playerInSpecialSector(player, secretB, 0, callbacks);
    expect(player.secretcount).toBe(5);
    expect(secretA.special).toBe(0);
    expect(secretB.special).toBe(0);
  });
});

// ── Exit super damage (special 11) ──────────────────────────────────

describe('case 11 — exit super damage (E1M8 finale)', () => {
  it('clears CF_GODMODE on every tic', () => {
    const { callbacks } = makeHarness();
    const player = makePlayer({ cheats: CF_GODMODE, health: 200 });
    const sector = makeSector(SectorSpecial.exitSuperDamage);
    playerInSpecialSector(player, sector, 1, callbacks);
    expect(player.cheats & CF_GODMODE).toBe(0);
  });

  it('preserves other cheat bits while clearing CF_GODMODE', () => {
    const { callbacks } = makeHarness();
    const player = makePlayer({ cheats: CF_GODMODE | 1 | 4, health: 200 });
    const sector = makeSector(SectorSpecial.exitSuperDamage);
    playerInSpecialSector(player, sector, 1, callbacks);
    expect(player.cheats).toBe(1 | 4);
  });

  it('damages 20 on a tick tic', () => {
    const { callbacks, events } = makeHarness();
    const player = makePlayer({ health: 200 });
    const sector = makeSector(SectorSpecial.exitSuperDamage);
    playerInSpecialSector(player, sector, 0, callbacks);
    expect(events).toEqual([{ kind: 'damage', value: 20 }]);
  });

  it('no damage on non-tick tic but health check still runs', () => {
    const { callbacks, events } = makeHarness();
    const player = makePlayer({ health: 10 });
    const sector = makeSector(SectorSpecial.exitSuperDamage);
    playerInSpecialSector(player, sector, 1, callbacks);
    expect(events).toEqual([{ kind: 'exit' }]);
  });

  it('exits when health drops to exactly 10', () => {
    const { callbacks, events } = makeHarness();
    const player = makePlayer({ health: 10 });
    const sector = makeSector(SectorSpecial.exitSuperDamage);
    playerInSpecialSector(player, sector, 1, callbacks);
    expect(events).toEqual([{ kind: 'exit' }]);
  });

  it('does not exit while health > 10', () => {
    const { callbacks, events } = makeHarness();
    const player = makePlayer({ health: 11 });
    const sector = makeSector(SectorSpecial.exitSuperDamage);
    playerInSpecialSector(player, sector, 1, callbacks);
    expect(events).toEqual([]);
  });

  it('ignores ironfeet — damage still fires through the suit', () => {
    const { callbacks, events } = makeHarness();
    const powers = [0, 0, 0, 60, 0, 0];
    const player = makePlayer({ powers, health: 200 });
    const sector = makeSector(SectorSpecial.exitSuperDamage);
    playerInSpecialSector(player, sector, 0, callbacks);
    expect(events).toEqual([{ kind: 'damage', value: 20 }]);
  });

  it('damage AND exit fire on the same tic when health ends <= 10', () => {
    const { callbacks, events } = makeHarness();
    const player = makePlayer({ health: 10 });
    const sector = makeSector(SectorSpecial.exitSuperDamage);
    playerInSpecialSector(player, sector, 0, callbacks);
    expect(events).toEqual([{ kind: 'damage', value: 20 }, { kind: 'exit' }]);
  });

  it('damage callback mutating health is observed by the post-damage exit gate', () => {
    const events: HarnessEvent[] = [];
    const player = makePlayer({ health: 30 });
    const callbacks: SectorSpecialCallbacks = {
      damage(amount) {
        player.health = Math.max(0, player.health - amount);
        events.push({ kind: 'damage', value: amount });
      },
      exitLevel() {
        events.push({ kind: 'exit' });
      },
      random() {
        throw new Error('unused');
      },
    };
    const sector = makeSector(SectorSpecial.exitSuperDamage);
    playerInSpecialSector(player, sector, 0, callbacks);
    expect(player.health).toBe(10);
    expect(events).toEqual([{ kind: 'damage', value: 20 }, { kind: 'exit' }]);
  });

  it('pre-damage health above threshold but post-damage below triggers exit', () => {
    const events: HarnessEvent[] = [];
    const player = makePlayer({ health: 15 });
    const callbacks: SectorSpecialCallbacks = {
      damage(amount) {
        player.health = Math.max(0, player.health - amount);
        events.push({ kind: 'damage', value: amount });
      },
      exitLevel() {
        events.push({ kind: 'exit' });
      },
      random() {
        throw new Error('unused');
      },
    };
    const sector = makeSector(SectorSpecial.exitSuperDamage);
    playerInSpecialSector(player, sector, 0, callbacks);
    expect(player.health).toBe(0);
    expect(events).toEqual([{ kind: 'damage', value: 20 }, { kind: 'exit' }]);
  });

  it('does not consume the random stream', () => {
    const { callbacks, events } = makeHarness();
    const player = makePlayer({ health: 200 });
    const sector = makeSector(SectorSpecial.exitSuperDamage);
    playerInSpecialSector(player, sector, 0, callbacks);
    expect(events.some((e) => e.kind === 'random')).toBe(false);
  });
});

// ── Unknown specials ────────────────────────────────────────────────

describe('unknown specials', () => {
  it('throws on any non-dispatchable non-zero special (vanilla I_Error)', () => {
    const { callbacks } = makeHarness();
    const player = makePlayer();
    const sector = makeSector(255);
    expect(() => playerInSpecialSector(player, sector, 0, callbacks)).toThrow(/unknown special 255/);
  });

  it('throws on special 3 which is animated-light-only and never reaches this path', () => {
    const { callbacks } = makeHarness();
    const player = makePlayer();
    const sector = makeSector(3);
    expect(() => playerInSpecialSector(player, sector, 0, callbacks)).toThrow(/unknown special 3/);
  });

  it('caller is responsible for skipping special 0 — if invoked, it throws', () => {
    const { callbacks } = makeHarness();
    const player = makePlayer();
    const sector = makeSector(0);
    expect(() => playerInSpecialSector(player, sector, 0, callbacks)).toThrow(/unknown special 0/);
  });
});
