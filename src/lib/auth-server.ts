import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth'

export async function getAuthSession() {
  return await getServerSession(authOptions)
}