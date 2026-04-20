// Better Auth session shape used throughout the app via getAuthSession().

export type AppAccountType = 'customer' | 'admin' | 'support'
export type AppAdminLevel = 'support' | 'super_admin'

export interface AppSessionUser {
  id: string
  email: string
  name: string | null
  image?: string | null
  accountType: AppAccountType
  adminLevel?: AppAdminLevel
  adminId?: string
  userId?: string
  mustSetPassword?: boolean
}

export interface AppSession {
  user: AppSessionUser
  session: {
    id: string
    token: string
    userId: string
    expiresAt: Date
  }
}
