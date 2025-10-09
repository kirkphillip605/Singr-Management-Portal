# Support Ticket System Architecture

## Customer Flow

```
Customer Dashboard (/dashboard/support)
    ↓
[Create Ticket Form] ← File Attachments (max 10MB, validated types)
    ↓
POST /api/support/tickets
    ↓
[Ticket Created in Database]
    ↓
Customer redirected to: /dashboard/support/{ticketId}
    ↓
[View Ticket & Messages] → Only PUBLIC messages visible
    ↓
[Reply to Ticket] ← File Attachments
    ↓
POST /api/support/tickets/{ticketId}/messages
    ↓
[Message Added + Status Update]
```

## Admin/Support Flow

```
Admin Dashboard (/admin/support)
    ↓
[Ticket List View]
    - All tickets across customers
    - Filter by status (Open, Pending, Resolved, Closed)
    - Shows priority, assignee, last update
    ↓
Click ticket → /admin/support/{ticketId}
    ↓
[Admin Ticket Detail Page]
    ├── Left Side: Message Thread
    │   - Shows ALL messages (public + internal)
    │   - Internal notes highlighted in yellow
    │   - Reply form with visibility toggle
    │   
    └── Right Side: Ticket Actions
        ├── Ticket Details (requester, dates, etc.)
        └── Action Panel
            ├── Update Status
            ├── Change Priority
            └── Assign to Admin/Support User
```

## API Endpoints

### Customer APIs (Existing)
- `POST /api/support/tickets` - Create new ticket
- `POST /api/support/tickets/{ticketId}/messages` - Reply to ticket

### Admin APIs (New)
- `PATCH /api/admin/support/tickets/{ticketId}/status` - Update ticket status
- `PATCH /api/admin/support/tickets/{ticketId}/priority` - Update ticket priority
- `PATCH /api/admin/support/tickets/{ticketId}/assign` - Assign/unassign ticket
- `POST /api/admin/support/tickets/{ticketId}/messages` - Reply with public/internal visibility

## Database Schema

```
SupportTicket
├── id (UUID)
├── requesterId → User (customer)
├── createdById → User (who created it)
├── assigneeId → User (admin/support)
├── subject
├── description
├── status (open, pending_support, pending_customer, resolved, closed)
├── priority (low, normal, high, urgent)
├── category
├── timestamps
└── relations:
    ├── messages[] → SupportTicketMessage
    └── audits[] → SupportTicketAudit

SupportTicketMessage
├── id (UUID)
├── ticketId → SupportTicket
├── authorId → User
├── visibility (public, internal)
├── body
├── timestamps
└── attachments[] → SupportMessageAttachment

SupportMessageAttachment
├── id (UUID)
├── messageId → SupportTicketMessage
├── fileName
├── mimeType
├── byteSize
├── storageUrl (e.g., /uploads/support/{ticketId}/{uuid}.pdf)
└── timestamp

SupportTicketAudit
├── id (UUID)
├── ticketId → SupportTicket
├── actorId → User (who made the change)
├── action (status_changed, priority_changed, assignee_changed)
├── oldValues (JSON)
├── newValues (JSON)
└── timestamp
```

## File Storage

```
public/
└── uploads/
    └── support/
        └── {ticketId}/
            ├── {uuid1}.pdf
            ├── {uuid2}.jpg
            └── {uuid3}.docx
```

- Files are stored with UUID-based names to prevent collisions
- Directory structure auto-created per ticket
- All files served through Next.js static file serving
- `.gitignore` excludes `public/uploads/` from version control

## Authentication & Authorization

### Customer Access
- Must be authenticated with `accountType: 'customer'`
- Can only view/modify their own tickets (`requesterId = session.user.id`)
- Cannot see internal notes

### Admin/Support Access
- Must be authenticated with `accountType: 'admin'` OR `accountType: 'support'`
- Can view ALL tickets across all customers
- Can see internal notes
- Can update ticket status, priority, and assignment
- Can reply with public or internal visibility

### Audit Trail
All admin actions (status change, priority change, assignment) are logged in `SupportTicketAudit` table with:
- Who made the change (actorId)
- What changed (action type)
- Before/after values (oldValues, newValues)
- When it happened (timestamp)

## Key Features

### File Attachments
- ✅ Supported types: images, videos, PDFs, Office docs
- ✅ Max size: 10MB per file
- ✅ Max count: 5 files per message
- ✅ Validation on both client and server
- ✅ Safe storage with UUID filenames
- ✅ Transaction rollback cleans up files on error

### Message Visibility
- ✅ **Public messages**: Visible to both customer and admin/support
- ✅ **Internal notes**: Only visible to admin/support staff
- ✅ Visual distinction (yellow background for internal)
- ✅ Proper filtering based on user type

### Status Management
- ✅ Open → New ticket, not yet triaged
- ✅ Pending Support → Waiting for admin/support response
- ✅ Pending Customer → Waiting for customer response
- ✅ Resolved → Issue solved, awaiting confirmation
- ✅ Closed → Fully closed, archived

### Priority Levels
- ✅ Low → Non-urgent issues
- ✅ Normal → Standard priority (default)
- ✅ High → Important issues
- ✅ Urgent → Critical issues requiring immediate attention

## Component Architecture

```
Admin Pages
├── /admin/support/page.tsx
│   └── Shows ticket list with counts
│
└── /admin/support/[ticketId]/page.tsx
    ├── SupportTicketMessageThread (enhanced)
    ├── AdminTicketReplyForm
    └── AdminTicketActions

Customer Pages
├── /dashboard/support/page.tsx
│   ├── SupportTicketCreateForm
│   └── SupportTicketList
│
└── /dashboard/support/[ticketId]/page.tsx
    ├── SupportTicketMessageThread
    └── SupportTicketReplyForm

Shared Components
├── SupportTicketStatusBadge
├── SupportTicketPriorityBadge
├── SupportAttachmentLink
└── SupportTicketMessageThread
```
