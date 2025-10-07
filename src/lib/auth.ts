import { NextAuthOptions } from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import CredentialsProvider from 'next-auth/providers/credentials'
import GoogleProvider from 'next-auth/providers/google'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { logger } from '@/lib/logger'

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
})

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/auth/signin',
    signUp: '/auth/signup',
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        try {
          const { email, password } = loginSchema.parse(credentials)

          const user = await prisma.user.findUnique({
            where: { email },
            select: {
              id: true,
              email: true,
              name: true,
              passwordHash: true,
              image: true,
              accountType: true,
              adminLevel: true,
            },
          })

          if (!user?.passwordHash) {
            return null
          }

          const isValidPassword = await bcrypt.compare(password, user.passwordHash)

          if (!isValidPassword) {
            return null
          }

          const accountType = (user.accountType as 'customer' | 'admin' | null) ?? 'customer'

          if (accountType === 'admin') {
            return {
              id: user.id,
              email: user.email,
              name: user.name,
              image: user.image,
              accountType: 'admin' as const,
              adminLevel: (user.adminLevel as 'support' | 'super_admin' | null) ?? 'support',
            }
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image,
            accountType: 'customer' as const,
          }
        } catch {
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const accountType = (user as any).accountType ?? 'customer'
        token.accountType = accountType

        if (accountType === 'admin') {
          token.adminId = user.id
          token.adminLevel = (user as any).adminLevel
          token.userId = null
          token.id = user.id
        } else {
          token.userId = user.id
          token.adminId = null
          token.adminLevel = null
          token.id = user.id
        }
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        const accountType = (token.accountType as string) ?? 'customer'
        session.user.accountType = accountType as any

        if (accountType === 'admin') {
          session.user.id = (token.adminId as string) ?? (token.id as string)
          session.user.adminLevel = token.adminLevel as any
          session.user.adminId = token.adminId as string | undefined
        } else {
          session.user.id = (token.userId as string) ?? (token.id as string)
          session.user.adminLevel = undefined
          session.user.adminId = undefined
        }

        session.user.userId = token.userId as string | undefined
      }
      return session
    },
    async redirect({ url, baseUrl }) {
      // Allows relative callback URLs
      if (url.startsWith("/")) return `${baseUrl}${url}`
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url;
      return baseUrl;
    },
  },
  events: {
    async createUser({ user }) {
      // Create Stripe customer when user is created
      try {
        const { stripe } = await import('@/lib/stripe')

        const customer = await stripe.customers.create({
          email: user.email!,
          name: user.name || undefined,
          metadata: {
            userId: user.id,
          },
        })

        await prisma.customer.create({
          data: {
            id: user.id,
            stripeCustomerId: customer.id,
          },
        })

        logger.info(`Stripe customer created for user ${user.id}: ${customer.id}`)
      } catch (error) {
        logger.error('Failed to create Stripe customer:', error)
      }
    },
  },
}