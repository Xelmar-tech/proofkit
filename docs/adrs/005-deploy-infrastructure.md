# ADR-005 — Deploy infrastructure (docs host + npm CI)

- **Status:** Accepted (2026-05-11)
- **Approved by:** team-lead (per Aaron's delegation 2026-05-11)
- **Date:** 2026-05-11
- **Owner:** Aaron (decision); assistant (drafting)
- **Supersedes:** —
- **Superseded by:** —
- **Related:** ADR-001 (pre-push gates), ADR-004 (capsule-factory listing), EPIC.md M5b tickets X-4..X-8

## Context

M5b of the proofkit monorepo migration calls for deploy infrastructure: a public docs site, CI that runs lint+typecheck+test+build on every PR, and an npm publish pipeline triggered by changeset version commits.

The GitHub remote for proofkit is `github.com/Xelmar-tech/proofkit`. This ADR defines the deploy target and CI shape; workflow activation depends on the required repository secrets being configured.

## Decision (proposed)

### Docs host: Cloudflare Pages

Deploy the Fumadocs site (`apps/fumadocs/`) to **Cloudflare Pages** via the Wrangler GitHub Actions integration.

**Rationale:**

| Criterion                  | Cloudflare Pages                       | Vercel               | Netlify               |
| -------------------------- | -------------------------------------- | -------------------- | --------------------- |
| Tanstack Start SSR support | Workers/Functions (Nitro)              | Native               | Netlify Functions     |
| Free tier                  | Unlimited bandwidth + 500 builds/month | 100 GB, 6k build min | 100 GB, 300 build min |
| Custom domain              | Built-in                               | Built-in             | Built-in              |
| GitHub integration         | First-class (Wrangler action)          | First-class          | First-class           |
| Ecosystem fit              | Capxul uses Cloudflare                 | —                    | —                     |

Cloudflare Pages is the default for Capxul infrastructure. The Fumadocs site uses Nitro under the hood (via Tanstack Start), and Nitro has a first-class `cloudflare-pages` preset that deploys SSR routes as Cloudflare Workers/Functions. Build output goes to `.output/` — the same as any Nitro build.

**Custom domain:** deferred. Until DNS is configured, the Cloudflare-generated `*.pages.dev` URL is the public face.

### CI: GitHub Actions

Three workflows under `.github/workflows/`:

#### 1. `ci.yml` — PR checks

Runs on every PR to `main`. Mirrors the local pre-push gate:

```yaml
name: CI
on:
  pull_request:
    branches: [main]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: "pnpm"
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo check-types
      - run: pnpm check
      - run: pnpm turbo test
      - run: pnpm turbo build
```

#### 2. `release.yml` — npm publish

Triggers on pushes to `main` that contain changeset version commits (detected by the changesets action). Publishes `packages/tui-proof-kit` to npm:

```yaml
name: Release
on:
  push:
    branches: [main]

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: "pnpm"
          registry-url: "https://registry.npmjs.org"
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo build
      - uses: changesets/action@v1
        with:
          publish: pnpm release
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
```

#### 3. `docs-deploy.yml` — Docs site deploy to Cloudflare Pages

Deploys the Fumadocs build output to Cloudflare Pages on every push to `main` that touches docs, fumadocs, or shared packages:

```yaml
name: Deploy Docs
on:
  push:
    branches: [main]
    paths:
      - "apps/fumadocs/**"
      - "packages/**"
      - "docs/**"

jobs:
  deploy-docs:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      deployments: write
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: "pnpm"
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter fumadocs build
      - name: Publish to Cloudflare Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy apps/fumadocs/.output --project-name=proofkit-docs

### What we do NOT do

- **No GitHub Pages.** Fumadocs needs edge/serverless functions for search; GH Pages is static-only.
- **No self-host on Capxul-VPS.** Adds ops burden for no gain at this stage. Revisit if Cloudflare Pages free tier is insufficient.
- **No automatic npm publish on every commit.** Only changeset version commits trigger publish.
- **No pre-release / canary channel.** v0.x publishes to `latest`. Canary channel is a future ADR.

### Prerequisites for activation

1. GitHub remote `Xelmar-tech/proofkit` must exist.
2. `NPM_TOKEN` secret added to repo (npm access token with publish permission for `@capxul/tui-test-kit`).
3. Cloudflare Pages project `proofkit-docs` created in the Capxul Cloudflare account.
4. `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets added to the GitHub repo.

## Acceptance criteria

1. Opening a PR against `main` triggers CI: lint + typecheck + test + build all pass (or fail with clear output).
2. Pushing a changeset version commit to `main` triggers the release workflow (dry-run until `NPM_TOKEN` is configured).
3. The docs site is live at the Cloudflare Pages URL (`proofkit-docs.pages.dev` or a custom domain once DNS is set up).
4. `pnpm check` and `pnpm turbo check-types` are clean on `main`.

## Consequences

**Positive**

- PR CI mirrors the local pre-push gate — contributors see the same failures locally.
- Vercel deploy is zero-config after initial project creation.
- Changesets-based publish means human decision for version bumps, automated execution.

**Negative / trade-offs**

- Cloudflare Pages free tier: 500 builds/month, 1 build concurrency. Adequate for docs; if we outgrow it, upgrade is straightforward.
- The Nitro `cloudflare-pages` preset may need explicit configuration in `vite.config.ts` if auto-detection fails. One-time setup.
- The npm publish step requires an `NPM_TOKEN` secret — a manual setup step that can't be automated.

**Neutral**

- Custom domain is deferred. The Cloudflare Pages subdomain is the public face for v0.
- GitHub workflows require repository secrets before release and docs deploy can complete.
```
