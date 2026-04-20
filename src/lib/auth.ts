import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import {
  twoFactor,
  phoneNumber,
  emailOTP,
  magicLink,
  oneTap,
  bearer,
  customSession,
  admin as adminPlugin,
} from 'better-auth/plugins'
import { nextCookies } from 'better-auth/next-js'
import { stripe as stripePlugin } from '@better-auth/stripe'
import Stripe from 'stripe'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import twilio from 'twilio'
import nodemailer from 'nodemailer'

/* ============================================================
 * Singr Karaoke Connect — unified Better Auth instance
 * ============================================================
 *
 * One Better Auth instance backs every public surface
 * (`singrkaraoke.com`, `host.*`, `app.*`, `admin.*`, `api.*`)
 * via a cookie scoped to `.singrkaraoke.com` so a session minted
 * on any subdomain is recognised on every other one. Per-surface
 * authorisation is enforced by middleware + the role-based guards
 * in `src/lib/host-auth.ts` / `src/lib/admin-auth.ts` reading the
 * `roles` array exposed on the session.
 *
 * Capacitor mobile clients live at `capacitor://localhost` /
 * `http://localhost` / `singr://*`; those origins are pre-trusted
 * below and the Bearer plugin lets the native app present its
 * session token via `Authorization: Bearer …`.
 */

/* ---------- Twilio (SMS / phone OTP) ---------- */

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER

const twilioClient =
  TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN
    ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    : null

