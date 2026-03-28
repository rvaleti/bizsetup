# BizSetup Architecture & Design

## Overview

BizSetup is a **full-stack TypeScript application** designed to automate Indian MSME/SME company registration. The platform follows a **three-tier architecture** with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────┐
│  Frontend (React + Vite)                                    │
│  ├─ Pages: Login, Customer, Facilitator, Admin              │
│  ├─ Hooks: useAuth, useCompanies, usePipeline, etc.         │
│  └─ Components: Layout, Chatter, StatusBadge, etc.          │
└─────────────────┬───────────────────────────────────────────┘
                  │ /api (HTTP + SSE)
┌─────────────────▼───────────────────────────────────────────┐
│  API Server (Express)                                       │
│  ├─ Routes: auth, companies, pipelines, events, etc.        │
│  ├─ Middleware: requireAuth, requireRole                    │
│  └─ Services: Passport, Notifications, Logger               │
└─────────────────┬───────────────────────────────────────────┘
                  │ SQL (Drizzle ORM)
┌─────────────────▼───────────────────────────────────────────┐
│  PostgreSQL Database                                        │
│  ├─ users, companies, pipelines, pipeline_steps             │
│  ├─ pipeline_events (chatter), notifications                │
│  └─ session (connect-pg-simple)                             │
└─────────────────────────────────────────────────────────────┘
```

## Authentication & Authorization

### OAuth Flow

1. **Frontend**: User clicks "Sign in with Google" → redirects to `/api/auth/google`
2. **Backend**: Generates random CSRF state token, saves to `req.session.oauthState`, redirects to Google
3. **Google**: User grants permissions, redirects back to `/api/auth/google/callback?state=...&code=...`
4. **Backend**:
   - Validates CSRF state (request state must match session state)
   - Exchanges code for tokens via Passport Google strategy
   - Upserts user in database (creates CUSTOMER on first login)
   - Saves `req.session.userId`
   - Redirects to frontend `/`
5. **Frontend**: `useAuth()` hook fetches `/api/auth/me`, detects role, redirects to appropriate dashboard

### CSRF Protection

Each OAuth request generates a new random state token:
```typescript
const state = randomBytes(16).toString("hex");
req.session.oauthState = state;
```

On callback, the state parameter is validated and **deleted** from the session to prevent replay attacks.

### Session Management

- **Storage**: PostgreSQL via `connect-pg-simple`
- **Signing**: `SESSION_SECRET` environment variable
- **Mechanism**: Signed cookies (`connect.sid`)
- **Middleware**: `requireAuth` attaches `req.user` by loading user from database

### Role-Based Access Control (RBAC)

Three roles with different capabilities:

| Endpoint | CUSTOMER | FACILITATOR | ADMIN |
|----------|----------|-------------|-------|
| GET /companies | Own only | Assigned only | All |
| POST /companies | ✓ | ✗ | ✓ |
| PATCH /pipelines/status | ✗ (403) | Own assigned | All |
| PATCH /pipelines/steps | ✗ (403) | Own assigned | All |
| POST /pipelines/assign | ✗ | ✗ | ✓ |
| PATCH /users/role | ✗ | ✗ | ✓ |
| GET /admin/stats | ✗ | ✗ | ✓ |

**Implementation**: `requireRole(...roles)` middleware checks `req.user.role` before allowing access.

## Data Model

### Users Table

```sql
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar UNIQUE NOT NULL,
  name varchar,
  avatarUrl varchar,
  role varchar DEFAULT 'CUSTOMER' NOT NULL, -- CUSTOMER | FACILITATOR | ADMIN
  oauthProvider varchar NOT NULL, -- 'google'
  oauthId varchar UNIQUE NOT NULL, -- Google account ID
  createdAt timestamp DEFAULT now()
);
```

**Note**: `oauthProvider` and `oauthId` are **never** returned in API responses (sanitized by `safeUserFields`).

### Companies Table

```sql
CREATE TABLE companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customerId uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name varchar NOT NULL,
  address varchar NOT NULL,
  city varchar,
  state varchar,
  pincode varchar,
  entityType varchar NOT NULL, -- 6 types: Sole Proprietorship, Partnership, LLP, etc.
  phones text[] NOT NULL, -- Array of phone numbers
  createdAt timestamp DEFAULT now(),
  updatedAt timestamp DEFAULT now()
);
```

### Pipelines Table

```sql
CREATE TABLE pipelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  companyId uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE UNIQUE,
  assignedFacilitatorId uuid REFERENCES users(id) ON DELETE SET NULL,
  status varchar DEFAULT 'NEW' NOT NULL, -- State machine
  currentStep int DEFAULT 0,
  rejectionReason varchar, -- If rejected
  rectificationNotes varchar, -- If needs rectification
  createdAt timestamp DEFAULT now(),
  updatedAt timestamp DEFAULT now()
);
```

### Pipeline Steps Table

Each pipeline has 10 predefined steps:
1. MCA Name Reservation
2. DIN (Director Identification Number)
3. DSC (Digital Signature Certificate)
4. GST Registration
5. MSME Udyam Registration
6. Shop Act Registration
7. FSSAI License (if applicable)
8. PF/ESI Registration
9. IEC (Import-Export Code)
10. Professional Tax Registration

```sql
CREATE TABLE pipeline_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipelineId uuid NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  stepKey varchar NOT NULL, -- MCA_NAME, DIN, DSC, etc.
  stepName varchar NOT NULL,
  status varchar DEFAULT 'PENDING' NOT NULL, -- PENDING | IN_PROGRESS | COMPLETED | SKIPPED
  completedAt timestamp,
  UNIQUE(pipelineId, stepKey)
);
```

### Pipeline Events Table (Chatter)

```sql
CREATE TABLE pipeline_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipelineId uuid NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
  type varchar NOT NULL, -- COMMENT | STATUS_CHANGE | STEP_COMPLETE | ASSIGNED
  message varchar,
  actorId uuid REFERENCES users(id),
  previousStatus varchar, -- For STATUS_CHANGE events
  newStatus varchar, -- For STATUS_CHANGE events
  createdAt timestamp DEFAULT now()
);
```

**Event Types**:
- `COMMENT`: User posted a message
- `STATUS_CHANGE`: Pipeline status changed
- `STEP_COMPLETE`: A step was marked complete
- `ASSIGNED`: Facilitator was assigned

### Notifications Table

```sql
CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  userId uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pipelineId uuid REFERENCES pipelines(id) ON DELETE SET NULL,
  type varchar NOT NULL, -- ASSIGNED | STATUS_CHANGE | STEP_COMPLETE | COMMENT
  message varchar NOT NULL,
  read boolean DEFAULT false,
  createdAt timestamp DEFAULT now()
);
```

## Pipeline State Machine

The pipeline progresses through states based on the registration workflow:

```
NEW
  └─→ (admin assigns facilitator via POST /pipelines/:id/assign)
