// src/app/api/openkj/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { logger } from '@/lib/logger'
import { z } from 'zod'
import Stripe from 'stripe'

export const runtime = 'nodejs'

/* ===========================
   Stripe helper (typed, pinned apiVersion)
   =========================== */

function getStripeClient(): Stripe {
  const secret = process.env.STRIPE_SECRET_KEY
  if (!secret) {
    throw new Error('STRIPE_SECRET_KEY is not set')
  }

  // Narrow env var to Stripe’s expected literal union; fallback to a pinned version.
  const apiVersion =
    (process.env.STRIPE_API_VERSION as Stripe.StripeConfig['apiVersion']) ??
    '2025-08-27.basil'

  return new Stripe(secret, { apiVersion })
}

/* ===========================
   Simple in-memory rate limit
   (use Redis / token bucket in production)
   =========================== */

const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

function rateLimit(ip: string): boolean {
  const now = Date.now()
  const windowMs = 60_000
  const maxRequests = 100

  const entry = rateLimitMap.get(ip)
  if (!entry) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs })
    return true
  }
  if (now > entry.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs })
    return true
  }
  if (entry.count >= maxRequests) return false

  entry.count += 1
  return true
}

/* ===========================
   Validation schemas
   =========================== */

const baseRequestSchema = z.object({
  api_key: z.string(),
  command: z.string(),
})

const venueCommandSchema = baseRequestSchema.extend({
  venue_id: z.number().optional(),
  system_id: z.number().default(1),
})

const requestSchema = venueCommandSchema.extend({
  request_id: z.number().optional(),
})

const acceptingSchema = venueCommandSchema.extend({
  accepting: z.union([z.boolean(), z.string()]).transform((val) => {
    if (typeof val === 'boolean') return val
    return val === 'true' || val === '1'
  }),
})

const addSongsSchema = baseRequestSchema.extend({
  songs: z.array(
    z.object({
      artist: z.string(),
      title: z.string(),
    })
  ),
  system_id: z.number().default(1),
})

/* ===========================
   Helpers
   =========================== */

/**
 * Ensures a state row exists for the given user and returns the latest serial.
 */
async function getOrCreateUserSerial(userId: string): Promise<number> {
  try {
    const existing = await prisma.state.findUnique({ where: { userId } })
    if (existing) {
      return Number(existing.serial)
    }

    const created = await prisma.state.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        serial: BigInt(1),
      },
    })
    return Number(created.serial)
  } catch (error) {
    const msg =
      error instanceof Error ? `${error.name}: ${error.message}` : String(error)
    logger.error(`Failed to fetch user serial: ${msg}`)
    return 1
  }
}

/**
 * Atomically increments the serial counter for a user.
 */
async function bumpUserSerial(userId: string): Promise<number> {
  try {
    const state = await prisma.state.upsert({
      where: { userId },
      update: {
        serial: { increment: BigInt(1) },
      },
      create: {
        userId,
        serial: BigInt(1),
      },
    })
    return Number(state.serial)
  } catch (error) {
    const msg =
      error instanceof Error ? `${error.name}: ${error.message}` : String(error)
    logger.error(`Failed to update serial: ${msg}`)
    return 0
  }
}

/**
 * Validates an incoming API key by comparing hashes against all keys.
 * Returns customer+user+venues on success, or an error response object.
 */
