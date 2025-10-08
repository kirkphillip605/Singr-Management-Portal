'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'

import { CardDescription } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Loader2, Star } from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'

const createNoteSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(200, 'Subject is too long'),
  note: z.string().min(1, 'Note body is required'),
  important: z.boolean().optional(),
})

type AdminUserNotesFormProps = {
  userId: string
}

export function AdminUserNotesForm({ userId }: AdminUserNotesFormProps) {
  const router = useRouter()
  const { toast } = useToast()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formState, setFormState] = useState({
    important: false,
    subject: '',
    note: '',
  })
  const [error, setError] = useState<string | null>(null)

  const handleChange = (field: 'important' | 'subject' | 'note', value: boolean | string) => {
    setFormState((prev) => ({
      ...prev,
      [field]: value,
    }))
    setError(null)
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (isSubmitting) return

    const parsed = createNoteSchema.safeParse(formState)

    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? 'Please complete all required fields')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/admin/users/${userId}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(parsed.data),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        const message = payload.error ?? 'Unable to save note'
        throw new Error(message)
      }

      setFormState({ important: false, subject: '', note: '' })
      toast({
        title: 'Note saved',
        description: 'The note has been recorded for this customer.',
      })
      router.refresh()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to save note'
      setError(message)
      toast({
        variant: 'destructive',
        title: 'Could not save note',
        description: message,
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <CardDescription className="text-sm text-muted-foreground">
        Notes are internal only and cannot be edited after saving. Use the important toggle to flag standout
        information for support teammates.
      </CardDescription>

      {error ? (
        <p className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-between rounded-md border border-border/60 bg-muted/40 px-3 py-2">
        <div className="flex flex-col">
          <Label htmlFor="note-important" className="text-sm font-medium">
            Mark note as important
          </Label>
          <p className="text-xs text-muted-foreground">Important notes are pinned to the top of the customer history.</p>
        </div>
        <div className="flex items-center gap-2">
          <Star
            className={`h-4 w-4 ${formState.important ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground'}`}
            aria-hidden="true"
          />
          <Switch
            id="note-important"
            checked={formState.important}
            onCheckedChange={(checked) => handleChange('important', checked)}
            disabled={isSubmitting}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="note-subject">Subject</Label>
        <Input
          id="note-subject"
          value={formState.subject}
          onChange={(event) => handleChange('subject', event.target.value)}
          placeholder="Short summary"
          maxLength={200}
          disabled={isSubmitting}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="note-body">Note</Label>
        <Textarea
          id="note-body"
          value={formState.note}
          onChange={(event) => handleChange('note', event.target.value)}
          placeholder="Document important interactions, escalations, or context for support."
          rows={5}
          disabled={isSubmitting}
        />
      </div>

      <Button type="submit" disabled={isSubmitting} className="inline-flex items-center gap-2">
        {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
        {isSubmitting ? 'Saving note' : 'Save note'}
      </Button>
    </form>
  )
}
