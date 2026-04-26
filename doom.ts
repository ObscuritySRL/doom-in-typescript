// Vanilla DOOM 1.9 parity Bun entrypoint.
//
// `plan_vanilla_parity/establish-vanilla-parity-control-center.md` pins
// `bun run doom.ts` as the canonical runtime target for the vanilla DOOM 1.9
// parity rebuild. Step 03-001 of the launch lane creates this file as the
// skeleton entrypoint so `bun run doom.ts` resolves and exits cleanly from
// this point forward. Subsequent launch-lane steps (03-002 onward)
// progressively implement vanilla command-line parsing, IWAD discovery,
// `D_DoomMain` init order, the `D_DoomLoop` per-frame schedule, and clean
// quit semantics. No simulation, no rendering, and no audio side effects
// are wired in by 03-001.
export {};
