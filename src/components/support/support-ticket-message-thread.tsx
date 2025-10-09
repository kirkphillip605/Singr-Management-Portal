import { format } from 'date-fns'

import { Badge } from '@/components/ui/badge'
import { SupportAttachmentLink } from '@/components/support/support-attachment-link'

type ThreadAttachment = {
  id: string
  fileName: string
  mimeType: string | null
  byteSize: bigint | number | null
  storageUrl: string
}

type ThreadMessage = {
  id: string
  body: string
  createdAt: Date
  author: {
    id: string
    name: string | null
    email: string | null
  }
  attachments: ThreadAttachment[]
}

type SupportTicketMessageThreadProps = {
  currentUserId: string
  messages: ThreadMessage[]
}

export function SupportTicketMessageThread({ currentUserId, messages }: SupportTicketMessageThreadProps) {
  if (!messages.length) {
    return (
      <div className="rounded-md border border-dashed border-border/60 bg-muted/20 px-4 py-12 text-center text-sm text-muted-foreground">
        No public messages have been posted to this ticket yet.
      </div>
    )
  }

  return (
    <ul className="space-y-4">
      {messages.map((message) => {
        const isRequester = message.author.id === currentUserId
        const [primaryBody, ...history] = message.body.split('\n-----\n')
        const authorLabel = isRequester
          ? 'You'
          : message.author.name || message.author.email || 'Support team'
        const timestamp = format(message.createdAt, 'MMM d, yyyy p')

        return (
          <li key={message.id}>
            <article
              className={`flex flex-col gap-3 rounded-lg border px-5 py-4 ${
                isRequester ? 'border-primary/60 bg-primary/5' : 'border-border/70 bg-white'
              }`}
            >
              <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  {authorLabel}
                  <Badge variant="outline" className="text-xs uppercase tracking-wide">
                    {isRequester ? 'Customer' : 'Support'}
                  </Badge>
                </div>
                <time className="text-xs uppercase tracking-wide text-muted-foreground" dateTime={message.createdAt.toISOString()}>
                  {timestamp}
                </time>
              </header>

              <div className="space-y-3 text-sm leading-relaxed text-foreground">
                <div className="whitespace-pre-line text-muted-foreground">{primaryBody?.trim() || '—'}</div>
                {history.length ? (
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer font-medium text-foreground">Quoted conversation</summary>
                    <div className="mt-2 whitespace-pre-line">{history.join('\n-----\n')}</div>
                  </details>
                ) : null}
              </div>

              {message.attachments.length ? (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Attachments</p>
                  <div className="flex flex-col gap-2">
                    {message.attachments.map((attachment) => (
                      <SupportAttachmentLink key={attachment.id} attachment={attachment} />
                    ))}
                  </div>
                </div>
              ) : null}
            </article>
          </li>
        )
      })}
    </ul>
  )
}
