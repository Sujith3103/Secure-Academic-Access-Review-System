<<<<<<< HEAD
# 🔐 SAARS — Secure Academic Access Review System

A **production-grade, security-first academic management platform** built with a modern full-stack JavaScript architecture. SAARS implements robust Role-Based Access Control (RBAC), immutable audit logging, JWT-based session management, and comprehensive academic workflows for Admins, Staff (Instructors), and Students.

---

## 📐 Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend                       │
│  Vite + TypeScript · Zustand · Axios · React Hook Form  │
│  Role-based routing · Silent token refresh              │
└─────────────────────┬───────────────────────────────────┘
                      │ REST API (JWT Bearer)
┌─────────────────────▼───────────────────────────────────┐
│                 Express Backend                         │
│  TypeScript · Modular Controllers · Policy Engine       │
│  Middleware: Auth → Authorize → Validate → Sanitize     │
├─────────────────────────────────────────────────────────┤
│  Security Layer                                         │
│  ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌────────────┐  │
│  │ Helmet  │ │Rate Limit│ │  CORS   │ │XSS Sanitize│  │
│  └─────────┘ └──────────┘ └─────────┘ └────────────┘  │
├─────────────────────────────────────────────────────────┤
│  Data Layer                                             │
│  ┌──────────┐  ┌────────────┐  ┌────────────────────┐  │
│  │PostgreSQL│  │Redis Cache │  │Local File Storage  │  │
│  │(Prisma)  │  │(Blacklist) │  │(Multer)            │  │
│  └──────────┘  └────────────┘  └────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 🚀 Features

### 🔐 Security & Auth
- **JWT Authentication** with access + refresh token rotation
- **Password hashing** with bcrypt (12 salt rounds)
- **Policy-based RBAC** via centralized `PolicyEngine` + `policyMatrix`
- **Session management** — list active sessions, revoke individual or all
- **IP address & user agent tracking** per session
- **Token blacklisting** via Redis (revoked tokens blocked in real-time)
- **Rate limiting** — general API, auth endpoints (10 req/15min), file uploads
- **Input sanitization** — XSS protection, prototype pollution prevention
- **Security headers** — Helmet with CSP, HSTS, X-Frame-Options
- **Zod schema validation** on all endpoints

### 📊 Audit Logging (Immutable)
- Every critical action logged: CREATE, UPDATE, DELETE, LOGIN, LOGOUT, UPLOAD, ASSIGN, GRADE, SUBMIT, REVIEW
- Metadata: actor, resource, resourceId, IP address, user agent, timestamps
- **Append-only** — no UPDATE/DELETE on audit table
- Filterable by action, resource, user, date range
- Paginated API + Admin dashboard visualization

### 🎓 Academic Workflows
- **Admin**: User management, academic cycles, staff-student mapping, CSV bulk upload
- **Staff**: Assignment creation, submission review, grading with feedback
- **Student**: Assignment viewing, file submission, grade/feedback tracking

### 🖥️ Frontend
- **Catppuccin Mocha dark theme** with glassmorphism and micro-animations
- **Role-based dashboards** with overview stats, data tables, modals
- **Silent token refresh** via Axios interceptors
- **Demo credential quickfill** on login page
- Responsive layout with sidebar navigation

---

## 🛠 Tech Stack

| Layer       | Technology                              |
|-------------|----------------------------------------|
| Frontend    | React 19, Vite, TypeScript, Zustand    |
| Backend     | Node.js, Express, TypeScript           |
| Database    | PostgreSQL (Supabase-hosted)           |
| ORM         | Prisma                                 |
| Cache       | Redis (ioredis)                        |
| Auth        | JWT (jsonwebtoken), bcryptjs           |
| Validation  | Zod                                    |
| File Upload | Multer (local storage)                 |
| Logging     | Winston                                |
| API Docs    | Swagger (swagger-jsdoc + swagger-ui)   |
| Deploy      | Docker + Docker Compose + nginx        |

---

## 📁 Folder Structure

