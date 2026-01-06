# Black Heritage Events

## Overview

Black Heritage Events is a Nigerian-focused event ticketing platform that allows users to discover, browse, and purchase tickets for cultural events, parties, and shows. The application features a modern dark-themed UI with gold accents, event calendar integration, user authentication via Replit Auth, and payment processing capabilities through Stripe integration.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state and caching
- **Styling**: Tailwind CSS with shadcn/ui component library (New York style)
- **Animations**: Framer Motion for page transitions and interactive elements
- **UI Components**: Radix UI primitives wrapped with shadcn/ui styling
- **Build Tool**: Vite with custom plugins for Replit integration

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Design**: RESTful endpoints defined in shared route schemas with Zod validation
- **Database ORM**: MongoDB with Mongoose
- **Authentication**: Replit Auth integration using OpenID Connect (OIDC)

### Data Storage
- **Database**: MongoDB (required via MONGODB_URI environment variable)
- **Schema Location**: `server/models/index.ts` with Mongoose model definitions
- **Models**: Events, Bookings, Users, and BusinessBookings collections

### Authentication Flow
- **Provider**: Replit Auth (OIDC-based)
- **Session Storage**: PostgreSQL via connect-pg-simple
- **User Management**: Automatic user upsert on authentication with profile data syncing
- **Protected Routes**: Middleware-based route protection for authenticated endpoints

### Shared Code Structure
- **Location**: `shared/` directory contains schemas and route definitions
- **Validation**: Zod schemas for input validation on both client and server
- **Type Safety**: Shared TypeScript types between frontend and backend via path aliases

### Build Configuration
- **Client Build**: Vite outputs to `dist/public`
- **Server Build**: esbuild bundles server with selective dependency bundling
- **Path Aliases**: `@/` for client source, `@shared/` for shared code

## External Dependencies

### Payment Processing
- **Stripe**: Server-side Stripe SDK for payment intent creation (requires STRIPE_SECRET_KEY)
- **Client SDK**: @stripe/stripe-js and @stripe/react-stripe-js for frontend integration
- **Note**: Payment flows gracefully mock when Stripe keys are not configured

### Database
- **PostgreSQL**: Required database with connection via DATABASE_URL environment variable
- **Migrations**: Drizzle Kit for schema migrations stored in `migrations/` directory

### Authentication
- **Replit Auth**: OIDC provider at replit.com/oidc requiring REPL_ID and SESSION_SECRET environment variables
- **Session Store**: PostgreSQL-backed sessions requiring a `sessions` table

### Environment Variables Required
- `DATABASE_URL`: PostgreSQL connection string
- `SESSION_SECRET`: Secret for session encryption
- `STRIPE_SECRET_KEY`: Optional Stripe API key for payments
- `ISSUER_URL`: Optional custom OIDC issuer (defaults to Replit)

### Key NPM Packages
- **Calendar**: react-big-calendar with date-fns localizer
- **Date Handling**: date-fns for formatting and manipulation
- **Form Validation**: react-hook-form with @hookform/resolvers for Zod integration
- **HTTP Client**: Native fetch with TanStack Query for caching