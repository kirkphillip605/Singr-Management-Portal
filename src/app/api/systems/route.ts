// src/app/api/systems/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

/**
 * Schema for creating a System.
 * - `name`: non-empty string, conservative max length to prevent abuse.
 * If you already maintain shared schemas, you can replace this with:
 *   import { createSystemSchema } from '@/lib/validation/system'
 */
const createSystemSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(120, 'Name is too long'),
})

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Capture the userId after the guard so it carries into closures
  const userId: string = session.user.id

  try {
    // Parse & validate body
    const body = await request.json().catch(() => ({}))
    const { name } = createSystemSchema.parse(body)

    const system = await prisma.$transaction(
      async (tx) => {
        // Find the next per-user sequential openKjSystemId
        const agg = await tx.system.aggregate({
          where: { userId },
          _max: { openKjSystemId: true },
        })
        const nextId = (agg._max.openKjSystemId ?? 0) + 1

        const created = await tx.system.create({
          data: {
            userId,
            name,
            openKjSystemId: nextId,
          },
        })

        // Bump the per-user state serial (for cache invalidation, etc.)
        await tx.state.upsert({
          where: { userId },
          update: { serial: { increment: BigInt(1) } },
          create: { userId, serial: BigInt(1) },
        })

        return created
      },
      { isolationLevel: 'Serializable' }
    )

    return NextResponse.json({ system })
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message ?? 'Validation error' },
        { status: 400 }
      )
    }

    // Prisma unique constraint violation (e.g., rare race on nextId)
    // @ts-expect-error Prisma error shape at runtime
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
