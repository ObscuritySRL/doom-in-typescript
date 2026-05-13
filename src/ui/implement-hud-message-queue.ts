/**
 * Vanilla DOOM 1.9 HUD message queue contract.
 *
 * From Chocolate Doom 2.2.1 hu_stuff.c HU_Init / HU_Start / HU_Ticker / HU_Drawer:
 *
 *   #define HU_MSGTIMEOUT  (4 * TICRATE)   // 4 seconds @ TICRATE 35 = 140 tics
 *   #define HU_MSGX        0
 *   #define HU_MSGY        0
 *
 *   void HU_Ticker(void)
 *   {
 *       int  i, rc;
 *       char c;
 *
 *       // Tick down the message counter.
 *       if (--plr->message_counter == 0)
 *       {
 *           message_on = false;
 *           message_nottobefuckedwith = false;
 *       }
 *
 *       // Check for new message.
 *       if (showMessages || message_dontfuckwithme)
 *       {
 *           if ((plr->message && !message_nottobefuckedwith)
 *               || (plr->message && message_dontfuckwithme))
 *           {
 *               HUlib_addMessageToSText(&w_message, 0, plr->message);
 *               plr->message = 0;
 *               message_on = true;
 *               message_counter = HU_MSGTIMEOUT;
 *               message_nottobefuckedwith = message_dontfuckwithme;
 *               message_dontfuckwithme = 0;
 *           }
 *       }
 *   }
 *
 * Notes for parity:
 *   - HU_MSGTIMEOUT = 4 * TICRATE = 140 tics (4 seconds).
 *   - Messages display at HU_MSGX=0, HU_MSGY=0 (top-left of the screen).
 *   - showMessages is a player preference toggle (Options menu / messages on/off).
 *   - message_dontfuckwithme is set on critical messages (e.g. picked up keycard)
 *     that should display even when messages are toggled off.
 *   - message_nottobefuckedwith is set on the currently-displayed critical message;
 *     it prevents a non-critical message from replacing a critical one until its timer expires.
 *   - Adding a new message resets message_counter to HU_MSGTIMEOUT.
 *   - When message_counter reaches 0, message_on and message_nottobefuckedwith clear.
 */

export const VANILLA_HU_MSGTIMEOUT_TICS = 140;
export const VANILLA_HU_MSGX = 0;
export const VANILLA_HU_MSGY = 0;

export interface HudMessageState {
  readonly messageCounter: number;
  readonly messageOn: boolean;
  readonly messageNotToBeReplaced: boolean;
}

export const VANILLA_HUD_MESSAGE_INITIAL_STATE: HudMessageState = Object.freeze({
  messageCounter: 0,
  messageOn: false,
  messageNotToBeReplaced: false,
});

export interface HudMessageTickInput {
  readonly state: HudMessageState;
  readonly pendingMessage: string | null;
  readonly showMessagesPref: boolean;
  readonly messageIsCritical: boolean;
}

export interface HudMessageTickResult {
  readonly state: HudMessageState;
  readonly displayedMessage: string | null;
  readonly consumedPending: boolean;
}

export function tickVanillaHudMessageQueue(input: HudMessageTickInput): HudMessageTickResult {
  let counter = input.state.messageCounter;
  let on = input.state.messageOn;
  let locked = input.state.messageNotToBeReplaced;

  if (counter > 0) {
    counter -= 1;
    if (counter === 0) {
      on = false;
      locked = false;
    }
  }

  let displayedMessage: string | null = null;
  let consumedPending = false;

  if (input.pendingMessage && (input.showMessagesPref || input.messageIsCritical)) {
    if (!locked || input.messageIsCritical) {
      displayedMessage = input.pendingMessage;
      counter = VANILLA_HU_MSGTIMEOUT_TICS;
      on = true;
      locked = input.messageIsCritical;
      consumedPending = true;
    }
  }

  return Object.freeze({
    state: Object.freeze({ messageCounter: counter, messageOn: on, messageNotToBeReplaced: locked }),
    displayedMessage,
    consumedPending,
  });
}
