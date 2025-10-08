import { z } from 'zod'

// User validation schemas
export const signUpSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

export const signInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  image: z.string().url().optional(),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(100)
    .regex(
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
      'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    ),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

// Venue validation schemas
export const venueSchema = z.object({
  name: z.string().min(1, 'Venue name is required').max(100),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase with hyphens'),
  description: z.string().max(500).optional(),
  address: z.string().max(200).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(50).optional(),
  zipCode: z.string().max(20).optional(),
  phone: z.string().max(20).optional(),
  website: z.string().url().optional().or(z.literal('')),
  isActive: z.boolean().default(true),
})

export const createVenueSchema = venueSchema

export const updateVenueSchema = venueSchema.partial()

// API Key validation schemas
export const createApiKeySchema = z.object({
  name: z.string().min(1, 'API key name is required').max(100),
  venueId: z.string().uuid('Invalid venue ID'),
  expiresAt: z.date().optional(),
})

// Song request validation schemas
export const songRequestSchema = z.object({
  singerName: z.string().min(1, 'Singer name is required').max(100),
  songTitle: z.string().min(1, 'Song title is required').max(200),
  artist: z.string().max(200).optional(),
  notes: z.string().max(500).optional(),
  venueId: z.string().uuid(),
  phoneNumber: z.string().max(20).optional(),
})

export const updateSongRequestSchema = z.object({
  status: z.enum(['pending', 'approved', 'performed', 'cancelled']).optional(),
  position: z.number().int().min(0).optional(),
  notes: z.string().max(500).optional(),
})

// Support ticket validation schemas
export const createSupportTicketSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(200),
  description: z.string().min(10, 'Description must be at least 10 characters').max(2000),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
  category: z.enum(['billing', 'technical', 'feature_request', 'other']).default('other'),
})

export const updateSupportTicketSchema = z.object({
  status: z.enum(['open', 'pending_support', 'pending_customer', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
})

export const addSupportCommentSchema = z.object({
  content: z.string().min(1, 'Comment cannot be empty').max(2000),
  isInternal: z.boolean().default(false),
})

// Subscription validation schemas
export const createCheckoutSessionSchema = z.object({
  priceId: z.string().min(1, 'Price ID is required'),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
})

export const updateSubscriptionSchema = z.object({
  priceId: z.string().min(1, 'Price ID is required'),
})

// Pagination validation schema
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

// Search validation schema
export const searchSchema = z.object({
  q: z.string().min(1).max(200),
  ...paginationSchema.shape,
})

// ID validation schemas
export const uuidSchema = z.string().uuid('Invalid ID format')
export const slugSchema = z.string().min(1).max(100).regex(/^[a-z0-9-]+$/)

// Environment validation
export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  NEXTAUTH_URL: z.string().url(),
  NEXTAUTH_SECRET: z.string().min(32),
  GOOGLE_CLIENT_ID: z.string().min(1),
  GOOGLE_CLIENT_SECRET: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  STRIPE_PUBLISHABLE_KEY: z.string().startsWith('pk_'),
  NODE_ENV: z.enum(['development', 'production', 'test']),
})

// Type exports
export type SignUpInput = z.infer<typeof signUpSchema>
export type SignInInput = z.infer<typeof signInSchema>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
export type VenueInput = z.infer<typeof venueSchema>
export type CreateVenueInput = z.infer<typeof createVenueSchema>
export type UpdateVenueInput = z.infer<typeof updateVenueSchema>
export type CreateApiKeyInput = z.infer<typeof createApiKeySchema>
export type SongRequestInput = z.infer<typeof songRequestSchema>
export type UpdateSongRequestInput = z.infer<typeof updateSongRequestSchema>
export type CreateSupportTicketInput = z.infer<typeof createSupportTicketSchema>
export type UpdateSupportTicketInput = z.infer<typeof updateSupportTicketSchema>
export type AddSupportCommentInput = z.infer<typeof addSupportCommentSchema>
export type CreateCheckoutSessionInput = z.infer<typeof createCheckoutSessionSchema>
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>
export type PaginationInput = z.infer<typeof paginationSchema>
export type SearchInput = z.infer<typeof searchSchema>
