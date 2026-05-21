'use client'

import { Button } from '@singr/ui'
import { LogOut } from 'lucide-react'

type DashboardHeaderProps = {
  userEmail?: string | null
}

export function DashboardHeader({ userEmail }: DashboardHeaderProps) {
  return (
    <div className="flex items-center gap-3">
      {userEmail && (
        <span className="hidden text-sm text-muted-foreground sm:inline">
          {userEmail}
        </span>
      )}
      <form action="/api/auth/sign-out" method="POST">
        <Button variant="ghost" size="sm" type="submit" className="gap-2">
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sign out
        </Button>
      </form>
    </div>
  )
}
