// src/app/api/systems/route.ts
// ───────────────────────────────────────────────────────────────────────────────
// Lists systems ordered by openKjSystemId. Creates a new system by computing
// the next available openKjSystemId per user inside a SERIALIZABLE transaction
// to prevent duplicate IDs under concurrency.

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

    // Use a SERIALIZABLE transaction to safely compute next openKjSystemId
    const system = await prisma.$transaction(
      async (tx) => {
        // Get current max per user
        const agg = await tx.system.aggregate({
          where: { userId: session.user.id },
          _max: { openKjSystemId: true },
        })
        const nextId = (agg._max.openKjSystemId ?? 0) + 1

        // Optional: enforce a ceiling if your product plan limits system count.
        // Example:
        // const MAX_SYSTEMS = 10
        // if (nextId > MAX_SYSTEMS) {
        //   throw new Error('System limit reached for your plan')
        // }

        // Create the new system with the computed per-user id
        const created = await tx.system.create({
          data: {
            userId: session.user.id,
            name,
            openKjSystemId: nextId,
          },
        })

        // Keep your State serial in sync
        await tx.state.upsert({
          where: { userId: session.user.id },
          update: { serial: { increment: BigInt(1) } },
          create: { userId: session.user.id, serial: BigInt(1) },
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

    // Handle unique constraint conflicts gracefully (e.g., @@unique([userId, openKjSystemId]))
    // Prisma uses P2002 for unique violations.
    // @ts-expect-error – narrow at runtime
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
