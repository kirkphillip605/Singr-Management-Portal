import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { requireCustomerSession } from '@/lib/customer-auth'
import { DashboardLayoutShell } from '@/components/dashboard-layout-shell'
import { PortalSurfaceProvider } from '@/components/portal-surface-context'
import { detectPortalSurface } from '@/lib/portal-links'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // `requireCustomerSession` enforces that the user is signed in *and*
  // is a customer/host account — admin or support sessions get bounced
  // to /admin, anyone else to sign-in. This is the single chokepoint
  // covering every `/dashboard/*` server-rendered page.
  const session = await requireCustomerSession()

  if (session.user.mustSetPassword) {
    redirect('/auth/set-password')
  }

  // The customer portal is reachable both from the apex (`/dashboard/*`,
  // used in development & on Replit previews) and from
  // `host.singrkaraoke.com` (where the host-based middleware strips the
  // `/dashboard` prefix from URLs). We detect which surface served this
  // request and propagate it to the client through context so internal
  // links render with the right shape on first paint — no hydration
  // mismatch and no extra redirect bounce.
  const hdrs = await headers()
  const surface = detectPortalSurface(hdrs.get('host'))

  return (
    <PortalSurfaceProvider surface={surface}>
      <DashboardLayoutShell userEmail={session.user?.email}>
        {children}
      </DashboardLayoutShell>
    </PortalSurfaceProvider>
  )
}
