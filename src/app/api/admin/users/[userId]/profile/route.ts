import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession, assertAdminLevel } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { logger } from '@/lib/logger'
export const runtime = 'nodejs'



const updateUserSchema = z.object({
  name: z.string().optional().nullable(),
  businessName: z.string().optional().nullable(),
  phoneNumber: z.string().optional().nullable(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const paramsResolved = await params

  const session = await getAdminSession()

  if (!assertAdminLevel(session, 'super_admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { userId } = paramsResolved

  try {
    const body = await request.json()
    const validatedData = updateUserSchema.parse(body)

    const user = await prisma.user.findUnique({ where: { id: userId } })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = { updatedAt: new Date() }

    if (validatedData.name !== undefined) {
      updateData.name = validatedData.name || null
    }
    if (validatedData.businessName !== undefined) {
      updateData.businessName = validatedData.businessName || null
    }
    if (validatedData.phoneNumber !== undefined) {
      updateData.phoneNumber = validatedData.phoneNumber || null
    }

    if (Object.keys(updateData).length === 1) {
      return NextResponse.json({ error: 'No changes supplied' }, { status: 400 })
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
    })

    logger.info('Admin updated customer profile', {
      adminId: session?.user?.adminId,
      targetUserId: userId,
    })

    return NextResponse.json({
      id: updatedUser.id,
      name: updatedUser.name,
      businessName: updatedUser.businessName,
      phoneNumber: updatedUser.phoneNumber,
      email: updatedUser.email,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }

    logger.error('Failed to update user profile as admin', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