async function sendSms(to: string, body: string) {
  if (!twilioClient || !TWILIO_FROM_NUMBER) {
    logger.warn(`Twilio not configured; would have sent SMS to ${to}: ${body}`)
    return
  }
  try {
    await twilioClient.messages.create({ to, from: TWILIO_FROM_NUMBER, body })
  } catch (err) {
    logger.error(
      `Failed to send SMS to ${to}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    )
    throw err
  }
}

/* ---------- SMTP (email — Mailjet/SendGrid/SES/etc) ---------- */

const SMTP_HOST = process.env.SMTP_HOST
const SMTP_PORT = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587
const SMTP_USER = process.env.SMTP_USER
const SMTP_PASS = process.env.SMTP_PASS
const SMTP_FROM =
  process.env.SMTP_FROM || process.env.EMAIL_FROM || 'no-reply@singr.local'

const mailTransport =
  SMTP_HOST && SMTP_USER && SMTP_PASS
    ? nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS },
      })
    : null

let warnedNoTransport = false

async function sendEmail(to: string, subject: string, body: string) {
  if (!mailTransport) {
    if (!warnedNoTransport) {
      logger.warn(
        'SMTP_HOST/SMTP_USER/SMTP_PASS not configured — auth emails will be logged instead of sent.',
      )
      warnedNoTransport = true
    }
    logger.info(`[email] to=${to} subject=${subject}\n${body}`)
    return
  }
  try {
    await mailTransport.sendMail({
      to,
      from: SMTP_FROM,
      subject,
      text: body,
    })
  } catch (err) {
    logger.error(
      `Failed to send email to ${to}: ${
        err instanceof Error ? err.message : String(err)
      }`,
    )
    throw err
  }
}

/* ---------- Base URL & secret ---------- */

const baseURL =
  process.env.BETTER_AUTH_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXTAUTH_URL ||
  (process.env['REPLIT_DEV_DOMAIN']
    ? `https://${process.env['REPLIT_DEV_DOMAIN']}`
    : 'http://localhost:5000')

const secret = process.env.BETTER_AUTH_SECRET || process.env.NEXTAUTH_SECRET
if (!secret) {
  throw new Error(
    'BETTER_AUTH_SECRET (or legacy NEXTAUTH_SECRET) must be set. Generate one with `openssl rand -base64 32`.',
  )
}

/* ---------- Cookie domain (cross-subdomain SSO) ---------- */

// In production every subdomain of singrkaraoke.com shares one session
// cookie. In local development we leave the domain unset so the cookie
// stays host-only, which matches how `*.localhost` is handled by browsers.
const cookieDomain =
  process.env['SINGR_COOKIE_DOMAIN'] ||
  (process.env.NODE_ENV === 'production' ? '.singrkaraoke.com' : undefined)

/* ---------- Social provider config (env-conditional) ---------- */

const googleClientId =
  process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''
const googleClientSecret =
  process.env.GOOGLE_CLIENT_SECRET ||
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET ||
  ''

const facebookClientId = process.env['FACEBOOK_CLIENT_ID'] || ''
const facebookClientSecret = process.env['FACEBOOK_CLIENT_SECRET'] || ''

const appleClientId = process.env['APPLE_CLIENT_ID'] || ''
const appleClientSecret = process.env['APPLE_CLIENT_SECRET'] || ''
const appleAppBundleIdentifier =
  process.env['APPLE_APP_BUNDLE_IDENTIFIER'] || 'com.singrkaraoke.app'

const socialProviders: Record<string, unknown> = {}
if (googleClientId && googleClientSecret) {
  socialProviders['google'] = {
    clientId: googleClientId,
    clientSecret: googleClientSecret,
  }
}
if (facebookClientId && facebookClientSecret) {
  socialProviders['facebook'] = {
    clientId: facebookClientId,
    clientSecret: facebookClientSecret,
  }
}
if (appleClientId && appleClientSecret) {
  socialProviders['apple'] = {
    clientId: appleClientId,
    clientSecret: appleClientSecret,
    appBundleIdentifier: appleAppBundleIdentifier,
  }
}

/* ---------- Stripe client + plan catalogue ---------- */

const stripeSecretKey = process.env.STRIPE_SECRET_KEY || ''
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || ''

const stripeClient = stripeSecretKey
  ? new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' as Stripe.LatestApiVersion })
  : null

// Plan catalogue. Each KJ ("host") gets one subscription that gates the
// whole portal. Override the price IDs by env so the same code works in
// test and live mode.
const hostPriceId = process.env['STRIPE_PRICE_HOST_MONTHLY'] || ''
const hostAnnualPriceId = process.env['STRIPE_PRICE_HOST_ANNUAL'] || ''

const stripePlans = hostPriceId
  ? [
      {
        name: 'host',
        priceId: hostPriceId,
        annualDiscountPriceId: hostAnnualPriceId || undefined,
        freeTrial: { days: 7 },
        limits: { venues: 50 },
      },
    ]
  : []

/* ---------- Build the unified auth instance ---------- */

const plugins: unknown[] = [
  adminPlugin({
    // The Better Auth admin plugin enforces its own role validation —
    // any role you pass here must already be declared in the plugin's
    // roles config. We don't use that path: every admin/host/support
    // gate in this app reads `session.user.roles` (see
    // `src/lib/admin-auth.ts` and `src/lib/customer-auth.ts`). Leaving
    // the plugin on its defaults keeps its built-in admin endpoints
    // (ban/unban/list-users) usable for the future support console
    // without dragging extra role validation in.
    defaultRole: 'host',
  }),
  twoFactor({
    issuer: 'Singr Karaoke Connect',
    otpOptions: {
      async sendOTP({ user, otp }) {
        const u = user as {
          email: string
          phoneNumber?: string | null
          phoneNumberVerified?: boolean
        }
        if (u.phoneNumber && u.phoneNumberVerified) {
          await sendSms(
            u.phoneNumber,
            `Your Singr verification code is: ${otp}`,
          )
          return
        }
        await sendEmail(
          u.email,
          'Your Singr verification code',
          `Your verification code is: ${otp}`,
        )
      },
    },
  }),
  phoneNumber({
    sendOTP: async ({ phoneNumber: to, code }) => {
      await sendSms(to, `Your Singr verification code is: ${code}`)
    },
  }),
  emailOTP({
    sendVerificationOTP: async ({ email, otp, type }) => {
      await sendEmail(
        email,
        type === 'sign-in'
          ? 'Your Singr sign-in code'
          : type === 'forget-password'
            ? 'Your Singr password reset code'
            : 'Your Singr verification code',
        `Your code is: ${otp}`,
      )
    },
  }),
  magicLink({
    sendMagicLink: async ({ email, url }) => {
      await sendEmail(
        email,
        'Sign in to Singr Karaoke',
        `Tap this link to sign in:\n\n${url}\n\nIt expires in 5 minutes.`,
      )
    },
  }),
  oneTap(),
  bearer(),
]

if (stripeClient && stripeWebhookSecret) {
  plugins.push(
    stripePlugin({
      stripeClient,
      stripeWebhookSecret,
      createCustomerOnSignUp: true,
      // Hosts only — singers + admins don't get a Stripe customer.
      getCustomerCreateParams: async (user: {
        id: string
        name?: string | null
      }) => {
        return {
          name: user.name || undefined,
          metadata: { source: 'singr-karaoke', userId: user.id },
        }
      },
      subscription: {
        enabled: true,
        plans: stripePlans,
        // When a host's subscription lapses, flip every venue they own
        // off so singers stop being able to submit requests. The host
        // billing UI surfaces a banner explaining the lapse.
        onSubscriptionDeleted: async ({ subscription }: { subscription: { id: string; plan: string; referenceId: string } }) => {
          await prisma.venue
            .updateMany({
              where: { userId: subscription.referenceId },
              data: { accepting: false, acceptingRequests: false },
            })
            .catch((err) =>
              logger.error(
                `Failed to disable venues on subscription cancel: ${err}`,
              ),
            )
          await prisma.auditLog
            .create({
              data: {
                actorId: subscription.referenceId,
                action: 'subscription.deleted',
                resource: 'subscription',
                resourceId: subscription.id,
                surface: 'system',
                metadata: { plan: subscription.plan },
              },
            })
            .catch(() => undefined)
        },
        onSubscriptionUpdate: async ({ subscription }: { subscription: { id: string; status: string; referenceId: string } }) => {
          if (
            subscription.status === 'past_due' ||
            subscription.status === 'unpaid' ||
            subscription.status === 'canceled'
          ) {
            await prisma.venue
              .updateMany({
                where: { userId: subscription.referenceId },
                data: { accepting: false },
              })
              .catch(() => undefined)
          }
        },
      },
    }) as unknown,
  )
}

// Custom session must run last so it can read the data added by the
// plugins above and merge our own claims (roles, businessName, etc.).
plugins.push(
  customSession(async ({ user, session }) => {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        roles: true,
        accountType: true,
        adminLevel: true,
        businessName: true,
        displayName: true,
        avatarUrl: true,
        mustSetPassword: true,
        stripeCustomerId: true,
        banned: true,
      },
    })

    const roles = computeRoles(dbUser)

    return {
      user: {
        ...user,
        roles,
        // Legacy fields kept for back-compat with existing route
        // handlers and React components. New code should read `roles`.
        accountType:
          dbUser?.accountType ??
          (roles.includes('host') ? 'customer' : roles[0] ?? 'customer'),
        adminLevel: dbUser?.adminLevel ?? undefined,
        businessName: dbUser?.businessName ?? undefined,
        displayName: dbUser?.displayName ?? undefined,
        avatarUrl: dbUser?.avatarUrl ?? undefined,
        mustSetPassword: !!dbUser?.mustSetPassword,
        stripeCustomerId: dbUser?.stripeCustomerId ?? undefined,
        banned: !!dbUser?.banned,
      },
      session,
    }
  }) as unknown,
)

