# BD Tracker CRM - Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────┐ │
│  │  Components │  │   Pages     │  │   Store     │  │ Utils │ │
│  │ (UI Layer)  │  │ (Views)     │  │ (Redux)     │  │       │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └───┬───┘ │
│         │                 │                 │             │   │
│  ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐  ┌───┴───┐ │
│  │  LeadModal  │  │ Dashboard   │  │ leadSlice   │  │ api   │ │
│  │  VendorModal│  │ LeadsPage   │  │ taskSlice   │  │ cn    │ │
│  │  Protected  │  │ UsersPage   │  │ authSlice   │  │       │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └───────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │   API Gateway     │
                    │   (HTTP/REST)     │
                    └─────────┬─────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                         Backend (Node.js)                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────┐ │
│  │  Routes     │  │ Controllers │  │   Models    │  │ Utils │ │
│  │ (Endpoints) │  │ (Business   │  │ (Schemas)   │  │       │ │
│  └──────┬──────┘  │  Logic)     │  │             │  │       │ │
│         │         └──────┬──────┘  └──────┬──────┘  └───┬───┘ │
│  ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐  ┌───┴───┐ │
│  │  leadRoutes │  │ leadCtrl    │  │ Lead        │  │ seed  │ │
│  │ userRoutes  │  │ userCtrl    │  │ User        │  │ reset │ │
│  │ taskRoutes  │  │ taskCtrl    │  │ Task        │  │       │ │
│  │ ...         │  │ ...         │  │ ...         │  │       │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └───────┘ │
│         │                 │                 │             │   │
│  ┌──────┴──────┐  ┌──────┴──────┐  ┌──────┴──────┐  ┌───┴───┐ │
│  │ Middlewares │  │  Services   │  │   Events    │  │ Config│ │
│  │ (Auth/RBAC) │  │ (Audit/DB)  │  │ (Sync)      │  │ (DB)  │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └───────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │   MongoDB         │
                    │   (Database)      │
                    └───────────────────┘
```

## Module Dependency Graph

### Core Modules

```
Lead Management (leadController)
    │
    ├─► Creates/Updates ──► Lead Model (Mongoose Schema)
    │       │
    │       ├─► Status Change ──► EventEmitter ──► Vendor Onboarding
    │       │       │                       │
    │       │       │                       ├─► Creates Vendor record
    │       │       │                       └─► Creates ProductReadiness record
    │       │       │
    │       │       └─► Status Change ──► EventEmitter ──► Activity Tracking
    │       │                               │
    │       │                               └─► Creates Activity log
    │       │
    │       └─► Status Change ──► EventEmitter ──► Audit Service
    │                                   │
    │                                   └─► Creates AuditLog entry
    │
    └─► CRUD Operations ──► MongoDB
```

### Event-Driven Synchronization

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Lead Status   │────►│  EventEmitter    │────►│  Vendor Stage   │
│   Changes       │     │  (eventService)  │     │  Updates        │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │                       │                       │
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Activity Log   │     │  Audit Log       │     │  Lead Status    │
│  Creation       │     │  Creation        │     │  Update         │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### Data Flow

```
1. Frontend (React Component)
   │
   │ HTTP Request (REST API)
   ▼
2. Backend Route (e.g., POST /api/leads)
   │
   │ Middleware (Auth/RBAC validation)
   ▼
3. Controller (e.g., leadController.createLead)
   │
   │ Business Logic
   ▼
4. Model (e.g., Lead.create)
   │
   │ MongoDB Write
   ▼
5. Event Emitted (e.g., 'lead.status.changed')
   │
   │ Event Handlers
   ├─► Audit Service ──► AuditLog.create
   ├─► Activity Service ──► Activity.create
   └─► Vendor Service ──► Vendor.create/update
   │
   ▼
6. Response to Frontend
```

### Database Schema Relationships

```
Lead (Collection)
├─ _id: ObjectId
├─ name: String
├─ status: String ["New", "Contacted", "Qualified", "Onboarding", "Activated"]
├─ vendorId: ObjectId ──┐
├─ assignedTo: ObjectId ─┼─► User
└─ ...                  ┘

Vendor (Collection)
├─ _id: ObjectId
├─ name: String
├─ stage: String ["documentation", "verification", "seller_activated"]
├─ leadId: ObjectId ─────┐
└─ ...                   ┘

User (Collection)
├─ _id: ObjectId
├─ email: String
├─ role: String ["super_admin", "admin", "user", "viewer"]
└─ ...

Activity (Collection)
├─ _id: ObjectId
├─ leadId: ObjectId ─────┐
├─ type: String
├─ notes: String
└─ ...

AuditLog (Collection)
├─ _id: ObjectId
├─ entity: String
├─ entityId: ObjectId
├─ action: String
├─ changes: Object
└─ ...
```

### API Endpoints Structure

```
/api/auth
  ├─ POST /login          # User authentication
  └─ POST /register       # User registration

/api/leads
  ├─ GET    /             # List all leads (with filters)
  ├─ GET    /:id          # Get lead details
  ├─ POST   /             # Create new lead
  ├─ PUT    /:id          # Update lead
  └─ DELETE /:id          # Delete lead

/api/vendors
  ├─ GET    /             # List all vendors
  ├─ GET    /:id          # Get vendor details
  ├─ POST   /             # Create new vendor
  └─ PUT    /:id          # Update vendor

/api/activities
  ├─ GET    /             # List all activities
  └─ POST   /             # Create activity log

/api/dashboard
  └─ GET    /stats        # Get dashboard statistics

/api/tasks
  ├─ GET    /             # List all tasks
  ├─ POST   /             # Create task
  └─ PUT    /:id/status   # Update task status

/api/tickets
  ├─ GET    /             # List all tickets
  └─ POST   /             # Create ticket
```

### Security Layers

```
Client Request
    │
    ▼
JWT Authentication Middleware
    │ (Verify token, extract user)
    ▼
RBAC Authorization Middleware
    │ (Check role permissions)
    ▼
Input Validation (Mongoose schemas)
    │
    ▼
Business Logic (Controller)
    │
    ▼
Database Operation (Mongoose)
```

### State Management (Frontend)

```
Redux Store
├─ authSlice     # User auth state, token, permissions
├─ leadSlice     # Leads data, filters, loading state
├─ taskSlice     # Tasks data, status
├─ ticketSlice   # Tickets data
└─ goalSlice     # Goals data
```

### Build & Deployment

```
Development
├─ Frontend: npm run dev (Vite)
└─ Backend:  npm run dev (nodemon)

Production
├─ Frontend: npm run build → static files
└─ Backend:  npm start → Node server
```

## Key Architecture Decisions

1. **Event-Driven Design**: Decouples modules, enables automatic synchronization
2. **Mongoose ODM**: Schema validation, middleware hooks, TypeScript support
3. **JWT + RBAC**: Stateless auth, scalable permission management
4. **Redux Toolkit**: Centralized state, async thunks for API calls
5. **Audit Logging**: Immutable history of all data changes
6. **Activity Tracking**: Timeline of user actions for each lead