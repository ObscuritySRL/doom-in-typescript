# AGENTS

Rules for working in this repository. Follow them exactly.

---

## Runtime

**This project uses Bun. Always.** Bun is the runtime, the package manager, the test runner, and the script executor. There are no exceptions, no "if Bun is installed" fallbacks, and no Node.js paths.

- Use `bun`, `bun install`, `bun add`, `bun run`, `bun test`, `bun build`. Never `npm`, `yarn`, `pnpm`, `npx`, or `node`.
- Prefer Bun-native APIs (`Bun.file`, `Bun.write`, `Bun.serve`, `Bun.argv`, `Bun.env`, `Bun.sleep`, `Bun.spawn`, `bun:test`, `bun:ffi`, `bun:sqlite`, etc.) over Node equivalents whenever both exist.
- Import order: `bun:*` first, then `node:*` standard library, then third-party, then relative imports. Blank line between groups. Separate type imports with `import type`.
- Do not add Node-only tooling, polyfills, or test runners. Do not introduce `ts-node`, `tsx`, `vitest`, `jest`, `mocha`, or similar — `bun` and `bun:test` cover all of it.
- `bun.lock` is the lockfile. Do not commit `package-lock.json`, `yarn.lock`, or `pnpm-lock.yaml`.

Any rule below that mentions "when the project uses Bun" applies here unconditionally.

---

## GitHub and Publishing Authority

- Make repository changes, commits, pushes, and GitHub repository actions as Stev Peifer through the configured human account and repository permissions.
- Do not override `user.name`, `user.email`, commit author, commit committer, or publishing identity to Codex, OpenAI, Claude, or any other AI or agent identity.
- References to tools, models, or agents are allowed when technically relevant, but they are not authors or publishing identities for this repository.
- Use only local Git commands for publishing repository changes. Do not use GitHub apps, GitHub API tools, issue automation, release automation, or pull request workflows unless the human owner explicitly changes this rule.
- When publishing changes, commit and push directly. Do not open pull requests.
- Every completed Ralph-loop step must end with a verified commit and push before the step is considered complete.
- Every audit pass that changes files must end with a verified commit and push before the audit is considered complete. If an audit makes no file changes, do not create an empty commit.

---

## Core Principles

- **Plan before implementing.** Read and understand the problem, the existing code, and the surrounding context before writing anything. Do not guess at what code does — read it.
- **Check available skills first.** Before starting a task, scan the available skills — slash commands, the repo's `.claude/skills/` directory, and any skills surfaced by the harness — for one that applies. Skills encode vetted, project-specific workflows; prefer invoking them over reinventing the approach. If a skill partially fits, use it and note what's missing rather than discarding it.
- **Minimal, surgical diffs.** Change only what is necessary to accomplish the task. Do not "clean up," reformat, or refactor code you were not asked to touch.
- **No fabrication.** Never guess, hallucinate, or fabricate information. If you do not know something, say so. Incorrect information is worse than no information.
- **It is acceptable to fail; it is not acceptable to fake success.** Completing the task is not the goal — being correct is. When the answer is not in context and cannot be found by reading, searching, or running the code, be explicit about it: state clearly that the goal was not achieved, or describe what *is* known, what was tried, and what remains unresolved. The exact wording does not matter — "I don't know," "I wasn't able to determine X," "this cannot be verified from available context," or a precise scoped answer are all fine. What matters is that the user is never left thinking a task succeeded when it did not. Never dress up a guess, a plausible-sounding fabrication, or a half-finished result as a completed task.
- **No fluff.** No unnecessary abstractions, helpers, utilities, or wrapper functions unless explicitly requested. Three similar lines are better than a premature abstraction.
- **Test at every step.** After every meaningful change, verify it works. Run the full test suite when one exists. When no tests exist, smoke-test: run the program, call the function, type-check (`tsc --noEmit`), or otherwise prove the change does not break anything. Do not move on until the current step is verified. Do not leave the codebase in a broken state.
- **Write tests as part of every task — even when not asked.** This project runs a company; untested code is a liability. New behavior needs new tests. Bug fixes need regression tests. Raise testing proactively: if the user gives you a task without mentioning tests, you still bring it up, write them where appropriate, and report test status at the end. If tests are genuinely impractical, name the reason and propose an alternative verification — never skip quietly. See the **Testing** section for specifics.

---

## Style and Formatting

