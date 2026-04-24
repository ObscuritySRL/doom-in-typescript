import { describe, expect, test } from 'bun:test';

import { CommandLine, createEmpty, createFromProcessArgv } from '../../src/bootstrap/cmdline.ts';

describe('CommandLine constructor', () => {
  test('stores arguments as a frozen copy', () => {
    const source = ['doom.exe', '-skill', '4'];
    const cmdline = new CommandLine(source);
    source[1] = 'MUTATED';
    expect(cmdline.at(1)).toBe('-skill');
  });

  test('handles empty argument list', () => {
    const cmdline = new CommandLine([]);
    expect(cmdline.count).toBe(0);
  });

  test('handles program-name-only argument list', () => {
    const cmdline = new CommandLine(['doom.exe']);
    expect(cmdline.count).toBe(1);
  });
});

describe('count', () => {
  test('equals myargc equivalent for typical invocation', () => {
    const cmdline = new CommandLine(['doom.exe', '-skill', '4', '-devparm']);
    expect(cmdline.count).toBe(4);
  });

  test('is 0 for empty argument list', () => {
    const cmdline = new CommandLine([]);
    expect(cmdline.count).toBe(0);
  });
});

describe('at', () => {
  test('returns program name at index 0', () => {
    const cmdline = new CommandLine(['doom.exe', '-iwad', 'doom1.wad']);
    expect(cmdline.at(0)).toBe('doom.exe');
  });

  test('returns undefined for out-of-range index', () => {
    const cmdline = new CommandLine(['doom.exe']);
    expect(cmdline.at(99)).toBeUndefined();
  });

  test('returns undefined for negative index', () => {
    const cmdline = new CommandLine(['doom.exe', '-skill']);
    expect(cmdline.at(-1)).toBeUndefined();
  });
});

describe('checkParameter', () => {
  test('returns 1-based index when parameter is found', () => {
    const cmdline = new CommandLine(['doom.exe', '-skill', '4', '-devparm']);
    expect(cmdline.checkParameter('-skill')).toBe(1);
    expect(cmdline.checkParameter('-devparm')).toBe(3);
  });

  test('returns 0 when parameter is not found', () => {
    const cmdline = new CommandLine(['doom.exe', '-skill', '4']);
    expect(cmdline.checkParameter('-devparm')).toBe(0);
  });

  test('is case-insensitive (Chocolate Doom behavior)', () => {
    const cmdline = new CommandLine(['doom.exe', '-SKILL', '4']);
    expect(cmdline.checkParameter('-skill')).toBe(1);
    expect(cmdline.checkParameter('-Skill')).toBe(1);
    expect(cmdline.checkParameter('-SKILL')).toBe(1);
  });

  test('skips program name at index 0', () => {
    const cmdline = new CommandLine(['-devparm', 'other']);
    expect(cmdline.checkParameter('-devparm')).toBe(0);
  });

  test('returns first match when duplicates exist', () => {
    const cmdline = new CommandLine(['doom.exe', '-file', 'a.wad', '-file', 'b.wad']);
    expect(cmdline.checkParameter('-file')).toBe(1);
  });

  test('returns 0 for empty argument list', () => {
    const cmdline = new CommandLine([]);
    expect(cmdline.checkParameter('-anything')).toBe(0);
  });

  test('matches exact strings only (no substring matching)', () => {
    const cmdline = new CommandLine(['doom.exe', '-skills', '4']);
    expect(cmdline.checkParameter('-skill')).toBe(0);
  });
});

describe('checkParameterWithArgs', () => {
  test('returns index when enough trailing args exist', () => {
    const cmdline = new CommandLine(['doom.exe', '-skill', '4', '-devparm']);
    expect(cmdline.checkParameterWithArgs('-skill', 1)).toBe(1);
  });

  test('returns 0 when parameter is last argument', () => {
    const cmdline = new CommandLine(['doom.exe', '-skill']);
    expect(cmdline.checkParameterWithArgs('-skill', 1)).toBe(0);
  });

  test('returns 0 when parameter is not found', () => {
    const cmdline = new CommandLine(['doom.exe', '-other', 'value']);
    expect(cmdline.checkParameterWithArgs('-skill', 1)).toBe(0);
  });

  test('returns 0 when not enough trailing args exist', () => {
    const cmdline = new CommandLine(['doom.exe', '-warp', '1']);
    expect(cmdline.checkParameterWithArgs('-warp', 2)).toBe(0);
  });

  test('is case-insensitive', () => {
    const cmdline = new CommandLine(['doom.exe', '-SKILL', '4']);
    expect(cmdline.checkParameterWithArgs('-skill', 1)).toBe(1);
  });
});

describe('parameterExists', () => {
  test('returns true when parameter is present', () => {
    const cmdline = new CommandLine(['doom.exe', '-devparm']);
    expect(cmdline.parameterExists('-devparm')).toBe(true);
  });

  test('returns false when parameter is absent', () => {
    const cmdline = new CommandLine(['doom.exe']);
    expect(cmdline.parameterExists('-devparm')).toBe(false);
  });

  test('is case-insensitive', () => {
    const cmdline = new CommandLine(['doom.exe', '-DEVPARM']);
    expect(cmdline.parameterExists('-devparm')).toBe(true);
  });
});

