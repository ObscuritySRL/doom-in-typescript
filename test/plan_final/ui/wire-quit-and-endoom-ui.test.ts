import { describe, expect, test } from 'bun:test';

import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  CANONICAL_QUIT_ORDER,
  CANONICAL_REGISTRATION_ORDER,
  CLEANUP_STEP_COUNT,
  ENDOOM_BYTES_PER_CELL,
  ENDOOM_CELL_COUNT,
  ENDOOM_COLUMNS,
  ENDOOM_ROWS,
  ENDOOM_SIZE,
  QuitFlow,
  VANILLA_QUIT_ENDOOM_INVARIANTS,
  parseEndoom,
} from '../../../src/vanilla/wireQuitAndEndoomUi.ts';

const REPOSITORY_ROOT_DIRECTORY = process.cwd();
const WIRE_PATH = join(REPOSITORY_ROOT_DIRECTORY, 'src/vanilla/wireQuitAndEndoomUi.ts');

describe('plan_final ui: wire-quit-and-endoom-ui', () => {
  test('src/vanilla/wireQuitAndEndoomUi.ts exists, is a regular file, and cites plan_final step 07-010', () => {
    expect(existsSync(WIRE_PATH)).toBe(true);
    expect(statSync(WIRE_PATH).isFile()).toBe(true);
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain('07-010');
    expect(fileText).toContain('VANILLA_QUIT_ENDOOM_INVARIANTS');
  });

  test('the facade re-exports from the read-only endoom + quitFlow modules without modifying them', () => {
    const fileText = readFileSync(WIRE_PATH, 'utf8');
    expect(fileText).toContain("from '../ui/endoom.ts'");
    expect(fileText).toContain("from '../bootstrap/quitFlow.ts'");
  });

  test('VANILLA_QUIT_ENDOOM_INVARIANTS pins the four quit/ENDOOM parity rules and is frozen', () => {
    expect(VANILLA_QUIT_ENDOOM_INVARIANTS.length).toBe(4);
    expect(Object.isFrozen(VANILLA_QUIT_ENDOOM_INVARIANTS)).toBe(true);
    const ids = VANILLA_QUIT_ENDOOM_INVARIANTS.map((invariant) => invariant.id).sort();
    expect(ids).toEqual(['CLEAN_QUIT_DRAINS_ATEXIT_STACK_LIFO', 'ENDOOM_IS_80X25_VGA_TEXT_SCREEN', 'ENDOOM_SHOWN_AFTER_GRAPHICS_SHUTDOWN', 'QUIT_REQUIRES_RANDOMIZED_CONFIRMATION']);
    for (const invariant of VANILLA_QUIT_ENDOOM_INVARIANTS) {
      expect(invariant.rule.length).toBeGreaterThan(0);
      expect(Object.isFrozen(invariant)).toBe(true);
    }
  });

  test('every wired quit/ENDOOM symbol is re-exported and callable', () => {
    expect(typeof parseEndoom).toBe('function');
    expect(typeof QuitFlow).toBe('function');
    expect(ENDOOM_COLUMNS).toBe(80);
    expect(ENDOOM_ROWS).toBe(25);
    expect(ENDOOM_BYTES_PER_CELL).toBe(2);
    expect(ENDOOM_CELL_COUNT).toBe(2000);
    expect(ENDOOM_SIZE).toBe(4000);
    expect(CLEANUP_STEP_COUNT).toBe(8);
  });

  test('parseEndoom decodes a 4000-byte VGA text screen into 2000 frozen cells and rejects wrong sizes', () => {
    const lump = Buffer.alloc(ENDOOM_SIZE);
    lump[0] = 0x41;
    lump[1] = 0x8f;
    const screen = parseEndoom(lump);
    expect(screen.width).toBe(80);
    expect(screen.height).toBe(25);
    expect(screen.cells.length).toBe(ENDOOM_CELL_COUNT);
    expect(Object.isFrozen(screen)).toBe(true);
    expect(Object.isFrozen(screen.cells)).toBe(true);
    expect(screen.cells[0]).toEqual({ character: 0x41, foreground: 0x0f, background: 0x00, blink: true });
    expect(() => parseEndoom(Buffer.alloc(ENDOOM_SIZE - 1))).toThrow(RangeError);
  });

  test('the clean-quit path drains the I_AtExit stack in LIFO order with ENDOOM right after graphics shutdown', () => {
    expect(CANONICAL_QUIT_ORDER[0]).toBe('I_ShutdownGraphics');
    expect(CANONICAL_QUIT_ORDER[1]).toBe('D_Endoom');
    expect(CANONICAL_QUIT_ORDER.length).toBe(CLEANUP_STEP_COUNT);
    expect([...CANONICAL_QUIT_ORDER]).toEqual([...CANONICAL_REGISTRATION_ORDER].reverse().map((registration) => registration.name));

    const flow = new QuitFlow();
    for (const registration of CANONICAL_REGISTRATION_ORDER) {
      flow.register(registration.name, registration.runOnError);
    }
    const executed: string[] = [];
    const result = flow.executeQuit((name) => executed.push(name));
    expect(executed).toEqual([...CANONICAL_QUIT_ORDER]);
    expect([...result]).toEqual([...CANONICAL_QUIT_ORDER]);
    expect(flow.hasQuit).toBe(true);
  });

  test('the re-exported symbols are the SAME references as the read-only source modules export', async () => {
    const endoomSource = await import('../../../src/ui/endoom.ts');
    const quitFlowSource = await import('../../../src/bootstrap/quitFlow.ts');
    expect(parseEndoom).toBe(endoomSource.parseEndoom);
    expect(ENDOOM_SIZE).toBe(endoomSource.ENDOOM_SIZE);
    expect(QuitFlow).toBe(quitFlowSource.QuitFlow);
    expect(CANONICAL_QUIT_ORDER).toBe(quitFlowSource.CANONICAL_QUIT_ORDER);
  });
});
