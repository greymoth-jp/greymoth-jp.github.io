# i18n-swarm — real-app evidence corpus

The packed CLI (`i18n-swarm-0.1.0.tgz` -> installed from the tarball -> the real `i18n-swarm` bin, not the source tree) run end to end over a curated set of recognizable English-only Next.js App-Router OSS apps that have no existing i18n. Each row is one unmodified clone: clean `node_modules`, baseline `next build`, then the full pass (extract + classify + rewire components + scaffold next-intl: `next.config` plugin, `i18n/request.ts`, `<NextIntlClientProvider>`), then a fresh install + `next build` to verify. Local only; no PRs were opened to these apps.

## Results — full end-to-end pass

| app | repo | ~stars | Next | comp.files | localizable | HIGH (auto) | auto% | edits applied | corruptions | baseline build | post-i18n build | review queue |
|---|---|--:|--:|--:|--:|--:|--:|--:|:--:|:--:|:--:|--:|
| ts-starter | theodorusclarence/ts-nextjs-tailwind-starter | 3.4k | 15 | 18 | 88 | 84 | 95.5% | 84 | **0** | green | **green** | 54 |
| dillion-portfolio | dillionverma/portfolio | 1.4k | 16 | 52 | 35 | 26 | 74.3% | 18 | **0** | green | **green** | 43 |
| adm-dashboard | arhamkhnz/next-shadcn-admin-dashboard | 2.6k | 16 | 228 | 982 | 763 | 77.7% | 670 | **0** | green | **green** | 991 |
| kiran-dashboard | Kiranism/next-shadcn-dashboard-starter | 6.6k | 16 | 212 | 425 | 334 | 78.6% | 320 | **0** | green | **green** | 419 |
| leerob | leerob/leerob.io | 7.6k | 16 | 2 | 0 | 0 | 0% | 0 | **0** | green | **green** | 0 |
| platforms | vercel/platforms | 6.7k | 15 | 14 | 14 | 12 | 85.7% | 12 | **0** | green | **green** | 14 |
| magicui | magicuidesign/magicui | 21.4k | 15 | 336 | 339 | 264 | 77.9% | 242 | **0** | green | **green** | 347 |
| commerce | vercel/commerce | 14.1k | 15 | 45 | 43 | 21 | 48.8% | 21 | **0** | green | **green** | 42 |

### Aggregate over the 8 end-to-end apps

- TOTAL corruptions across all apps: **0**
- post-i18n `next build` green: **8/8** (100%)
- average auto-handled% (apps with localizable strings): **76.9%**
- total rewrite edits applied: 1447 (skipped: 0)
- total localizable strings classified: 2230 (HIGH 1588 / AMBIGUOUS-to-review 642)

## Out of scope (honest — where a single-dir `npx` run cannot reach a build)

| app | repo | ~stars | why it is not end-to-end | rewrite corruptions |
|---|---|--:|---|:--:|
| ai-chatbot | vercel/ai-chatbot | 20.6k | build needs AUTH_SECRET + Postgres and the build script is a Playwright e2e suite -> cannot run headless without secrets | **0** |
| novel | steven-tey/novel | 16.3k | pnpm monorepo app: workspace:* deps -> npm install returns EUNSUPPORTEDPROTOCOL on a single-dir install | **0** |

Even on these two, the classifier + rewrite still ran on the real source with **0 corruptions** (68 and 12 edits respectively); only the build/verify gate could not be reached without secrets / a workspace install.

## Per-app notes

- **ts-starter** (theodorusclarence/ts-nextjs-tailwind-starter) — popular TS+Tailwind starter; React 19 + @testing-library peer clash needs the loose-install fallback
- **dillion-portfolio** (dillionverma/portfolio) — Magic UI portfolio template
- **adm-dashboard** (arhamkhnz/next-shadcn-admin-dashboard) — largest target: 228 component files, recharts/shadcn admin dashboard
- **kiran-dashboard** (Kiranism/next-shadcn-dashboard-starter) — shadcn dashboard starter; Sentry + Turbopack config
- **leerob** (leerob/leerob.io) — content-first repo: 2 components, no clean UI labels -> 0 auto-wirable strings (correctly does nothing, still builds green)
- **platforms** (vercel/platforms) — Vercel multi-tenant platforms starter
- **magicui** (magicuidesign/magicui) — Magic UI marketing + docs site (monorepo app apps/www)
- **commerce** (vercel/commerce) — Next.js Commerce; canary Next, needs the loose-install fallback
- **ai-chatbot** (vercel/ai-chatbot) — build needs AUTH_SECRET + Postgres and the build script is a Playwright e2e suite -> cannot run headless without secrets
- **novel** (steven-tey/novel) — pnpm monorepo app: workspace:* deps -> npm install returns EUNSUPPORTEDPROTOCOL on a single-dir install

## What the corpus surfaced about the tool itself (v0 -> fixed)

Running the published v0 on real apps caught two install/scaffold gaps that the original 2-app demo did not:

1. **Stale next-intl pin.** v0 scaffolded `next-intl@^3.26.0`, whose peer range stops at Next 15; every Next 16 app ERESOLVEd on the post-i18n install. Fixed to `^4.0.0` (next-intl v4 peers Next 12-16). This also fixed kiran-dashboard's runtime "Couldn't find next-intl config file" prerender error.
2. **Strict-only install.** v0 installed strictly, so real repos mid-migration to React 19 / Next 16 (with their own stale devDep peer ranges) failed before the build gate could run. Now: strict first (keeps npm's peer auto-install, e.g. recharts -> react-is), and only fall back to `--legacy-peer-deps` when strict resolution itself ERESOLVEs. The build remains the trust signal.

The rewrite engine itself needed no change: corruptions were 0 across all 10 apps in every run, including the v0 run.
