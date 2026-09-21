# Arjum Market Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver every documented Arjum REST capability through typed BFF routes and terminal panels, plus an isolated singleton running-trade gateway.

**Architecture:** A server-only Zod adapter normalizes provider responses for authenticated Next.js BFF routes. TanStack Query feeds existing terminal panels; Zustand retains UI state only. A separate long-lived service owns the sole provider WebSocket.

**Tech Stack:** Next.js 16, React 19, TypeScript, Zod, TanStack Query, Zustand, Lightweight Charts, Supabase SSR, Bun, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-21-arjum-market-data-design.md`

## Global Constraints

- The Postman collection is the REST contract authority; do not invent endpoints or fields.
- Provider secrets are server-only and never use a `NEXT_PUBLIC_` name.
- Preserve the current terminal shell and user-owned uncommitted changes.
- REST data stays in TanStack Query; Zustand stores terminal UI state only.
- REST deployment must not depend on the realtime gateway.

## Review Focus

- Provider returns valid JSON with a changed field type: reject it as malformed without crashing other panels.
- Optional query values are absent: omit them rather than sending `undefined` or empty provider parameters.
- A panel changes global symbol while another is locked: only unlocked symbol panels follow.
- 429 and provider authentication failures: show distinct independent panel states.
- Upstream WebSocket closes with 4408: avoid aggressive reconnect and preserve downstream status.

---

### Task 1: Contract sanitation and adapter core

**Files:** Create `lib/market/arjum/{contracts,schemas,errors,client,queries,normalizers,websocket}.ts`; create sanitized fixtures and `tests/arjum-contracts.test.ts`; modify the Postman collection and env examples.

**Interfaces:** Produces typed request option objects, normalized response types, `ArjumClient`, URL builders, response normalizers, and WebSocket normalization/close policy.

- [ ] Write failing fixture, schema, URL, error, transform, and WebSocket contract tests.
- [ ] Run `bun run test tests/arjum-contracts.test.ts` and confirm missing-module failures.
- [ ] Implement the minimal adapter and transformations.
- [ ] Re-run the focused test and full unit suite.

### Task 2: Authenticated BFF routes and browser query layer

**Files:** Create exact routes under `app/api`; create `lib/api/market-client.ts`; create `tests/arjum-bff.test.ts`.

**Interfaces:** Consumes `ArjumClient`; produces stable normalized BFF JSON and typed browser query functions with complete query keys.

- [ ] Write failing route/auth/error mapping and browser URL tests.
- [ ] Confirm failures, implement shared route helpers and all documented routes, then pass focused and full tests.

### Task 3: Command registry, global search, and REST panels

**Files:** Modify registry/store/terminal dispatch; create focused panel modules for chart, broker, accumulation, seasonality, market cap, financials, insiders, tape, analysis, and provider screener; update panel status and chart code; add transform/component tests.

**Interfaces:** Consumes browser queries; produces all requested command-to-panel workflows while preserving global symbol locking.

- [ ] Write failing command, transform, and panel-state tests.
- [ ] Confirm failures, implement panels and focus/replace dispatch, then pass focused and full tests.

### Task 4: Isolated running-trade gateway

**Files:** Create `services/running-trade-gateway/` entrypoint and documentation; remove direct provider browser socket code; create gateway lifecycle tests.

**Interfaces:** Consumes WebSocket normalizers/close policy; produces one upstream connection and authenticated normalized fanout.

- [ ] Write failing singleton, auth, fanout, and reconnect-policy tests.
- [ ] Confirm failures, implement the long-lived service abstraction, then pass focused and full tests.

### Task 5: Critical E2E and production verification

**Files:** Add sanitized Playwright fixtures and expand `tests/e2e/terminal.spec.ts`; update operational documentation.

**Interfaces:** Exercises login/terminal/search/chart/broker/accumulation/financials/insiders/tape history across BFF boundaries.

- [ ] Write the failing intercepted-provider E2E flow.
- [ ] Implement missing accessibility/test seams and pass Playwright.
- [ ] Run `bun run build`, `bun run typecheck`, `bun run lint`, `bun run test`, and Playwright; record endpoint-by-endpoint evidence without treating fixture-only checks as live verification.
