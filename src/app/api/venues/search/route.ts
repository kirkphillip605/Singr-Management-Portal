import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'
import { logger } from '@/lib/logger'
export const runtime = 'nodejs'

const searchSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  userLocation: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }).optional().nullable(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { query, userLocation } = searchSchema.parse(body)

    const apiKey = process.env['HERE_API_KEY']
    if (!apiKey) {
      logger.error('HERE API key not configured')
      return NextResponse.json(
        { error: 'HERE API key not configured' },
        { status: 500 }
      )
    }

    // Build HERE API URL with required location parameter
    let url = `https://discover.search.hereapi.com/v1/discover?limit=10&q=${encodeURIComponent(query)}&apiKey=${apiKey}`
    
    // Add user location if available, otherwise use a default location (US center)
    if (userLocation) {
      url += `&at=${userLocation.lat},${userLocation.lng}`
    } else {
      // Default to center of US if no location provided
      url += `&at=39.8283,-98.5795`
      // Or use country-wide search
      url += `&in=countryCode:USA`
    }

    logger.info('Making HERE API request', { url: url.replace(apiKey, '[REDACTED]') })

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Singr-Management-Portal/1.0',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      logger.error('HERE API error', { 
        status: response.status, 
        statusText: response.statusText,
        error: errorText 
      })
      
      // Try fallback search without location
      if (userLocation) {
        const fallbackUrl = `https://discover.search.hereapi.com/v1/discover?limit=10&q=${encodeURIComponent(query)}&in=countryCode:USA&apiKey=${apiKey}`
        
        const fallbackResponse = await fetch(fallbackUrl, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Singr-Management-Portal/1.0',
          },
        })
        
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json()
          return NextResponse.json({
            results: fallbackData.items || [],
            query,
            userLocation: null,
            fallback: true,
          })
        }
      }
      
      return NextResponse.json(
        { error: 'Failed to search venues' },
        { status: 500 }
      )
    }

    const data = await response.json()
    
    return NextResponse.json({
      results: data.items || [],
      query,
      userLocation,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message ?? 'Validation error' },
        { status: 400 }
      )
    }

    logger.error('Venue search error', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
