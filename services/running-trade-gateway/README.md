# Running Trade Gateway

This Bun service is deployed separately from Vercel. It owns one upstream connection to `HEULATRADE_RUNNING_TRADE_WS_URL`, authenticates that connection with the server-only `HEULATRADE_RUNNING_TRADE_WS_API_KEY`, and fans normalized events out at `/ws`.

Browser clients must send `{ "type": "authenticate", "accessToken": "<Supabase access token>" }` immediately after connecting. No market events are sent before Supabase validates the token.

Run with `bun services/running-trade-gateway/index.mjs`. Deploy exactly one replica per provider account because the provider permits one connection.
