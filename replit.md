# BizSetup — MSME/SME Company Registration Platform

## Overview

A comprehensive platform for automating Indian MSME/SME company registration. Three user roles: **Customer** (registers companies), **Facilitator** (executes government registration steps), **Admin** (manages the platform).

## Architecture

pnpm monorepo (TypeScript) with:
- `artifacts/api-server` — Express 5 REST API + SSE notifications
- `artifacts/web-app` — React 19 + Vite 7 + TailwindCSS 4 SPA
- `lib/db` — Drizzle ORM + PostgreSQL schema
- `scripts` — utility scripts (seed-admin, etc.)

## Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | pnpm workspaces |
| Node.js | 24 |
| Language | TypeScript 5.9 |
| API | Express 5 |
| Database | PostgreSQL + Drizzle ORM |
| Auth | Passport.js + Google OAuth 2.0 + express-session |
| Sessions | connect-pg-simple (PostgreSQL-backed) |
| Frontend | React 19 + Vite 7 |
| Styling | TailwindCSS 4 + shadcn/ui |
| Routing | Wouter |
| State | TanStack Query |
| Charts | Recharts |
| Real-time | Server-Sent Events (SSE) |

## Key Features

- **Google OAuth login** — Passport strategy, session-based auth (`req.session.userId`)
- **Company registration** — 6 entity types (Sole Proprietorship, Partnership, LLP, Private Limited, OPC, Public Limited, Section 8)
- **10-step Indian government registration pipeline** — MCA Name Reservation, DIN, DSC, GST, MSME Udyam, Shop Act, FSSAI, PF/ESI, IEC, Professional Tax
- **Pipeline state machine** — NEW→ASSIGNED→IN_PROGRESS→WAITING→COMPLETED/REJECTED/RECTIFICATION
- **Facilitator portal** — execution stepper with step status management per pipeline
- **Admin dashboard** — Recharts charts (pipeline status donut, entity type bar, facilitator workload)
- **Chatter system** — per-pipeline activity feed with comments and system events
- **SSE notifications** — real-time bell notifications broadcast to connected users

## Structure

```text
/
├── artifacts/
│   ├── api-server/          # Express API (port 8080, routed at /api)
│   │   ├── src/
│   │   │   ├── app.ts       # Express setup, session, passport, CORS
│   │   │   ├── index.ts     # Server entry, PORT binding
│   │   │   ├── lib/
│   │   │   │   ├── auth.ts          # Passport Google strategy
│   │   │   │   ├── notifications.ts # createNotification + broadcast helper
│   │   │   │   ├── pipelineSteps.ts # 10 canonical Indian govt steps
│   │   │   │   └── logger.ts        # pino logger
│   │   │   ├── middlewares/
│   │   │   │   └── requireAuth.ts   # Session-based auth + requireRole()
│   │   │   ├── routes/
│   │   │   │   ├── auth.ts      # Google OAuth routes + /auth/me + /auth/logout
│   │   │   │   ├── companies.ts # CRUD companies + pagination
│   │   │   │   ├── pipelines.ts # Pipeline CRUD + status machine + step updates
│   │   │   │   ├── events.ts    # Pipeline events (comments + system events)
│   │   │   │   ├── notifications.ts # Notification list + mark read
│   │   │   │   ├── users.ts     # User list + role update (ADMIN only)
│   │   │   │   ├── admin.ts     # Admin stats aggregation
│   │   │   │   └── sse.ts       # SSE endpoint for real-time notifications
│   │   │   └── types/
│   │   │       └── express.d.ts # Session augmentation (userId, oauthState)
│   │   └── build.mjs        # esbuild config (connect-pg-simple externalized)
│   └── web-app/             # React SPA (Vite, port from $PORT env)
│       └── src/
│           ├── App.tsx          # Router (wouter) + role-based ProtectedRoute
│           ├── components/
│           │   ├── layout.tsx   # AppLayout sidebar + NotificationBell
│           │   ├── chatter.tsx  # Pipeline chatter feed + comment form
│           │   └── status-badge.tsx
│           ├── hooks/
│           │   ├── use-auth.ts          # useAuth, useLogout
│           │   ├── use-companies.ts     # useCompanies, useCreateCompany
│           │   ├── use-pipelines.ts     # usePipeline, useUpdatePipelineStatus, useUpdatePipelineStep
│           │   ├── use-events.ts        # usePipelineEvents, usePostComment
│           │   ├── use-notifications.ts # useNotifications, useNotificationsSSE, useMarkNotificationRead
│           │   ├── use-users.ts         # useUsers, useUpdateUserRole
│           │   └── use-admin.ts         # useAdminStats
│           └── pages/
│               ├── login.tsx
│               ├── customer/
│               │   ├── dashboard.tsx      # Company list + Register New Company dialog
│               │   └── company-detail.tsx # Company + pipeline detail, step progress
│               ├── facilitator/
│               │   ├── dashboard.tsx      # Assigned pipelines list
│               │   └── pipeline-detail.tsx # Step execution stepper + Chatter
│               └── admin/
│                   ├── dashboard.tsx  # Recharts: pipeline status donut, entity bar, workload
│                   ├── companies.tsx  # Company management table with search + assign facilitator
│                   └── users.tsx      # User table with role management
├── lib/
│   └── db/
│       └── src/
│           ├── index.ts     # pool + db export
│           └── schema/      # users, companies, pipelines, pipeline_steps,
│                            # pipeline_events, notifications tables
└── scripts/
    └── src/
        └── seed-admin.ts    # Promote a Google-authenticated user to ADMIN
```

