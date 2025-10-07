// FILE: src/lib/subscription-normalize.ts

/** Format UNIX seconds, Date, or ISO string to a locale date (or —). */
export function fmtDate(value: number | string | Date | null | undefined): string {
  if (value == null) return '—'
  if (typeof value === 'number') {
    const d = new Date(value * 1000) // Stripe UNIX seconds
    return Number.isNaN(d.valueOf()) ? '—' : d.toLocaleDateString()
  }
  if (value instanceof Date) {
    return Number.isNaN(value.valueOf()) ? '—' : value.toLocaleDateString()
  }
  const d = new Date(value)
  return Number.isNaN(d.valueOf()) ? '—' : d.toLocaleDateString()
}

/** Safe getter by path ("items.data.0.price"). */
export function get(obj: any, path: string): any {
  return path.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj)
}

/** Extract period {start,end} from a Stripe subscription object. */
export function periodFromStripe(sub: any): { start?: number; end?: number } {
  if (!sub) return {}
  let start = typeof sub.current_period_start === 'number' ? sub.current_period_start : undefined
  let end = typeof sub.current_period_end === 'number' ? sub.current_period_end : undefined

  // Fallback to first item fields if present
  if (start == null || end == null) {
    const itemStart = get(sub, 'items.data.0.current_period_start')
    const itemEnd = get(sub, 'items.data.0.current_period_end')
    if (typeof itemStart === 'number') start = itemStart
    if (typeof itemEnd === 'number') end = itemEnd
  }

  // Last-ditch start: billing_cycle_anchor
  if (start == null && typeof sub.billing_cycle_anchor === 'number') {
    start = sub.billing_cycle_anchor
  }

  return { start, end }
}

/** Extract trial {start,end} from a Stripe subscription object. */
export function trialFromStripe(sub: any): { trialStart?: number; trialEnd?: number } {
  if (!sub) return {}
  let trialStart = typeof sub.trial_start === 'number' ? sub.trial_start : undefined
  let trialEnd = typeof sub.trial_end === 'number' ? sub.trial_end : undefined

  if (trialStart == null || trialEnd == null) {
    const itemTrialStart = get(sub, 'items.data.0.trial_start')
    const itemTrialEnd = get(sub, 'items.data.0.trial_end')
    if (typeof itemTrialStart === 'number') trialStart = itemTrialStart
    if (typeof itemTrialEnd === 'number') trialEnd = itemTrialEnd
  }
  return { trialStart, trialEnd }
}

/** Derive a friendly plan name from a Stripe price object (nickname takes priority). */
export function planLabelFromPrice(price?: any): string | undefined {
  if (!price) return undefined
  if (price.nickname) return price.nickname as string
  const interval = price.recurring?.interval as 'day' | 'week' | 'month' | 'year' | undefined
  const count = price.recurring?.interval_count ?? 1
  if (!interval) return undefined
  if (interval === 'month' && count === 1) return 'Monthly Plan'
  if (interval === 'month' && count === 6) return 'Semi-Annual Plan'
  if (interval === 'year') return 'Annual Plan'
  return `Singr Pro (${count} ${interval}${count > 1 ? 's' : ''})`
}

/** Derive a friendly plan name directly from a Stripe subscription’s first item price. */
export function planLabelFromSubscription(sub?: any): string | undefined {
  if (!sub) return undefined
  const price = get(sub, 'items.data.0.price')
  return planLabelFromPrice(price)
}
