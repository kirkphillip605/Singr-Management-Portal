'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

interface OtpInputProps {
  value: string
  onChange: (value: string) => void
  onComplete?: (value: string) => void
  length?: number
  disabled?: boolean
  autoFocus?: boolean
  className?: string
  id?: string
}

export function OtpInput({
  value,
  onChange,
  onComplete,
  length = 6,
  disabled,
  autoFocus,
  className,
  id,
}: OtpInputProps) {
  const inputs = React.useRef<Array<HTMLInputElement | null>>([])

  const digits = React.useMemo(() => {
    const arr = new Array(length).fill('')
    const v = value.replace(/\D/g, '').slice(0, length)
    for (let i = 0; i < v.length; i++) arr[i] = v[i]
    return arr
  }, [value, length])

  const isComplete = (arr: string[]) =>
    arr.length === length && arr.every((d) => d !== '')

  const setAt = (i: number, ch: string) => {
    const next = digits.slice()
    next[i] = ch
    const joined = next.join('')
    onChange(joined)
    if (isComplete(next)) {
      onComplete?.(joined)
    }
  }

  const focusAt = (i: number) => {
    const el = inputs.current[i]
    if (el) {
      el.focus()
      el.select()
    }
  }

  const handleChange = (
    i: number,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const raw = e.target.value.replace(/\D/g, '')
    if (!raw) {
      setAt(i, '')
      return
    }
    if (raw.length > 1) {
      // Pasted/typed multi chars — distribute starting from i
      const chars = raw.slice(0, length - i).split('')
      const next = digits.slice()
      for (let k = 0; k < chars.length; k++) next[i + k] = chars[k]
      const joined = next.join('')
      onChange(joined)
      const target = Math.min(i + chars.length, length - 1)
      focusAt(target)
      if (isComplete(next)) {
        onComplete?.(joined)
      }
      return
    }
    setAt(i, raw)
    if (i < length - 1) focusAt(i + 1)
  }

  const handleKeyDown = (
    i: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === 'Backspace') {
      if (digits[i]) {
        setAt(i, '')
        return
      }
      if (i > 0) {
        e.preventDefault()
        setAt(i - 1, '')
        focusAt(i - 1)
      }
    } else if (e.key === 'ArrowLeft' && i > 0) {
      e.preventDefault()
      focusAt(i - 1)
    } else if (e.key === 'ArrowRight' && i < length - 1) {
      e.preventDefault()
      focusAt(i + 1)
    }
  }

  const handlePaste = (
    i: number,
    e: React.ClipboardEvent<HTMLInputElement>,
  ) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '')
    if (!text) return
    e.preventDefault()
    const chars = text.slice(0, length - i).split('')
    const next = digits.slice()
    for (let k = 0; k < chars.length; k++) next[i + k] = chars[k]
    const joined = next.join('')
    onChange(joined)
    const target = Math.min(i + chars.length, length - 1)
    focusAt(target)
    if (isComplete(next)) {
      onComplete?.(joined)
    }
  }

  return (
    <div className={cn('flex justify-between gap-2', className)}>
      {Array.from({ length }).map((_, i) => (
        <input
          key={i}
          id={i === 0 ? id : undefined}
          ref={(el) => {
            inputs.current[i] = el
          }}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={i === 0 ? length : 1}
          value={digits[i] ?? ''}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKeyDown(i, e)}
          onPaste={(e) => handlePaste(i, e)}
          onFocus={(e) => e.currentTarget.select()}
          disabled={disabled}
          autoFocus={autoFocus && i === 0}
          aria-label={`Digit ${i + 1}`}
          className="h-12 w-full max-w-[3rem] rounded-md border border-input bg-background text-center text-lg font-semibold ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        />
      ))}
    </div>
  )
}
