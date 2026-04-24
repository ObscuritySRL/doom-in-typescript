/**
 * Ticcmd structure, constants, and packing helpers matching Doom's
 * d_ticcmd.h and the G_BuildTiccmd encoding rules from g_game.c.
 *
 * A ticcmd encapsulates one tic's worth of player input: movement
 * magnitudes, a turning angle delta, button states, a network
 * consistency check, and a chat character.  The full structure is
 * 8 bytes matching the C `ticcmd_t` layout:
 *
 * | Offset | Size | Field        | C type |
 * | ------ | ---- | ------------ | ------ |
 * | 0      | 1    | forwardmove  | char   |
 * | 1      | 1    | sidemove     | char   |
 * | 2      | 2    | angleturn    | short  |
 * | 4      | 2    | consistancy  | short  |
 * | 6      | 1    | chatchar     | byte   |
 * | 7      | 1    | buttons      | byte   |
 *
 * Doom uses counterclockwise-positive angle convention: positive
 * angleturn = turn left, negative angleturn = turn right.
 *
 * @example
 * ```ts
 * import { packTicCommand, FORWARD_MOVE, BT_ATTACK } from "../src/input/ticcmd.ts";
 * const cmd = packTicCommand(FORWARD_MOVE[1], 0, -640, BT_ATTACK, 0, 0);
 * // cmd.forwardmove === 50, cmd.angleturn === -640, cmd.buttons === 1
 * ```
 */

// ── Ticcmd byte layout ──────────────────────────────────────────

/** Size of ticcmd_t in bytes: int8 + int8 + int16 + int16 + uint8 + uint8. */
export const TICCMD_SIZE = 8;

// ── Button flags (d_event.h) ────────────────────────────────────

/** Fire weapon. */
export const BT_ATTACK = 1;

/** Activate switches / open doors. */
export const BT_USE = 2;

/** Weapon change flag; next 3 bits hold the weapon number. */
export const BT_CHANGE = 4;

/** Mask for weapon number bits (bits 3-5). */
export const BT_WEAPONMASK = 8 + 16 + 32;

/** Bit position of the weapon number within the buttons byte. */
export const BT_WEAPONSHIFT = 3;

// ── Movement speed tables (g_game.c) ────────────────────────────

/**
 * Forward/backward movement speed per tic.
 * Index 0 = normal (walk), index 1 = fast (run / speed key held).
 */
export const FORWARD_MOVE: readonly [number, number] = Object.freeze([0x19, 0x32] as const);

/**
 * Strafe movement speed per tic.
 * Index 0 = normal (walk), index 1 = fast (run / speed key held).
 */
export const SIDE_MOVE: readonly [number, number] = Object.freeze([0x18, 0x28] as const);

/**
 * Maximum movement magnitude per tic, equal to FORWARD_MOVE[1].
 * Both forwardmove and sidemove are clamped to [-MAXPLMOVE, MAXPLMOVE].
 */
export const MAXPLMOVE = 0x32;

// ── Angle turn speeds (g_game.c) ────────────────────────────────

/**
 * Angle turn speed per tic in angleturn units.
 * Index 0 = normal, index 1 = fast, index 2 = slow (first SLOW_TURN_TICS).
 *
 * Slow turning applies when a turn key has been held for fewer than
 * SLOW_TURN_TICS tics, giving a brief ramp-up at the start of a turn.
 */
export const ANGLE_TURN: readonly [number, number, number] = Object.freeze([640, 1280, 320] as const);

/** Number of tics before slow-start turning graduates to full speed. */
export const SLOW_TURN_TICS = 6;

// ── Turbo threshold ─────────────────────────────────────────────

/** Forward movement above this magnitude triggers the "turbo player" warning. */
export const TURBO_THRESHOLD = 0x32;

// ── Mouse multipliers (g_game.c G_BuildTiccmd) ─────────────────

/** Mouse X delta multiplier for strafing when strafe modifier is held. */
export const MOUSE_STRAFE_MULTIPLIER = 2;

/** Mouse X delta multiplier for turning: angleturn -= mouseX * this. */
export const MOUSE_TURN_MULTIPLIER = 0x8;

// ── TicCommand interface ────────────────────────────────────────

/**
 * Per-tic player command matching ticcmd_t in d_ticcmd.h.
 *
 * Fields follow the C struct layout order.  In practice, forwardmove
 * and sidemove are clamped to [-MAXPLMOVE, MAXPLMOVE] by G_BuildTiccmd
 * before storage.
 */
