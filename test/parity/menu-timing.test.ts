import { describe, expect, it } from 'bun:test';

import { createHash } from 'node:crypto';

import { REFERENCE_BUNDLE_PATH } from '../../src/reference/policy.ts';
import { canAcceptJoyInput, canAcceptMouseInput, createMenuState, markJoyInputConsumed, markMouseInputConsumed, MOUSE_JOY_REPEAT_DELAY, SKULL_ANIM_TIME, tickMenu } from '../../src/ui/menus.ts';
import { createFrontEndSequence, setMenuActive, tickFrontEnd } from '../../src/ui/frontEndSequence.ts';
import menuTimingFixture from './fixtures/menuTiming.json';

function sha(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex').toUpperCase();
}

function buildSkullTrace(): Array<{ tic: number; whichSkull: number; skullAnimCounter: number }> {
  const state = createMenuState();
  const trace = [];

  for (let tic = 1; tic <= SKULL_ANIM_TIME * 2; tic++) {
    tickMenu(state);
    trace.push({
      tic,
      whichSkull: state.whichSkull,
      skullAnimCounter: state.skullAnimCounter,
    });
  }

  return trace;
}

function buildRepeatTrace(): {
  readonly armedTrace: Array<{ tic: number; mouseAccepted: boolean; joyAccepted: boolean }>;
  readonly initialTrace: Array<{ tic: number; mouseAccepted: boolean; joyAccepted: boolean }>;
} {
  const state = createMenuState();
  const initialTrace = [0, 1].map((tic) => ({
    tic,
    mouseAccepted: canAcceptMouseInput(state, tic),
    joyAccepted: canAcceptJoyInput(state, tic),
  }));

  markMouseInputConsumed(state, menuTimingFixture.repeatGates.armedAtTic);
  markJoyInputConsumed(state, menuTimingFixture.repeatGates.armedAtTic);

  const armedTrace = [];
  for (let tic = menuTimingFixture.repeatGates.armedAtTic; tic <= menuTimingFixture.repeatGates.firstAcceptedTic; tic++) {
    armedTrace.push({
      tic,
      mouseAccepted: canAcceptMouseInput(state, tic),
      joyAccepted: canAcceptJoyInput(state, tic),
    });
  }

  return { armedTrace, initialTrace };
}

function buildFrontEndTrace(): {
  readonly advanceLump: string;
  readonly firstPageLump: string;
  readonly firstPageMusic: string | null;
  readonly firstPagePagetic: number;
  readonly idleTicksBeforeAdvance: number;
  readonly menuActiveTrace: Array<{ tic: number; actionKind: string; pagetic: number }>;
  readonly menuClosedTrace: Array<{ tic: number; actionKind: string; pagetic: number }>;
} {
  const state = createFrontEndSequence('shareware');
  const firstAction = tickFrontEnd(state);

  if (firstAction.kind !== 'showPage') {
    throw new Error('expected showPage on the first front-end tick');
  }

  setMenuActive(state, true);
  const menuActiveTrace = [];
  for (let tic = 1; tic <= 5; tic++) {
    const action = tickFrontEnd(state);
    menuActiveTrace.push({
      tic,
      actionKind: action.kind,
      pagetic: state.titleLoop.pagetic,
    });
  }

  setMenuActive(state, false);
  const menuClosedTrace = [];
  for (let tic = 6; tic <= 8; tic++) {
    const action = tickFrontEnd(state);
    menuClosedTrace.push({
      tic,
      actionKind: action.kind,
      pagetic: state.titleLoop.pagetic,
    });
  }

  let idleTicksBeforeAdvance = 8;
  while (!state.titleLoop.advancedemo) {
    tickFrontEnd(state);
    idleTicksBeforeAdvance++;
    if (idleTicksBeforeAdvance > 500) {
      throw new Error('front-end page ticker never requested advance');
    }
  }

  const demoAction = tickFrontEnd(state);
  if (demoAction.kind !== 'playDemo') {
    throw new Error('expected DEMO1 after the title page expires');
  }

  return {
    advanceLump: demoAction.demoLump,
    firstPageLump: firstAction.lumpName,
    firstPageMusic: firstAction.musicLump,
    firstPagePagetic: firstAction.pagetic,
    idleTicksBeforeAdvance,
    menuActiveTrace,
    menuClosedTrace,
  };
}

async function readExecutable(path: string): Promise<Buffer> {
  return Buffer.from(await Bun.file(path).arrayBuffer());
}

