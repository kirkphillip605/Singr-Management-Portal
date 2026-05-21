'use client'

import { createAuthClient } from 'better-auth/react'
import {
  twoFactorClient,
  phoneNumberClient,
  emailOTPClient,
} from 'better-auth/client/plugins'

// In the browser we use a relative baseURL so requests always go through the
// same origin the app is being served from (avoids CORS when accessed via the
// Replit dev domain vs. 0.0.0.0:5000). On the server we fall back to env vars.
const baseURL =
  typeof window !== 'undefined'
    ? window.location.origin
    : (process.env['NEXT_PUBLIC_BETTER_AUTH_URL'] as string | undefined) ||
      (process.env['NEXT_PUBLIC_APP_URL'] as string | undefined)

export const authClient = createAuthClient({
  baseURL,
  plugins: [
    twoFactorClient({
      onTwoFactorRedirect: () => {
        window.location.href = '/auth/2fa'
      },
    }),
    phoneNumberClient(),
    emailOTPClient(),
  ],
})

export const {
  signIn,
  signUp,
  signOut,
  useSession,
  getSession,
  resetPassword,
  changePassword,
  changeEmail,
  updateUser,
  twoFactor,
  phoneNumber,
  emailOtp,
  linkSocial,
  unlinkAccount,
  listAccounts,
} = authClient

export const forgetPassword = authClient.forgetPassword
