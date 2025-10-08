import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession, assertAdminLevel } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { logger } from '@/lib/logger'
import { isCompleteUSPhone } from '@/lib/phone'
export const runtime = 'nodejs'



const createVenueSchema = z.object({
  name: z.string().min(1, 'Venue name is required'),
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
  acceptingRequests: z.boolean().default(true),
})

async function geocodeAddress(address: string) {
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
        lat: firstResult.position.lat as number,
        lng: firstResult.position.lng as number,
      }
    }
  } catch (error) {
    logger.warn('Failed to geocode address for admin venue creation', { error })
  }

  return null
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const paramsResolved = await params

  const session = await getAdminSession()

  if (!assertAdminLevel(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { userId } = paramsResolved

  try {
    const body = await request.json()
    const validatedData = createVenueSchema.parse(body)

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    })

    if (!targetUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const existingVenue = await prisma.venue.findFirst({
      where: {
        userId,
        urlName: validatedData.urlName,
      },
    })

    if (existingVenue) {
      return NextResponse.json(
        { error: 'URL name is already in use for this customer' },
        { status: 400 }
      )
    }

    let coordinates: { lat: number; lng: number } | null = null
    if (validatedData.address && (!validatedData.countryCode || !validatedData.stateCode)) {
      const addressParts = [
        validatedData.address,
        validatedData.city,
        validatedData.state,
        validatedData.postalCode,
      ]
        .filter(Boolean)
        .join(' ')

      if (addressParts) {
        coordinates = await geocodeAddress(addressParts)
      }
    }

    const venue = await prisma.venue.create({
      data: {
        userId,
        name: validatedData.name,
        urlName: validatedData.urlName,
        acceptingRequests: validatedData.acceptingRequests,
        accepting: validatedData.acceptingRequests,
        address: validatedData.address,
        city: validatedData.city,
        state: validatedData.state,
        stateCode: validatedData.stateCode || null,
        postalCode: validatedData.postalCode,
        country: validatedData.country,
        countryCode: validatedData.countryCode || null,
        phoneNumber: validatedData.phoneNumber || undefined,
        website: validatedData.website,
        latitude: coordinates?.lat,
        longitude: coordinates?.lng,
      },
    })

    await prisma.state.upsert({
      where: { userId },
      update: { serial: { increment: BigInt(1) } },
      create: { userId, serial: BigInt(1) },
    })

    logger.info('Admin created venue on behalf of user', {
      adminId: session?.user?.adminId,
      adminLevel: session?.user?.adminLevel,
      targetUserId: userId,
      venueId: venue.id,
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
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message ?? 'Validation error' }, { status: 400 })
    }

    logger.error('Failed to create venue as admin', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
