/**
 * Vanilla DOOM 1.9 keycard and skull key pickup contract.
 *
 * From Chocolate Doom 2.2.1 p_inter.c P_GiveCard (called by P_TouchSpecialThing
 * for SPR_BKEY/SPR_YKEY/SPR_RKEY/SPR_BSKU/SPR_YSKU/SPR_RSKU):
 *   if (player->cards[card]) return;          // already owned, no-op
 *   player->bonuscount = BONUSADD;            // brief screen tint
 *   player->cards[card] = 1;
 *
 * Card enum (card_t in doomdef.h, NUMCARDS = 6):
 *   it_bluecard   = 0
 *   it_yellowcard = 1
 *   it_redcard    = 2
 *   it_blueskull  = 3
 *   it_yellowskull= 4
 *   it_redskull   = 5
 *
 * P_TouchSpecialThing dispatches by sprite -> card index in P_GiveCard
 * (single-player only — coop allows duplicate pickup, deathmatch removes
 * the card thing).
 */

export const VANILLA_IT_BLUECARD = 0;
export const VANILLA_IT_YELLOWCARD = 1;
export const VANILLA_IT_REDCARD = 2;
export const VANILLA_IT_BLUESKULL = 3;
export const VANILLA_IT_YELLOWSKULL = 4;
export const VANILLA_IT_REDSKULL = 5;
export const VANILLA_NUMCARDS = 6;

/** Bonuscount added to player on key pickup, also used for screen flash. */
export const VANILLA_BONUSADD = 6;

export const VANILLA_CARD_INDEX_NAMES = Object.freeze(['bluecard', 'yellowcard', 'redcard', 'blueskull', 'yellowskull', 'redskull'] as const);
export type VanillaCardName = (typeof VANILLA_CARD_INDEX_NAMES)[number];

export interface KeyPickupInput {
  readonly cardIndex: number;
  readonly currentlyOwned: boolean;
}

export interface KeyPickupResult {
  readonly gave: boolean;
  readonly cardIndex: number;
  readonly bonusCountAdd: number;
}

export function applyVanillaKeyPickup(input: KeyPickupInput): KeyPickupResult {
  if (input.currentlyOwned) {
    return Object.freeze({ gave: false, cardIndex: input.cardIndex, bonusCountAdd: 0 });
  }
  return Object.freeze({ gave: true, cardIndex: input.cardIndex, bonusCountAdd: VANILLA_BONUSADD });
}
