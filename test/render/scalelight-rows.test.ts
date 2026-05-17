import { describe, expect, test } from 'bun:test';

import { DetailMode, LIGHTLEVELS, MAXLIGHTSCALE, NUMCOLORMAPS, computeViewport } from '../../src/render/projection.ts';
import { buildDiminishingLightLevelTables } from '../../src/render/renderInitTables.ts';
import { buildScalelightRows } from '../../src/render/scalelightRows.ts';

const viewport = computeViewport(11, DetailMode.high);

// Distinct ramps so reference identity pins which COLORMAP level each
// scalelight cell binds to (the byte 1 marks ramp index).
function makeColormaps(count: number): readonly Uint8Array[] {
  return Array.from({ length: count }, (_unused, i) => {
    const ramp = new Uint8Array(256);
    ramp[0] = i;
    return ramp;
  });
}

describe('scalelightRows: buildScalelightRows — R_ExecuteSetViewSize scalelight bound to COLORMAP', () => {
  test('produces LIGHTLEVELS rows × MAXLIGHTSCALE colormap rows, every cell a supplied ramp', () => {
    const colormaps = makeColormaps(NUMCOLORMAPS);
    const rows = buildScalelightRows(viewport, colormaps);

    expect(rows.length).toBe(LIGHTLEVELS);
    const colormapSet = new Set(colormaps);
    for (const row of rows) {
      expect(row.length).toBe(MAXLIGHTSCALE);
      for (const cell of row) {
        expect(colormapSet.has(cell)).toBe(true);
      }
    }
  });

  test('binds exactly scalelightLevels → colormaps[index] (structurally distinct re-derivation)', () => {
    const colormaps = makeColormaps(NUMCOLORMAPS);
    const rows = buildScalelightRows(viewport, colormaps);

    // Independent: re-derive the index table and map it by hand.
    const { scalelightLevels } = buildDiminishingLightLevelTables(viewport);
    for (let level = 0; level < LIGHTLEVELS; level += 1) {
      for (let scale = 0; scale < MAXLIGHTSCALE; scale += 1) {
        const want = colormaps[scalelightLevels[level * MAXLIGHTSCALE + scale]!]!;
        expect(rows[level]![scale]).toBe(want);
      }
    }
  });

  test('is deterministic — a second build yields reference-identical ramps', () => {
    const colormaps = makeColormaps(NUMCOLORMAPS);
    const a = buildScalelightRows(viewport, colormaps);
    const b = buildScalelightRows(viewport, colormaps);
    for (let level = 0; level < LIGHTLEVELS; level += 1) {
      for (let scale = 0; scale < MAXLIGHTSCALE; scale += 1) {
        expect(a[level]![scale]).toBe(b[level]![scale]!);
      }
    }
  });

  test('rejects a COLORMAP with fewer than NUMCOLORMAPS ramps', () => {
    expect(() => buildScalelightRows(viewport, makeColormaps(NUMCOLORMAPS - 1))).toThrow(RangeError);
  });
});
