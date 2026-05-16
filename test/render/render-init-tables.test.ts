import { describe, expect, test } from 'bun:test';

import { FRACBITS, FRACUNIT, fixedDiv, fixedMul } from '../../src/core/fixed.ts';
import { ANGLETOFINESHIFT, FINEANGLES, finecosine, finetangent } from '../../src/core/trig.ts';
import { DetailMode, FIELDOFVIEW, LIGHTLEVELS, LIGHTSCALESHIFT, LIGHTZSHIFT, MAXLIGHTSCALE, MAXLIGHTZ, NUMCOLORMAPS, SCREENWIDTH, computeViewport } from '../../src/render/projection.ts';
import { buildDiminishingLightLevelTables, buildPlaneProjectionTables, buildProjectionAngleTables, materializeColormapRows } from '../../src/render/renderInitTables.ts';

const ANG90 = 0x4000_0000;
const DISTMAP = 2;

describe('renderInitTables: R_InitTextureMapping (viewangletox / xtoviewangle / clipangle)', () => {
  test('full-screen viewport tables have vanilla shape and clipangle invariant', () => {
    const viewport = computeViewport(11, DetailMode.high);
    const tables = buildProjectionAngleTables(viewport);

    expect(tables.viewangletox.length).toBe(FINEANGLES / 2);
    expect(tables.xtoviewangle.length).toBe(viewport.viewWidth + 1);
    expect(tables.clipangle).toBe(tables.xtoviewangle[0]!);
  });

  test('viewangletox is non-increasing and compensated endpoints stay within [0, viewwidth]', () => {
    const viewport = computeViewport(9, DetailMode.high);
    const tables = buildProjectionAngleTables(viewport);

    for (let i = 1; i < tables.viewangletox.length; i += 1) {
      expect(tables.viewangletox[i]!).toBeLessThanOrEqual(tables.viewangletox[i - 1]!);
    }
    for (const column of tables.viewangletox) {
      expect(column).toBeGreaterThanOrEqual(0);
      expect(column).toBeLessThanOrEqual(viewport.viewWidth);
    }
  });

  test('independent vanilla re-derivation of a mid-range viewangletox entry matches', () => {
    const viewport = computeViewport(11, DetailMode.high);
    const tables = buildProjectionAngleTables(viewport);

    const focallength = fixedDiv(viewport.centerXFrac, finetangent[FINEANGLES / 4 + FIELDOFVIEW / 2]!);
    // Pick a fineangle whose tangent is in-range so the compensation
    // sentinels do not apply, and re-derive the column the vanilla way.
    const sampleFineAngle = FINEANGLES / 4;
    const tangent = finetangent[sampleFineAngle]!;
    expect(tangent).toBeLessThanOrEqual(FRACUNIT * 2);
    expect(tangent).toBeGreaterThanOrEqual(-FRACUNIT * 2);
    const expectedColumn = ((viewport.centerXFrac - fixedMul(tangent, focallength) + FRACUNIT - 1) | 0) >> FRACBITS;
    const clamped = expectedColumn < 0 ? 0 : expectedColumn > viewport.viewWidth ? viewport.viewWidth : expectedColumn;
    expect(tables.viewangletox[sampleFineAngle]!).toBe(clamped);
  });

  test('full independent vanilla re-derivation of viewangletox and xtoviewangle matches, and the build is deterministic', () => {
    const viewport = computeViewport(11, DetailMode.high);
    const first = buildProjectionAngleTables(viewport);
    const second = buildProjectionAngleTables(viewport);

    expect([...second.xtoviewangle]).toEqual([...first.xtoviewangle]);
    expect([...second.viewangletox]).toEqual([...first.viewangletox]);

    // Independent transcription of r_main.c R_InitTextureMapping
    // (sentinels → scan → compensate), structurally distinct from the
    // module, asserted entry-for-entry.
    const viewwidth = viewport.viewWidth;
    const focallength = fixedDiv(viewport.centerXFrac, finetangent[FINEANGLES / 4 + FIELDOFVIEW / 2]!);
    const expectedViewangletox = new Int32Array(FINEANGLES / 2);
    for (let i = 0; i < FINEANGLES / 2; i += 1) {
      const tangent = finetangent[i]!;
      if (tangent > FRACUNIT * 2) {
        expectedViewangletox[i] = -1;
      } else if (tangent < -FRACUNIT * 2) {
        expectedViewangletox[i] = viewwidth + 1;
      } else {
        let column = ((viewport.centerXFrac - fixedMul(tangent, focallength) + FRACUNIT - 1) | 0) >> FRACBITS;
        column = column < -1 ? -1 : column > viewwidth + 1 ? viewwidth + 1 : column;
        expectedViewangletox[i] = column;
      }
    }
    const expectedXtoviewangle = new Uint32Array(viewwidth + 1);
    for (let x = 0; x <= viewwidth; x += 1) {
      let i = 0;
      while (expectedViewangletox[i]! > x) {
        i += 1;
      }
      expectedXtoviewangle[x] = ((i << ANGLETOFINESHIFT) - ANG90) >>> 0;
    }
    for (let i = 0; i < FINEANGLES / 2; i += 1) {
      if (expectedViewangletox[i] === -1) {
        expectedViewangletox[i] = 0;
      } else if (expectedViewangletox[i] === viewwidth + 1) {
        expectedViewangletox[i] = viewwidth;
      }
    }

    expect([...first.viewangletox]).toEqual([...expectedViewangletox]);
    expect([...first.xtoviewangle]).toEqual([...expectedXtoviewangle]);
    expect(first.clipangle).toBe(expectedXtoviewangle[0]!);
  });
});

