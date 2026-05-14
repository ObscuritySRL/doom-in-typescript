import { existsSync } from 'node:fs';
import path from 'node:path';

import { createReferenceSandbox, destroyReferenceSandbox } from './createReferenceSandbox.ts';

const KILL_WAIT_MS_DEFAULT = 5_000;
const SETTLE_MS_DEFAULT = 750;

export type ReferenceLaunchTerminationCause = 'natural-exit' | 'sandbox-killed' | 'spawn-failed';

export interface ReferenceLaunchEvidence {
  readonly sandboxId: string;
  readonly sandboxAbsolutePath: string;
  readonly executableFilename: string;
  readonly spawnedAtElapsedMs: number;
  readonly settleDurationMs: number;
  readonly killedAtElapsedMs: number | null;
  readonly exitedAtElapsedMs: number;
  readonly exitCode: number | null;
  readonly exitSignal: NodeJS.Signals | number | null;
  readonly terminationCause: ReferenceLaunchTerminationCause;
  readonly totalElapsedMs: number;
  readonly cleanShutdown: boolean;
}

export interface LaunchReferenceCleanlyOverrides {
  readonly sandboxIdOverride?: string;
  readonly settleDurationMs?: number;
  readonly killWaitMs?: number;
  readonly executableFilename?: string;
}

export class ReferenceBundleMissingError extends Error {
  public constructor(missingFile: string) {
    super(`Reference bundle file is missing on this host: ${missingFile}`);
    this.name = 'ReferenceBundleMissingError';
  }
}

function nowMs(): number {
  return performance.now();
}

async function sleepMs(durationMs: number): Promise<void> {
  await Bun.sleep(durationMs);
}

export async function launchReferenceCleanly(overrides: LaunchReferenceCleanlyOverrides = {}): Promise<ReferenceLaunchEvidence> {
  const executableFilename = overrides.executableFilename ?? 'DOOM.EXE';
  const settleDurationMs = overrides.settleDurationMs ?? SETTLE_MS_DEFAULT;
  const killWaitMs = overrides.killWaitMs ?? KILL_WAIT_MS_DEFAULT;

  const sandbox = await createReferenceSandbox({ sandboxIdOverride: overrides.sandboxIdOverride });
  const executableAbsolutePath = path.join(sandbox.sandboxAbsolutePath, executableFilename);

  if (!existsSync(executableAbsolutePath)) {
    await destroyReferenceSandbox(sandbox.sandboxAbsolutePath);
    throw new ReferenceBundleMissingError(executableAbsolutePath);
  }

  const startReference = nowMs();

  try {
    const subprocess = Bun.spawn([executableAbsolutePath], {
      cwd: sandbox.sandboxAbsolutePath,
      stdin: 'ignore',
      stdout: 'ignore',
      stderr: 'ignore',
    });
    const spawnedAtElapsedMs = nowMs() - startReference;

    await sleepMs(settleDurationMs);
    const settleEndElapsedMs = nowMs() - startReference;

    let killedAtElapsedMs: number | null = null;
    let terminationCause: ReferenceLaunchTerminationCause = 'natural-exit';

    if (subprocess.exitCode === null) {
      subprocess.kill();
      killedAtElapsedMs = nowMs() - startReference;
      terminationCause = 'sandbox-killed';
    }

    const exited = await Promise.race([subprocess.exited.then((code) => ({ kind: 'exited' as const, code })), new Promise<{ kind: 'timeout' }>((resolve) => setTimeout(() => resolve({ kind: 'timeout' }), killWaitMs))]);
    const exitedAtElapsedMs = nowMs() - startReference;

    const exitCode = exited.kind === 'exited' ? exited.code : null;
    const exitSignal = subprocess.signalCode;
    const cleanShutdown = exited.kind === 'exited';

    return Object.freeze({
      cleanShutdown,
      executableFilename,
      exitCode,
      exitSignal,
      exitedAtElapsedMs,
      killedAtElapsedMs,
      sandboxAbsolutePath: sandbox.sandboxAbsolutePath,
      sandboxId: sandbox.sandboxId,
      settleDurationMs: settleEndElapsedMs - spawnedAtElapsedMs,
      spawnedAtElapsedMs,
      terminationCause,
      totalElapsedMs: exitedAtElapsedMs,
    });
  } finally {
    await destroyReferenceSandbox(sandbox.sandboxAbsolutePath);
  }
}

if (import.meta.main) {
  const evidence = await launchReferenceCleanly();
  console.log(JSON.stringify(evidence, null, 2));
}