plugins.push(nextCookies())

function computeRoles(
  dbUser:
    | {
        roles: string[]
        accountType: string | null
        adminLevel: string | null
      }
    | null
    | undefined,
): string[] {
  if (!dbUser) return ['host']
  if (dbUser.roles && dbUser.roles.length > 0) return dbUser.roles

  // Backfill: derive roles from the legacy enums for users that
  // existed before the rename migration.
  const r = new Set<string>()
  if (dbUser.accountType === 'customer') r.add('host')
  if (dbUser.accountType === 'support') r.add('support')
  if (dbUser.accountType === 'admin') {
    r.add('support')
    if (dbUser.adminLevel === 'super_admin') r.add('super_admin')
  }
  if (r.size === 0) r.add('host')
  return Array.from(r)
}

export const auth = betterAuth({
  appName: 'Singr Karaoke Connect',
  baseURL,
  secret,
  database: prismaAdapter(prisma, { provider: 'postgresql' }),

  advanced: {
    database: { generateId: () => crypto.randomUUID() },
    cookiePrefix: 'singr',
    crossSubDomainCookies: cookieDomain
      ? { enabled: true, domain: cookieDomain }
      : { enabled: false },
    defaultCookieAttributes: {
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      ...(cookieDomain ? { domain: cookieDomain } : {}),
    },
  },

  user: {
    additionalFields: {
      accountType: { type: 'string', required: false, input: false },
      adminLevel: { type: 'string', required: false, input: false },
      businessName: { type: 'string', required: false },
      displayName: { type: 'string', required: false },
      avatarUrl: { type: 'string', required: false },
      mustSetPassword: {
        type: 'boolean',
        required: false,
        defaultValue: false,
        input: false,
      },
      stripeCustomerId: { type: 'string', required: false, input: false },
      banned: { type: 'boolean', required: false, input: false },
      banReason: { type: 'string', required: false, input: false },
      lastLoginAt: { type: 'date', required: false, input: false },
      lastLoginMethod: { type: 'string', required: false, input: false },
      // `roles` is a Postgres text[]; we surface it as JSON in the
      // session via the customSession plugin above.
    },
    changeEmail: {
      enabled: true,
      sendChangeEmailVerification: async ({
        newEmail,
        url,
      }: {
        newEmail: string
        url: string
      }) => {
        await sendEmail(
          newEmail,
          'Confirm your new email address',
          `Click the link to confirm: ${url}`,
        )
      },
    },
  },

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
    autoSignIn: true,
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail(
        user.email,
        'Reset your password',
        `Click the link to reset your password: ${url}`,
      )
    },
  },

  emailVerification: {
    sendOnSignUp: false,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail(
        user.email,
        'Verify your email',
        `Click the link to verify your email: ${url}`,
      )
    },
  },

  socialProviders:
    Object.keys(socialProviders).length > 0
      ? (socialProviders as Parameters<typeof betterAuth>[0]['socialProviders'])
      : undefined,

  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ['google', 'facebook', 'apple', 'credential'],
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },

  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          try {
            // Default new sign-ups to the host role unless explicitly
            // marked otherwise. The signer/onboarding flow in task #26
            // promotes singer-app sign-ups to ['singer'] before the
            // first session is issued.
            await prisma.user.update({
              where: { id: user.id },
              data: {
                roles: { set: ['host'] },
                accountType: 'customer',
              },
            })

            // Initialize System and State for hosts so the venue editor
            // works on first login (idempotent via unique constraints).
            await prisma.system
              .create({
                data: {
                  userId: user.id,
                  name: 'Main System',
                  openkjSystemId: 1,
                },
              })
              .catch(() => undefined)
            await prisma.state
              .upsert({
                where: { userId: user.id },
                update: {},
                create: { userId: user.id, serial: BigInt(1) },
              })
              .catch(() => undefined)

            await prisma.auditLog
              .create({
                data: {
                  actorId: user.id,
                  action: 'user.created',
                  resource: 'user',
                  resourceId: user.id,
                  surface: 'system',
                  metadata: { email: user.email },
                },
              })
              .catch(() => undefined)
          } catch (err) {
            logger.error(
              `Failed to provision new user ${user.id}: ${
                err instanceof Error ? err.message : String(err)
              }`,
            )
          }
        },
      },
    },
    account: {
      create: {
        after: async (account) => {
          try {
            if (account.providerId === 'credential') {
              await prisma.user.update({
                where: { id: account.userId },
                data: { mustSetPassword: false },
              })
              return
            }
            const credential = await prisma.account.findFirst({
              where: { userId: account.userId, providerId: 'credential' },
              select: { id: true },
            })
            if (!credential) {
              await prisma.user.update({
                where: { id: account.userId },
                data: { mustSetPassword: true },
              })
            }
          } catch (err) {
            logger.error(
              `Failed to update mustSetPassword for ${account.userId}: ${
                err instanceof Error ? err.message : String(err)
              }`,
            )
          }
        },
      },
    },
    session: {
      create: {
        after: async (session) => {
          await prisma.user
            .update({
              where: { id: session.userId },
              data: { lastLoginAt: new Date() },
            })
            .catch(() => undefined)
        },
      },
    },
  },

  plugins: plugins as Parameters<typeof betterAuth>[0]['plugins'],

  trustedOrigins: [
    baseURL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env['REPLIT_DEV_DOMAIN']
      ? `https://${process.env['REPLIT_DEV_DOMAIN']}`
      : undefined,
    'http://localhost:5000',
    'http://0.0.0.0:5000',
    // Production subdomains
    'https://singrkaraoke.com',
    'https://www.singrkaraoke.com',
    'https://host.singrkaraoke.com',
    'https://api.singrkaraoke.com',
    'https://app.singrkaraoke.com',
    'https://admin.singrkaraoke.com',
    // Local subdomain aliases for development
    'http://host.localhost:5000',
    'http://api.localhost:5000',
    'http://admin.localhost:5000',
    'http://app.localhost:5000',
    // Capacitor / native shell
    'capacitor://localhost',
    'http://localhost',
    'singr://*',
  ].filter((u): u is string => !!u),
})

export type Auth = typeof auth

/* ---------- Backwards-compat shims ----------
 * The previous architecture exposed per-surface auth instances via
 * `getAuthForHost(host)` / `getAuthForSurface(surface)`. We've collapsed
 * to a single instance now (cookie scoped to `.singrkaraoke.com`), but
 * keep these helpers as aliases so existing callers (the
 * `/api/auth/[...all]` handler, `getAuthSession()`, etc.) keep working
 * without a sweeping change.
 */

export type AuthSurface = 'host' | 'admin' | 'singer' | 'web'

export function getAuthForSurface(_surface: AuthSurface) {
  return auth
}

export function getAuthForHost(_hostHeader: string | null | undefined) {
  return auth
}

export const SURFACE_COOKIE_PREFIXES = {
  host: 'singr',
  admin: 'singr',
  singer: 'singr',
  web: 'singr',
} as const