describe('renderInitTables: R_InitLightTables / R_ExecuteSetViewSize (scalelight / zlight)', () => {
  test('tables have vanilla shape and every entry is a valid colormap ramp index', () => {
    const viewport = computeViewport(11, DetailMode.high);
    const tables = buildDiminishingLightLevelTables(viewport);

    expect(tables.scalelightLevels.length).toBe(LIGHTLEVELS * MAXLIGHTSCALE);
    expect(tables.zlightLevels.length).toBe(LIGHTLEVELS * MAXLIGHTZ);
    for (const level of tables.scalelightLevels) {
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(NUMCOLORMAPS - 1);
    }
    for (const level of tables.zlightLevels) {
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(NUMCOLORMAPS - 1);
    }
  });

  test('scalelight brightens with scale (non-increasing in j) and zlight dims with distance (non-decreasing in j)', () => {
    const viewport = computeViewport(11, DetailMode.high);
    const tables = buildDiminishingLightLevelTables(viewport);

    for (let lightLevel = 0; lightLevel < LIGHTLEVELS; lightLevel += 1) {
      for (let j = 1; j < MAXLIGHTSCALE; j += 1) {
        // scalelight is indexed by rw_scale: larger scale = nearer wall =
        // brighter = lower ramp index, so the row is non-increasing in j.
        expect(tables.scalelightLevels[lightLevel * MAXLIGHTSCALE + j]!).toBeLessThanOrEqual(tables.scalelightLevels[lightLevel * MAXLIGHTSCALE + j - 1]!);
      }
      for (let j = 1; j < MAXLIGHTZ; j += 1) {
        // zlight is indexed by distance: farther = darker = higher ramp
        // index, so the row is non-decreasing in j.
        expect(tables.zlightLevels[lightLevel * MAXLIGHTZ + j]!).toBeGreaterThanOrEqual(tables.zlightLevels[lightLevel * MAXLIGHTZ + j - 1]!);
      }
    }
  });

  test('full independent vanilla re-derivation of scalelight and zlight matches every entry', () => {
    const viewport = computeViewport(9, DetailMode.high);
    const tables = buildDiminishingLightLevelTables(viewport);
    const scaledViewWidth = viewport.viewWidth << viewport.detailShift;

    for (let i = 0; i < LIGHTLEVELS; i += 1) {
      const startmap = (((LIGHTLEVELS - 1 - i) * 2 * NUMCOLORMAPS) / LIGHTLEVELS) | 0;
      for (let j = 0; j < MAXLIGHTSCALE; j += 1) {
        const raw = startmap - (((((j * SCREENWIDTH) / scaledViewWidth) | 0) / DISTMAP) | 0);
        const expected = raw < 0 ? 0 : raw >= NUMCOLORMAPS ? NUMCOLORMAPS - 1 : raw;
        expect(tables.scalelightLevels[i * MAXLIGHTSCALE + j]!).toBe(expected);
      }
      for (let j = 0; j < MAXLIGHTZ; j += 1) {
        let scale = fixedDiv(((SCREENWIDTH / 2) * FRACUNIT) | 0, ((j + 1) << LIGHTZSHIFT) | 0);
        scale >>= LIGHTSCALESHIFT;
        const raw = startmap - ((scale / DISTMAP) | 0);
        const expected = raw < 0 ? 0 : raw >= NUMCOLORMAPS ? NUMCOLORMAPS - 1 : raw;
        expect(tables.zlightLevels[i * MAXLIGHTZ + j]!).toBe(expected);
      }
    }
  });

  test('independent vanilla re-derivation of zlight startmap and j=0 entry matches', () => {
    const viewport = computeViewport(11, DetailMode.high);
    const tables = buildDiminishingLightLevelTables(viewport);

    // Brightest bucket (i = LIGHTLEVELS-1) has startmap 0 → entire row is ramp 0.
    for (let j = 0; j < MAXLIGHTZ; j += 1) {
      expect(tables.zlightLevels[(LIGHTLEVELS - 1) * MAXLIGHTZ + j]!).toBe(0);
    }
    // Darkest bucket (i = 0): startmap = ((15)*2*32/16) = 60, j=0 entry.
    const startmap = (((LIGHTLEVELS - 1 - 0) * 2 * NUMCOLORMAPS) / LIGHTLEVELS) | 0;
    expect(startmap).toBe(60);
    let scale = fixedDiv(((SCREENWIDTH / 2) * FRACUNIT) | 0, (1 << LIGHTZSHIFT) | 0);
    scale >>= LIGHTSCALESHIFT;
    const level = startmap - ((scale / DISTMAP) | 0);
    const expected = level < 0 ? 0 : level >= NUMCOLORMAPS ? NUMCOLORMAPS - 1 : level;
    expect(tables.zlightLevels[0]!).toBe(expected);
  });
});

