import { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user?: DefaultSession['user'] & {
      id: string
      accountType?: 'customer' | 'admin'
      adminLevel?: 'support' | 'super_admin'
      adminId?: string
      userId?: string
    }
  }

  interface User {
    accountType?: 'customer' | 'admin'
    adminLevel?: 'support' | 'super_admin'
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accountType?: 'customer' | 'admin'
    adminLevel?: 'support' | 'super_admin' | null
    adminId?: string | null
    userId?: string | null
  }
}
