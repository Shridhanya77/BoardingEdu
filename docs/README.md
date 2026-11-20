# BoardingEdu documentation

This folder describes the BoardingEdu platform as it exists in the source code. It is written for developers, project managers, and reviewers who need to understand what is implemented, how the pieces connect, and where the product is incomplete.

BoardingEdu is a school-discovery platform. Visitors search and compare schools. Parents keep children, shortlists, saved searches, and admission applications. School administrators maintain one assigned school, subject to staff approval. Staff and super administrators operate moderation, verification, and master data, mainly through Django Admin plus two frontend dashboards.

The notes below are based on the repository. They are not a specification of features that were only planned.

## How to read this set

| Document | What it covers |
| --- | --- |
| [01 Project overview](01_PROJECT_OVERVIEW.md) | Purpose, stack, roles, and how the product is organised |
| [02 System architecture](02_SYSTEM_ARCHITECTURE.md) | Applications, request flow, and integration map |
| [03 Public website](03_PUBLIC_WEBSITE_DOCUMENTATION.md) | Pages a visitor can use without an account |
| [04 Parent portal](04_PARENT_PORTAL_DOCUMENTATION.md) | Parent registration, dashboard, children, shortlists, and applications |
| [05 School admin](05_SCHOOL_ADMIN_DOCUMENTATION.md) | School administrator console and approval workflow |
| [06 Staff admin](06_STAFF_ADMIN_DOCUMENTATION.md) | Staff queues and the limits of that role |
| [07 Main admin](07_MAIN_ADMIN_DOCUMENTATION.md) | Super Admin, Django Admin, and platform dashboard |
| [08 Frontend technical](08_FRONTEND_TECHNICAL_DOCUMENTATION.md) | Next.js routes, components, and client behaviour |
| [09 Backend technical](09_BACKEND_TECHNICAL_DOCUMENTATION.md) | Django apps, permissions, jobs, storage, and search |
| [10 Database](10_DATABASE_DOCUMENTATION.md) | Tables, relationships, and an entity diagram |
| [11 API](11_API_DOCUMENTATION.md) | Endpoint catalogue |
| [12 User workflows](12_USER_WORKFLOWS.md) | Step-by-step journeys across frontend and API |
| [13 Authentication and permissions](13_AUTHENTICATION_AND_PERMISSIONS.md) | JWT, OTP, and the role matrix |
| [14 Popularity and featured schools](14_SCHOOL_POPULARITY_AND_FEATURED_SYSTEM.md) | Engagement events, scoring, and promotions |
| [15 Deployment and configuration](15_DEPLOYMENT_AND_CONFIGURATION.md) | Vercel, Render, Redis, email, and storage settings |
| [16 Testing and implementation status](16_TESTING_AND_IMPLEMENTATION_STATUS.md) | What is implemented, partial, or missing |
| [17 Future improvements](17_FUTURE_IMPROVEMENTS.md) | Gaps worth planning, without changing the product |

## Source of truth

- Backend: `backend/`
- Frontend: `frontend/`
- Deployment: `render.yaml`, `vercel.json`, `backend/Procfile`, `backend/.env.example`

Secrets, connection strings, and live credentials are intentionally omitted.
