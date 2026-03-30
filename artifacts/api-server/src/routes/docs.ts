import { Router, type IRouter } from "express";

const router: IRouter = Router();

const openApiSpec = {
  openapi: "3.0.3",
  info: {
    title: "BizSetup API",
    version: "1.0.0",
    description:
      "REST API for the BizSetup MSME company setup automation platform. Session-based auth via Google OIDC — sign in through the web app first, then use the same browser session here.",
  },
  servers: [{ url: "/api", description: "Current server" }],
  tags: [
    { name: "Health", description: "Health check" },
    { name: "Auth", description: "Google OIDC authentication" },
    { name: "Companies", description: "Company management" },
    { name: "Pipelines", description: "Pipeline lifecycle" },
    { name: "Pipeline Steps", description: "Individual step progress" },
    { name: "Pipeline Events", description: "Chatter / event log" },
    { name: "Users", description: "User management (Admin only)" },
    { name: "Admin", description: "Admin statistics" },
    { name: "Notifications", description: "In-app notifications" },
    { name: "SSE", description: "Server-Sent Events for live notifications" },
  ],
  components: {
    schemas: {
      Error: {
        type: "object",
        properties: {
          error: { type: "string", example: "NOT_FOUND" },
          message: { type: "string", example: "Resource not found" },
        },
      },
      User: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          email: { type: "string", format: "email" },
          role: { type: "string", enum: ["CUSTOMER", "FACILITATOR", "ADMIN"] },
          avatarUrl: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      Company: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          name: { type: "string" },
          type: {
            type: "string",
            enum: ["SOLE_PROPRIETORSHIP", "PARTNERSHIP", "LLP", "PRIVATE_LIMITED", "PUBLIC_LIMITED", "OPC"],
          },
          pan: { type: "string", example: "ABCDE1234F" },
          gstNumber: { type: "string", nullable: true },
          address: { type: "string" },
          city: { type: "string" },
          state: { type: "string" },
          pincode: { type: "string" },
          customerId: { type: "string", format: "uuid" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      PipelineStep: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          pipelineId: { type: "string", format: "uuid" },
          stepName: { type: "string" },
          stepKey: { type: "string" },
          stepOrder: { type: "integer" },
          status: { type: "string", enum: ["PENDING", "IN_PROGRESS", "COMPLETED", "REJECTED"] },
          notes: { type: "string", nullable: true },
          completedAt: { type: "string", format: "date-time", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      PipelineEvent: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          pipelineId: { type: "string", format: "uuid" },
          actorId: { type: "string", format: "uuid", nullable: true },
          eventType: {
            type: "string",
            enum: ["STATUS_CHANGE", "ASSIGNED", "STEP_UPDATE", "COMMENT", "MORE_INFO", "RECTIFY", "RESUBMIT", "SYSTEM"],
          },
          previousStatus: { type: "string", nullable: true },
          newStatus: { type: "string", nullable: true },
          message: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          actor: { "$ref": "#/components/schemas/User", nullable: true },
        },
      },
      Pipeline: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          companyId: { type: "string", format: "uuid" },
          status: {
            type: "string",
            enum: ["SUBMITTED", "ASSIGNED", "IN_PROGRESS", "WAITING", "MORE_INFO", "RECTIFICATION", "RESUBMITTED", "COMPLETED", "REJECTED"],
          },
          assignedFacilitatorId: { type: "string", format: "uuid", nullable: true },
          rejectionReason: { type: "string", nullable: true },
          rectificationNotes: { type: "string", nullable: true },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
        },
      },
      PipelineDetail: {
        allOf: [
          { "$ref": "#/components/schemas/Pipeline" },
          {
            type: "object",
            properties: {
              steps: { type: "array", items: { "$ref": "#/components/schemas/PipelineStep" } },
              events: { type: "array", items: { "$ref": "#/components/schemas/PipelineEvent" } },
              company: { "$ref": "#/components/schemas/Company" },
              customer: { "$ref": "#/components/schemas/User", nullable: true },
              assignedFacilitator: { "$ref": "#/components/schemas/User", nullable: true },
            },
          },
        ],
      },
      Notification: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          userId: { type: "string", format: "uuid" },
          pipelineId: { type: "string", format: "uuid", nullable: true },
          type: { type: "string", enum: ["ASSIGNED", "STATUS_CHANGE", "MORE_INFO", "REJECTED", "RECTIFICATION", "COMPLETED", "SYSTEM"] },
          message: { type: "string" },
          read: { type: "boolean" },
          createdAt: { type: "string", format: "date-time" },
        },
      },
    },
  },
  paths: {
    "/healthz": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        responses: {
          200: { description: "Service is healthy", content: { "application/json": { schema: { type: "object", properties: { status: { type: "string", example: "ok" } } } } } },
        },
      },
    },
    "/login": {
      get: {
        tags: ["Auth"],
        summary: "Redirect to Google OIDC login",
        description: "Redirects the browser to Google's OAuth2 consent screen.",
        responses: { 302: { description: "Redirect to Google" } },
      },
    },
    "/callback": {
      get: {
        tags: ["Auth"],
        summary: "Google OIDC callback",
        description: "Handles the OAuth2 callback from Google, establishes a session and redirects to the app.",
        parameters: [
          { name: "code", in: "query", required: true, schema: { type: "string" } },
          { name: "state", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: { 302: { description: "Redirect to app" }, 400: { description: "Bad request" } },
      },
    },
    "/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Get current user",
        description: "Returns the currently authenticated user. Returns 401 if not logged in.",
        responses: {
          200: { description: "Authenticated user", content: { "application/json": { schema: { "$ref": "#/components/schemas/User" } } } },
          401: { description: "Not authenticated" },
        },
      },
    },
    "/auth/logout": {
      get: {
        tags: ["Auth"],
        summary: "Log out",
        description: "Destroys the session and redirects to the login page.",
        responses: { 302: { description: "Redirect to login" } },
      },
    },
    "/companies": {
      get: {
        tags: ["Companies"],
        summary: "List companies",
        description: "CUSTOMER sees their own companies. FACILITATOR sees companies assigned to them. ADMIN sees all.",
        responses: {
          200: { description: "List of companies", content: { "application/json": { schema: { type: "array", items: { "$ref": "#/components/schemas/Company" } } } } },
          401: { description: "Not authenticated" },
        },
      },
      post: {
        tags: ["Companies"],
        summary: "Create a company + kick off pipeline",
        description: "Creates a company record and automatically creates a pipeline with 6 steps and auto-assigns to the least-loaded facilitator.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "type", "pan", "address", "city", "state", "pincode"],
                properties: {
                  name: { type: "string", example: "Acme Pvt Ltd" },
                  type: { type: "string", enum: ["SOLE_PROPRIETORSHIP", "PARTNERSHIP", "LLP", "PRIVATE_LIMITED", "PUBLIC_LIMITED", "OPC"] },
                  pan: { type: "string", example: "ABCDE1234F" },
                  gstNumber: { type: "string", example: "27ABCDE1234F1ZP" },
                  address: { type: "string", example: "123 MG Road" },
                  city: { type: "string", example: "Bengaluru" },
                  state: { type: "string", example: "Karnataka" },
                  pincode: { type: "string", example: "560001" },
                },
              },
            },
          },
        },
        responses: {
          201: { description: "Company created", content: { "application/json": { schema: { "$ref": "#/components/schemas/Company" } } } },
          401: { description: "Not authenticated" },
          422: { description: "Validation error" },
        },
      },
    },
    "/companies/{companyId}": {
      get: {
        tags: ["Companies"],
        summary: "Get company by ID",
        parameters: [{ name: "companyId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          200: { description: "Company detail", content: { "application/json": { schema: { "$ref": "#/components/schemas/Company" } } } },
          401: { description: "Not authenticated" },
          403: { description: "Access denied" },
          404: { description: "Not found" },
        },
      },
    },
    "/pipelines": {
      post: {
        tags: ["Pipelines"],
        summary: "Create pipeline for a company",
        description: "Manually create a pipeline for an existing company (ADMIN only typically, but any authenticated user with company access can call this).",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["companyId"],
                properties: { companyId: { type: "string", format: "uuid" } },
              },
            },
          },
        },
        responses: {
          201: { description: "Pipeline created", content: { "application/json": { schema: { "$ref": "#/components/schemas/Pipeline" } } } },
          401: { description: "Not authenticated" },
          404: { description: "Company not found" },
        },
      },
    },
    "/pipelines/{pipelineId}": {
      get: {
        tags: ["Pipelines"],
        summary: "Get pipeline detail",
        description: "Returns full pipeline with steps, events, company info, customer and assigned facilitator.",
        parameters: [{ name: "pipelineId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          200: { description: "Pipeline detail", content: { "application/json": { schema: { "$ref": "#/components/schemas/PipelineDetail" } } } },
          401: { description: "Not authenticated" },
          403: { description: "Access denied" },
          404: { description: "Not found" },
        },
      },
    },
    "/pipelines/{pipelineId}/status": {
      patch: {
        tags: ["Pipelines"],
        summary: "Update pipeline status",
        description: "FACILITATOR can move pipeline through IN_PROGRESS, WAITING, COMPLETED states. ADMIN can also REJECT.",
        parameters: [{ name: "pipelineId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["status"],
                properties: {
                  status: { type: "string", enum: ["IN_PROGRESS", "WAITING", "COMPLETED", "REJECTED"] },
                  message: { type: "string" },
                  rejectionReason: { type: "string" },
                  rectificationNotes: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Updated pipeline", content: { "application/json": { schema: { "$ref": "#/components/schemas/PipelineDetail" } } } },
          401: { description: "Not authenticated" },
          403: { description: "Access denied" },
          422: { description: "Invalid transition" },
        },
      },
    },
    "/pipelines/{pipelineId}/assign": {
      post: {
        tags: ["Pipelines"],
        summary: "Assign facilitator (Admin)",
        parameters: [{ name: "pipelineId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["facilitatorId"],
                properties: {
                  facilitatorId: { type: "string", format: "uuid" },
                  message: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Pipeline with new assignment", content: { "application/json": { schema: { "$ref": "#/components/schemas/PipelineDetail" } } } },
          401: { description: "Not authenticated" },
          403: { description: "Admin only" },
          404: { description: "Pipeline or facilitator not found" },
        },
      },
    },
    "/pipelines/{pipelineId}/steps/{stepId}": {
      patch: {
        tags: ["Pipeline Steps"],
        summary: "Update a pipeline step",
        description: "Mark a step IN_PROGRESS or COMPLETED. Completing gst_filing or govt_registration moves pipeline to WAITING. Completing company_registered completes the whole pipeline.",
        parameters: [
          { name: "pipelineId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
          { name: "stepId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["status"],
                properties: {
                  status: { type: "string", enum: ["IN_PROGRESS", "COMPLETED"] },
                  notes: { type: "string" },
                },
              },
            },
          },
        },
        responses: {
          200: { description: "Updated pipeline", content: { "application/json": { schema: { "$ref": "#/components/schemas/PipelineDetail" } } } },
          401: { description: "Not authenticated" },
          403: { description: "Access denied" },
          404: { description: "Not found" },
          422: { description: "Invalid step transition" },
        },
      },
    },
    "/pipelines/{pipelineId}/more-info": {
      post: {
        tags: ["Pipelines"],
        summary: "Request more info from customer",
        description: "FACILITATOR sends a message asking the customer for additional information. Moves pipeline to MORE_INFO status.",
        parameters: [{ name: "pipelineId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["message"],
                properties: { message: { type: "string", example: "Please provide your Aadhaar number." } },
              },
            },
          },
        },
        responses: {
          200: { description: "Updated pipeline", content: { "application/json": { schema: { "$ref": "#/components/schemas/PipelineDetail" } } } },
          401: { description: "Not authenticated" },
          403: { description: "Facilitator/Admin only" },
        },
      },
    },
    "/pipelines/{pipelineId}/rectify": {
      post: {
        tags: ["Pipelines"],
        summary: "Send back for rectification",
        description: "FACILITATOR asks the customer to rectify submitted documents. Moves pipeline to RECTIFICATION status.",
        parameters: [{ name: "pipelineId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["message"],
                properties: { message: { type: "string", example: "The address proof document is blurry, please re-upload." } },
              },
            },
          },
        },
        responses: {
          200: { description: "Updated pipeline", content: { "application/json": { schema: { "$ref": "#/components/schemas/PipelineDetail" } } } },
          401: { description: "Not authenticated" },
          403: { description: "Facilitator/Admin only" },
        },
      },
    },
    "/pipelines/{pipelineId}/resubmit": {
      post: {
        tags: ["Pipelines"],
        summary: "Resubmit pipeline after rectification",
        description: "CUSTOMER resubmits the pipeline after addressing rectification or more-info requests. Moves pipeline back to RESUBMITTED status.",
        parameters: [{ name: "pipelineId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { message: { type: "string", example: "I have uploaded the corrected documents." } },
              },
            },
          },
        },
        responses: {
          200: { description: "Updated pipeline", content: { "application/json": { schema: { "$ref": "#/components/schemas/PipelineDetail" } } } },
          401: { description: "Not authenticated" },
          403: { description: "Customer/Admin only" },
        },
      },
    },
    "/pipelines/{pipelineId}/events": {
      get: {
        tags: ["Pipeline Events"],
        summary: "List pipeline events (chatter)",
        parameters: [{ name: "pipelineId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          200: { description: "List of events", content: { "application/json": { schema: { type: "array", items: { "$ref": "#/components/schemas/PipelineEvent" } } } } },
          401: { description: "Not authenticated" },
          403: { description: "Access denied" },
        },
      },
      post: {
        tags: ["Pipeline Events"],
        summary: "Post a chatter message",
        parameters: [{ name: "pipelineId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["message"],
                properties: { message: { type: "string", example: "Documents are ready for review." } },
              },
            },
          },
        },
        responses: {
          201: { description: "Event created", content: { "application/json": { schema: { "$ref": "#/components/schemas/PipelineEvent" } } } },
          401: { description: "Not authenticated" },
          403: { description: "Access denied" },
        },
      },
    },
    "/admin/stats": {
      get: {
        tags: ["Admin"],
        summary: "Get admin dashboard statistics",
        description: "Returns pipeline counts by status, facilitator workloads, and recent activity. Admin only.",
        responses: {
          200: { description: "Stats object" },
          401: { description: "Not authenticated" },
          403: { description: "Admin only" },
        },
      },
    },
    "/users": {
      get: {
        tags: ["Users"],
        summary: "List all users (Admin)",
        responses: {
          200: { description: "List of users", content: { "application/json": { schema: { type: "array", items: { "$ref": "#/components/schemas/User" } } } } },
          401: { description: "Not authenticated" },
          403: { description: "Admin only" },
        },
      },
    },
    "/users/{userId}/role": {
      patch: {
        tags: ["Users"],
        summary: "Update user role (Admin)",
        parameters: [{ name: "userId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["role"],
                properties: { role: { type: "string", enum: ["CUSTOMER", "FACILITATOR", "ADMIN"] } },
              },
            },
          },
        },
        responses: {
          200: { description: "Updated user", content: { "application/json": { schema: { "$ref": "#/components/schemas/User" } } } },
          401: { description: "Not authenticated" },
          403: { description: "Admin only" },
          404: { description: "User not found" },
        },
      },
    },
    "/notifications": {
      get: {
        tags: ["Notifications"],
        summary: "List notifications for current user",
        responses: {
          200: { description: "Notifications list", content: { "application/json": { schema: { type: "array", items: { "$ref": "#/components/schemas/Notification" } } } } },
          401: { description: "Not authenticated" },
        },
      },
    },
    "/notifications/read-all": {
      patch: {
        tags: ["Notifications"],
        summary: "Mark all notifications as read",
        responses: {
          200: { description: "OK" },
          401: { description: "Not authenticated" },
        },
      },
    },
    "/notifications/{notificationId}/read": {
      patch: {
        tags: ["Notifications"],
        summary: "Mark a single notification as read",
        parameters: [{ name: "notificationId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          200: { description: "Updated notification", content: { "application/json": { schema: { "$ref": "#/components/schemas/Notification" } } } },
          401: { description: "Not authenticated" },
          403: { description: "Access denied" },
          404: { description: "Not found" },
        },
      },
    },
    "/notifications/sse": {
      get: {
        tags: ["SSE"],
        summary: "Subscribe to live notifications via SSE",
        description: "Opens a persistent Server-Sent Events stream. The server pushes `notification` events as JSON. Keep-alive pings are sent every 30 s.",
        responses: {
          200: {
            description: "SSE stream (text/event-stream)",
            content: { "text/event-stream": { schema: { type: "string" } } },
          },
          401: { description: "Not authenticated" },
        },
      },
    },
    "/notifications/stream": {
      get: {
        tags: ["SSE"],
        summary: "Alias for /notifications/sse",
        responses: {
          200: { description: "SSE stream (text/event-stream)" },
          401: { description: "Not authenticated" },
        },
      },
    },
  },
};

router.get("/docs.json", (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.json(openApiSpec);
});

router.get("/docs", (_req, res) => {
  const specUrl = "/api/docs.json";
  res.setHeader("Content-Type", "text/html");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>BizSetup API Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css" />
  <style>
    body { margin: 0; }
    #swagger-ui .topbar { background-color: #1e293b; }
    #swagger-ui .topbar .download-url-wrapper input { background: #334155; color: #e2e8f0; border-color: #475569; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function () {
      SwaggerUIBundle({
        url: "${specUrl}",
        dom_id: "#swagger-ui",
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        layout: "StandaloneLayout",
        deepLinking: true,
        tryItOutEnabled: true,
        requestCredentials: "include",
        filter: true,
        persistAuthorization: true,
      });
    };
  </script>
</body>
</html>`);
});

export default router;