const DOOM_EXE_PATH = `${REFERENCE_BUNDLE_PATH}\\DOOM.EXE`;
const DOOMD_EXE_PATH = `${REFERENCE_BUNDLE_PATH}\\DOOMD.EXE`;

describe('menu timing parity fixture', () => {
  it('locks the 16-tic skull blink cadence even while the menu is inactive', () => {
    const trace = buildSkullTrace();

    expect(menuTimingFixture.menuAnimation.initialWhichSkull).toBe(0);
    expect(menuTimingFixture.menuAnimation.initialSkullAnimCounter).toBe(SKULL_ANIM_TIME);
    expect(menuTimingFixture.menuAnimation.ticCount).toBe(SKULL_ANIM_TIME * 2);
    expect(trace.filter(({ tic }) => tic === 1 || tic === 7 || tic === 8 || tic === 16)).toEqual(menuTimingFixture.menuAnimation.checkpoints);
    expect(sha(trace)).toBe(menuTimingFixture.menuAnimation.streamHash);
  });

  it('locks the strict > mouse/joystick repeat gate, including the tic-0 and deadline equality quirks', () => {
    const trace = buildRepeatTrace();

    expect(MOUSE_JOY_REPEAT_DELAY).toBe(menuTimingFixture.repeatGates.mouseJoyRepeatDelay);
    expect(trace.initialTrace).toEqual(menuTimingFixture.repeatGates.initialTrace);
    expect(trace.armedTrace).toEqual(menuTimingFixture.repeatGates.armedTrace);
    expect(menuTimingFixture.repeatGates.deadlineTic).toBe(menuTimingFixture.repeatGates.armedAtTic + menuTimingFixture.repeatGates.mouseJoyRepeatDelay);
    expect(menuTimingFixture.repeatGates.firstAcceptedTic).toBe(menuTimingFixture.repeatGates.deadlineTic + 1);
    expect(
      sha({
        armedRepeatTrace: trace.armedTrace.map(({ joyAccepted, mouseAccepted, tic }) => ({
          joyAccepted,
          mouseAccepted,
          tic,
        })),
        initialRepeatTrace: trace.initialTrace.map(({ joyAccepted, mouseAccepted, tic }) => ({
          joyAccepted,
          mouseAccepted,
          tic,
        })),
      }),
    ).toBe(menuTimingFixture.repeatGates.streamHash);
  });

  it('locks the title-page countdown while the menu overlay is open, including the pagetic+1 advance quirk', () => {
    const trace = buildFrontEndTrace();

    expect(trace.firstPageLump).toBe(menuTimingFixture.frontEndTiming.firstPageLump);
    expect(trace.firstPageMusic).toBe(menuTimingFixture.frontEndTiming.firstPageMusic);
    expect(trace.firstPagePagetic).toBe(menuTimingFixture.frontEndTiming.firstPagePagetic);
    expect(trace.menuActiveTrace).toEqual(menuTimingFixture.frontEndTiming.menuActiveTrace);
    expect(trace.menuClosedTrace).toEqual(menuTimingFixture.frontEndTiming.menuClosedTrace);
    expect(trace.idleTicksBeforeAdvance).toBe(menuTimingFixture.frontEndTiming.idleTicksBeforeAdvance);
    expect(trace.advanceLump).toBe(menuTimingFixture.frontEndTiming.advanceLump);
    expect(
      sha({
        firstAction: {
          kind: 'showPage',
          lumpName: trace.firstPageLump,
          musicLump: trace.firstPageMusic,
          pagetic: trace.firstPagePagetic,
        },
        idleTicksBeforeAdvance: trace.idleTicksBeforeAdvance,
        menuActiveTrace: trace.menuActiveTrace.map(({ actionKind, pagetic, tic }) => ({
          actionKind,
          pagetic,
          tic,
        })),
        menuClosedTrace: trace.menuClosedTrace.map(({ actionKind, pagetic, tic }) => ({
          actionKind,
          pagetic,
          tic,
        })),
      }),
    ).toBe(menuTimingFixture.frontEndTiming.streamHash);
  });

  it('anchors menu/UI strings back to both bundled DOS executables', async () => {
    const [doomExe, doomdExe] = await Promise.all([readExecutable(DOOM_EXE_PATH), readExecutable(DOOMD_EXE_PATH)]);

    for (const requiredString of menuTimingFixture.binaryAnchors.requiredStrings) {
      const ascii = Buffer.from(requiredString, 'ascii');
      expect(doomExe.includes(ascii)).toBe(true);
      expect(doomdExe.includes(ascii)).toBe(true);
    }
  });
});
