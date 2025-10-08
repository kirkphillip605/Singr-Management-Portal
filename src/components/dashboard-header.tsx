'use client'

import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'

interface DashboardHeaderProps {
  userEmail?: string | null
}

export function DashboardHeader({ userEmail }: DashboardHeaderProps) {
  return (
    <div className="flex flex-col items-end gap-2 text-right sm:flex-row sm:items-center sm:gap-4 sm:text-left">
      <span className="text-sm text-muted-foreground break-all sm:break-normal">
        {userEmail}
      </span>
      <Button
        variant="outline"
        onClick={() => signOut({ callbackUrl: '/' })}
      >
        Sign Out
      </Button>
    </div>
  )
}