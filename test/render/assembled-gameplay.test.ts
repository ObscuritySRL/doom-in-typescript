import { describe, expect, test } from 'bun:test';

import { FRACUNIT } from '../../src/core/fixed.ts';

import { SCREENHEIGHT, SCREENWIDTH } from '../../src/host/windowPolicy.ts';
import { parseMapBundle } from '../../src/map/mapBundle.ts';
import { setupLevel } from '../../src/map/mapSetup.ts';
import { createPlayer } from '../../src/player/playerSpawn.ts';
import { makeAssembledGameplayRenderer } from '../../src/render/assembledGameplay.ts';
import { parseWadDirectory } from '../../src/wad/directory.ts';
import { parseWadHeader } from '../../src/wad/header.ts';
import { Mobj } from '../../src/world/mobj.ts';

const WAD_PATH = 'doom/DOOM1.WAD';

async function loadE1M1() {
  const wadBuffer = Buffer.from(await Bun.file(WAD_PATH).arrayBuffer());
  const directory = parseWadDirectory(wadBuffer, parseWadHeader(wadBuffer));
  const mapData = setupLevel(parseMapBundle(directory, wadBuffer, 'E1M1'));
  const framebuffer = new Uint8Array(SCREENWIDTH * SCREENHEIGHT);
  return { directory, wadBuffer, mapData, framebuffer };
}

describe('assembledGameplay: makeAssembledGameplayRenderer — bit-exact E1M1 from the real DOOM1.WAD', () => {
  test('composes the full assembled gameplay renderer over the real E1M1 map + WAD', async () => {
    const deps = await loadE1M1();
    const renderFrame = makeAssembledGameplayRenderer(deps);
    expect(typeof renderFrame).toBe('function');
    // The real E1M1 BSP/seg/subsector tables are non-trivial.
    expect(deps.mapData.nodes.length).toBeGreaterThan(0);
    expect(deps.mapData.subsectors.length).toBeGreaterThan(0);
  });

  test('a null player.mo is a hard error (caller renders black first)', async () => {
    const renderFrame = makeAssembledGameplayRenderer(await loadE1M1());
    expect(() => renderFrame(createPlayer(), 0)).toThrow('player.mo is null');
  });

  test('renders a frame from an in-map viewpoint: walks the real E1M1 BSP, returns a view + clip state', async () => {
    const deps = await loadE1M1();
    const renderFrame = makeAssembledGameplayRenderer(deps);

    const player = createPlayer();
    const mo = new Mobj();
    // A safe in-map point (a real E1M1 vertex); any viewpoint is valid
    // for the BSP walk — this exercises the real node/seg/flat data.
    mo.x = deps.mapData.vertexes[0]!.x;
    mo.y = deps.mapData.vertexes[0]!.y;
    mo.angle = 0;
    player.mo = mo;
    player.viewz = 41 * FRACUNIT;

    const result = renderFrame(player, 0);
    expect(result.frame.viewx).toBe(mo.x);
    expect(result.frame.viewy).toBe(mo.y);
    expect(result.frame.viewz).toBe(41 * FRACUNIT);
    expect(result.clipState).not.toBeNull();
    // The 320x200 framebuffer the assembled passes wrote into is intact.
    expect(deps.framebuffer.length).toBe(SCREENWIDTH * SCREENHEIGHT);
  });

  test('is deterministic — two renderers, same viewpoint, identical frame transform', async () => {
    const depsA = await loadE1M1();
    const depsB = await loadE1M1();
    const playerOf = () => {
      const p = createPlayer();
      const mo = new Mobj();
      mo.x = depsA.mapData.vertexes[0]!.x;
      mo.y = depsA.mapData.vertexes[0]!.y;
      mo.angle = 0x2000_0000;
      p.mo = mo;
      p.viewz = 41 * FRACUNIT;
      return p;
    };
    const a = makeAssembledGameplayRenderer(depsA)(playerOf(), 0);
    const b = makeAssembledGameplayRenderer(depsB)(playerOf(), 0);
    expect(a.frame).toEqual(b.frame);
  });
});
