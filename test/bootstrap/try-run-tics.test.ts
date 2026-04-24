import { describe, expect, it } from 'bun:test';

import type { TicCallbacks, TicTimeSource } from '../../src/bootstrap/tryRunTics.ts';
import { BACKUPTICS, TicRunner } from '../../src/bootstrap/tryRunTics.ts';
import type { TicCommand } from '../../src/input/ticcmd.ts';
import { EMPTY_TICCMD } from '../../src/input/ticcmd.ts';
import { TICS_PER_SECOND } from '../../src/host/ticAccumulator.ts';

/** Create a TicTimeSource with a controllable time value. */
function createTimeSource(initialTime = 0): TicTimeSource & { time: number } {
  return {
    time: initialTime,
    getTime() {
      return this.time;
    },
  };
}

/** Create a TicCallbacks mock that records all calls for verification. */
function createCallbacks(options?: { advancedemo?: boolean; ticcmds?: TicCommand[] }): TicCallbacks & {
  advancedemoFlag: boolean;
  callLog: string[];
  ticcmdIndex: number;
} {
  const ticcmds = options?.ticcmds ?? [];
  const result = {
    advancedemoFlag: options?.advancedemo ?? false,
    callLog: [] as string[],
    ticcmdIndex: 0,
    startTic() {
      result.callLog.push('startTic');
    },
    buildTiccmd(): TicCommand {
      result.callLog.push('buildTiccmd');
      if (ticcmds.length > 0) {
        return ticcmds[result.ticcmdIndex++ % ticcmds.length];
      }
      return EMPTY_TICCMD;
    },
    ticker() {
      result.callLog.push('ticker');
    },
    get advancedemo() {
      return result.advancedemoFlag;
    },
    doAdvanceDemo() {
      result.callLog.push('doAdvanceDemo');
      result.advancedemoFlag = false;
    },
  };
  return result;
}

describe('BACKUPTICS', () => {
  it('equals 12 matching Chocolate Doom d_loop.h', () => {
    expect(BACKUPTICS).toBe(12);
  });

  it('is a positive integer', () => {
    expect(BACKUPTICS).toBeGreaterThan(0);
    expect(Number.isInteger(BACKUPTICS)).toBe(true);
  });
});

describe('construction and initial state', () => {
  it('gametic starts at 0', () => {
    const runner = new TicRunner();
    expect(runner.gametic).toBe(0);
  });

  it('maketic starts at 0', () => {
    const runner = new TicRunner();
    expect(runner.maketic).toBe(0);
  });

  it('lasttime starts at 0', () => {
    const runner = new TicRunner();
    expect(runner.lasttime).toBe(0);
  });

  it('getNetcmd returns EMPTY_TICCMD for all BACKUPTICS slots', () => {
    const runner = new TicRunner();
    for (let i = 0; i < BACKUPTICS; i++) {
      expect(runner.getNetcmd(i)).toBe(EMPTY_TICCMD);
    }
  });
});

