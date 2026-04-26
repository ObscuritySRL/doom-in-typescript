# Reference Oracles

Oracle artifacts must be generated under writable paths such as `test/vanilla_parity/oracles/`, `test/oracles/fixtures/`, `test/vanilla_parity/acceptance/`, or `plan_vanilla_parity/final-gates/`. Never write inside `doom/`, `iwad/`, or `reference/`. If behavior cannot be verified, add an oracle-capture step.

| id | family | minimum evidence |
| --- | --- | --- |
| OR-VP-001 | Clean launch | Paired implementation/reference launch logs and startup state from clean sandbox. |
| OR-VP-002 | Input stream | Shared deterministic keyboard and mouse stream, with hash and injection transcript. |
| OR-VP-003 | Framebuffer | 320x200 indexed framebuffer captures and hashes at required points. |
| OR-VP-004 | State | Deterministic state snapshots covering tic, RNG, gamestate, player, map, thinkers, and specials. |
| OR-VP-005 | Audio | SFX mixer windows and hashes with source event transcript. |
| OR-VP-006 | Music | MUS/OPL event log and timing comparison. |
| OR-VP-007 | Menus | Menu transition and rendering transcript from clean launch. |
| OR-VP-008 | Levels | Level transition transcript including E1M1 start and E1 exits. |
| OR-VP-009 | Save/load | Byte-level save and load roundtrip comparison. |
| OR-VP-010 | Demos | DEMO1, DEMO2, and DEMO3 playback sync through termination. |
| OR-VP-011 | Full playthrough | Full shareware episode route with state, video, audio, and transition evidence. |
| OR-VP-012 | Final side by side | Clean-launch paired run using the same input stream and zero default allowed differences. |
