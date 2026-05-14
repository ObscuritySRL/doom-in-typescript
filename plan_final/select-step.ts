import { FINAL_PLAN_STEPS, type FinalPlanStep } from './planData.ts';
import { stepFilePath } from './validate-plan.ts';

export interface StepSelection {
  readonly reason: string;
  readonly step: FinalPlanStep | null;
  readonly stepFile: string | null;
}

export interface SelectStepOptions {
  readonly statusDirectory?: string;
}

interface StepStatus {
  readonly status?: string;
}

const DEFAULT_STATUS_DIRECTORY = 'plan_final/status';

async function readCompletedStepIds(statusDirectory: string): Promise<ReadonlySet<string>> {
  const completedStepIds = new Set<string>();

  for (const step of FINAL_PLAN_STEPS) {
    const statusPath = `${statusDirectory}/${step.id}.json`;

    if (!(await Bun.file(statusPath).exists())) {
      continue;
    }

    const status = (await Bun.file(statusPath).json()) as StepStatus;
    if (status.status === 'COMPLETED') {
      completedStepIds.add(step.id);
    }
  }

  return completedStepIds;
}

function prerequisitesComplete(step: FinalPlanStep, completedStepIds: ReadonlySet<string>): boolean {
  for (const prerequisite of step.prerequisites) {
    if (!completedStepIds.has(prerequisite)) {
      return false;
    }
  }

  return true;
}

export async function selectNextStep(lane: string | null = null, options: SelectStepOptions = {}): Promise<StepSelection> {
  const statusDirectory = options.statusDirectory ?? DEFAULT_STATUS_DIRECTORY;
  const completedStepIds = await readCompletedStepIds(statusDirectory);

  for (const step of FINAL_PLAN_STEPS) {
    if (lane !== null && step.lane !== lane) {
      continue;
    }

    if (completedStepIds.has(step.id)) {
      continue;
    }

    if (!prerequisitesComplete(step, completedStepIds)) {
      continue;
    }

    return Object.freeze({
      reason: 'first eligible step',
      step,
      stepFile: stepFilePath(step),
    });
  }

  return Object.freeze({
    reason: lane === null ? 'no eligible step' : `no eligible step in lane ${lane}`,
    step: null,
    stepFile: null,
  });
}

if (import.meta.main) {
  const laneArgumentIndex = Bun.argv.indexOf('--lane');
  const lane = laneArgumentIndex === -1 ? (Bun.env.RLP_LANE ?? null) : (Bun.argv[laneArgumentIndex + 1] ?? null);
  const selection = await selectNextStep(lane);

  console.log(JSON.stringify(selection, null, 2));
}
