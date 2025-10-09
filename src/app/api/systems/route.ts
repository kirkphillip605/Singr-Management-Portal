// src/app/api/systems/route.ts (only the POST handler changed)
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ✅ Capture the userId after the guard so it carries into closures
  const userId: string = session.user.id

  try {
    const body = await request.json()
    const { name } = createSystemSchema.parse(body)

    const system = await prisma.$transaction(
      async (tx) => {
        const agg = await tx.system.aggregate({
          where: { userId }, // ← use captured userId
          _max: { openKjSystemId: true },
        })
        const nextId = (agg._max.openKjSystemId ?? 0) + 1

        const created = await tx.system.create({
          data: {
            userId, // ← use captured userId
            name,
            openKjSystemId: nextId,
          },
        })

        await tx.state.upsert({
          where: { userId }, // ← use captured userId
          update: { serial: { increment: BigInt(1) } },
          create: { userId, serial: BigInt(1) }, // ← use captured userId
        })

        return created
      },
      { isolationLevel: 'Serializable' }
    )

    return NextResponse.json({ system })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message ?? 'Validation error' },
        { status: 400 }
      )
    }
    // @ts-expect-error – Prisma error code at runtime
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { error: 'A system with that ID already exists. Please retry.' },
        { status: 409 }
      )
    }

    console.error('Failed to create system', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
