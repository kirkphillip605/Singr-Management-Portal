import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
export const runtime = 'nodejs'



export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const paramsResolved = await params

  try {
    const price = await prisma.price.findUnique({
      where: { id: paramsResolved.id },
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