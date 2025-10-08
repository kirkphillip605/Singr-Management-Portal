'use client'

import { useCallback, useEffect, useReducer, useRef } from 'react'

export interface AsyncState<T, E = Error> {
  status: 'idle' | 'loading' | 'success' | 'error'
  data: T | null
  error: E | null
}

type AsyncAction<T, E> =
  | { type: 'loading' }
  | { type: 'success'; payload: T }
  | { type: 'error'; payload: E }
  | { type: 'reset' }

function asyncReducer<T, E>(
  state: AsyncState<T, E>,
  action: AsyncAction<T, E>
): AsyncState<T, E> {
  switch (action.type) {
    case 'loading':
      return { status: 'loading', data: null, error: null }
    case 'success':
      return { status: 'success', data: action.payload, error: null }
    case 'error':
      return { status: 'error', data: null, error: action.payload }
    case 'reset':
      return { status: 'idle', data: null, error: null }
    default:
      return state
  }
}

export interface UseAsyncOptions<T> {
  immediate?: boolean
  initialData?: T | null
  onSuccess?: (data: T) => void
  onError?: (error: Error) => void
}

export interface UseAsyncReturn<T, E = Error> {
  execute: (...args: any[]) => Promise<T | undefined>
  reset: () => void
  data: T | null
  error: E | null
  status: 'idle' | 'loading' | 'success' | 'error'
  isIdle: boolean
  isLoading: boolean
  isSuccess: boolean
  isError: boolean
}

/**
 * Custom hook for handling async operations with proper state management
 * 
 * @example
 * ```tsx
 * const { execute, data, isLoading, error } = useAsync(
 *   async (userId: string) => {
 *     const response = await fetch(`/api/users/${userId}`)
 *     return response.json()
 *   },
 *   { immediate: false }
 * )
 * 
 * // Execute the async function
 * await execute('user-123')
 * ```
 */
export function useAsync<T = unknown, E = Error>(
  asyncFunction: (...args: any[]) => Promise<T>,
  options: UseAsyncOptions<T> = {}
): UseAsyncReturn<T, E> {
  const {
    immediate = false,
    initialData = null,
    onSuccess,
    onError,
  } = options

  const [state, dispatch] = useReducer(asyncReducer<T, E>, {
    status: 'idle',
    data: initialData,
    error: null,
  })

  // Use refs to track mounted state to prevent memory leaks
  const isMountedRef = useRef(true)
  const asyncFunctionRef = useRef(asyncFunction)

  // Update asyncFunction ref when it changes
  useEffect(() => {
    asyncFunctionRef.current = asyncFunction
  }, [asyncFunction])

  const execute = useCallback(
    async (...args: any[]): Promise<T | undefined> => {
      dispatch({ type: 'loading' })

      try {
        const data = await asyncFunctionRef.current(...args)
        
        if (!isMountedRef.current) return undefined

        dispatch({ type: 'success', payload: data })
        onSuccess?.(data)
        return data
      } catch (error) {
        if (!isMountedRef.current) return undefined

        const errorObj = error as E
        dispatch({ type: 'error', payload: errorObj })
        onError?.(error as Error)
        return undefined
      }
    },
    [onSuccess, onError]
  )

  const reset = useCallback(() => {
    dispatch({ type: 'reset' })
  }, [])

  // Execute immediately if specified
  useEffect(() => {
    if (immediate) {
      execute()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  return {
    execute,
    reset,
    data: state.data,
    error: state.error,
    status: state.status,
    isIdle: state.status === 'idle',
    isLoading: state.status === 'loading',
    isSuccess: state.status === 'success',
    isError: state.status === 'error',
  }
}

/**
 * Hook for auto-refetching data at specified intervals
 */
export function useAsyncWithRefetch<T = unknown, E = Error>(
  asyncFunction: (...args: any[]) => Promise<T>,
  options: UseAsyncOptions<T> & { refetchInterval?: number } = {}
): UseAsyncReturn<T, E> & { refetch: () => Promise<T | undefined> } {
  const { refetchInterval, ...asyncOptions } = options
  const asyncResult = useAsync<T, E>(asyncFunction, asyncOptions)
  const intervalRef = useRef<NodeJS.Timeout>()

  const refetch = useCallback(async () => {
    return asyncResult.execute()
  }, [asyncResult])

  useEffect(() => {
    if (refetchInterval && refetchInterval > 0) {
      intervalRef.current = setInterval(() => {
        refetch()
      }, refetchInterval)

      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current)
        }
      }
    }
  }, [refetchInterval, refetch])

  return {
    ...asyncResult,
    refetch,
  }
}
