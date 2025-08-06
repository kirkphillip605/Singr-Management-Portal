import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { z } from 'zod'

const searchSchema = z.object({
  query: z.string().min(1, 'Search query is required'),
  userLocation: z.object({
    lat: z.number(),
    lng: z.number(),
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

    const apiKey = process.env.HERE_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'HERE API key not configured' },
        { status: 500 }
      )
    }

    // Build HERE API URL
    let url = `https://discover.search.hereapi.com/v1/discover?limit=10&q=${encodeURIComponent(query)}&apiKey=${apiKey}`
    
    // Add user location if available for better results
    if (userLocation) {
      url += `&at=${userLocation.lat},${userLocation.lng}`
    }

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('HERE API error:', response.status, errorText)
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
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error('Venue search error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}