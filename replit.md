# ServeMkt - Service Marketplace Platform

## Overview

ServeMkt is a full-stack service marketplace application that connects service providers with customers. The platform enables users to browse, post, and review local services across multiple categories. Built with a modern tech stack, it features AI-powered service categorization, user authentication via Replit Auth, and a comprehensive review system.

## User Preferences

Preferred communication style: Simple, everyday language.

## Critical Requirements

**⚠️ LOCATION FIELDS MUST HAVE GEOLOCATION VERIFICATION**
- **Every single location field** in the application must have:
  - Address autocomplete dropdown with geolocation search
  - Address verification through Nominatim API (OpenStreetMap)
  - Display of verified address components (street, city, postal code, canton)
  - Verified badge indicator
  - Uses `/api/geocode/search` endpoint
- **Implementation**: Use `AddressAutocomplete` component for single locations or `AddressMultiInput` for multiple locations
- **Check this requirement EVERY TIME working on location fields** - this is non-negotiable
- Examples of location fields that need this: service locations, user preferred locations, admin editing location fields

## System Architecture

### Frontend Architecture

**Technology Stack:**
- **Framework**: React with TypeScript
- **Routing**: Wouter (lightweight client-side router)
- **State Management**: TanStack Query (React Query) for server state
- **UI Components**: Radix UI primitives with shadcn/ui component library
- **Styling**: Tailwind CSS v4 with custom design tokens
- **Build Tool**: Vite

**Design Decisions:**
- **Component Library Choice**: Uses shadcn/ui (customizable Radix UI components) for consistent, accessible UI patterns. The "new-york" style variant provides a modern, professional aesthetic suitable for a marketplace.
- **Styling Approach**: Tailwind CSS with CSS variables enables theme customization while maintaining type safety. Custom design tokens define a "Trustworthy Blue" color scheme to establish credibility.
- **State Management Strategy**: TanStack Query handles all server state, eliminating need for global state management. Custom query functions with 401 handling provide seamless authentication state.
- **Type Safety**: Full TypeScript implementation with shared types between client and server via the `@shared` namespace ensures API contract consistency.

### Backend Architecture

**Technology Stack:**
- **Runtime**: Node.js with TypeScript (ESM modules)
- **Framework**: Express.js
- **Database ORM**: Drizzle ORM
- **Database**: PostgreSQL (via Neon serverless)
- **Authentication**: Replit Auth with OpenID Connect
- **Session Storage**: PostgreSQL-backed sessions (connect-pg-simple)
- **AI Integration**: OpenAI API (GPT-5)

**Design Decisions:**
- **ORM Selection**: Drizzle ORM chosen for type-safe SQL queries, excellent TypeScript integration, and lightweight footprint. Provides flexibility to write raw SQL when needed while maintaining type safety.
- **Session Management**: PostgreSQL-backed sessions ensure session persistence across server restarts and enable horizontal scaling. Uses the standardized `sessions` table schema compatible with connect-pg-simple.
- **Authentication Pattern**: Replit Auth integration provides OAuth-based authentication with minimal configuration. The `isAuthenticated` middleware protects routes requiring user login.
- **Storage Layer Abstraction**: The `IStorage` interface in `server/storage.ts` abstracts database operations, making it easy to swap implementations or add caching layers without modifying route handlers.
- **AI Service Integration**: OpenAI integration provides intelligent service categorization to improve user experience when posting services. The categorization service suggests categories based on title and description with confidence scores.

### Database Schema

**Core Tables:**
- **users**: Extended user profiles with verification status and marketing package tiers
- **categories**: Service categories with slugs for URL-friendly routing
- **services**: Service listings with status tracking, expiration dates, and view counts
- **reviews**: User reviews with ratings linked to both services and reviewers
- **favorites**: User-favorited services for bookmarking functionality
- **sessions**: Express session storage (required for Replit Auth)

