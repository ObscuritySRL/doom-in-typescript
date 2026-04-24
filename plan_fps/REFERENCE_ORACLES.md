# Reference Oracles

## Authority Order

1. Local original DOS binary if present and usable.
2. Local IWAD/data files.
3. Local Windows DOOM.EXE or Chocolate Doom oracle only where appropriate.
4. Upstream Chocolate Doom source as secondary behavioral reference.
5. Community documentation for orientation only.

## Local References

| id | path | role |
| --- | --- | --- |
| OR-FPS-001 | `doom/DOOMD.EXE` | local DOS binary authority when usable |
| OR-FPS-002 | `doom/DOOM.EXE` | local Windows/Chocolate Doom practical oracle |
| OR-FPS-003 | `doom/DOOM1.WAD` | local shareware IWAD data |
| OR-FPS-004 | `iwad/DOOM1.WAD` | local IWAD copy |
| OR-FPS-005 | `reference/manifests/` | prior derived manifests |

## Planned Oracle Artifact Roots

- `test/oracles/fixtures/`
- `test/parity/fixtures/`
- `plan_fps/manifests/`

Do not write oracle artifacts inside `doom/`, `iwad/`, or `reference/`.
