import { describe, expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { resolve, sep } from 'node:path';

import { TSCONFIG_PATH, VERIFY_COMMAND_COUNT, VERIFY_COMMAND_KINDS, buildVerifySequence, verifyPackageRoot } from '../../tools/verify.ts';
import type { VerifyCommand, VerifyCommandKind } from '../../tools/verify.ts';

const ROOT = resolve(import.meta.dir, '..', '..');

describe('VERIFY_COMMAND_KINDS', () => {
  test('contains exactly 3 kinds', () => {
    expect(VERIFY_COMMAND_KINDS).toHaveLength(VERIFY_COMMAND_COUNT);
  });

  test('kinds are in mandatory execution order', () => {
    expect(VERIFY_COMMAND_KINDS).toEqual(['focused-test', 'full-suite', 'typecheck']);
  });

  test('all kinds are unique', () => {
    const unique = new Set(VERIFY_COMMAND_KINDS);
    expect(unique.size).toBe(VERIFY_COMMAND_KINDS.length);
  });

  test('array is frozen', () => {
    expect(Object.isFrozen(VERIFY_COMMAND_KINDS)).toBe(true);
  });

  test('VERIFY_COMMAND_COUNT equals 3', () => {
    expect(VERIFY_COMMAND_COUNT).toBe(3);
  });
});

describe('TSCONFIG_PATH', () => {
  test('is an absolute path', () => {
    expect(TSCONFIG_PATH).toMatch(/^[A-Z]:\\/i);
  });

  test('points to tsconfig.json', () => {
    expect(TSCONFIG_PATH.endsWith('tsconfig.json')).toBe(true);
  });

  test('points to the current package tsconfig', () => {
    expect(TSCONFIG_PATH).toBe(resolve(ROOT, 'tsconfig.json'));
  });

  test('file exists on disk', () => {
    expect(existsSync(TSCONFIG_PATH)).toBe(true);
  });
});

describe('verifyPackageRoot', () => {
  test('resolves to the current package root', () => {
    expect(verifyPackageRoot()).toBe(ROOT);
  });

  test('directory exists on disk', () => {
    expect(existsSync(verifyPackageRoot())).toBe(true);
  });
});

describe('buildVerifySequence', () => {
  const SAMPLE_TEST = 'test/core/fixed.constants.test.ts';
  const commands = buildVerifySequence(SAMPLE_TEST);

  test('returns exactly 3 commands', () => {
    expect(commands).toHaveLength(VERIFY_COMMAND_COUNT);
  });

  test('result array is frozen', () => {
    expect(Object.isFrozen(commands)).toBe(true);
  });

  test('each command object is frozen', () => {
    for (const command of commands) {
      expect(Object.isFrozen(command)).toBe(true);
    }
  });

  test('each command args array is frozen', () => {
    for (const command of commands) {
      expect(Object.isFrozen(command.args)).toBe(true);
    }
  });

  test('order values are 0, 1, 2', () => {
    const orders = commands.map((command) => command.order);
    expect(orders).toEqual([0, 1, 2]);
  });

  test('kinds match VERIFY_COMMAND_KINDS in order', () => {
    const kinds = commands.map((command) => command.kind);
    expect(kinds).toEqual([...VERIFY_COMMAND_KINDS]);
  });

  test('all commands use bun as the executable', () => {
    for (const command of commands) {
      expect(command.command).toBe('bun');
    }
  });

  test('all commands have non-empty descriptions', () => {
    for (const command of commands) {
      expect(command.description.length).toBeGreaterThan(0);
    }
  });
});

describe('focused-test command', () => {
  const SAMPLE_TEST = 'test/scaffold/verify-commands.test.ts';
  const commands = buildVerifySequence(SAMPLE_TEST);
  const focused = commands[0];

  test('kind is focused-test', () => {
    expect(focused.kind).toBe('focused-test');
  });

  test('args start with test subcommand', () => {
    expect(focused.args[0]).toBe('test');
  });

  test('args include the focused test path', () => {
    expect(focused.args[1]).toBe(SAMPLE_TEST);
  });

  test('args length is exactly 2', () => {
    expect(focused.args).toHaveLength(2);
  });

  test('description includes the test path', () => {
    expect(focused.description).toContain(SAMPLE_TEST);
  });
});

describe('full-suite command', () => {
  const commands = buildVerifySequence('test/any.test.ts');
  const fullSuite = commands[1];

  test('kind is full-suite', () => {
    expect(fullSuite.kind).toBe('full-suite');
  });

  test('args is exactly ["test"]', () => {
    expect([...fullSuite.args]).toEqual(['test']);
  });

  test('does not include any test path filter', () => {
    expect(fullSuite.args).toHaveLength(1);
  });
});

describe('typecheck command', () => {
  const commands = buildVerifySequence('test/any.test.ts');
  const typecheck = commands[2];

  test('kind is typecheck', () => {
    expect(typecheck.kind).toBe('typecheck');
  });

  test('args start with x tsc', () => {
    expect(typecheck.args[0]).toBe('x');
    expect(typecheck.args[1]).toBe('tsc');
  });

  test('args include --noEmit', () => {
    expect(typecheck.args).toContain('--noEmit');
  });

  test('args include --project with TSCONFIG_PATH', () => {
    const projectIndex = typecheck.args.indexOf('--project');
    expect(projectIndex).toBeGreaterThan(-1);
    expect(typecheck.args[projectIndex + 1]).toBe(TSCONFIG_PATH);
  });

  test('args length is exactly 5', () => {
    expect(typecheck.args).toHaveLength(5);
  });
});

describe('parity: sequence is invariant across test paths', () => {
  const sequenceA = buildVerifySequence('test/core/fixed.constants.test.ts');
  const sequenceB = buildVerifySequence('test/wad/header-directory.test.ts');

  test('full-suite command is identical regardless of focused path', () => {
    expect([...sequenceA[1].args]).toEqual([...sequenceB[1].args]);
    expect(sequenceA[1].kind).toBe(sequenceB[1].kind);
  });

  test('typecheck command is identical regardless of focused path', () => {
    expect([...sequenceA[2].args]).toEqual([...sequenceB[2].args]);
    expect(sequenceA[2].kind).toBe(sequenceB[2].kind);
  });

  test('only focused-test args differ between sequences', () => {
    expect(sequenceA[0].args[1]).not.toBe(sequenceB[0].args[1]);
    expect(sequenceA[0].kind).toBe(sequenceB[0].kind);
  });
});

describe('parity edge case: focused path with nested directories', () => {
  const deepPath = 'test/bootstrap/config-precedence.test.ts';
  const commands = buildVerifySequence(deepPath);

  test('focused-test preserves the exact relative path', () => {
    expect(commands[0].args[1]).toBe(deepPath);
  });

  test('ordering invariant holds for deep paths', () => {
    expect(commands[0].order).toBe(0);
    expect(commands[1].order).toBe(1);
    expect(commands[2].order).toBe(2);
  });
});

describe('compile-time type satisfaction', () => {
  test('VerifyCommand interface is satisfied by buildVerifySequence output', () => {
    const commands = buildVerifySequence('test/any.test.ts');
    const command: VerifyCommand = commands[0];
    expect(command.kind).toBeDefined();
    expect(command.description).toBeDefined();
    expect(command.command).toBeDefined();
    expect(command.args).toBeDefined();
    expect(command.order).toBeDefined();
  });

  test('VerifyCommandKind discriminant narrows correctly', () => {
    const kind: VerifyCommandKind = 'focused-test';
    expect(VERIFY_COMMAND_KINDS).toContain(kind);
  });
});
