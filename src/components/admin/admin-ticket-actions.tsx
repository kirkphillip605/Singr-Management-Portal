'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/use-toast'
import { Loader2 } from 'lucide-react'

type TicketStatus = 'open' | 'pending_support' | 'pending_customer' | 'resolved' | 'closed'
type TicketPriority = 'low' | 'normal' | 'high' | 'urgent'

type AdminUser = {
  id: string
  name: string | null
  email: string
}

type AdminTicketActionsProps = {
  ticketId: string
  currentStatus: TicketStatus
  currentPriority: TicketPriority
  currentAssigneeId: string | null
  adminUsers: AdminUser[]
}

export function AdminTicketActions({
  ticketId,
  currentStatus,
  currentPriority,
  currentAssigneeId,
  adminUsers,
}: AdminTicketActionsProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isUpdating, setIsUpdating] = useState(false)

  const handleStatusChange = async (newStatus: TicketStatus) => {
    if (newStatus === currentStatus) return

    setIsUpdating(true)
    try {
      const response = await fetch(`/api/admin/support/tickets/${ticketId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        throw new Error('Failed to update status')
      }

      toast({
        title: 'Status updated',
        description: `Ticket status changed to ${newStatus.replace('_', ' ')}`,
      })

      router.refresh()
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update ticket status',
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const handlePriorityChange = async (newPriority: TicketPriority) => {
    if (newPriority === currentPriority) return

    setIsUpdating(true)
    try {
      const response = await fetch(`/api/admin/support/tickets/${ticketId}/priority`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: newPriority }),
      })

      if (!response.ok) {
        throw new Error('Failed to update priority')
      }

      toast({
        title: 'Priority updated',
        description: `Ticket priority changed to ${newPriority}`,
      })

      router.refresh()
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update ticket priority',
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleAssigneeChange = async (newAssigneeId: string) => {
    if (newAssigneeId === (currentAssigneeId || '')) return

    setIsUpdating(true)
    try {
      const response = await fetch(`/api/admin/support/tickets/${ticketId}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigneeId: newAssigneeId || null }),
      })

      if (!response.ok) {
        throw new Error('Failed to update assignee')
      }

      toast({
        title: 'Assignee updated',
        description: newAssigneeId ? 'Ticket assigned successfully' : 'Ticket unassigned',
      })

      router.refresh()
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update ticket assignee',
      })
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <Card className="border border-border/70">
      <CardHeader>
        <CardTitle>Actions</CardTitle>
        <CardDescription>Update ticket status, priority, or assignment.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="status-select">Status</Label>
          <select
            id="status-select"
            value={currentStatus}
            onChange={(e) => handleStatusChange(e.target.value as TicketStatus)}
            disabled={isUpdating}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="open">Open</option>
            <option value="pending_support">Pending Support</option>
            <option value="pending_customer">Pending Customer</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="priority-select">Priority</Label>
          <select
            id="priority-select"
            value={currentPriority}
            onChange={(e) => handlePriorityChange(e.target.value as TicketPriority)}
            disabled={isUpdating}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="assignee-select">Assign to</Label>
          <select
            id="assignee-select"
            value={currentAssigneeId || ''}
            onChange={(e) => handleAssigneeChange(e.target.value)}
            disabled={isUpdating}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="">Unassigned</option>
            {adminUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name || user.email}
              </option>
            ))}
          </select>
        </div>

        {isUpdating && (
          <div className="flex items-center justify-center py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
