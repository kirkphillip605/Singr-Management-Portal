import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user?: DefaultSession['user'] & {
      id: string
      accountType?: 'customer' | 'admin' | 'support'
      adminLevel?: 'support' | 'super_admin'
      adminId?: string
      userId?: string
      fusionauthUserId?: string
      singrUserId?: string
      customerProfileId?: string
      roles?: string[]
    }
  }

  interface User {
    accountType?: 'customer' | 'admin' | 'support'
    adminLevel?: 'support' | 'super_admin'
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accountType?: 'customer' | 'admin' | 'support'
    adminLevel?: 'support' | 'super_admin' | null
    adminId?: string | null
    userId?: string | null
    fusionauthUserId?: string
    singrUserId?: string
    customerProfileId?: string
    roles?: string[]
  }
}
