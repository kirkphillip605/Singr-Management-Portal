'use client'

import { TooltipProvider } from '@singr/ui'
import { Toaster } from '@singr/ui'
import { ErrorBoundary } from '@singr/ui'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <TooltipProvider delayDuration={150} skipDelayDuration={0}>
        {children}
      </TooltipProvider>
      <Toaster />
    </ErrorBoundary>
  )
}
