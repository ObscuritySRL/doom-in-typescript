/**
 * Compare scripted renderer path oracle.
 *
 * Scripted input traces fire the renderer through deterministic input sequences
 * with framebuffer captures at known checkpoint tics. Hash-comparing each
 * captured framebuffer against the reference oracle proves renderer parity.
 *
 * Checkpoint tics for scripted path: spawn (tic 0), 1-second mark (tic 35),
 * 3-second mark (tic 105).
 */

export const VANILLA_RENDERER_CHECKPOINT_TICS = Object.freeze([0, 35, 105] as const);
export const VANILLA_RENDERER_CHECKPOINT_HASH_HEX_LENGTH = 64;
