/**
 * Vanilla DOOM 1.9 sector special effect constants from p_spec.c.
 *
 * Sector special types (sector.special field):
 *   0: normal
 *   1: light flickering (random fire-like)
 *   2: light strobe fast (0.5s on, 0.5s off)
 *   3: light strobe slow
 *   4: light strobe fast + damage 20 (toxic + strobe)
 *   5: damage 10/sec (nukage)
 *   7: damage 5/sec (slime)
 *   8: light oscillates
 *   9: secret (counted)
 *   10: door close after 30s
 *   11: damage 20/sec + ending exit
 *   12: light sync strobe slow
 *   13: light sync strobe fast
 *   14: door open after 5 minutes
 *   16: damage 20 (super-radioactive, no end)
 *   17: light flicker (fire)
 *
 * Damage rate: every 32 tics (sector.special damage tics).
 */

export const VANILLA_SECTOR_DAMAGE_TIC_INTERVAL = 32;

export const SECTOR_SPECIAL_NORMAL = 0;
export const SECTOR_SPECIAL_LIGHT_FLICKER = 1;
export const SECTOR_SPECIAL_LIGHT_STROBE_FAST = 2;
export const SECTOR_SPECIAL_LIGHT_STROBE_SLOW = 3;
export const SECTOR_SPECIAL_LIGHT_STROBE_FAST_DAMAGE = 4;
export const SECTOR_SPECIAL_DAMAGE_NUKAGE = 5;
export const SECTOR_SPECIAL_DAMAGE_SLIME = 7;
export const SECTOR_SPECIAL_LIGHT_OSCILLATE = 8;
export const SECTOR_SPECIAL_SECRET = 9;
export const SECTOR_SPECIAL_CLOSE_DOOR_30 = 10;
export const SECTOR_SPECIAL_DAMAGE_END = 11;
export const SECTOR_SPECIAL_LIGHT_SYNC_STROBE_SLOW = 12;
export const SECTOR_SPECIAL_LIGHT_SYNC_STROBE_FAST = 13;
export const SECTOR_SPECIAL_RAISE_DOOR_5MIN = 14;
export const SECTOR_SPECIAL_DAMAGE_SUPER = 16;
export const SECTOR_SPECIAL_LIGHT_FIRE_FLICKER = 17;

export const VANILLA_SECTOR_DAMAGE_NUKAGE = 10;
export const VANILLA_SECTOR_DAMAGE_SLIME = 5;
export const VANILLA_SECTOR_DAMAGE_STROBE_HURT = 20;
export const VANILLA_SECTOR_DAMAGE_END = 20;
export const VANILLA_SECTOR_DAMAGE_SUPER = 20;