```
├── client/                           # React frontend
│   ├── src/
│   │   ├── api/client.ts             # Axios instance + API helpers
│   │   ├── pages/                    # LoginPage, AdminDashboard, etc.
│   │   ├── components/               # PrivateRoute, shared UI
│   │   ├── store/auth.store.ts       # Zustand auth state
│   │   └── index.css                 # Complete design system
│   ├── Dockerfile                    # Multi-stage → nginx
│   └── nginx.conf                    # SPA routing + API proxy
│
├── server/                           # Express backend
│   ├── src/
│   │   ├── config/                   # env, database, redis
│   │   ├── core/                     # errors, response, logger
│   │   ├── middleware/               # auth, authorize, validate, sanitize, etc.
│   │   ├── modules/
│   │   │   ├── auth/                 # login, register, refresh, sessions
│   │   │   ├── admin/                # users, cycles, mappings, audit, stats
│   │   │   ├── staff/                # assignments, submissions, grading
│   │   │   └── student/              # assignments, submit, grades
│   │   ├── policies/                 # PolicyEngine + policyMatrix
│   │   ├── services/                 # auth.service (JWT, bcrypt, tokens)
│   │   ├── shared/                   # audit, cache, pagination
│   │   └── prisma/
│   │       ├── schema.prisma         # Database schema
│   │       └── seed.ts               # Sample data
│   ├── Dockerfile                    # Multi-stage → Node.js alpine
│   └── .env.example                  # Environment template
│
├── docker-compose.yml                # Full-stack orchestration
└── README.md
```

---

## ⚡ Quick Start

### Prerequisites
- Node.js ≥ 18
- PostgreSQL database (or use Supabase)
- Redis instance (or use Upstash/local)

### 1. Clone & Install

```bash
git clone https://github.com/your-repo/saars.git
cd saars

# Backend
cd server
npm install
cp .env.example .env   # Fill in your credentials

# Frontend
cd ../client
npm install
```

### 2. Configure Environment

Edit `server/.env` with your credentials:

```env
DATABASE_URL="postgresql://user:pass@host:5432/saars?pgbouncer=true"
DIRECT_URL="postgresql://user:pass@host:5432/saars"
JWT_ACCESS_SECRET=your_64_char_secret
JWT_REFRESH_SECRET=another_64_char_secret
REDIS_HOST=your_redis_host
REDIS_PORT=12784
REDIS_PASSWORD=your_redis_password
CLIENT_URL=http://localhost:5173
```

### 3. Setup Database

```bash
cd server
npx prisma generate
npx prisma db push    # or: npx prisma migrate dev
npx ts-node src/prisma/seed.ts
```

### 4. Run Development Servers

```bash
# Terminal 1 — Backend
cd server
npm run dev

# Terminal 2 — Frontend
cd client
npm run dev
```

Open **http://localhost:5173** in your browser.

### 5. Docker Deployment

```bash
# From project root
docker-compose up --build
```

---

## 🔑 Seed Data Credentials

| Role    | Email               | Password       |
|---------|---------------------|----------------|
| Admin   | admin@saars.io      | Admin@2024!    |
| Staff 1 | dr.smith@saars.io   | Staff@2024!    |
| Staff 2 | ms.priya@saars.io   | Staff@2024!    |
| Student | student1@saars.io   | Student@2024!  |
| Student | student2@saars.io   | Student@2024!  |
| Student | student3@saars.io   | Student@2024!  |
| Student | student4@saars.io   | Student@2024!  |
| Student | student5@saars.io   | Student@2024!  |

---

## 📡 API Reference

### Auth
| Method | Endpoint            | Auth | Description              |
|--------|---------------------|------|--------------------------|
| POST   | /auth/register      | No   | Register new user        |
| POST   | /auth/login         | No   | Login & get tokens       |
| POST   | /auth/refresh       | No   | Rotate refresh token     |
| POST   | /auth/logout        | Yes  | Blacklist tokens         |
| GET    | /auth/me            | Yes  | Get current user profile |
| GET    | /auth/sessions      | Yes  | List active sessions     |
| DELETE | /auth/sessions/:id  | Yes  | Revoke specific session  |
| DELETE | /auth/sessions      | Yes  | Revoke all sessions      |

