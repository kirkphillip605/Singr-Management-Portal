// auth.ts

import { NextAuthOptions } from 'next-auth'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/auth/signin',
  },
  providers: [
    {
      id: 'fusionauth',
      name: 'FusionAuth',
      type: 'oauth',
      wellKnown: `${process.env.FUSIONAUTH_ISSUER}/.well-known/openid-configuration`,
      authorization: {
        params: {
          scope: 'openid email profile',
        },
      },
      clientId: process.env.FUSIONAUTH_CLIENT_ID,
      clientSecret: process.env.FUSIONAUTH_CLIENT_SECRET,
      issuer: process.env.FUSIONAUTH_ISSUER,
      profile(profile) {
        return {
          id: profile.sub,
          email: profile.email,
          name: profile.name || profile.email,
          image: profile.picture,
        }
      },
    },
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        // Store the FusionAuth user ID in the token
        token.fusionauthUserId = user.id
        
        // Find or create the SingrUser
        let singrUser = await prisma.singrUser.findUnique({
          where: { fusionauthUserId: user.id },
          include: {
            adminProfile: true,
            customerProfile: true,
            singerProfile: true,
          },
        })

        // If user doesn't exist in our database, create them
        if (!singrUser) {
          singrUser = await prisma.singrUser.create({
            data: {
              fusionauthUserId: user.id,
              email: user.email!,
              name: user.name || user.email!,
              image: user.image,
            },
            include: {
              adminProfile: true,
              customerProfile: true,
              singerProfile: true,
            },
          })
        }

        token.singrUserId = singrUser.id
        
        // Determine account type based on profiles
        if (singrUser.adminProfile) {
          token.accountType = 'admin'
          token.adminLevel = singrUser.adminProfile.adminLevel as 'support' | 'super_admin'
          token.adminId = singrUser.id
          token.userId = null
        } else if (singrUser.customerProfile) {
          token.accountType = 'customer'
          token.adminLevel = null
          token.adminId = null
          token.userId = singrUser.id
          token.customerProfileId = singrUser.customerProfile.id
        } else {
          // Default to customer if no profile exists
          token.accountType = 'customer'
          token.adminLevel = null
          token.adminId = null
          token.userId = singrUser.id
        }

        // Check for required role from FusionAuth token
        if (account?.access_token) {
          // Store roles from FusionAuth if available in the token
          token.roles = (account as any).roles || []
        }
      }
      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        const accountType = (token.accountType as string) ?? 'customer'
        session.user.accountType = accountType as any
        session.user.fusionauthUserId = token.fusionauthUserId as string
        session.user.singrUserId = token.singrUserId as string

        if (accountType === 'admin') {
          session.user.id = (token.adminId as string) ?? (token.singrUserId as string)
          session.user.adminLevel = token.adminLevel as any
          session.user.adminId = token.adminId as string | undefined
        } else {
          session.user.id = (token.userId as string) ?? (token.singrUserId as string)
          session.user.adminLevel = undefined
          session.user.adminId = undefined
        }

        session.user.userId = token.userId as string | undefined
        session.user.customerProfileId = token.customerProfileId as string | undefined
        session.user.roles = (token.roles as string[]) || []
      }
      return session
    },
    async redirect({ url, baseUrl }) {
      // Allows relative callback URLs
      if (url.startsWith('/')) return `${baseUrl}${url}`
      // Allows callback URLs on the same origin
      else if (new URL(url).origin === baseUrl) return url
      return baseUrl
    },
  },
  events: {
    async createUser({ user }) {
      // This event is called when a new user is created via the adapter
      // For FusionAuth users, we handle user creation in the JWT callback instead
      logger.info(`User event triggered for: ${user.id}`)
    },
  },
}
