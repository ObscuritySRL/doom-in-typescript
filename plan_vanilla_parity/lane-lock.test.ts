import { describe, expect, test } from 'bun:test';

import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { acquireLaneLock, heartbeatLaneLock, parseLaneLockArguments, readChecklistSteps, releaseLaneLock } from './lane-lock.ts';

async function createFixturePlan(): Promise<{ readonly lockDirectory: string; readonly planDirectory: string; readonly rootDirectory: string }> {
  const rootDirectory = await mkdtemp(join(tmpdir(), 'doom-vanilla-lanes-'));
  const planDirectory = join(rootDirectory, 'plan_vanilla_parity');
  const lockDirectory = join(planDirectory, 'lane_locks');

  await mkdir(planDirectory, { recursive: true });
  await mkdir(lockDirectory, { recursive: true });
  await writeFile(
    join(planDirectory, 'PARALLEL_WORK.md'),
    [
      '# Parallel Work',
      '',
      '| lane | what can proceed immediately | blocked by | owns | must not touch |',
      '| --- | --- | --- | --- | --- |',
      '| governance | immediate | none | plan_vanilla_parity/ | doom/; iwad/; reference/ |',
      '| oracle | immediate | none | tools/reference/ | doom/; iwad/; reference/ |',
      '| launch | immediate | none | doom.ts; src/bootstrap/ | doom/; iwad/; reference/ |',
      '',
    ].join('\n'),
  );
  await writeFile(
    join(planDirectory, 'MASTER_CHECKLIST.md'),
    [
      '# Master Checklist',
      '',
      '- [ ] `00-001` `governance one` | lane: `governance` | prereqs: `none` | file: `plan_vanilla_parity/steps/00-001-governance-one.md`',
      '- [ ] `00-002` `governance two` | lane: `governance` | prereqs: `00-001` | file: `plan_vanilla_parity/steps/00-002-governance-two.md`',
      '- [ ] `02-001` `oracle one` | lane: `oracle` | prereqs: `none` | file: `plan_vanilla_parity/steps/02-001-oracle-one.md`',
      '- [ ] `03-001` `launch one` | lane: `launch` | prereqs: `00-001` | file: `plan_vanilla_parity/steps/03-001-launch-one.md`',
      '',
    ].join('\n'),
  );

  return { lockDirectory, planDirectory, rootDirectory };
}

function createArguments(planDirectory: string, lockDirectory: string, overrides: readonly string[] = []) {
  return parseLaneLockArguments(['acquire', '--plan-directory', planDirectory, '--lock-directory', lockDirectory, '--owner', 'test-owner', '--lease-minutes', '60', ...overrides]);
}

