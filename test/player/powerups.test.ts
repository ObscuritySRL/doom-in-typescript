import { describe, expect, it } from 'bun:test';

import type { Player } from '../../src/player/playerSpawn.ts';

import { Mobj, MF_SHADOW } from '../../src/world/mobj.ts';
import { PowerType, createPlayer, playerReborn } from '../../src/player/playerSpawn.ts';
import {
  COLORMAP_BLINK_MASK,
  COLORMAP_BLINK_THRESHOLD,
  INFRARED_COLORMAP,
  INVERSECOLORMAP,
  NUMBONUSPALS,
  NUMREDPALS,
  RADIATIONPAL,
  STARTBONUSPALS,
  STARTREDPALS,
  computeFixedColormap,
  computePalette,
  tickPowerups,
} from '../../src/player/powerups.ts';

// ── Helpers ──────────────────────────────────────────────────────────

function spawnedPlayer(): Player {
  const player = createPlayer();
  playerReborn(player);
  const mo = new Mobj();
  mo.flags = 0;
  mo.health = player.health;
  mo.player = player;
  player.mo = mo;
  return player;
}

// ── Constants ────────────────────────────────────────────────────────

describe('powerup palette and colormap constants', () => {
  it('PLAYPAL groupings match doomdef.h', () => {
    expect(STARTREDPALS).toBe(1);
    expect(NUMREDPALS).toBe(8);
    expect(STARTBONUSPALS).toBe(9);
    expect(NUMBONUSPALS).toBe(4);
    expect(RADIATIONPAL).toBe(13);
  });

  it('COLORMAP indices match r_data.c', () => {
    expect(INVERSECOLORMAP).toBe(32);
    expect(INFRARED_COLORMAP).toBe(1);
  });

  it('blink threshold is 4*32 and blink mask is bit 3', () => {
    expect(COLORMAP_BLINK_THRESHOLD).toBe(128);
    expect(COLORMAP_BLINK_MASK).toBe(8);
  });
});

// ── tickPowerups: counter direction ──────────────────────────────────

describe('tickPowerups: counter direction', () => {
  it('STRENGTH counts UP each tic when set', () => {
    const player = spawnedPlayer();
    player.powers[PowerType.STRENGTH] = 1;
    tickPowerups(player);
    expect(player.powers[PowerType.STRENGTH]).toBe(2);
    tickPowerups(player);
    expect(player.powers[PowerType.STRENGTH]).toBe(3);
  });

  it('STRENGTH stays at 0 when not held (does not start counting on its own)', () => {
    const player = spawnedPlayer();
    player.powers[PowerType.STRENGTH] = 0;
    tickPowerups(player);
    expect(player.powers[PowerType.STRENGTH]).toBe(0);
  });

  it('INVULNERABILITY decrements toward 0 and stops there', () => {
    const player = spawnedPlayer();
    player.powers[PowerType.INVULNERABILITY] = 2;
    tickPowerups(player);
    expect(player.powers[PowerType.INVULNERABILITY]).toBe(1);
    tickPowerups(player);
    expect(player.powers[PowerType.INVULNERABILITY]).toBe(0);
    tickPowerups(player);
    expect(player.powers[PowerType.INVULNERABILITY]).toBe(0);
  });

  it('INFRARED and IRONFEET decrement each tic', () => {
    const player = spawnedPlayer();
    player.powers[PowerType.INFRARED] = 5;
    player.powers[PowerType.IRONFEET] = 7;
    tickPowerups(player);
    expect(player.powers[PowerType.INFRARED]).toBe(4);
    expect(player.powers[PowerType.IRONFEET]).toBe(6);
  });

  it('damagecount and bonuscount decrement to zero', () => {
    const player = spawnedPlayer();
    player.damagecount = 3;
    player.bonuscount = 2;
    tickPowerups(player);
    expect(player.damagecount).toBe(2);
    expect(player.bonuscount).toBe(1);
    tickPowerups(player);
    expect(player.damagecount).toBe(1);
    expect(player.bonuscount).toBe(0);
    tickPowerups(player);
    expect(player.damagecount).toBe(0);
    expect(player.bonuscount).toBe(0);
  });
});

