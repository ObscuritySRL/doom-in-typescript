/**
 * Vanilla DOOM 1.9 P_ArchiveSpecials sector-special contract.
 *
 * From Chocolate Doom 2.2.1 p_saveg.c P_ArchiveSpecials /
 * P_UnArchiveSpecials, the saveg_specialclass_t enum:
 *
 *   tc_ceiling     = 0   (T_MoveCeiling)
 *   tc_door        = 1   (T_VerticalDoor)
 *   tc_floor       = 2   (T_MoveFloor)
 *   tc_plat        = 3   (T_PlatRaise)
 *   tc_flash       = 4   (T_LightFlash)
 *   tc_strobe      = 5   (T_StrobeFlash)
 *   tc_glow        = 6   (T_Glow)
 *   tc_endspecials = 7   (terminator)
 *
 * Parity-critical details:
 *   - P_ArchiveSpecials walks the thinkercap ring AGAIN (after
 *     P_ArchiveThinkers's mobj-only pass) and emits a class byte
 *     per recognized thinker function pointer.
 *   - The "in stasis" T_*InStasis variants (T_MoveCeilingInStasis,
 *     T_PlatRaiseInStasis) share the same class byte as their
 *     active counterparts; the unarchive side reconstructs which
 *     thinker function to install based on the inactive flag inside
 *     the record body.
 *   - Active-list snapshot tables (activeceilings[MAXCEILINGS=30],
 *     activeplats[MAXPLATS=30], buttonlist[MAXBUTTONS=16]) are
 *     reconstructed at unarchive time by walking the restored
 *     thinker list.
 *   - The tc_endspecials=7 marker terminates this section; the
 *     SAVE_GAME_TERMINATOR=0x1D byte follows it as the file
 *     terminator.
 */

export const VANILLA_TC_CEILING = 0;
export const VANILLA_TC_DOOR = 1;
export const VANILLA_TC_FLOOR = 2;
export const VANILLA_TC_PLAT = 3;
export const VANILLA_TC_FLASH = 4;
export const VANILLA_TC_STROBE = 5;
export const VANILLA_TC_GLOW = 6;
export const VANILLA_TC_ENDSPECIALS = 7;

export const VANILLA_TC_ACTIVE_THINKER_CLASS_COUNT = 7;

export const VANILLA_MAXCEILINGS = 30;
export const VANILLA_MAXPLATS = 30;
export const VANILLA_MAXBUTTONS = 16;

export const VANILLA_SAVE_GAME_TERMINATOR = 0x1d;

export function isVanillaSpecialClassByte(byte: number): boolean {
  return byte >= VANILLA_TC_CEILING && byte <= VANILLA_TC_ENDSPECIALS;
}

export function isVanillaActiveSpecialClassByte(byte: number): boolean {
  return byte >= VANILLA_TC_CEILING && byte < VANILLA_TC_ENDSPECIALS;
}
