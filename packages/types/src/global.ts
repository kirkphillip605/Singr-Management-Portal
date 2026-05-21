// Global type definitions shared across all apps and packages

// Next.js 15 Page Props with async params
export interface PageProps<
  TParams = Record<string, string>,
  TSearchParams = Record<string, string | string[] | undefined>,
> {
  params: Promise<TParams>
  searchParams: Promise<TSearchParams>
}

// Layout Props for Next.js 15
export interface LayoutProps<TParams = Record<string, string>> {
  children: React.ReactNode
  params: Promise<TParams>
}

// Route Handler Context for Next.js 15
export interface RouteContext<TParams = Record<string, string>> {
  params: Promise<TParams>
}

// Utility types
export type Prettify<T> = {
  [K in keyof T]: T[K]
} & {}

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

export type RequiredNotNull<T> = {
  [P in keyof T]: NonNullable<T[P]>
}

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface ApiError {
  message: string
  code?: string
  statusCode?: number
}

// Pagination types
export interface PaginationParams {
  page?: number
  limit?: number
  cursor?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasMore: boolean
    nextCursor?: string
  }
}

// Form state types
export interface FormState<T = unknown> {
  data?: T
  errors?: Record<string, string[]>
  message?: string
  success?: boolean
}

// Async state types
export interface AsyncState<T = unknown, E = Error> {
  data: T | null
  error: E | null
  loading: boolean
  isIdle: boolean
  isLoading: boolean
  isSuccess: boolean
  isError: boolean
}
