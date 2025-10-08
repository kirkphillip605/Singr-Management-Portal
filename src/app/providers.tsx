'use client'

import { SessionProvider } from 'next-auth/react'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/toaster'
import { ErrorBoundary } from '@/components/ui/error-boundary'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <SessionProvider>
        <TooltipProvider delayDuration={150} skipDelayDuration={0}>
          {children}
        </TooltipProvider>
        <Toaster />
      </SessionProvider>
    </ErrorBoundary>
  )
}