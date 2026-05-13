/**
 * Vanilla DOOM 1.9 key-binding persistence contract.
 *
 * Chocolate Doom 2.2.1 m_config.c M_SaveDefaults writes each variable
 * as a fixed-format line:
 *
 *   fprintf(f, "%-30s ", name);   // name left-aligned in 30 chars
 *   fprintf(f, "%i", value);      // DOS scan code (integer)
 *   fputc('\n', f);
 *
 * For the vanilla `default.cfg` namespace, ten variables in this format
 * encode the playing key bindings as DOS BIOS scan codes (g_game.c
 * key_right/key_left/key_up/key_down/key_strafeleft/key_straferight/
 * key_fire/key_use/key_strafe/key_speed). The integers are PRESERVED
 * VERBATIM by the persister — translation between scan codes and
 * platform virtual keys happens elsewhere under the
 * `vanilla_keyboard_mapping` flag from chocolate-doom.cfg.
 *
 * Parity-critical details:
 *   - Name column width = 30 chars. Padding is trailing ASCII space
 *     (0x20). No tabs.
 *   - Separator between padded name and value = exactly one space.
 *   - Value is a decimal integer with no padding, no `0x` prefix, no
 *     sign for non-negative values.
 *   - Line terminator = single `\n` (LF). Chocolate Doom writes LF on
 *     all platforms; CRLF would desync byte-identical compares.
 *   - The 10 key-binding variables match the original DOOM 1.9
 *     defaults: key_right=77 (0x4D Right-Arrow), key_left=75
 *     (0x4B Left-Arrow), key_up=72 (0x48 Up-Arrow), key_down=80
 *     (0x50 Down-Arrow), key_strafeleft=51 (0x33 Comma), key_straferight=52
 *     (0x34 Period), key_fire=29 (0x1D Right-Ctrl), key_use=57
 *     (0x39 Space), key_strafe=56 (0x38 Right-Alt), key_speed=54
 *     (0x36 Right-Shift).
 */

export const VANILLA_KEY_BINDING_NAME_COLUMN_WIDTH = 30;

export const VANILLA_KEY_BINDING_NAMES: readonly string[] = Object.freeze(['key_right', 'key_left', 'key_up', 'key_down', 'key_strafeleft', 'key_straferight', 'key_fire', 'key_use', 'key_strafe', 'key_speed']);

export const VANILLA_KEY_BINDING_DOS_SCAN_CODE_DEFAULTS: ReadonlyMap<string, number> = Object.freeze(
  new Map<string, number>([
    ['key_right', 77],
    ['key_left', 75],
    ['key_up', 72],
    ['key_down', 80],
    ['key_strafeleft', 51],
    ['key_straferight', 52],
    ['key_fire', 29],
    ['key_use', 57],
    ['key_strafe', 56],
    ['key_speed', 54],
  ]),
);

export interface VanillaKeyBindingValues {
  readonly key_right: number;
  readonly key_left: number;
  readonly key_up: number;
  readonly key_down: number;
  readonly key_strafeleft: number;
  readonly key_straferight: number;
  readonly key_fire: number;
  readonly key_use: number;
  readonly key_strafe: number;
  readonly key_speed: number;
}

export function formatVanillaConfigLine(name: string, value: number): string {
  const paddedName = name.padEnd(VANILLA_KEY_BINDING_NAME_COLUMN_WIDTH, ' ');
  return `${paddedName} ${value}\n`;
}

export function serializeVanillaKeyBindings(values: VanillaKeyBindingValues): string {
  return (
    formatVanillaConfigLine('key_right', values.key_right) +
    formatVanillaConfigLine('key_left', values.key_left) +
    formatVanillaConfigLine('key_up', values.key_up) +
    formatVanillaConfigLine('key_down', values.key_down) +
    formatVanillaConfigLine('key_strafeleft', values.key_strafeleft) +
    formatVanillaConfigLine('key_straferight', values.key_straferight) +
    formatVanillaConfigLine('key_fire', values.key_fire) +
    formatVanillaConfigLine('key_use', values.key_use) +
    formatVanillaConfigLine('key_strafe', values.key_strafe) +
    formatVanillaConfigLine('key_speed', values.key_speed)
  );
}

export function createDefaultVanillaKeyBindings(): VanillaKeyBindingValues {
  return Object.freeze({
    key_right: 77,
    key_left: 75,
    key_up: 72,
    key_down: 80,
    key_strafeleft: 51,
    key_straferight: 52,
    key_fire: 29,
    key_use: 57,
    key_strafe: 56,
    key_speed: 54,
  });
}
