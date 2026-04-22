# Workshop Management System - Developer Guide

## Project Overview

A modern, multi-tenant workshop management platform built with Node.js, Express, React, and PostgreSQL. The system enables organizations to create, manage, and track workshops with support for user registration and reporting.

## Architecture

### Multi-Tenancy Design
- **Subdomain-based routing**: Each tenant operates under their own subdomain (e.g., `acme.app.example.com`)
- **Data isolation**: Complete data separation at the database level using `tenant_id` foreign keys
- **Middleware-based tenant extraction**: Tenant identified from subdomain and injected into request context

### Project Structure

```
workshop-management-system/
├── api/                    # Express backend
│   ├── src/
│   │   ├── routes/        # API endpoints
│   │   ├── controllers/   # Route logic (stub)
│   │   ├── services/      # Business logic (stub)
│   │   ├── middleware/    # Custom middleware
│   │   ├── models/        # Database models (stub)
│   │   └── app.ts         # Express setup
│   ├── prisma/            # Database ORM
│   │   └── schema.prisma  # Data models
│   └── Dockerfile
│
├── web/                    # React frontend
│   ├── src/
│   │   ├── pages/         # Route pages
│   │   ├── components/    # Reusable components
│   │   ├── services/      # API client services (stub)
│   │   └── App.tsx        # Main app
│   └── Dockerfile
│
└── docker-compose.yml     # Local dev environment
```

## Database Schema

### Core Models
- **Tenant**: Organization/workspace container
- **User**: Users within a tenant (email + tenant_id unique)
- **Workshop**: Workshop events organized by tenant
- **Registration**: User registrations for workshops

All models include tenant isolation via `tenantId` foreign key.

## Setup Instructions

### Prerequisites
- Node.js 18+
- PostgreSQL 14+ (or use Docker)
- pnpm (recommended) or npm

### Local Development Setup

1. **Install dependencies**:
   ```bash
   cd workshop-management-system
   pnpm install:all
   ```

2. **Configure environment**:
   ```bash
   cp .env.example .env.local
   # Edit with your configuration
   ```

3. **Setup database** (choose one):
   
   **Option A - Docker (recommended)**:
   ```bash
   docker-compose up -d postgres
   cd api && pnpm prisma migrate dev
   ```
   
   **Option B - Local PostgreSQL**:
   ```bash
   createdb workshop_system
   cd api && pnpm prisma migrate dev
   ```

4. **Start development servers**:
   ```bash
   # From root directory
   pnpm dev
   
   # Or separately:
   cd api && pnpm dev    # Terminal 1
   cd web && pnpm dev    # Terminal 2
   ```

5. **Access the application**:
   - Frontend: `http://localhost:3001`
   - API: `http://localhost:3000`
   - API Health: `http://localhost:3000/health`

### Database Migrations

Create new migration:
```bash
cd api
pnpm prisma migrate dev --name migration_name
```

Reset database (development only):
```bash
cd api
pnpm prisma migrate reset
```

## Development Workflow

### API Development
- Routes are in `api/src/routes/`
- Each route file is a stub with TODO comments
- Controllers, services, and models folders are empty and ready for implementation
- Prisma client is available via `PrismaClient` import

### Frontend Development
- Page components in `web/src/pages/`
- Reusable components in `web/src/components/`
- Styled with Tailwind CSS
- Mock data is hardcoded in page components (replace with API calls)

### Adding New Features
1. Design Prisma model if needed
2. Run `pnpm prisma migrate dev`
3. Implement API routes
4. Create frontend components
5. Add tests

## Free Hosting Deployment

### Database (Supabase)
1. Create Supabase project: https://supabase.com
2. Update `DATABASE_URL` in production env
3. Run migrations: `pnpm prisma migrate deploy`

### Backend (Railway/Render)
- **Railway**: Deploy from GitHub, integrates with Supabase
- **Render**: Support for Node.js with PostgreSQL
- Set environment variables in platform settings
- Run migrations automatically or manually

### Frontend (Vercel)
1. Push code to GitHub
2. Connect repo to Vercel
3. Set `REACT_APP_API_URL` environment variable
4. Deploy with custom domain

### Multi-Tenancy Subdomains
For subdomain routing in production:
- Use wildcard DNS: `*.app.example.com` → your API
- Or use path-based routing (modify tenant middleware)

## Key Implementation Areas (TODO)

### Backend Routes
- [ ] `POST /api/auth/register` - Create tenant + user
- [ ] `POST /api/auth/login` - JWT authentication
- [ ] `GET /api/workshops` - List workshops (tenant-filtered)
- [ ] `POST /api/workshops` - Create workshop
- [ ] `POST /api/registrations` - Register for workshop

### Frontend Pages
- [ ] Login/register flow
- [ ] Workshop list with filtering
- [ ] Workshop detail page
- [ ] Dashboard with statistics
- [ ] User profile settings

### Database
- [ ] Prisma migrations
- [ ] Row-level security (optional, PostgreSQL RLS)
- [ ] Indexes on frequently queried columns

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@host/workshop_system

# API
API_PORT=3000
API_URL=http://localhost:3000

# Frontend
FRONTEND_URL=http://localhost:3001
REACT_APP_API_URL=http://localhost:3000

# Security
JWT_SECRET=change-me-in-production
JWT_EXPIRY=7d

# Multi-tenancy
ROOT_DOMAIN=localhost
MAIN_DOMAIN=localhost:3000
```

## Testing

```bash
# Run all tests
pnpm test

# Run specific suite
cd api && pnpm test auth.test.ts
cd web && pnpm test HomePage.test.tsx
```

## Common Issues

### Database Connection Refused
- Verify PostgreSQL is running
- Check DATABASE_URL format
- Ensure port 5432 is not blocked

### Port Already in Use
- API: Change `API_PORT` in .env or use `lsof -i :3000` to find process
- Frontend: Change port in `web/vite.config.ts`

### Tenant Extraction Not Working
- Verify subdomain format: `{tenant}.localhost:3000`
- Check `req.get('host')` in tenant middleware
- Browser may not support localhost subdomains; use `127.0.0.1.nip.io` for testing

## Performance Notes

- Prisma queries automatically filtered by tenant_id (via middleware)
- Index on (tenantId, status) for workshop queries
- Frontend uses React Router for code splitting
- Tailwind CSS compiled at build time

## Security Considerations

- JWT tokens should expire regularly (default: 7 days)
- Implement rate limiting on auth endpoints
- Hash passwords with bcrypt before storing
- Validate tenant_id in all requests
- Use HTTPS in production
- Enable CORS only for whitelisted origins

## Useful Commands

```bash
# Install dependencies
pnpm install:all

# Development mode
pnpm dev

# Build for production
pnpm build

# Database
cd api && pnpm prisma studio  # GUI for database

# Type checking
cd api && pnpm tsc --noEmit
cd web && pnpm tsc --noEmit
```

## Resources

- [Express.js Documentation](https://expressjs.com/)
- [Prisma ORM](https://www.prisma.io/)
- [React Documentation](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Vite Guide](https://vitejs.dev/)
- [PostgreSQL Docs](https://www.postgresql.org/docs/)

## Notes for Future Development

- Consider implementing Prisma middleware for automatic tenant filtering
- Add error handling and validation layers
- Implement pagination for list endpoints
- Add file upload support (workshop materials, images)
- Consider caching with Redis for performance
- Implement WebSocket for real-time updates
- Add admin panel for multi-tenant management
