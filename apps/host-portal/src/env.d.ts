// Environment variable declarations for the Host Portal app
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      DATABASE_URL: string
      BETTER_AUTH_URL?: string
      BETTER_AUTH_SECRET?: string
      NEXTAUTH_URL?: string
      NEXTAUTH_SECRET?: string
      TWILIO_ACCOUNT_SID?: string
      TWILIO_AUTH_TOKEN?: string
      TWILIO_FROM_NUMBER?: string
      SMTP_HOST?: string
      SMTP_PORT?: string
      SMTP_USER?: string
      SMTP_PASS?: string
      SMTP_FROM?: string
      EMAIL_FROM?: string
      GOOGLE_CLIENT_ID: string
      GOOGLE_CLIENT_SECRET: string
      STRIPE_SECRET_KEY: string
      STRIPE_PUBLISHABLE_KEY: string
      STRIPE_WEBHOOK_SECRET: string
      STRIPE_API_VERSION: string
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: string
      SENTRY_AUTH_TOKEN?: string
      NEXT_PUBLIC_SENTRY_DSN?: string
      NODE_ENV: 'development' | 'production' | 'test'
      NEXT_PUBLIC_APP_URL: string
      NEXT_PUBLIC_GOOGLE_CLIENT_ID?: string
      NEXT_PUBLIC_GOOGLE_CLIENT_SECRET?: string
      HERE_API_KEY?: string
    }
  }
}

export {}