describe('netUpdate', () => {
  it('does nothing when no time has passed', () => {
    const runner = new TicRunner();
    const time = createTimeSource(0);
    const callbacks = createCallbacks();

    runner.netUpdate(time, callbacks);

    expect(runner.maketic).toBe(0);
    expect(callbacks.callLog).toHaveLength(0);
  });

  it('builds one ticcmd for one new tic', () => {
    const runner = new TicRunner();
    const time = createTimeSource(1);
    const callbacks = createCallbacks();

    runner.netUpdate(time, callbacks);

    expect(runner.maketic).toBe(1);
    expect(callbacks.callLog).toEqual(['startTic', 'buildTiccmd']);
  });

  it('builds multiple ticcmds for multiple new tics', () => {
    const runner = new TicRunner();
    const time = createTimeSource(3);
    const callbacks = createCallbacks();

    runner.netUpdate(time, callbacks);

    expect(runner.maketic).toBe(3);
    expect(callbacks.callLog).toEqual(['startTic', 'buildTiccmd', 'startTic', 'buildTiccmd', 'startTic', 'buildTiccmd']);
  });

  it('stores ticcmds in the circular buffer', () => {
    const runner = new TicRunner();
    const time = createTimeSource(2);
    const cmd1: TicCommand = Object.freeze({
      angleturn: 0,
      buttons: 0,
      chatchar: 0,
      consistancy: 0,
      forwardmove: 25,
      sidemove: 0,
    });
    const cmd2: TicCommand = Object.freeze({
      angleturn: 0,
      buttons: 0,
      chatchar: 0,
      consistancy: 0,
      forwardmove: 50,
      sidemove: 0,
    });
    const callbacks = createCallbacks({ ticcmds: [cmd1, cmd2] });

    runner.netUpdate(time, callbacks);

    expect(runner.getNetcmd(0)).toBe(cmd1);
    expect(runner.getNetcmd(1)).toBe(cmd2);
  });

  it('stops building when buffer is full (maketic - gametic >= BACKUPTICS)', () => {
    const runner = new TicRunner();
    const time = createTimeSource(BACKUPTICS + 3);
    const callbacks = createCallbacks();

    runner.netUpdate(time, callbacks);

    expect(runner.maketic).toBe(BACKUPTICS);
    // startTic is called before the overflow guard, so one extra call
    // occurs on the iteration that breaks
    expect(callbacks.callLog.filter((c) => c === 'buildTiccmd')).toHaveLength(BACKUPTICS);
    expect(callbacks.callLog.filter((c) => c === 'startTic')).toHaveLength(BACKUPTICS + 1);
  });

  it('does nothing when time goes backward', () => {
    const runner = new TicRunner();
    const time = createTimeSource(5);
    const callbacks1 = createCallbacks();
    runner.netUpdate(time, callbacks1);

    time.time = 3;
    const callbacks2 = createCallbacks();
    runner.netUpdate(time, callbacks2);

    expect(runner.maketic).toBe(5);
    expect(callbacks2.callLog).toHaveLength(0);
  });

  it('updates lasttime on each call', () => {
    const runner = new TicRunner();
    const time = createTimeSource(5);
    const callbacks = createCallbacks();

    runner.netUpdate(time, callbacks);
    expect(runner.lasttime).toBe(5);

    time.time = 8;
    runner.netUpdate(time, callbacks);
    expect(runner.lasttime).toBe(8);
  });

  it('updates lasttime even when newtics is zero', () => {
    const runner = new TicRunner();
    const time = createTimeSource(5);
    const callbacks = createCallbacks();

    runner.netUpdate(time, callbacks);
    expect(runner.lasttime).toBe(5);

    time.time = 5;
    runner.netUpdate(time, callbacks);
    expect(runner.lasttime).toBe(5);
  });
});

