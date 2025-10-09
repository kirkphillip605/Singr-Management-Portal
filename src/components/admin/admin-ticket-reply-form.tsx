'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/use-toast'
import { Loader2, Paperclip, Lock, Users } from 'lucide-react'

const MAX_ATTACHMENTS = 5
const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024

type AdminTicketReplyFormProps = {
  ticketId: string
  disabled: boolean
}

export function AdminTicketReplyForm({ ticketId, disabled }: AdminTicketReplyFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [body, setBody] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'internal'>('public')
  const [attachments, setAttachments] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])

    if (files.length > MAX_ATTACHMENTS) {
      setError(`You can attach up to ${MAX_ATTACHMENTS} files per message.`)
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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!body.trim()) {
      setError('Message body is required')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('body', body)
      formData.append('visibility', visibility)

      attachments.forEach((file) => {
        formData.append('attachments', file)
      })

      const response = await fetch(`/api/admin/support/tickets/${ticketId}/messages`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error ?? 'Failed to send message')
      }

      toast({
        title: 'Message sent',
        description: visibility === 'internal' ? 'Internal note added' : 'Reply sent to customer',
      })

      setBody('')
      setAttachments([])
      setVisibility('public')
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send message'
      setError(message)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: message,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4">
      {error ? (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="reply-visibility">Visibility</Label>
        <div className="flex gap-2">
          <Button
            type="button"
            variant={visibility === 'public' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setVisibility('public')}
            disabled={isSubmitting}
            className="flex-1"
          >
            <Users className="mr-2 h-4 w-4" />
            Public Reply
          </Button>
          <Button
            type="button"
            variant={visibility === 'internal' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setVisibility('internal')}
            disabled={isSubmitting}
            className="flex-1"
          >
            <Lock className="mr-2 h-4 w-4" />
            Internal Note
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {visibility === 'public'
            ? 'Customer will see this reply'
            : 'Internal notes are only visible to support staff'}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reply-body">Message</Label>
        <Textarea
          id="reply-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={
            visibility === 'public'
              ? 'Write your reply to the customer...'
              : 'Add an internal note for the team...'
          }
          rows={6}
          disabled={isSubmitting || disabled}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="reply-attachments" className="flex items-center gap-2 text-sm font-medium">
          <Paperclip className="h-4 w-4" aria-hidden="true" /> Attachments (optional)
        </Label>
        <Input
          id="reply-attachments"
          type="file"
          multiple
          onChange={handleFileChange}
          disabled={isSubmitting || disabled}
          accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf"
        />
        <p className="text-xs text-muted-foreground">
          Attach up to {MAX_ATTACHMENTS} files (images, videos, or documents). Each file must be 10MB or smaller.
        </p>
        {attachments.length ? (
          <ul className="text-xs text-muted-foreground">
            {attachments.map((file) => (
              <li key={file.name}>{file.name}</li>
            ))}
          </ul>
        ) : null}
      </div>

      <Button type="submit" disabled={isSubmitting || disabled || !body.trim()} className="w-full">
        {isSubmitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
            Sending...
          </>
        ) : (
          <>Send {visibility === 'public' ? 'Reply' : 'Note'}</>
        )}
      </Button>
    </form>
  )
}