ASSIGNED
  └─→ (facilitator clicks "Start Working")
IN_PROGRESS
  ├─→ (facilitator clicks "Mark Waiting")
  │   WAITING
  │   ├─→ (government processing complete, resume)
  │   │   IN_PROGRESS
  │   └─→ (ready to complete)
  │       COMPLETED ✓
  └─→ (all steps done)
     COMPLETED ✓

RECTIFICATION (admin requests corrections)
  └─→ IN_PROGRESS (facilitator retries)

REJECTED (admin rejects) ✗

Any state can transition to:
  - REJECTED (admin only, requires rejectionReason)
  - RECTIFICATION (admin only, requires rectificationNotes)
```

**Validation**: Status transitions are validated in the `PATCH /pipelines/:id/status` endpoint using a whitelist of allowed transitions.

## Real-Time Notifications (SSE)

### Connection Flow

1. **Frontend**: `useNotificationsSSE()` hook opens `new EventSource("/api/notifications/sse", { withCredentials: true })`
2. **Backend**: Maintains in-memory `Map<userId, Set<Response>>` of connected clients
3. **Broadcast**: When an event occurs (e.g., status change), `broadcastNotification(userId, data)` is called, which writes SSE messages to all active client connections
4. **Frontend**: Listens for `notification` events and invalidates React Query cache to refetch `/api/notifications`

### Architecture

- **Stateless Broadcasting**: No database writes for connections; state is in-memory
- **Heartbeat**: 30-second ping to keep connections alive and detect client disconnects
- **Cleanup**: When client closes, connection is removed from the map
- **Limitations**: Works only within a single server instance; for multi-instance deployments, use Redis pub/sub

### Events Broadcast

```typescript
broadcastNotification(userId, {
  id, pipelineId, type, message, read, createdAt
});
```

The frontend then:
1. Shows a toast notification
2. Updates the bell unread count
3. Allows clicking to navigate to the relevant pipeline

## API Design Principles

### Consistency

- All endpoints return JSON with `{ data, ... }` or `{ error, message }`
- Status codes follow HTTP conventions (200, 201, 400, 401, 403, 404, 422, 500)
- Date fields use ISO 8601 format

### Pagination

List endpoints support:
- `page` (1-indexed)
- `pageSize`
- Returns `{ data: [...], total, page, pageSize }`

### Filtering & Search

- Status filtering via `?status=IN_PROGRESS`
- Text search via `?search=company_name`
- Role filtering via `?role=FACILITATOR`

### Sanitization

Sensitive user fields are excluded from all API responses:
```typescript
const safeUserFields = { id, email, name, avatarUrl, role, createdAt };
// Never include: oauthProvider, oauthId, passwords
```

## Frontend Architecture

### Pages Structure

```
/                           Login page (oauth)
/dashboard                  Customer: company list + register form
/dashboard/company/:id      Customer: pipeline detail + chatter
/facilitator                Facilitator: assigned pipelines list
/facilitator/pipeline/:id   Facilitator: step execution + chatter
/admin                      Admin: analytics dashboard
/admin/companies            Admin: company management table
/admin/users                Admin: user management + role updates
```

### Hooks Pattern

Custom React Query hooks wrap API calls:

```typescript
// Read hook
const { data, isLoading, error } = useCompanies({ page: 1, status: "IN_PROGRESS" });