export interface TicCommand {
  /** Forward/backward movement magnitude (int8: -128 to 127, clamped to ±MAXPLMOVE). */
  readonly forwardmove: number;
  /** Strafe movement magnitude (int8: -128 to 127, clamped to ±MAXPLMOVE). */
  readonly sidemove: number;
  /** Angle turn delta (int16: positive = left, negative = right). */
  readonly angleturn: number;
  /** Network consistency check value (int16). */
  readonly consistancy: number;
  /** Chat character (uint8: 0 = none). */
  readonly chatchar: number;
  /** Button bitfield (uint8: BT_ATTACK | BT_USE | BT_CHANGE | weapon bits). */
  readonly buttons: number;
}

// ── Empty ticcmd ────────────────────────────────────────────────

/** Frozen zero-initialized ticcmd (no input). */
export const EMPTY_TICCMD: TicCommand = Object.freeze({
  forwardmove: 0,
  sidemove: 0,
  angleturn: 0,
  consistancy: 0,
  chatchar: 0,
  buttons: 0,
});

// ── Packing helpers ─────────────────────────────────────────────

/**
 * Clamp a movement value to the valid ticcmd range.
 *
 * Both forwardmove and sidemove are clamped to [-MAXPLMOVE, MAXPLMOVE]
 * by G_BuildTiccmd before being stored in the ticcmd fields.
 *
 * @param value - Accumulated movement magnitude.
 * @returns Clamped value within [-MAXPLMOVE, MAXPLMOVE].
 */
export function clampMovement(value: number): number {
  if (value > MAXPLMOVE) return MAXPLMOVE;
  if (value < -MAXPLMOVE) return -MAXPLMOVE;
  return value;
}

/**
 * Truncate a number to signed 8-bit range, matching C `(signed char)` cast.
 *
 * Values outside [-128, 127] wrap modulo 256 with sign extension,
 * reproducing x86 signed byte truncation.
 *
 * @param value - Value to truncate.
 * @returns Signed 8-bit value (-128 to 127).
 */
export function truncateInt8(value: number): number {
  return (value << 24) >> 24;
}

/**
 * Truncate a number to signed 16-bit range, matching C `(short)` cast.
 *
 * Values outside [-32768, 32767] wrap modulo 65536 with sign extension,
 * reproducing x86 signed short truncation.
 *
 * @param value - Value to truncate.
 * @returns Signed 16-bit value (-32768 to 32767).
 */
export function truncateInt16(value: number): number {
  return (value << 16) >> 16;
}

/**
 * Extract the weapon number from a buttons bitfield.
 *
 * The weapon number occupies bits 3-5 (BT_WEAPONMASK) and is only
 * meaningful when BT_CHANGE is set.
 *
 * @param buttons - The buttons byte from a TicCommand.
 * @returns Weapon index (0-7).
 */
export function extractWeaponNumber(buttons: number): number {
  return (buttons & BT_WEAPONMASK) >> BT_WEAPONSHIFT;
}

/**
 * Encode a weapon change into button flags.
 *
 * Returns BT_CHANGE OR'd with the weapon number shifted into position.
 * Combine with other button flags using bitwise OR.
 *
 * @param weaponNumber - Weapon index (0-7).
 * @returns Button flags with BT_CHANGE set and weapon bits packed.
 */
export function packWeaponChange(weaponNumber: number): number {
  return BT_CHANGE | ((weaponNumber << BT_WEAPONSHIFT) & BT_WEAPONMASK);
}

/**
 * Pack accumulated input values into a frozen {@link TicCommand}.
 *
 * Movement values are clamped to [-MAXPLMOVE, MAXPLMOVE] and truncated
 * to int8.  The angle turn is truncated to int16.  Buttons and chatchar
 * are masked to uint8.  This matches the encoding performed by
 * G_BuildTiccmd after all input sources have been accumulated.
 *
 * @param forward      - Accumulated forward movement (positive = forward).
 * @param side         - Accumulated strafe movement (positive = rightward).
 * @param angleturn    - Accumulated angle turn delta (positive = left).
 * @param buttons      - Combined button flags.
 * @param consistancy  - Network consistency value.
 * @param chatchar     - Chat character (0 for none).
 * @returns Frozen TicCommand with all fields clamped and truncated.
 */
export function packTicCommand(forward: number, side: number, angleturn: number, buttons: number, consistancy: number, chatchar: number): TicCommand {
  return Object.freeze({
    forwardmove: truncateInt8(clampMovement(forward)),
    sidemove: truncateInt8(clampMovement(side)),
    angleturn: truncateInt16(angleturn),
    consistancy: truncateInt16(consistancy),
    chatchar: chatchar & 0xff,
    buttons: buttons & 0xff,
  });
}
