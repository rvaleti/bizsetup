# BizSetup Setup & Deployment Guide

## Local Development Setup

### Prerequisites

- Node.js 24+ (check with `node --version`)
- PostgreSQL 15+ (local or remote instance)
- pnpm 10+ (install with `npm install -g pnpm`)
- Google OAuth app credentials

### Step 1: Clone & Install Dependencies

```bash
git clone https://github.com/rvaleti/bizsetup.git
cd bizsetup
pnpm install
```

### Step 2: Create `.env.local` (Development)

Create a `.env.local` file in the project root with:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/bizsetup

# Session
SESSION_SECRET=your-super-secret-key-min-32-chars-please-use-random

# Google OAuth (get from https://console.cloud.google.com)
GOOGLE_CLIENT_ID=123456789.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-1234567890abcdefgh

# Frontend URL (for OAuth redirect)
FRONTEND_URL=/
```

**To generate a secure `SESSION_SECRET`:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Step 3: Database Setup

Create the database:
```bash
createdb bizsetup
```

Push the schema:
```bash
pnpm --filter @workspace/db run push
```

You'll see a prompt asking if you want to push the schema. Type `yes` and hit Enter.

Verify the schema:
```bash
pnpm --filter @workspace/db run studio
# Opens http://localhost:5555 to browse the database
```

### Step 4: Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (name it "BizSetup" or similar)
3. Enable the "Google+ API"
4. Create OAuth 2.0 credentials:
   - Type: Web application
   - Authorized JavaScript origins: `http://localhost:5173`, `http://localhost:3000`
   - Authorized redirect URIs: `http://localhost:5173/api/auth/google/callback`
5. Copy the Client ID and Client Secret into `.env.local`

### Step 5: Run Dev Servers

In separate terminal windows:

```bash
# Terminal 1: API Server (runs on port 8080)
pnpm --filter @workspace/api-server run dev

# Terminal 2: Frontend (runs on port 5173)
pnpm --filter @workspace/web-app run dev
```

Open http://localhost:5173 in your browser.

### Step 6: Create Admin User

After you've signed in with Google at least once:

```bash
pnpm --filter @workspace/scripts run seed-admin your@email.com
```

This promotes your user account to ADMIN role. Restart the frontend to see the admin dashboard.

## Production Deployment

### Hosting Options

- **Vercel**: Frontend (SPA) + serverless API
- **Railway**: Full-stack (Node.js + PostgreSQL)
- **Render**: Same as Railway
- **AWS**: EC2 (API) + RDS (PostgreSQL) + S3 (static frontend)
- **DigitalOcean**: App Platform + Managed Database

### Pre-Deployment Checklist

