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
  postalCode: z.string().optional(),
  country: z.string().default('US'),
  acceptingRequests: z.boolean().default(true),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = createVenueSchema.parse(body)

    // Check if URL name is already taken by this user
    const existingVenueRelationship = await prisma.venueRelationship.findFirst({
      where: {
        userId: session.user.id,
        urlName: validatedData.urlName,
      },
    })

    if (existingVenueRelationship) {
      return NextResponse.json(
        { error: 'URL name is already in use' },
        { status: 400 }
      )
    }

    // Create or find existing venue
    const venue = await prisma.venue.upsert({
      where: {
        name_address: {
          name: validatedData.name,
          address: validatedData.address || '',
        },
      },
      update: {
        city: validatedData.city,
        state: validatedData.state,
        postalCode: validatedData.postalCode,
        country: validatedData.country,
      },
      create: {
        name: validatedData.name,
        address: validatedData.address,
        city: validatedData.city,
        state: validatedData.state,
        postalCode: validatedData.postalCode,
        country: validatedData.country,
      },
    })

    // Create venue relationship
    const venueRelationship = await prisma.venueRelationship.create({
      data: {
        userId: session.user.id,
        venueId: venue.id,
        displayName: validatedData.displayName,
        urlName: validatedData.urlName,
        acceptingRequests: validatedData.acceptingRequests,
      },
      include: {
        venue: true,
      },
    })

    // Initialize state for the venue
    await prisma.state.create({
      data: {
        venueRelationshipId: venueRelationship.id,
        systemId: 0,
        accepting: validatedData.acceptingRequests,
        serial: 1,
      },
    })

    return NextResponse.json({
      id: venueRelationship.id,
      venue: venueRelationship.venue,
      displayName: venueRelationship.displayName,
      urlName: venueRelationship.urlName,
      acceptingRequests: venueRelationship.acceptingRequests,
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