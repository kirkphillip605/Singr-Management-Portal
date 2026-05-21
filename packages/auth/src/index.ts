// @singr/auth — unified authentication package
//
// Barrel export for the most commonly used auth utilities.
// Apps should prefer the more specific sub-path exports where possible:
//   import { auth } from '@singr/auth/server'
//   import { authClient } from '@singr/auth/client'
//   import { requireHostSession } from '@singr/auth/guards/host'
//   import { requireAdminSession } from '@singr/auth/guards/admin'

export { auth, getAuthForSurface, getAuthForHost } from './server'
export type { Auth, AuthSurface } from './server'
export { getAuthSession, hasRole, hasAnyRole } from './session'
export type { AuthSession } from './session'
