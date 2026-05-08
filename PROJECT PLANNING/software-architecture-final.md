# Singr Platform — Final Software Architecture (Implementation-Ready)

## 1) Scope and Product Surfaces

Single product, shared database, unified identity, three user experiences:

- **Singer experience** (public + optional authenticated singer account)
- **Host experience** (venue/KJ operations, paid subscription)
- **Admin/Support experience** (platform operations and moderation)
- **External machine clients** (OpenKJ + future standalone request receiver) through API keys

Core decision: **one user table, one auth system, one RBAC model**.

---

## 2) Canonical Architecture Decisions

1. **Unified auth with Better Auth**
   - One `users` table for all human users.
   - Roles stored per user (multi-role supported): `host`, `singer`, `support`, `super_admin`.

2. **Billing model**
   - Host users are the only billable users.
   - Stripe customer records are created **on demand** (first billing flow entry), not at registration time.
   - Use Better Auth Stripe plugin as the source of truth for active subscriptions.
   - Keep product/price/subscription-supporting tables only if actively used by billing/reporting flows.

3. **Singer identity model**
   - No registration required to check in, search songs, or submit requests.
   - Registered singers can optionally be linked to requests/favorites/history.
   - Standardize FK naming from `singer_identity_id` → `user_id` for consistency.

4. **Support ticketing now removed**
   - Remove ticketing/user-notes feature set and related enums/tables.

5. **Auditing and security telemetry are first-class**
   - Add dedicated `auth_logs` for security/auth lifecycle events.
   - Add dedicated `bans` table for network/user-level enforcement.
   - Keep and improve `audit_logs` for high-value operational CRUD and admin events.

---

## 3) Target Data Model (Final)

## 3.1 Keep (Core)

- `users`, Better Auth core tables (`accounts`, `sessions`, `verifications`, `two_factors`)
- Venue/domain tables: `venues`, `systems`, `songdb`, `requests`, `api_keys`, `state`
- Billing-support tables that are actively needed:
  - Better Auth Stripe subscription table (plugin-owned)
  - Product/price snapshots if required by pricing UI/reporting

## 3.2 Remove (Legacy/Not Needed)

- **Legacy singer auth table**: `singer_users`
- **Support/ticketing tables**: `tickets`, `ticket_messages`, `message_attachments`, `ticket_audits`
- **Notes table**: `user_notes`
- **Related enums**: `ticket_status`, `ticket_priority`, `message_visibility`
- **Redundant/legacy billing tables** if replaced by plugin-owned equivalents and no active dependency remains

## 3.3 Rename/Refactor

- In singer-related tables:
  - `singer_identity_id` → `user_id`
- In `requests`:
  - Keep `user_id` nullable FK to `users.id` (registered singer only, optional)
  - Unregistered requests remain valid with `user_id = NULL`

## 3.4 Add

### `auth_logs`
Purpose: immutable auth/security event stream, including failed and non-session outcomes.

Suggested columns:
- `id` UUID PK
- `user_id` UUID NULL FK `users(id)`
- `event_type` VARCHAR NOT NULL
  - examples: `login_success`, `login_failed`, `password_reset_req`, `password_reset_success`, `2fa_prompt`, `2fa_failed`, `2fa_success`, `logout`, `session_revoked`
- `ip_address` INET NULL
- `user_agent` TEXT NULL
- `context` JSONB NOT NULL DEFAULT `{}`
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()

Indexes:
- `(created_at DESC)`
- `(event_type, created_at DESC)`
- `(user_id, created_at DESC)`
- optional `(ip_address)`

### `bans`
Purpose: explicit network/user moderation policy, separate from user profile attributes.

Suggested columns:
- `id` UUID PK
- `network` CIDR NOT NULL
- `reason` TEXT NOT NULL
- `expires_at` TIMESTAMPTZ NULL
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- `banned_by` UUID NOT NULL FK `users(id)` (support/admin actor)
- `created_by_type` VARCHAR NULL (optional: `support`/`system`)
- `notes` TEXT NULL

Indexes:
- GIST or SP-GIST index on `network`
- `(expires_at)`
- `(created_at DESC)`

Constraint behavior:
- Active ban = `expires_at IS NULL OR expires_at > now()`

---

## 4) Venues Table Requirements (Final)

1. **`url_name` must be globally unique**
   - Add unique constraint/index on `venues.url_name`.
   - This is the canonical slug for singer-facing routing:
     - `https://app.singrkaraoke.com/{url_name}`

2. **Consolidate request-acceptance flags**
   - Remove `accepting_requests`.
   - Keep single `accepting` boolean.

3. **`current_system_id` behavior**
   - Same behavior whether toggled from OpenKJ integration or host portal.
   - On host toggle to accepting:
     - If there is a last-known system, retain it.
     - If no system exists, set `current_system_id = 0`.

