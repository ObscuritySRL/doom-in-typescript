/**
 * Vanilla DOOM 1.9 `default.cfg` round-trip writer contract.
 *
 * Combines the four per-category persisters
 * (`persist-mouse-settings`, `persist-sound-settings`,
 * `persist-screen-settings`, `persist-vanilla-key-bindings`,
 * `persist-chat-macros`) into a single full-file serializer that
 * reproduces the on-disk ordering used by Chocolate Doom 2.2.1
 * M_SaveDefaults when walking the doom_defaults_list array:
 *
 *   1. mouse_sensitivity
 *   2. sfx_volume, music_volume
 *   3. show_messages
 *   4. key_right, key_left, key_up, key_down,
 *      key_strafeleft, key_straferight, key_fire, key_use,
 *      key_strafe, key_speed
 *   5. use_mouse, mouseb_fire, mouseb_strafe, mouseb_forward
 *   6. use_joystick, joyb_fire, joyb_strafe, joyb_use, joyb_speed
 *   7. screenblocks, detaillevel
 *   8. snd_channels, snd_musicdevice, snd_sfxdevice,
 *      snd_sbport, snd_sbirq, snd_sbdma, snd_mport
 *   9. usegamma
 *  10. chatmacro0 .. chatmacro9
 *
 * Parity-critical details:
 *   - File ends without trailing blank line — every line has exactly
 *     one LF terminator and the file ends after the last `chatmacro9`
 *     line's LF.
 *   - All 43 variables are emitted unconditionally; M_SaveDefaults
 *     walks the full doom_defaults_list rather than diffing against
 *     defaults.
 *   - Line format is uniform: name padded with ASCII space to column
 *     30, single space separator, value, single LF terminator. No
 *     CRLF on any platform.
 *   - Integer values write as plain decimal (no sign for non-negative,
 *     no zero padding, no `0x` prefix). String values (chatmacros)
 *     write surrounded by literal double quotes with no escape
 *     processing.
 *   - The joystick block (use_joystick / joyb_*) and the use_mouse
 *     block (use_mouse / mouseb_*) are part of the vanilla namespace;
 *     this writer emits them inline rather than partitioning by
 *     subsystem persister, because the on-disk ordering interleaves
 *     them with screen/sound categories.
 */

import { formatVanillaConfigLine } from './persist-vanilla-key-bindings.ts';
import type { VanillaDefaultCfgValues } from './parse-default-cfg.ts';

export const VANILLA_CONFIG_TOTAL_LINE_COUNT = 43;

export function writeVanillaDefaultCfg(values: VanillaDefaultCfgValues): string {
  return (
    formatVanillaConfigLine('mouse_sensitivity', values.mouse_sensitivity) +
    formatVanillaConfigLine('sfx_volume', values.sfx_volume) +
    formatVanillaConfigLine('music_volume', values.music_volume) +
    formatVanillaConfigLine('show_messages', values.show_messages) +
    formatVanillaConfigLine('key_right', values.key_right) +
    formatVanillaConfigLine('key_left', values.key_left) +
    formatVanillaConfigLine('key_up', values.key_up) +
    formatVanillaConfigLine('key_down', values.key_down) +
    formatVanillaConfigLine('key_strafeleft', values.key_strafeleft) +
    formatVanillaConfigLine('key_straferight', values.key_straferight) +
    formatVanillaConfigLine('key_fire', values.key_fire) +
    formatVanillaConfigLine('key_use', values.key_use) +
    formatVanillaConfigLine('key_strafe', values.key_strafe) +
    formatVanillaConfigLine('key_speed', values.key_speed) +
    formatVanillaConfigLine('use_mouse', values.use_mouse) +
    formatVanillaConfigLine('mouseb_fire', values.mouseb_fire) +
    formatVanillaConfigLine('mouseb_strafe', values.mouseb_strafe) +
    formatVanillaConfigLine('mouseb_forward', values.mouseb_forward) +
    formatVanillaConfigLine('use_joystick', values.use_joystick) +
    formatVanillaConfigLine('joyb_fire', values.joyb_fire) +
    formatVanillaConfigLine('joyb_strafe', values.joyb_strafe) +
    formatVanillaConfigLine('joyb_use', values.joyb_use) +
    formatVanillaConfigLine('joyb_speed', values.joyb_speed) +
    formatVanillaConfigLine('screenblocks', values.screenblocks) +
    formatVanillaConfigLine('detaillevel', values.detaillevel) +
    formatVanillaConfigLine('snd_channels', values.snd_channels) +
    formatVanillaConfigLine('snd_musicdevice', values.snd_musicdevice) +
    formatVanillaConfigLine('snd_sfxdevice', values.snd_sfxdevice) +
    formatVanillaConfigLine('snd_sbport', values.snd_sbport) +
    formatVanillaConfigLine('snd_sbirq', values.snd_sbirq) +
    formatVanillaConfigLine('snd_sbdma', values.snd_sbdma) +
    formatVanillaConfigLine('snd_mport', values.snd_mport) +
    formatVanillaConfigLine('usegamma', values.usegamma) +
    formatVanillaChatMacroEntry('chatmacro0', values.chatmacro0) +
    formatVanillaChatMacroEntry('chatmacro1', values.chatmacro1) +
    formatVanillaChatMacroEntry('chatmacro2', values.chatmacro2) +
    formatVanillaChatMacroEntry('chatmacro3', values.chatmacro3) +
    formatVanillaChatMacroEntry('chatmacro4', values.chatmacro4) +
    formatVanillaChatMacroEntry('chatmacro5', values.chatmacro5) +
    formatVanillaChatMacroEntry('chatmacro6', values.chatmacro6) +
    formatVanillaChatMacroEntry('chatmacro7', values.chatmacro7) +
    formatVanillaChatMacroEntry('chatmacro8', values.chatmacro8) +
    formatVanillaChatMacroEntry('chatmacro9', values.chatmacro9)
  );
}

function formatVanillaChatMacroEntry(name: string, value: string): string {
  return `${name.padEnd(30, ' ')} "${value}"\n`;
}
