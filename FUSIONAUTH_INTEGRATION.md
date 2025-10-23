# FusionAuth Integration Guide

This document describes how the Singr Billing Portal integrates with FusionAuth for authentication and authorization.

## Overview

The billing portal uses FusionAuth as the authentication provider via OAuth 2.0 / OpenID Connect. All authentication flows are handled by FusionAuth, and the application verifies user roles to control access.

## Configuration

### Environment Variables

The following environment variables must be configured in your `.env` file:

```bash
# NextAuth.js Base Configuration
NEXTAUTH_URL="https://billing.singrkaraoke.com"
NEXTAUTH_SECRET="generate-a-secure-secret-with-openssl-rand-base64-32"

# FusionAuth OAuth Configuration (Server-side)
FUSIONAUTH_ISSUER="https://auth.singrkaraoke.com"
FUSIONAUTH_CLIENT_ID="9f1a576c-708f-4f05-a3cf-12096b314ca4"
FUSIONAUTH_CLIENT_SECRET="your-fusionauth-client-secret"
FUSIONAUTH_TENANT_ID="a5b3a747-c347-44d7-8557-a98e10432d82"

# Public FusionAuth Configuration (Client-side)
NEXT_PUBLIC_FUSIONAUTH_ISSUER="https://auth.singrkaraoke.com"
NEXT_PUBLIC_FUSIONAUTH_CLIENT_ID="9f1a576c-708f-4f05-a3cf-12096b314ca4"

# Required Role for Billing Portal Access
FUSIONAUTH_REQUIRED_ROLE="customer_owner"
FUSIONAUTH_APPLICATION_ID="9f1a576c-708f-4f05-a3cf-12096b314ca4"
```

### FusionAuth Application Setup

The billing portal is configured as an application in FusionAuth with the following details:

**Application ID:** `9f1a576c-708f-4f05-a3cf-12096b314ca4`
**Tenant ID:** `a5b3a747-c347-44d7-8557-a98e10432d82`

#### OAuth 2.0 Endpoints

- **Authorization Endpoint:** `https://auth.singrkaraoke.com/oauth2/authorize`
- **Token Endpoint:** `https://auth.singrkaraoke.com/oauth2/token`
- **UserInfo Endpoint:** `https://auth.singrkaraoke.com/oauth2/userinfo`
- **Logout Endpoint:** `https://auth.singrkaraoke.com/oauth2/logout`
- **OIDC Discovery:** `https://auth.singrkaraoke.com/.well-known/openid-configuration`

#### Authorized Redirect URLs

The following redirect URLs are configured in FusionAuth:

**Production:**
- `https://billing.singrkaraoke.com/api/auth/callback/fusionauth`
- `https://billing.singrkaraoke.com/`
- `https://customer.singrkaraoke.com/api/auth/callback/fusionauth`
- `https://customer.singrkaraoke.com/`

**Development:**
- `http://localhost:3000/api/auth/callback/fusionauth`
- `http://localhost:3000/`

## Authentication Flow

### 1. Sign In

When users click "Sign in with FusionAuth" on the sign-in page:

1. The application redirects to FusionAuth's authorization endpoint
2. User authenticates with FusionAuth
3. FusionAuth redirects back to `/api/auth/callback/fusionauth` with an authorization code
4. NextAuth exchanges the code for an access token
5. The JWT callback creates or updates the user in the local database
6. User session is established with role information

### 2. Registration

When users click "Register with FusionAuth" on the sign-up page:

1. The application redirects to FusionAuth's registration endpoint
2. User completes registration in FusionAuth
3. FusionAuth redirects back to the application
4. On first sign-in, the JWT callback creates a `SingrUser` record
5. The application creates a `CustomerProfile` for the new user

### 3. User Profiles

The application maintains three types of user profiles:

- **CustomerProfile:** For billing portal customers (requires `customer_owner` role)
- **AdminProfile:** For administrative users
- **SingerProfile:** For singer-facing features

The profile type is determined during the JWT callback based on existing profiles in the database.

## Role-Based Access Control

### Required Role

Users must have the `customer_owner` role in the FusionAuth "Singr Billing Portal" application to access the billing portal.

### Role Checking

The application provides helper functions to check user roles:

```typescript
import { hasBillingPortalAccess, hasCustomerOwnerRole } from '@/lib/role-check'

// Check if user has access to billing portal
if (hasBillingPortalAccess(session)) {
  // User can access billing features
}

// Check for specific role
if (hasCustomerOwnerRole(session)) {
  // User has customer_owner role
}
```

## Database Schema

### SingrUser Model

The `SingrUser` model stores the core user information and links to FusionAuth:

```prisma
model SingrUser {
  id                String       @id @default(dbgenerated("gen_random_uuid()"))
  fusionauthUserId  String?      @unique @map("fusionauth_user_id")
  name              String
  email             String       @unique
  emailVerified     DateTime?
  image             String?
  phoneNumber       String?
  createdAt         DateTime     @default(now())
  updatedAt         DateTime     @default(now()) @updatedAt

  adminProfile      AdminProfile?
  customerProfile   CustomerProfile?
  singerProfile     SingerProfile?
  sessions          Session[]
}
```

### Session Data

The NextAuth session includes the following user data:

```typescript
interface Session {
  user: {
    id: string
    email: string
    name: string
    image?: string
    accountType: 'customer' | 'admin' | 'support'
    fusionauthUserId: string
    singrUserId: string
    customerProfileId?: string
    roles: string[]
  }
}
```

## Security Considerations

1. **Client Secret:** The `FUSIONAUTH_CLIENT_SECRET` must be kept secure and never exposed to the client
2. **Role Verification:** Always verify roles server-side before granting access to protected resources
3. **Session Management:** NextAuth handles session management with JWT tokens
4. **Logout:** Implement proper logout that clears both local session and FusionAuth session

## Testing

### Local Development

For local testing, use the localhost redirect URLs:

```bash
NEXTAUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

Ensure the FusionAuth application is configured to allow `http://localhost:3000/api/auth/callback/fusionauth` as a redirect URL.

### Testing Authentication

1. Navigate to `http://localhost:3000/auth/signin`
2. Click "Sign in with FusionAuth"
3. Complete authentication in FusionAuth
4. Verify redirect back to the application
5. Check that session contains correct user data and roles

## Troubleshooting

### Common Issues

**Issue:** Redirect URI mismatch
- **Solution:** Ensure the redirect URL in your request matches exactly what's configured in FusionAuth

**Issue:** Missing roles in session
- **Solution:** Verify that the user has been assigned the `customer_owner` role in FusionAuth

**Issue:** User not created in database
- **Solution:** Check the JWT callback logs for errors during user creation

## Migration from Credentials Auth

This implementation replaces the previous credentials-based authentication. The old signup API route (`/api/auth/signup`) is no longer used. All user registration now happens through FusionAuth.

### Migration Steps for Existing Users

1. Export existing users from the database
2. Create corresponding users in FusionAuth
3. Update `SingrUser` records with `fusionauthUserId` mapping
4. Assign appropriate roles in FusionAuth

## Support

For questions or issues with FusionAuth integration, contact:
- Email: support@singrkaraoke.com
- Phone: +1 (605) 956-0173
