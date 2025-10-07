import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession, assertAdminLevel } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { generateApiKey } from '@/lib/utils'
import bcrypt from 'bcryptjs'
import { logger } from '@/lib/logger'
import { z } from 'zod'
export const runtime = 'nodejs'



const createApiKeySchema = z.object({
  description: z.string().min(1, 'Description is required'),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const paramsResolved = await paramsResolved

  const session = await getAdminSession()

  if (!assertAdminLevel(session)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { userId } = paramsResolved

  try {
    const body = await request.json()
    const { description } = createApiKeySchema.parse(body)

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const apiKey = generateApiKey()
    const apiKeyHash = await bcrypt.hash(apiKey, 12)

    const customer = await prisma.customer.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        stripeCustomerId: `temp_${userId}`,
      },
    })

    const apiKeyRecord = await prisma.apiKey.create({
      data: {
        customerId: customer.id,
        description,
        apiKeyHash,
        status: 'active',
      },
    })

    logger.info('Admin generated API key', {
      adminId: session?.user?.adminId,
      adminLevel: session?.user?.adminLevel,
      targetUserId: userId,
      apiKeyId: apiKeyRecord.id,
    })

    return NextResponse.json({
      id: apiKeyRecord.id,
      apiKey,
      description: apiKeyRecord.description,
      status: apiKeyRecord.status,
      createdAt: apiKeyRecord.createdAt,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }

    logger.error('Failed to create API key as admin', { error })
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
