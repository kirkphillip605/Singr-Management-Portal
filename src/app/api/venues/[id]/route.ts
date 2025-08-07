import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const updateVenueSchema = z.object({
  displayName: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  phoneNumber: z.string().optional(),
  website: z.string().url('Invalid website URL').optional().or(z.literal('')),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const validatedData = updateVenueSchema.parse(body)

    // Find the venue and verify ownership
    const venue = await prisma.venue.findFirst({
      where: {
        id: params.id,
        userId: session.user.id,
      },
    })

    if (!venue) {
      return NextResponse.json({ error: 'Venue not found' }, { status: 404 })
    }

    // Update venue
    const updatedVenue = await prisma.venue.update({
      where: { id: params.id },
      data: {
        address: validatedData.address || null,
        city: validatedData.city || null,
        state: validatedData.state || null,
        postalCode: validatedData.postalCode || null,
        phoneNumber: validatedData.phoneNumber || null,
        website: validatedData.website || null,
        updatedAt: new Date(),
      },
    })

    return NextResponse.json({
      id: updatedVenue.id,
      name: updatedVenue.name,
      address: updatedVenue.address,
      city: updatedVenue.city,
      state: updatedVenue.state,
      postalCode: updatedVenue.postalCode,
      phoneNumber: updatedVenue.phoneNumber,
      website: updatedVenue.website,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0].message },
        { status: 400 }
      )
    }

    console.error('Error updating venue:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}