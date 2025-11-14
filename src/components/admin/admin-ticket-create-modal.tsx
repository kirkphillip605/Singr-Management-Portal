'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { Loader2, Paperclip, Plus } from 'lucide-react'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const createTicketSchema = z.object({
  customerId: z.string().uuid('Please select a customer.'),
  subject: z.string().min(5, 'Please include a short, descriptive subject line.'),
  description: z.string().min(10, 'Add details so the team can assist quickly.'),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  category: z.string().optional(),
})

const MAX_ATTACHMENTS = 5
const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024

type Customer = {
  id: string
  name: string | null
  businessName: string | null
}

type AdminTicketCreateModalProps = {
  customers: Customer[]
}

export function AdminTicketCreateModal({ customers }: AdminTicketCreateModalProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isOpen, setIsOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formState, setFormState] = useState({
    customerId: '',
    subject: '',
    description: '',
    priority: 'normal' as const,
    category: '',
  })
  const [attachments, setAttachments] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  const filteredCustomers = customers.filter((customer) => {
    const customerLabel = customer.businessName
      ? `${customer.name || 'Unknown'} (${customer.businessName})`
      : customer.name || 'Unknown'
    return customerLabel.toLowerCase().includes(searchTerm.toLowerCase())
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
      formData.append('customerId', parsed.data.customerId)
      formData.append('subject', parsed.data.subject)
      formData.append('description', parsed.data.description)
      formData.append('priority', parsed.data.priority)
      if (parsed.data.category) {
        formData.append('category', parsed.data.category)
      }

      attachments.forEach((file) => {
        formData.append('attachments', file)
      })

      const response = await fetch('/api/admin/support/tickets', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(payload.error ?? 'Unable to create ticket')
      }

      const payload = await response.json()

      toast({
        title: 'Support ticket created',
        description: 'The ticket has been created on behalf of the customer.',
      })

      setFormState({
        customerId: '',
        subject: '',
        description: '',
        priority: 'normal',
        category: '',
      })
      setAttachments([])
      setIsOpen(false)
      router.push(`/admin/support/${payload.id}`)
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
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Ticket
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Support Ticket</DialogTitle>
          <DialogDescription>
            Create a new support ticket on behalf of a customer.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error ? (
            <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="customer-select">Customer *</Label>
            <Select
              value={formState.customerId}
              onValueChange={(value) => setFormState({ ...formState, customerId: value })}
              disabled={isSubmitting}
            >
              <SelectTrigger id="customer-select">
                <SelectValue placeholder="Select a customer..." />
              </SelectTrigger>
              <SelectContent>
                <div className="p-2">
                  <Input
                    placeholder="Search customers..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
                {filteredCustomers.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground">No customers found</div>
                ) : (
                  filteredCustomers.map((customer) => {
                    const label = customer.businessName
                      ? `${customer.name || 'Unknown'} (${customer.businessName})`
                      : customer.name || 'Unknown'
                    return (
                      <SelectItem key={customer.id} value={customer.id}>
                        {label}
                      </SelectItem>
                    )
                  })
                )}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-ticket-subject">Subject *</Label>
            <Input
              id="admin-ticket-subject"
              value={formState.subject}
              onChange={(e) => setFormState({ ...formState, subject: e.target.value })}
              placeholder="Brief summary of the issue"
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-ticket-description">Description *</Label>
            <Textarea
              id="admin-ticket-description"
              value={formState.description}
              onChange={(e) => setFormState({ ...formState, description: e.target.value })}
              placeholder="Detailed explanation of the support request"
              rows={5}
              disabled={isSubmitting}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="admin-ticket-priority">Priority</Label>
              <Select
                value={formState.priority}
                onValueChange={(value: any) => setFormState({ ...formState, priority: value })}
                disabled={isSubmitting}
              >
                <SelectTrigger id="admin-ticket-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin-ticket-category">Category</Label>
              <Input
                id="admin-ticket-category"
                value={formState.category}
                onChange={(e) => setFormState({ ...formState, category: e.target.value })}
                placeholder="e.g., Billing, Technical"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="admin-ticket-attachments" className="flex items-center gap-2">
              <Paperclip className="h-4 w-4" aria-hidden="true" /> Attachments (optional)
            </Label>
            <Input
              id="admin-ticket-attachments"
              type="file"
              multiple
              onChange={handleFileChange}
              disabled={isSubmitting}
              accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.rtf"
            />
            <p className="text-xs text-muted-foreground">
              Up to {MAX_ATTACHMENTS} files (images, videos, or documents). Each file must be 10MB or smaller.
            </p>
            {attachments.length ? (
              <ul className="text-xs text-muted-foreground">
                {attachments.map((file) => (
                  <li key={file.name}>{file.name}</li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                  Creating...
                </>
              ) : (
                'Create Ticket'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
