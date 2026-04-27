import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

export interface LaneLockRecord {
  readonly acquiredAtUtc: string;
  readonly expiresAtUtc: string;
  readonly heartbeatUtc: string;
  readonly lane: string;
  readonly lockId: string;
  readonly owner: string;
  readonly ownerProcessIdentifier?: number;
  readonly planDirectory: string;
  readonly processIdentifier: number;
  readonly stepId: string;
  readonly stepTitle: string;
  readonly version: 1;
}

export interface LaneLockResult {
  readonly acquired: boolean;
  readonly lane: string | null;
  readonly lockId: string | null;
  readonly reason: string;
  readonly stepId: string | null;
  readonly stepTitle: string | null;
}

interface ChecklistStep {
  readonly checked: boolean;
  readonly id: string;
  readonly lane: string;
  readonly prerequisites: readonly string[];
  readonly title: string;
}

interface ParsedArguments {
  readonly command: string;
  readonly lane: string;
  readonly leaseMinutes: number;
  readonly lockDirectory: string;
  readonly lockId: string;
  readonly owner: string;
  readonly ownerProcessIdentifier: number | null;
  readonly planDirectory: string;
}

const DEFAULT_LEASE_MINUTES = 120;
const DEFAULT_LOCK_DIRECTORY = 'plan_vanilla_parity/lane_locks';
const VALID_LANE_PATTERN = /^[a-z][a-z0-9-]*$/;

export async function acquireLaneLock(parsedArguments: ParsedArguments): Promise<LaneLockResult> {
  const planDirectory = resolve(parsedArguments.planDirectory);
  const lockDirectory = resolve(parsedArguments.lockDirectory);
  const laneDefinitions = await readLaneDefinitions(planDirectory);
  const requestedLane = parsedArguments.lane.trim();

  if (requestedLane && !laneDefinitions.has(requestedLane)) {
    return emptyResult(`Unknown lane: ${requestedLane}.`);
  }

  const steps = await readChecklistSteps(planDirectory);
  const completedStepIds = new Set(steps.filter((step) => step.checked).map((step) => step.id));
  const eligibleSteps = steps.filter((step) => !step.checked && isStepEligible(step, completedStepIds));
  const candidateSteps = requestedLane ? eligibleSteps.filter((step) => step.lane === requestedLane) : eligibleSteps;

  if (candidateSteps.length === 0) {
    return emptyResult(requestedLane ? `No eligible step exists in lane: ${requestedLane}.` : 'No eligible step exists in any lane.');
  }

  await mkdir(lockDirectory, { recursive: true });

  for (const step of candidateSteps) {
    if (!laneDefinitions.has(step.lane)) {
      continue;
    }

    const lockResult = await tryAcquireLockForStep({
      leaseMinutes: parsedArguments.leaseMinutes,
      lockDirectory,
      owner: parsedArguments.owner,
      ownerProcessIdentifier: parsedArguments.ownerProcessIdentifier,
      planDirectory,
      step,
    });

    if (lockResult.acquired) {
      return lockResult;
    }

    if (requestedLane) {
      return lockResult;
    }
  }

  return emptyResult(requestedLane ? `Lane is locked: ${requestedLane}.` : 'Every eligible lane is currently locked.');
}

export async function heartbeatLaneLock(parsedArguments: ParsedArguments): Promise<LaneLockResult> {
  return updateExistingLock(parsedArguments, 'heartbeat');
}

export async function listLaneLocks(parsedArguments: ParsedArguments): Promise<readonly LaneLockRecord[]> {
  const lockDirectory = resolve(parsedArguments.lockDirectory);
  const laneDirectories = await readExistingLaneLockDirectories(lockDirectory);
  const records: LaneLockRecord[] = [];

  for (const laneDirectory of laneDirectories) {
    const record = await readLockRecord(join(lockDirectory, laneDirectory, 'lock.json'));
    if (record) {
      records.push(record);
    }
  }

  return records.sort((leftRecord, rightRecord) => leftRecord.lane.localeCompare(rightRecord.lane));
}

export async function releaseLaneLock(parsedArguments: ParsedArguments): Promise<LaneLockResult> {
  return updateExistingLock(parsedArguments, 'release');
}

export function parseLaneLockArguments(argumentValues: readonly string[]): ParsedArguments {
  const [command = ''] = argumentValues;
  const options = new Map<string, string>();

  for (let argumentIndex = 1; argumentIndex < argumentValues.length; argumentIndex += 1) {
    const argument = argumentValues[argumentIndex] ?? '';
    if (!argument.startsWith('--')) {
      continue;
    }

    const value = argumentValues[argumentIndex + 1] ?? '';
    options.set(argument.slice(2), value);
    argumentIndex += 1;
  }

  return {
    command,
    lane: options.get('lane') ?? '',
    leaseMinutes: parsePositiveInteger(options.get('lease-minutes') ?? '', DEFAULT_LEASE_MINUTES),
    lockDirectory: options.get('lock-directory') ?? DEFAULT_LOCK_DIRECTORY,
    lockId: options.get('lock-id') ?? '',
    owner: options.get('owner') ?? 'unknown',
    ownerProcessIdentifier: parseOptionalPositiveInteger(options.get('owner-process-identifier') ?? ''),
    planDirectory: options.get('plan-directory') ?? 'plan_vanilla_parity',
  };
}