- **Mirror the repo.** Match the language, formatting, naming conventions, and patterns already established in the project. When in doubt, look at neighboring code.
- **Respect tooling config.** Follow whatever Prettier, ESLint, Biome, or other formatter/linter configs exist. Honor inline ignore directives.
- **Alphabetize unordered things.** Sort imports, exports, object keys, enum members, type fields, union members, switch cases, class names, and map/set initializers in ASCIIbetical order (case-sensitive ascending sort where uppercase letters precede lowercase, e.g., `Z` before `a`) — unless order is semantically meaningful.
- **Naming: full words, no abbreviations.** Write `address`, not `addr`. Write `processIdentifier`, not `procId`. Write `modulePath`, not `modPath`. Names must be immediately understandable without surrounding context.
- **Strings and formatting.** Follow the repo's existing convention (single vs. double quotes, semicolons, trailing commas, etc.). Use numeric separators where they improve readability (e.g., `1_000_000`).
- **Comments.** Terse, value-add only. Do not add comments that restate what code already says. Do not add docstrings, comments, or type annotations to code you did not change.

---

## Public API

- **Do not change public API** (export shape, entry points, function signatures, type contracts) without explicit request.
- When adding new API surface:
  - Provide precise TypeScript typings with overloads where appropriate.
  - Keep names stable, descriptive, and consistent with existing conventions.
  - Include one short, runnable example in the JSDoc.

---

## Performance

Profile first; optimize proven hot paths. Do not optimize speculatively.

- Prefer iteration over intermediate collection creation (avoid unnecessary `.map().filter()` chains that create throwaway arrays).
- Hoist constants and invariants out of loops.
- Avoid implicit copies, JSON roundtrips, and large-array spreads inside loops.
- Use bitwise operations only when they demonstrably reduce work *and* remain correct (respect 32-bit limits, signedness, readability).
- Minimize allocations in measured hot paths. Pool objects when profiling justifies it.
- Do not claim "faster" or "more performant" without benchmarks to back it up.

### Bun FFI (`bun:ffi`)

- Reuse `Buffer` / `TypedArray` / `DataView` instances in hot paths.
- Prefer `Buffer.allocUnsafe` where the buffer will be fully written before any read; use zero-filled `Buffer.alloc` when uninitialized memory could be observed (returned, logged, thrown, or shared).
- Never expose uninitialized memory outside the function that allocated it.

---

## Error Handling

- Use the error types already established in the repo. Do not invent new error hierarchies without reason.
- Keep error messages concise and actionable. Include the root cause, not apology prose.
- Do not swallow errors silently. If an error is caught, it must be handled, re-thrown, or explicitly logged.

---

## Documentation

- **JSDoc:** Compact. Include `@param`, `@returns`, and a single runnable `@example` on public methods. Skip JSDoc on private/internal code unless the logic is non-obvious.
- **README examples:** Short, practical, and representative of real usage. Prefer showing the common case.
- Do not create new documentation files (README, CHANGELOG, etc.) unless explicitly requested.

---

## Testing

**This project runs a company. Testing is mandatory, not optional, and it goes beyond "did I break anything." Every task — whether or not the user mentions tests — ends with testing considered, stated, and (where applicable) executed.**

### Write tests as part of the task

- **New behavior requires new tests.** New function, new route, new branch, new error path — write a test that exercises it. Do not wait to be asked. "It compiles" and "I ran it once manually" are not tests.
- **Every bug fix requires a regression test.** Write a test that fails against the broken code and passes against the fix. If you cannot reproduce the bug in a test, you do not yet understand the bug.
- **Cover the happy path and at least one failure mode.** Auth failures, missing fields, boundary values, concurrent calls, invalid input — pick the failures that matter and cover them. A function with only a happy-path test is half-tested.
- **Proactively raise testing when the user does not.** If the user hands you a task without mentioning tests, you bring it up anyway: either write the tests, or — if you believe they are not warranted — name the reason before completing the task. Silence on testing is not acceptable.
- **Always report test status at the end of a task.** State explicitly: (1) what tests were added, (2) what existing tests already cover the change, (3) what — if anything — is not covered and why. Do not leave the user to infer coverage.
- **If a test is impractical, say so explicitly and propose an alternative.** UI flows, third-party APIs, OS-level behavior, and time-dependent code sometimes resist unit tests. When that is the case, propose the next best verification (integration test, smoke script, manual reproduction steps) and execute it — never skip quietly.
- **Do not mark a task "complete" with failing, skipped, or missing tests.** "Complete" means verified. If you cannot verify, the task is not complete and must be reported as such.

### Run tests at every step — non-negotiable

- **Real tests first:** If the project has a test suite, run it after every change. All tests must pass before moving on.
- **Smoke tests when no tests exist:** Run the program, invoke the changed function, execute the build, or type-check (`tsc --noEmit`) — whatever is the fastest way to prove the change works. A smoke test is the minimum bar; never skip it.
- **Do not batch changes.** Verify each step individually before starting the next one. If something breaks, fix it immediately — do not pile more changes on top of a broken state.

### House rules

- Do not add testing frameworks or dependencies the project does not already use.
- Keep test fixtures and example files in whatever directory the project already uses (`test/`, `example/`, `__tests__/`, etc.).
- Remove temporary benchmarks, diagnostic logs, and debugging artifacts before finishing.
- Tests for production code live alongside the code they cover, following the project's existing layout. Do not invent a new test directory structure.

