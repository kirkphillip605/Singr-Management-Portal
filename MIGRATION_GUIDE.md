# Database Schema Migration Guide

## Overview

The database schema has been successfully migrated from a NextAuth-based monolithic `User` model to a FusionAuth-ready unified user system with separate profile tables. This document outlines what has been completed and what remains to be done.

## ✅ Completed Changes

### 1. Database Schema Updates
- ✅ Replaced `User` model with `SingrUser` (mapped to `singr_users` table)
- ✅ Added `AdminProfile`, `CustomerProfile`, and `SingerProfile` models
- ✅ Updated all foreign key relationships:
  - `Venue.userId` → `Venue.customerProfileId`
  - `System.userId` → `System.customerProfileId`
  - `SongDb.userId` → `SongDb.customerProfileId`
  - `State.userId` → `State.customerProfileId`
  - `Subscription.userId` → `Subscription.customerProfileId`
  - `Customer.userId` → `Customer.customerProfileId`
  - `ApiKey.userId` removed (now references `customerProfileId` and `customerId`)
  - `Session.userId` → `Session.singrUserId`
- ✅ Removed deprecated models:
  - `Account` (FusionAuth handles OAuth)
  - `UserNote`
  - `SupportTicket`
  - `SupportTicketMessage`
  - `SupportTicketAudit`
  - `MessageAttachment`
- ✅ Removed deprecated enums:
  - `AccountType`
  - `AdminLevel`
  - `TicketStatus`
  - `TicketPriority`
  - `MessageVisibility`
- ✅ Updated table and column names to match PostgreSQL conventions:
  - All IDs now follow pattern: `<table_name>_id`
  - Consistent `created_at` and `updated_at` timestamps
  - Snake_case for all column names

### 2. Code Cleanup
- ✅ Removed all support ticket related files:
  - API routes: `/api/admin/support/*` and `/api/support/*`
  - Pages: `/app/admin/support/*` and `/app/dashboard/support/*`
  - Components: All ticket-related components
- ✅ Removed all user notes related files:
  - API routes: `/api/admin/users/[userId]/notes/*`
  - Pages: `/app/admin/users/[userId]/notes/*`
  - Components: All note-related components
- ✅ Updated navigation to remove "Support Tickets" link
- ✅ Updated admin user page to remove notes section

## 🚧 Required Application Updates

The following changes are needed to make the application functional with the new schema:

### 1. Authentication System

**Current State:** Application uses NextAuth with credentials and Google OAuth providers  
**Required Changes:**

1. Install FusionAuth SDK:
   ```bash
   npm install @fusionauth/typescript-client
   ```

2. Replace NextAuth configuration in `src/lib/auth.ts`:
   - Remove NextAuth providers
   - Add FusionAuth client initialization
   - Implement FusionAuth authentication flows

3. Update session management:
   - Modify session callbacks to work with FusionAuth tokens
   - Update `Session` model usage to reference `singrUserId`

4. Update auth types in `src/types/next-auth.d.ts`:
   - Remove `accountType` from user session (now determined by profile existence)
   - Add profile-specific data to session

### 2. Admin Pages

**Files requiring updates:**

#### `/src/app/admin/page.tsx`
- Replace `prisma.user.findMany()` with query that joins `SingrUser` with `CustomerProfile`
- Update includes to use `customerProfile` instead of direct user relations
- Access subscriptions through `customerProfile.subscriptions`
- Access venues through `customerProfile.venues`

#### `/src/app/admin/users/[userId]/page.tsx`
- Update to query `SingrUser` by ID
- Join with `CustomerProfile` to get customer-specific data
- Update all field accesses:
  - `user.customer` → `user.customerProfile.customers[0]`
  - `user.subscriptions` → `user.customerProfile.subscriptions`
  - `user.venues` → `user.customerProfile.venues`
  - `user.apiKeys` → `user.customerProfile.apiKeys`

#### `/src/app/admin/activity/page.tsx`
- Update queries to join through `customerProfile`
- Fix field name: `openKjSystemId` → `openkjSystemId`
- Update venue queries to include `customerProfile.singrUser`
- Update request queries (no direct user relation)
- Update API key queries to include `customerProfile.singrUser`

### 3. API Routes

**Files requiring systematic updates:**

#### Venue Management
- `/src/app/api/venues/route.ts`
- `/src/app/api/venues/[id]/route.ts`
- `/src/app/api/venues/[id]/accepting/route.ts`
- `/src/app/api/venues/[id]/requests/route.ts`
- `/src/app/api/admin/venues/[venueId]/route.ts`

**Changes needed:**
- Replace `userId` filters with `customerProfileId`
- Update venue creation to require `customerProfileId`
- Remove `user` includes, use `customerProfile.singrUser` if user data needed

#### System Management
- `/src/app/api/systems/route.ts`

**Changes needed:**
- Update `userId` to `customerProfileId`
- Fix field name: `openKjSystemId` → `openkjSystemId`

#### Song Database
- `/src/app/api/songdb/route.ts`
- `/src/app/api/songdb/bulk-delete/route.ts`
- `/src/app/api/songdb/bulk-insert/route.ts`

**Changes needed:**
- Update `userId` to `customerProfileId`

#### State Management
- `/src/app/api/state/route.ts`

**Changes needed:**
- Update `userId` to `customerProfileId` in `State` model queries

