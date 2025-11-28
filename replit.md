# Commerzio Services - Service Marketplace Platform

## Overview

Commerzio Services is a full-stack service marketplace connecting service providers with customers. It enables users to browse, post, and review local services across various categories, featuring AI-powered categorization, user authentication, and a comprehensive review system. The platform is part of the Commerzio company and aims to be a modern, professional, and trustworthy solution for local service discovery in Switzerland.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:** React with TypeScript, Wouter for routing, TanStack Query for server state, Radix UI primitives with shadcn/ui for UI, Tailwind CSS v4, and Vite for building.

**Design Decisions:**
- **UI/UX:** Utilizes shadcn/ui with the "new-york" style variant for a modern, accessible interface. Styling uses Tailwind CSS with custom design tokens for a "Trustworthy Blue" color scheme.
- **State Management:** TanStack Query manages all server-side state, integrating 401 handling for authentication.
- **Type Safety:** Full TypeScript implementation with shared types (`@shared` namespace) ensures consistent API contracts.
- **Geolocation:** All location fields use centralized geocoding (OpenStreetMap Nominatim API via `lib/geocoding.ts` and `hooks/useGeocoding.ts`) with address autocomplete, verification, and display of verified components.
- **Mapping:** Google Maps is exclusively used for all map displays, powered by an admin-configurable API key.
- **Service Display:** Service cards feature interactive image carousels (embla-carousel-react) and maintain equal heights for clean grid alignment.
- **Hashtags:** Services support clickable hashtags that link to search results pages using SQL array matching.
- **Home Page:** Features a tabbed interface ("All Listings," "Saved Listings") with independent state for filtering and sorting.

### Backend Architecture

**Technology Stack:** Node.js with TypeScript (ESM), Express.js, Drizzle ORM, PostgreSQL (Neon serverless), Passport.js for authentication, connect-pg-simple for session storage, and OpenAI API (GPT-4o).

**Design Decisions:**
- **ORM:** Drizzle ORM provides type-safe SQL queries and lightweight database interaction.
- **Authentication:** Custom local authentication with email/password, plus OAuth support for Google, Twitter, and Facebook.
- **Session Management:** PostgreSQL-backed sessions ensure persistence and scalability.
- **Storage Abstraction:** An `IStorage` interface (`server/storage.ts`) abstracts database operations.
- **AI Integration:** OpenAI API is used for intelligent service categorization, notifications, and content moderation.
- **Object Storage:** Images stored in Google Cloud Storage with `/objects/uploads/...` paths.

### Database Schema

**Core Tables:** `users`, `categories`, `subcategories`, `services`, `reviews`, `favorites`, `sessions`, `bookings`, `orders`, `chat_conversations`, `chat_messages`, `notifications`.

**Design Decisions:**
- **Service Lifecycle:** Services have `draft`, `active`, `paused`, `expired` statuses.
- **IDs:** Uses string-based IDs (UUID compatible) for scalability.
- **Relationships:** Services link to owners, categories, and optionally subcategories.
- **Reviews:** Separate `reviews` table supports aggregate calculations.
- **Referral System:** Multi-level pyramid referral with points and commissions.
- **Booking System:** Vendor availability, calendar blocks, and booking requests.
- **Chat System:** Vendor-customer messaging with profanity filtering and moderation.

### API Structure

**Route Organization:** `/api/auth/*`, `/api/categories`, `/api/services/*`, `/api/bookings/*`, `/api/chat/*`, `/api/payments/*`, `/api/notifications/*`.

**Design Decisions:**
- **RESTful:** Standard HTTP methods for CRUD operations.
- **Security:** `isAuthenticated` middleware for protected routes, `isAdmin` for admin routes.
- **Validation:** Zod schemas via Drizzle provide request validation.

## Features

### Authentication System
- Email/password registration with email verification
- OAuth login (Google, Twitter, Facebook)
- Password reset via email
- Rate limiting and account lockout protection

### Referral System
- Multi-level pyramid referral (L1, L2, L3)
- Points system with redemption
- Commission tracking
- Admin dashboard for referral management

### Booking & Calendar System
- Vendor availability settings
- Calendar blocking
- Booking requests with accept/reject/propose alternative
- Multi-day booking support

### Chat System
- Vendor-customer messaging
- Profanity filtering (EN/DE/FR/IT)
- Contact info blocking
- Block and report user functionality
- AI-powered moderation

### Payment System (Stripe)
- Payment intents and checkout sessions
- Stripe Connect for vendor payouts
- Platform fee handling

### Notification System
- In-app notifications
- Email notifications
- Web Push notifications (VAPID)
- AI-powered prioritization

## External Dependencies

### Third-Party Services

- **Neon Serverless PostgreSQL:** Primary database. Configured via `DATABASE_URL`.
- **OpenAI API:** AI features. Configured via `OPENAI_API_KEY`.
- **Stripe:** Payment processing. Configured via `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`.
- **Google Cloud Storage:** Image storage.
- **SMTP Server:** Email sending. Configured via `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM`.

### Environment Variables

```
DATABASE_URL=           # Neon PostgreSQL connection string
SESSION_SECRET=         # Express session secret
OPENAI_API_KEY=         # OpenAI API key

# OAuth (optional)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
TWITTER_CLIENT_ID=
TWITTER_CLIENT_SECRET=
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=

# Email
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
EMAIL_FROM=

# Stripe (optional)
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# Push Notifications (optional)
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=
```

### UI Component Libraries

- **Radix UI Primitives:** Accessible, unstyled components.
- **shadcn/ui:** Customizable components built on Radix UI (using "new-york" variant).

### Utility Libraries

- **Drizzle Zod:** Generates Zod schemas from Drizzle.
- **TanStack Query:** API request caching, refetching, optimistic updates.
- **date-fns:** Date manipulation.
- **class-variance-authority (CVA):** Type-safe variant styling.
