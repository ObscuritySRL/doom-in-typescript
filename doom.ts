// Vanilla DOOM 1.9 parity Bun entrypoint.
//
// `bun run doom.ts` is the canonical runtime target for the vanilla DOOM 1.9
// parity rebuild. Under the owner-authorized plan supersession (plan_final
// supersedes plan_vanilla_parity and plan_fps), this root entrypoint is wired
// to the real vanilla `D_DoomMain` surface in `src/vanilla/runDoomMain.ts`
// instead of remaining an `export {}` skeleton. The forwarded argv is the
// process argument vector with the `bun` and script-path prefixes removed, so
// `bun run doom.ts -iwad doom/DOOM1.WAD -skill 3` flows the vanilla command
// line straight into `runDoomMain`.
import { runDoomMain } from './src/vanilla/runDoomMain.ts';

await runDoomMain(Bun.argv.slice(2));
