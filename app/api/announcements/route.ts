import { NextResponse } from 'next/server'
import { getAnnouncements } from '@/lib/market/server'
import { allowRequest, apiError, requestKey } from '@/lib/api/http'

export async function GET(request: Request) {
  const requestId = crypto.randomUUID()
  if (!allowRequest(requestKey(request, 'announcements'), 30)) {
    return NextResponse.json({ error: 'RATE_LIMITED', requestId }, { status: 429 })
  }

  const url = new URL(request.url)
  const keywords = url.searchParams.get('keywords') || ''
  const page = parseInt(url.searchParams.get('page') || '1')
  const pageSize = parseInt(url.searchParams.get('pageSize') || '20')

  try {
    const result = await getAnnouncements(keywords, page, pageSize)
    return NextResponse.json(result, {
      headers: {
        'x-request-id': requestId,
        'cache-control': 'private, max-age=300',
      }
    })
  } catch (error) {
    return apiError(error, requestId)
  }
}