// ── tickPowerups: invisibility shadow flag ───────────────────────────

describe('tickPowerups: invisibility MF_SHADOW handling', () => {
  it('clears MF_SHADOW on the tic INVISIBILITY drops to zero', () => {
    const player = spawnedPlayer();
    player.powers[PowerType.INVISIBILITY] = 1;
    player.mo!.flags = MF_SHADOW;

    tickPowerups(player);

    expect(player.powers[PowerType.INVISIBILITY]).toBe(0);
    expect(player.mo!.flags & MF_SHADOW).toBe(0);
  });

  it('leaves MF_SHADOW set while INVISIBILITY remains > 0', () => {
    const player = spawnedPlayer();
    player.powers[PowerType.INVISIBILITY] = 5;
    player.mo!.flags = MF_SHADOW;

    tickPowerups(player);

    expect(player.powers[PowerType.INVISIBILITY]).toBe(4);
    expect(player.mo!.flags & MF_SHADOW).toBe(MF_SHADOW);
  });

  it('preserves other flag bits when clearing MF_SHADOW', () => {
    const player = spawnedPlayer();
    const otherBits = 0x10000 | 0x400000;
    player.powers[PowerType.INVISIBILITY] = 1;
    player.mo!.flags = MF_SHADOW | otherBits;

    tickPowerups(player);

    expect(player.mo!.flags).toBe(otherBits);
  });

  it('does not touch flags when player.mo is null', () => {
    const player = createPlayer();
    player.powers[PowerType.INVISIBILITY] = 1;
    expect(() => tickPowerups(player)).not.toThrow();
    expect(player.powers[PowerType.INVISIBILITY]).toBe(0);
  });
});

// ── tickPowerups: fixedcolormap ──────────────────────────────────────

describe('tickPowerups: fixedcolormap reassignment', () => {
  it('INVULNERABILITY > 128 sets fixedcolormap=INVERSECOLORMAP', () => {
    const player = spawnedPlayer();
    player.powers[PowerType.INVULNERABILITY] = 200;
    tickPowerups(player);
    expect(player.fixedcolormap).toBe(INVERSECOLORMAP);
  });

  it('INVULNERABILITY in blink-on tic sets INVERSECOLORMAP', () => {
    const player = spawnedPlayer();
    player.powers[PowerType.INVULNERABILITY] = 16;
    tickPowerups(player);
    expect(player.powers[PowerType.INVULNERABILITY]).toBe(15);
    expect(15 & COLORMAP_BLINK_MASK).toBe(8);
    expect(player.fixedcolormap).toBe(INVERSECOLORMAP);
  });

  it('INVULNERABILITY in blink-off tic clears fixedcolormap to 0', () => {
    const player = spawnedPlayer();
    player.powers[PowerType.INVULNERABILITY] = 8;
    tickPowerups(player);
    expect(player.powers[PowerType.INVULNERABILITY]).toBe(7);
    expect(7 & COLORMAP_BLINK_MASK).toBe(0);
    expect(player.fixedcolormap).toBe(0);
  });

  it('INFRARED > 128 sets fixedcolormap=1 (almost full bright)', () => {
    const player = spawnedPlayer();
    player.powers[PowerType.INFRARED] = 200;
    tickPowerups(player);
    expect(player.fixedcolormap).toBe(INFRARED_COLORMAP);
  });

  it('recomputes fixedcolormap after decrement, so 129 tics falls dark on the next tick', () => {
    const player = spawnedPlayer();
    player.powers[PowerType.INVULNERABILITY] = 129;
    tickPowerups(player);
    expect(player.powers[PowerType.INVULNERABILITY]).toBe(128);
    expect(player.fixedcolormap).toBe(0);
  });

  it('recomputes infrared fixedcolormap after decrement, so 129 tics falls dark on the next tick', () => {
    const player = spawnedPlayer();
    player.powers[PowerType.INFRARED] = 129;
    tickPowerups(player);
    expect(player.powers[PowerType.INFRARED]).toBe(128);
    expect(player.fixedcolormap).toBe(0);
  });

  it('INVULNERABILITY wins over INFRARED when both are active', () => {
    const player = spawnedPlayer();
    player.powers[PowerType.INVULNERABILITY] = 200;
    player.powers[PowerType.INFRARED] = 200;
    tickPowerups(player);
    expect(player.fixedcolormap).toBe(INVERSECOLORMAP);
  });

  it('no powers active leaves fixedcolormap = 0', () => {
    const player = spawnedPlayer();
    player.fixedcolormap = INVERSECOLORMAP;
    tickPowerups(player);
    expect(player.fixedcolormap).toBe(0);
  });
});

