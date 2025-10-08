import { format } from 'date-fns'
import { AdminNoteImportantToggle } from '@/components/admin/admin-note-important-toggle'
import { Badge } from '@/components/ui/badge'

export type AdminUserNoteRow = {
  id: string
  subject: string
  note: string
  important: boolean
  createdAt: Date
  authorName: string
  authorEmail?: string | null
}

type AdminUserNotesTableProps = {
  userId: string
  notes: AdminUserNoteRow[]
}

export function AdminUserNotesTable({ userId, notes }: AdminUserNotesTableProps) {
  if (!notes.length) {
    return (
      <div className="rounded-md border border-dashed border-border/60 bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
        There are no notes for this customer yet. Save a note above to document important context for the team.
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-muted/60">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Subject &amp; note
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Created
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Created by
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Important
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60 bg-white">
          {notes.map((note) => {
            const createdLabel = format(note.createdAt, 'MMM d, yyyy p')
            const [noteBody, ...history] = note.note.split('\n-----\n')

            return (
              <tr
                key={note.id}
                className={note.important ? 'bg-amber-50/70' : undefined}
              >
                <td className="align-top px-4 py-4 text-sm">
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-foreground">{note.subject}</p>
                      {note.important ? <Badge variant="secondary">Important</Badge> : null}
                    </div>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                      {noteBody}
                      {history.length ? (
                        <details className="mt-3 text-xs">
                          <summary className="cursor-pointer font-medium text-foreground">View quoted history</summary>
                          <div className="mt-2 whitespace-pre-wrap text-muted-foreground">
                            {history.join('\n-----\n')}
                          </div>
                        </details>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td className="align-top px-4 py-4 text-sm text-muted-foreground">{createdLabel}</td>
                <td className="align-top px-4 py-4 text-sm text-muted-foreground">
                  {note.authorName || note.authorEmail || 'Support user'}
                </td>
                <td className="align-top px-4 py-4 text-sm text-muted-foreground">
                  <AdminNoteImportantToggle userId={userId} noteId={note.id} important={note.important} />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
