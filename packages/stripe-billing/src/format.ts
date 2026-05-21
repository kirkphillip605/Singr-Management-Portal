/**
 * Client-safe currency formatting utilities
 * No server-side dependencies - safe for client components
 */

export function formatAmountForDisplay(amount: number, currency: string): string {
  const numberFormat = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    currencyDisplay: 'symbol',
  })
  return numberFormat.format(amount / 100)
}

export function formatAmountFromStripe(amount: number, currency: string): number {
  const numberFormat = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    currencyDisplay: 'symbol',
  })
  const parts = numberFormat.formatToParts(amount / 100)
  return parseFloat(parts.map(part => part.value).join('').replace(/[^0-9.-]+/g, ''))
}