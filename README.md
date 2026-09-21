# HeulaTrade

HeulaTrade is a desktop-first IDX research terminal. The Next.js application is the product UI and BFF, Supabase owns authentication and user data, and the Python market adapter reads datasets produced by [`nichsedge/idx-bei`](https://github.com/nichsedge/idx-bei). It does not scrape IDX from Next.js or the browser.

## Local setup

Requirements: Bun 1.3+, Python 3.13 with `uv`, an operating Supabase project, and an `idx-bei` data directory populated by its ingestion jobs. No production market fixtures are bundled.

1. Run `bun install` at the repository root and copy `.env.example` to `.env.local`. Set the Supabase URL and publishable key. Do **not** put the service-role key in a `NEXT_PUBLIC_` variable or the frontend environment.
2. The initial schema migration, `supabase/migrations/20260921002404_initial_schema.sql`, was applied to Supabase project `rdpusflzpfqrdrrcozav` through MCP. Configure email/password and Google Auth as needed, and allow `/auth/callback` as a redirect URL. For a different project, inspect its schema and migration history before deploying migrations.
3. Run the `idx-bei` ingestion and parquet export jobs following its own documentation. Point `IDX_BEI_DATA_DIR` at the resulting data directory; `/ready` requires `parquet/stock_summary.parquet` and `allCompanies.json`. Other adapter routes need `index_summary.parquet`, `financial_ratios.parquet`, `corporate_actions.parquet`, `companyDetailsByKodeEmiten.json`, or a briefing snapshot. Missing files return an explicit unavailable error.
4. In `services/market-api`, run `uv sync --extra test` and `IDX_BEI_DATA_DIR=/absolute/path/to/idx-bei/data uv run uvicorn app:app --host 127.0.0.1 --port 8100`. Keep this service private to the Next.js server. Set `MARKET_API_URL=http://127.0.0.1:8100` in `.env.local`.
5. Run `bun run dev`, then visit `/terminal`. Without Supabase credentials the terminal opens in a configuration-warning mode; persistent user workflows require sign-in.

## Vercel deployment

The Vercel project uses Services: `frontend` is the Next.js UI/BFF and `market-api` is the FastAPI market-data service rooted at `services/market-api`. The Python service entrypoint is `app:app`, from `services/market-api/app.py`.

Configure `MARKET_API_URL` for the frontend service to the routed market service path on the same deployment, for example `https://<deployment-host>/api/market-api`. Configure `IDX_BEI_DATA_DIR` for the `market-api` service to the directory containing the exported `idx-bei` datasets. The Python dependencies are declared in `services/market-api/pyproject.toml` and installed by Vercel from that service root.

For EOD alert evaluation, configure `SUPABASE_SERVICE_ROLE_KEY` and `ALERT_JOB_SECRET` **only on the server**, then schedule a `POST /api/jobs/evaluate-alerts` call with `Authorization: Bearer <ALERT_JOB_SECRET>` after each completed `idx-bei` ingestion. It processes enabled rules against dated normalized market snapshots; a unique `(alert_id, observed_as_of)` key prevents duplicate notifications. Monitor its `failed` and `unavailable` counts. Do not expose the endpoint secret or service key to browsers.

The Python adapter is a read-only normalization boundary. It rejects unsupported fields, preserves null financial values, identifies source files and as-of dates, and never relabels EOD parquet snapshots as live quotes. Provider WebSocket credentials are owned only by the separately deployed running-trade gateway; browsers never connect to the provider directly.

## Verification

- `bun run typecheck`, `bun run lint`, `bun run test`, `bun run build`
- `bun run test:e2e` for terminal browser flows; Playwright needs a local browser and permission to bind a localhost test server.
- `cd services/market-api && uv run --extra test python -m pytest -q` for Python contract tests.
- Apply the canonical migration through an authorized Supabase migration connection, then run `supabase/tests/rls.sql` against a controlled test database. These database checks remain required before production deployment.

## Source limitations and deployment gate

The inspected `idx-bei` API does not provide verified per-security broker transactions, broker concentration, a news feed, or all of the technical and multi-period screener measures in the PRD. Its stock API substitutes missing OHLC values, and its trade-block route creates synthetic trades; HeulaTrade does not use either as ground truth. Those panels/filters are marked **UNAVAILABLE** rather than filled with invented values. Market datasets, legal rights to display them, a Supabase project, a deployed schedule for the alert job, and end-to-end deployment checks are still required for a production release. See [the implementation plan](docs/implementation-plan.md) for the requirements audit.
# heulatrade