export async function readChecklistSteps(planDirectory: string): Promise<readonly ChecklistStep[]> {
  const checklistText = await readFile(join(planDirectory, 'MASTER_CHECKLIST.md'), 'utf8');
  const checklistLinePattern = /^- \[(?<mark>[ xX])\] `(?<id>\d{2}-\d{3})` `(?<title>[^`]+)` \| lane: `(?<lane>[^`]+)` \| prereqs: `(?<prerequisites>[^`]+)` \| file: `(?<file>[^`]+)`$/gm;
  const steps: ChecklistStep[] = [];

  for (const match of checklistText.matchAll(checklistLinePattern)) {
    const groups = match.groups;
    if (!groups) {
      continue;
    }

    steps.push({
      checked: groups.mark.toLowerCase() === 'x',
      id: groups.id,
      lane: groups.lane,
      prerequisites: groups.prerequisites
        .split(',')
        .map((prerequisite) => prerequisite.trim())
        .filter((prerequisite) => prerequisite.length > 0 && prerequisite !== 'none'),
      title: groups.title,
    });
  }

  return steps;
}

async function readLaneDefinitions(planDirectory: string): Promise<ReadonlySet<string>> {
  const parallelWorkText = await readFile(join(planDirectory, 'PARALLEL_WORK.md'), 'utf8');
  const lanes = new Set<string>();

  for (const line of parallelWorkText.split(/\r?\n/)) {
    if (!line.startsWith('| ') || line.startsWith('| lane ') || line.startsWith('| ---')) {
      continue;
    }

    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    const lane = cells[0] ?? '';
    if (VALID_LANE_PATTERN.test(lane)) {
      lanes.add(lane);
    }
  }

  return lanes;
}

async function readExistingLaneLockDirectories(lockDirectory: string): Promise<readonly string[]> {
  try {
    const entries = await readdir(lockDirectory, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory() && entry.name.endsWith('.lock')).map((entry) => entry.name);
  } catch (error) {
    if (isNotFoundError(error)) {
      return [];
    }

    throw error;
  }
}

function emptyResult(reason: string): LaneLockResult {
  return {
    acquired: false,
    lane: null,
    lockId: null,
    reason,
    stepId: null,
    stepTitle: null,
  };
}

function getLaneLockPath(lockDirectory: string, lane: string): string {
  if (!VALID_LANE_PATTERN.test(lane)) {
    throw new Error(`Invalid lane name: ${lane}`);
  }

  return join(lockDirectory, `${lane}.lock`);
}

function isNotFoundError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

function isStepEligible(step: ChecklistStep, completedStepIds: ReadonlySet<string>): boolean {
  return step.prerequisites.every((prerequisite) => completedStepIds.has(prerequisite));
}

async function readLockRecord(lockFilePath: string): Promise<LaneLockRecord | null> {
  try {
    const text = await readFile(lockFilePath, 'utf8');
    const parsedValue = JSON.parse(text) as Partial<LaneLockRecord>;
    if (!parsedValue.lane || !parsedValue.lockId || !parsedValue.expiresAtUtc) {
      return null;
    }

    return parsedValue as LaneLockRecord;
  } catch (error) {
    if (isNotFoundError(error) || error instanceof SyntaxError) {
      return null;
    }

    throw error;
  }
}

function isRecordExpired(record: LaneLockRecord, now: Date): boolean {
  return Date.parse(record.expiresAtUtc) <= now.getTime();
}

function isRecordOwnerProcessGone(record: LaneLockRecord): boolean {
  const ownerProcessIdentifier = readRecordOwnerProcessIdentifier(record);
  if (ownerProcessIdentifier === null) {
    return false;
  }

  try {
    process.kill(ownerProcessIdentifier, 0);
    return false;
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ESRCH') {
      return true;
    }

    return false;
  }
}

function parseOptionalPositiveInteger(value: string): number | null {
  if (!value) {
    return null;
  }

  const parsedValue = Number(value);
  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return null;
  }

  return parsedValue;
}

function parsePositiveInteger(value: string, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsedValue = Number(value);
  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return fallback;
  }

  return parsedValue;
}

function readRecordOwnerProcessIdentifier(record: LaneLockRecord): number | null {
  if (Number.isInteger(record.ownerProcessIdentifier) && (record.ownerProcessIdentifier ?? 0) > 0) {
    return record.ownerProcessIdentifier ?? null;
  }

  const ownerProcessIdentifierMatch = /\bpid=(?<ownerProcessIdentifier>\d+)\b/.exec(record.owner);
  const ownerProcessIdentifier = ownerProcessIdentifierMatch?.groups?.ownerProcessIdentifier ?? '';

  return parseOptionalPositiveInteger(ownerProcessIdentifier);
}

