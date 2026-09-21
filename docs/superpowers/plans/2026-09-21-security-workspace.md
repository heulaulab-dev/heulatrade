# SECURITY Workspace Implementation Plan

## Files

- `stores/terminal-store.ts`: default SECURITY layout and existing-panel lookup.
- `lib/commands/registry.ts`: backward-compatible QUOTE and HISTORY panel roles.
- `lib/api/market-client.ts`: canonical history constants and query-key helper.
- `lib/market/indicators.ts`: finite MA and MACD calculations.
- `components/charts/price-chart.tsx`: MA overlays and MACD pane.
- `components/panels/provider-panels.tsx`: QUOTE, HISTORY, transposed seasonality, tape ordering, financial stickiness.
- `components/panels/market-panels.tsx`: route the two new panel roles.
- `components/terminal/terminal.tsx`: focus an existing command panel before replacement.
- tests: workspace, commands, indicator, and E2E coverage.

## Tasks

1. Add failing tests for the default layout, saved-layout preservation, symbol propagation, locking, and existing-panel lookup.
2. Implement the SECURITY layout and compatible panel roles.
3. Add failing tests for canonical history keys, null formatting, MA/MACD finite output, and insufficient samples.
4. Implement query configuration and indicators.
5. Add failing component/E2E expectations for QUOTE, HISTORY, transposed seasonality, focused commands, and one history request.
6. Implement panel and chart changes using existing styling and components.
7. Run unit, typecheck, lint, build, and Playwright suites.
8. Run live BBCA and HRTA BFF/UI acceptance with request counting and capture final workspace screenshots.

## Review Focus

- Old saved layouts without QUOTE/HISTORY still parse unchanged.
- Null and insufficient samples never render as numeric zero, NaN, or Infinity.
- Query deduplication is proven from browser requests, not inferred from matching source text.
- Symbol changes do not mutate the layout tree.
- Existing matching panels are focused without replacement.