### Admin (requires ADMIN role)
| Method | Endpoint                     | Description                    |
|--------|------------------------------|--------------------------------|
| POST   | /admin/cycles                | Create academic cycle          |
| GET    | /admin/cycles                | List cycles (paginated)        |
| PATCH  | /admin/cycles/:id            | Update cycle                   |
| DELETE | /admin/cycles/:id            | Delete cycle                   |
| GET    | /admin/users                 | List all users (paginated)     |
| PATCH  | /admin/users/:id/deactivate  | Deactivate user                |
| POST   | /admin/assign-students       | Map students to staff          |
| GET    | /admin/staff/:id/students    | Get staff's assigned students  |
| POST   | /admin/bulk-upload           | CSV bulk student onboarding    |
| GET    | /admin/stats                 | System-wide analytics          |
| GET    | /admin/audit-logs            | Filtered, paginated audit logs |

### Staff (requires STAFF role)
| Method | Endpoint                                  | Description            |
|--------|-------------------------------------------|------------------------|
| GET    | /staff/my-students                        | Assigned students      |
| POST   | /staff/assignments                        | Create assignment      |
| GET    | /staff/assignments                        | List assignments       |
| GET    | /staff/assignments/:id/submissions        | Submission list        |
| POST   | /staff/submissions/:id/review             | Add review comment     |
| POST   | /staff/submissions/:id/grade              | Grade submission       |

### Student (requires STUDENT role)
| Method | Endpoint                | Description          |
|--------|-------------------------|----------------------|
| GET    | /student/my-staff       | Assigned instructors |
| GET    | /student/assignments    | Available assignments|
| POST   | /student/submit         | Submit assignment    |
| GET    | /student/submissions    | My submissions       |
| GET    | /student/grades         | My grades & feedback |

> All API responses follow the format: `{ success, message, data, meta?, timestamp }`

---

## 🔒 Security Model

### Authorization Flow
```
Request → Rate Limiter → Sanitize → Authenticate (JWT + Redis blacklist check)
       → Authorize (PolicyEngine.can(role, resource, action))
       → Validate (Zod schema)
       → Controller → Service → Database
       → Audit Log (async, non-blocking)
```

### Policy Matrix
Permissions are declared in `policyMatrix.ts`:
```typescript
ADMIN:  { users: [read, update], academic_cycles: [*], audit_logs: [read], ... }
STAFF:  { assignments: [create, read], submissions: [read, review], grades: [grade], ... }
STUDENT:{ assignments: [read], submissions: [read, submit], grades: [read], ... }
```

---

## 🧪 Testing Considerations

The system handles:
- **Unauthorized access**: Policy engine rejects role/resource/action mismatches
- **Invalid tokens**: Middleware returns 401 with proper error codes
- **Expired sessions**: Refresh token rotation with Redis blacklisting
- **Invalid inputs**: Zod rejects malformed data with field-level errors
- **File validation**: MIME type + size limits enforced at middleware level
- **Brute force**: Auth rate limiter (10 requests per 15 minutes)
- **XSS attacks**: Input sanitization strips malicious scripts
- **Prototype pollution**: Blocked keys: `__proto__`, `constructor`, `prototype`

---

## 📝 License

MIT License — Built as a demonstration of production-grade security patterns in full-stack JavaScript applications.
=======
# Secure Academic Access Review System (SAARS)

## 📌 Overview

SAARS is a hierarchical academic access control system where users request elevated access to protected portals.  
Access is granted through structured approval workflows and enforced via role-based authorization.

---

## 🏗 Tech Stack

Frontend:
- React (Vite)
- Axios
- React Router

Backend:
- Node.js
- Express
- PostgreSQL
- JWT Authentication
- bcrypt

---

## 🔐 System Roles

- Student
- Staff
- Admin

---

## 📂 Resources

- Public Portal (accessible to all)
- Staff Portal (requires staff role or approval)
- Admin Portal (requires admin role or approval)

---

## 🚀 Installation

### 1️⃣ Clone the repository

```bash
git clone https://github.com/yourusername/Secure-Academic-Access-Review-System.git
cd Secure-Academic-Access-Review-System
>>>>>>> 700d56f72c8ea768f60815052449e9ea237cc9b3
