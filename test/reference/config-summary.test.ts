import { describe, expect, it } from 'bun:test';

import summary from '../../reference/manifests/config-variable-summary.json';

describe('config-variable-summary.json manifest', () => {
  const allVariables = summary.configFiles.flatMap((configFile) => configFile.variables);

  it('contains exactly two config files', () => {
    expect(summary.configFiles).toHaveLength(2);
    expect(summary.configFiles[0]!.fileName).toBe('default.cfg');
    expect(summary.configFiles[1]!.fileName).toBe('chocolate-doom.cfg');
  });

  it('records 43 variables in default.cfg', () => {
    const defaultCfg = summary.configFiles[0]!;
    expect(defaultCfg.variables).toHaveLength(43);
    expect(defaultCfg.variableCount).toBe(43);
    expect(summary.summary.defaultCfgCount).toBe(43);
  });

  it('records 113 variables in chocolate-doom.cfg', () => {
    const chocolateCfg = summary.configFiles[1]!;
    expect(chocolateCfg.variables).toHaveLength(113);
    expect(chocolateCfg.variableCount).toBe(113);
    expect(summary.summary.chocolateDoomCfgCount).toBe(113);
  });

  it('records 156 total variables with zero overlap', () => {
    expect(summary.summary.totalCount).toBe(156);
    expect(summary.summary.overlapCount).toBe(0);
    expect(allVariables).toHaveLength(156);
  });

  it('has no duplicate variable names across both config files', () => {
    const names = allVariables.map((variable) => variable.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it('sorts variables ASCIIbetically within each config file', () => {
    for (const configFile of summary.configFiles) {
      const names = configFile.variables.map((variable) => variable.name);
      const sorted = [...names].sort();
      expect(names).toEqual(sorted);
    }
  });

  it('assigns valid type to every variable', () => {
    const validTypes = new Set(['integer', 'string', 'float']);
    for (const variable of allVariables) {
      expect(validTypes.has(variable.type)).toBe(true);
    }
  });

  it('type counts match summary', () => {
    const typeCounts = { integer: 0, string: 0, float: 0 };
    for (const variable of allVariables) {
      typeCounts[variable.type as keyof typeof typeCounts]++;
    }
    expect(typeCounts.integer).toBe(summary.summary.valueTypes.integer);
    expect(typeCounts.string).toBe(summary.summary.valueTypes.string);
    expect(typeCounts.float).toBe(summary.summary.valueTypes.float);
  });

  it('assigns valid category to every variable', () => {
    const validCategories = new Set(summary.summary.categories.map((category) => category.name));
    for (const variable of allVariables) {
      expect(validCategories.has(variable.category)).toBe(true);
    }
  });

  it('category counts match summary', () => {
    const categoryCounts = new Map<string, number>();
    for (const variable of allVariables) {
      categoryCounts.set(variable.category, (categoryCounts.get(variable.category) ?? 0) + 1);
    }
    for (const category of summary.summary.categories) {
      expect(categoryCounts.get(category.name)).toBe(category.count);
    }
  });

  it('sorts categories ASCIIbetically in summary', () => {
    const names = summary.summary.categories.map((category) => category.name);
    const sorted = [...names].sort();
    expect(names).toEqual(sorted);
  });

  it('records 10 chatmacro string variables in default.cfg', () => {
    const chatVariables = summary.configFiles[0]!.variables.filter((variable) => variable.category === 'chat');
    expect(chatVariables).toHaveLength(10);
    for (const variable of chatVariables) {
      expect(variable.type).toBe('string');
      expect(variable.name).toMatch(/^chatmacro\d$/);
    }
  });

  it('records key bindings as DOS scan codes (integers)', () => {
    const keyVariables = allVariables.filter((variable) => variable.name.startsWith('key_'));
    for (const variable of keyVariables) {
      expect(variable.type).toBe('integer');
      expect(variable.category).toBe('input-keyboard');
    }
    expect(summary.format.keyBindingUnit).toBe('DOS scan code');
  });

  it('records exactly two float variables', () => {
    const floatVariables = allVariables.filter((variable) => variable.type === 'float');
    expect(floatVariables).toHaveLength(2);
    const floatNames = floatVariables.map((variable) => variable.name).sort();
    expect(floatNames).toEqual(['libsamplerate_scale', 'mouse_acceleration']);
  });

  it('records all three vanilla compatibility variables as enabled', () => {
    const vanillaVariables = allVariables.filter((variable) => variable.category === 'vanilla-compat');
    expect(vanillaVariables).toHaveLength(3);
    for (const variable of vanillaVariables) {
      expect(variable.value).toBe(1);
      expect(variable.name).toMatch(/^vanilla_/);
    }
  });

  it('uses -1 as unbound sentinel for extended mouse and joystick buttons', () => {
    expect(summary.format.unboundSentinel).toBe(-1);
    const chocolateCfg = summary.configFiles[1]!;
    const unboundMouseButtons = chocolateCfg.variables.filter((variable) => variable.name.startsWith('mouseb_') && variable.value === -1);
    expect(unboundMouseButtons.length).toBeGreaterThan(0);
    const unboundJoyButtons = chocolateCfg.variables.filter((variable) => variable.name.startsWith('joyb_') && variable.value === -1);
    expect(unboundJoyButtons.length).toBeGreaterThan(0);
  });

  it('records opl_io_port as integer 904 (hex 0x388)', () => {
    const oplPort = allVariables.find((variable) => variable.name === 'opl_io_port');
    expect(oplPort).toBeDefined();
    expect(oplPort!.value).toBe(0x388);
    expect(oplPort!.type).toBe('integer');
  });

  it('records arrow keys with expected scan codes in default.cfg', () => {
    const defaultCfg = summary.configFiles[0]!;
    const findKey = (name: string) => defaultCfg.variables.find((variable) => variable.name === name);
    expect(findKey('key_up')!.value).toBe(72);
    expect(findKey('key_down')!.value).toBe(80);
    expect(findKey('key_left')!.value).toBe(75);
    expect(findKey('key_right')!.value).toBe(77);
  });

  it('records snd_samplerate as 44100 Hz', () => {
    const sampleRate = allVariables.find((variable) => variable.name === 'snd_samplerate');
    expect(sampleRate).toBeDefined();
    expect(sampleRate!.value).toBe(44_100);
  });

  it('records category sum equal to total count', () => {
    const categorySum = summary.summary.categories.reduce((sum, category) => sum + category.count, 0);
    expect(categorySum).toBe(summary.summary.totalCount);
  });

  it('records input-keyboard as the largest category', () => {
    const sorted = [...summary.summary.categories].sort((first, second) => second.count - first.count);
    expect(sorted[0]!.name).toBe('input-keyboard');
  });
});
