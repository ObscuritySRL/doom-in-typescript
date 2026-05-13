/**
 * Vanilla DOOM 1.9 P_PathTraverse limits contract.
 *
 * P_PathTraverse walks a parametric line through the blockmap; vanilla
 * limits the maximum block traversal count to 64 to avoid infinite loops
 * on near-axis paths.
 */

export const VANILLA_PATH_TRAVERSE_MAX_BLOCKS = 64;
export const VANILLA_PT_ADDLINES = 1;
export const VANILLA_PT_ADDTHINGS = 2;
export const VANILLA_PT_EARLYOUT = 4;

export interface PathTraverseInput {
  readonly blockCountWalked: number;
  readonly flags: number;
}

export function isPathTraverseOverLimit(input: PathTraverseInput): boolean {
  return input.blockCountWalked > VANILLA_PATH_TRAVERSE_MAX_BLOCKS;
}

export function pathTraverseAddsLines(flags: number): boolean {
  return (flags & VANILLA_PT_ADDLINES) !== 0;
}

export function pathTraverseAddsThings(flags: number): boolean {
  return (flags & VANILLA_PT_ADDTHINGS) !== 0;
}

export function pathTraverseEarlyOut(flags: number): boolean {
  return (flags & VANILLA_PT_EARLYOUT) !== 0;
}
