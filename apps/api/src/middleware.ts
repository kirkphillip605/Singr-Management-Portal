import { NextResponse, type NextRequest } from 'next/server'
import { rateLimit, rateLimitHeaders } from '@singr/redis'

/**
 * API middleware — CORS headers and Redis-backed rate limiting.
 */
export async function middleware(request: NextRequest) {
  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400',
      },
    })
  }

  // Rate limiting (100 requests per minute per IP)
  const ip = request.ip || request.headers.get('x-forwarded-for') || 'anonymous'
  const limitResult = await rateLimit(`ratelimit:api:${ip}`, 100, 60000)

  if (!limitResult.allowed) {
    return new NextResponse(JSON.stringify({ error: 'Too many requests' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        ...rateLimitHeaders(limitResult),
      },
    })
  }

  const response = NextResponse.next()
  response.headers.set('Access-Control-Allow-Origin', '*')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  
  // Attach rate limit headers to successful responses
  Object.entries(rateLimitHeaders(limitResult)).forEach(([key, value]) => {
    response.headers.set(key, value)
  })

  return response
}

export const config = {
  matcher: ['/api/:path*'],
}
