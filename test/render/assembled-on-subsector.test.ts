import { describe, expect, test } from 'bun:test';

import { ANG90 } from '../../src/core/angle.ts';
import { FRACUNIT } from '../../src/core/fixed.ts';

import type { MapLinedef, MapSector, MapSidedef, MapVertex } from '../../src/map/lineSectorGeometry.ts';
import { ST_HORIZONTAL } from '../../src/map/lineSectorGeometry.ts';
import type { MapSeg, MapSubsector } from '../../src/map/bspStructs.ts';
import type { AssembledOnSubsectorConfig } from '../../src/render/assembledOnSubsector.ts';
import { makeAssembledOnSubsector } from '../../src/render/assembledOnSubsector.ts';
import { DetailMode, NUMCOLORMAPS, computeViewport } from '../../src/render/projection.ts';
import { buildProjectionAngleTables } from '../../src/render/renderInitTables.ts';
import type { SetupFramePlayer } from '../../src/render/setupFrame.ts';
import { setupFrame } from '../../src/render/setupFrame.ts';
import { clearClipSegs } from '../../src/render/solidSegs.ts';
import { createVisplanePool } from '../../src/render/visplanes.ts';

const viewport = computeViewport(11, DetailMode.high);
const projectionAngles = buildProjectionAngleTables(viewport);
const colormaps: readonly Uint8Array[] = Array.from({ length: NUMCOLORMAPS }, () => new Uint8Array(256));

// Minimal valid map: one subsector with 0 segs (renderSubsector just
// selects planes), but a first seg/linedef/sidedef so P_GroupLines can
// resolve sub->sector.
const vertexes: readonly MapVertex[] = [
  { x: 0, y: 0 },
  { x: 64 * FRACUNIT, y: 0 },
];
const sectors: readonly MapSector[] = [{ floorheight: 0, ceilingheight: 128 * FRACUNIT, floorpic: 'FLOOR', ceilingpic: 'CEIL', lightlevel: 160, special: 0, tag: 0 }];
const sidedefs: readonly MapSidedef[] = [{ textureoffset: 0, rowoffset: 0, toptexture: '-', bottomtexture: '-', midtexture: '-', sector: 0 }];
const linedefs: readonly MapLinedef[] = [{ v1: 0, v2: 1, dx: 0, dy: 0, flags: 0, special: 0, tag: 0, sidenum0: 0, sidenum1: -1, slopetype: ST_HORIZONTAL, bbox: [0, 0, 0, 0] }];
const segs: readonly MapSeg[] = [{ v1: 0, v2: 1, angle: 0, linedef: 0, side: 0, offset: 0 }];
const subsectors: readonly MapSubsector[] = [{ firstseg: 0, numsegs: 0 }];

const flatNumber = (name: string): number => (name === 'F_SKY1' ? 99 : name === 'CEIL' ? 1 : 2);
const textureNumber = (name: string): number => (name === '-' ? 0 : 5);

function config(): AssembledOnSubsectorConfig {
  return {
    map: { subsectors, segs, linedefs, sidedefs, sectors, vertexes },
    flatNumber,
    textureNumber,
    segScene: { vertexes, segs, linedefs, sidedefs, sectors },
    orderedDefinitions: [],
    pnames: [],
    patchByName: () => null,
    colormaps,
    viewport,
    projectionAngles,
    skyflatnum: 99,
    pool: createVisplanePool(),
    drawContext: { framebuffer: new Uint8Array(64), viewHeight: 168, centerY: 84, ceilingClip: new Int16Array(8), floorClip: new Int16Array(8) },
  };
}

function player(fixedColormap = 0): SetupFramePlayer {
  return { mobjX: 0, mobjY: 0, mobjAngle: ANG90, viewz: 41 * FRACUNIT, extralight: 0, fixedColormap };
}

describe('assembledOnSubsector: makeAssembledOnSubsector — full wall-render wiring', () => {
  test('composes a (frame, clipState) → SubsectorVisitor factory', () => {
    const makeOnSubsector = makeAssembledOnSubsector(config());
    expect(typeof makeOnSubsector).toBe('function');
    const visitor = makeOnSubsector(setupFrame(player()), clearClipSegs(viewport.viewWidth));
    expect(typeof visitor).toBe('function');
  });

  test('the produced visitor drives renderSubsector with the frame view + clip state (plane selected)', () => {
    const cfg = config();
    const visitor = makeAssembledOnSubsector(cfg)(setupFrame(player()), clearClipSegs(viewport.viewWidth));
    expect(cfg.pool.count).toBe(0);
    visitor(0);
    // viewz 41 is between floor 0 and ceiling 128 → both planes selected
    // into the caller pool (proves renderSubsector ran with the frame view).
    expect(cfg.pool.count).toBeGreaterThan(0);
  });

  test('a valid fixedcolormap frame still produces a working visitor (scalelightfixed path)', () => {
    const cfg = config();
    // fixedColormap 1 → frame.fixedColormapIndex 1 (light-amp goggles).
    const visitor = makeAssembledOnSubsector(cfg)(setupFrame(player(1)), clearClipSegs(viewport.viewWidth));
    expect(() => visitor(0)).not.toThrow();
    expect(cfg.pool.count).toBeGreaterThan(0);
  });

  test('an out-of-range fixedcolormap index is a hard error (no fabricated ramp)', () => {
    const makeOnSubsector = makeAssembledOnSubsector(config());
    expect(() => makeOnSubsector(setupFrame(player(9999)), clearClipSegs(viewport.viewWidth))).toThrow(RangeError);
  });

  test('is deterministic — two factories from the same config select the same planes', () => {
    const a = config();
    const b = config();
    makeAssembledOnSubsector(a)(setupFrame(player()), clearClipSegs(viewport.viewWidth))(0);
    makeAssembledOnSubsector(b)(setupFrame(player()), clearClipSegs(viewport.viewWidth))(0);
    expect(a.pool.count).toBe(b.pool.count);
  });
});
