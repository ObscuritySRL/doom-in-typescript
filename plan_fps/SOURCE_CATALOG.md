# Source Catalog

| id | source | kind | authority | path_or_url | notes |
| --- | --- | --- | --- | --- | --- |
| S-FPS-001 | old plan prompt | file | prior-art | `plan_engine/PROMPT.md` | Prior Ralph-loop prompt, not active for playable parity. |
| S-FPS-002 | old master checklist | file | prior-art | `plan_engine/MASTER_CHECKLIST.md` | Completed mixed engine/playable plan. |
| S-FPS-003 | old decision log | file | prior-art | `plan_engine/DECISION_LOG.md` | Prior durable decisions. |
| S-FPS-004 | local Windows executable | file | local-secondary-binary | `doom/DOOM.EXE` | Practical local reference where appropriate. |
| S-FPS-005 | local DOS executable | file | local-primary-binary | `doom/DOOMD.EXE` | Preferred local binary authority when usable. |
| S-FPS-006 | local IWAD | file | local-primary-data | `doom/DOOM1.WAD` | Shareware IWAD data. |
| S-FPS-007 | copied IWAD | file | local-data | `iwad/DOOM1.WAD` | Local data path already present in this workspace. |
| S-FPS-008 | prior manifests | directory | prior-art | `reference/manifests/` | Existing derived manifests, read-only for plan purposes. |
| S-FPS-009 | package manifest | file | local-primary | `package.json` | Bun package and dependency inventory. |
| S-FPS-010 | TypeScript config | file | local-primary | `tsconfig.json` | Typecheck target for step verification. |
| S-FPS-011 | current launcher entry | file | local-primary | `src/main.ts` | Current launcher surface, not the final requested `doom.ts` command. |
| S-FPS-012 | Chocolate Doom upstream | repository | upstream-secondary | `https://github.com/chocolate-doom/chocolate-doom` | Secondary behavioral source when local references are insufficient. |
| S-FPS-013 | DoomWiki | documentation | community-orientation | `https://doomwiki.org` | Orientation only; never final authority over local references. |
