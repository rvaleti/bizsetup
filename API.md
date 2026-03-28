# BizSetup API Documentation

Base URL: `/api` (all endpoints are relative to this path)

## Authentication

All endpoints except `/healthz` and `/auth/google` require authentication. Include credentials with `fetch` calls using `{ credentials: 'include' }` to ensure cookies are sent.

### Auth Endpoints

#### `GET /auth/google`
Initiates Google OAuth flow. Redirects to Google's consent screen.

```bash
curl -L https://yourapp.com/api/auth/google
```

#### `GET /auth/google/callback`
OAuth callback endpoint (handled by Passport). Redirects to frontend after successful login.

#### `GET /auth/me`
Returns the authenticated user's profile.

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "avatarUrl": "https://...",
  "role": "CUSTOMER",
  "createdAt": "2025-03-28T10:00:00Z"
}
```

**Status Codes:**
- `200` — Success
- `401` — Unauthenticated

#### `POST /auth/logout`
Logs out the user and clears session.

**Response:**
```json
{
  "message": "Logged out successfully"
}
```

## Companies

### `GET /companies`

Lists companies based on user role:
- **CUSTOMER**: Only their own companies
- **FACILITATOR**: Companies with their assigned pipelines
- **ADMIN**: All companies

**Query Parameters:**
- `page` (integer, default 1) — Page number
- `pageSize` (integer, default 10) — Items per page
- `status` (string) — Filter by pipeline status (NEW, ASSIGNED, IN_PROGRESS, WAITING, COMPLETED, REJECTED, RECTIFICATION)
- `search` (string) — Search company name

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "customerId": "uuid",
      "name": "Acme Corp",
      "address": "123 Business St",
      "city": "Mumbai",
      "state": "Maharashtra",
      "pincode": "400001",
      "entityType": "Private Limited",
      "phones": ["9876543210", "9876543211"],
      "createdAt": "2025-03-28T10:00:00Z",
      "updatedAt": "2025-03-28T10:00:00Z",
      "pipeline": {
        "id": "uuid",
        "status": "NEW",
        "assignedFacilitatorId": null,
        "currentStep": 0,
        "createdAt": "2025-03-28T10:00:00Z"
      }
    }
  ],
  "total": 42,
  "page": 1,
  "pageSize": 10
}
```

**Status Codes:**
- `200` — Success
- `401` — Unauthenticated

### `POST /companies`

Creates a new company and initializes a NEW pipeline.

**Request Body:**
```json
{
  "name": "Acme Corp",
  "address": "123 Business St",
  "city": "Mumbai",
  "state": "Maharashtra",
  "pincode": "400001",
  "entityType": "Private Limited",
  "phones": ["9876543210", "9876543211"]
}
```

**Response:** Returns created company with pipeline.

**Status Codes:**
- `201` — Created
- `400` — Validation error
- `401` — Unauthenticated

### `GET /companies/:companyId`

Gets a single company's details.

**Response:** Same as POST response above.

**Status Codes:**
- `200` — Success
- `401` — Unauthenticated
- `403` — Forbidden (not your company, unless admin)
- `404` — Company not found

## Pipelines

### `GET /pipelines/:pipelineId`

Gets pipeline details including steps.

**Response:**
```json
{
  "id": "uuid",
  "status": "IN_PROGRESS",
  "assignedFacilitatorId": "uuid",
  "currentStep": 3,
  "rejectionReason": null,
  "rectificationNotes": null,
  "createdAt": "2025-03-28T10:00:00Z",
  "updatedAt": "2025-03-28T10:00:00Z",
  "steps": [
    {
      "id": "uuid",
      "stepKey": "MCA_NAME",
      "stepName": "MCA Name Reservation",
      "status": "COMPLETED",
      "completedAt": "2025-03-28T12:00:00Z"
    }
  ]
}
```

**Status Codes:**
- `200` — Success
- `401` — Unauthenticated
- `404` — Pipeline not found

### `PATCH /pipelines/:pipelineId/status`

Updates pipeline status (restricted by role).

**Request Body:**
```json
{
  "status": "IN_PROGRESS",
  "rejectionReason": null,
  "rectificationNotes": null
}
```

