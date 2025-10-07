import { prisma } from '@/lib/prisma'
import { requireAdminSession } from '@/lib/admin-auth'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'

const numberFormatter = new Intl.NumberFormat('en-US')

export default async function AdminHomePage() {
  await requireAdminSession()

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      customer: {
        include: {
          apiKeys: {
            select: {
              id: true,
            },
          },
        },
      },
      subscriptions: {
        select: {
          status: true,
          created: true,
        },
        orderBy: { created: 'desc' },
        take: 1,
      },
      venues: {
        select: {
          id: true,
          name: true,
          _count: {
            select: {
              requests: true,
            },
          },
        },
      },
      _count: {
        select: {
          venues: true,
          songDb: true,
        },
      },
    },
  })

  const totalCustomers = users.length
  const activeSubscriptions = users.filter(
    (user) => user.subscriptions[0]?.status === 'active'
  ).length
  const trialingSubscriptions = users.filter(
    (user) => user.subscriptions[0]?.status === 'trialing'
  ).length
  const totalVenues = users.reduce((acc, user) => acc + user._count.venues, 0)
  const totalSongs = users.reduce((acc, user) => acc + user._count.songDb, 0)
  const totalRequests = users.reduce(
    (acc, user) =>
      acc + user.venues.reduce((venueSum, venue) => venueSum + venue._count.requests, 0),
    0
  )

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">Customer Directory</h1>
          <p className="text-muted-foreground">
            Monitor every account, subscription, and venue across Singr Karaoke.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Customers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{numberFormatter.format(totalCustomers)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Subscriptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{numberFormatter.format(activeSubscriptions)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Trialing Accounts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{numberFormatter.format(trialingSubscriptions)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Venues Managed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{numberFormatter.format(totalVenues)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Accounts Overview</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Business
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Subscription
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Venues
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Songs
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  API Keys
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Requests
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {users.map((user) => {
                const subscriptionStatus = user.subscriptions[0]?.status ?? 'none'
                const requestsCount = user.venues.reduce(
                  (sum, venue) => sum + venue._count.requests,
                  0
                )
                const apiKeysCount = user.customer?.apiKeys.length ?? 0

                return (
                  <tr key={user.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Link
                        href={`/admin/users/${user.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {user.name || user.email}
                      </Link>
                      <div className="text-xs text-muted-foreground">{user.email}</div>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-700">
                      {user.businessName || '—'}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm">
                      <Badge
                        variant={
                          subscriptionStatus === 'active'
                            ? 'default'
                            : subscriptionStatus === 'trialing'
                            ? 'secondary'
                            : 'outline'
                        }
                      >
                        {subscriptionStatus}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                      {numberFormatter.format(user._count.venues)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                      {numberFormatter.format(user._count.songDb)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                      {numberFormatter.format(apiKeysCount)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                      {numberFormatter.format(requestsCount)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-muted-foreground">
                      {user.createdAt.toLocaleDateString()}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
