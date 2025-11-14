import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent'

const PRIORITY_STYLES: Record<
  TicketPriority,
  { label: string; className: string }
> = {
  low: {
    label: 'Low',
    className: 'bg-slate-100 text-slate-800 hover:bg-slate-100',
  },
  normal: {
    label: 'Normal',
    className: 'bg-blue-100 text-blue-900 hover:bg-blue-100',
  },
  high: {
    label: 'High',
    className: 'bg-amber-100 text-amber-900 hover:bg-amber-100',
  },
  urgent: {
    label: 'Urgent',
    className: 'bg-destructive text-destructive-foreground hover:bg-destructive',
  },
}

type SupportTicketPriorityBadgeProps = {
  priority: TicketPriority
}

export function SupportTicketPriorityBadge({ priority }: SupportTicketPriorityBadgeProps) {
  const style = PRIORITY_STYLES[priority]

  return (
    <Badge variant="secondary" className={cn('capitalize', style.className)}>
      {style.label}
    </Badge>
  )
}
