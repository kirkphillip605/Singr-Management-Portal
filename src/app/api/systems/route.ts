import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export const runtime = 'nodejs'

const createSystemSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or fewer'),
})

export async function GET(_request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const systems = await prisma.system.findMany({
    where: { userId: session.user.id },
    orderBy: { openKjSystemId: 'asc' },
  })

  return NextResponse.json({ systems })
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { name } = createSystemSchema.parse(body)

    const system = await prisma.system.create({
      data: {
        userId: session.user.id,
        name,
      },
    })

    await prisma.state.upsert({
      where: { userId: session.user.id },
      update: { serial: { increment: BigInt(1) } },
      create: { userId: session.user.id, serial: BigInt(1) },
    })

    return NextResponse.json({ system })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message ?? 'Validation error' }, { status: 400 })
    }

    console.error('Failed to create system', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