// ── computePalette ───────────────────────────────────────────────────

describe('computePalette: damage red flash', () => {
  it('damagecount == 0 with no other inputs returns palette 0', () => {
    const player = spawnedPlayer();
    expect(computePalette(player)).toBe(0);
  });

  it('damagecount == 1..8 all map to palette 2 (first reachable red)', () => {
    const player = spawnedPlayer();
    player.damagecount = 1;
    expect(computePalette(player)).toBe(STARTREDPALS + 1);
    player.damagecount = 8;
    expect(computePalette(player)).toBe(STARTREDPALS + 1);
  });

  it('damagecount == 9 advances to palette 3', () => {
    const player = spawnedPlayer();
    player.damagecount = 9;
    expect(computePalette(player)).toBe(STARTREDPALS + 2);
  });

  it('damagecount >= 57 saturates at STARTREDPALS+NUMREDPALS-1 = 8', () => {
    const player = spawnedPlayer();
    player.damagecount = 100;
    expect(computePalette(player)).toBe(STARTREDPALS + NUMREDPALS - 1);
    player.damagecount = 57;
    expect(computePalette(player)).toBe(STARTREDPALS + NUMREDPALS - 1);
  });

  it('palette index STARTREDPALS (1) is unreachable via the damage branch', () => {
    const player = spawnedPlayer();
    for (let damage = 1; damage <= 200; damage++) {
      player.damagecount = damage;
      expect(computePalette(player)).not.toBe(STARTREDPALS);
    }
  });
});

describe('computePalette: berserk fade-in', () => {
  it('STRENGTH = 1 with no damage: bzc = 12, palette = ((12+7)>>3)+1 = 3', () => {
    const player = spawnedPlayer();
    player.powers[PowerType.STRENGTH] = 1;
    expect(computePalette(player)).toBe(STARTREDPALS + 2);
  });

  it('STRENGTH advances reduce bzc, dropping the red palette over time', () => {
    const player = spawnedPlayer();
    player.powers[PowerType.STRENGTH] = 1;
    expect(computePalette(player)).toBe(3);
    player.powers[PowerType.STRENGTH] = 256;
    expect(computePalette(player)).toBe(2);
    player.powers[PowerType.STRENGTH] = 768;
    expect(computePalette(player)).toBe(0);
  });

  it('damagecount overrides berserk fade when larger', () => {
    const player = spawnedPlayer();
    player.powers[PowerType.STRENGTH] = 1;
    player.damagecount = 100;
    expect(computePalette(player)).toBe(STARTREDPALS + NUMREDPALS - 1);
  });
});