async function authenticateApiKey(apiKey: string) {
  try {
    const apiKeys = await prisma.apiKey.findMany({
      include: {
        customer: {
          include: {
            user: {
              include: {
                venues: true,
                systems: true,
              },
            },
          },
        },
      },
    })

    for (const key of apiKeys) {
      const isValid = await bcrypt.compare(apiKey, key.apiKeyHash)
      if (!isValid) continue

      if (key.status === 'suspended') {
        logger.warn(`API access denied - suspended key ${key.id}`)
        return {
          error: true,
          errorString:
            'The API key provided has been suspended. Visit https://billing.singrkaraoke.com/dashboard/billing for further information.',
        }
      }
      if (key.status === 'revoked') {
        logger.warn(`API access denied - revoked key ${key.id}`)
        return {
          error: true,
          errorString:
            'The API key provided has been permanently revoked and is no longer authorized. Generate a new key at https://billing.singrkaraoke.com/dashboard/api-keys',
        }
      }
      if (key.status !== 'active') {
        logger.warn(`API access denied - invalid status ${key.status} for key ${key.id}`)
        return { error: true, errorString: 'The API key provided is not currently active' }
      }

      const hasActiveSubscription = await verifyActiveSubscription(
        key.customer.stripeCustomerId
      )

      // Update last-used timestamp
      await prisma.apiKey.update({
        where: { id: key.id },
        data: { lastUsedAt: new Date() },
      })

      return {
        apiKeyId: key.id,
        customer: key.customer,
        user: key.customer.user,
        venues: key.customer.user.venues,
        systems: key.customer.user.systems,
        hasActiveSubscription,
      }
    }

    return null
  } catch (error) {
    const msg =
      error instanceof Error ? `${error.name}: ${error.message}` : String(error)
    logger.error(`API key authentication error: ${msg}`)
    return {
      error: true,
      errorString:
        'Authentication service temporarily unavailable. Try again later.',
    }
  }
}

/**
 * Guards: calls Stripe to ensure the customer has an active or trialing subscription.
 */
async function verifyActiveSubscription(stripeCustomerId: string): Promise<boolean> {
  try {
    const stripe = getStripeClient()

    const active = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'active',
      limit: 1,
    })
    if (active.data.length > 0) return true

    const trialing = await stripe.subscriptions.list({
      customer: stripeCustomerId,
      status: 'trialing',
      limit: 1,
    })
    return trialing.data.length > 0
  } catch (error) {
    const msg =
      error instanceof Error ? `${error.name}: ${error.message}` : String(error)
    logger.error(`Error verifying subscription: ${msg}`)
    return false
  }
}

function findVenue(venues: any[], venueId?: number) {
  if (!venueId) return null
  return venues.find((v) => v.openKjVenueId === venueId)
}

/* ===========================
   Handler
   =========================== */

