/**
 * Compare title and E1M1 framebuffer oracle anchors.
 *
 * From oracle artifact policy: title screen and E1M1 spawn state generate
 * framebuffer hashes used as parity oracles. Hash format is SHA-256 over the
 * raw 320x200 indexed framebuffer bytes.
 *
 * Hash length: 64 hex chars (SHA-256 hex digest).
 */

export const VANILLA_FRAMEBUFFER_HASH_HEX_LENGTH = 64;
export const VANILLA_FRAMEBUFFER_HASH_ALGORITHM = 'sha256';
export const VANILLA_FRAMEBUFFER_WIDTH = 320;
export const VANILLA_FRAMEBUFFER_HEIGHT = 200;
export const VANILLA_FRAMEBUFFER_BYTE_LENGTH = VANILLA_FRAMEBUFFER_WIDTH * VANILLA_FRAMEBUFFER_HEIGHT;

export function isValidFramebufferHashHex(s: string): boolean {
  return s.length === VANILLA_FRAMEBUFFER_HASH_HEX_LENGTH && /^[0-9a-f]+$/.test(s);
}
