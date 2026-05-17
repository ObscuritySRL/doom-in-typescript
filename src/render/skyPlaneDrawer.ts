/**
 * Sky-plane drawer binding — the Chocolate Doom 2.2.1 r_plane.c
 * `R_DrawPlanes` sky branch bound into the {@link VisplaneRenderer}
 * closure `renderPlayerViewWalls` invokes as `onSkyPlane`.
 *
 * `R_DrawPlanes` walks the visplane pool; for a sky visplane
 * (`pl->picnum == skyflatnum`) it draws each column from the single sky
 * texture at full bright (`colormaps + 0`), with the per-column angle
 * from `xtoviewangle`. The committed bit-exact pass is
 * {@link renderSkyVisplane}; its {@link SkyRenderContext} is entirely
 * frame-static (one sky texture, fixed full-bright colormap, the frame
 * `viewangle` / `xtoviewangle` / `centery` / framebuffer) — unlike a
 * regular flat plane, nothing depends on the individual visplane's
 * height / lightlevel / picnum. So a single context binds every sky
 * plane this frame.
 *
 * Pure composition glue: the framebuffer is caller-owned and written in
 * place by the committed renderer (own suite); this only fixes the
 * `(plane) => void` closure form. No Win32 or runtime dependencies.
 */

import type { VisplaneRenderer } from './drawPlanes.ts';
import type { Visplane } from './renderLimits.ts';
import { renderSkyVisplane } from './sky.ts';
import type { SkyRenderContext } from './sky.ts';

/** Optional DI hook (defaults to the committed bit-exact sky pass). */
export interface SkyPlaneDrawerHooks {
  readonly renderSkyVisplaneFn?: typeof renderSkyVisplane;
}

/**
 * Bind one frame-static {@link SkyRenderContext} into the
 * `onSkyPlane` {@link VisplaneRenderer} the R_DrawPlanes pool walk
 * dispatches per sky visplane.
 *
 * @example
 * ```ts
 * const onSkyPlane = makeSkyPlaneDrawer({ skyTexture, viewAngle, xToViewAngle, baseColormap, iscale, textureMid, centerY, framebuffer });
 * renderPlayerViewWalls(scene, player, angles, pool, viewWidth, skyflatnum, makeOnSubsector, onSkyPlane, onRegularPlane);
 * ```
 */
export function makeSkyPlaneDrawer(ctx: SkyRenderContext, hooks: SkyPlaneDrawerHooks = {}): VisplaneRenderer {
  const renderSky = hooks.renderSkyVisplaneFn ?? renderSkyVisplane;

  return (plane: Visplane): void => {
    renderSky(plane, ctx);
  };
}
