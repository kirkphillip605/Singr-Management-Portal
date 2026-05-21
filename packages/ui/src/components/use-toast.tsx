// src/components/ui/use-toast.tsx

'use client'

import * as React from 'react'
import { type ToastProps } from '@radix-ui/react-toast'
import {
  Toast,                   // ✅ needed to render each toast
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from './toast'

// Define ToastActionElement type locally since it's not exported by Radix
type ToastActionElement = React.ReactElement<any>

/**
 * A tiny in-memory toast store with a React hook + Toaster renderer.
 * - Keeps API surface minimal and framework-agnostic.
 * - Avoids duplicate listener registrations.
 * - Preserves existing logic and behavior.
 */

const TOAST_LIMIT = 1
const TOAST_REMOVE_DELAY = 1_000_000 as const // ~16m; mirrors your original value

const actionTypes = {
  ADD_TOAST: 'ADD_TOAST',
  UPDATE_TOAST: 'UPDATE_TOAST',
  DISMISS_TOAST: 'DISMISS_TOAST',
  REMOVE_TOAST: 'REMOVE_TOAST',
} as const

let count = 0
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER
  return count.toString()
}

type ToastData = ToastProps & {
  id: string
  title?: React.ReactNode
  description?: React.ReactNode
  action?: ToastActionElement
  variant?: 'default' | 'destructive'
}

type Action =
  | { type: typeof actionTypes.ADD_TOAST; toast: ToastData }
  | { type: typeof actionTypes.UPDATE_TOAST; toast: Partial<ToastData> }
  | { type: typeof actionTypes.DISMISS_TOAST; toastId?: string }
  | { type: typeof actionTypes.REMOVE_TOAST; toastId?: string }

type State = { toasts: ToastData[] }

// Track timeouts so we don't schedule multiple removals for the same toast.
const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

const addToRemoveQueue = (toastId: string) => {
  if (toastTimeouts.has(toastId)) return
  const timeout = setTimeout(() => {
    toastTimeouts.delete(toastId)
    dispatch({ type: actionTypes.REMOVE_TOAST, toastId })
  }, TOAST_REMOVE_DELAY)
  toastTimeouts.set(toastId, timeout)
}

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case actionTypes.ADD_TOAST:
      return { ...state, toasts: [action.toast, ...state.toasts].slice(0, TOAST_LIMIT) }

    case actionTypes.UPDATE_TOAST:
      return {
        ...state,
        toasts: state.toasts.map((t) => (t.id === action.toast.id ? { ...t, ...action.toast } : t)),
      }

    case actionTypes.DISMISS_TOAST: {
      const { toastId } = action
      if (toastId) addToRemoveQueue(toastId)
      else state.toasts.forEach((t) => addToRemoveQueue(t.id))

      return {
        ...state,
        toasts: state.toasts.map((t) =>
          t.id === toastId || toastId === undefined ? { ...t, open: false } : t,
        ),
      }
    }

    case actionTypes.REMOVE_TOAST:
      if (action.toastId === undefined) return { ...state, toasts: [] }
      return { ...state, toasts: state.toasts.filter((t) => t.id !== action.toastId) }
  }
}

const listeners: Array<(state: State) => void> = []
let memoryState: State = { toasts: [] }

function dispatch(action: Action) {
  memoryState = reducer(memoryState, action)
  for (const l of listeners) l(memoryState)
}

/**
 * useToast — subscribe to the in-memory toast store.
 * Returns the current list and two helpers: toast() and dismiss().
 */
function useToast() {
  const [state, setState] = React.useState<State>(memoryState)

  // Register once on mount; clean up on unmount
  React.useEffect(() => {
    listeners.push(setState)
    return () => {
      const idx = listeners.indexOf(setState)
      if (idx > -1) listeners.splice(idx, 1)
    }
  }, [])

  return {
    ...state,
    toast: ({
      title,
      description,
      action,
      ...props
    }: Omit<ToastData, 'id'> & { id?: string }) => {
      const id = props.id ?? genId()
      dispatch({
        type: actionTypes.ADD_TOAST,
        toast: { ...props, id, title, description, action },
      })
      return id
    },
    dismiss: (toastId?: string) => dispatch({ type: actionTypes.DISMISS_TOAST, toastId }),
  }
}

/**
 * Toaster — renders the Radix/SHadcn toast primitives for all active toasts.
 * Mount once (e.g., in app/providers.tsx or app/layout.tsx) inside a client boundary.
 */
function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(({ id, title, description, action, ...props }) => (
        <Toast key={id} {...props}>
          <div className="grid gap-1">
            {title && <ToastTitle>{title}</ToastTitle>}
            {description && <ToastDescription>{description}</ToastDescription>}
          </div>
          {action}
          <ToastClose />
        </Toast>
      ))}
      <ToastViewport />
    </ToastProvider>
  )
}

export { Toaster, useToast }