async function removeExpiredLockDirectory(lockPath: string, now: Date): Promise<boolean> {
  const record = await readLockRecord(join(lockPath, 'lock.json'));
  if (record && !isRecordExpired(record, now) && !isRecordOwnerProcessGone(record)) {
    return false;
  }

  await rm(lockPath, { force: true, recursive: true });
  return true;
}

async function tryAcquireLockForStep(options: {
  readonly leaseMinutes: number;
  readonly lockDirectory: string;
  readonly owner: string;
  readonly ownerProcessIdentifier: number | null;
  readonly planDirectory: string;
  readonly step: ChecklistStep;
}): Promise<LaneLockResult> {
  const lockPath = getLaneLockPath(options.lockDirectory, options.step.lane);
  const now = new Date();

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      await mkdir(lockPath);
      const lockId = crypto.randomUUID();
      const expiresAt = new Date(now.getTime() + options.leaseMinutes * 60_000);
      const record: LaneLockRecord = {
        acquiredAtUtc: now.toISOString(),
        expiresAtUtc: expiresAt.toISOString(),
        heartbeatUtc: now.toISOString(),
        lane: options.step.lane,
        lockId,
        owner: options.owner,
        ...(options.ownerProcessIdentifier === null ? {} : { ownerProcessIdentifier: options.ownerProcessIdentifier }),
        planDirectory: options.planDirectory,
        processIdentifier: process.pid,
        stepId: options.step.id,
        stepTitle: options.step.title,
        version: 1,
      };

      await writeFile(join(lockPath, 'lock.json'), `${JSON.stringify(record, null, 2)}\n`);

      return {
        acquired: true,
        lane: options.step.lane,
        lockId,
        reason: `Acquired lane ${options.step.lane} for ${options.step.id}.`,
        stepId: options.step.id,
        stepTitle: options.step.title,
      };
    } catch (error) {
      if (typeof error !== 'object' || error === null || !('code' in error) || error.code !== 'EEXIST') {
        throw error;
      }

      const removed = await removeExpiredLockDirectory(lockPath, now);
      if (!removed) {
        const record = await readLockRecord(join(lockPath, 'lock.json'));
        return emptyResult(record ? `Lane is locked: ${record.lane} by ${record.owner} until ${record.expiresAtUtc}.` : `Lane is locked: ${basename(lockPath, '.lock')}.`);
      }
    }
  }

  return emptyResult(`Lane is locked: ${options.step.lane}.`);
}

async function updateExistingLock(parsedArguments: ParsedArguments, action: 'heartbeat' | 'release'): Promise<LaneLockResult> {
  if (!parsedArguments.lane) {
    return emptyResult('Lane is required.');
  }

  if (!parsedArguments.lockId) {
    return emptyResult('Lock id is required.');
  }

  const lockPath = getLaneLockPath(resolve(parsedArguments.lockDirectory), parsedArguments.lane);
  const lockFilePath = join(lockPath, 'lock.json');
  const record = await readLockRecord(lockFilePath);
  if (!record) {
    return emptyResult(`Lane lock is missing: ${parsedArguments.lane}.`);
  }

  if (record.lockId !== parsedArguments.lockId) {
    return emptyResult(`Lane lock id mismatch for ${parsedArguments.lane}.`);
  }

  if (action === 'release') {
    await rm(lockPath, { force: true, recursive: true });
    return {
      acquired: true,
      lane: record.lane,
      lockId: record.lockId,
      reason: `Released lane ${record.lane}.`,
      stepId: record.stepId,
      stepTitle: record.stepTitle,
    };
  }

  const now = new Date();
  const expiresAt = new Date(now.getTime() + parsedArguments.leaseMinutes * 60_000);
  const nextRecord: LaneLockRecord = {
    ...record,
    expiresAtUtc: expiresAt.toISOString(),
    heartbeatUtc: now.toISOString(),
  };

  await writeFile(lockFilePath, `${JSON.stringify(nextRecord, null, 2)}\n`);

  return {
    acquired: true,
    lane: record.lane,
    lockId: record.lockId,
    reason: `Heartbeat refreshed lane ${record.lane}.`,
    stepId: record.stepId,
    stepTitle: record.stepTitle,
  };
}

async function runLaneLockCli(): Promise<number> {
  const parsedArguments = parseLaneLockArguments(Bun.argv.slice(2));

  switch (parsedArguments.command) {
    case 'acquire':
      console.log(JSON.stringify(await acquireLaneLock(parsedArguments)));
      return 0;
    case 'heartbeat':
      console.log(JSON.stringify(await heartbeatLaneLock(parsedArguments)));
      return 0;
    case 'list':
      console.log(JSON.stringify(await listLaneLocks(parsedArguments)));
      return 0;
    case 'release':
      console.log(JSON.stringify(await releaseLaneLock(parsedArguments)));
      return 0;
    default:
      console.error(
        'Usage: bun run plan_vanilla_parity/lane-lock.ts acquire|heartbeat|release|list [--lane <lane>] [--lock-id <id>] [--plan-directory <path>] [--lock-directory <path>] [--lease-minutes <minutes>] [--owner <owner>] [--owner-process-identifier <pid>]',
      );
      return 2;
  }
}

if (import.meta.path === Bun.main) {
  process.exit(await runLaneLockCli());
}
