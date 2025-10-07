// file: src/app/api/openkj/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { logger } from '@/lib/logger'
import { z } from 'zod'
export const runtime = 'nodejs'



/**
 * In production, prefer Redis or a distributed token bucket.
 */
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
  system_id: z.number().default(0),
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
  songs: z.array(z.object({
    artist: z.string(),
    title: z.string(),
  })),
  system_id: z.number().default(0),
})

/* ===========================
   Helpers
   =========================== */

/**
 * Atomically increments the serial for a (venueId, systemId) pair,
 * creating the state row when needed.
 */
async function updateSerial(venueId: string, systemId: number): Promise<number> {
  try {
    const state = await prisma.state.upsert({
      where: {
        venueId_systemId: {
          venueId,
          systemId,
        },
      },
      update: {
        serial: { increment: 1 },
      },
      create: {
        venueId,
        systemId,
        serial: 1,
        accepting: false,
      },
    })
    return state.serial
  } catch (error) {
    logger.error('Failed to update serial:', error)
    return 0
  }
}

/**
 * Validates an incoming API key by comparing hashes against all active keys.
 * Returns the owning customer+user+venues on success, or a detailed error.
 */
async function authenticateApiKey(apiKey: string) {
  try {
    const apiKeys = await prisma.apiKey.findMany({
      include: {
        customer: {
          include: {
            user: {
              include: {
                venues: {
                  include: { states: true },
                },
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

      const hasActiveSubscription = await verifyActiveSubscription(key.customer.stripeCustomerId)
      if (!hasActiveSubscription) {
        logger.warn(`API access denied - no active subscription for customer ${key.customer.id}`)
        return {
          error: true,
          errorString:
            'The API key provided is SUSPENDED. Visit https://billing.singrkaraoke.com/dashboard/billing for more details',
        }
      }

      // Async but not awaited intentionally? We will await to keep it tidy.
      await prisma.apiKey.update({
        where: { id: key.id },
        data: { lastUsedAt: new Date() },
      })

      return {
        apiKeyId: key.id,
        customer: key.customer,
        user: key.customer.user,
        venues: key.customer.user.venues,
      }
    }

    return null
  } catch (error) {
    logger.error('API key authentication error:', error)
    return {
      error: true,
      errorString: 'Authentication service temporarily unavailable. Try again later.',
    }
  }
}

/**
 * Guards: calls Stripe to ensure the customer has an active or trialing subscription.
 */
async function verifyActiveSubscription(stripeCustomerId: string): Promise<boolean> {
  try {
    const stripe = await import('stripe').then(
      (m) => new m.default(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-06-20' }),
    )

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
    logger.error('Error verifying subscription:', error)
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
      return NextResponse.json({ error: true, errorString: 'Rate limit exceeded' }, { status: 429 })
    }

    const body = await request.json()
    const { command } = body as { command?: string }

    logger.info(`OpenKJ API request: ${command}`, {
      ip,
      command,
      hasApiKey: !!body?.api_key,
    })

    // Validate base shape
    const baseValidation = baseRequestSchema.safeParse(body)
    if (!baseValidation.success) {
      return NextResponse.json(
        { command, error: true, errorString: 'Invalid request format' },
        { status: 400 },
      )
    }

    // Auth
    const auth = await authenticateApiKey(body.api_key)
    if (!auth || (auth as any).error) {
      return NextResponse.json({
        command,
        error: true,
        errorString: (auth as any)?.errorString || 'Invalid API key or access denied',
      })
    }

    const { user, venues } = auth as any

    switch (command) {
      case 'getSerial': {
        // Highest serial across all venues for the requested system_id
        const systemId = Number(body.system_id ?? 0)
        const maxSerial = venues.reduce((max: number, venue: any) => {
          const state = venue.states?.find((s: any) => s.systemId === systemId)
          return Math.max(max, state?.serial || 1)
        }, 1)

        return NextResponse.json({ command, serial: maxSerial, error: false })
      }

      case 'getRequests': {
        const validation = venueCommandSchema.safeParse(body)
        if (!validation.success) {
          return NextResponse.json({
            command,
            error: true,
            errorString: 'venue_id is required',
          })
        }

        const venue = findVenue(venues, validation.data.venue_id)
        if (!venue) {
          return NextResponse.json({ command, error: true, errorString: 'Venue not found' })
        }

        // Only unprocessed rows; order by createdAt (oldest first)
        const requests = await prisma.request.findMany({
          where: {
            venueId: venue.id,
            systemId: validation.data.system_id,
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
          // Optional: include singer_id if you want clients to adopt it
          // singer_id: req.singerId ?? null,
        }))

        const state = await prisma.state.findUnique({
          where: {
            venueId_systemId: { venueId: venue.id, systemId: validation.data.system_id },
          },
        })

        return NextResponse.json({
          command,
          requests: formatted,
          serial: state?.serial || 1,
          error: false,
        })
      }

      case 'deleteRequest': {
        const validation = requestSchema.safeParse(body)
        if (!validation.success || !validation.data.request_id) {
          return NextResponse.json({
            command,
            error: true,
            errorString: 'venue_id and request_id are required',
          })
        }

        const venue = findVenue(venues, validation.data.venue_id)
        if (!venue) {
          return NextResponse.json({ command, error: true, errorString: 'Venue not found' })
        }

        // Soft-delete: mark processed = true
        const updated = await prisma.request.updateMany({
          where: {
            requestId: BigInt(validation.data.request_id),
            venueId: venue.id,
            systemId: validation.data.system_id,
            processed: false,
          },
          data: { processed: true },
        })

        if (updated.count === 0) {
          return NextResponse.json({ command, error: true, errorString: 'Request not found' })
        }

        const newSerial = await updateSerial(venue.id, validation.data.system_id)
        return NextResponse.json({ command, serial: newSerial, error: false })
      }

      case 'setAccepting': {
        const validation = acceptingSchema.safeParse(body)
        if (!validation.success) {
          return NextResponse.json({
            command,
            error: true,
            errorString: 'venue_id and accepting status are required',
          })
        }

        const venue = findVenue(venues, validation.data.venue_id)
        if (!venue) {
          return NextResponse.json({ command, error: true, errorString: 'Venue not found' })
        }

        await prisma.venue.update({
          where: { id: venue.id },
          data: { acceptingRequests: validation.data.accepting },
        })

        await prisma.state.upsert({
          where: {
            venueId_systemId: {
              venueId: venue.id,
              systemId: validation.data.system_id,
            },
          },
          update: { accepting: validation.data.accepting },
          create: {
            venueId: venue.id,
            systemId: validation.data.system_id,
            accepting: validation.data.accepting,
            serial: 1,
          },
        })

        const newSerial = await updateSerial(venue.id, validation.data.system_id)

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
          accepting: venue.acceptingRequests,
        }))
        return NextResponse.json({ command, venues: venuesFormatted, error: false })
      }

      case 'clearRequests': {
        const validation = venueCommandSchema.safeParse(body)
        if (!validation.success) {
          return NextResponse.json({
            command,
            error: true,
            errorString: 'venue_id is required',
          })
        }

        const venue = findVenue(venues, validation.data.venue_id)
        if (!venue) {
          return NextResponse.json({ command, error: true, errorString: 'Venue not found' })
        }

        // Soft-clear: mark all as processed for that venue/system
        await prisma.request.updateMany({
          where: {
            venueId: venue.id,
            systemId: validation.data.system_id,
            processed: false,
          },
          data: { processed: true },
        })

        const newSerial = await updateSerial(venue.id, validation.data.system_id)
        return NextResponse.json({ command, serial: newSerial, error: false })
      }

      case 'addSongs': {
        const validation = addSongsSchema.safeParse(body)
        if (!validation.success) {
          return NextResponse.json({
            command,
            error: true,
            errorString: 'Songs array is required',
            errors: [],
            'entries processed': 0,
            last_artist: null,
            last_title: null,
            serial: 1,
          })
        }

        const { songs, system_id } = validation.data
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
              systemId: system_id,
              artist,
              title,
              combined,
              normalizedCombined: combined.toLowerCase(),
            }
          })

        if (songsToAdd.length > 0) {
          try {
            await prisma.songDb.createMany({ data: songsToAdd, skipDuplicates: true })
            processedCount = songsToAdd.length
          } catch (error) {
            logger.error('Error adding songs:', error)
            errors.push('Database error during bulk add')
          }
        }

        const state = await prisma.state.findFirst({
          where: { venue: { userId: user.id }, systemId: system_id },
        })

        return NextResponse.json({
          command,
          error: errors.length > 0,
          errorString: errors.length > 0 ? 'Some errors occurred during song addition' : null,
          errors,
          'entries processed': processedCount,
          last_artist: lastArtist,
          last_title: lastTitle,
          serial: state?.serial || 1,
        })
      }

      case 'clearDatabase': {
        const system_id: number = Number(body.system_id ?? 0)
        await prisma.songDb.deleteMany({ where: { userId: user.id, systemId: system_id } })

        const state = await prisma.state.findFirst({
          where: { venue: { userId: user.id }, systemId: system_id },
        })

        return NextResponse.json({ command, serial: state?.serial || 1, error: false })
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
          count: Math.max(venues.length, 1),
          error: false,
        })
      }

      case 'connectionTest': {
        return NextResponse.json({ command, connection: 'ok' })
      }

      default: {
        return NextResponse.json({ command, error: true, errorString: 'Unrecognized command' })
      }
    }
  } catch (error) {
    logger.error('OpenKJ API error:', error)
    return NextResponse.json(
      { command: 'unknown', error: true, errorString: 'Internal server error' },
      { status: 500 },
    )
  }
}
