'use client'

import { useState } from 'react'
import { SupportTicketMessageThread } from '@/components/support/support-ticket-message-thread'
import { AdminTicketReplyForm } from '@/components/admin/admin-ticket-reply-form'

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
  attachments: Array<{
    id: string
    fileName: string
    mimeType: string | null
    byteSize: bigint | number | null
    storageUrl: string
  }>
}

type AdminTicketConversationProps = {
  ticketId: string
  currentUserId: string
  messages: ThreadMessage[]
  disabled: boolean
}

export function AdminTicketConversation({
  ticketId,
  currentUserId,
  messages,
  disabled,
}: AdminTicketConversationProps) {
  const [quotedMessage, setQuotedMessage] = useState<string | undefined>(undefined)

  const handleReply = (messageBody: string) => {
    setQuotedMessage(messageBody)
    // Scroll to reply form
    const replyForm = document.getElementById('reply-body')
    if (replyForm) {
      replyForm.scrollIntoView({ behavior: 'smooth', block: 'center' })
      replyForm.focus()
    }
  }

  return (
    <>
      <SupportTicketMessageThread
        currentUserId={currentUserId}
        messages={messages}
        showInternal={true}
        onReply={handleReply}
      />
      <div className="border-t pt-6">
        <AdminTicketReplyForm
          ticketId={ticketId}
          disabled={disabled}
          quotedMessage={quotedMessage}
        />
      </div>
    </>
  )
}