describe('vanilla parity lane lock helper', () => {
  test('reads checklist lanes and prerequisites from the plan fixture', async () => {
    const fixture = await createFixturePlan();
    try {
      const steps = await readChecklistSteps(fixture.planDirectory);

      expect(steps.map((step) => `${step.id}:${step.lane}:${step.prerequisites.join(',') || 'none'}`)).toEqual(['00-001:governance:none', '00-002:governance:00-001', '02-001:oracle:none', '03-001:launch:00-001']);
    } finally {
      await rm(fixture.rootDirectory, { force: true, recursive: true });
    }
  });

  test('auto-picks the first eligible unlocked lane and writes durable lock metadata', async () => {
    const fixture = await createFixturePlan();
    try {
      const result = await acquireLaneLock(createArguments(fixture.planDirectory, fixture.lockDirectory));

      expect(result.acquired).toBe(true);
      expect(result.lane).toBe('governance');
      expect(result.stepId).toBe('00-001');

      const lockText = await readFile(join(fixture.lockDirectory, 'governance.lock', 'lock.json'), 'utf8');
      expect(lockText).toContain('"lane": "governance"');
      expect(lockText).toContain('"owner": "test-owner"');
    } finally {
      await rm(fixture.rootDirectory, { force: true, recursive: true });
    }
  });

  test('lets a requested unlocked lane acquire its own eligible step', async () => {
    const fixture = await createFixturePlan();
    try {
      const result = await acquireLaneLock(createArguments(fixture.planDirectory, fixture.lockDirectory, ['--lane', 'oracle']));

      expect(result.acquired).toBe(true);
      expect(result.lane).toBe('oracle');
      expect(result.stepId).toBe('02-001');
    } finally {
      await rm(fixture.rootDirectory, { force: true, recursive: true });
    }
  });

  test('prevents a second agent from acquiring the same lane', async () => {
    const fixture = await createFixturePlan();
    try {
      const firstResult = await acquireLaneLock(createArguments(fixture.planDirectory, fixture.lockDirectory, ['--lane', 'oracle']));
      const secondResult = await acquireLaneLock(createArguments(fixture.planDirectory, fixture.lockDirectory, ['--lane', 'oracle']));

      expect(firstResult.acquired).toBe(true);
      expect(secondResult).toEqual({
        acquired: false,
        lane: null,
        lockId: null,
        reason: expect.stringContaining('Lane is locked: oracle'),
        stepId: null,
        stepTitle: null,
      });
    } finally {
      await rm(fixture.rootDirectory, { force: true, recursive: true });
    }
  });

  test('heartbeats and releases only when the lock id matches', async () => {
    const fixture = await createFixturePlan();
    try {
      const firstResult = await acquireLaneLock(createArguments(fixture.planDirectory, fixture.lockDirectory, ['--lane', 'oracle']));
      const wrongHeartbeat = await heartbeatLaneLock(createArguments(fixture.planDirectory, fixture.lockDirectory, ['--lane', 'oracle', '--lock-id', 'wrong-lock']));
      const heartbeat = await heartbeatLaneLock(createArguments(fixture.planDirectory, fixture.lockDirectory, ['--lane', 'oracle', '--lock-id', firstResult.lockId ?? '']));
      const wrongRelease = await releaseLaneLock(createArguments(fixture.planDirectory, fixture.lockDirectory, ['--lane', 'oracle', '--lock-id', 'wrong-lock']));
      const release = await releaseLaneLock(createArguments(fixture.planDirectory, fixture.lockDirectory, ['--lane', 'oracle', '--lock-id', firstResult.lockId ?? '']));
      const reacquired = await acquireLaneLock(createArguments(fixture.planDirectory, fixture.lockDirectory, ['--lane', 'oracle']));

      expect(wrongHeartbeat.acquired).toBe(false);
      expect(heartbeat.acquired).toBe(true);
      expect(wrongRelease.acquired).toBe(false);
      expect(release.acquired).toBe(true);
      expect(reacquired.acquired).toBe(true);
    } finally {
      await rm(fixture.rootDirectory, { force: true, recursive: true });
    }
  });

  test('recovers an expired lane lock after an interrupted loop', async () => {
    const fixture = await createFixturePlan();
    try {
      const expiredResult = await acquireLaneLock(createArguments(fixture.planDirectory, fixture.lockDirectory, ['--lane', 'oracle', '--lease-minutes', '1']));
      const lockPath = join(fixture.lockDirectory, 'oracle.lock', 'lock.json');
      const expiredRecord = JSON.parse(await readFile(lockPath, 'utf8')) as Record<string, unknown>;
      expiredRecord.expiresAtUtc = new Date(Date.now() - 60_000).toISOString();
      await writeFile(lockPath, `${JSON.stringify(expiredRecord, null, 2)}\n`);

      const nextResult = await acquireLaneLock(createArguments(fixture.planDirectory, fixture.lockDirectory, ['--lane', 'oracle']));

      expect(expiredResult.acquired).toBe(true);
      expect(nextResult.acquired).toBe(true);
      expect(nextResult.lockId).not.toBe(expiredResult.lockId);
    } finally {
      await rm(fixture.rootDirectory, { force: true, recursive: true });
    }
  });
});
