import { FINAL_PLAN_STEPS } from './planData.ts';

const CHECKLIST_PATH_DEFAULT = 'plan_final/MASTER_CHECKLIST.md';
const STATUS_DIRECTORY_DEFAULT = 'plan_final/status';
const CHECKLIST_LINE_PATTERN = /^- \[[ xX]\] `(?<stepId>\d{2}-\d{3})`/;

export interface ChecklistSyncOptions {
  readonly checklistPath?: string;
  readonly statusDirectory?: string;
}

export interface ChecklistSyncResult {
  readonly changed: boolean;
  readonly checkedCount: number;
  readonly checklistPath: string;
  readonly completedStepIds: readonly string[];
  readonly totalStepCount: number;
  readonly uncheckedCount: number;
  readonly updatedLineCount: number;
}

async function readCompletedStepIds(statusDirectory: string): Promise<ReadonlySet<string>> {
  const completedStepIds = new Set<string>();

  for (const step of FINAL_PLAN_STEPS) {
    const statusPath = `${statusDirectory}/${step.id}.json`;

    if (!(await Bun.file(statusPath).exists())) {
      continue;
    }

    const statusRecord: unknown = await Bun.file(statusPath).json();
    if (typeof statusRecord === 'object' && statusRecord !== null && Reflect.get(statusRecord, 'status') === 'COMPLETED') {
      completedStepIds.add(step.id);
    }
  }

  return completedStepIds;
}

function syncChecklistText(checklistText: string, completedStepIds: ReadonlySet<string>): { readonly checkedCount: number; readonly text: string; readonly uncheckedCount: number; readonly updatedLineCount: number } {
  let checkedCount = 0;
  let uncheckedCount = 0;
  let updatedLineCount = 0;

  const syncedLines = checklistText.split('\n').map((line) => {
    const match = CHECKLIST_LINE_PATTERN.exec(line);
    const stepId = match?.groups?.stepId;

    if (stepId === undefined) {
      return line;
    }

    const desiredPrefix = completedStepIds.has(stepId) ? '- [x]' : '- [ ]';
    const syncedLine = line.replace(/^- \[[ xX]\]/, desiredPrefix);

    if (desiredPrefix === '- [x]') {
      checkedCount += 1;
    } else {
      uncheckedCount += 1;
    }

    if (syncedLine !== line) {
      updatedLineCount += 1;
    }

    return syncedLine;
  });

  return {
    checkedCount,
    text: syncedLines.join('\n'),
    uncheckedCount,
    updatedLineCount,
  };
}

export async function getMasterChecklistSyncResult(options: ChecklistSyncOptions = {}): Promise<ChecklistSyncResult> {
  const checklistPath = options.checklistPath ?? CHECKLIST_PATH_DEFAULT;
  const statusDirectory = options.statusDirectory ?? STATUS_DIRECTORY_DEFAULT;
  const completedStepIds = await readCompletedStepIds(statusDirectory);
  const checklistText = await Bun.file(checklistPath).text();
  const syncedChecklist = syncChecklistText(checklistText, completedStepIds);

  return Object.freeze({
    changed: syncedChecklist.text !== checklistText,
    checkedCount: syncedChecklist.checkedCount,
    checklistPath,
    completedStepIds: Object.freeze([...completedStepIds].sort()),
    totalStepCount: FINAL_PLAN_STEPS.length,
    uncheckedCount: syncedChecklist.uncheckedCount,
    updatedLineCount: syncedChecklist.updatedLineCount,
  } satisfies ChecklistSyncResult);
}

export async function syncMasterChecklist(options: ChecklistSyncOptions = {}): Promise<ChecklistSyncResult> {
  const checklistPath = options.checklistPath ?? CHECKLIST_PATH_DEFAULT;
  const statusDirectory = options.statusDirectory ?? STATUS_DIRECTORY_DEFAULT;
  const completedStepIds = await readCompletedStepIds(statusDirectory);
  const checklistText = await Bun.file(checklistPath).text();
  const syncedChecklist = syncChecklistText(checklistText, completedStepIds);
  const result = Object.freeze({
    changed: syncedChecklist.text !== checklistText,
    checkedCount: syncedChecklist.checkedCount,
    checklistPath,
    completedStepIds: Object.freeze([...completedStepIds].sort()),
    totalStepCount: FINAL_PLAN_STEPS.length,
    uncheckedCount: syncedChecklist.uncheckedCount,
    updatedLineCount: syncedChecklist.updatedLineCount,
  } satisfies ChecklistSyncResult);

  if (result.changed) {
    await Bun.write(checklistPath, syncedChecklist.text);
  }

  return result;
}

if (import.meta.main) {
  const result = await syncMasterChecklist();
  console.log(JSON.stringify(result, null, 2));
}
