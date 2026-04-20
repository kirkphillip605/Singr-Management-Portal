'use client'

import { useRouter } from 'next/navigation'
import { signOut } from '@/lib/auth-client'
import { Button } from '@/components/ui/button'

interface DashboardHeaderProps {
  userEmail?: string | null
}

export function DashboardHeader({ userEmail }: DashboardHeaderProps) {
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          router.push('/')
          router.refresh()
        },
      },
    })
  }

  return (
    <div className="flex flex-col items-end gap-2 text-right sm:flex-row sm:items-center sm:gap-4 sm:text-left">
      <span className="text-sm text-muted-foreground break-all sm:break-normal">
        {userEmail}
      </span>
      <Button variant="outline" onClick={handleSignOut}>
        Sign Out
      </Button>
    </div>
  )
}
