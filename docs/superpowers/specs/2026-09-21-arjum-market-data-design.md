# Arjum Market Data Integration Design

## Goal

Replace HeulaTrade's placeholder and legacy market-data paths with the documented Arjum REST API and a separately deployable singleton running-trade gateway, while preserving the terminal shell, global symbol behavior, Supabase authentication, and workspace model.

## Contract Authority

`docs/collections/HeulaTrade.postman_collection.json` is authoritative for REST URLs, parameters, and response fields. The saved responses define successful response schemas. The collection has no saved error bodies, so errors are classified from HTTP status and Zod boundary failures without assuming provider error fields.

The REST origin is `https://stock.arjum.com`. Provider credentials remain server-only. The collection's exposed key literals must be replaced with `{{api_key}}`, and its Done Details request must be corrected to `/api/done-details`.

## Architecture

Browser requests terminate at authenticated Next.js BFF routes. Those routes call one `lib/market/arjum` adapter, which owns configuration, `x-api-key`, timeouts, abort composition, URL construction, status classification, Zod parsing, and normalization. React components call only the BFF through TanStack Query.

Zustand remains limited to the global symbol, panel layout, panel lock, focus, and serializable panel settings. Provider datasets never enter Zustand.

Realtime is isolated in `services/running-trade-gateway`. One process owns one provider WebSocket authenticated by `X-API-Key`, normalizes `snapshot`, `trade`, and `top5`, and fans out to authenticated browser clients. It applies bounded exponential backoff with jitter and special handling for 4401, 4403, and 4408. The browser never receives either provider key or provider WebSocket URL. REST remains independently deployable on Vercel.

## REST Surface

The BFF exposes `/api/search`, `/api/screener/latest`, `/api/analysis/[code]`, `/api/broker-summary/[code]`, `/api/broker-accumulation/[code]`, `/api/history/[code]`, `/api/seasonal/[code]`, `/api/market-cap`, `/api/financial-statements/[code]`, `/api/insiders/[code]`, `/api/done-details`, and `/api/provider-health`.

Each route validates path and query inputs, requires a valid Supabase user when Supabase is configured, returns normalized JSON, and maps provider failures to stable BFF error codes: `PROVIDER_UNAUTHORIZED`, `RATE_LIMITED`, `PROVIDER_UNAVAILABLE`, `MALFORMED_PROVIDER_RESPONSE`, and `INVALID_REQUEST`.

## Terminal Integration

Commands focus or replace the currently focused panel when possible: `CHART`, `BROKER`, `BACC`, `TAPE`, `FUND`, `INSIDER`, `SEASONAL`, `ANALYSIS`, `SCREENER`, `MKTCAP`, and `LIVE`. A bare ticker changes the global symbol. All symbol panels follow it unless locked.

Search uses the provider autocomplete endpoint. Panels use dense tables, chart panes, heatmaps, recursive financial rows, and compact research text within the existing Axiom terminal tokens. REST freshness is `SNAPSHOT` or `HISTORICAL`, never `LIVE`.

## Realtime States

The internal gateway contract reports `LIVE`, `RECONNECTING`, `MARKET BREAK`, `MARKET CLOSED`, or `OFFLINE`, plus market/session status, tape rows, and Top 5 Active. Close 4401 and 4403 stop automatic reconnects. Close 4408 uses a substantially longer cooldown before bounded retries.

## Testing

Sanitized saved responses become deterministic fixtures. Unit tests cover every Zod boundary, normalizer, URL builder, nested financial transform, broker ordering, seasonality matrix, Done Details action mapping, WebSocket message type, and close policy. BFF tests inject fetch. Playwright intercepts BFF calls and verifies the authenticated terminal workflow without requiring a live credential. Live provider verification is reported separately and is never implied by fixture success.

## Production Constraints

The Next.js application is Vercel-compatible and contains no persistent upstream socket. The gateway is a long-lived service with a health endpoint and an authenticated browser-facing WebSocket. Deployment of that service and live provider verification require the rotated credentials, which are intentionally absent from source control.
