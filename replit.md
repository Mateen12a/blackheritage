# Black Heritage Events

## Overview

Black Heritage Events is a Nigerian-focused event ticketing platform that enables users to discover, browse, and purchase tickets for cultural events, parties, and shows. The platform includes a public-facing website for event discovery and ticket purchases, plus an admin portal for event organizers to manage their events, bookings, and business partnerships (sponsors/vendors).

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
- **Calendar**: react-big-calendar for event calendar display

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **API Design**: RESTful endpoints with Zod validation for input/output schemas
- **Database ORM**: MongoDB with Mongoose for primary data storage
- **Session Storage**: MongoDB sessions via connect-mongo (or PostgreSQL via connect-pg-simple for Replit Auth scenarios)
- **Authentication**: Passport.js with local strategy (username/password)

### Data Storage
- **Primary Database**: MongoDB (configured via MONGODB_URI environment variable)
- **Schema Definitions**: 
  - Mongoose models in `server/models/index.ts` for runtime operations
  - Drizzle schemas in `shared/schema.ts` for type definitions and potential PostgreSQL usage
- **Collections**: Users, Events, Bookings, BusinessBookings, Sessions

### Authentication Flow
- **Strategy**: Local authentication with Passport.js
- **Password Hashing**: bcryptjs for secure password storage
- **Session Management**: Express sessions stored in MongoDB
- **Role System**: Three roles - user, organizer, admin
- **Protected Routes**: Middleware-based route protection requiring authentication

### Payment Integration
- **Provider**: Paystack for Nigerian Naira payments
- **Client Integration**: Paystack inline JavaScript SDK loaded in HTML
- **Fallback**: Stripe integration available but Paystack is primary

### Email Notifications
- **Provider**: Resend for transactional emails
- **Use Cases**: Booking confirmations, admin notifications for new registrations

### Shared Code Structure
- **Location**: `shared/` directory contains schemas and route definitions
- **Validation**: Zod schemas for input validation on both client and server
- **Type Safety**: Shared TypeScript types between frontend and backend via path aliases
- **Path Aliases**: `@/` for client source, `@shared/` for shared code

### Build Configuration
- **Client Build**: Vite outputs to `dist/public`
- **Server Build**: esbuild bundles server with selective dependency bundling for faster cold starts
- **Development**: tsx for running TypeScript directly

## External Dependencies

### Payment Processing
- **Paystack**: Primary payment gateway for Nigerian market (requires `PAYSTACK_SECRET_KEY` and `VITE_PAYSTACK_PUBLIC_KEY`)
- **Stripe**: Secondary payment option (requires `STRIPE_SECRET_KEY`)

### Email Service
- **Resend**: Transactional email delivery (requires `RESEND_API_KEY`)

### Database
- **MongoDB**: Primary data store (requires `MONGODB_URI`)
- **PostgreSQL**: Available for session storage and potential Drizzle migrations (requires `DATABASE_URL`)

### Deployment Configuration
- **Backend**: Render.com with build command `npm install && npm run build` and start command `npm start`
- **Frontend**: Vercel static hosting with API rewrites to backend
- **Required Environment Variables**:
  - `MONGODB_URI` - MongoDB connection string
  - `SESSION_SECRET` - Express session secret
  - `PAYSTACK_SECRET_KEY` - Paystack server-side key
  - `RESEND_API_KEY` - Resend email API key
  - `VITE_PAYSTACK_PUBLIC_KEY` - Paystack client-side key