describe('tryRunTics', () => {
  it('returns 0 when no tics are available', () => {
    const runner = new TicRunner();
    const time = createTimeSource(0);
    const callbacks = createCallbacks();

    const ran = runner.tryRunTics(time, callbacks);

    expect(ran).toBe(0);
    expect(runner.gametic).toBe(0);
  });

  it('builds and runs a single tic', () => {
    const runner = new TicRunner();
    const time = createTimeSource(1);
    const callbacks = createCallbacks();

    const ran = runner.tryRunTics(time, callbacks);

    expect(ran).toBe(1);
    expect(runner.gametic).toBe(1);
    expect(runner.maketic).toBe(1);
  });

  it('builds and runs multiple tics in sequence', () => {
    const runner = new TicRunner();
    const time = createTimeSource(3);
    const callbacks = createCallbacks();

    const ran = runner.tryRunTics(time, callbacks);

    expect(ran).toBe(3);
    expect(runner.gametic).toBe(3);
    expect(runner.maketic).toBe(3);
  });

  it('calls netUpdate before running tics (build-then-run ordering)', () => {
    const runner = new TicRunner();
    const time = createTimeSource(2);
    const callbacks = createCallbacks();

    runner.tryRunTics(time, callbacks);

    // All builds must complete before any tickers start
    const lastBuildIndex = callbacks.callLog.lastIndexOf('buildTiccmd');
    const firstTickerIndex = callbacks.callLog.indexOf('ticker');
    expect(lastBuildIndex).toBeLessThan(firstTickerIndex);
  });

  it('checks advancedemo before each ticker call', () => {
    const runner = new TicRunner();
    const time = createTimeSource(1);
    const callbacks = createCallbacks({ advancedemo: true });

    runner.tryRunTics(time, callbacks);

    expect(callbacks.callLog).toContain('doAdvanceDemo');
    const advanceIndex = callbacks.callLog.indexOf('doAdvanceDemo');
    const tickerIndex = callbacks.callLog.indexOf('ticker');
    expect(advanceIndex).toBeLessThan(tickerIndex);
  });

  it('calls doAdvanceDemo per tic when advancedemo stays true', () => {
    const runner = new TicRunner();
    const time = createTimeSource(3);
    const callLog: string[] = [];
    const callbacks: TicCallbacks = {
      startTic() {
        callLog.push('startTic');
      },
      buildTiccmd() {
        callLog.push('buildTiccmd');
        return EMPTY_TICCMD;
      },
      ticker() {
        callLog.push('ticker');
      },
      get advancedemo() {
        return true;
      },
      doAdvanceDemo() {
        callLog.push('doAdvanceDemo');
      },
    };

    runner.tryRunTics(time, callbacks);

    expect(callLog.filter((c) => c === 'doAdvanceDemo')).toHaveLength(3);
    expect(callLog.filter((c) => c === 'ticker')).toHaveLength(3);
  });

  it('returns the count of tics executed', () => {
    const runner = new TicRunner();
    const time = createTimeSource(5);
    const callbacks = createCallbacks();

    expect(runner.tryRunTics(time, callbacks)).toBe(5);
    expect(runner.gametic).toBe(5);
  });

  it('handles sequential calls correctly', () => {
    const runner = new TicRunner();
    const time = createTimeSource(2);
    const callbacks = createCallbacks();

    expect(runner.tryRunTics(time, callbacks)).toBe(2);

    time.time = 5;
    expect(runner.tryRunTics(time, callbacks)).toBe(3);

    expect(runner.gametic).toBe(5);
    expect(runner.maketic).toBe(5);
  });

  it('returns 0 on immediate second call when no new tics elapsed', () => {
    const runner = new TicRunner();
    const time = createTimeSource(3);
    const callbacks = createCallbacks();

    expect(runner.tryRunTics(time, callbacks)).toBe(3);
    expect(runner.tryRunTics(time, callbacks)).toBe(0);
    expect(runner.gametic).toBe(3);
  });

  it('consecutive zero-tic calls do not change state', () => {
    const runner = new TicRunner();
    const time = createTimeSource(0);
    const callbacks = createCallbacks();

    expect(runner.tryRunTics(time, callbacks)).toBe(0);
    expect(runner.tryRunTics(time, callbacks)).toBe(0);
    expect(runner.gametic).toBe(0);
    expect(runner.maketic).toBe(0);
  });
});

