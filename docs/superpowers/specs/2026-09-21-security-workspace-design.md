# HeulaTrade SECURITY Workspace Design

## Objective

Make a selected IDX security a coherent research workspace while preserving the existing terminal shell, binary resizable layout tree, locking, persistence, commands, Zustand ownership, TanStack Query ownership, and Arjum BFF/provider contracts.

## Default Workspace

New and empty workspaces use a backward-compatible `LayoutNode` tree with these rows:

1. CHART | SEASONAL
2. QUOTE | TAPE
3. BROKER | ANALYSIS
4. INSIDER | HISTORY
5. FUND full width

Saved layouts continue to parse and load unchanged. Selecting a symbol never reconstructs the layout. It only changes the global symbol and propagates it to unlocked symbol panels.

## Data Flow

CHART, QUOTE, and HISTORY use the canonical default history options `daily` and `120`. Their identical TanStack Query key is `['arjum', 'history', symbol, frame, limit]`, so the first request populates all three consumers. Independent control changes create independent keys.

QUOTE obtains the company name from the existing search endpoint and derives all market statistics from the latest valid normalized history row. It is always labeled with REST freshness, never LIVE.

MA5, MA20, MA50, and MACD are deterministic local calculations over finite normalized close values. Insufficient samples remain absent rather than becoming zero, NaN, or Infinity.

## Existing Panels

- Seasonality transposes normalized year rows into month rows and year columns. Provider averages, up probability, samples, and yearly averages remain visible where supplied.
- Broker summary retains verified broker fields and gains a compact route to the distinct accumulation mode. It does not infer investor classes.
- Analysis remains the provider document with its disclaimer.
- Tape retains server pagination and reorders columns into a conventional execution sequence.
- Financial statements retain recursive rows, add a sticky metric column, and display null as an em dash.
- Insider remains page size 10 and keeps the verified action filter.
- Market Overview remains independent and may be UNAVAILABLE.

## Commands And Persistence

Focused commands focus an existing matching panel before replacing or opening another panel. Symbol-only commands do not alter layout structure. New QUOTE and HISTORY panel types are added to the schema enum through the existing registry and remain compatible with old stored JSON layouts.

## Verification

Automated tests cover the workspace tree, saved-layout preservation, canonical query keys, symbol propagation, locking, focused-panel lookup, null formatting, indicator calculations, and QUOTE/HISTORY rendering. Live acceptance uses BBCA and HRTA without fixture fallback, followed by desktop and narrow screenshots.
