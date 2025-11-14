import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type TicketStatus = 'open' | 'pending_customer' | 'pending_support' | 'resolved' | 'closed'

const STATUS_STYLES: Record<
  TicketStatus,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; className?: string }
> = {
  open: { label: 'Open', variant: 'default' },
  pending_customer: {
    label: 'Waiting on you',
    variant: 'secondary',
    className: 'bg-amber-100 text-amber-900 hover:bg-amber-100',
  },
  pending_support: {
    label: 'Waiting on support',
    variant: 'secondary',
    className: 'bg-blue-100 text-blue-900 hover:bg-blue-100',
  },
  resolved: {
    label: 'Resolved',
    variant: 'secondary',
    className: 'bg-emerald-100 text-emerald-900 hover:bg-emerald-100',
  },
  closed: { label: 'Closed', variant: 'outline', className: 'text-muted-foreground' },
}

type SupportTicketStatusBadgeProps = {
  status: TicketStatus
}

export function SupportTicketStatusBadge({ status }: SupportTicketStatusBadgeProps) {
  const style = STATUS_STYLES[status]

  return (
    <Badge variant={style.variant} className={cn('capitalize', style.className)}>
      {style.label}
    </Badge>
  )
}
