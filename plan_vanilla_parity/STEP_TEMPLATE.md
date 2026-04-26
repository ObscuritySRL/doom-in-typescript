# [ ] STEP <id>: <Title>

## id

<id>

## lane

<lane slug>

## title

<Title>

## goal

<one sentence>

## prerequisites

- <exact prior step ids or none>

## parallel-safe-with

- <lane or step scope>

## write lock

- <exact writable path>

## read-only paths

- <exact path>

## research sources

- <local binary, IWAD, source file, or oracle>

## expected changes

- <exact writable path>

## test files

- <focused bun:test path>

## verification commands

- `bun run format`
- `bun test <focused bun:test path>`
- `bun test`
- `bun x tsc --noEmit --project tsconfig.json`

## completion criteria

- Tests prove the new behavior or audit result.
- Verification passes in order.
- The verified change is committed and pushed directly.

## final evidence

- <machine-verifiable evidence produced by the step>
