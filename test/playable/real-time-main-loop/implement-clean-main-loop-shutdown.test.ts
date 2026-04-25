import { describe, expect, test } from 'bun:test';

import type { ImplementCleanMainLoopShutdownContract } from '../../../src/playable/real-time-main-loop/implementCleanMainLoopShutdown.ts';
import { IMPLEMENT_CLEAN_MAIN_LOOP_SHUTDOWN_CONTRACT, implementCleanMainLoopShutdown } from '../../../src/playable/real-time-main-loop/implementCleanMainLoopShutdown.ts';

const AUDIT_PLAYABLE_HOST_SURFACE_MANIFEST_PATH = new URL('../../../plan_fps/manifests/01-006-audit-playable-host-surface.json', import.meta.url);
const MAIN_LOOP_SOURCE_PATH = new URL('../../../src/mainLoop.ts', import.meta.url);
const TIC_ACCUMULATOR_SOURCE_PATH = new URL('../../../src/host/ticAccumulator.ts', import.meta.url);

const EXPECTED_IMPLEMENT_CLEAN_MAIN_LOOP_SHUTDOWN_CONTRACT: ImplementCleanMainLoopShutdownContract = Object.freeze({
  deterministicReplayCompatibility: 'Stop only after a completed frame without advancing, resetting, or inventing tic timing during shutdown.',
  phaseOrder: ['startFrame', 'tryRunTics', 'updateSounds', 'display'] as const,
  replaySafeTicAuthority: 'TicAccumulator.totalTics',
  runOneFrameCompletionBoundary: 'callbacks.display();\n    this.#frameCount++;',
  runtimeCommand: 'bun run doom.ts',
  shutdownBoundaryPhase: 'display',
  shutdownTransition: 'runLauncherWindow(session, { scale, title: `DOOM Codex - ${session.mapName}` })',
  ticMutationPolicy: 'Shutdown does not call TicAccumulator.advance() or TicAccumulator.reset().',
});

const EXPECTED_IMPLEMENT_CLEAN_MAIN_LOOP_SHUTDOWN_HASH = 'a202c7ce21bb3260b813cefdff813c032424d9b240a24021a51da25f7ed1a2ea';

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digestBuffer = await crypto.subtle.digest('SHA-256', bytes);
  const digestBytes = new Uint8Array(digestBuffer);
  return Array.from(digestBytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

describe('implementCleanMainLoopShutdown', () => {
  test('locks the exact clean main-loop shutdown contract', () => {
    expect(IMPLEMENT_CLEAN_MAIN_LOOP_SHUTDOWN_CONTRACT).toEqual(EXPECTED_IMPLEMENT_CLEAN_MAIN_LOOP_SHUTDOWN_CONTRACT);
    expect(implementCleanMainLoopShutdown('bun run doom.ts')).toBe(IMPLEMENT_CLEAN_MAIN_LOOP_SHUTDOWN_CONTRACT);
  });

  test('locks a stable hash for the serialized shutdown contract', async () => {
    const contractJson = JSON.stringify(IMPLEMENT_CLEAN_MAIN_LOOP_SHUTDOWN_CONTRACT);
    await expect(sha256(contractJson)).resolves.toBe(EXPECTED_IMPLEMENT_CLEAN_MAIN_LOOP_SHUTDOWN_HASH);
  });

  test('anchors shutdown to the audited playable host transition', async () => {
    const manifest = JSON.parse(await Bun.file(AUDIT_PLAYABLE_HOST_SURFACE_MANIFEST_PATH).text()) as {
      readonly currentLauncherHostTransition: {
        readonly call: string;
      };
    };

    expect(manifest.currentLauncherHostTransition.call).toBe(IMPLEMENT_CLEAN_MAIN_LOOP_SHUTDOWN_CONTRACT.shutdownTransition);
  });

  test('anchors shutdown to the completed-frame boundary in the main loop', async () => {
    const mainLoopSource = await Bun.file(MAIN_LOOP_SOURCE_PATH).text();
    const displayCallIndex = mainLoopSource.indexOf('callbacks.display();');
    const frameCountIncrementIndex = mainLoopSource.indexOf('this.#frameCount++;');

    expect(displayCallIndex).toBeGreaterThan(-1);
    expect(frameCountIncrementIndex).toBeGreaterThan(displayCallIndex);
    expect(mainLoopSource).toContain(IMPLEMENT_CLEAN_MAIN_LOOP_SHUTDOWN_CONTRACT.runOneFrameCompletionBoundary);
    expect(IMPLEMENT_CLEAN_MAIN_LOOP_SHUTDOWN_CONTRACT.phaseOrder.at(-1)).toBe(IMPLEMENT_CLEAN_MAIN_LOOP_SHUTDOWN_CONTRACT.shutdownBoundaryPhase);
  });

  test('anchors replay-safe shutdown to tic accumulator state without shutdown-side mutation', async () => {
    const ticAccumulatorSource = await Bun.file(TIC_ACCUMULATOR_SOURCE_PATH).text();

    expect(ticAccumulatorSource).toContain('get totalTics(): number {');
    expect(ticAccumulatorSource).toContain('return this.#lastTotalTics;');
    expect(ticAccumulatorSource).toContain('advance(): number {');
    expect(ticAccumulatorSource).toContain('reset(): void {');
    expect(IMPLEMENT_CLEAN_MAIN_LOOP_SHUTDOWN_CONTRACT.replaySafeTicAuthority).toBe('TicAccumulator.totalTics');
    expect(IMPLEMENT_CLEAN_MAIN_LOOP_SHUTDOWN_CONTRACT.ticMutationPolicy).toBe('Shutdown does not call TicAccumulator.advance() or TicAccumulator.reset().');
  });

  test('rejects non-Bun runtime commands', () => {
    expect(() => implementCleanMainLoopShutdown('bun run src/main.ts')).toThrow('implementCleanMainLoopShutdown requires bun run doom.ts');
  });
});
