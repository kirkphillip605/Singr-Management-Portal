import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { isCompleteUSPhone } from '@/lib/phone'
export const runtime = 'nodejs'



const createVenueSchema = z.object({
  name: z.string().min(1, 'Venue name is required'),
  displayName: z.string().optional(),
  urlName: z
    .string()
    .min(1, 'URL name is required')
    .regex(/^[a-z-]+$/, 'URL name can only contain lowercase letters and hyphens'),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  stateCode: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().default('US'),
  countryCode: z.string().optional(),
  phoneNumber: z
    .string()
    .optional()
    .refine(
      (value) => !value || isCompleteUSPhone(value),
      'Phone number must include 10 digits (US format) or be blank',
    ),
  website: z.string().optional(),
  herePlaceId: z.string().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  acceptingRequests: z.boolean().default(true),
})

async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const apiKey = process.env['HERE_API_KEY']
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
    const session = await getAuthSession()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.accountType !== 'customer') {
      return NextResponse.json({ error: 'Forbidden', message: 'Customer (host) accounts only.' }, { status: 403 })
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

    const userId: string = session.user.id

    // `openkjVenueId` is assigned by a globally unique Postgres sequence
    // (see Venue.openkjVenueId in prisma/schema.prisma).
    const venue = await prisma.$transaction(async (tx) => {
      const created = await tx.venue.create({
        data: {
          userId,
          name: validatedData.name,
          urlName: validatedData.urlName,
          acceptingRequests: validatedData.acceptingRequests,
          accepting: validatedData.acceptingRequests,
          herePlaceId: validatedData.herePlaceId,
          address: validatedData.address ?? '',
          city: validatedData.city ?? '',
          state: validatedData.state ?? '',
          stateCode: validatedData.stateCode || null,
          postalCode: validatedData.postalCode ?? '',
          country: validatedData.country,
          countryCode: validatedData.countryCode || null,
          phoneNumber: validatedData.phoneNumber,
          website: validatedData.website,
          latitude: validatedData.latitude || coordinates?.lat,
          longitude: validatedData.longitude || coordinates?.lng,
        },
      })

      await tx.state.upsert({
        where: { userId },
        update: { serial: { increment: BigInt(1) } },
        create: { userId, serial: BigInt(1) },
      })

      return created
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
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? 'Validation error' },
        { status: 400 }
      )
    }

    // @ts-expect-error Prisma error shape at runtime
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'Venue conflict, please retry.' },
        { status: 409 }
      )
    }

    console.error('Error creating venue:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}