describe('computePalette: bonus pickup flash', () => {
  it('bonuscount == 0 with no damage returns 0', () => {
    const player = spawnedPlayer();
    expect(computePalette(player)).toBe(0);
  });

  it('bonuscount == 1 maps to STARTBONUSPALS+1 = 10 (first reachable bonus)', () => {
    const player = spawnedPlayer();
    player.bonuscount = 1;
    expect(computePalette(player)).toBe(STARTBONUSPALS + 1);
  });

  it('bonuscount saturates at STARTBONUSPALS+NUMBONUSPALS-1 = 12', () => {
    const player = spawnedPlayer();
    player.bonuscount = 100;
    expect(computePalette(player)).toBe(STARTBONUSPALS + NUMBONUSPALS - 1);
  });

  it('damagecount blocks bonus palette (precedence rule)', () => {
    const player = spawnedPlayer();
    player.damagecount = 1;
    player.bonuscount = 12;
    expect(computePalette(player)).toBe(STARTREDPALS + 1);
  });
});

describe('computePalette: radiation suit', () => {
  it('IRONFEET > 128 returns RADIATIONPAL', () => {
    const player = spawnedPlayer();
    player.powers[PowerType.IRONFEET] = 200;
    expect(computePalette(player)).toBe(RADIATIONPAL);
  });

  it('IRONFEET uses a strict >128 threshold before the blink mask applies', () => {
    const player = spawnedPlayer();
    player.powers[PowerType.IRONFEET] = 129;
    expect(computePalette(player)).toBe(RADIATIONPAL);
    player.powers[PowerType.IRONFEET] = 128;
    expect(computePalette(player)).toBe(0);
  });

  it('IRONFEET in blink-on tic returns RADIATIONPAL', () => {
    const player = spawnedPlayer();
    player.powers[PowerType.IRONFEET] = 8;
    expect(computePalette(player)).toBe(RADIATIONPAL);
  });

  it('IRONFEET in blink-off tic returns palette 0', () => {
    const player = spawnedPlayer();
    player.powers[PowerType.IRONFEET] = 7;
    expect(computePalette(player)).toBe(0);
  });

  it('bonuscount blocks radiation palette (precedence rule)', () => {
    const player = spawnedPlayer();
    player.powers[PowerType.IRONFEET] = 200;
    player.bonuscount = 1;
    expect(computePalette(player)).toBe(STARTBONUSPALS + 1);
  });

  it('damagecount blocks radiation palette (precedence rule)', () => {
    const player = spawnedPlayer();
    player.powers[PowerType.IRONFEET] = 200;
    player.damagecount = 1;
    expect(computePalette(player)).toBe(STARTREDPALS + 1);
  });
});

// ── computeFixedColormap (pure) ──────────────────────────────────────

describe('computeFixedColormap (pure)', () => {
  it('returns 0 when no powers are active', () => {
    const player = spawnedPlayer();
    expect(computeFixedColormap(player)).toBe(0);
  });

  it('returns INVERSECOLORMAP when invulnerability is solid', () => {
    const player = spawnedPlayer();
    player.powers[PowerType.INVULNERABILITY] = 200;
    expect(computeFixedColormap(player)).toBe(INVERSECOLORMAP);
  });

  it('infrared loses to invulnerability', () => {
    const player = spawnedPlayer();
    player.powers[PowerType.INVULNERABILITY] = 200;
    player.powers[PowerType.INFRARED] = 200;
    expect(computeFixedColormap(player)).toBe(INVERSECOLORMAP);
  });

  it('returns INFRARED_COLORMAP for active visor without invulnerability', () => {
    const player = spawnedPlayer();
    player.powers[PowerType.INFRARED] = 200;
    expect(computeFixedColormap(player)).toBe(INFRARED_COLORMAP);
  });

  it('infrared blink: bit-3-set tic gives 1, bit-3-clear gives 0', () => {
    const player = spawnedPlayer();
    player.powers[PowerType.INFRARED] = 8;
    expect(computeFixedColormap(player)).toBe(INFRARED_COLORMAP);
    player.powers[PowerType.INFRARED] = 7;
    expect(computeFixedColormap(player)).toBe(0);
  });
});
