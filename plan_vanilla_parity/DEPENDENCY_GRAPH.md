# Dependency Graph

## Gates

| gate | name | depends on | proof |
| --- | --- | --- | --- |
| G0 | Plan validation | Phase 00 | `bun test plan_vanilla_parity/validate-plan.test.ts` and `bun run plan_vanilla_parity/validate-plan.ts`. |
| G1 | Real clean launch | Launch lane plus WAD discovery | `bun run doom.ts` starts from clean state and reaches title loop. |
| G2 | Title/menu parity | Launch, input, WAD assets, UI, oracle capture | Paired title and menu evidence. |
| G3 | E1M1 entry parity | Core, WAD, map, gameplay, renderer, UI | Paired menu route into E1M1. |
| G4 | Demo-sync parity | Core timing, demo, WAD, renderer, audio | DEMO1/2/3 sync proof. |
| G5 | Save/load parity | Save/load, config, gameplay state, oracle capture | Byte-level save/load comparison. |
| G6 | Full final side-by-side proof | Every runtime lane and oracle family | Clean-launch paired final report with zero default differences. |

## Lane Dependencies

- Reference/oracle capture feeds every acceptance gate.
- Launch/host/window/input gates clean launch, menus, deterministic replay, and final side-by-side execution.
- Core timing/fixed/RNG/demo-sync gates every simulation, demo, save/load, and state hash step.
- WAD/assets/data gates map, renderer, UI, audio, and game mode detection.
- Acceptance/side-by-side replay converges all lanes and cannot mark work complete until live paired execution exists.
