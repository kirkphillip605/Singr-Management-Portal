import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const createVenueSchema = z.object({
  name: z.string().min(1, 'Venue name is required'),
  displayName: z.string().optional(),
  urlName: z.string().min(1, 'URL name is required').regex(/^[a-z0-9-]+$/, 'URL name can only contain lowercase letters, numbers, and hyphens'),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  stateCode: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().default('US'),
  countryCode: z.string().optional(),
  phoneNumber: z.string().optional(),
  website: z.string().optional(),
  herePlaceId: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  acceptingRequests: z.boolean().default(true),
})

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const apiKey = process.env.HERE_API_KEY
  if (!apiKey) return null

  try {
    const url = `https://geocode.search.hereapi.com/v1/geocode?q=${encodeURIComponent(address)}&apiKey=${apiKey}`
    const response = await fetch(url)
    
    if (!response.ok) return null
    
    const data = await response.json()
    const firstResult = data.items?.[0]
    
    if (firstResult?.position) {
      return {
        lat: firstResult.position.lat,
        lng: firstResult.position.lng,
      }
    }
  } catch (error) {
    console.error('Geocoding error:', error)
  }
  
  return null
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = createVenueSchema.parse(body)

    // Check if URL name is already taken by this user
    const existingVenue = await prisma.venue.findFirst({
      where: {
        userId: session.user.id,
        urlName: validatedData.urlName,
      },
    })

    if (existingVenue) {
      return NextResponse.json(
        { error: 'URL name is already in use' },
        { status: 400 }
      )
    }

    // If no coordinates provided but we have address, try to geocode
    let coordinates = null
    if (!validatedData.latitude && !validatedData.longitude && validatedData.address) {
      const addressString = [
        validatedData.address,
        validatedData.city,
        validatedData.state,
        validatedData.postalCode
      ].filter(Boolean).join(' ')
      
      if (addressString.trim()) {
        coordinates = await geocodeAddress(addressString)
      }
    }

    // Create venue
    const venue = await prisma.venue.create({
      data: {
        userId: session.user.id,
        name: validatedData.name,
        urlName: validatedData.urlName,
        acceptingRequests: validatedData.acceptingRequests,
        hereplaceid: validatedData.herePlaceId,
        address: validatedData.address,
        city: validatedData.city,
        state: validatedData.state,
        stateCode: validatedData.stateCode || null,
        postalCode: validatedData.postalCode,
        country: validatedData.country,
        countryCode: validatedData.countryCode || null,
        phoneNumber: validatedData.phoneNumber,
        website: validatedData.website,
        latitude: validatedData.latitude || coordinates?.lat,
        longitude: validatedData.longitude || coordinates?.lng,
      },
    })

    // Initialize state for the venue
    await prisma.state.create({
      data: {
        venueId: venue.id,
        systemId: 0,
        accepting: validatedData.acceptingRequests,
        serial: 1,
      },
    })

    return NextResponse.json({
      id: venue.id,
      name: venue.name,
      urlName: venue.urlName,
      acceptingRequests: venue.acceptingRequests,
      address: venue.address,
      city: venue.city,
      state: venue.state,
      postalCode: venue.postalCode,
      country: venue.country,
      phoneNumber: venue.phoneNumber,
      website: venue.website,
      latitude: venue.latitude,
      longitude: venue.longitude,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error('Error creating venue:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}