#### Request Handling
- Various request-related routes

**Changes needed:**
- Update to use `venueId` instead of `venue` includes where applicable
- Field name: `requestTime` → check if this exists in schema (likely `requestedAt`)

#### API Keys
- `/src/app/api/api-keys/route.ts`
- `/src/app/api/admin/api-keys/[id]/revoke/route.ts`
- `/src/app/api/admin/users/[userId]/api-keys/route.ts`

**Changes needed:**
- Update to reference both `customerProfileId` and `customerId`
- Remove direct `userId` references

### 4. Components

**Files requiring updates:**

#### Admin Components
- `/src/components/admin/admin-user-profile-form.tsx`
- `/src/components/admin/admin-create-venue-form.tsx`
- `/src/components/admin/admin-venue-editor.tsx`
- `/src/components/admin/admin-api-key-generator.tsx`

**Changes needed:**
- Update form submissions to use `customerProfileId`
- Update any user data access patterns

#### Other Components
- Any components that access user data directly

### 5. Authentication Flows

**New authentication flow with FusionAuth:**

1. **Login:**
   - User authenticates via FusionAuth
   - FusionAuth returns JWT with user ID
   - App queries `SingrUser` by `fusionauthUserId`
   - Checks for existing profiles to determine role
   - Creates session with appropriate profile data

2. **Registration:**
   - User registers via FusionAuth
   - Create `SingrUser` record with `fusionauthUserId`
   - Create appropriate profile (`CustomerProfile`, `AdminProfile`, or `SingerProfile`)
   - For customers: also create Stripe customer

3. **Profile determination:**
   ```typescript
   // Pseudo-code for session creation
   const singrUser = await prisma.singrUser.findUnique({
     where: { fusionauthUserId },
     include: {
       adminProfile: true,
       customerProfile: true,
       singerProfile: true,
     }
   })
   
   const role = singrUser.adminProfile ? 'admin' 
              : singrUser.customerProfile ? 'customer'
              : singrUser.singerProfile ? 'singer'
              : null
   ```

## 📋 Migration Checklist

### Phase 1: Authentication (Required First)
- [ ] Install FusionAuth SDK
- [ ] Create FusionAuth application in FusionAuth admin
- [ ] Update environment variables with FusionAuth credentials
- [ ] Implement FusionAuth authentication in `src/lib/auth.ts`
- [ ] Update session callbacks
- [ ] Update auth middleware
- [ ] Test authentication flows

### Phase 2: Core Data Access (After Auth)
- [ ] Update admin dashboard (`/admin/page.tsx`)
- [ ] Update admin user details (`/admin/users/[userId]/page.tsx`)
- [ ] Update admin activity page (`/admin/activity/page.tsx`)

### Phase 3: API Routes
- [ ] Update venue API routes
- [ ] Update system API routes
- [ ] Update songdb API routes
- [ ] Update request API routes
- [ ] Update API key routes
- [ ] Update state management routes

### Phase 4: Components & Forms
- [ ] Update admin components
- [ ] Update dashboard components
- [ ] Update form submissions

### Phase 5: Testing & Validation
- [ ] Test authentication flows
- [ ] Test admin functions
- [ ] Test customer functions
- [ ] Test API endpoints
- [ ] Verify data integrity

## 🗄️ Database Migration

When ready to apply the schema changes to the database:

```bash
# Generate migration
npm run db:migrate

# Or push schema directly (development only)
npm run db:push
```

**Note:** This will DROP the following tables:
- `accounts`
- `tickets`
- `ticket_messages`
- `message_attachments`
- `ticket_audits`
- `user_notes`

And RENAME:
- `users` → `singr_users`

Ensure you have backups before running migrations in production.

## 🔗 FusionAuth Setup Guide

1. **Install FusionAuth** (if not already running):
   ```bash
   # Using Docker
   docker run -p 9011:9011 -e POSTGRES_USER=fusionauth -e POSTGRES_PASSWORD=fusionauth fusionauth/fusionauth-app:latest
   ```

2. **Create Application in FusionAuth:**
   - Log in to FusionAuth admin (http://localhost:9011)
   - Create a new application for Singr
   - Configure OAuth settings
   - Note the Client ID and Client Secret

3. **Configure Environment Variables:**
   ```env
   FUSIONAUTH_URL=http://localhost:9011
   FUSIONAUTH_API_KEY=your-api-key
   FUSIONAUTH_CLIENT_ID=your-client-id
   FUSIONAUTH_CLIENT_SECRET=your-client-secret
   FUSIONAUTH_TENANT_ID=your-tenant-id
   ```

4. **User Migration:**
   - Export existing users from current database
   - Import into FusionAuth via API
   - Update `singr_users` table with `fusionauth_user_id` mappings

## 📚 Additional Resources

- [FusionAuth TypeScript Client Docs](https://github.com/FusionAuth/fusionauth-typescript-client)
- [FusionAuth OAuth Guide](https://fusionauth.io/docs/v1/tech/oauth/)
- [Prisma Schema Reference](https://www.prisma.io/docs/reference/api-reference/prisma-schema-reference)

## ⚠️ Known Issues

Until the authentication system is updated, the following functionality will not work:
- All admin pages (require user authentication)
- All dashboard pages (require user authentication)
- All authenticated API routes
- User registration/login

The schema is ready, but the application code needs the updates outlined in this guide to become functional.
