import { redirect } from 'next/navigation'
import { getAuthSession } from '@/lib/auth-server'

export type AdminLevel = 'support' | 'super_admin'

export async function getAdminSession() {
  const session = await getAuthSession()

  if (!session?.user || session.user.accountType !== 'admin') {
    return null
  }

  return session
}

export async function requireAdminSession(requiredLevel: AdminLevel = 'support') {
  const session = await getAuthSession()

  if (!session?.user || session.user.accountType !== 'admin') {
    redirect('/auth/signin')
  }

  if (requiredLevel === 'super_admin' && session.user.adminLevel !== 'super_admin') {
    redirect('/admin')
  }

  return session
}

export function assertAdminLevel(
  session: Awaited<ReturnType<typeof getAdminSession>>,
  requiredLevel: AdminLevel = 'support'
) {
  if (!session?.user || session.user.accountType !== 'admin') {
    return false
  }

  if (requiredLevel === 'super_admin') {
    return session.user.adminLevel === 'super_admin'
  }

  return true
}
