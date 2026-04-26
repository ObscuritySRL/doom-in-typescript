# Ralph Loop Prompt

Continue the Ralph loop using `plan_vanilla_parity/` as the only active planning and execution control center. Treat `plan_engine/` and `plan_fps/` as prior art only.

Select exactly one step unless a human explicitly starts coordinated parallel lane work. Choose the first unchecked step in `MASTER_CHECKLIST.md` whose prerequisites are complete.

Before editing, read the selected step file and only the paths listed in its read-only paths section. Change only paths listed in its write lock and expected changes, plus required plan control updates.

Every implementation step must add or update tests. If behavior cannot be verified from local binaries, IWAD data, id Software source, or Chocolate Doom source, create or update an oracle-capture step instead of guessing.

Verification order is fixed: `bun run format`, focused `bun test <path>`, `bun test`, and `bun x tsc --noEmit --project tsconfig.json`.

After verification passes, stage files explicitly by path, commit with Conventional Commits, and push the current branch directly with local git commands. Do not open a pull request and do not use GitHub API or app tools.
