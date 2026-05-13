/**
 * Gate step 08-031: aggregate sector and line special primitive constants.
 */

import { CEILING_CRUSH_AND_RAISE, VANILLA_CEILSPEED_FAST_FIXED, VANILLA_CEILSPEED_FIXED, VANILLA_CEILING_CRUSH_DAMAGE } from './implement-ceiling-specials.ts';
import { VANILLA_RAISE_IN_5_MINS_TICS, VANILLA_VDOORSPEED_FIXED, VANILLA_VDOORWAIT_TICS, VLD_OPEN } from './implement-door-specials.ts';
import { FLOOR_LOWER_TO_LOWEST, VANILLA_FLOORSPEED_FIXED, VANILLA_FLOORSPEED_TURBO_FIXED } from './implement-floor-specials.ts';
import { VANILLA_LINE_TRIGGER_KEY_BLUE_CARD, VANILLA_LINE_TRIGGER_KEY_RED_SKULL } from './implement-line-trigger-repeat-rules.ts';
import { PLAT_DOWN_WAIT_UP_STAY, VANILLA_MAXPLATS, VANILLA_PLATWAIT_TICS } from './implement-platform-specials.ts';
import { SECTOR_SPECIAL_DAMAGE_NUKAGE, SECTOR_SPECIAL_SECRET, VANILLA_SECTOR_DAMAGE_TIC_INTERVAL } from './implement-sector-special-effects.ts';
import { VANILLA_BUTTONTIME_TICS, VANILLA_SFX_SWTCHN } from './implement-switch-texture-and-sound-semantics.ts';

export const SECTOR_LINE_SPECIALS_GATE = Object.freeze({
  doorSpeed: VANILLA_VDOORSPEED_FIXED,
  doorWait: VANILLA_VDOORWAIT_TICS,
  doorRaiseIn5MinsTics: VANILLA_RAISE_IN_5_MINS_TICS,
  vldOpen: VLD_OPEN,
  floorSpeed: VANILLA_FLOORSPEED_FIXED,
  floorSpeedTurbo: VANILLA_FLOORSPEED_TURBO_FIXED,
  floorLowerToLowest: FLOOR_LOWER_TO_LOWEST,
  ceilSpeed: VANILLA_CEILSPEED_FIXED,
  ceilSpeedFast: VANILLA_CEILSPEED_FAST_FIXED,
  ceilingCrushDamage: VANILLA_CEILING_CRUSH_DAMAGE,
  ceilingCrushAndRaise: CEILING_CRUSH_AND_RAISE,
  platWait: VANILLA_PLATWAIT_TICS,
  maxPlats: VANILLA_MAXPLATS,
  platDownWaitUpStay: PLAT_DOWN_WAIT_UP_STAY,
  buttonTime: VANILLA_BUTTONTIME_TICS,
  sfxSwitchOn: VANILLA_SFX_SWTCHN,
  sectorDamageInterval: VANILLA_SECTOR_DAMAGE_TIC_INTERVAL,
  sectorSpecialNukage: SECTOR_SPECIAL_DAMAGE_NUKAGE,
  sectorSpecialSecret: SECTOR_SPECIAL_SECRET,
  lineKeyBlueCard: VANILLA_LINE_TRIGGER_KEY_BLUE_CARD,
  lineKeyRedSkull: VANILLA_LINE_TRIGGER_KEY_RED_SKULL,
} as const);
