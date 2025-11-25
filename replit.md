# ServeMkt - Service Marketplace Platform

## Overview

ServeMkt is a full-stack service marketplace connecting service providers with customers. It enables users to browse, post, and review local services across various categories, featuring AI-powered categorization, user authentication, and a comprehensive review system. The platform aims to be a modern, professional, and trustworthy solution for local service discovery.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Technology Stack:** React with TypeScript, Wouter for routing, TanStack Query for server state, Radix UI primitives with shadcn/ui for UI, Tailwind CSS v4, and Vite for building.

**Design Decisions:**
- **UI/UX:** Utilizes shadcn/ui with the "new-york" style variant for a modern, accessible interface. Styling uses Tailwind CSS with custom design tokens for a "Trustworthy Blue" color scheme.
- **State Management:** TanStack Query manages all server-side state, integrating 401 handling for authentication.
- **Type Safety:** Full TypeScript implementation with shared types (`@shared` namespace) ensures consistent API contracts.
- **Geolocation:** All location fields use centralized geocoding (OpenStreetMap Nominatim API via `lib/geocoding.ts` and `hooks/useGeocoding.ts`) with address autocomplete, verification, and display of verified components. This includes automatic geocoding for service locations using the first location in a service's locations array, ensuring accurate map placements.
- **Mapping:** Google Maps is exclusively used for all map displays, powered by an admin-configurable API key. Markers are consistently styled (numbered red for services, blue for user locations) with automatic spreading.
- **Service Display:** Service cards feature interactive image carousels (embla-carousel-react) and maintain equal heights for clean grid alignment.
- **Text Handling:** Global CSS ensures text overflow prevention with `overflow-wrap: break-word` and `word-break: break-all` for long links.
- **Hashtags:** Services support clickable hashtags that link to search results pages using SQL array matching.
- **Home Page:** Features a tabbed interface ("All Listings," "Saved Listings") with independent state for filtering and sorting. Category filtering and sorting controls are integrated, and hero section category buttons instantly filter services. The `/services` route is removed in favor of this unified home page experience.
- **Unified Forms:** Service creation and editing are handled by a single `ServiceFormModal` component, reducing code duplication.
- **Header Navigation:** User avatar dropdown menu includes "Profile" and "Reviews" options, with deep-linking support for profile tabs via URL query parameters.

### Backend Architecture

**Technology Stack:** Node.js with TypeScript (ESM), Express.js, Drizzle ORM, PostgreSQL (Neon serverless), Replit Auth (OpenID Connect), connect-pg-simple for session storage, and OpenAI API (GPT-4o).

**Design Decisions:**
- **ORM:** Drizzle ORM provides type-safe SQL queries and lightweight database interaction.
- **Authentication:** Replit Auth with `isAuthenticated` middleware protects routes.
- **Session Management:** PostgreSQL-backed sessions ensure persistence and scalability.
- **Storage Abstraction:** An `IStorage` interface (`server/storage.ts`) abstracts database operations.
- **AI Integration:** OpenAI API is used for intelligent service categorization based on service title and description.

### Database Schema

**Core Tables:** `users`, `categories`, `services`, `reviews`, `favorites`, `sessions`.

**Design Decisions:**
- **Service Lifecycle:** Services have `draft`, `active`, `expired` statuses and `expiresAt` for automatic cleanup.
- **IDs:** Uses string-based IDs (UUID compatible) for scalability.
- **Relationships:** Services link to owners and categories.
- **Reviews:** Separate `reviews` table supports aggregate calculations.
- **Service Location Coordinates:** Services now store their own `locationLat`, `locationLng`, and `preferredLocationName` for accurate mapping, independent of the owner's profile location.

### API Structure

**Route Organization:** `/api/auth/*`, `/api/categories`, `/api/services/*`, `/api/services/:id/reviews`, `/api/favorites`.

**Design Decisions:**
- **RESTful:** Standard HTTP methods for CRUD operations.
- **Nested Resources:** Reviews nested under services.
- **Filtering:** Service listing supports query parameter filtering.
- **Security:** `isAuthenticated` middleware for protected routes.
- **Validation:** Zod schemas via Drizzle provide request validation.

### Development Environment

**Build Configuration:** Vite for frontend dev server (HMR) and production build, tsx for backend dev server hot-reloading, esbuild for backend production build. Drizzle Kit for database migrations.

**Design Decisions:**
- **Monorepo:** Client, server, and shared code in a single repository with TypeScript path mapping.
- **Optimization:** Separate build tools for client (Vite) and server (esbuild).

## Recent Updates & Features

### Service Form Improvements (Latest)
- **Promotional Packages:** Service-level packages (Standard Free, Featured CHF 9.99, Premium CHF 19.99) and account-wide plans (Professional Badge CHF 5/mo, Pro Account CHF 29/mo) with expandable collapsible section
- **Location Preselection:** User's main address is auto-selected when posting a new service
- **Contact Name Prepopulation:** Service contact name field auto-fills with user's name
- **AI-Enhanced Form:**
  - Description generator with GPT-4o integration
  - Hashtag suggestions from image analysis
  - Category duplicate detection via AI validation
- **Swiss Address Validation:** Fixed validation for addresses with 4-digit postal codes (e.g., "Farman-Strasse, 8152, Glattbrugg")
- **Smart Error Messages:** Error toasts now point users to specific form tabs and field issues
- **Phone Number Guidance:** Specific format guidance for Swiss phone numbers (+41 format)

### Tab Organization (Latest)
- **Tab 1: Main Info** - Images, title, description, category, hashtags
- **Tab 2: Location & Contacts** - Service locations with validation, contact information with name prepopulation
- **Tab 3: Pricing & Plans** - Pricing options, promotional packages with expandable account plans section

## External Dependencies

### Third-Party Services

- **Replit Auth (OpenID Connect):** User authentication and session management. Configured via `ISSUER_URL`, `REPL_ID`, `SESSION_SECRET`.
- **Neon Serverless PostgreSQL:** Primary database. Configured via `DATABASE_URL`.
- **OpenAI API:** AI-powered service categorization, description generation, hashtag analysis, and category validation. Configured via `OPENAI_API_KEY`. Uses GPT-4o model.

### Development Tools

- **@replit/vite-plugin-runtime-error-modal:** Displays runtime errors.
- **@replit/vite-plugin-cartographer:** Code navigation.
- **@replit/vite-plugin-dev-banner:** Development environment indicator.

### UI Component Libraries

- **Radix UI Primitives:** Accessible, unstyled components.
- **shadcn/ui:** Customizable components built on Radix UI (using "new-york" variant).

### Utility Libraries

- **Drizzle Zod:** Generates Zod schemas from Drizzle.
- **TanStack Query:** API request caching, refetching, optimistic updates.
- **date-fns:** Date manipulation.
- **class-variance-authority (CVA):** Type-safe variant styling.
- **nanoid:** Unique ID generation.