# Parallel Work

| lane | what can proceed immediately | blocked by | owns | must not touch |
| --- | --- | --- | --- | --- |
| governance | immediate where prerequisites allow | Plan governance prerequisites and shared interfaces | plan_vanilla_parity/README.md; plan_vanilla_parity/PROMPT.md; plan_vanilla_parity/PRE_PROMPT.md; plan_vanilla_parity/MASTER_CHECKLIST.md; plan_vanilla_parity/STEP_TEMPLATE.md; plan_vanilla_parity/SOURCE_CATALOG.md; plan_vanilla_parity/REFERENCE_ORACLES.md; plan_vanilla_parity/DEPENDENCY_GRAPH.md; plan_vanilla_parity/PARALLEL_WORK.md; plan_vanilla_parity/RISK_REGISTER.md; plan_vanilla_parity/validate-plan.ts; plan_vanilla_parity/validate-plan.test.ts; plan_vanilla_parity/steps/; test/plan_vanilla_parity/ | doom/; iwad/; reference/ |
| inventory | immediate where prerequisites allow | Current-state inventory prerequisites and shared interfaces | plan_vanilla_parity/current-state/; test/vanilla_parity/current-state/ | doom/; iwad/; reference/ |
| oracle | immediate where prerequisites allow | Reference/oracle capture prerequisites and shared interfaces | tools/reference/; test/oracles/fixtures/; test/vanilla_parity/oracles/ | doom/; iwad/; reference/ |
| launch | immediate where prerequisites allow | Launch/host/window/input prerequisites and shared interfaces | doom.ts; src/bootstrap/; src/host/; src/input/; test/vanilla_parity/launch/ | doom/; iwad/; reference/ |
| core | immediate where prerequisites allow | Core timing/fixed/RNG/demo-sync prerequisites and shared interfaces | src/core/; src/demo/; src/mainLoop.ts; test/vanilla_parity/core/ | doom/; iwad/; reference/ |
| wad | immediate where prerequisites allow | WAD/assets/data prerequisites and shared interfaces | src/wad/; src/assets/; test/vanilla_parity/wad/ | doom/; iwad/; reference/ |
| map | immediate where prerequisites allow | Map/BSP/blockmap/collision prerequisites and shared interfaces | src/map/; src/world/; test/vanilla_parity/map/ | doom/; iwad/; reference/ |
| gameplay | immediate where prerequisites allow | Gameplay/player/weapons/items prerequisites and shared interfaces | src/player/; test/vanilla_parity/player/ | doom/; iwad/; reference/ |
| ai | immediate where prerequisites allow | AI/monster/boss/specials prerequisites and shared interfaces | src/ai/; src/specials/; test/vanilla_parity/ai/ | doom/; iwad/; reference/ |
| render | immediate where prerequisites allow | Renderer/world/sprites/status-bar/automap prerequisites and shared interfaces | src/render/; src/ui/statusBar.ts; src/ui/automap.ts; test/vanilla_parity/render/ | doom/; iwad/; reference/ |
| ui | immediate where prerequisites allow | UI/menus/intermission/finale/HUD prerequisites and shared interfaces | src/ui/menus.ts; src/ui/frontEndSequence.ts; src/ui/intermission.ts; src/ui/finale.ts; src/ui/hudMessages.ts; src/ui/endoom.ts; test/vanilla_parity/ui/ | doom/; iwad/; reference/ |
| audio | immediate where prerequisites allow | Audio/SFX/MUS/OPL/mixer prerequisites and shared interfaces | src/audio/; test/vanilla_parity/audio/ | doom/; iwad/; reference/ |
| save | immediate where prerequisites allow | Save/load/config prerequisites and shared interfaces | src/save/; src/config/; test/vanilla_parity/save/ | doom/; iwad/; reference/ |
| acceptance | blocked until runtime lanes converge | Acceptance/side-by-side replay prerequisites and shared interfaces | src/oracles/; test/parity/; test/vanilla_parity/acceptance/; plan_vanilla_parity/final-gates/ | doom/; iwad/; reference/ |

Merge checkpoints: G0 plan validation, G1 real clean launch, G2 title/menu parity, G3 E1M1 entry parity, G4 demo-sync parity, G5 save/load parity, G6 full final side-by-side proof.
