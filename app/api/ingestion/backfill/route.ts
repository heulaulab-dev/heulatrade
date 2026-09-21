import { NextResponse } from 'next/server'

const upstream = process.env.MARKET_API_URL?.replace(/\/$/, '')

export async function POST(request: Request) {
  const requestId = crypto.randomUUID()

  try {
    const body = await request.json()

    if (!body.dataset || !body.startDate || !body.endDate) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields: dataset, startDate, endDate',
        requestId,
      }, {
        status: 400,
        headers: { 'x-request-id': requestId },
      })
    }

    // Trigger backfill via market-api
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
        job_type: 'backfill',
        start_date: body.startDate.replace(/-/g, ''),
        end_date: body.endDate.replace(/-/g, ''),
        concurrency: body.concurrency || 8,
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
    console.error('Backfill job creation failed:', error)

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

export async function GET(request: Request) {
  const requestId = crypto.randomUUID()
  const url = new URL(request.url)
  const jobId = url.searchParams.get('jobId')

  // Get status from market-api
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

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    let endpoint = `${upstream}/api/system/jobs`
    if (jobId) {
      endpoint = `${upstream}/api/system/jobs/${jobId}`
    }

    const response = await fetch(endpoint, {
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
      jobs: jobId ? [result] : result,
      requestId,
    }, {
      headers: { 'x-request-id': requestId },
    })
  } catch (error) {
    console.error('Failed to fetch jobs:', error)

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