**Valid Transitions:**
- `NEW` → `ASSIGNED` (must assign facilitator via `/assign`)
- `ASSIGNED` → `IN_PROGRESS`
- `IN_PROGRESS` → `WAITING`, `COMPLETED`
- `WAITING` → `IN_PROGRESS`, `COMPLETED`
- `RECTIFICATION` → `IN_PROGRESS`
- Any → `REJECTED` (admin only, requires `rejectionReason`)
- Any → `RECTIFICATION` (admin only, requires `rectificationNotes`)

**Role Restrictions:**
- **CUSTOMER**: Cannot update status (403)
- **FACILITATOR**: Can move `ASSIGNED`→`IN_PROGRESS`, `IN_PROGRESS`→`WAITING/COMPLETED`, `WAITING`→`IN_PROGRESS/COMPLETED`, `RECTIFICATION`→`IN_PROGRESS`
- **ADMIN**: Can use any valid transition

**Status Codes:**
- `200` — Updated
- `400` — Invalid transition
- `401` — Unauthenticated
- `403` — Forbidden (insufficient permissions)
- `404` — Pipeline not found

### `POST /pipelines/:pipelineId/assign`

Assigns a facilitator to the pipeline (admin only).

**Request Body:**
```json
{
  "facilitatorId": "uuid",
  "message": "Assigning to handle GST"
}
```

**Effects:**
- Sets `assignedFacilitatorId` to the facilitator
- Changes status to `ASSIGNED`
- Creates notification for facilitator

**Status Codes:**
- `200` — Assigned
- `401` — Unauthenticated
- `403` — Forbidden (not admin)
- `404` — Pipeline or facilitator not found
- `422` — Terminal state (pipeline already completed/rejected)

### `PATCH /pipelines/:pipelineId/steps/:stepId`

Updates a pipeline step's status.

**Request Body:**
```json
{
  "status": "IN_PROGRESS"
}
```

**Valid Statuses:**
- `PENDING` — Not started
- `IN_PROGRESS` — Currently working
- `COMPLETED` — Finished
- `SKIPPED` — Not applicable

**Role Restrictions:**
- **CUSTOMER**: Cannot update (403)
- **FACILITATOR**: Can update own assigned pipelines
- **ADMIN**: Can update any

**Status Codes:**
- `200` — Updated
- `401` — Unauthenticated
- `403` — Forbidden
- `404` — Step not found

## Pipeline Events (Chatter)

### `GET /pipelines/:pipelineId/events`

Gets all events (comments + system events) for a pipeline.

**Query Parameters:**
- `limit` (integer, default 50) — Max events to return

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "type": "COMMENT",
      "message": "GST approval received",
      "actor": {
        "id": "uuid",
        "name": "John Doe",
        "email": "john@example.com",
        "role": "FACILITATOR"
      },
      "createdAt": "2025-03-28T14:00:00Z",
      "previousStatus": null,
      "newStatus": null
    },
    {
      "id": "uuid",
      "type": "STATUS_CHANGE",
      "message": null,
      "actor": {
        "id": "uuid",
        "name": "Admin",
        "role": "ADMIN"
      },
      "createdAt": "2025-03-28T12:00:00Z",
      "previousStatus": "NEW",
      "newStatus": "ASSIGNED"
    }
  ]
}
```

**Status Codes:**
- `200` — Success
- `401` — Unauthenticated
- `404` — Pipeline not found

### `POST /pipelines/:pipelineId/events`

Posts a comment on a pipeline.

**Request Body:**
```json
{
  "message": "Please update the GST registration status"
}
```

**Response:** Returns created event object.

**Status Codes:**
- `201` — Created
- `400` — Validation error (empty message)
- `401` — Unauthenticated
- `404` — Pipeline not found

## Notifications

### `GET /notifications`

Lists user's notifications.

**Query Parameters:**
- `page` (integer, default 1)
- `pageSize` (integer, default 20)
- `unreadOnly` (boolean, default false) — Only unread if true

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "type": "ASSIGNED",
      "message": "You have been assigned a new pipeline",
      "pipelineId": "uuid",
      "read": false,
      "createdAt": "2025-03-28T10:00:00Z"
    }
  ],
  "unreadCount": 5,
  "total": 42,
  "page": 1,
  "pageSize": 20
}
```

