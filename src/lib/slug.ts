export function toVenueSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function isVenueSlugValid(value: string): boolean {
  return /^[a-z-]+$/.test(value)
}