describe('getParameter', () => {
  test('returns the argument following the named flag', () => {
    const cmdline = new CommandLine(['doom.exe', '-skill', '4', '-devparm']);
    expect(cmdline.getParameter('-skill')).toBe('4');
  });

  test('returns null when parameter is not found', () => {
    const cmdline = new CommandLine(['doom.exe', '-devparm']);
    expect(cmdline.getParameter('-skill')).toBeNull();
  });

  test('returns null when parameter is the last argument', () => {
    const cmdline = new CommandLine(['doom.exe', '-skill']);
    expect(cmdline.getParameter('-skill')).toBeNull();
  });

  test('is case-insensitive', () => {
    const cmdline = new CommandLine(['doom.exe', '-IWAD', 'doom1.wad']);
    expect(cmdline.getParameter('-iwad')).toBe('doom1.wad');
  });

  test('returns the next flag as a value when no non-flag follows', () => {
    const cmdline = new CommandLine(['doom.exe', '-skill', '-devparm']);
    expect(cmdline.getParameter('-skill')).toBe('-devparm');
  });
});

describe('getParameterValues', () => {
  test('collects trailing non-flag arguments', () => {
    const cmdline = new CommandLine(['doom.exe', '-file', 'a.wad', 'b.wad', '-devparm']);
    const values = cmdline.getParameterValues('-file');
    expect(values).toEqual(['a.wad', 'b.wad']);
  });

  test('returns frozen array', () => {
    const cmdline = new CommandLine(['doom.exe', '-file', 'a.wad']);
    const values = cmdline.getParameterValues('-file');
    expect(Object.isFrozen(values)).toBe(true);
  });

  test('returns empty frozen array when parameter is not found', () => {
    const cmdline = new CommandLine(['doom.exe']);
    const values = cmdline.getParameterValues('-file');
    expect(values).toEqual([]);
    expect(Object.isFrozen(values)).toBe(true);
  });

  test('returns empty when no non-flag values follow', () => {
    const cmdline = new CommandLine(['doom.exe', '-file', '-devparm']);
    const values = cmdline.getParameterValues('-file');
    expect(values).toEqual([]);
  });

  test('stops collecting at next dash-prefixed argument', () => {
    const cmdline = new CommandLine(['doom.exe', '-file', 'a.wad', '-merge', 'b.wad']);
    const values = cmdline.getParameterValues('-file');
    expect(values).toEqual(['a.wad']);
  });

  test('is case-insensitive', () => {
    const cmdline = new CommandLine(['doom.exe', '-FILE', 'a.wad']);
    expect(cmdline.getParameterValues('-file')).toEqual(['a.wad']);
  });
});

describe('parity edge cases', () => {
  test("value '0' is returned as a string, not falsy", () => {
    const cmdline = new CommandLine(['doom.exe', '-episode', '0']);
    expect(cmdline.getParameter('-episode')).toBe('0');
  });

  test('numeric scale flags like -1 -2 -3 are found as parameters', () => {
    const cmdline = new CommandLine(['doom.exe', '-2']);
    expect(cmdline.parameterExists('-2')).toBe(true);
    expect(cmdline.checkParameter('-2')).toBe(1);
  });

  test('program-name string equal to a flag is not found', () => {
    const cmdline = new CommandLine(['-devparm']);
    expect(cmdline.parameterExists('-devparm')).toBe(false);
  });

  test('empty string parameter matches an empty argument when present', () => {
    const cmdline = new CommandLine(['doom.exe', '', 'value']);
    expect(cmdline.checkParameter('')).toBe(1);
  });

  test('typical Doom shareware invocation with no extra flags', () => {
    const cmdline = new CommandLine(['DOOM.EXE']);
    expect(cmdline.count).toBe(1);
    expect(cmdline.parameterExists('-iwad')).toBe(false);
    expect(cmdline.parameterExists('-skill')).toBe(false);
    expect(cmdline.parameterExists('-devparm')).toBe(false);
    expect(cmdline.getParameter('-skill')).toBeNull();
  });

  test('reference run empty command line matches REFERENCE_RUN_MANIFEST baseCommandLine', () => {
    const empty = createEmpty();
    expect(empty.count).toBe(1);
    expect(empty.at(0)).toBe('doom_codex');
    expect(empty.parameterExists('-iwad')).toBe(false);
  });
});

describe('createFromProcessArgv', () => {
  test('returns a CommandLine instance with at least 1 argument', () => {
    const cmdline = createFromProcessArgv();
    expect(cmdline).toBeInstanceOf(CommandLine);
    expect(cmdline.count).toBeGreaterThanOrEqual(1);
  });
});

describe('createEmpty', () => {
  test('returns a CommandLine with program name only', () => {
    const cmdline = createEmpty();
    expect(cmdline).toBeInstanceOf(CommandLine);
    expect(cmdline.count).toBe(1);
    expect(cmdline.at(0)).toBe('doom_codex');
  });
});
