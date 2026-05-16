import { describe, expect, test } from 'bun:test';

import { ANG90, ANG180, ANG270 } from '../../src/core/angle.ts';
import { ANGLETOFINESHIFT, finecosine, finesine } from '../../src/core/trig.ts';
import type { SetupFramePlayer } from '../../src/render/setupFrame.ts';
import { setupFrame } from '../../src/render/setupFrame.ts';

function player(overrides: Partial<SetupFramePlayer> = {}): SetupFramePlayer {
  return { mobjX: 1024 << 16, mobjY: -2048 << 16, mobjAngle: ANG90, viewz: 41 << 16, extralight: 0, fixedColormap: 0, ...overrides };
}

describe('setupFrame: R_SetupFrame view transform', () => {
  test('passes viewx/viewy/viewz/extralight straight through from the player', () => {
    const frame = setupFrame(player({ mobjX: 777 << 16, mobjY: -333 << 16, viewz: 50 << 16, extralight: 2 }));
    expect(frame.viewx).toBe(777 << 16);
    expect(frame.viewy).toBe(-333 << 16);
    expect(frame.viewz).toBe(50 << 16);
    expect(frame.extralight).toBe(2);
  });

  test('viewangle = mobjAngle + viewangleoffset with 32-bit BAM wrap', () => {
    expect(setupFrame(player({ mobjAngle: ANG90 })).viewangle).toBe(ANG90 >>> 0);
    // wrap: ANG270 + ANG180 = 0x140000000 → >>>0 → ANG90
    expect(setupFrame(player({ mobjAngle: ANG270 }), ANG180).viewangle).toBe((ANG270 + ANG180) >>> 0);
    expect(setupFrame(player({ mobjAngle: ANG270 }), ANG180).viewangle).toBe(ANG90 >>> 0);
    expect(setupFrame(player({ mobjAngle: 0xffff_0000 }), 0x0002_0000).viewangle).toBe(0x0001_0000);
  });

  test('viewsin / viewcos are finesine / finecosine at viewangle >> ANGLETOFINESHIFT (independent re-derivation)', () => {
    for (const mobjAngle of [0, ANG90, ANG180, ANG270, 0x1234_5678, 0xabcd_ef01]) {
      for (const offset of [0, ANG90, 0x0fed_cba0]) {
        const frame = setupFrame(player({ mobjAngle }), offset);
        const fineIndex = ((mobjAngle + offset) >>> 0) >>> ANGLETOFINESHIFT;
        expect(frame.viewangle).toBe((mobjAngle + offset) >>> 0);
        expect(frame.viewsin).toBe(finesine[fineIndex]!);
        expect(frame.viewcos).toBe(finecosine[fineIndex]!);
      }
    }
  });

  test('fixedColormapIndex is null when player.fixedColormap === 0, else the row index', () => {
    expect(setupFrame(player({ fixedColormap: 0 })).fixedColormapIndex).toBeNull();
    expect(setupFrame(player({ fixedColormap: 32 })).fixedColormapIndex).toBe(32); // invulnerability
    expect(setupFrame(player({ fixedColormap: 1 })).fixedColormapIndex).toBe(1); // light-amp goggles
  });

  test('is deterministic', () => {
    const p = player({ mobjAngle: 0x2468_ace0, extralight: 1, fixedColormap: 32 });
    expect(setupFrame(p)).toEqual(setupFrame(p));
  });
});
