/**
 * Phase 04 gate: demo sync primitives.
 *
 * Aggregates the demo lump format primitives required by all 3 attract-loop
 * demos (DEMO1 / DEMO2 / DEMO3) and the playback / recording state machines.
 * Closes when each primitive's module exists and the DEMO comparators all
 * accept a canonical header.
 */

export const PHASE_04_DEMO_SYNC_PRIMITIVES_MODULES = Object.freeze([
  'src/core/implement-demo-lump-header-parser.ts',
  'src/core/implement-demo-playback-state-machine.ts',
  'src/core/implement-demo-recording-state-machine.ts',
  'src/core/implement-demo-ticcmd-parser.ts',
  'src/core/enforce-vanilla-demo-size-limit.ts',
  'src/demo/compare-demo-one-ticcmd-stream.ts',
  'src/demo/compare-demo-two-ticcmd-stream.ts',
  'src/demo/compare-demo-three-ticcmd-stream.ts',
] as const);

export interface DemoSyncExpectations {
  readonly demoHeaderBytes: number;
  readonly demoTiccmdBytes: number;
  readonly demoTerminatorByte: number;
  readonly demoVanillaVersion: number;
  readonly demoMaxPlayers: number;
  readonly demoByteLimit: number;
  readonly playbackPhaseCount: number;
  readonly recordingPhaseCount: number;
}

export const PHASE_04_DEMO_SYNC_PRIMITIVES_EXPECTATIONS: DemoSyncExpectations = Object.freeze({
  demoHeaderBytes: 13,
  demoTiccmdBytes: 4,
  demoTerminatorByte: 0x80,
  demoVanillaVersion: 109,
  demoMaxPlayers: 4,
  demoByteLimit: 0x20000,
  playbackPhaseCount: 5,
  recordingPhaseCount: 4,
});

export type DemoSyncGateViolation = 'missing_module' | 'wrong_constants';

export interface DemoSyncGateInput {
  readonly observedModules: readonly string[];
  readonly observedConstants: DemoSyncExpectations;
}

export interface DemoSyncGateDecision {
  readonly closed: boolean;
  readonly violations: readonly DemoSyncGateViolation[];
}

export function evaluateDemoSyncGate(input: DemoSyncGateInput): DemoSyncGateDecision {
  const violations = new Set<DemoSyncGateViolation>();
  const observedModuleSet = new Set(input.observedModules);
  for (const requiredModule of PHASE_04_DEMO_SYNC_PRIMITIVES_MODULES) {
    if (!observedModuleSet.has(requiredModule)) {
      violations.add('missing_module');
    }
  }
  for (const constantName of Object.keys(PHASE_04_DEMO_SYNC_PRIMITIVES_EXPECTATIONS) as (keyof DemoSyncExpectations)[]) {
    if (input.observedConstants[constantName] !== PHASE_04_DEMO_SYNC_PRIMITIVES_EXPECTATIONS[constantName]) {
      violations.add('wrong_constants');
    }
  }
  return Object.freeze({
    closed: violations.size === 0,
    violations: Object.freeze([...violations].sort()),
  });
}
