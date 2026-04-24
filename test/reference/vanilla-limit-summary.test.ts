import { describe, expect, it } from 'bun:test';

import summary from '../../reference/manifests/vanilla-limit-summary.json';

describe('vanilla-limit-summary.json manifest', () => {
  const findLimit = (name: string) => summary.limits.find((limit) => limit.name === name);

  it('contains exactly 16 limits', () => {
    expect(summary.limits).toHaveLength(16);
    expect(summary.totalLimits).toBe(16);
  });

  it('has required fields on every limit entry', () => {
    for (const limit of summary.limits) {
      expect(limit.name).toBeString();
      expect(limit.name.length).toBeGreaterThan(0);
      expect(limit.value).toBeNumber();
      expect(limit.unit).toBeString();
      expect(limit.category).toBeString();
      expect(limit.sourceFile).toBeString();
      expect(limit.description).toBeString();
      expect(limit.description.length).toBeGreaterThan(0);
      expect(limit.overflowBehavior).toBeString();
      expect(limit.overflowBehavior.length).toBeGreaterThan(0);
    }
  });

  it('sorts limits ASCIIbetically by name', () => {
    const names = summary.limits.map((limit) => limit.name);
    const sorted = [...names].sort();
    expect(names).toEqual(sorted);
  });

  it('sorts categories ASCIIbetically in summary', () => {
    const names = summary.categories.map((category) => category.name);
    const sorted = [...names].sort();
    expect(names).toEqual(sorted);
  });

  it('has category counts matching actual distribution', () => {
    const categoryCounts = new Map<string, number>();
    for (const limit of summary.limits) {
      categoryCounts.set(limit.category, (categoryCounts.get(limit.category) ?? 0) + 1);
    }
    for (const category of summary.categories) {
      expect(categoryCounts.get(category.name)).toBe(category.count);
    }
  });

  it('has category sum equal to total limits', () => {
    const categorySum = summary.categories.reduce((sum, category) => sum + category.count, 0);
    expect(categorySum).toBe(summary.totalLimits);
  });

  it('has all positive integer values', () => {
    for (const limit of summary.limits) {
      expect(limit.value).toBeGreaterThan(0);
      expect(Number.isInteger(limit.value)).toBe(true);
    }
  });

  it('has no duplicate limit names', () => {
    const names = summary.limits.map((limit) => limit.name);
    const uniqueNames = new Set(names);
    expect(uniqueNames.size).toBe(names.length);
  });

  it('records MAXVISPLANES as 128', () => {
    const limit = findLimit('MAXVISPLANES');
    expect(limit).toBeDefined();
    expect(limit!.value).toBe(128);
    expect(limit!.category).toBe('renderer');
    expect(limit!.overflowBehavior).toContain('visplanes');
  });

  it('derives MAXOPENINGS from SCREENWIDTH * 64', () => {
    const openings = findLimit('MAXOPENINGS');
    const screenWidth = findLimit('SCREENWIDTH');
    expect(openings).toBeDefined();
    expect(screenWidth).toBeDefined();
    expect(openings!.value).toBe(screenWidth!.value * 64);
    expect(openings!.value).toBe(20_480);
  });

  it('records SAVEGAMESIZE as 0x2C000 (180224 bytes)', () => {
    const limit = findLimit('SAVEGAMESIZE');
    expect(limit).toBeDefined();
    expect(limit!.value).toBe(0x2c000);
    expect(limit!.value).toBe(180_224);
    expect(limit!.hexValue).toBe('0x2C000');
  });

  it('records MAXDEMOSIZE as 0x20000 (131072 bytes)', () => {
    const limit = findLimit('MAXDEMOSIZE');
    expect(limit).toBeDefined();
    expect(limit!.value).toBe(0x20000);
    expect(limit!.value).toBe(131_072);
    expect(limit!.hexValue).toBe('0x20000');
  });

  it('records MAXSPECIALCROSS as 8 (spechit overflow edge case)', () => {
    const limit = findLimit('MAXSPECIALCROSS');
    expect(limit).toBeDefined();
    expect(limit!.value).toBe(8);
    expect(limit!.category).toBe('specials');
    expect(limit!.overflowBehavior).toContain('spechit');
  });

  it('derives framebuffer pixel count from SCREENWIDTH * SCREENHEIGHT', () => {
    const width = findLimit('SCREENWIDTH');
    const height = findLimit('SCREENHEIGHT');
    expect(width).toBeDefined();
    expect(height).toBeDefined();
    expect(width!.value * height!.value).toBe(64_000);
  });

  it('records MAXPLATS and MAXCEILINGS with equal values', () => {
    const plats = findLimit('MAXPLATS');
    const ceilings = findLimit('MAXCEILINGS');
    expect(plats).toBeDefined();
    expect(ceilings).toBeDefined();
    expect(plats!.value).toBe(ceilings!.value);
    expect(plats!.value).toBe(30);
  });

  it('has 4 renderer limits', () => {
    const rendererLimits = summary.limits.filter((limit) => limit.category === 'renderer');
    expect(rendererLimits).toHaveLength(4);
    const rendererCategory = summary.categories.find((category) => category.name === 'renderer');
    expect(rendererCategory!.count).toBe(4);
  });

  it('parses all hexValue fields to matching numeric values', () => {
    for (const limit of summary.limits) {
      if ('hexValue' in limit && limit.hexValue) {
        const parsed = Number(limit.hexValue);
        expect(parsed).toBe(limit.value);
      }
    }
  });

  it('records all three vanilla compatibility flags as true', () => {
    expect(summary.vanillaCompatFlags.vanilla_demo_limit).toBe(true);
    expect(summary.vanillaCompatFlags.vanilla_keyboard_mapping).toBe(true);
    expect(summary.vanillaCompatFlags.vanilla_savegame_limit).toBe(true);
  });

  it('records specials as the largest category', () => {
    const sorted = [...summary.categories].sort((first, second) => second.count - first.count);
    expect(sorted[0]!.name).toBe('specials');
  });

  it('records MAXPLAYERS as 4 matching demo format player array', () => {
    const limit = findLimit('MAXPLAYERS');
    expect(limit).toBeDefined();
    expect(limit!.value).toBe(4);
    expect(limit!.category).toBe('game');
    expect(limit!.sourceFile).toBe('doomdef.h');
  });
});