## Database Schema

| Table | Purpose |
|-------|---------|
| `users` | Google OAuth users with role (CUSTOMER/FACILITATOR/ADMIN) |
| `companies` | Registered company profiles |
| `pipelines` | Registration pipeline per company (status, assigned facilitator) |
| `pipeline_steps` | Per-pipeline individual step records (10 steps, PENDING/IN_PROGRESS/COMPLETED/SKIPPED) |
| `pipeline_events` | Chatter feed — COMMENT, STATUS_CHANGE, STEP_COMPLETE, ASSIGNED events |
| `notifications` | User notifications (read/unread) |
| `session` | express-session store (connect-pg-simple, created manually) |

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string (auto-provided by Replit) |
| `SESSION_SECRET` | Express session signing secret |
| `GOOGLE_CLIENT_ID` | Google OAuth app client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth app client secret |
| `REPLIT_DEV_DOMAIN` | Auto-set; used to construct the OAuth callback URL |
| `PORT` | Auto-set per artifact by Replit proxy |

## OAuth Callback URL

When setting up Google OAuth, add this as an authorized redirect URI:
```
https://<REPLIT_DEV_DOMAIN>/api/auth/google/callback
```

For production, add:
```
https://<your-replit-app-domain>/api/auth/google/callback
```

## Common Commands

```bash
# Run dev servers (via Replit workflows)
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/web-app run dev

# Database
pnpm --filter @workspace/db run push        # Sync schema
pnpm --filter @workspace/db run studio      # Drizzle Studio GUI

# Typecheck
pnpm run typecheck                          # Whole workspace
pnpm --filter @workspace/api-server exec tsc --noEmit
pnpm --filter @workspace/web-app exec tsc --noEmit

# Promote user to Admin (user must have logged in first)
pnpm --filter @workspace/scripts run seed-admin <email>
```

## Session Notes

- Sessions use `connect-pg-simple` (PostgreSQL-backed). The `session` table must exist (created manually; `createTableIfMissing: true` fails when bundled with esbuild).
- `connect-pg-simple` is **externalized** in `artifacts/api-server/build.mjs` to avoid the `table.sql` path resolution issue inside esbuild bundles.
- Auth flow: Google OAuth → passport strategy creates/finds user → `req.session.userId = user.id` → `req.session.save()` → redirect to frontend.

## Pipeline State Machine

```
NEW → ASSIGNED (admin assigns facilitator)
ASSIGNED → IN_PROGRESS (facilitator starts work)
IN_PROGRESS → WAITING (awaiting govt processing)
IN_PROGRESS → COMPLETED (all steps done)
WAITING → IN_PROGRESS (resumed)
WAITING → COMPLETED
Any state → REJECTED (admin only)
Any state → RECTIFICATION (corrections needed)
RECTIFICATION → IN_PROGRESS (work resumed)
```
