/**
 * Vanilla Chocolate Doom 2.2.1 demo ticcmd parser.
 *
 * After the 13-byte header (04-019), the demo stream is a sequence of 4-byte
 * ticcmd records terminated by 0x80:
 *   byte 0: forwardmove (signed 8-bit)
 *   byte 1: sidemove (signed 8-bit)
 *   byte 2: angleturn (signed 8-bit; multiplied by 256 internally)
 *   byte 3: chatchar/buttons (lower 4 bits are buttons, upper 4 bits chat)
 *
 * Vanilla stops reading at the first byte equal to 0x80 (the terminator).
 */

export const VANILLA_DEMO_TICCMD_RECORD_BYTES = 4;
export const VANILLA_DEMO_TERMINATOR_BYTE = 0x80;
export const VANILLA_ANGLETURN_BYTE_TO_INTERNAL_SCALE = 256;
export const VANILLA_BUTTONS_MASK = 0x0f;
export const VANILLA_CHATCHAR_MASK = 0xf0;
export const VANILLA_CHATCHAR_SHIFT = 4;

export interface DemoTiccmd {
  readonly forwardMove: number;
  readonly sideMove: number;
  readonly angleTurn: number;
  readonly buttons: number;
  readonly chatChar: number;
}

export interface DemoTiccmdStream {
  readonly ticcmds: readonly DemoTiccmd[];
  readonly endedAtTerminator: boolean;
  readonly bytesConsumed: number;
}

function signed8(byte: number): number {
  return byte > 127 ? byte - 256 : byte;
}

export function parseDemoTiccmdStream(bytes: Uint8Array, startOffset: number): DemoTiccmdStream {
  const ticcmds: DemoTiccmd[] = [];
  let cursorOffset = startOffset;
  let endedAtTerminator = false;
  while (cursorOffset + VANILLA_DEMO_TICCMD_RECORD_BYTES <= bytes.length) {
    if (bytes[cursorOffset] === VANILLA_DEMO_TERMINATOR_BYTE) {
      endedAtTerminator = true;
      cursorOffset += 1;
      break;
    }
    ticcmds.push(
      Object.freeze({
        forwardMove: signed8(bytes[cursorOffset]!),
        sideMove: signed8(bytes[cursorOffset + 1]!),
        angleTurn: signed8(bytes[cursorOffset + 2]!) * VANILLA_ANGLETURN_BYTE_TO_INTERNAL_SCALE,
        buttons: bytes[cursorOffset + 3]! & VANILLA_BUTTONS_MASK,
        chatChar: (bytes[cursorOffset + 3]! & VANILLA_CHATCHAR_MASK) >>> VANILLA_CHATCHAR_SHIFT,
      } satisfies DemoTiccmd),
    );
    cursorOffset += VANILLA_DEMO_TICCMD_RECORD_BYTES;
  }
  return Object.freeze({
    ticcmds: Object.freeze(ticcmds),
    endedAtTerminator,
    bytesConsumed: cursorOffset - startOffset,
  });
}
