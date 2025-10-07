import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export const runtime = 'nodejs'

const updateSystemSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or fewer'),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  const { id } = await params

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const { name } = updateSystemSchema.parse(body)

    const system = await prisma.system.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!system) {
      return NextResponse.json({ error: 'System not found' }, { status: 404 })
    }

    const updated = await prisma.system.update({
      where: { id: system.id },
      data: { name },
    })

    await prisma.state.upsert({
      where: { userId: session.user.id },
      update: { serial: { increment: BigInt(1) } },
      create: { userId: session.user.id, serial: BigInt(1) },
    })

    return NextResponse.json({ system: updated })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0].message }, { status: 400 })
    }

    console.error('Failed to update system', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions)
  const { id } = await params

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const system = await prisma.system.findFirst({
      where: { id, userId: session.user.id },
    })

    if (!system) {
      return NextResponse.json({ error: 'System not found' }, { status: 404 })
    }

    const lastSystem = await prisma.system.findFirst({
      where: { userId: session.user.id },
      orderBy: { openKjSystemId: 'desc' },
    })

    if (!lastSystem || lastSystem.id !== system.id) {
      return NextResponse.json(
        { error: 'Systems must be deleted in descending order of their OpenKJ ID' },
        { status: 400 }
      )
    }

    await prisma.$transaction([
      prisma.songDb.deleteMany({
        where: { userId: session.user.id, openKjSystemId: system.openKjSystemId },
      }),
      prisma.system.delete({ where: { id: system.id } }),
      prisma.state.upsert({
        where: { userId: session.user.id },
        update: { serial: { increment: BigInt(1) } },
        create: { userId: session.user.id, serial: BigInt(1) },
      }),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete system', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
