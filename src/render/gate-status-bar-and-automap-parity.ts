/**
 * Gate step 09-038: aggregate status bar and automap parity constants.
 */

import { VANILLA_AM_NUMMARKPOINTS } from './implement-automap-markers.ts';
import { AM_STATE_ACTIVE, AM_STATE_INACTIVE } from './implement-automap-start-stop-state.ts';
import { VANILLA_ST_DEADFACE, VANILLA_ST_FACEX, VANILLA_ST_FACEY, VANILLA_ST_GODFACE, VANILLA_ST_TOTAL_FACES } from './implement-status-bar-face-widget.ts';
import { VANILLA_ST_KEY_X, VANILLA_ST_NUM_KEY_SPRITES } from './implement-status-bar-key-and-ammo-widgets.ts';
import { VANILLA_ST_AMMOX, VANILLA_ST_ARMORX, VANILLA_ST_HEALTHX } from './implement-status-bar-numbers-and-percent-widgets.ts';

export const STATUS_AUTOMAP_PARITY_GATE = Object.freeze({
  stHealthX: VANILLA_ST_HEALTHX,
  stArmorX: VANILLA_ST_ARMORX,
  stAmmoX: VANILLA_ST_AMMOX,
  stFaceX: VANILLA_ST_FACEX,
  stFaceY: VANILLA_ST_FACEY,
  stGodFace: VANILLA_ST_GODFACE,
  stDeadFace: VANILLA_ST_DEADFACE,
  stTotalFaces: VANILLA_ST_TOTAL_FACES,
  stKeyX: VANILLA_ST_KEY_X,
  stNumKeySprites: VANILLA_ST_NUM_KEY_SPRITES,
  amNumMarkpoints: VANILLA_AM_NUMMARKPOINTS,
  amStateInactive: AM_STATE_INACTIVE,
  amStateActive: AM_STATE_ACTIVE,
} as const);