- [ ] Set `NODE_ENV=production` on the server
- [ ] Use strong `SESSION_SECRET` (min 32 random characters)
- [ ] Create separate Google OAuth credentials for production domain
- [ ] Set up PostgreSQL on a managed database service (not localhost)
- [ ] Enable HTTPS (Let's Encrypt or managed by platform)
- [ ] Set secure cookie flags in Express session config
- [ ] Test OAuth flow end-to-end on staging domain first

### Environment Variables

Set these in your deployment platform:

| Variable | Example Value | Notes |
|----------|---------------|-------|
| `NODE_ENV` | `production` | Must be production |
| `DATABASE_URL` | `postgresql://...` | Use managed database |
| `SESSION_SECRET` | `(random 32+ chars)` | Generate with `crypto.randomBytes(32).toString('hex')` |
| `GOOGLE_CLIENT_ID` | `xxx.apps.googleusercontent.com` | Production credentials |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-xxx` | Production credentials |
| `FRONTEND_URL` | `https://yourapp.com` | Your production domain |

### Database Migration for Production

```bash
# On production server
export DATABASE_URL=postgresql://...
pnpm --filter @workspace/db run push
```

This will:
1. Connect to the production PostgreSQL
2. Create all tables if they don't exist
3. Run any pending migrations

### API Server Deployment

**Build for production:**
```bash
pnpm --filter @workspace/api-server run build
```

This creates a bundle in `artifacts/api-server/dist/`.

**Start the server:**
```bash
NODE_ENV=production node dist/index.js
```

The server will:
- Bind to `PORT` environment variable (default 8080)
- Connect to `DATABASE_URL`
- Initialize Passport with Google strategy
- Set up SSE endpoint at `/api/notifications/sse`

### Frontend Deployment

**Build for production:**
```bash
pnpm --filter @workspace/web-app run build
```

This creates optimized files in `artifacts/web-app/dist/`.

**Serve the static files:**
```bash
# Option 1: Simple HTTP server
npx serve -s dist -l 3000

# Option 2: nginx
# Copy dist/* to /var/www/html or /usr/share/nginx/html

# Option 3: AWS S3 + CloudFront
aws s3 sync dist/ s3://your-bucket-name/
```

**Important**: The frontend is a **Single Page Application (SPA)**. Configure your web server to serve `index.html` for all non-file routes:

**nginx example:**
```nginx
server {
    listen 80;
    server_name yourapp.com;

    root /usr/share/nginx/html;
    index index.html;

    # Serve index.html for SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API calls to backend
    location /api {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Docker Deployment (Optional)

Create a `Dockerfile` at the project root:

```dockerfile
FROM node:24-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy workspace files
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
COPY . .

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build API and frontend
RUN pnpm --filter @workspace/api-server run build
RUN pnpm --filter @workspace/web-app run build

# Expose port
EXPOSE 8080 5173

# Start both servers (using a process manager like pm2 or supervisor)
CMD ["sh", "-c", "pnpm --filter @workspace/api-server run dev & pnpm --filter @workspace/web-app run dev"]
```

Build and run:
```bash
docker build -t bizsetup .
docker run -p 8080:8080 -p 5173:5173 \
  -e DATABASE_URL=postgresql://... \
  -e SESSION_SECRET=... \
  -e GOOGLE_CLIENT_ID=... \
  -e GOOGLE_CLIENT_SECRET=... \
  bizsetup
```

## Scaling & Performance Tuning

### Single Server

Current setup works fine for up to **~100 concurrent users**:
- In-memory SSE client registry handles notifications
- PostgreSQL connection pool (default 20 connections) handles requests
- TanStack Query on frontend reduces API calls via caching

### Multiple Servers / Microservices

For **>500 concurrent users**, migrate to:

1. **Redis for Session Store**:
   ```typescript
   const RedisStore = require("connect-redis").default;
   const redisClient = redis.createClient(process.env.REDIS_URL);
   
   session({
     store: new RedisStore({ client: redisClient }),
     ...
   });
   ```

2. **Redis for SSE Broadcasting**:
   ```typescript
   // Server A publishes event
   redis.publish("notifications", JSON.stringify({ userId, data }));
   
   // Server B subscribes
   redis.subscribe("notifications", (msg) => {
     const { userId, data } = JSON.parse(msg);
     broadcastToLocalClients(userId, data);
   });
   ```

3. **PostgreSQL Replication**: Set up master-slave replication for read scaling.

4. **Frontend CDN**: Serve `dist/` files from Cloudflare / AWS CloudFront.

### Database Optimization

Add indexes for common queries:

```sql
CREATE INDEX idx_users_oauth ON users(oauthProvider, oauthId);
CREATE INDEX idx_companies_customer ON companies(customerId);
CREATE INDEX idx_pipelines_company ON pipelines(companyId);
CREATE INDEX idx_pipelines_facilitator ON pipelines(assignedFacilitatorId);
CREATE INDEX idx_pipeline_events_pipeline ON pipeline_events(pipelineId);
CREATE INDEX idx_notifications_user ON notifications(userId);
CREATE INDEX idx_notifications_read ON notifications(userId, read);
```

## Monitoring & Logging

### Application Logging

The API uses **pino** logger. In production, set:
```bash
LOG_LEVEL=info  # Change to 'debug' for troubleshooting
```

Logs are written to stdout and should be captured by your platform's logging service.

### Error Tracking

Integrate with Sentry or similar:

```typescript
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});

app.use(Sentry.Handlers.errorHandler());
```

### Health Checks

Both servers expose health check endpoints:
- **API**: `GET /healthz` → `{ "status": "ok" }`
- **Frontend**: Any request to `/` returns index.html (200)

Set up monitoring to hit these regularly.

## Backup & Recovery

### Database Backups

```bash
# Weekly backup
pg_dump -h $DB_HOST -U $DB_USER $DB_NAME | gzip > backup-$(date +%Y%m%d).sql.gz

# Restore from backup
gunzip backup-20250401.sql.gz
psql -h $DB_HOST -U $DB_USER $DB_NAME < backup-20250401.sql
```

Configure automated backups with your managed database provider (RDS, Railway, etc.).

### Session Cleanup

The `session` table grows indefinitely. Add a periodic cleanup job:

```sql
-- Delete sessions older than 30 days
DELETE FROM session WHERE expire < now() - interval '30 days';
```

## Troubleshooting

### "OAuth state mismatch"

- Session storage not persisting (check `connect-pg-simple` setup)
- User's cookies disabled
- Timing issue (state expired)

**Solution**: Clear cookies and restart login.

### "ECONNREFUSED at localhost:5432"

Database is not running or wrong credentials in `DATABASE_URL`.

**Solution**: Start PostgreSQL and verify connection string.

### "Cannot POST /api/auth/google/callback"

Frontend OAuth redirect URL doesn't match configured redirect URI in Google Console.

**Solution**: Update Google OAuth credentials with correct callback URL.

### "Session table does not exist"

The `session` table is created manually (esbuild bundling issue).

**Solution**: Run:
```sql
CREATE TABLE session (
  sid varchar PRIMARY KEY,
  sess json NOT NULL,
  expire timestamp NOT NULL
);
CREATE INDEX ON session (expire);
```

### SSE connections drop after 30s

Network proxy or load balancer buffering responses.

**Solution**: Ensure all proxies have `X-Accel-Buffering: no` enabled.

## Next Steps

1. **Email Notifications**: Use SendGrid or AWS SES to send emails on status changes
2. **Document Storage**: Add S3 integration for uploading certificates
3. **Analytics**: Track time-to-completion, facilitator metrics
4. **Audit Trail**: Log all user actions for compliance
5. **Multi-Tenancy**: Support multiple companies managing their own facilitators (SaaS model)

---

**For API documentation, see [API.md](./API.md).**
**For architecture details, see [DESIGN.md](./DESIGN.md).**
