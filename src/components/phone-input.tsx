'use client'

import * as React from 'react'
import { Phone } from 'lucide-react'

import { IconInput } from '@/components/ui/icon-input'
import {
  formatUSPhoneInput,
  normalizeUSPhoneDigits,
} from '@/lib/phone'

export function toE164US(value: string): string {
  const digits = normalizeUSPhoneDigits(value)
  if (digits.length !== 10) return ''
  return `+1${digits}`
}

interface PhoneInputProps
  extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    'value' | 'onChange' | 'type'
  > {
  value: string
  onChange: (formatted: string, e164: string) => void
}

export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value, onChange, placeholder, ...rest }, ref) => {
    const display = React.useMemo(() => formatUSPhoneInput(value), [value])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatUSPhoneInput(e.target.value)
      onChange(formatted, toE164US(formatted))
    }

    return (
      <IconInput
        ref={ref}
        type="tel"
        inputMode="numeric"
        autoComplete="tel"
        icon={Phone}
        placeholder={placeholder ?? '+1 (555) 123-4567'}
        value={display}
        onChange={handleChange}
        {...rest}
      />
    )
  },
)
PhoneInput.displayName = 'PhoneInput'
