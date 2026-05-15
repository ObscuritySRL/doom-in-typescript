import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { describe, expect, test } from 'bun:test';

import { FINAL_PLAN_STEPS } from '../../plan_final/planData.ts';
import { getMasterChecklistSyncResult, syncMasterChecklist } from '../../plan_final/sync-master-checklist.ts';

async function createTemporaryPlanDirectory(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'doom-plan-final-sync-'));
}

describe('plan_final master checklist sync', () => {
  test('marks completed status records checked and leaves blocked records unchecked', async () => {
    const temporaryDirectory = await createTemporaryPlanDirectory();
    const checklistPath = join(temporaryDirectory, 'MASTER_CHECKLIST.md');
    const statusDirectory = join(temporaryDirectory, 'status');

    try {
      await mkdir(statusDirectory, { recursive: true });
      await Bun.write(
        checklistPath,
        [
          '- [ ] `00-001` `create-final-control-center` | lane: `governance` | prereqs: `none` | file: `plan_final/steps/00-001-create-final-control-center.md`',
          '- [ ] `00-002` `reject-manifest-only-final-proof` | lane: `governance` | prereqs: `00-001` | file: `plan_final/steps/00-002-reject-manifest-only-final-proof.md`',
          '- [x] `03-002` `retire-or-redirect-src-main` | lane: `launch-host-input` | prereqs: `03-001` | file: `plan_final/steps/03-002-retire-or-redirect-src-main.md`',
          '',
        ].join('\n'),
      );
      await Bun.write(join(statusDirectory, '00-001.json'), JSON.stringify({ status: 'COMPLETED' }));
      await Bun.write(join(statusDirectory, '03-002.json'), JSON.stringify({ status: 'BLOCKED' }));

      const result = await syncMasterChecklist({ checklistPath, statusDirectory });
      const checklistText = await Bun.file(checklistPath).text();

      expect(result.changed).toBe(true);
      expect(result.checkedCount).toBe(1);
      expect(result.uncheckedCount).toBe(2);
      expect(checklistText).toContain('- [x] `00-001`');
      expect(checklistText).toContain('- [ ] `00-002`');
      expect(checklistText).toContain('- [ ] `03-002`');
    } finally {
      await rm(temporaryDirectory, { force: true, recursive: true });
    }
  });

  test('keeps the repository checklist synchronized with completed status JSON files', async () => {
    const result = await getMasterChecklistSyncResult();

    expect(result.changed).toBe(false);
    expect(result.checkedCount).toBe(result.completedStepIds.length);
    expect(result.totalStepCount).toBe(FINAL_PLAN_STEPS.length);
    expect(result.checkedCount + result.uncheckedCount).toBe(FINAL_PLAN_STEPS.length);
  });
});