describe('renderInitTables: plane projection (yslope / distscale)', () => {
  test('yslope has vanilla shape, is strictly positive, and is symmetric about the center', () => {
    const viewport = computeViewport(11, DetailMode.high);
    const angles = buildProjectionAngleTables(viewport);
    const planes = buildPlaneProjectionTables(viewport, angles.xtoviewangle);

    expect(planes.yslope.length).toBe(viewport.viewHeight);
    for (const slope of planes.yslope) {
      expect(slope).toBeGreaterThan(0);
    }
    for (let i = 0; i < viewport.viewHeight; i += 1) {
      expect(planes.yslope[i]!).toBe(planes.yslope[viewport.viewHeight - 1 - i]!);
    }
  });

  test('distscale has vanilla shape and is at least FRACUNIT (1/|cos| >= 1)', () => {
    const viewport = computeViewport(11, DetailMode.high);
    const angles = buildProjectionAngleTables(viewport);
    const planes = buildPlaneProjectionTables(viewport, angles.xtoviewangle);

    expect(planes.distscale.length).toBe(viewport.viewWidth);
    for (const scale of planes.distscale) {
      expect(scale).toBeGreaterThanOrEqual(FRACUNIT);
    }
  });

  test('full independent vanilla re-derivation of yslope and distscale matches every entry', () => {
    const viewport = computeViewport(9, DetailMode.high);
    const angles = buildProjectionAngleTables(viewport);
    const planes = buildPlaneProjectionTables(viewport, angles.xtoviewangle);

    const scaledHalfWidthFrac = ((((viewport.viewWidth << viewport.detailShift) / 2) | 0) * FRACUNIT) | 0;
    for (let i = 0; i < viewport.viewHeight; i += 1) {
      const dyRaw = (((i - viewport.viewHeight / 2) << FRACBITS) | 0) + FRACUNIT / 2;
      const dy = (dyRaw < 0 ? -dyRaw : dyRaw) | 0;
      expect(planes.yslope[i]!).toBe(fixedDiv(scaledHalfWidthFrac, dy));
    }

    for (let i = 0; i < viewport.viewWidth; i += 1) {
      const fineAngle = angles.xtoviewangle[i]! >>> ANGLETOFINESHIFT;
      const cosValue = finecosine[fineAngle]!;
      const cosadj = (cosValue < 0 ? -cosValue : cosValue) | 0;
      expect(planes.distscale[i]!).toBe(fixedDiv(FRACUNIT, cosadj));
    }
  });
});

describe('renderInitTables: materializeColormapRows', () => {
  test('binds each integer level to colormaps[level] in row-major order', () => {
    const colormaps: Uint8Array[] = [];
    for (let ramp = 0; ramp < NUMCOLORMAPS; ramp += 1) {
      colormaps.push(new Uint8Array([ramp]));
    }
    const viewport = computeViewport(11, DetailMode.high);
    const tables = buildDiminishingLightLevelTables(viewport);
    const rows = materializeColormapRows(tables.scalelightLevels, LIGHTLEVELS, MAXLIGHTSCALE, colormaps);

    expect(rows.length).toBe(LIGHTLEVELS);
    for (let lightLevel = 0; lightLevel < LIGHTLEVELS; lightLevel += 1) {
      expect(rows[lightLevel]!.length).toBe(MAXLIGHTSCALE);
      for (let j = 0; j < MAXLIGHTSCALE; j += 1) {
        expect(rows[lightLevel]![j]!).toBe(colormaps[tables.scalelightLevels[lightLevel * MAXLIGHTSCALE + j]!]!);
      }
    }
  });

  test('rejects a level table whose length disagrees with rowCount*rowLength', () => {
    const colormaps: Uint8Array[] = [];
    for (let ramp = 0; ramp < NUMCOLORMAPS; ramp += 1) {
      colormaps.push(new Uint8Array([ramp]));
    }
    expect(() => materializeColormapRows(new Int32Array(3), 2, 2, colormaps)).toThrow('levelTable.length 3 !== rowCount*rowLength 4');
  });

  test('rejects a colormap set smaller than NUMCOLORMAPS', () => {
    expect(() => materializeColormapRows(new Int32Array(4), 2, 2, [new Uint8Array([0])])).toThrow(`colormaps.length 1 < NUMCOLORMAPS ${NUMCOLORMAPS}`);
  });
});