export async function POST(request: NextRequest) {
  const ip = request.ip || 'unknown'

  try {
    // Basic rate limit
    if (!rateLimit(ip)) {
      return NextResponse.json(
        { error: true, errorString: 'Rate limit exceeded' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { command } = body as { command?: string }

    // String-only logging to satisfy stricter logger typings
    logger.info(
      `OpenKJ API request: command=${String(command)} ip=${ip} hasApiKey=${!!body?.api_key}`
    )

    // Validate base shape
    const baseValidation = baseRequestSchema.safeParse(body)
    if (!baseValidation.success) {
      return NextResponse.json(
        { command, error: true, errorString: 'Invalid request format' },
        { status: 400 }
      )
    }

    // Auth
    const auth = await authenticateApiKey(body.api_key)
    if (!auth || (auth as any).error) {
      return NextResponse.json(
        {
          command,
          error: true,
          errorString:
            (auth as any)?.errorString || 'Invalid API key or access denied',
        },
        { status: 401 }
      )
    }

    const { user, venues, systems, hasActiveSubscription } = auth as any

    switch (command) {
      case 'getSerial': {
        const serial = await getOrCreateUserSerial(user.id)
        return NextResponse.json({ command, serial, error: false })
      }

      case 'getRequests': {
        const validation = venueCommandSchema.safeParse(body)
        if (!validation.success) {
          return NextResponse.json(
            { command, error: true, errorString: 'venue_id is required' },
            { status: 400 }
          )
        }

        const venue = findVenue(venues, validation.data.venue_id)
        if (!venue) {
          return NextResponse.json(
            { command, error: true, errorString: 'Venue not found' },
            { status: 404 }
          )
        }

        // Only unprocessed rows; order by createdAt (oldest first)
        const requests = await prisma.request.findMany({
          where: {
            venueId: venue.id,
            processed: false,
          },
          orderBy: { createdAt: 'asc' },
        })

        const formatted = requests.map((req) => ({
          request_id: Number(req.requestId),
          artist: req.artist,
          title: req.title,
          singer: req.singer,
          request_time: Math.floor(req.createdAt.getTime() / 1000), // preserve API shape
          key_change: req.keyChange,
          // singer_id: req.singerId ?? null, // Optional future addition
        }))

        return NextResponse.json({
          command,
          requests: formatted,
          serial: await getOrCreateUserSerial(user.id),
          error: false,
        })
      }

      case 'deleteRequest': {
        const validation = requestSchema.safeParse(body)
        if (!validation.success || !validation.data.request_id) {
          return NextResponse.json(
            {
              command,
              error: true,
              errorString: 'venue_id and request_id are required',
            },
            { status: 400 }
          )
        }

        const venue = findVenue(venues, validation.data.venue_id)
        if (!venue) {
          return NextResponse.json(
            { command, error: true, errorString: 'Venue not found' },
            { status: 404 }
          )
        }

        // Soft-delete: mark processed = true
        const updated = await prisma.request.updateMany({
          where: {
            requestId: BigInt(validation.data.request_id),
            venueId: venue.id,
            processed: false,
          },
          data: { processed: true },
        })

        if (updated.count === 0) {
          return NextResponse.json(
            { command, error: true, errorString: 'Request not found' },
            { status: 404 }
          )
        }

        const newSerial = await bumpUserSerial(user.id)
        return NextResponse.json({ command, serial: newSerial, error: false })
      }

      case 'setAccepting': {
        const validation = acceptingSchema.safeParse(body)
        if (!validation.success) {
          return NextResponse.json(
            {
              command,
              error: true,
              errorString: 'venue_id and accepting status are required',
            },
            { status: 400 }
          )
        }

        const venue = findVenue(venues, validation.data.venue_id)
        if (!venue) {
          return NextResponse.json(
            { command, error: true, errorString: 'Venue not found' },
            { status: 404 }
          )
        }

        const system = systems.find(
          (s: any) => s.openKjSystemId === validation.data.system_id
        )
        if (!system) {
          return NextResponse.json(
            {
              command,
              error: true,
              errorString: `System ${validation.data.system_id} not found for user`,
            },
            { status: 404 }
          )
        }

        if (!hasActiveSubscription && validation.data.accepting) {
          logger.warn(
            `Blocked setAccepting due to inactive subscription userId=${user.id} venueId=${venue.id}`
          )
          return NextResponse.json(
            {
              command,
              error: true,
              errorString:
                'You must have an active subscription to accept requests.',
            },
            { status: 402 } // Payment Required is semantically reasonable
          )
        }

        const shouldBumpSerial =
          venue.acceptingRequests !== validation.data.accepting ||
          venue.accepting !== validation.data.accepting ||
          venue.currentSystemId !== system.openKjSystemId

        await prisma.venue.update({
          where: { id: venue.id },
          data: {
            acceptingRequests: validation.data.accepting,
            accepting: validation.data.accepting,
            currentSystemId: system.openKjSystemId,
          },
        })

        const newSerial = shouldBumpSerial
          ? await bumpUserSerial(user.id)
          : await getOrCreateUserSerial(user.id)

        return NextResponse.json({
          command,
          venue_id: validation.data.venue_id,
          accepting: validation.data.accepting,
          serial: newSerial,
          error: false,
        })
      }

      case 'getVenues': {
        const venuesFormatted = venues.map((venue: any) => ({
          venue_id: venue.openKjVenueId,
          name: venue.name,
          url_name: venue.urlName,
          accepting:
            typeof venue.accepting === 'boolean'
              ? venue.accepting
              : venue.acceptingRequests,
        }))
        return NextResponse.json({ command, venues: venuesFormatted, error: false })
      }

      case 'clearRequests': {
        const validation = venueCommandSchema.safeParse(body)
        if (!validation.success) {
          return NextResponse.json(
            { command, error: true, errorString: 'venue_id is required' },
            { status: 400 }
          )
        }

        const venue = findVenue(venues, validation.data.venue_id)
        if (!venue) {
          return NextResponse.json(
            { command, error: true, errorString: 'Venue not found' },
            { status: 404 }
          )
        }

        // Soft-clear: mark all as processed for that venue/system
        const cleared = await prisma.request.updateMany({
          where: {
            venueId: venue.id,
            processed: false,
          },
          data: { processed: true },
        })

        const newSerial =
          cleared.count > 0
            ? await bumpUserSerial(user.id)
            : await getOrCreateUserSerial(user.id)

        return NextResponse.json({ command, serial: newSerial, error: false })
      }

      case 'addSongs': {
        const validation = addSongsSchema.safeParse(body)
        if (!validation.success) {
          return NextResponse.json(
            {
              command,
              error: true,
              errorString: 'Songs array is required',
              errors: [],
              'entries processed': 0,
              last_artist: null,
              last_title: null,
              serial: 1,
            },
            { status: 400 }
          )
        }

        const { songs, system_id } = validation.data
        const system = systems.find((s: any) => s.openKjSystemId === system_id)
        if (!system) {
          return NextResponse.json(
            {
              command,
              error: true,
              errorString: `System ${system_id} not found for user`,
              errors: [],
              'entries processed': 0,
              last_artist: null,
              last_title: null,
              serial: await getOrCreateUserSerial(user.id),
            },
            { status: 404 }
          )
        }

        const errors: string[] = []
        let processedCount = 0
        let lastArtist: string | null = null
        let lastTitle: string | null = null

        const songsToAdd = songs
          .filter((song) => {
            const ok = !!song.artist?.trim() && !!song.title?.trim()
            if (!ok) errors.push(`Invalid song entry: ${JSON.stringify(song)}`)
            return ok
          })
          .map((song) => {
            const artist = song.artist.trim()
            const title = song.title.trim()
            const combined = `${artist} - ${title}`
            lastArtist = artist
            lastTitle = title
            return {
              userId: user.id,
              openKjSystemId: system.openKjSystemId,
              artist,
              title,
              combined,
              normalizedCombined: combined.toLowerCase(),
            }
          })

        if (songsToAdd.length > 0) {
          try {
            const result = await prisma.songDb.createMany({
              data: songsToAdd,
              skipDuplicates: true,
            })
            processedCount = result.count
          } catch (error) {
            const msg =
              error instanceof Error
                ? `${error.name}: ${error.message}`
                : String(error)
            logger.error(`Error adding songs: ${msg}`)
            errors.push('Database error during bulk add')
          }
        }

        const serial = await getOrCreateUserSerial(user.id)

        return NextResponse.json({
          command,
          error: errors.length > 0,
          errorString:
            errors.length > 0 ? 'Some errors occurred during song addition' : null,
          errors,
          'entries processed': processedCount,
          last_artist: lastArtist,
          last_title: lastTitle,
          serial,
        })
      }

      case 'clearDatabase': {
        const system_id: number = Number(body.system_id ?? 0)
        const system = systems.find((s: any) => s.openKjSystemId === system_id)
        if (!system) {
          return NextResponse.json(
            {
              command,
              error: true,
              errorString: `System ${system_id} not found for user`,
            },
            { status: 404 }
          )
        }

        await prisma.songDb.deleteMany({
          where: { userId: user.id, openKjSystemId: system.openKjSystemId },
        })

        const serial = await getOrCreateUserSerial(user.id)
        return NextResponse.json({ command, serial, error: false })
      }

      case 'getAlert': {
        return NextResponse.json({
          command,
          alert: false,
          title: '',
          message: '',
          error: false,
        })
      }

      case 'getEntitledSystemCount': {
        return NextResponse.json({
          command,
          count: systems.length,
          error: false,
        })
      }

      case 'connectionTest': {
        return NextResponse.json({ command, connection: 'ok' })
      }

      default: {
        return NextResponse.json({
          command,
          error: true,
          errorString: 'Unrecognized command',
        })
      }
    }
  } catch (error) {
    const msg =
      error instanceof Error ? `${error.name}: ${error.message}` : String(error)
    logger.error(`OpenKJ API error: ${msg}`)
    return NextResponse.json(
      { command: 'unknown', error: true, errorString: 'Internal server error' },
      { status: 500 }
    )
  }
}
