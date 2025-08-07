import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { generateApiKey } from '@/lib/utils'
import bcrypt from 'bcryptjs'
import { logger } from '@/lib/logger'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Find the API key and verify ownership
    const apiKey = await prisma.apiKey.findFirst({
      where: {
        id: params.id,
        customer: {
          id: session.user.id,
        },
      },
    })

    if (!apiKey) {
      return NextResponse.json({ error: 'API key not found' }, { status: 404 })
    }

    if (apiKey.status === 'revoked') {
      return NextResponse.json({ error: 'Cannot roll a revoked API key' }, { status: 400 })
    }

    // Generate new API key
    const newApiKey = generateApiKey()
    const newApiKeyHash = await bcrypt.hash(newApiKey, 12)

    // Update the API key with new hash
    const updatedApiKey = await prisma.apiKey.update({
      where: { id: params.id },
      data: {
        apiKeyHash: newApiKeyHash,
        status: 'active', // Ensure it's active after rolling
        updatedAt: new Date(),
      },
    })

    logger.info(`API key ${params.id} rolled by user ${session.user.id}`)

    return NextResponse.json({
      id: updatedApiKey.id,
      apiKey: newApiKey, // Return the plain text key only once
      description: updatedApiKey.description,
      status: updatedApiKey.status,
      createdAt: updatedApiKey.createdAt,
    })
  } catch (error) {
    logger.error('Error rolling API key:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}