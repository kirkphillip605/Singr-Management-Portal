'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Paperclip } from 'lucide-react'

import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'

const MAX_ATTACHMENTS = 5
const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024

type SupportTicketReplyFormProps = {
  ticketId: string
  disabled?: boolean
}

export function SupportTicketReplyForm({ ticketId, disabled = false }: SupportTicketReplyFormProps) {
  const router = useRouter()
  const { toast } = useToast()

  const [message, setMessage] = useState('')
  const [attachments, setAttachments] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])

    if (files.length > MAX_ATTACHMENTS) {
      setError(`You can attach up to ${MAX_ATTACHMENTS} files per reply.`)
      return
    }

    const oversize = files.find((file) => file.size > MAX_ATTACHMENT_SIZE_BYTES)
    if (oversize) {
      setError('Attachments must be 10MB or smaller.')
      return
    }

    setAttachments(files)
    setError(null)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isSubmitting || disabled) return

    if (!message.trim()) {
      setError('Add a message before sending your reply.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('body', message.trim())
      attachments.forEach((file) => formData.append('attachments', file))

      const response = await fetch(`/api/support/tickets/${ticketId}/messages`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error ?? 'Unable to send reply')
      }

      toast({
        title: 'Message sent',
        description: 'Your update has been shared with our support team.',
      })

      setMessage('')
      setAttachments([])
      router.refresh()
    } catch (err) {
      const messageText = err instanceof Error ? err.message : 'Unable to send reply'
      setError(messageText)
      toast({
        variant: 'destructive',
        title: 'Could not send reply',
        description: messageText,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="ticket-reply">Reply</Label>
        <Textarea
          id="ticket-reply"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={6}
          placeholder="Share an update or respond to the support team."
          disabled={isSubmitting || disabled}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ticket-reply-attachments" className="flex items-center gap-2 text-sm font-medium">
          <Paperclip className="h-4 w-4" aria-hidden="true" /> Attachments (optional)
        </Label>
        <Input
          id="ticket-reply-attachments"
          type="file"
          multiple
          onChange={handleFileChange}
          disabled={isSubmitting || disabled}
          accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf"
        />
        <p className="text-xs text-muted-foreground">
          Attach up to {MAX_ATTACHMENTS} files. Each must be 10MB or smaller. Internal notes entered by support will remain
          private.
        </p>
        {attachments.length ? (
          <ul className="text-xs text-muted-foreground">
            {attachments.map((file) => (
              <li key={file.name}>{file.name}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <Button type="submit" disabled={isSubmitting || disabled} className="inline-flex items-center gap-2">
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {isSubmitting ? 'Sending reply' : 'Send reply'}
      </Button>
    </form>
  )
}
