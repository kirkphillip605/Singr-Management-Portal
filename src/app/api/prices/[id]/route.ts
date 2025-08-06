import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const price = await prisma.price.findUnique({
      where: { id: params.id },
      include: {
        product: true,
      },
    })

    if (!price) {
      return NextResponse.json({ error: 'Price not found' }, { status: 404 })
    }

    return NextResponse.json(price)
  } catch (error) {
    console.error('Error fetching price:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}