---

## 5) Requests + Singer History Rules

1. Public singer flow does not require account creation.
2. `requests.user_id` is optional and only populated when a registered singer is known.
3. Singer history/favorites tables persist and become user-linked:
   - `singer_favorite_songs.user_id`
   - `singer_favorite_venues.user_id`
   - `singer_request_history.user_id`
4. For anonymous requests, do not force synthetic user rows.

---

## 6) Audit Strategy (Improved)

## 6.1 What to audit (high value)

Audit these domains:
- Authentication and access-control changes (role updates, ban/unban, session revocation)
- CRUD on `venues`, `systems`, `api_keys`
- Billing state changes that affect access (subscription state transitions)
- Admin/support sensitive actions (impersonation, privilege change, enforcement actions)

Do **not** audit high-volume low-risk singer request submissions in `audit_logs`.

## 6.2 `audit_logs` shape improvements

Recommended columns:
- `id`, `actor_id`, `action`, `resource_type`, `resource_id`, `surface`, `ip_address`, `user_agent`, `old_values` JSONB, `new_values` JSONB, `metadata` JSONB, `created_at`

Indexes:
- `(created_at DESC)`, `(actor_id, created_at DESC)`, `(resource_type, resource_id, created_at DESC)`, `(action, created_at DESC)`

## 6.3 Automatic insertion model

Use a hybrid strategy:

1. **Application-layer audit writer** (primary)
   - Shared function used by server actions/route handlers/services:
     - `record_audit_event(...)`
   - Captures actor identity + request context cleanly.

2. **Database trigger-backed fallback for critical tables**
   - Triggers on `venues`, `systems`, `api_keys` for INSERT/UPDATE/DELETE.
   - Trigger function writes minimal change event if app layer misses logging.

3. **Auth event hooks**
   - Better Auth callbacks/events write to `auth_logs` and selected `audit_logs` records.

This prevents silent audit gaps while preserving rich context where available.

---

## 7) App ↔ Database Interaction Strategy (Final Decision)

## 7.1 Principle

Use **ORM-backed server-side access for first-party app surfaces**, and expose **API endpoints only where needed for external clients or cross-origin/mobile public operations**.

## 7.2 By experience

1. **Host app (first-party web)**
   - Use server-side ORM/service layer directly.
   - No need to force internal CRUD through public API endpoints.

2. **Admin/Support app (first-party web)**
   - Use server-side ORM/service layer directly.
   - Enforce strict RBAC and audit wrappers in service layer.

3. **Singer app**
   - If rendered in same Next.js runtime: use server-side ORM/service layer via server actions/route handlers.
   - For separate mobile/web clients and unauthenticated public flows: expose minimal dedicated API endpoints (`nearby venues`, `song search`, `submit request`, `check-in`) with rate limits and abuse protection.

4. **External machine clients (OpenKJ + standalone receiver)**
   - Use API-key secured endpoints (existing OpenKJ-compatible contract).
   - Reuse same ingestion/update endpoints for OpenKJ and standalone receiver app.

## 7.3 Architectural rule

All ORM and API paths must call shared domain services (single business logic layer) to avoid drift.

---

## 8) Security and Operational Guardrails

- Never expose direct DB access to browser clients.
- API key endpoints: hash keys at rest, rotate/revoke support, per-key scopes where possible.
- Add IP/network ban checks early in request pipeline.
- Rate-limit anonymous singer endpoints.
- Audit all privilege and configuration mutations.

---

## 9) Implementation Order (for AI execution)

1. Remove legacy schema objects (singer_users, ticketing, user_notes, related enums) and dependent code paths.
2. Standardize singer-linked FKs to `user_id`; make `requests.user_id` nullable.
3. Consolidate venues acceptance fields to single `accepting`; enforce unique `url_name`; normalize `current_system_id` rules.
4. Finalize billing tables around Better Auth Stripe plugin; remove redundant subscription/customer legacy artifacts not in use.
5. Add `auth_logs` and `bans` tables with indexes/constraints.
6. Upgrade `audit_logs` schema and add automatic audit insertion mechanisms (app writer + DB triggers for critical tables).
7. Refactor service layer so host/admin/singer server flows use shared ORM-backed domain services.
8. Keep/expand API routes only for OpenKJ, standalone receiver integrations, and required cross-origin singer endpoints.

---

## 10) Final Outcome

This target architecture removes legacy auth/ticketing baggage, aligns billing to host-only subscriptions with on-demand Stripe customers, preserves optional singer identity linkage, and defines a clean hybrid interaction model:

- **ORM-first for trusted first-party server surfaces**
- **API-first for external integrations and cross-origin public singer operations**

This is the recommended implementation baseline for the next build phase.
