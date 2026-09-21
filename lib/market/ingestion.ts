/**
 * Ingestion & Backfill Strategy for HeulaTrade
 *
 * This module provides status tracking for ingestion jobs.
 *
 * Architecture:
 *   IDX → idx-bei Python → daily/backfill pipeline → partitioned Parquet → Supabase Storage → market-api
 *
 * The actual ingestion runs via:
 *   - Python: `uv run idx daily` (daily ingestion)
 *   - Python: `uv run idx backfill` (historical backfill)
 *   - These write to Supabase Storage directly
 *
 * This TypeScript module only provides status checking and job tracking.
 */

const upstream = process.env.MARKET_API_URL?.replace(/\/$/, '')

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type Dataset = 'stock_summary' | 'broker_summary' | 'index_summary'

export interface DatasetStatus {
  status: 'READY' | 'STALE' | 'UNAVAILABLE'
  latestAvailableDate: string | null
}

export interface IngestionStatus {
  ready: boolean
  capabilities: Record<string, DatasetStatus>
  latestAvailableTradingDate: string | null
  remoteStorage: {
    provider: string
    bucket: string
    prefix: string
    configured: boolean
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS CHECKER
// ═══════════════════════════════════════════════════════════════════════════════

export async function getIngestionStatus(): Promise<IngestionStatus> {
  if (!upstream) {
    return {
      ready: false,
      capabilities: {},
      latestAvailableTradingDate: null,
      remoteStorage: {
        provider: 'supabase-storage',
        bucket: 'idx-bei',
        prefix: 'data/timeseries',
        configured: false,
      },
    }
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(`${upstream}/ready`, {
      signal: controller.signal,
      cache: 'no-store',
    })

    clearTimeout(timeout)

    if (!response.ok) {
      throw new Error(`Market-api returned ${response.status}`)
    }

    const data = await response.json()
    return data as IngestionStatus
  } catch (error) {
    console.error('Failed to fetch ingestion status:', error)
    return {
      ready: false,
      capabilities: {},
      latestAvailableTradingDate: null,
      remoteStorage: {
        provider: 'supabase-storage',
        bucket: 'idx-bei',
        prefix: 'data/timeseries',
        configured: false,
      },
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// CRON SCHEDULE (to be run via external scheduler)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Daily ingestion should be scheduled via cron at market close (~16:30 WIB):
 *
 * # Crontab entry (16:45 WIB every weekday):
 * 45 8 * * 1-5 curl -X POST https://your-app.vercel.app/api/ingestion/daily
 *
 * Or use Vercel Cron Jobs:
 * {
 *   "crons": [{
 *     "path": "/api/ingestion/daily",
 *     "schedule": "45 8 * * 1-5"
 *   }]
 * }
 *
 * The actual ingestion runs via Python:
 *   uv run idx daily
 *
 * This writes to Supabase Storage directly.
 */
