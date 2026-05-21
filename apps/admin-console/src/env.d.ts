// Environment variable declarations for the API app
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DATABASE_URL: string
      BETTER_AUTH_URL?: string
      BETTER_AUTH_SECRET?: string
      NEXTAUTH_URL?: string
      NEXTAUTH_SECRET?: string
      STRIPE_SECRET_KEY: string
      STRIPE_PUBLISHABLE_KEY: string
      STRIPE_WEBHOOK_SECRET: string
      STRIPE_API_VERSION: string
      NODE_ENV: 'development' | 'production' | 'test'
      NEXT_PUBLIC_APP_URL: string
    }
  }
}

export {}