describe('parity-sensitive edge cases', () => {
  it('startTic precedes buildTiccmd in every iteration', () => {
    const runner = new TicRunner();
    const time = createTimeSource(3);
    const callbacks = createCallbacks();

    runner.netUpdate(time, callbacks);

    // Every startTic must be immediately followed by buildTiccmd
    for (let i = 0; i < 3; i++) {
      expect(callbacks.callLog[i * 2]).toBe('startTic');
      expect(callbacks.callLog[i * 2 + 1]).toBe('buildTiccmd');
    }
  });

  it('getNetcmd wraps circularly at BACKUPTICS boundary', () => {
    const runner = new TicRunner();
    const time = createTimeSource(1);
    const cmd: TicCommand = Object.freeze({
      angleturn: 0,
      buttons: 0,
      chatchar: 0,
      consistancy: 0,
      forwardmove: 42,
      sidemove: 0,
    });
    const callbacks = createCallbacks({ ticcmds: [cmd] });

    runner.netUpdate(time, callbacks);

    // tic 0 and tic BACKUPTICS alias in the circular buffer
    expect(runner.getNetcmd(0)).toBe(runner.getNetcmd(BACKUPTICS));
  });

  it('gametic equals maketic after full execution', () => {
    const runner = new TicRunner();
    const time = createTimeSource(7);
    const callbacks = createCallbacks();

    runner.tryRunTics(time, callbacks);

    expect(runner.gametic).toBe(runner.maketic);
    expect(runner.gametic).toBe(7);
  });

  it('buffer overflow does not prevent running previously built tics', () => {
    const runner = new TicRunner();
    const time = createTimeSource(BACKUPTICS + 5);
    const callbacks = createCallbacks();

    const ran = runner.tryRunTics(time, callbacks);

    // Builds BACKUPTICS ticcmds, then runs exactly that many
    expect(ran).toBe(BACKUPTICS);
    expect(runner.gametic).toBe(BACKUPTICS);
    expect(runner.maketic).toBe(BACKUPTICS);
  });

  it('advancedemo is checked per-tic, not once at the start of the run', () => {
    const runner = new TicRunner();
    const time = createTimeSource(3);
    let advanceCount = 0;
    let ticIndex = 0;
    const callbacks: TicCallbacks = {
      startTic() {},
      buildTiccmd() {
        return EMPTY_TICCMD;
      },
      ticker() {
        ticIndex++;
      },
      get advancedemo() {
        // Only true on the second tic execution (ticIndex === 1)
        return ticIndex === 1;
      },
      doAdvanceDemo() {
        advanceCount++;
      },
    };

    runner.tryRunTics(time, callbacks);

    expect(advanceCount).toBe(1);
    expect(ticIndex).toBe(3);
  });

  it('BACKUPTICS is not a power of 2 (modulo arithmetic, not masking)', () => {
    // In vanilla Doom, BACKUPTICS = 12 is not a power of 2.
    // The circular buffer uses tic % BACKUPTICS, not tic & (BACKUPTICS - 1).
    expect(BACKUPTICS).toBe(12);
    expect(Number.isInteger(Math.log2(BACKUPTICS))).toBe(false);
  });

  it('burst of tics after a pause catches up correctly', () => {
    const runner = new TicRunner();
    const time = createTimeSource(0);
    const callbacks = createCallbacks();

    runner.tryRunTics(time, callbacks);
    expect(runner.gametic).toBe(0);

    // Simulate a pause, then jump forward by 10 tics
    time.time = 10;
    const ran = runner.tryRunTics(time, callbacks);
    expect(ran).toBe(10);
    expect(runner.gametic).toBe(10);
  });

  it('independent instances do not share state', () => {
    const runner1 = new TicRunner();
    const runner2 = new TicRunner();
    const time = createTimeSource(5);
    const callbacks = createCallbacks();

    runner1.tryRunTics(time, callbacks);

    expect(runner1.gametic).toBe(5);
    expect(runner2.gametic).toBe(0);
  });

  it('ticcmd from getNetcmd matches what buildTiccmd returned', () => {
    const runner = new TicRunner();
    const time = createTimeSource(3);
    const cmds = [
      Object.freeze({ angleturn: 640, buttons: 1, chatchar: 0, consistancy: 0, forwardmove: 10, sidemove: 0 }),
      Object.freeze({ angleturn: -640, buttons: 2, chatchar: 0, consistancy: 0, forwardmove: 20, sidemove: 5 }),
      Object.freeze({ angleturn: 0, buttons: 0, chatchar: 0, consistancy: 0, forwardmove: 50, sidemove: -10 }),
    ];
    const callbacks = createCallbacks({ ticcmds: cmds });

    runner.tryRunTics(time, callbacks);

    expect(runner.getNetcmd(0)).toBe(cmds[0]);
    expect(runner.getNetcmd(1)).toBe(cmds[1]);
    expect(runner.getNetcmd(2)).toBe(cmds[2]);
  });

  it('BACKUPTICS at 35 Hz provides over 340ms of buffering (F-010 cross-ref)', () => {
    const bufferMilliseconds = (BACKUPTICS / TICS_PER_SECOND) * 1000;
    expect(bufferMilliseconds).toBeGreaterThan(340);
    expect(bufferMilliseconds).toBeLessThan(350);
  });
});
