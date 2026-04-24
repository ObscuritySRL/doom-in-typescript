# Package Capability Matrix

| package | current role | C1 playable scope |
| --- | --- | --- |
| Bun | runtime, script runner, package manager, test runner | Required. `bun run doom.ts` is the final launch target. |
| @bun-win32/core | Win32 binding support | In scope for host/window/runtime integration. |
| @bun-win32/gdi32 | GDI presentation | In scope for windowed software framebuffer presentation. |
| @bun-win32/kernel32 | Win32 process/system calls | In scope where already needed by host helpers. |
| @bun-win32/user32 | Window/input APIs | In scope for window, message pump, keyboard, mouse, and focus behavior. |
| @bun-win32/winmm | Windows multimedia/audio APIs | In scope for audio host integration where deterministic parity permits. |
| @types/bun | TypeScript types | In scope for Bun typechecking. |
| TypeScript compiler via `bun x tsc` | typecheck command | Required verification command. |

No package in this matrix changes the final runtime target away from `bun run doom.ts`.
