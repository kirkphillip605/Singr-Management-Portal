import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession } from '@/lib/auth-server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
export const runtime = 'nodejs'



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
  { params }: { params: Promise<{ id: string }> }
) {
  const paramsResolved = await params

  try {
    const session = await getAuthSession()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (session.user.accountType !== 'customer') {
      return NextResponse.json({ error: 'Forbidden', message: 'Customer (host) accounts only.' }, { status: 403 })
    }

    const body = await request.json()
    const validatedData = updateVenueSchema.parse(body)

    // Find the venue and verify ownership
    const venue = await prisma.venue.findFirst({
      where: {
        id: paramsResolved.id,
        userId: session.user.id,
      },
    })

    if (!venue) {
      return NextResponse.json({ error: 'Venue not found' }, { status: 404 })
    }

    // Update venue
    const updatedVenue = await prisma.venue.update({
      where: { id: paramsResolved.id },
      data: {
        ...(validatedData.address !== undefined ? { address: validatedData.address } : {}),
        ...(validatedData.city !== undefined ? { city: validatedData.city } : {}),
        ...(validatedData.state !== undefined ? { state: validatedData.state } : {}),
        ...(validatedData.postalCode !== undefined ? { postalCode: validatedData.postalCode } : {}),
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
        { error: error.issues[0]?.message ?? 'Validation error' },
        { status: 400 }
      )
    }

    console.error('Error updating venue:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}