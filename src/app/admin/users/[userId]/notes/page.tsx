// ./src/app/admin/users/[userId]/notes/page.tsx

export const runtime = 'nodejs'

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, NotebookPen } from 'lucide-react'
import { format } from 'date-fns'

import { requireAdminSession } from '@/lib/admin-auth'
import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { AdminUserNotesForm } from '@/components/admin/admin-user-notes-form'
import { AdminUserNotesTable } from '@/components/admin/admin-user-notes-table'

/**
 * Page props for this route segment.
 * In the App Router, `params` is a plain object (not a Promise).
 */
type AdminUserNotesPageProps = {
  params: {
    userId: string
  }
}

/**
 * Admin - Customer Notes
 * - Requires an admin session
 * - Loads the user record and their notes
 * - Renders a form to add a new note and a table of existing notes
 */
export default async function AdminUserNotesPage({ params }: AdminUserNotesPageProps) {
  // Auth guard (throws or redirects if not admin)
  await requireAdminSession()

  const { userId } = params

  const [user, notes] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        businessName: true,
        createdAt: true,
      },
    }),
    (prisma as any).userNote.findMany({
      where: { userId },
      include: {
        author: {
          select: { name: true, email: true },
        },
      },
      orderBy: [{ important: 'desc' }, { createdAt: 'desc' }],
    }),
  ])

  if (!user) {
    notFound()
  }

  type PreparedNote = {
    id: string
    subject: string
    note: string
    important: boolean
    createdAt: Date
    authorName: string
    authorEmail?: string | null
  }

  const preparedNotes: PreparedNote[] = (notes as any[]).map((note) => ({
    id: note.id,
    subject: note.subject,
    note: note.note,
    important: note.important,
    createdAt: note.createdAt,
    authorName: note.author?.name ?? note.author?.email ?? '',
    authorEmail: note.author?.email ?? null,
  }))

  const noteCount = preparedNotes.length

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Button asChild variant="ghost" size="sm" className="-ml-3 h-auto px-3 py-1 text-muted-foreground">
              <Link href={`/admin/users/${userId}`} className="inline-flex items-center gap-1">
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Back to customer overview
              </Link>
            </Button>
          </div>
          <h1 className="flex items-center gap-2 text-3xl font-semibold">
            <NotebookPen className="h-7 w-7 text-primary" aria-hidden="true" />
            Customer notes
          </h1>
          <p className="text-muted-foreground">
            {(user.name || user.email) ?? 'Customer'} · Customer since {format(user.createdAt, 'MMM d, yyyy')}
          </p>
        </div>
        <Badge variant="secondary" className="w-fit">
          {noteCount} {noteCount === 1 ? 'note' : 'notes'} logged
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="order-last lg:order-first">
          <CardHeader>
            <CardTitle>Note history</CardTitle>
            <CardDescription>Important context shared between support teammates.</CardDescription>
          </CardHeader>
          <CardContent>
            <AdminUserNotesTable userId={userId} notes={preparedNotes} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Create a new note</CardTitle>
            <CardDescription>Document conversations, escalations, or action items.</CardDescription>
          </CardHeader>
          <CardContent>
            <AdminUserNotesForm userId={userId} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