### Bun testing

- Use `bun:test` for tests and `bun test` to run them.
- Do not add Node-only tooling or test runners (no `vitest`, `jest`, `mocha`, `ts-node`, `tsx`).

---

## Benchmarking

- Benchmark when comparing approaches or making performance claims.
- Measure multiple iterations; report median and p99.
- Compare against the existing implementation, not just in isolation.
- Include memory/allocation metrics when relevant.

### Bun benchmarking

- Use `bun` for benchmarks. Prefer `Bun.bench` or `bun:test`'s built-in benchmarking where available.

---

## Commits

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): description
```

- **type**: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`, `build`, `style`
- **scope**: optional, the affected area in parentheses
- **description**: lowercase, imperative mood, no trailing period

Examples:
- `feat(auth): add token refresh`
- `fix: resolve memory leak in parser`
- `perf(cache): reduce allocations in hot path`

### Frequency and Publishing

- **Commit often.** Each meaningful, verified step is a commit. Small, focused, self-contained commits are preferred over large end-of-session dumps.
- **One logical change per commit.** If the description needs "and", split it.
- **Verify before committing.** Tests, type-check, and lint must pass (see Testing). Never commit a known-broken state.
- **Push to GitHub on a reasonable cadence — as often as possible.** At minimum, publish at the end of every working session. An unpushed commit is work that can be lost. Prefer many small pushes over one large one.
- **Never force-push `main`.** For force-pushes on any other branch, confirm with the user first. Never rewrite history that has been shared.
- **Pull before pushing** when the remote may have moved, and resolve conflicts locally rather than bypassing them.

### Attribution

- **All commits are authored by the human owner of this repository (Stev Peifer).** The configured git identity is the source of truth — do not override `user.name` or `user.email`.
- **Do not add AI co-authorship.** Do not append `Co-Authored-By: Claude ...`, `Generated with Claude Code`, `🤖` markers, or any similar attribution to commit messages, PR descriptions, or issue comments.
- **Commit messages must read as human-authored.** No "as an AI", no "I generated", no disclosure prose. Write the message as the author of the change.
- The same rule applies to PR titles, PR bodies, issue comments, and review replies.

---

## Secrets and Configuration

- **Never commit secrets.** API keys, tokens, passwords, private keys, session secrets, database URLs with credentials, and OAuth client secrets must never be staged or committed. This applies to test fixtures and example files as well.
- **Do not stage `.env*` files** (other than committed templates like `.env.example` with placeholder values). If `.env` is not already in `.gitignore`, add it before doing anything else.
- **Stage files explicitly by name.** Avoid `git add -A` / `git add .` — they routinely pick up local-only files, editor state, and credentials.
- **If a secret is ever committed, stop and tell the user immediately.** Do not try to "fix" it by rewriting history silently — the secret must be rotated, and the user decides the recovery path.

---

## Things to Never Do

- **Do not add helpers/utilities** unless explicitly requested.
- **Do not reformat broadly.** Only change formatting on lines you are already modifying.
- **Do not add licenses, headers, or new linters/tooling.**
- **Do not broaden platform support** or add polyfills without request.
- **Do not assume the user is wrong.** Suggest better approaches when you see them, but respect the user's final decision.
- **Do not create `PROGRESS.md`, `TODO.md`, or tracking files** unless explicitly requested.
- **No hacky type casts.** Never use `as unknown as T`, `as any`, or any other cast that bypasses the type system instead of fixing the actual types. If the types do not align, fix the types — add overloads, use generics, narrow with type guards, or restructure. Casting is not a shortcut. *(TypeScript projects)*
- **Do not use shortform variable names** in any circumstance. Every name must be self-documenting.
- **Do not add AI/Claude attribution** to commits, PRs, issues, or code comments. Commits are authored as Stev Peifer and must read as human-authored.
- **Do not commit secrets or `.env` files.** Stage files explicitly by name, never `git add -A`.
- **Do not let work sit unpushed.** Push to GitHub frequently — at minimum by end of session.
- **Do not force-push `main`.** On other branches, confirm before any force-push or history rewrite.
- **Do not ship new or changed behavior without tests.** If tests are genuinely impractical, say so explicitly and propose an alternative verification — never skip silently.
- **Do not finish a task without reporting test status.** Every task ends with an explicit statement of what was added, what was already covered, and what is not covered and why.
- **Do not mark a task complete when tests are failing, skipped, or missing.** "Complete" means verified.

---

## Language and Runtime Conventions

### TypeScript (all projects)

