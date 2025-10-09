// src/app/api/auth/signup/route.ts
// ───────────────────────────────────────────────────────────────────────────────
// Creates a new user, Stripe customer, initial Customer row, the user's first
// System with openKjSystemId=1, and initializes State.
// Includes robust validation and pinned Stripe API version.

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import Stripe from 'stripe'

export const runtime = 'nodejs'

const signupSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  businessName: z.string().optional(),
  phoneNumber: z.string().optional(),
})

function getStripeClient(): Stripe {
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) {
    throw new Error('STRIPE_SECRET_KEY is not set')
  }

  // Pin to a known-good version; allow override via env if you explicitly set it.
  const apiVersion =
    (process.env.STRIPE_API_VERSION as Stripe.StripeConfig['apiVersion']) ??
    '2025-08-27.basil'

  return new Stripe(secret, { apiVersion })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validatedData = signupSchema.parse(body)

    // Ensure uniqueness on email
    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
      select: { id: true },
    })
    if (existingUser) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 400 }
      )
    }

    const passwordHash = await bcrypt.hash(validatedData.password, 12)

    // Create user first
    const user = await prisma.user.create({
      data: {
        name: validatedData.name,
        email: validatedData.email,
        passwordHash,
        businessName: validatedData.businessName || null,
        phoneNumber: validatedData.phoneNumber || null,
      },
    })

    // Create Stripe customer (typed + pinned apiVersion)
    const stripe = getStripeClient()
    const customer = await stripe.customers.create({
      email: user.email,
      name: user.name || undefined,
      metadata: { userId: user.id },
    })

    // Initialize related records atomically
    await prisma.$transaction([
      prisma.customer.create({
        data: {
          // If your Customer PK differs, adjust accordingly.
          id: user.id,
          stripeCustomerId: customer.id,
        },
      }),
      prisma.system.create({
        data: {
          userId: user.id,
          name: 'Main System',
          // FIRST system is always 1 for that user.
          openKjSystemId: 1,
        },
      }),
      prisma.state.create({
        data: {
          userId: user.id,
          // Use BigInt in DB; we do not serialize this value in the response.
          serial: BigInt(1),
        },
      }),
    ])

    return NextResponse.json(
      {
        message: 'User created successfully',
        user: { id: user.id, name: user.name, email: user.email },
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.errors[0]?.message ?? 'Validation error' },
        { status: 400 }
      )
    }
    console.error('Signup error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
