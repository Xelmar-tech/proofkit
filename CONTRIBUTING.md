# Contributing

Thanks for helping improve Proofkit.

## Local Setup

```bash
pnpm install
pnpm test
pnpm build
pnpm check
pnpm check-types
```

Proofkit requires Node.js 22 or newer. The package depends on `node-pty`, so
you also need a native build toolchain available locally.

## Before Opening a Pull Request

Run the same checks CI runs:

```bash
pnpm turbo check-types
pnpm check
pnpm turbo test
pnpm turbo build
```

For documentation-only changes, run the docs build when the docs app changed:

```bash
pnpm --filter fumadocs build
```

## Changesets

User-facing package changes need a Changeset:

```bash
pnpm changeset
```

Use `patch` for fixes, `minor` for new public functionality, and `major` for
breaking API changes.

## Project Conventions

- Keep changes focused on the behavior being fixed or added.
- Prefer small proofs and tests that encode the reason a behavior matters.
- Update docs when public APIs, actions, report output, or setup requirements
  change.
- Do not commit generated evidence directories unless the change intentionally
  updates canonical fixtures.

## Pull Requests

Use a concise Conventional Commit style title, for example:

```text
fix(driver): wait for terminal redraw before snapshot
docs(readme): explain generated evidence output
```
