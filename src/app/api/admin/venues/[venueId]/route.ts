import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession, assertAdminLevel } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { logger } from '@/lib/logger'
export const runtime = 'nodejs'



const updateVenueSchema = z.object({
  name: z.string().optional(),
  acceptingRequests: z.boolean().optional(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  stateCode: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  phoneNumber: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ venueId: string }> }
) {
  const paramsResolved = await paramsResolved

  const session = await getAdminSession()

  if (!assertAdminLevel(session, 'super_admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { venueId } = paramsResolved

  try {
    const existingVenue = await prisma.venue.findUnique({
      where: { id: venueId },
      select: { id: true, userId: true },
    })

    if (!existingVenue) {
      return NextResponse.json({ error: 'Venue not found' }, { status: 404 })
    }

    const body = await request.json()
    const validatedData = updateVenueSchema.parse(body)

    const data: Record<string, any> = {}

    if (validatedData.name !== undefined) {
      data.name = validatedData.name
    }
    if (validatedData.acceptingRequests !== undefined) {
      data.acceptingRequests = validatedData.acceptingRequests
    }
    if (validatedData.address !== undefined) {
      data.address = validatedData.address || null
    }
    if (validatedData.city !== undefined) {
      data.city = validatedData.city || null
    }
    if (validatedData.state !== undefined) {
      data.state = validatedData.state || null
    }
    if (validatedData.stateCode !== undefined) {
      data.stateCode = validatedData.stateCode || null
    }
    if (validatedData.postalCode !== undefined) {
      data.postalCode = validatedData.postalCode || null
    }
    if (validatedData.phoneNumber !== undefined) {
      data.phoneNumber = validatedData.phoneNumber || null
    }
    if (validatedData.website !== undefined) {
      data.website = validatedData.website || null
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: 'No changes supplied' }, { status: 400 })
    }

    const updatedVenue = await prisma.venue.update({
      where: { id: venueId },
      data: {
        ...data,
        updatedAt: new Date(),
      },
    })

    logger.info('Admin updated venue', {
      adminId: session?.user?.adminId,
      adminLevel: session?.user?.adminLevel,
      venueId,
      targetUserId: existingVenue.userId,
    })

    return NextResponse.json({
      id: updatedVenue.id,
      name: updatedVenue.name,
      acceptingRequests: updatedVenue.acceptingRequests,
      address: updatedVenue.address,
      city: updatedVenue.city,
      state: updatedVenue.state,
      postalCode: updatedVenue.postalCode,
      phoneNumber: updatedVenue.phoneNumber,
      website: updatedVenue.website,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }

    logger.error('Failed to update venue as admin', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ venueId: string }> }
) {
  const paramsResolved = await paramsResolved

  const session = await getAdminSession()

  if (!assertAdminLevel(session, 'super_admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { venueId } = paramsResolved

  try {
    const venue = await prisma.venue.findUnique({
      where: { id: venueId },
      select: { id: true, userId: true },
    })

    if (!venue) {
      return NextResponse.json({ error: 'Venue not found' }, { status: 404 })
    }

    await prisma.venue.delete({ where: { id: venueId } })

    logger.info('Admin deleted venue', {
      adminId: session?.user?.adminId,
      venueId,
      targetUserId: venue.userId,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Failed to delete venue as admin', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
