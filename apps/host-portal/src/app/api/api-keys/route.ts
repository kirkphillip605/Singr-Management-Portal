import { NextRequest, NextResponse } from 'next/server'
import { getAuthSession } from '@singr/auth/session'
import { prisma } from '@singr/database'
import { generateApiKey } from '@singr/ui/lib/utils'
import bcrypt from 'bcryptjs'
import { logger } from '@singr/config/logger'
import { z } from 'zod'
export const runtime = 'nodejs'



const createApiKeySchema = z.object({
  description: z.string().min(1, 'Description is required'),
})

export async function POST(request: NextRequest) {
  try {
    const session = await getAuthSession()
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (!session.user.roles?.includes('host')) {
      return NextResponse.json({ error: 'Forbidden', message: 'Host accounts only.' }, { status: 403 })
    }

    const body = await request.json()
    const { description } = createApiKeySchema.parse(body)

    // Generate a new API key
    const apiKey = generateApiKey()
    const apiKeyHash = await bcrypt.hash(apiKey, 12)

    // Create the API key record
    const apiKeyRecord = await prisma.apiKey.create({
      data: {
        userId: session.user.id,
        description,
        apiKeyHash,
        status: 'active',
      },
    })

    logger.info(`API key created for user ${session.user.id}: ${apiKeyRecord.id}`)

    return NextResponse.json({
      id: apiKeyRecord.id,
      apiKey, // Return the plain text key only once
      description: apiKeyRecord.description,
      status: apiKeyRecord.status,
      createdAt: apiKeyRecord.createdAt,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? 'Validation error' },
        { status: 400 }
      )
    }

    logger.error('Error creating API key:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}