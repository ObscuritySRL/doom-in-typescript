/**
 * Phase 05 gate: WAD and asset loading.
 *
 * Aggregates the WAD-lane primitives pinned in steps 05-001 through 05-026.
 * Gate closes when every named module exists and the canonical WAD-loading
 * constants match vanilla DOOM 1.9.
 */

export const PHASE_05_REQUIRED_MODULES = Object.freeze([
  'src/assets/build-asset-cache-lifetime-policy.ts',
  'src/assets/build-flat-cache.ts',
  'src/assets/build-patch-font-cache.ts',
  'src/assets/build-sprite-frame-cache.ts',
  'src/assets/build-texture-composition-cache.ts',
  'src/assets/compare-local-doom1-wad-manifest.ts',
  'src/assets/detect-registered-iwad-capabilities.ts',
  'src/assets/detect-shareware-iwad-capabilities.ts',
  'src/assets/detect-ultimate-iwad-capabilities.ts',
  'src/assets/parse-demo-lumps.ts',
  'src/assets/parse-flat-namespace.ts',
  'src/assets/parse-map-lump-bundle-boundaries.ts',
  'src/assets/parse-music-mus-lumps.ts',
  'src/assets/parse-patch-picture-format.ts',
  'src/assets/parse-playpal-and-colormap-lumps.ts',
  'src/assets/parse-pnames-lump.ts',
  'src/assets/parse-sound-effect-lumps.ts',
  'src/assets/parse-sprite-namespace.ts',
  'src/assets/parse-texture-one-lump.ts',
  'src/assets/parse-texture-two-when-present.ts',
  'src/wad/directory.ts',
  'src/wad/header.ts',
] as const);

export const PHASE_05_WAD_EXPECTATIONS = Object.freeze({
  shareware_iwad_total_lumps: 1264,
  wad_type_iwad: 'IWAD',
  patch_header_bytes: 8,
  playpal_palette_count: 14,
  flat_dimension: 64,
});

export type WadGateViolation = 'missing_module' | 'wrong_constants';

export interface WadGateInput {
  readonly observedModules: readonly string[];
  readonly observedConstants: typeof PHASE_05_WAD_EXPECTATIONS;
}

export interface WadGateDecision {
  readonly closed: boolean;
  readonly violations: readonly WadGateViolation[];
}

export function evaluateWadGate(input: WadGateInput): WadGateDecision {
  const violations = new Set<WadGateViolation>();
  const observedModuleSet = new Set(input.observedModules);
  for (const requiredModule of PHASE_05_REQUIRED_MODULES) {
    if (!observedModuleSet.has(requiredModule)) {
      violations.add('missing_module');
    }
  }
  for (const constantName of Object.keys(PHASE_05_WAD_EXPECTATIONS) as (keyof typeof PHASE_05_WAD_EXPECTATIONS)[]) {
    if (input.observedConstants[constantName] !== PHASE_05_WAD_EXPECTATIONS[constantName]) {
      violations.add('wrong_constants');
    }
  }
  return Object.freeze({
    closed: violations.size === 0,
    violations: Object.freeze([...violations].sort()),
  });
}
