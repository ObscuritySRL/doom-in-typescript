import { describe, expect, it } from 'bun:test';

import manifest from '../../reference/manifests/quirk-manifest.json';

describe('quirk-manifest.json manifest', () => {
  const findQuirk = (id: string) => manifest.quirks.find((quirk) => quirk.id === id);

  const VALID_CATEGORIES = ['audio', 'music', 'palette', 'renderer'];
  const VALID_PARITY_IMPACTS = ['high', 'low', 'medium'];

  it('contains exactly 22 quirks', () => {
    expect(manifest.quirks).toHaveLength(22);
    expect(manifest.totalQuirks).toBe(22);
  });

  it('has required fields on every quirk entry', () => {
    for (const quirk of manifest.quirks) {
      expect(quirk.id).toBeString();
      expect(quirk.id.length).toBeGreaterThan(0);
      expect(quirk.name).toBeString();
      expect(quirk.name.length).toBeGreaterThan(0);
      expect(quirk.category).toBeString();
      expect(quirk.sourceFile).toBeString();
      expect(quirk.sourceFile.length).toBeGreaterThan(0);
      expect(quirk.description).toBeString();
      expect(quirk.description.length).toBeGreaterThan(0);
      expect(quirk.parityImpact).toBeString();
    }
  });

  it('sorts quirks ASCIIbetically by id', () => {
    const ids = manifest.quirks.map((quirk) => quirk.id);
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
  });

  it('sorts categories ASCIIbetically', () => {
    const names = manifest.categories.map((category) => category.name);
    const sorted = [...names].sort();
    expect(names).toEqual(sorted);
  });

  it('has category counts matching actual distribution', () => {
    const categoryCounts = new Map<string, number>();
    for (const quirk of manifest.quirks) {
      categoryCounts.set(quirk.category, (categoryCounts.get(quirk.category) ?? 0) + 1);
    }
    for (const category of manifest.categories) {
      expect(categoryCounts.get(category.name)).toBe(category.count);
    }
  });

  it('has category sum equal to total quirks', () => {
    const categorySum = manifest.categories.reduce((sum, category) => sum + category.count, 0);
    expect(categorySum).toBe(manifest.totalQuirks);
  });

  it('has no duplicate quirk ids', () => {
    const ids = manifest.quirks.map((quirk) => quirk.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });

  it('uses only valid categories', () => {
    for (const quirk of manifest.quirks) {
      expect(VALID_CATEGORIES).toContain(quirk.category);
    }
  });

  it('uses only valid parity impact levels', () => {
    for (const quirk of manifest.quirks) {
      expect(VALID_PARITY_IMPACTS).toContain(quirk.parityImpact);
    }
  });

  it('records hall-of-mirrors-no-clear as high parity impact', () => {
    const quirk = findQuirk('hall-of-mirrors-no-clear');
    expect(quirk).toBeDefined();
    expect(quirk!.parityImpact).toBe('high');
    expect(quirk!.category).toBe('renderer');
    expect(quirk!.description).toContain('framebuffer');
  });

  it('records dmx-sound-lump-header with 8-byte header size', () => {
    const quirk = findQuirk('dmx-sound-lump-header');
    expect(quirk).toBeDefined();
    expect(quirk!.parityImpact).toBe('high');
    expect(quirk!.constants!.header_size_bytes).toBe(8);
    expect(quirk!.constants!.typical_sample_rate).toBe(11_025);
    expect(quirk!.constants!.format_marker).toBe(3);
  });

  it('records S_CLIPPING_DIST as 1200 in sfx-linear-distance-rolloff', () => {
    const quirk = findQuirk('sfx-linear-distance-rolloff');
    expect(quirk).toBeDefined();
    expect(quirk!.constants!.S_CLIPPING_DIST).toBe(1200);
    expect(quirk!.constants!.S_CLOSE_DIST).toBe(200);
  });

  it('records PLAYPAL count as 14 in damage-pickup-palette-shift', () => {
    const quirk = findQuirk('damage-pickup-palette-shift');
    expect(quirk).toBeDefined();
    expect(quirk!.constants!.playpal_count).toBe(14);
    expect(quirk!.constants!.STARTREDPALS).toBe(1);
    expect(quirk!.constants!.NUMREDPALS).toBe(8);
    expect(quirk!.constants!.STARTBONUSPALS).toBe(9);
    expect(quirk!.constants!.NUMBONUSPALS).toBe(4);
    expect(quirk!.constants!.RADIATIONPAL).toBe(13);
  });

  it('records COLORMAP count as 34 and invulnerability at index 32', () => {
    const quirk = findQuirk('invulnerability-inverse-colormap');
    expect(quirk).toBeDefined();
    expect(quirk!.constants!.colormap_count).toBe(34);
    expect(quirk!.constants!.invulnerability_index).toBe(32);
    expect(quirk!.constants!.all_black_index).toBe(33);
    expect(quirk!.constants!.light_level_maps).toBe(32);
  });

  it('records FUZZTABLE as 50 in fuzz-column-adjacent-row', () => {
    const quirk = findQuirk('fuzz-column-adjacent-row');
    expect(quirk).toBeDefined();
    expect(quirk!.constants!.FUZZTABLE).toBe(50);
    expect(quirk!.constants!.SCREENWIDTH).toBe(320);
  });

  it('records sfx-fixed-channel-count default matching reference config', () => {
    const quirk = findQuirk('sfx-fixed-channel-count');
    expect(quirk).toBeDefined();
    expect(quirk!.constants!.snd_channels_default).toBe(manifest.referenceConfig.snd_channels);
    expect(quirk!.constants!.snd_channels_default).toBe(8);
  });

  it('records renderer as the largest category', () => {
    const sorted = [...manifest.categories].sort((first, second) => second.count - first.count);
    expect(sorted[0]!.name).toBe('renderer');
  });

  it('has at least one high-parity-impact quirk in audio category', () => {
    const highAudio = manifest.quirks.filter((quirk) => quirk.category === 'audio' && quirk.parityImpact === 'high');
    expect(highAudio.length).toBeGreaterThanOrEqual(1);
  });

  it('has at least one high-parity-impact quirk in renderer category', () => {
    const highRenderer = manifest.quirks.filter((quirk) => quirk.category === 'renderer' && quirk.parityImpact === 'high');
    expect(highRenderer.length).toBeGreaterThanOrEqual(1);
  });

  it('cross-references screenblocks default with reference config', () => {
    const quirk = findQuirk('screenblocks-viewport-scaling');
    expect(quirk).toBeDefined();
    expect(quirk!.constants!.screenblocks_default).toBe(manifest.referenceConfig.screenblocks);
    expect(quirk!.constants!.screenblocks_default).toBe(9);
    expect(quirk!.constants!.status_bar_height).toBe(32);
  });

  it('has non-empty description for every quirk', () => {
    for (const quirk of manifest.quirks) {
      expect(quirk.description.length).toBeGreaterThan(20);
    }
  });

  it('records sound-reject-table-propagation as high impact game-state quirk', () => {
    const quirk = findQuirk('sound-reject-table-propagation');
    expect(quirk).toBeDefined();
    expect(quirk!.parityImpact).toBe('high');
    expect(quirk!.category).toBe('audio');
    expect(quirk!.description).toContain('REJECT');
    expect(quirk!.description).toContain('demo parity');
  });
});
