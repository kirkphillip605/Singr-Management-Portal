'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { Loader2, Paperclip } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'

const createTicketSchema = z.object({
  subject: z.string().min(5, 'Please include a short, descriptive subject line.'),
  description: z.string().min(10, 'Add details so our team can assist quickly.'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  category: z.string().optional(),
})

const MAX_ATTACHMENTS = 5
const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024

type SupportTicketCreateFormProps = {
  defaultPriority?: 'low' | 'normal' | 'high' | 'urgent'
}

export function SupportTicketCreateForm({ defaultPriority = 'normal' }: SupportTicketCreateFormProps) {
  const router = useRouter()
  const { toast } = useToast()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attachments, setAttachments] = useState<File[]>([])
  const [formState, setFormState] = useState({
    subject: '',
    description: '',
    priority: defaultPriority,
    category: '',
  })

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? [])

    if (files.length > MAX_ATTACHMENTS) {
      setError(`You can attach up to ${MAX_ATTACHMENTS} files per ticket.`)
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

    if (isSubmitting) return

    const parsed = createTicketSchema.safeParse(formState)
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? 'Check the form and try again.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('subject', parsed.data.subject)
      formData.append('description', parsed.data.description)
      formData.append('priority', parsed.data.priority)
      if (parsed.data.category) {
        formData.append('category', parsed.data.category)
      }

      attachments.forEach((file) => {
        formData.append('attachments', file)
      })

      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error ?? 'Unable to create ticket')
      }

      const payload = await response.json()

      toast({
        title: 'Support request submitted',
        description: 'Our support team has been notified and will follow up shortly.',
      })

      setFormState({ subject: '', description: '', priority: defaultPriority, category: '' })
      setAttachments([])
      router.push(`/dashboard/support/${payload.id}`)
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to create ticket'
      setError(message)
      toast({
        variant: 'destructive',
        title: 'Could not create ticket',
        description: message,
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
        <Label htmlFor="ticket-subject">Subject</Label>
        <Input
          id="ticket-subject"
          value={formState.subject}
          onChange={(event) => setFormState((prev) => ({ ...prev, subject: event.target.value }))}
          placeholder="Brief summary"
          disabled={isSubmitting}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ticket-category">Category (optional)</Label>
        <Input
          id="ticket-category"
          value={formState.category}
          onChange={(event) => setFormState((prev) => ({ ...prev, category: event.target.value }))}
          placeholder="Billing, account, venue, etc."
          disabled={isSubmitting}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="ticket-priority">Priority</Label>
        <select
          id="ticket-priority"
          value={formState.priority}
          onChange={(event) =>
            setFormState((prev) => ({ ...prev, priority: event.target.value as 'low' | 'normal' | 'high' | 'urgent' }))
          }
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          disabled={isSubmitting}
        >
          <option value="low">Low</option>
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ticket-description">Describe your request</Label>
        <Textarea
          id="ticket-description"
          value={formState.description}
          onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
          rows={6}
          placeholder="Share as much detail as you can so our support team can help quickly."
          disabled={isSubmitting}
        />
        <p className="text-xs text-muted-foreground">Be sure to include venue names, dates, or error messages if relevant.</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="ticket-attachments" className="flex items-center gap-2 text-sm font-medium">
          <Paperclip className="h-4 w-4" aria-hidden="true" /> Attachments (optional)
        </Label>
        <Input
          id="ticket-attachments"
          type="file"
          multiple
          onChange={handleFileChange}
          disabled={isSubmitting}
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

      <Button type="submit" disabled={isSubmitting} className="inline-flex items-center gap-2">
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {isSubmitting ? 'Submitting request' : 'Submit support request'}
      </Button>
    </form>
  )
}
