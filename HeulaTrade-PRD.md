# HeulaTrade

## Market Intelligence Terminal

> **Read the market. Follow the flow.**

**Document:** Product Requirements Document\
**Status:** Production Specification\
**Platform:** Desktop-first web application\
**Market:** Indonesia Stock Exchange (IDX/BEI)\
**Category:** Equity market research workstation\
**Primary data engine:**
[`nichsedge/idx-bei`](https://github.com/nichsedge/idx-bei)\
**Execution scope:** Research, monitoring, and analytics only --- no
securities order execution.

------------------------------------------------------------------------

## 1. Product Definition

**HeulaTrade** is a dense, keyboard-first Indonesian equity research
workstation that unifies market monitoring, charts, broker flow, foreign
flow, fundamentals, ownership, corporate actions, screening, news,
portfolio tracking, alerts, and quantitative analysis in one persistent
multi-panel terminal.

The name comes from the **trading floor**: the place where price,
participants, information, and flow meet.

HeulaTrade must feel like a professional market workstation, not a
conventional SaaS dashboard.

The central interaction model is:

``` text
SELECT SECURITY → EXECUTE FUNCTION → ANALYZE → SWITCH FUNCTION
```

Example:

``` text
BBCA <GO>
BBCA CHART <GO>
BBCA BROKER <GO>
BBCA FOREIGN <GO>
BBCA FUND <GO>
```

Once a security becomes active, all compatible unlocked panels inherit
that security context.

HeulaTrade takes inspiration from professional financial terminals through
high information density, semantic color, keyboard-driven navigation,
persistent instrument context, fast command execution, and configurable
workspaces. It must not reproduce Bloomberg branding, proprietary
layouts, or protected visual assets.

------------------------------------------------------------------------

## 2. Product Goals

HeulaTrade must help an IDX investor answer six questions quickly:

### What is happening?

Market overview, indices, movers, quotes, volume, value, frequency, and
watchlists.

### Who is moving it?

Broker accumulation/distribution, broker concentration, foreign flow,
and ownership changes.

### Why is it happening?

News, IDX disclosures, corporate actions, and company events.

### What does the company look like?

Fundamentals, historical financial performance, valuation, company
profile, governance, and ownership.

### What deserves attention?

Screeners, signals, unusual activity, watchlists, and alerts.

### What am I exposed to?

Portfolio positions, allocation, realized P/L, unrealized P/L, and
performance.

The product must optimize for:

-   speed;
-   information density;
-   context preservation;
-   reliability;
-   traceability;
-   keyboard efficiency;
-   low interaction cost.

------------------------------------------------------------------------

## 3. Non-Goals

HeulaTrade is not:

-   a brokerage platform;
-   an order management system;
-   an execution management system;
-   an IDX exchange gateway;
-   an automated trading bot;
-   a replacement for licensed exchange market feeds;
-   an investment adviser.

HeulaTrade must not submit securities orders.

HeulaTrade must never label scraped or delayed information as real-time
unless the upstream source genuinely provides real-time data.

------------------------------------------------------------------------

## 4. Target Users

### Active IDX Investor

Primary needs:

-   market overview;
-   broker flow;
-   foreign flow;
-   technical charts;
-   watchlists;
-   corporate announcements;
-   screening;
-   alerts.

### Fundamental Investor

Primary needs:

-   financial statements;
-   historical fundamentals;
-   valuation ratios;
-   dividends;
-   corporate actions;
-   ownership;
-   company profiles;
-   peer research.

### Technical / Quantitative User

Primary needs:

-   OHLCV;
-   indicators;
-   broker statistics;
-   foreign flow;
-   screeners;
-   historical datasets;
-   signals;
-   backtesting inputs.

### Research-Oriented Retail Investor

Needs fragmented Indonesian equity information consolidated into one
coherent research environment.

------------------------------------------------------------------------

## 5. Product Principles

### 5.1 Terminal, not dashboard

Avoid designing around large cards, decorative gradients, oversized
typography, large empty areas, and conventional SaaS navigation.

Prefer:

-   dense tables;
-   compact controls;
-   thin separators;
-   persistent panels;
-   tabular numbers;
-   keyboard navigation;
-   contextual actions.

### 5.2 Keyboard and mouse are equal citizens

Everything important must remain usable by mouse.

High-frequency workflows must additionally support keyboard commands.

### 5.3 Global instrument context

Selecting `BBCA` must update compatible panels automatically unless a
panel is explicitly locked to another security.

### 5.4 Data before decoration

Screen real estate belongs primarily to information.

### 5.5 Color communicates meaning

Color must be semantic, consistent, and never the sole carrier of
meaning.

### 5.6 Data provenance is part of the UI

Freshness, source, and calculation period must be visible wherever they
materially affect interpretation.

------------------------------------------------------------------------

## 6. Technology Stack

### Product Application

``` text
Runtime             Bun
Framework           Next.js 16 App Router
Language            TypeScript
UI primitives       shadcn/ui
Styling             Tailwind CSS
Client UI state     Zustand
Server state        TanStack Query
Validation          Zod
Charts              TradingView Lightweight Charts
Icons               Lucide
Authentication      Supabase Auth
Database            Supabase PostgreSQL
Realtime            Supabase Realtime + market WebSocket
Object Storage      Supabase Storage
```

### Market Data Engine

Retain the Python architecture from `idx-bei`.

``` text
Python 3.13+
FastAPI
curl_cffi
pandas
numpy
DuckDB
Parquet
PostgreSQL where appropriate
WebSocket
```

The scraper and financial processing engine must remain isolated from
the Next.js UI.

------------------------------------------------------------------------

## 7. System Architecture

``` text
                 ┌────────────────────────┐
                 │   IDX / BEI Sources    │
                 │   External Sources     │
                 └────────────┬───────────┘
                              │
                              ▼
                ┌──────────────────────────┐
                │   Python Data Engine     │
                │                          │
                │ scraping                 │
                │ ingestion                │
                │ normalization            │
                │ calculations             │
                │ broker analytics         │
                │ foreign-flow analytics   │
                │ fundamental processing   │
                │ quantitative signals     │
                └────────────┬─────────────┘
                             │
                  REST / WebSocket / Jobs
                             │
             ┌───────────────┴────────────────┐
             │                                │
             ▼                                ▼
┌────────────────────────┐       ┌────────────────────────┐
│       SUPABASE         │       │        NEXT.JS         │
│                        │       │                        │
│ PostgreSQL             │◄─────►│ Terminal UI            │
│ Auth                   │       │ Command Engine         │
│ RLS                    │       │ Workspace Engine       │
│ Realtime               │       │ Server API / BFF       │
│ Storage                │       │ Query Layer            │
└────────────────────────┘       └────────────────────────┘
```

### Architectural rule

**Next.js owns the product. Supabase owns identity and persistent
application/user data. Python owns market-data acquisition,
normalization, and financial processing.**

Do not move scraping into React, Server Components, or browser code.

------------------------------------------------------------------------

## 8. Data Ownership

Maintain a strict distinction between:

1.  market data;
2.  user data;
3.  application data.

### Market data

Includes:

-   securities;
-   OHLCV;
-   broker summaries;
-   foreign flow;
-   fundamentals;
-   financial statements;
-   indices;
-   corporate actions;
-   ownership;
-   company profiles;
-   announcements;
-   news metadata.

Large historical/time-series datasets may remain in Parquet + DuckDB
behind the Python service. Do not move every candle into Supabase merely
because PostgreSQL is available.

### User data

Supabase owns:

-   profiles;
-   watchlists;
-   workspaces;
-   saved screeners;
-   alerts;
-   portfolios;
-   portfolio transactions;
-   notes;
-   preferences.

### Application data

Supabase PostgreSQL may store normalized application-facing datasets
where relational access provides value, including:

-   security master;
-   company metadata;
-   normalized fundamentals;
-   corporate actions;
-   market metadata;
-   alert events.

------------------------------------------------------------------------

## 9. Supabase Responsibilities

### Authentication

Support:

-   email/password;
-   Google OAuth;
-   session refresh;
-   secure sign-out.

Use the official Supabase SSR pattern for Next.js.

### PostgreSQL

Store structured persistent application/user data.

### Row Level Security

RLS is mandatory for every user-owned table.

### Realtime

Use for application events such as:

-   alert events;
-   notifications;
-   cross-device watchlist changes;
-   workspace changes;
-   portfolio updates.

Do not use Supabase Realtime as a replacement for the market-data
WebSocket.

### Storage

Use for:

-   user exports;
-   generated reports;
-   user-uploaded attachments;
-   application-managed documents where legally appropriate.

Do not use object storage for structured financial data.

------------------------------------------------------------------------

## 10. Authentication & Authorization

Every user-owned record must be associated with `auth.users.id`.

Conceptual ownership:

``` text
auth.users
    │
    ├── profile
    ├── watchlists
    ├── workspaces
    ├── portfolios
    ├── alerts
    ├── screeners
    └── preferences
```

Typical RLS ownership condition:

``` text
auth.uid() = user_id
```

Frontend visibility checks are not authorization.

User A must never be able to retrieve or mutate User B's data by
modifying a request.

------------------------------------------------------------------------

## 11. Core Database Model

``` text
auth.users
profiles

watchlists
watchlist_items

workspaces
workspace_panels

portfolios
portfolio_transactions

alerts
alert_events
notifications

saved_screeners
notes
user_preferences

securities
companies
company_fundamentals
corporate_actions
ownership_snapshots
market_indices
market_snapshots
```

All schema changes must be committed through Supabase migrations.

------------------------------------------------------------------------

## 12. Profiles

``` text
profiles
────────────────────────
id              uuid PK → auth.users.id
display_name    text
avatar_url      text
timezone        text
created_at      timestamptz
updated_at      timestamptz
```

Default timezone:

``` text
Asia/Jakarta
```

------------------------------------------------------------------------

## 13. Watchlists

``` text
watchlists
────────────────────────
id
user_id
name
is_default
position
created_at
updated_at
```

``` text
watchlist_items
────────────────────────
id
watchlist_id
symbol
position
created_at
```

Prevent duplicate symbols within the same watchlist.

------------------------------------------------------------------------

## 14. Workspaces

``` text
workspaces
────────────────────────
id
user_id
name
is_default
layout jsonb
created_at
updated_at
```

``` text
workspace_panels
────────────────────────
id
workspace_id
panel_type
symbol
is_locked
position
settings jsonb
created_at
updated_at
```

Workspace persistence must include panel arrangement, panel type, symbol
locks, and relevant panel settings.

------------------------------------------------------------------------

## 15. Portfolios

``` text
portfolios
────────────────────────
id
user_id
name
currency
created_at
updated_at
```

``` text
portfolio_transactions
────────────────────────
id
portfolio_id
symbol
transaction_type
transaction_date
quantity
price
fees
notes
created_at
updated_at
```

Supported transaction types:

``` text
BUY
SELL
DIVIDEND
CASH_ADJUSTMENT
```

Authoritative portfolio values must be derived from transaction history
rather than arbitrary totals submitted by the browser.

------------------------------------------------------------------------

## 16. Alerts

``` text
alerts
────────────────────────
id
user_id
symbol
metric
operator
threshold
enabled
last_triggered_at
created_at
updated_at
```

``` text
alert_events
────────────────────────
id
alert_id
observed_value
triggered_at
read_at
```

Example:

``` text
symbol      BBCA
metric      PRICE
operator    GT
threshold   9500
```

------------------------------------------------------------------------

## 17. Security Master

``` text
securities
────────────────────────
symbol
company_name
exchange
board
sector
subsector
listing_date
status
updated_at
```

The security master provides a stable searchable universe independent of
raw scraper response formats.

------------------------------------------------------------------------

## 18. Terminal Shell

The product occupies the full viewport.

``` text
┌─────────────────────────────────────────────────────────────────┐
│ HeulaTrade       [ BBCA EQUITY <GO>                  ] ● CONNECTED │
├─────────────────────────────────────────────────────────────────┤
│ F1 HELP │ F2 MARKET │ F3 CHART │ F4 BROKER │ F5 FOREIGN │ ...│
├─────────────────────────────────────────────────────────────────┤
│ IHSG 7,231 +0.72% │ LQ45 +0.44% │ IDX30 +0.31%               │
├──────────────┬─────────────────────────────┬────────────────────┤
│ WATCHLIST    │ CHART                       │ PROFILE            │
│              │                             │                    │
│ BBCA +1.2%   │                             │ BBCA               │
│ BBRI -0.5%   │                             │ BANK CENTRAL ASIA  │
├──────────────┴─────────────────────┬───────┴────────────────────┤
│ BROKER FLOW                        │ NEWS                       │
│                                    │                            │
└────────────────────────────────────┴────────────────────────────┘
```

The product must not use a conventional permanent left sidebar as its
primary navigation.

------------------------------------------------------------------------

## 19. Global Instrument Context

``` ts
interface InstrumentContext {
  symbol: string
  companyName: string
  board?: string
  sector?: string
}
```

Selecting:

``` text
BBCA
```

updates compatible unlocked panels:

``` text
Chart          BBCA
Broker         BBCA
Foreign        BBCA
Fundamental    BBCA
Profile        BBCA
News           BBCA
```

------------------------------------------------------------------------

## 20. Panel Locking

A panel may be detached from global context.

``` text
GLOBAL       BBCA

CHART        BBCA
BROKER 🔒    BBRI
FUNDAMENTAL  BBCA
```

Executing:

``` text
TLKM <GO>
```

results in:

``` text
CHART        TLKM
BROKER 🔒    BBRI
FUNDAMENTAL  TLKM
```

------------------------------------------------------------------------

## 21. Command System

Primary syntax:

``` text
[SECURITY] [FUNCTION] [ARGUMENTS]
```

Examples:

``` text
BBCA
BBCA CHART
BBCA BROKER
BBCA FOREIGN
BBCA FUND
BBCA PROFILE
BBCA NEWS
BBCA ANN
BBCA CORP

MARKET
MOVERS
SCREENER
NEWS
PORT
WL
HELP
```

Enter executes the command.

Invalid commands must fail visibly and provide useful suggestions.

------------------------------------------------------------------------

## 22. Command Registry

Do not implement commands using a giant conditional.

``` ts
const commands = {
  CHART: {
    aliases: ["GP", "GRAPH"],
    requiresSymbol: true,
  },

  BROKER: {
    aliases: ["BRKR", "FLOW"],
    requiresSymbol: true,
  },

  FOREIGN: {
    aliases: ["FRGN"],
    requiresSymbol: true,
  },

  FUND: {
    aliases: ["FA", "FUNDAMENTAL"],
    requiresSymbol: true,
  },

  MARKET: {
    aliases: ["MKT"],
    requiresSymbol: false,
  },
}
```

The registry drives:

-   parsing;
-   autocomplete;
-   help;
-   command palette;
-   shortcut metadata;
-   documentation.

------------------------------------------------------------------------

## 23. Global Search

Search supports:

-   ticker;
-   company name;
-   function;
-   broker;
-   saved workspace.

Example:

``` text
> bank cen
```

Result:

``` text
BBCA
Bank Central Asia Tbk
```

Search must tolerate partial input and reasonable spelling errors.

------------------------------------------------------------------------

## 24. Keyboard System

Required shortcuts:

``` text
/             Focus terminal command
Ctrl/Cmd + K  Open command palette
Enter         Execute
Esc           Exit / close
↑ / ↓         Navigate results
Tab           Move focus
Alt + 1..9    Focus panel
```

Function shortcuts:

``` text
F1   HELP
F2   MARKET
F3   CHART
F4   BROKER
F5   FOREIGN
F6   FUND
F7   PROFILE
F8   SCREENER
F9   PORT
F10  NEWS
```

Browser/OS shortcut conflicts must have alternative bindings.

------------------------------------------------------------------------

## 25. Workspace Engine

Required panel operations:

-   resize;
-   split horizontally;
-   split vertically;
-   maximize;
-   restore;
-   close;
-   replace;
-   refresh;
-   lock symbol;
-   unlock symbol.

Panels must preserve state while being rearranged.

shadcn Resizable primitives may be used for interaction behavior.

------------------------------------------------------------------------

## 26. Saved Workspaces

Built-in workspace templates may include:

``` text
Market Overview
Trading
Broker Analysis
Foreign Flow
Fundamental Research
```

Users may create custom layouts.

Supabase persists layouts across authenticated devices.

------------------------------------------------------------------------

## 27. Market Overview

Command:

``` text
MARKET
```

### Indices

Include where available:

``` text
IHSG
LQ45
IDX30
IDX80
sectoral indices
```

### Breadth

``` text
Advancers
Decliners
Unchanged
Trading value
Trading volume
Trading frequency
```

### Rankings

``` text
Top Gainers
Top Losers
Top Value
Top Volume
Top Frequency
```

------------------------------------------------------------------------

## 28. Watchlist

Command:

``` text
WL
```

Example:

``` text
CODE  LAST    CHG      VALUE    VOLUME   FOREIGN
BBCA  9,125   +1.20%   820.1B   89.3M    +72.4B
BBRI  4,210   -0.50%   610.2B   144.2M   -31.7B
TLKM  3,180   +0.80%   401.3B   126.1M   +18.2B
```

Requirements:

-   multiple watchlists;
-   add/remove security;
-   reorder;
-   configurable columns;
-   sorting;
-   keyboard navigation;
-   security search;
-   market updates where supported.

Selecting a row changes global security context.

------------------------------------------------------------------------

## 29. Chart

Command:

``` text
BBCA CHART
```

Use TradingView Lightweight Charts.

Chart modes:

``` text
Candlestick
Line
Area
```

Ranges where data supports them:

``` text
1D
1W
1M
3M
6M
YTD
1Y
2Y
3Y
5Y
MAX
```

Overlays:

``` text
EMA20
EMA50
EMA200
Bollinger Bands
VWAP
```

Sub-panels:

``` text
Volume
RSI
MACD
Foreign Flow
```

Crosshair data:

``` text
DATE
OPEN
HIGH
LOW
CLOSE
CHANGE
VOLUME
```

------------------------------------------------------------------------

## 30. Broker Analysis

Command:

``` text
BBCA BROKER
```

Example:

``` text
BROKER   BUY       SELL      NET        AVG BUY
YP       182.4B    71.2B     +111.2B    9,087
CC       121.7B    49.1B      +72.6B    9,102
PD        31.2B    94.7B      -63.5B    9,118
```

Required analysis:

-   net accumulation;
-   net distribution;
-   broker concentration;
-   average buy;
-   average sell;
-   transaction frequency.

Filters:

-   date range;
-   broker;
-   buy/sell;
-   value;
-   frequency.

------------------------------------------------------------------------

## 31. Foreign Flow

Command:

``` text
BBCA FOREIGN
```

Metrics:

``` text
Foreign Buy
Foreign Sell
Foreign Net
Foreign Ratio
Cumulative Foreign Net
```

Price and foreign flow must be visually correlatable.

Ranges:

``` text
1D
5D
20D
3M
6M
YTD
1Y
```

------------------------------------------------------------------------

## 32. Fundamentals

Command:

``` text
BBCA FUND
```

### Valuation

``` text
PER
PBV
Dividend Yield
EV/EBITDA where available
```

### Profitability

``` text
ROE
ROA
Net Margin
Operating Margin
```

### Financial

``` text
Revenue
Operating Income
Net Income
Assets
Liabilities
Equity
```

### Per Share

``` text
EPS
BVPS
DPS
```

### Growth

``` text
Revenue YoY
Profit YoY
EPS YoY
```

------------------------------------------------------------------------

## 33. Historical Fundamentals

Do not expose only latest-period ratios.

Example:

``` text
YEAR   REVENUE   NET PROFIT   EPS   ROE
2022   ...
2023   ...
2024   ...
2025   ...
```

Charts may visualize:

-   revenue;
-   profit;
-   EPS;
-   ROE;
-   ROA;
-   margins.

Users must be able to distinguish annual and quarterly periods.

------------------------------------------------------------------------

## 34. Company Profile

Command:

``` text
BBCA PROFILE
```

Display:

-   company name;
-   ticker;
-   sector;
-   subsector;
-   listing date;
-   website;
-   description.

Governance:

-   directors;
-   commissioners.

Ownership:

-   major shareholders;
-   ownership percentage.

Corporate structure:

-   subsidiaries;
-   related entities where data supports them.

------------------------------------------------------------------------

## 35. Corporate Actions

Command:

``` text
BBCA CORP
```

Support where data exists:

-   dividends;
-   stock splits;
-   reverse splits;
-   rights issues;
-   bonus shares;
-   private placements;
-   warrants;
-   capital changes.

Example:

``` text
DATE        TYPE         DESCRIPTION
2026-04-01  DIVIDEND     Rp250/share
2025-11-02  STOCK SPLIT  1:5
```

------------------------------------------------------------------------

## 36. Ownership Analysis

Display where source data supports it:

-   major shareholders;
-   institutional ownership;
-   ownership changes;
-   shareholder concentration;
-   shareholder drift;
-   corporate relationships.

Historical comparison options:

``` text
CURRENT
1M AGO
3M AGO
6M AGO
1Y AGO
```

------------------------------------------------------------------------

## 37. Screener

Command:

``` text
SCREENER
```

Users construct composable conditions.

### Market

``` text
Price
Market Cap
Volume
Value
Frequency
```

### Performance

``` text
1D
1W
1M
3M
YTD
1Y
```

### Fundamental

``` text
PER
PBV
ROE
ROA
EPS
DER
Dividend Yield
```

### Flow

``` text
Foreign Net
Broker Net
Broker Concentration
```

### Technical

``` text
RSI
EMA relationships
Volume breakout
Price breakout
```

Example:

``` text
ROE > 15
AND PER < 15
AND FOREIGN_NET > 0
AND PRICE > EMA50
```

------------------------------------------------------------------------

## 38. Saved Screeners

Users may save filters such as:

``` text
Foreign Accumulation
Cheap Banks
Momentum
Dividend
Broker Accumulation
```

Schema:

``` text
saved_screeners
────────────────────────
id
user_id
name
conditions jsonb
sort_config jsonb
created_at
updated_at
```

------------------------------------------------------------------------

## 39. Screener Results

Use a dense virtualized data grid when required.

``` text
CODE  PRICE  CHG    PER   PBV   ROE    FOREIGN
BBCA  9125   +1.2   21.3  4.6   23.1   +72B
BMRI  ...
```

Features:

-   sort;
-   resize columns;
-   pin columns;
-   hide columns;
-   keyboard row selection;
-   open security;
-   CSV export.

------------------------------------------------------------------------

## 40. Quantitative Signals

Signals must show evidence, calculation date, and data freshness.

Never present model output as guaranteed investment advice.

Required presentation:

``` text
SIGNAL
EVIDENCE
CALCULATION DATE
SOURCE DATA FRESHNESS
```

Avoid opaque output such as:

``` text
BUY BBCA NOW
```

without underlying evidence.

------------------------------------------------------------------------

## 41. News

Commands:

``` text
NEWS
BBCA NEWS
```

Display:

``` text
TIME
SOURCE
SYMBOL
HEADLINE
```

Filters:

-   all;
-   current symbol;
-   watchlist;
-   corporate;
-   market;
-   macro.

Prefer source metadata and original-source navigation rather than
unauthorized reproduction of third-party content.

------------------------------------------------------------------------

## 42. IDX Announcements

Command:

``` text
BBCA ANN
```

Keep official disclosures separate from general news.

Potential types:

-   financial report;
-   material information;
-   corporate action;
-   public expose;
-   shareholder disclosure;
-   other exchange filing.

Link to original filing/document where available.

------------------------------------------------------------------------

## 43. Portfolio

Command:

``` text
PORT
```

Portfolio functionality is tracking only.

Users manually record:

``` text
BUY
SELL
DIVIDEND
CASH_ADJUSTMENT
```

Metrics:

-   average cost;
-   quantity;
-   current market price;
-   market value;
-   realized P/L;
-   unrealized P/L;
-   return percentage;
-   portfolio weight.

------------------------------------------------------------------------

## 44. Portfolio Analytics

Display:

``` text
Total Equity
Cash
Invested Capital
Daily P/L
Total P/L
Realized P/L
Unrealized P/L
```

Allocation:

-   security;
-   sector;
-   industry.

Performance periods:

``` text
1D
1W
1M
3M
YTD
1Y
ALL
```

Never fabricate historical portfolio performance when historical
transaction data is incomplete.

------------------------------------------------------------------------

## 45. Alerts

Examples:

``` text
BBCA PRICE > 9500
BBCA PRICE < 8500
BBCA DAILY_CHANGE > 5%
BBCA FOREIGN_NET > 50B
BBCA VOLUME > 2 × AVG_VOLUME_20D
```

Lifecycle:

``` text
ACTIVE
TRIGGERED
ACKNOWLEDGED
DISABLED
```

In-app notification is mandatory.

------------------------------------------------------------------------

## 46. Notifications

``` text
notifications
────────────────────────
id
user_id
type
title
message
entity_type
entity_id
read_at
created_at
```

Potential types:

``` text
PRICE_ALERT
FOREIGN_FLOW_ALERT
VOLUME_ALERT
SYSTEM
```

Supabase Realtime may deliver authenticated notification inserts to the
active client.

------------------------------------------------------------------------

## 47. Realtime Architecture

Separate market streaming from application realtime.

``` text
MARKET DATA SERVICE
        │
        └── WebSocket ──► Quotes / market updates

SUPABASE
        │
        └── Realtime ───► Alerts / user-data events
```

Do not route every market tick through Supabase unless a measured
architectural reason requires it.

------------------------------------------------------------------------

## 48. Design Language

HeulaTrade must prioritize:

-   information density;
-   speed;
-   hierarchy;
-   consistency;
-   predictable navigation;
-   keyboard operation.

Avoid:

-   large rounded cards;
-   excessive shadows;
-   marketing gradients;
-   oversized page headings;
-   decorative illustrations;
-   excessive whitespace;
-   generic AI-generated SaaS styling.

------------------------------------------------------------------------

## 49. Semantic Color System

Tokens:

``` text
--terminal-background
--terminal-panel
--terminal-border

--terminal-text
--terminal-muted

--terminal-amber
--terminal-cyan

--market-positive
--market-negative
--market-neutral

--warning
--critical
--selection
```

Meaning:

``` text
Amber    function / command
Cyan     interactive information
Green    positive
Red      negative
White    primary data
Gray     metadata
Yellow   warning
```

Never rely solely on red/green.

Use:

``` text
▲ +2.13%
▼ -1.32%
```

------------------------------------------------------------------------

## 50. Typography

Primary:

``` text
Geist Mono
```

Financial data must use tabular numerals:

``` css
font-variant-numeric: tabular-nums;
```

Recommended scale:

``` text
10px   metadata
11px   secondary table data
12px   default terminal text
13px   controls
14px   panel heading
16–20px important quote
```

------------------------------------------------------------------------

## 51. Density

Target visual density:

``` text
Table row       24–28px
Panel header    28–32px
Toolbar         28–32px
Input           28–32px
Panel padding   4–8px
Panel gap       1–4px
Border          1px
Radius          0–3px
```

Avoid unnecessary shadows.

------------------------------------------------------------------------

## 52. shadcn Strategy

Use shadcn for behavioral primitives, not default aesthetics.

Useful primitives:

``` text
Command
Dialog
Popover
DropdownMenu
ContextMenu
Tooltip
Resizable
ScrollArea
Tabs
Select
Input
Table
```

HeulaTrade's own terminal tokens and component variants control appearance.

------------------------------------------------------------------------

## 53. Responsive Behavior

Primary target:

``` text
1280px+
```

Optimal:

``` text
1440px+
```

1024px must remain functional with fewer simultaneous panels.

Mobile should use focused single-panel navigation rather than shrinking
the entire workstation into a phone viewport.

------------------------------------------------------------------------

## 54. Frontend State Architecture

### TanStack Query

Owns server state:

-   quotes;
-   OHLCV;
-   broker flow;
-   foreign flow;
-   fundamentals;
-   profile;
-   news;
-   corporate actions;
-   screener results.

### Zustand

Owns workstation/UI state:

-   active symbol;
-   focused panel;
-   workspace layout;
-   panel locks;
-   panel configuration;
-   command state;
-   density.

### Supabase

Owns persistent user/application state.

Do not duplicate TanStack Query API responses inside Zustand.

------------------------------------------------------------------------

## 55. API Architecture

Recommended market API:

``` text
/api/market
/api/market/movers

/api/securities
/api/securities/search

/api/stocks/:symbol
/api/stocks/:symbol/quote
/api/stocks/:symbol/chart
/api/stocks/:symbol/brokers
/api/stocks/:symbol/foreign
/api/stocks/:symbol/fundamentals
/api/stocks/:symbol/ownership
/api/stocks/:symbol/actions
/api/stocks/:symbol/news
/api/stocks/:symbol/announcements

/api/screener
```

User-specific CRUD may use Supabase directly where RLS provides a clean
security boundary.

Privileged operations remain server-side.

------------------------------------------------------------------------

## 56. Normalization Layer

React components must never consume arbitrary raw scraper responses.

Example normalized contract:

``` ts
interface Quote {
  symbol: string
  timestamp: string

  open: number | null
  high: number | null
  low: number | null
  close: number | null
  previousClose: number | null

  change: number | null
  changePercent: number | null

  volume: number | null
  value: number | null
  frequency: number | null
}
```

The Python/data adapter layer absorbs upstream source changes.

------------------------------------------------------------------------

## 57. Runtime Validation

Use Zod at API boundaries.

``` ts
const QuoteSchema = z.object({
  symbol: z.string(),
  timestamp: z.string(),
  close: z.number().nullable(),
  previousClose: z.number().nullable(),
  change: z.number().nullable(),
  changePercent: z.number().nullable(),
  volume: z.number().nullable(),
})
```

Schema drift must fail visibly instead of silently producing incorrect
financial UI.

------------------------------------------------------------------------

## 58. Market Response Metadata

Every important market response must include provenance.

``` ts
type MarketResponse<T> = {
  data: T
  meta: {
    source: string
    fetchedAt: string
    dataAsOf?: string
    freshness: "LIVE" | "DELAYED" | "EOD" | "STALE"
  }
}
```

------------------------------------------------------------------------

## 59. Data Freshness

Every important market panel displays freshness.

Examples:

``` text
● LIVE 15:42:08 WIB
```

``` text
EOD · 18 SEP 2026
```

``` text
STALE · LAST UPDATE 17 SEP 2026
```

Never imply freshness through animation alone.

------------------------------------------------------------------------

## 60. Missing Data Rules

Hard requirement:

``` text
NULL ≠ ZERO
```

Missing data:

``` text
—
N/A
UNAVAILABLE
```

Actual zero:

``` text
0
0.00
0%
```

Never silently convert `null`, `undefined`, or `NaN` to financial zero.

------------------------------------------------------------------------

## 61. Loading Architecture

Every panel loads independently.

Panel states:

``` text
LOADING
READY
EMPTY
STALE
ERROR
OFFLINE
```

One failed panel must not blank the complete terminal.

Panel dimensions must remain stable while loading.

------------------------------------------------------------------------

## 62. Error Handling

Example:

``` text
BROKER DATA UNAVAILABLE

Last successful update
20 SEP 2026 · 16:14 WIB

[R] RETRY
```

Do not display raw exceptions by default.

Optional diagnostics may expose safe information such as:

-   request ID;
-   endpoint;
-   timestamp;
-   application error code.

Never expose credentials.

------------------------------------------------------------------------

## 63. Market WebSocket Behavior

States:

``` text
CONNECTING
LIVE
RECONNECTING
OFFLINE
```

Reconnect using exponential backoff with jitter.

Never interpolate or fabricate prices while disconnected.

------------------------------------------------------------------------

## 64. Performance Targets

``` text
Terminal shell usable       < 2s
Command UI response         < 100ms
Cached panel switch         < 150ms
Typical API response        < 1s preferred
Resize interaction          60fps
Large-table scrolling       60fps
```

Use virtualization for large tables.

------------------------------------------------------------------------

## 65. Database Performance

Indexes must follow actual query patterns.

Likely indexes:

``` text
watchlists(user_id)
workspaces(user_id)
portfolios(user_id)
alerts(user_id, enabled)

portfolio_transactions(
  portfolio_id,
  transaction_date
)

securities(symbol)
securities(company_name)

company_fundamentals(
  symbol,
  period_date
)

corporate_actions(
  symbol,
  event_date
)
```

Do not create indexes without query justification.

------------------------------------------------------------------------

## 66. Supabase Migrations

All database changes must be reproducible from source control.

``` text
supabase/
├── migrations/
├── seed.sql
└── config.toml
```

Schema, functions, triggers, indexes, and RLS policies must be
represented by migrations.

Production dashboard clicks are not the canonical schema definition.

------------------------------------------------------------------------

## 67. RLS Testing

Automated tests must prove:

``` text
User A can read User A watchlist.
User A cannot read User B watchlist.

User A can modify User A portfolio.
User A cannot modify User B portfolio.

Anonymous users cannot access protected records.
```

------------------------------------------------------------------------

## 68. Service Role Security

`SUPABASE_SERVICE_ROLE_KEY` is server-only.

Never expose it through:

``` text
NEXT_PUBLIC_*
browser bundles
Client Components
browser console
error responses
logs accessible to users
```

------------------------------------------------------------------------

## 69. Rate Limiting

Protect expensive or abuse-prone endpoints:

-   security search;
-   market proxy;
-   screener;
-   exports;
-   authentication-sensitive routes;
-   expensive analytics.

Raw scraping endpoints must never be directly callable by arbitrary
clients.

------------------------------------------------------------------------

## 70. Data Integrity

Financial values must never be guessed.

Rules:

``` text
missing → null / N/A
zero    → 0
unknown → UNKNOWN
stale   → show stale timestamp
```

Calculated metrics must define their period and inputs.

------------------------------------------------------------------------

## 71. Financial Formatting

Centralize formatting.

Examples:

``` text
1_250                → 1,250
1_200_000            → 1.20M
8_400_000_000        → 8.40B
1_200_000_000_000    → 1.20T
0.0231               → +2.31%
```

Formatting functions must distinguish:

-   IDR;
-   shares;
-   percentages;
-   ratios;
-   frequency;
-   dates;
-   timestamps.

------------------------------------------------------------------------

## 72. Timezone

Market-facing timezone:

``` text
Asia/Jakarta
WIB
```

Database timestamps use `timestamptz`.

Do not persist ambiguous local timestamps.

------------------------------------------------------------------------

## 73. Trading Calendar

Never assume every Monday--Friday is a trading session.

Calendar logic must understand:

-   weekends;
-   Indonesian public holidays;
-   IDX holidays;
-   special exchange closures.

Data-health checks must distinguish legitimate market closures from
missing ingestion.

------------------------------------------------------------------------

## 74. Observability

Capture structured telemetry for:

-   API latency;
-   API failures;
-   scraper failures;
-   scraper duration;
-   upstream source changes;
-   WebSocket state;
-   Supabase failures;
-   authentication failures;
-   alert failures;
-   data freshness.

Use request/correlation IDs.

------------------------------------------------------------------------

## 75. Data Health

Operational monitoring must detect:

-   latest available trading date;
-   missing securities;
-   missing historical partitions;
-   failed ingestion;
-   stale fundamentals;
-   stale broker data;
-   abnormal row counts;
-   upstream scraper failures.

HTTP 200 does not prove data correctness.

------------------------------------------------------------------------

## 76. Health Endpoints

Provide:

``` text
/api/health
/api/ready
```

Health reports process/service availability.

Readiness reports required dependency availability.

Never expose secrets through health responses.

------------------------------------------------------------------------

## 77. Accessibility

Required:

-   complete keyboard navigation;
-   visible focus states;
-   semantic HTML;
-   accessible labels;
-   sufficient contrast;
-   reduced-motion support;
-   color-independent state indicators;
-   accessible tooltips.

High information density must not come at the cost of basic
accessibility.

------------------------------------------------------------------------

## 78. Testing

### Unit / Component

Use:

``` text
Vitest
React Testing Library
```

Cover:

-   formatters;
-   command parser;
-   command registry;
-   portfolio calculations;
-   screener conditions;
-   workspace state;
-   panel locking;
-   Zod schemas;
-   loading/error states.

### End-to-End

Use:

``` text
Playwright
```

Cover all critical workflows.

------------------------------------------------------------------------

## 79. Contract Testing

The critical integration boundary is:

``` text
SCRAPER
   ↓
NORMALIZER
   ↓
API CONTRACT
   ↓
FRONTEND
```

Automated contract tests must detect upstream response changes before
incorrect data reaches the UI.

------------------------------------------------------------------------

## 80. Repository Structure

``` text
heulatrade/
│
├── app/
│   ├── (auth)/
│   ├── terminal/
│   └── api/
│
├── components/
│   ├── terminal/
│   ├── panels/
│   ├── charts/
│   ├── tables/
│   └── ui/
│
├── features/
│   ├── market/
│   ├── chart/
│   ├── broker/
│   ├── foreign/
│   ├── fundamentals/
│   ├── profile/
│   ├── screener/
│   ├── portfolio/
│   ├── alerts/
│   ├── news/
│   └── workspace/
│
├── lib/
│   ├── api/
│   ├── supabase/
│   ├── commands/
│   ├── schemas/
│   ├── formatters/
│   └── market/
│
├── stores/
│   └── terminal-store.ts
│
├── supabase/
│   ├── migrations/
│   ├── seed.sql
│   └── config.toml
│
├── tests/
│
└── public/
```

Feature-specific code should not accumulate in generic component
directories.

------------------------------------------------------------------------

## 81. Panel Contract

Every terminal panel follows a common model.

``` ts
interface TerminalPanel {
  id: string
  type: PanelType
  symbol?: string
  locked: boolean
  settings: Record<string, unknown>
}
```

This contract powers workspace persistence and panel composition.

------------------------------------------------------------------------

## 82. Production Acceptance Criteria

HeulaTrade is production-ready only when all requirements below work
together.

### Authentication

-   sign up;
-   sign in;
-   sign out;
-   Google OAuth;
-   session refresh;
-   protected user data.

### Terminal

-   command execution;
-   autocomplete;
-   global security context;
-   panel locking;
-   panel resize;
-   panel split;
-   maximize/restore;
-   workspace save/restore;
-   keyboard navigation.

### Market Research

-   market overview;
-   security search;
-   watchlist;
-   chart;
-   broker analysis;
-   foreign flow;
-   fundamentals;
-   historical fundamentals;
-   company profile;
-   ownership;
-   corporate actions;
-   screener;
-   news;
-   IDX announcements.

### Personalization

-   watchlists;
-   workspaces;
-   portfolios;
-   transactions;
-   saved screeners;
-   alerts;
-   notifications;
-   preferences.

### Infrastructure

-   Supabase Auth;
-   PostgreSQL;
-   RLS;
-   migrations;
-   Supabase Realtime;
-   Python market-data service;
-   normalized REST contracts;
-   market WebSocket;
-   health monitoring;
-   structured logging.

### Data Integrity

-   no fake zeroes;
-   no invented prices;
-   freshness visible;
-   source traceable;
-   missing data explicit;
-   runtime schema validation active.

### Security

-   RLS tested;
-   service-role secret server-only;
-   API input validated;
-   rate limiting implemented;
-   no exposed upstream credentials.

### Quality

-   production build passes;
-   critical unit/integration tests pass;
-   critical Playwright tests pass;
-   RLS tests pass;
-   no known critical accessibility issues;
-   no critical browser console errors.

------------------------------------------------------------------------

## 83. Canonical Production Workflow

The following workflow must pass end-to-end:

``` text
User authenticates through Supabase
        ↓
HeulaTrade opens
        ↓
Saved workspace loads
        ↓
User enters:

BBCA <GO>

        ↓
Global context becomes BBCA
        ↓
Unlocked panels update
        ↓
User executes:

BBCA CHART <GO>

        ↓
Historical OHLCV loads
        ↓
User executes:

BBCA BROKER <GO>

        ↓
Broker analysis loads
        ↓
User executes:

BBCA FOREIGN <GO>

        ↓
Foreign flow loads
        ↓
User opens FUND
        ↓
Fundamentals load
        ↓
User adds BBCA to a watchlist
        ↓
Supabase persists watchlist
        ↓
User creates:

BBCA PRICE > 9500

        ↓
Alert persists
        ↓
User saves workspace:

"BBCA Research"

        ↓
Browser refresh
        ↓
Supabase session survives
        ↓
Workspace restores
        ↓
Panel arrangement restores
        ↓
Panel locks restore
        ↓
Watchlist restores
        ↓
Alert restores
        ↓
Fresh market data is requested
```

This is one production requirement, not a phased roadmap.

------------------------------------------------------------------------

## 84. Final Architecture Contract

``` text
┌──────────────────────────────────────────────┐
│                 NEXT.JS                     │
│                                              │
│ Product UI                                   │
│ Terminal interaction                        │
│ Commands                                     │
│ Panels                                       │
│ Workspace                                    │
│ Authentication integration                   │
└─────────────────────┬────────────────────────┘
                      │
              ┌───────┴────────┐
              ▼                ▼
┌──────────────────────┐  ┌──────────────────────────┐
│      SUPABASE        │  │   PYTHON DATA ENGINE     │
│                      │  │                          │
│ Auth                 │  │ IDX scraping             │
│ PostgreSQL           │  │ ingestion                │
│ RLS                  │  │ normalization            │
│ Realtime             │  │ market analytics         │
│ Storage              │  │ broker analytics         │
│ User persistence     │  │ quantitative processing  │
└──────────────────────┘  └────────────┬─────────────┘
                                       │
                                       ▼
                              IDX / DATA SOURCES
```

**Next.js owns the product. Supabase owns identity and persistent
application/user data. Python owns market-data acquisition and financial
processing.**

Do not collapse these boundaries merely to call the project "fullstack
Next.js." The UI can be a single Next.js product while the market-data
engine remains a specialized service.

------------------------------------------------------------------------

## 85. Product Identity

### Name

# HeulaTrade

**HeulaTrade** is to the trading floor: where participants, liquidity,
information, and price discovery meet.

It is short, Indonesian, memorable, visually strong in uppercase, and
does not depend on generic fintech naming such as `StockX`, `TradePro`,
or `IDX Terminal`.

### Descriptor

**Market Intelligence Terminal**

### Primary tagline

> **Read the market. Follow the flow.**

### Alternative terminal boot copy

``` text
HeulaTrade / IDX INTELLIGENCE TERMINAL
MARKET DATA • FLOW • FUNDAMENTALS • RESEARCH
```

### Product positioning

> HeulaTrade is a professional research workstation for the Indonesian
> equity market, built to turn fragmented market data into one fast,
> contextual operating surface.

### Internal design mantra

> **Less dashboard. More signal.**

------------------------------------------------------------------------

## 86. Source & Compliance Note

The initial market-data engine is based on the open-source
`nichsedge/idx-bei` project:

https://github.com/nichsedge/idx-bei

HeulaTrade must maintain a stable internal data contract around that engine
rather than coupling UI components to scraper internals.

Before commercial or public production deployment, data-source rights,
exchange terms, redistribution rights, rate limits, and licensing
requirements must be reviewed. Product copy must accurately distinguish
live, delayed, end-of-day, and stale information.

Market information and analytical outputs are provided for research and
informational purposes and do not constitute investment advice.
