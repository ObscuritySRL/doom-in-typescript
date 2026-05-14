/**
 * Vanilla DOOM 1.9 automap mark-point parity facts.
 *
 * From Chocolate Doom 2.2.1 am_map.c `AM_addMark`, `AM_clearMarks`,
 * `AM_drawMarks`, and the `markpoints[]` circular buffer:
 *
 *   #define AM_NUMMARKPOINTS 10
 *
 *   void AM_clearMarks(void)
 *   {
 *       int i;
 *       for (i = 0; i < AM_NUMMARKPOINTS; i++)
 *           markpoints[i].x = -1; // empty
 *       markpointnum = 0;
 *   }
 *
 *   void AM_addMark(void)
 *   {
 *       markpoints[markpointnum].x = m_x + m_w / 2;
 *       markpoints[markpointnum].y = m_y + m_h / 2;
 *       markpointnum = (markpointnum + 1) % AM_NUMMARKPOINTS;
 *   }
 *
 *   void AM_drawMarks(void)
 *   {
 *       int i, fx, fy, w, h;
 *       for (i = 0; i < AM_NUMMARKPOINTS; i++)
 *       {
 *           if (markpoints[i].x != -1)
 *           {
 *               w = 5;  // figure out why these are hardcoded
 *               h = 6;
 *               fx = CXMTOF(markpoints[i].x);
 *               fy = CYMTOF(markpoints[i].y);
 *               if (fx >= f_x && fx <= f_w - w && fy >= f_y && fy <= f_h - h)
 *                   V_DrawPatch(fx, fy, FB, marknums[i]);
 *           }
 *       }
 *   }
 *
 * Parity-critical invariants pinned here:
 *
 *   1. AM_NUMMARKPOINTS = 10.  Player can drop at most 10 marks before
 *      the circular buffer overwrites slot 0.
 *   2. `markpoints[i].x = -1` is the empty sentinel.  Any mark
 *      iteration must test `x !== -1`, NOT `x !== undefined` or any
 *      JS truthiness shortcut.
 *   3. AM_addMark uses MODULO arithmetic: `markpointnum =
 *      (markpointnum + 1) % AM_NUMMARKPOINTS`.  The 11th press
 *      overwrites slot 0 — NOT slot 10 (out of bounds).
 *   4. The mark patch is positioned at the CURRENT WINDOW CENTER:
 *      `markpoints[markpointnum].x = m_x + m_w / 2`
 *      `markpoints[markpointnum].y = m_y + m_h / 2`
 *      Both halves use signed integer division on fixed-point.
 *   5. AM_clearMarks resets ALL 10 slots to `x = -1` AND resets
 *      `markpointnum = 0`.  The for-loop fills every slot — there is
 *      no `markpointnum`-aware early exit.
 *   6. Mark patch display dimensions are HARDCODED to 5×6 pixels —
 *      vanilla overrides whatever the AMMNUM*.patch headers report
 *      because (per the source comment) the patches report wrong
 *      sizes.
 *   7. Mark patch names are `AMMNUM0` through `AMMNUM9` — 10 patches
 *      indexed by mark slot number.
 *   8. Per-mark visibility check `fx >= f_x && fx <= f_w - w && fy
 *      >= f_y && fy <= f_h - h` clips OFF-SCREEN marks BEFORE the
 *      V_DrawPatch call.  The `w` and `h` adjustments ensure the
 *      entire mark fits within the automap frame buffer.
 */

/** Maximum simultaneous marks the player can drop. */
export const VANILLA_AUTOMAP_NUM_MARKPOINTS = 10;

/** Empty-slot sentinel value for markpoints[i].x. */
export const VANILLA_AUTOMAP_MARK_EMPTY_X = -1;

/** Mark patch display width in pixels (hardcoded override in AM_drawMarks). */
export const VANILLA_AUTOMAP_MARK_WIDTH = 5;

/** Mark patch display height in pixels (hardcoded override in AM_drawMarks). */
export const VANILLA_AUTOMAP_MARK_HEIGHT = 6;

/** Mark patch name prefix — AMMNUM0 .. AMMNUM9 in the WAD. */
export const VANILLA_AUTOMAP_MARK_PATCH_PREFIX = 'AMMNUM';

/**
 * Resolve the patch name for a mark slot index `0..9`.  Returns
 * `AMMNUM0`..`AMMNUM9`.  Throws when index is out of range.
 */
export function vanillaAutomapMarkPatchName(slot: number): string {
  if (!Number.isInteger(slot) || slot < 0 || slot >= VANILLA_AUTOMAP_NUM_MARKPOINTS) {
    throw new RangeError(`vanillaAutomapMarkPatchName: slot must be integer in [0, ${VANILLA_AUTOMAP_NUM_MARKPOINTS - 1}], got ${slot}`);
  }
  return `${VANILLA_AUTOMAP_MARK_PATCH_PREFIX}${slot}`;
}

/**
 * Compute the next markpointnum after an AM_addMark call.  Mirrors:
 *
 *   markpointnum = (markpointnum + 1) % AM_NUMMARKPOINTS
 */
export function vanillaAutomapAdvanceMarkIndex(markpointnum: number): number {
  if (!Number.isInteger(markpointnum) || markpointnum < 0 || markpointnum >= VANILLA_AUTOMAP_NUM_MARKPOINTS) {
    throw new RangeError(`vanillaAutomapAdvanceMarkIndex: markpointnum must be integer in [0, ${VANILLA_AUTOMAP_NUM_MARKPOINTS - 1}], got ${markpointnum}`);
  }
  return (markpointnum + 1) % VANILLA_AUTOMAP_NUM_MARKPOINTS;
}

/**
 * Test whether a mark slot is occupied.  An empty slot has
 * `x === VANILLA_AUTOMAP_MARK_EMPTY_X`; any other value (including
 * 0) is occupied.  Vanilla's gate is `markpoints[i].x != -1`.
 */
export function vanillaAutomapMarkIsOccupied(markX: number): boolean {
  return markX !== VANILLA_AUTOMAP_MARK_EMPTY_X;
}

/**
 * Compute the mark deposit coordinates from the current automap
 * window: `(m_x + m_w/2, m_y + m_h/2)`.  Both halves use signed
 * integer division (`Math.trunc` semantics for negative inputs).
 */
export function vanillaAutomapMarkDepositPoint(mX: number, mY: number, mW: number, mH: number): { x: number; y: number } {
  return {
    x: (mX + ((mW / 2) | 0)) | 0,
    y: (mY + ((mH / 2) | 0)) | 0,
  };
}
