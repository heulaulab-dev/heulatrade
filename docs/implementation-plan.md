# HeulaTrade implementation plan

Sources: `HeulaTrade-PRD.md` (all sections), `DESIGN.md` (canonical visual language), and the upstream `nichsedge/idx-bei` README and `python/src/idx/api.py` on `main` inspected 2026-09-21.

## Contracts and risks

- The upstream FastAPI service exposes `/health`, `/api/companies`, `/api/stock/{ticker}`, `/api/broker-flow`, `/api/signals`, `/api/drift`, `/api/system/ingestion-status`, and `/ws/stream`. It does **not** expose every per-security endpoint described by the PRD.
- `/api/stock/{ticker}` substitutes close for missing OHLC fields and zero for missing volume. Its records must be treated as untrusted until independently normalized against source fields. `/api/stock/{ticker}/blocks` synthesizes trades and is excluded. The upstream SQL, ingestion, and broadcast routes are privileged and must never be proxied to browsers.
- Public deployment also depends on an operating Python service with ingested datasets, Supabase project credentials, and a data-rights review. Missing dependencies produce explicit UNAVAILABLE states.

## Implementation sequence

1. Establish Bun/Next.js 16/TypeScript/Tailwind, canonical design tokens, lint, typecheck, Vitest, and Playwright.
2. Build a Python normalization service over `idx-bei`'s persisted snapshots and parquet datasets, then validate its product contracts with Zod at the Next.js BFF boundary. Preserve nulls, attach source/as-of/freshness metadata, and expose bounded BFF routes only. Add contract tests.
3. Create Supabase migrations for every PRD user and application table, constraints, indexes, triggers, RLS, storage policies, and Realtime publication. Add cross-user/anonymous RLS tests. Build typed SSR/browser clients and authentication screens with email, Google, refresh, and sign-out.
4. Implement terminal state and command registry: symbol context, panel locks, parsed commands, autocomplete, shortcuts, split/resize/maximize/restore/replace/close/refresh, and saved workspaces. Add unit and interaction tests.
5. Implement market panels with independent loading/error/empty/stale states: overview, securities, watchlists, charts and indicators, broker flow, foreign flow, fundamentals and history, profile, ownership, actions, signals, screeners, news, and announcements. Use virtualized tables and visible provenance. When the source lacks a contract, show UNAVAILABLE rather than invented figures.
6. Implement user workflows: watchlists, screeners, portfolios and transaction-derived calculations, alerts, notifications, preferences, exports, and cross-device Realtime invalidation.
7. Add market WebSocket state, health/readiness, request IDs, rate limiting, freshness and trading-calendar checks, and data-health visibility.
8. Run unit, integration, contract, RLS, and critical Playwright tests, then lint, typecheck, and production build. Fix all failures. Verify the PRD canonical flow against a configured Supabase instance and populated Python engine.

## Acceptance matrix

| PRD area | Implementation target | Verification |
| --- | --- | --- |
| 1–10, 47, 54–58, 68–76, 84–86 | Three-service boundary, typed BFF, SSR auth, health, provenance, safety | Contract, API, deployment checks |
| 11–17, 38, 43–46, 65–67 | Migrations, user CRUD, RLS, derived portfolio state | RLS and calculation tests |
| 18–26, 53, 64, 77, 81 | Terminal, commands, panels, workspaces, responsive keyboard UX | Unit, interaction, E2E |
| 27–37, 39–42 | Market research panels and screening | Contract, integration, E2E |
| 48–52, 59–63, 69–71, 78–83 | DESIGN.md tokens, formatting, states, test gates, canonical flow | Visual review, tests, build |

## Review focus

- Missing financial fields remain null and render as unavailable, never zero.
- A locked panel retains its symbol through global symbol changes and workspace restore.
- User A cannot access or mutate User B's records through direct Supabase queries.
- A stale response retains its source and as-of timestamp and never displays LIVE.
- Source schema drift fails the relevant panel with a safe error while other panels remain usable.

## Execution status and release blockers

Implemented: Bun/Next.js shell, DESIGN.md terminal styling, command registry, symbol context and locking, split/resize/maximize panels, saved workspace RPC, Supabase auth, user-data migration and RLS policies, Python normalization API, market/foreign/chart/fundamental/profile/action/signal panels, a source-backed composable screener with saved filters and virtualized results, watchlists, transaction-derived portfolio view, alert definitions and notifications, source/freshness display, and automated unit/contract/browser checks.

Not yet production-complete: the upstream source provides no trustworthy per-security broker tape, news/announcements feed, historical ownership snapshots, or inputs for broker and technical screener predicates. The current chart supports candles/line/area and EMA overlays but not every PRD mode or indicator. Column resizing, all watchlist and portfolio management operations, storage export workflows, full preferences, and all requested integration coverage are also outstanding. An alert-evaluation endpoint is implemented but still needs a deployed EOD schedule and a real Supabase end-to-end test. Supabase migrations and RLS tests have not been executed against a real database because Docker integration and project credentials are unavailable here. A populated `idx-bei` dataset and market-data distribution-rights review are external release prerequisites. Therefore passing local checks does not imply the full PRD acceptance gate has been met.
