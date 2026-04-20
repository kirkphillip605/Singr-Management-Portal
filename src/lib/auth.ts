import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { twoFactor, phoneNumber, emailOTP } from 'better-auth/plugins'
import { nextCookies } from 'better-auth/next-js'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import twilio from 'twilio'
import nodemailer from 'nodemailer'

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER

const twilioClient =
  TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN
    ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
    : null

async function sendSms(to: string, body: string) {
  if (!twilioClient || !TWILIO_FROM_NUMBER) {
    logger.warn(
      `Twilio not configured; would have sent SMS to ${to}: ${body}`
    )
    return
  }
  try {
    await twilioClient.messages.create({
      to,
      from: TWILIO_FROM_NUMBER,
      body,
    })
  } catch (err) {
    logger.error(
      `Failed to send SMS to ${to}: ${
        err instanceof Error ? err.message : String(err)
      }`
    )
    throw err
  }
}

// Lazily-built SMTP transporter. Configured via standard SMTP_* env vars so
// any provider (SendGrid, Postmark, SES, Mailgun, plain SMTP) works without
// code changes. If the env is incomplete we degrade to logger output and
// emit a single warning per process so devs know why messages aren't sent.
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
        'SMTP_HOST/SMTP_USER/SMTP_PASS not configured — auth emails will be logged instead of sent.'
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
      }`
    )
    throw err
  }
}

const baseURL =
  process.env.BETTER_AUTH_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXTAUTH_URL ||
  (process.env['REPLIT_DEV_DOMAIN']
    ? `https://${process.env['REPLIT_DEV_DOMAIN']}`
    : 'http://localhost:5000')

const secret = process.env.BETTER_AUTH_SECRET || process.env.NEXTAUTH_SECRET
if (!secret) {
  // Fail closed: never allow a known/static fallback secret in any
  // environment. Sessions sealed with a default secret would be trivially
  // forgeable by anyone reading the code.
  throw new Error(
    'BETTER_AUTH_SECRET (or legacy NEXTAUTH_SECRET) must be set. Generate one with `openssl rand -base64 32`.'
  )
}

const googleClientId =
  process.env.GOOGLE_CLIENT_ID || process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''
const googleClientSecret =
  process.env.GOOGLE_CLIENT_SECRET ||
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_SECRET ||
  ''

export const auth = betterAuth({
  appName: 'Singr Karaoke Connect',
  baseURL,
  secret,
  database: prismaAdapter(prisma, { provider: 'postgresql' }),

  // Postgres `id` columns are UUIDs in our schema; tell Better Auth to
  // generate UUIDs instead of its default nanoid-style strings.
  advanced: {
    database: {
      generateId: () => crypto.randomUUID(),
    },
  },

  user: {
    additionalFields: {
      accountType: {
        type: 'string',
        required: false,
        defaultValue: 'customer',
        input: false,
      },
      adminLevel: {
        type: 'string',
        required: false,
        input: false,
      },
      businessName: {
        type: 'string',
        required: false,
      },
      mustSetPassword: {
        type: 'boolean',
        required: false,
        defaultValue: false,
        input: false,
      },
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
          `Click the link to confirm: ${url}`
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
        `Click the link to reset your password: ${url}`
      )
    },
  },

  emailVerification: {
    sendOnSignUp: false,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail(
        user.email,
        'Verify your email',
        `Click the link to verify your email: ${url}`
      )
    },
  },

  socialProviders: googleClientId && googleClientSecret
    ? {
        google: {
          clientId: googleClientId,
          clientSecret: googleClientSecret,
        },
      }
    : undefined,

  account: {
    accountLinking: {
      // Allow Google to link onto an existing email/password account when
      // the verified email matches. `credential` is the provider id Better
      // Auth uses for email+password accounts (matching the `account.create`
      // hook below and the settings UI's `hasCredential` check).
      enabled: true,
      trustedProviders: ['google', 'credential'],
    },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // 1 day
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },

  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          try {
            const { stripe } = await import('@/lib/stripe')
            const customer = await stripe.customers.create({
              email: user.email,
              name: user.name || undefined,
              metadata: { userId: user.id },
            })

            await prisma.customer.upsert({
              where: { id: user.id },
              update: { stripeCustomerId: customer.id },
              create: {
                id: user.id,
                userId: user.id,
                stripeCustomerId: customer.id,
              },
            })

            // Initialize System and State if not present (parallel to legacy
            // signup flow). These are idempotent due to unique constraints.
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

            logger.info(
              `Stripe customer + initial system created for user ${user.id}`
            )
          } catch (err) {
            logger.error(
              `Failed to provision new user ${user.id}: ${
                err instanceof Error ? err.message : String(err)
              }`
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
              // The user just gained an email+password credential — they no
              // longer need the "set your password" prompt. This runs on the
              // trusted server side via Better Auth's databaseHooks, which
              // is the only reliable way to mutate fields configured with
              // `input: false` like `mustSetPassword`.
              await prisma.user.update({
                where: { id: account.userId },
                data: { mustSetPassword: false },
              })
              return
            }

            // OAuth (e.g. Google) account created. If this user has no
            // credential account yet, flag them so the dashboard layout
            // routes them through `/auth/set-password` on next visit.
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
              }`
            )
          }
        },
      },
    },
  },

  plugins: [
    twoFactor({
      issuer: 'Singr Karaoke Connect',
      otpOptions: {
        // Channel selection: if the user has a verified phone number we
        // deliver the 2FA OTP via SMS (Twilio); otherwise we fall back to
        // email. Authenticator-app TOTP is independent and handled by the
        // plugin's verifyTotp endpoint. The user picks the channel they
        // want at the /auth/2fa challenge page (TOTP / OTP / Backup).
        async sendOTP({ user, otp }) {
          const u = user as { email: string; phoneNumber?: string | null; phoneNumberVerified?: boolean }
          if (u.phoneNumber && u.phoneNumberVerified) {
            await sendSms(
              u.phoneNumber,
              `Your Singr verification code is: ${otp}`
            )
            return
          }
          await sendEmail(
            u.email,
            'Your Singr verification code',
            `Your verification code is: ${otp}`
          )
        },
      },
    }),
    phoneNumber({
      // Phone is a *login method only* for users who have already signed up
      // with name/email/password/businessName and verified a phone number
      // on their profile. We deliberately omit `signUpOnVerification` so
      // the OTP flow can never implicitly create an account from a stray
      // number entered on the sign-in page.
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
          `Your code is: ${otp}`
        )
      },
    }),
    nextCookies(),
  ],

  trustedOrigins: [
    baseURL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env['REPLIT_DEV_DOMAIN']
      ? `https://${process.env['REPLIT_DEV_DOMAIN']}`
      : undefined,
    'http://localhost:5000',
    'http://0.0.0.0:5000',
  ].filter((u): u is string => !!u),
})

export type Auth = typeof auth
