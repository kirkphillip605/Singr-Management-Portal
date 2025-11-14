import { format } from 'date-fns'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SupportAttachmentLink } from '@/components/support/support-attachment-link'
import { Reply } from 'lucide-react'

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
  visibility?: 'public' | 'internal'
  author: {
    id: string
    name: string | null
    email: string | null
    accountType?: string | null
  }
  attachments: ThreadAttachment[]
}

type SupportTicketMessageThreadProps = {
  currentUserId: string
  messages: ThreadMessage[]
  showInternal?: boolean
  onReply?: (messageBody: string) => void
}

export function SupportTicketMessageThread({ currentUserId, messages, showInternal = false, onReply }: SupportTicketMessageThreadProps) {
  const displayMessages = showInternal ? messages : messages.filter((m) => m.visibility !== 'internal')

  if (!displayMessages.length) {
    return (
      <div className="rounded-md border border-dashed border-border/60 bg-muted/20 px-4 py-12 text-center text-sm text-muted-foreground">
        No {showInternal ? '' : 'public '}messages have been posted to this ticket yet.
      </div>
    )
  }

  const handleReply = (messageBody: string) => {
    if (onReply) {
      onReply(messageBody)
    }
  }

  return (
    <ul className="space-y-4">
      {displayMessages.map((message) => {
        const isCurrentUser = message.author.id === currentUserId
        const isInternal = message.visibility === 'internal'
        const [primaryBody, ...history] = message.body.split('\n-----\n')
        
        const isStaff = message.author.accountType === 'admin' || message.author.accountType === 'support'
        const authorLabel = isCurrentUser
          ? 'You'
          : message.author.name || message.author.email || (isStaff ? 'Support team' : 'Customer')
        const timestamp = format(message.createdAt, 'MMM d, yyyy p')

        return (
          <li key={message.id}>
            <article
              className={`flex flex-col gap-3 rounded-lg border px-5 py-4 ${
                isInternal
                  ? 'border-yellow-300 bg-yellow-50 dark:border-yellow-700 dark:bg-yellow-950'
                  : isCurrentUser
                  ? 'border-primary/60 bg-primary/5'
                  : 'border-border/70 bg-white dark:bg-slate-900'
              }`}
            >
              <header className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  {authorLabel}
                  <Badge variant={isInternal ? 'secondary' : 'outline'} className="text-xs uppercase tracking-wide">
                    {isInternal ? 'Internal' : isStaff ? 'Support' : 'Customer'}
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

              {!isInternal && onReply && (
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleReply(`On ${timestamp}, ${authorLabel} wrote:\n${primaryBody?.trim() || ''}`)}
                    className="gap-2"
                  >
                    <Reply className="h-3 w-3" />
                    Reply
                  </Button>
                </div>
              )}
            </article>
          </li>
        )
      })}
    </ul>
  )
}