// Mutation hook
const { mutate, isPending } = useCreateCompany();
mutate({ name, address, ... });
```

**Benefits**:
- Automatic caching and refetching
- Pagination support
- Error handling
- Loading states

### State Management

- **Server State**: TanStack Query (cached API responses)
- **UI State**: React component state (modals, forms, filters)
- **Auth State**: `useAuth()` hook (cached from `/api/auth/me`)

## Deployment Considerations

### Environment Setup

1. **Database**: PostgreSQL must be accessible at `DATABASE_URL`
2. **Google OAuth**: Create app at https://console.cloud.google.com
   - Redirect URI: `https://<your-domain>/api/auth/google/callback`
   - Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
3. **Secrets**: Generate random `SESSION_SECRET` (min 32 characters)

### Scaling Notes

- **Single Server**: Current SSE implementation works (in-memory client registry)
- **Multiple Servers**: Replace in-memory broadcasting with Redis pub/sub
- **Database**: Use connection pooling (Drizzle already uses pg pool)
- **Frontend**: Vite SPA can be served from static hosting (S3, Cloudflare Pages, Netlify)

### Security Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Use strong `SESSION_SECRET` (not default)
- [ ] Enable HTTPS and redirect HTTP → HTTPS
- [ ] Set secure cookie flags: `secure`, `httpOnly`, `sameSite=Lax`
- [ ] Implement rate limiting (not currently done)
- [ ] Enable CORS only for trusted origins
- [ ] Add request size limits (not currently done)
- [ ] Implement audit logging for admin actions
- [ ] Use environment-specific Google OAuth credentials

## Error Handling

### Frontend

All API calls wrap errors in try-catch:
```typescript
try {
  const data = await fetch(...).then(r => r.json());
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  toast({ title: "Error", description: message, variant: "destructive" });
}
```

### Backend

All route handlers have try-catch with logging:
```typescript
try {
  // business logic
} catch (err) {
  req.log.error({ err }, "Operation failed");
  res.status(500).json({ error: "INTERNAL_ERROR", message: "..." });
}
```

## Performance

### Frontend Optimizations

- **Code Splitting**: Lazy-loaded pages via Wouter
- **Query Caching**: TanStack Query caches paginated results
- **Lazy Images**: `img` tags can use `loading="lazy"`
- **SSE Invalidation**: Only refetch when SSE event arrives (not polling)

### Backend Optimizations

- **Database Indexing**: Indexes on `userId`, `companyId`, `pipelineId` foreign keys
- **Prepared Statements**: All queries via Drizzle ORM (safe from SQL injection)
- **Connection Pooling**: pg pool reuses database connections
- **No N+1 Queries**: Load facilitator data with `select` (not lazy)

## Testing

Currently, no automated tests are implemented. For production, add:

- **Unit Tests**: Route handlers, helpers (Jest)
- **Integration Tests**: Full API flows (Supertest + PostgreSQL)
- **E2E Tests**: UI workflows (Playwright)
- **Load Tests**: SSE broadcasting, pagination performance

## Future Enhancements

- [ ] **Email Notifications**: Trigger emails for status changes, assignments
- [ ] **Document Upload**: Store GST certs, DSC files, etc. (S3 / Cloud Storage)
- [ ] **SMS Alerts**: Send step reminders via SMS
- [ ] **Multi-Language**: Localize for regional languages
- [ ] **Offline Mode**: Service Worker + IndexedDB for offline-first PWA
- [ ] **Webhook Integration**: Alert external systems of status changes
- [ ] **Analytics**: Track time-to-completion, facilitator performance metrics
- [ ] **Audit Log**: Full history of all user actions for compliance

---

For API documentation, see [API.md](./API.md).
For setup instructions, see [SETUP.md](./SETUP.md).