**Notification Types:**
- `ASSIGNED` — Facilitator was assigned to a pipeline
- `STATUS_CHANGE` — Pipeline status changed
- `STEP_COMPLETE` — Pipeline step completed
- `COMMENT` — Someone commented on your pipeline

**Status Codes:**
- `200` — Success
- `401` — Unauthenticated

### `GET /notifications/sse`

Opens a Server-Sent Events stream for real-time notifications.

**Usage:**
```javascript
const es = new EventSource("/api/notifications/sse", { withCredentials: true });

es.addEventListener("notification", (event) => {
  const notification = JSON.parse(event.data);
  console.log("New notification:", notification);
});

es.addEventListener("connected", (event) => {
  const { userId } = JSON.parse(event.data);
  console.log("Connected as:", userId);
});
```

**Status Codes:**
- `200` — Stream opened
- `401` — Unauthenticated

### `PATCH /notifications/:notificationId/read`

Marks a single notification as read.

**Status Codes:**
- `200` — Marked as read
- `401` — Unauthenticated
- `404` — Notification not found

### `PATCH /notifications/read-all`

Marks all notifications as read.

**Status Codes:**
- `200` — All marked as read
- `401` — Unauthenticated

## Users (Admin Only)

### `GET /users`

Lists all users, optionally filtered by role.

**Query Parameters:**
- `role` (string) — Filter by role: CUSTOMER, FACILITATOR, ADMIN

**Response:**
```json
[
  {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "avatarUrl": "https://...",
    "role": "FACILITATOR",
    "createdAt": "2025-03-28T10:00:00Z"
  }
]
```

**Status Codes:**
- `200` — Success
- `401` — Unauthenticated
- `403` — Forbidden (not admin)

### `PATCH /users/:userId/role`

Updates a user's role (admin only).

**Request Body:**
```json
{
  "role": "FACILITATOR"
}
```

**Valid Roles:**
- `CUSTOMER`
- `FACILITATOR`
- `ADMIN`

**Status Codes:**
- `200` — Updated
- `401` — Unauthenticated
- `403` — Forbidden (not admin)
- `404` — User not found

## Admin

### `GET /admin/stats`

Gets aggregated analytics for the dashboard.

**Response:**
```json
{
  "totalCompanies": 150,
  "totalUsers": 42,
  "activePipelines": 38,
  "avgPipelineAge": 15,
  "pipelinesByStatus": [
    { "status": "NEW", "count": 5 },
    { "status": "IN_PROGRESS", "count": 20 },
    { "status": "COMPLETED", "count": 95 }
  ],
  "companiesByEntityType": [
    { "type": "Private Limited", "count": 45 },
    { "type": "LLP", "count": 30 }
  ],
  "facilitatorWorkload": [
    {
      "facilitatorId": "uuid",
      "facilitatorName": "Jane Smith",
      "pipelineCount": 8,
      "activeCount": 5
    }
  ],
  "ageDistribution": [
    { "bucket": "0-7 days", "count": 10 },
    { "bucket": "8-14 days", "count": 8 }
  ]
}
```

**Status Codes:**
- `200` — Success
- `401` — Unauthenticated
- `403` — Forbidden (not admin)

## Error Responses

All error responses follow this format:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable error message"
}
```

**Common Error Codes:**
- `UNAUTHORIZED` — Missing authentication (401)
- `FORBIDDEN` — Insufficient permissions (403)
- `NOT_FOUND` — Resource not found (404)
- `VALIDATION_ERROR` — Invalid input (422)
- `INVALID_TRANSITION` — Invalid state transition (422)
- `INTERNAL_ERROR` — Server error (500)

## Rate Limiting

No rate limiting is currently applied. This should be added in production.

## CORS

CORS is enabled with `credentials: 'include'` for cookie-based session management.

---

**For detailed integration notes, see the [DESIGN.md](./DESIGN.md) file.**
