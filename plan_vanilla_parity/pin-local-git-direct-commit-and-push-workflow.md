# Pin Local Git Direct Commit And Push Workflow

This document pins the local-only git commit-and-push workflow that every Ralph-loop step in the vanilla DOOM 1.9 parity rebuild must follow when publishing changes. It freezes the canonical Conventional Commits format from `AGENTS.md`, the canonical commit-author identity from `AGENTS.md` and `CLAUDE.md` (`Stev Peifer` only, no `Co-Authored-By: Claude`, no AI attribution), the canonical explicit-stage-by-path rule from `AGENTS.md` and `CLAUDE.md` (forbids `git add -A` and `git add .`), the canonical local-only publishing rule from `AGENTS.md` and `CLAUDE.md` (forbids GitHub apps, GitHub API tools, GitHub PR workflows, the `gh` CLI), the canonical verify-before-commit rule (`bun run format`, focused `bun test <path>`, full `bun test`, `bun x tsc --noEmit --project tsconfig.json` in that fixed order), the canonical commit-and-push-cadence rule that every verified Ralph-loop step ends with one commit and one direct push to the current branch, and the canonical push-failure rule that an unverified or unpushed step must not be marked complete. Any future change to these invariants must update this document and its focused test in lockstep.

## scope name

vanilla DOOM 1.9 local git direct commit and push workflow

## emulated vanilla version

1.9

## reference engine

Chocolate Doom

## reference engine version

2.2.1

## conventional commits format

The commit message header must follow `type(scope): description` exactly as pinned by `AGENTS.md`. The `type` token must be one of `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`, `build`, or `style`. The `(scope)` group is optional and names the affected area in parentheses. The `description` must be lowercase, written in imperative mood, and must not end with a trailing period. Each commit must describe one logical change; if the description needs `and`, the commit must be split.

## conventional commit types

- build
- chore
- ci
- docs
- feat
- fix
- perf
- refactor
- style
- test

## commit author identity

Every commit on this repository is authored by the human owner Stev Peifer. The configured local git identity (`user.name`, `user.email`) is the source of truth and must not be overridden to an AI, agent, bot, or service account. Forward Ralph-loop agents must not add `Co-Authored-By: Claude`, `Co-Authored-By: Codex`, `Co-Authored-By: GPT`, `Generated with Claude Code`, `Generated with Codex`, or any similar AI attribution trailer to commit messages, PR descriptions, or issue comments. Commit messages must read as human-authored prose without disclosure language such as "as an AI", "I generated", or robot emoji markers. The same identity rule applies to PR titles, PR bodies, issue comments, and review replies.

## forbidden commit attribution markers

- Co-Authored-By: Claude
- Co-Authored-By: Codex
- Co-Authored-By: GPT
- Generated with Claude Code
- Generated with Codex
- 🤖

## explicit stage by path rule

Every Ralph-loop step must stage files explicitly by path with `git add <path>` and must never stage with `git add -A`, `git add .`, `git add --all`, `git commit -a`, or `git commit --all`. The wildcard staging variants are forbidden because they routinely pick up local-only files, editor scratch state, gitignored proprietary assets under `doom/` and `iwad/`, lane lock files under `plan_vanilla_parity/lane_locks/`, response logs under `plan_vanilla_parity/loop_logs/`, sandbox snapshots under `.sandboxes/`, and credentials. The same prohibition covers `.env*` files except for committed templates with placeholder values.

## forbidden git stage commands

- git add --all
- git add -A
- git add .
- git commit --all
- git commit -a

## local only publishing rule

Every Ralph-loop step must publish only with local git commands. Forward Ralph-loop agents must not invoke `gh`, the GitHub REST or GraphQL API, GitHub apps, GitHub Actions workflow dispatch, GitHub issue automation, GitHub release automation, GitHub PR creation, GitHub PR review, or any other API-based publishing tooling. The pull request workflow itself is forbidden: a verified step ends with `git push` to the current branch, never with `gh pr create` or any equivalent. The only sanctioned commands for publishing repository changes are `git add <path>`, `git commit`, and `git push`.

## forbidden publishing tools

- gh api
- gh issue
- gh pr
- gh release
- gh workflow

## sanctioned publishing commands

- git add <path>
- git commit
- git push

## verify before commit rule

Every Ralph-loop step must run the four canonical verification commands in the fixed order pinned by `AGENTS.md` and the `plan_vanilla_parity/PROMPT.md` Ralph-loop prompt before staging any file: first `bun run format`, then the focused `bun test <path>` that exercises the step's own write-locked test file, then the full `bun test`, then `bun x tsc --noEmit --project tsconfig.json`. The step must not commit or push if any one of those four commands fails, exits non-zero, or reports a failing test, a skipped test left as a placeholder, or a typecheck error. A known-broken state must not be committed.

## verification command order

- bun run format
- bun test <path>
- bun test
- bun x tsc --noEmit --project tsconfig.json

## commit and push cadence rule

Every verified Ralph-loop step ends with exactly one Conventional Commit and exactly one `git push` to the current branch before the step is considered complete. An unpushed commit is at-risk work. Forward Ralph-loop agents must push after every step, not batch multiple steps into one push at session end. If `git push` fails for any reason (network error, non-fast-forward, hook failure, lease conflict), the agent must report the blocker, leave the step unmarked, and must not declare the Ralph-loop turn successful.

## push failure rule

If `git push` fails, the Ralph-loop step is incomplete. The agent must not mark the row in `plan_vanilla_parity/MASTER_CHECKLIST.md` as `[x]`, must not write a `status: completed` entry to `plan_vanilla_parity/HANDOFF_LOG.md`, and must not return `RLP_STATUS: COMPLETED` in its status block. The agent reports the underlying push blocker (e.g., remote-rejected, non-fast-forward, hook failure) and either resolves it locally or returns `RLP_STATUS: BLOCKED` with the blocker named.

## branch policy rule

Forward Ralph-loop agents push to the current branch only. They must not force-push `main` under any circumstance. They must not rewrite shared history (no `git rebase --interactive`, no `git push --force` to a branch other lanes are working on, no `git filter-branch` or `git filter-repo` on shared history). On a non-main feature branch, force-pushing requires explicit human owner confirmation.

## evidence locations

- AGENTS.md
- CLAUDE.md
- plan_vanilla_parity/PROMPT.md
- plan_vanilla_parity/README.md

## acceptance phrasing

Every verified Ralph-loop step ends with a Conventional Commit and a direct `git push` to the current branch; no pull requests are opened and no GitHub API tools are used.
