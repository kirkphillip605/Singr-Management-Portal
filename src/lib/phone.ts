const COUNTRY_CODE = '1'

function extractDigits(value: string) {
  return value.replace(/\D/g, '')
}

export function formatUSPhoneInput(value: string): string {
  const digits = extractDigits(value)
  const withoutCountry = digits.startsWith(COUNTRY_CODE)
    ? digits.slice(1)
    : digits
  const limited = withoutCountry.slice(0, 10)

  if (limited.length === 0) {
    return ''
  }

  const area = limited.slice(0, 3)
  const prefix = limited.slice(3, 6)
  const line = limited.slice(6, 10)

  let formatted = '+1 '

  if (area.length) {
    formatted += `(${area}${area.length === 3 ? ')' : ''}`
  }

  if (prefix.length) {
    formatted += area.length === 3 ? ' ' : ''
    formatted += prefix
    if (prefix.length === 3 && line.length) {
      formatted += '-'
    }
  }

  if (line.length) {
    formatted += line
  }

  return formatted.trimEnd()
}

export function isCompleteUSPhone(value: string): boolean {
  const digits = extractDigits(value)
  const withoutCountry = digits.startsWith(COUNTRY_CODE)
    ? digits.slice(1)
    : digits
  return withoutCountry.length === 10
}

export function normalizeUSPhoneDigits(value: string): string {
  const digits = extractDigits(value)
  const withoutCountry = digits.startsWith(COUNTRY_CODE)
    ? digits.slice(1)
    : digits
  return withoutCountry.slice(0, 10)
}