**Design Decisions:**
- **Service Lifecycle**: Services have status tracking (draft, active, expired) and automatic expiration dates to keep listings fresh. The `expiresAt` field enables automatic cleanup of stale listings.
- **Soft References**: Uses string-based IDs rather than numeric auto-incrementing IDs for better distribution in scaled systems and UUID compatibility.
- **Composite Relationships**: Services link to both owners (users) and categories, enabling efficient filtering by category or user.
- **Review System**: Separate reviews table with ratings enables aggregate calculations for service quality scoring.

### API Structure

**Route Organization:**
- **Authentication Routes** (`/api/auth/*`): User authentication and session management
- **Category Routes** (`/api/categories`): Category listing and creation
- **Service Routes** (`/api/services/*`): CRUD operations for services, view tracking, renewal
- **Review Routes** (`/api/services/:id/reviews`): Service-specific review management
- **Favorite Routes** (`/api/favorites`): User favorite management

**Design Decisions:**
- **RESTful Conventions**: Standard HTTP methods (GET, POST, PATCH, DELETE) map to CRUD operations
- **Nested Resources**: Reviews are nested under services (`/services/:id/reviews`) to maintain resource hierarchy
- **Query Parameter Filtering**: Service listing supports multiple filters (category, owner, status, search) via query params
- **Authentication Middleware**: Protected routes use `isAuthenticated` middleware to enforce authentication before handler execution
- **Validation Layer**: Zod schemas from Drizzle provide request validation with helpful error messages via zod-validation-error

### Development Environment

**Build Configuration:**
- **Dev Server**: Vite dev server on port 5000 for frontend with HMR
- **API Server**: Express server with tsx for TypeScript execution in development
- **Production Build**: Vite builds frontend to `dist/public`, esbuild bundles server to `dist`
- **Database Migrations**: Drizzle Kit handles schema migrations with push command

**Design Decisions:**
- **Monorepo Structure**: Client, server, and shared code coexist in single repository with TypeScript path mapping
- **Hot Reload**: Development mode uses tsx for server hot-reloading and Vite for client HMR
- **Build Optimization**: Separate build tools (Vite for client, esbuild for server) optimize for each target environment

## External Dependencies

### Third-Party Services

**Replit Auth (OpenID Connect):**
- **Purpose**: User authentication and session management
- **Integration Point**: `server/replitAuth.ts` handles OAuth flow and session persistence
- **Configuration**: Requires `ISSUER_URL`, `REPL_ID`, and `SESSION_SECRET` environment variables

**Neon Serverless PostgreSQL:**
- **Purpose**: Primary database with WebSocket support for serverless environments
- **Integration Point**: `server/db.ts` configures connection pooling and Drizzle ORM
- **Configuration**: Requires `DATABASE_URL` environment variable
- **Design Choice**: Neon's serverless architecture provides auto-scaling and connection pooling suited for edge deployments

**OpenAI API:**
- **Purpose**: AI-powered service categorization
- **Integration Point**: `server/aiService.ts` handles GPT-5 completion requests
- **Configuration**: Requires `OPENAI_API_KEY` environment variable
- **API Usage**: Uses structured JSON output mode for reliable categorization results

### Development Tools

**Replit-Specific Plugins:**
- **@replit/vite-plugin-runtime-error-modal**: Displays runtime errors in development
- **@replit/vite-plugin-cartographer**: Code navigation and visualization
- **@replit/vite-plugin-dev-banner**: Development environment indicator

### UI Component Libraries

**Radix UI Primitives:**
- Comprehensive set of unstyled, accessible components (dialogs, dropdowns, tooltips, etc.)
- Provides accessibility features (ARIA attributes, keyboard navigation) out of the box

**shadcn/ui:**
- Customizable component implementations built on Radix UI
- Components copied into project for full customization control
- "new-york" variant selected for clean, modern aesthetic

### Utility Libraries

- **Drizzle Zod**: Generates Zod validation schemas from Drizzle table definitions
- **TanStack Query**: Handles API request caching, background refetching, and optimistic updates
- **date-fns**: Date manipulation and formatting utilities
- **class-variance-authority (CVA)**: Type-safe variant-based component styling
- **nanoid**: Compact, URL-safe unique ID generation