- Separate type imports with `import type`.
- Prefer `#privateField` syntax over `private` keyword for class fields.
- Use explicit `void` when deliberately discarding a return value.
- Strict mode (`"strict": true`) is expected. Do not weaken type safety to make code compile.
- Never use `any` without justification. Prefer `unknown` and narrow with type guards.
- **Never use `as unknown as T` or `as any`.** These are not acceptable under any circumstance. Fix the underlying types instead — add overloads, use generics, narrow with type guards, or restructure the code.
- Prefer `satisfies` over `as` where possible. Use `as const` only for literal narrowing, not as a workaround for bad types.

### Bun

See the top-level **Runtime** section — it is authoritative. Key reminders:

- Use Bun-native APIs where they exist (`Bun.file`, `Bun.write`, `Bun.serve`, `Bun.argv`, `Bun.env`, `Bun.sleep`, `Bun.spawn`, `bun:test`, `bun:sqlite`, etc.).
- Run everything through `bun` — never `npm`, `yarn`, `npx`, `pnpm`, or `node`.
- Import order: `bun:*` → `node:*` → third-party → relative, with a blank line between groups.

### Bun FFI (`bun:ffi`) — Win32 / native interop

- Open DLLs with `dlopen` and declare typed symbols. Verify each FFI declaration individually before building on top of it.
- Use `FFIType.u64` for handles/pointers (returned as `bigint`), `FFIType.u32` for `DWORD`, `FFIType.i32` for `BOOL`, `FFIType.ptr` for buffer pointers.
- Preserve Win32 parameter names as-is in FFI declarations (`hProcess`, `lpBuffer`, `dwSize`, `lpAddress`, etc.) — this is the one exception to the "no abbreviations" rule.
- Windows APIs use UTF-16LE. Encode strings with `Buffer.from(str + '\0', 'utf16le')`. Do not use `CString` from `bun:ffi` for wide strings — it is UTF-8 only.
- `GetProcAddress` takes ANSI (not wide) strings for the function name parameter.
- Handle lifetime is critical: every `OpenProcess`, `CreateToolhelp32Snapshot`, or `CreateRemoteThread` must have a matching `CloseHandle` in a `finally` block. Every `VirtualAllocEx` must have a matching `VirtualFreeEx`.
- Remote pointers from `VirtualAllocEx` are `bigint` values in the target process's address space — never dereference them locally.
- Use hex literals for byte sizes, struct offsets, flags, and Win32 constants (e.g., `0x238`, `0x1000`, `0x0400`).
- Check Bun's GitHub issues if an FFI type combination does not work as expected on the current Bun version.

### React / Frontend (when the project uses React)

- Prefer functional components with hooks over class components.
- Use the existing state management solution in the project (Redux, Zustand, Context, etc.) — do not introduce a new one.
- Keep components small and focused. Extract logic into custom hooks when it improves testability.
- Follow the project's existing file/folder structure for components, hooks, and utilities.
- Respect the project's CSS approach (CSS Modules, Tailwind, styled-components, etc.).

### MySQL

- **Primary key is always `no`.** Every new table's first column is `no` — it is the PK. Do not use `id`, `<table>_id`, UUIDs, or any other name.
- **Every table has a `timestamp` column** of type `TIMESTAMP` with `DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`. Do not substitute `created_at` / `updated_at` pairs, `DATETIME`, or application-managed timestamps.
- These conventions are non-negotiable and apply to every new table, migration, and schema change.

### C / C++ (when the project uses C or C++)

- Follow the existing code style (brace placement, indent width, naming convention).
- Use RAII for resource management. Every allocation must have a corresponding deallocation.
- Prefer the project's existing build system. Do not add CMake to a Makefile project or vice versa.
- Use the project's existing error handling pattern (return codes, exceptions, etc.).

---

## Workflow

1. **Check for a matching skill.** Before anything else, look for a skill that applies to the task (slash commands, `.claude/skills/`, harness-surfaced skills). If one fits, use it.
2. **Read first.** Understand the existing code, structure, and conventions before making changes.
3. **Plan the change.** Identify which files need to be modified and what the minimal diff looks like. If the task cannot be answered from available context and cannot be investigated, stop and be explicit with the user that the goal cannot be achieved (or can only be partially achieved) rather than guessing your way through it.
4. **Implement.** Make the smallest change that accomplishes the goal.
5. **Verify and extend test coverage.** Run the existing test suite and type-check. Write new tests covering any new or changed behavior (happy path + at least one failure mode). For bug fixes, add a regression test. Manually verify the change works as intended. If testing is impractical, state so explicitly and propose an alternative verification.
6. **Clean up.** Remove any temporary code, ensure no unrelated changes snuck in.
7. **Commit.** Conventional Commits format, authored as Stev Peifer, no AI attribution. One logical change per commit.
8. **Push.** Publish to GitHub — at minimum by the end of the session, ideally sooner. Unpushed work is at-risk work.

Ship small, surgical, correct changes — and ship them to the remote.
