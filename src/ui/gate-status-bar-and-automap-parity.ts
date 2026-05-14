/**
 * Gate step 09-038: aggregate status-bar and automap primitive constants
 * pinned by Phase 09. Any regression in HUD widget positions, key columns,
 * background patches, automap palette indices, mark-point buffer, scale
 * bounds, or pan step shows up here as a single focused failure.
 */

import { VANILLA_AM_PALETTE } from './implement-automap-line-and-thing-colors.ts';
import { VANILLA_AUTOMAP_MARK_PATCH_PREFIX, VANILLA_AUTOMAP_NUM_MARKPOINTS } from './implement-automap-markers.ts';
import { VANILLA_AM_INIT_SCALE_MTOF_FIXED, VANILLA_AM_MAX_SCALE_MTOF_FIXED, VANILLA_AM_MIN_SCALE_MTOF_FIXED, VANILLA_AM_PAN_INCREMENT_FIXED } from './implement-automap-start-stop-state.ts';
import { VANILLA_STARMS_PATCH_NAME, VANILLA_STARMS_X, VANILLA_STARMS_Y, VANILLA_STATUS_BAR_HEIGHT, VANILLA_STATUS_BAR_WIDTH, VANILLA_STATUS_BAR_X, VANILLA_STATUS_BAR_Y, VANILLA_STBAR_PATCH_NAME } from './implement-status-bar-background.ts';
import { VANILLA_ST_AMMO_X, VANILLA_ST_AMMO_Y_OFFSETS, VANILLA_ST_KEY_X, VANILLA_ST_KEY_Y_OFFSETS, VANILLA_ST_MAXAMMO_X } from './implement-status-bar-key-and-ammo-widgets.ts';
import { VANILLA_ST_AMMOX, VANILLA_ST_ARMORX, VANILLA_ST_HEALTHX, VANILLA_ST_NUMBER_Y, VANILLA_ST_TALLNUM_WIDTH } from './implement-status-bar-numbers-and-percent-widgets.ts';

export const STATUS_BAR_AND_AUTOMAP_PARITY_GATE = Object.freeze({
  statusBar: {
    width: VANILLA_STATUS_BAR_WIDTH,
    height: VANILLA_STATUS_BAR_HEIGHT,
    x: VANILLA_STATUS_BAR_X,
    y: VANILLA_STATUS_BAR_Y,
    backgroundPatch: VANILLA_STBAR_PATCH_NAME,
    armsOverlayPatch: VANILLA_STARMS_PATCH_NAME,
    armsX: VANILLA_STARMS_X,
    armsY: VANILLA_STARMS_Y,
    numberY: VANILLA_ST_NUMBER_Y,
    tallNumWidth: VANILLA_ST_TALLNUM_WIDTH,
    healthX: VANILLA_ST_HEALTHX,
    armorX: VANILLA_ST_ARMORX,
    ammoX: VANILLA_ST_AMMOX,
    smallAmmoX: VANILLA_ST_AMMO_X,
    smallMaxAmmoX: VANILLA_ST_MAXAMMO_X,
    smallAmmoYOffsets: VANILLA_ST_AMMO_Y_OFFSETS,
    keyX: VANILLA_ST_KEY_X,
    keyYOffsets: VANILLA_ST_KEY_Y_OFFSETS,
  },
  automap: {
    panIncrement: VANILLA_AM_PAN_INCREMENT_FIXED,
    initScale: VANILLA_AM_INIT_SCALE_MTOF_FIXED,
    minScale: VANILLA_AM_MIN_SCALE_MTOF_FIXED,
    maxScale: VANILLA_AM_MAX_SCALE_MTOF_FIXED,
    palette: VANILLA_AM_PALETTE,
    numMarkPoints: VANILLA_AUTOMAP_NUM_MARKPOINTS,
    markPatchPrefix: VANILLA_AUTOMAP_MARK_PATCH_PREFIX,
  },
} as const);
