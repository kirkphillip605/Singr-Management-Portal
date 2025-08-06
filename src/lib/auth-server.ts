import { getServerSession } from 'next-auth/next'
import { headers, cookies } from 'next/headers'
import { authOptions } from '@/lib/auth'

export async function getAuthSession() {
  return await getServerSession(authOptions, { 
    headers: headers(), 
    cookies: cookies() 
  })
}