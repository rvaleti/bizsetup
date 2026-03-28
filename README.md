# BizSetup — MSME/SME Company Registration Platform

A comprehensive platform for automating Indian MSME/SME company registration with **Google OAuth authentication**, **10-step government registration pipeline**, **real-time notifications**, and **role-based portal dashboards**.

## Features

✅ **Google OAuth Login** — Secure authentication for customers, facilitators, and admins  
✅ **Company Registration** — Support for 6 entity types (Sole Proprietorship, Partnership, LLP, Private Limited, OPC, Section 8)  
✅ **10-Step Pipeline** — Automates Indian government registration: MCA Name Reservation, DIN, DSC, GST, MSME Udyam, Shop Act, FSSAI, PF/ESI, IEC, Professional Tax  
✅ **Facilitator Portal** — Step-by-step execution interface with status management  
✅ **Admin Dashboard** — Recharts analytics (pipeline status, entity types, facilitator workload)  
✅ **Real-Time Notifications** — Server-Sent Events (SSE) with in-memory broadcasting  
✅ **Chatter System** — Per-pipeline activity feed with comments and system events  
✅ **Role-Based Access Control** — Three roles (Customer, Facilitator, Admin) with proper authorization  

## User Roles

| Role | Capabilities |
|------|---|
| **Customer** | Register companies, view own pipeline progress, post comments |
| **Facilitator** | Execute pipeline steps, update status, manage assigned pipelines |
| **Admin** | Create/view all companies, assign facilitators, manage users, view analytics |

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Monorepo** | pnpm workspaces |
| **Runtime** | Node.js 24 + TypeScript 5.9 |
| **API Server** | Express 5 |
| **Database** | PostgreSQL + Drizzle ORM |
| **Authentication** | Passport.js + Google OAuth 2.0 |
| **Sessions** | connect-pg-simple |
| **Frontend** | React 19 + Vite 7 |
| **Styling** | TailwindCSS 4 + shadcn/ui |
| **Routing** | Wouter |
| **State Management** | TanStack Query |
| **Charts** | Recharts |
| **Real-Time** | Server-Sent Events (SSE) |

## Quick Start

### Prerequisites
- Node.js 24+
- PostgreSQL 15+
- Google OAuth app credentials

### Installation

```bash
# Install dependencies
pnpm install

# Setup environment variables
# .env should include:
# - DATABASE_URL (PostgreSQL connection string)
# - SESSION_SECRET (random string)
# - GOOGLE_CLIENT_ID
# - GOOGLE_CLIENT_SECRET

# Push database schema
pnpm --filter @workspace/db run push

# Run dev servers
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/web-app run dev
```

Visit http://localhost:3000 in your browser.

## Project Structure

```
├── artifacts/
│   ├── api-server/          # Express REST API + SSE
│   │   └── src/
│   │       ├── routes/      # Auth, companies, pipelines, events, notifications, users, admin
│   │       └── lib/         # Passport, notifications, logger
│   └── web-app/             # React SPA
│       └── src/
│           ├── pages/       # Login, Customer/Facilitator/Admin dashboards
│           ├── hooks/       # React Query hooks for API
│           └── components/  # Layout, chatter, status badge, etc.
├── lib/
│   └── db/                  # Drizzle schema, migrations
└── scripts/
    └── src/
        └── seed-admin.ts    # Promote user to admin
```

## API Endpoints

All API endpoints are available at `/api`. Key endpoints:

**Authentication:**
- `GET /api/auth/google` — Initiate Google OAuth
- `GET /api/auth/me` — Get current user
- `POST /api/auth/logout` — Logout

**Companies:**
- `GET /api/companies` — List companies (filtered by role)
- `POST /api/companies` — Create new company + pipeline
- `GET /api/companies/:id` — Get company details

**Pipelines:**
- `GET /api/pipelines/:id` — Get pipeline details
- `PATCH /api/pipelines/:id/status` — Update pipeline status
- `PATCH /api/pipelines/:id/steps/:stepId` — Update step status
- `POST /api/pipelines/:id/assign` — Assign facilitator (admin only)

**Events & Comments:**
- `GET /api/pipelines/:id/events` — Get pipeline chatter feed
- `POST /api/pipelines/:id/events` — Post comment

**Notifications:**
- `GET /api/notifications` — List user notifications
- `GET /api/notifications/sse` — SSE stream (real-time)
- `PATCH /api/notifications/:id/read` — Mark notification read
- `PATCH /api/notifications/read-all` — Mark all as read

**Admin:**
- `GET /api/admin/stats` — Analytics (charts data)
- `GET /api/users` — List all users
- `PATCH /api/users/:id/role` — Update user role

See [API.md](./API.md) for complete endpoint documentation.

## Database Schema

| Table | Purpose |
|-------|---------|
| `users` | Google OAuth users with role (CUSTOMER/FACILITATOR/ADMIN) |
| `companies` | Registered company profiles |
| `pipelines` | Registration pipeline per company (status, assigned facilitator) |
| `pipeline_steps` | Individual step records (10 steps, PENDING/IN_PROGRESS/COMPLETED/SKIPPED) |
| `pipeline_events` | Chatter feed — comments and system events |
| `notifications` | User notifications (read/unread) |
| `session` | Express session store |

## Pipeline State Machine

```
NEW 
  ↓ (admin assigns facilitator)
ASSIGNED 
  ↓ (facilitator starts)
IN_PROGRESS 
  ├→ WAITING (awaiting govt)
  ├→ COMPLETED (done)
  └→ REJECTED (admin)
  
WAITING 
  ├→ IN_PROGRESS (resume)
  └→ COMPLETED

RECTIFICATION 
  └→ IN_PROGRESS (retry)
```

Any state can transition to `REJECTED` or `RECTIFICATION` (admin only).

## Key Commands

```bash
# Development
pnpm run dev                                    # All workflows
pnpm --filter @workspace/api-server run dev   # API only
pnpm --filter @workspace/web-app run dev      # Frontend only

# Database
pnpm --filter @workspace/db run push          # Sync schema
pnpm --filter @workspace/db run studio        # Open Drizzle Studio

# Type checking
pnpm run typecheck                            # All packages

# Setup admin user
pnpm --filter @workspace/scripts run seed-admin <email>
```

## Deployment

See [SETUP.md](./SETUP.md) for production deployment instructions.

## Architecture & Design

See [DESIGN.md](./DESIGN.md) for architectural decisions, security considerations, and design patterns.

## Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `DATABASE_URL` | PostgreSQL connection | `postgresql://user:pass@localhost/bizsetup` |
| `SESSION_SECRET` | Express session signing | `your-secret-key-here` |
| `GOOGLE_CLIENT_ID` | Google OAuth app ID | `123456789.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret | `GOCSPX-...` |
| `FRONTEND_URL` | OAuth redirect target | `/` (default) or `https://yourapp.com` |
| `PORT` | Server port (auto-set) | `8080` |

## Security

- **OAuth CSRF Protection**: Random state token per request, validated on callback
- **Session Management**: PostgreSQL-backed sessions via connect-pg-simple
- **Role-Based Authorization**: requireRole middleware blocks unauthorized access
- **Data Sanitization**: User fields exclude oauthProvider and oauthId from API responses
- **Prepared Statements**: All DB queries via Drizzle ORM (SQL injection safe)
- **HTTPS in Production**: Redirect HTTP → HTTPS, set secure cookies

## License

Proprietary — All rights reserved.

## Support

For issues or questions, please open a GitHub issue in this repository.
