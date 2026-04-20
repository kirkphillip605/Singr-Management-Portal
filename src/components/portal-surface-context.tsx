'use client'

import { createContext, useContext } from 'react'
import {
  type PortalSurface,
  portalHref as buildPortalHref,
} from '@/lib/portal-links'

const PortalSurfaceContext = createContext<PortalSurface>('apex')

export function PortalSurfaceProvider({
  surface,
  children,
}: {
  surface: PortalSurface
  children: React.ReactNode
}) {
  return (
    <PortalSurfaceContext.Provider value={surface}>
      {children}
    </PortalSurfaceContext.Provider>
  )
}

export function usePortalSurface(): PortalSurface {
  return useContext(PortalSurfaceContext)
}

export function usePortalHref() {
  const surface = usePortalSurface()
  return (path: string) => buildPortalHref(path, surface)
}
