# Workshop Management System

Modern multi-tenant workshop management application built with Node.js, Express, React, and PostgreSQL.

## Features

- **Multi-Tenancy**: Support multiple organizations with isolated data using subdomain-based routing
- **Workshop Management**: Create, schedule, and manage workshops
- **User Management**: User registration, authentication, and role-based access control
- **Registration System**: Participants can register for workshops
- **Reporting**: Analytics and reports for workshop performance
- **Responsive Design**: Mobile-friendly user interface

## Tech Stack

### Backend
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Authentication**: JWT

### Frontend
- **Framework**: React 18+ with TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React Context + Hooks
- **HTTP Client**: Axios

### DevOps
- **Containerization**: Docker
- **Database Migrations**: Prisma Migrations
- **Package Manager**: pnpm (recommended) or npm

## Project Structure

```
workshop-management-system/
├── api/                    # Backend (Express.js + TypeScript)
│   ├── src/
│   │   ├── config/        # Configuration files
│   │   ├── controllers/   # Route controllers
│   │   ├── middleware/    # Custom middleware
│   │   ├── routes/        # API routes
│   │   ├── services/      # Business logic
│   │   ├── models/        # Database models
│   │   ├── utils/         # Utilities
│   │   ├── types/         # TypeScript types
│   │   └── app.ts         # Express app setup
│   ├── prisma/            # Prisma schema and migrations
│   ├── .env.example       # Environment variables template
│   └── package.json
│
├── web/                    # Frontend (React + TypeScript)
│   ├── src/
│   │   ├── components/    # Reusable components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── services/      # API services
│   │   ├── types/         # TypeScript types
│   │   ├── utils/         # Utilities
│   │   ├── styles/        # Global styles
│   │   ├── context/       # React context
│   │   └── App.tsx        # Main app component
│   ├── public/
│   └── package.json
│
├── shared/                 # Shared types and utilities
│   └── types.ts           # Shared TypeScript types
│
├── docker-compose.yml     # Local development setup
├── .env.example           # Example environment variables
└── README.md
```

## Getting Started

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- pnpm or npm

### Installation

1. Clone the repository and install dependencies:
```bash
cd workshop-management-system
pnpm install:all  # Install all dependencies
```

2. Setup environment variables:
```bash
cp .env.example .env.local
# Edit .env.local with your configuration
```

3. Setup database:
```bash
cd api
pnpm prisma migrate dev
pnpm prisma db seed
```

4. Start development servers:
```bash
# Terminal 1 - Backend
cd api
pnpm dev

# Terminal 2 - Frontend
cd web
pnpm dev
```

### Docker Setup

```bash
docker-compose up -d
```

## Multi-Tenancy Architecture

### Subdomain-Based Routing
- **Main Site**: `app.example.com` - Landing & authentication
- **Tenant Apps**: `{tenant-slug}.app.example.com` - Tenant-specific workspace

### Data Isolation
- Each tenant has completely isolated data
- Middleware extracts tenant from subdomain
- Database queries automatically filtered by tenant_id
- Row-level security (RLS) enforced at database level

## Free Hosting Options

### Frontend (Vercel/Netlify)
- Deploy React app to Vercel (recommended)
- Free tier includes serverless functions
- Custom domain support

### Backend (Railway/Render)
- Deploy Express API to Railway or Render
- Free tier includes monthly usage limits
- PostgreSQL database support

### Database (Supabase)
- Managed PostgreSQL on AWS
- Free tier: 500MB storage, 2GB bandwidth
- Built-in authentication and real-time features

## Environment Variables

```
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/workshop_db

# JWT
JWT_SECRET=your-secret-key-here
JWT_EXPIRY=7d

# API
API_PORT=3000
API_URL=http://localhost:3000

# Frontend
VITE_API_URL=http://localhost:3000

# Multi-Tenancy
MAIN_DOMAIN=localhost:3000
ROOT_DOMAIN=localhost
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `POST /api/auth/refresh` - Refresh token

### Workshops
- `GET /api/workshops` - List all workshops (tenant-specific)
- `POST /api/workshops` - Create workshop
- `GET /api/workshops/:id` - Get workshop details
- `PUT /api/workshops/:id` - Update workshop
- `DELETE /api/workshops/:id` - Delete workshop

### Registrations
- `GET /api/registrations` - List registrations
- `POST /api/registrations` - Register for workshop
- `GET /api/registrations/:id` - Get registration details
- `DELETE /api/registrations/:id` - Cancel registration

## Development Workflow

1. Create feature branch: `git checkout -b feature/feature-name`
2. Make changes
3. Test locally
4. Commit: `git commit -am "feat: description"`
5. Push and create PR: `git push origin feature/feature-name`

## Contributing

1. Follow the existing code structure
2. Write TypeScript code with proper types
3. Test your changes locally
4. Keep commits atomic and descriptive

## License

MIT

## Support

For issues or questions, please create an issue in the repository.
