import { NextResponse } from 'next/server'
import { getIngestionStatus } from '@/lib/market/ingestion'

const upstream = process.env.MARKET_API_URL?.replace(/\/$/, '')

export async function POST(request: Request) {
  const requestId = crypto.randomUUID()

  try {
    const body = await request.json().catch(() => ({}))
    const date = body.date || new Date().toISOString().split('T')[0]

    // Trigger daily ingestion via market-api
    if (!upstream) {
      return NextResponse.json({
        success: false,
        error: 'Market API not configured',
        requestId,
      }, {
        status: 503,
        headers: { 'x-request-id': requestId },
      })
    }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)

    const response = await fetch(`${upstream}/api/system/trigger-ingestion`, {
      method: 'POST',
      body: JSON.stringify({
        job_type: 'daily',
        date: date.replace(/-/g, ''), // Convert YYYY-MM-DD to YYYYMMDD
      }),
      headers: { 'content-type': 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    })

    clearTimeout(timeout)

    if (!response.ok) {
      throw new Error(`Market-API returned ${response.status}`)
    }

    const result = await response.json()

    return NextResponse.json({
      success: true,
      job: result,
      requestId,
    }, {
      headers: { 'x-request-id': requestId },
    })
  } catch (error) {
    console.error('Daily ingestion failed:', error)

    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      requestId,
    }, {
      status: 500,
      headers: { 'x-request-id': requestId },
    })
  }
}

export async function GET() {
  const status = await getIngestionStatus()

  return NextResponse.json({
    message: 'Daily ingestion endpoint. Use POST to trigger.',
    status,
  })
}
