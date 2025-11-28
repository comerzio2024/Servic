# ServeMkt - Service Marketplace Platform

A full-stack TypeScript application for a service marketplace with a React frontend and Express backend.

## Prerequisites

- Node.js (v20 or higher recommended)
- npm or yarn
- PostgreSQL database (or Neon serverless database)

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   
   Create a `.env` file in the root directory with the following variables:
   
   ```env
   # Required - Database
   DATABASE_URL=postgresql://user:password@host:port/database
   SESSION_SECRET=your-random-secret-key-here-at-least-32-chars
   PORT=5000
   APP_URL=http://localhost:5000
   
   # Required - Email (for verification/password reset)
   SMTP_HOST=smtp.yourprovider.com
   SMTP_PORT=465
   SMTP_USER=your-email@example.com
   SMTP_PASSWORD=your-email-password
   EMAIL_FROM=noreply@yourdomain.com
   
   # Optional - Admin credentials (defaults shown)
   ADMIN_EMAIL=admin@example.com
   ADMIN_PASSWORD=Admin123!
   
   # Optional - AI features
   OPENAI_API_KEY=your-openai-api-key
   
   # Optional - Google Maps
   GOOGLE_MAPS_API_KEY=your-google-maps-api-key
   
   # Optional - SMS verification (Twilio)
   TWILIO_ACCOUNT_SID=your-twilio-account-sid
   TWILIO_AUTH_TOKEN=your-twilio-auth-token
   TWILIO_PHONE_NUMBER=+1234567890
   
   # Optional - OAuth Providers (Social Login)
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   
   TWITTER_CLIENT_ID=your-twitter-client-id
   TWITTER_CLIENT_SECRET=your-twitter-client-secret
   
   FACEBOOK_APP_ID=your-facebook-app-id
   FACEBOOK_APP_SECRET=your-facebook-app-secret
   
   # Optional - Push Notifications (Web Push)
   VAPID_PUBLIC_KEY=your-vapid-public-key
   VAPID_PRIVATE_KEY=your-vapid-private-key
   VAPID_SUBJECT=mailto:your-email@example.com
   
   # Optional - Stripe Payments
   STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key
   STRIPE_PUBLISHABLE_KEY=pk_test_your-stripe-publishable-key
   STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret
   ```

3. **Set up the database:**
   
   Make sure your PostgreSQL database is running and accessible. Then push the schema:
   ```bash
   npm run db:push
   ```

4. **Run the development server:**
   
   ```bash
   npm run dev
   ```
   
   This will work on Windows, macOS, and Linux. The project uses `cross-env` to handle environment variables cross-platform.

   The server will start on port 5000 (or the port specified in your `PORT` environment variable).

5. **Access the application:**
   
   Open your browser and navigate to `http://localhost:5000`

## Available Scripts

- `npm run dev` - Start the development server (backend + frontend)
- `npm run dev:client` - Start only the frontend development server (Vite)
- `npm run build` - Build the application for production
- `npm run start` - Start the production server
- `npm run db:push` - Push database schema changes to your database
- `npm run check` - Run TypeScript type checking

## Project Structure

- `client/` - React frontend application
- `server/` - Express backend API
- `shared/` - Shared TypeScript types and schema
- `attached_assets/` - Static assets and images

## Authentication System

The platform uses a custom authentication system with the following features:

### Email/Password Authentication
- User registration with email verification
- Login with email and password
- Password reset via email
- Password strength requirements (8+ chars, uppercase, number)
- Account lockout after 5 failed login attempts (15 min)

### Social Login (OAuth)
Supports login with:
- **Google** - Requires `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- **Twitter/X** - Requires `TWITTER_CLIENT_ID` and `TWITTER_CLIENT_SECRET`
- **Facebook** - Requires `FACEBOOK_APP_ID` and `FACEBOOK_APP_SECRET`

### Admin Authentication
- Admins are regular users with the `isAdmin` flag set to `true`
- Default admin is created on first startup if no admins exist
- Configure default admin credentials via `ADMIN_EMAIL` and `ADMIN_PASSWORD`
- **Important:** Change the default admin password immediately after first login!

### Security Features
- bcrypt password hashing (cost factor 12)
- Secure session cookies (HttpOnly, Secure in production, SameSite=Lax)
- CSRF protection via state parameter for OAuth
- Rate limiting on login attempts
- Email verification required for posting services

## Setting Up OAuth Providers

### Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing
3. Navigate to APIs & Services > Credentials
4. Create OAuth 2.0 Client ID (Web application)
5. Add authorized redirect URI: `http://localhost:5000/api/auth/google/callback`
6. Copy Client ID and Client Secret to `.env`

### Twitter/X OAuth
1. Go to [Twitter Developer Portal](https://developer.twitter.com)
2. Create a project and app
3. Enable OAuth 2.0
4. Add callback URL: `http://localhost:5000/api/auth/twitter/callback`
5. Copy Client ID and Client Secret to `.env`

### Facebook Login
1. Go to [Facebook Developers](https://developers.facebook.com)
2. Create a new app
3. Add Facebook Login product
4. Add OAuth redirect URI: `http://localhost:5000/api/auth/facebook/callback`
5. Copy App ID and App Secret to `.env`

## Database Setup

This project uses Drizzle ORM with PostgreSQL. The database schema is defined in `shared/schema.ts`.

To set up a local PostgreSQL database:
1. Install PostgreSQL locally, or
2. Use a cloud service like Neon (https://neon.tech) for a serverless PostgreSQL database
3. Get your connection string and add it to `.env` as `DATABASE_URL`

### Database Schema
Key tables include:
- `users` - User accounts with auth info, profile, and preferences
- `sessions` - Express session storage
- `oauth_tokens` - OAuth provider tokens
- `services` - Service listings
- `reviews`, `favorites`, `categories`, etc.

## Email Service Setup

The email service uses SMTP. You can use:
- Your hosting provider's SMTP (e.g., Hostinger, GoDaddy)
- Transactional email services (SendGrid, Mailgun, AWS SES)
- Gmail SMTP (for testing only, has sending limits)

Example for Hostinger:
```env
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=info@yourdomain.com
SMTP_PASSWORD=your-email-password
EMAIL_FROM=info@yourdomain.com
```

## Troubleshooting

### Database Connection Issues
- Verify your `DATABASE_URL` is correct
- Ensure your database server is running
- Check firewall settings if using a remote database

### Port Already in Use
If port 5000 is already in use, change the `PORT` environment variable in your `.env` file.

### Email Not Sending
- Check SMTP credentials are correct
- Verify SMTP port (465 for SSL, 587 for TLS)
- Check spam folder for test emails
- Console logs will show email service status on startup

### OAuth Errors
- Ensure redirect URIs match exactly (including trailing slashes)
- Check that all required credentials are set
- Verify provider app is in production mode (not test/development)

### Session Issues
- Ensure `SESSION_SECRET` is set and sufficiently random (32+ characters)
- Clear browser cookies if testing session changes
- Check that database has `sessions` table (run `npm run db:push`)

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with email/password
- `POST /api/auth/logout` - Logout
- `GET /api/auth/user` - Get current user
- `POST /api/auth/verify-email` - Verify email with token
- `POST /api/auth/resend-verification` - Resend verification email
- `POST /api/auth/forgot-password` - Request password reset
- `POST /api/auth/reset-password` - Reset password with token
- `POST /api/auth/change-password` - Change password (authenticated)
- `GET /api/auth/google` - Initiate Google OAuth
- `GET /api/auth/twitter` - Initiate Twitter OAuth
- `GET /api/auth/facebook` - Initiate Facebook OAuth

### Admin
- `POST /api/admin/login` - Admin login
- `POST /api/admin/logout` - Admin logout
- `GET /api/admin/session` - Check admin session

### Notifications
- `GET /api/notifications` - Get user notifications (paginated)
- `GET /api/notifications/unread-count` - Get unread notification count
- `POST /api/notifications/:id/read` - Mark notification as read
- `POST /api/notifications/mark-all-read` - Mark all as read
- `POST /api/notifications/:id/dismiss` - Dismiss a notification
- `POST /api/notifications/clear-all` - Clear all notifications
- `GET /api/notifications/preferences` - Get notification preferences
- `PUT /api/notifications/preferences` - Update notification preferences
- `GET /api/notifications/types` - Get available notification types

### Push Notifications
- `GET /api/push/vapid-key` - Get VAPID public key for subscription
- `POST /api/push/subscribe` - Register a push subscription
- `POST /api/push/unsubscribe` - Remove a push subscription
- `GET /api/push/subscriptions` - Get user's push subscriptions

## Push Notification Setup

To enable Web Push notifications:

1. **Generate VAPID keys:**
   ```bash
   npx web-push generate-vapid-keys
   ```

2. **Add to your `.env` file:**
   ```env
   VAPID_PUBLIC_KEY=<your-public-key>
   VAPID_PRIVATE_KEY=<your-private-key>
   VAPID_SUBJECT=mailto:your-email@example.com
   ```

3. **Test push notifications:**
   - Log in to the platform
   - Go to Profile → Notification Settings
   - Enable "Push" notifications
   - Allow browser permission when prompted

## Notification Types

The platform supports the following notification types:
- **Messages** - Chat messages from vendors or customers
- **Bookings** - Booking confirmations, updates, and reminders
- **Referrals** - Referral rewards and new sign-ups
- **Services** - Service approval and status updates
- **Payments** - Payment receipts and payout notifications
- **System** - Platform updates and announcements
- **Reviews** - New reviews on your services
- **Promotions** - Special offers and promotional content

Each type can be independently configured for:
- In-app notifications (shown in the notification bell)
- Email notifications
- Push notifications (browser/device)

## AI-Powered Notification Prioritization

The notification system uses OpenAI to intelligently prioritize notifications based on:
- Notification type and content urgency
- Financial impact (payments have higher priority)
- Time sensitivity (bookings, deadlines)
- User engagement patterns

If `OPENAI_API_KEY` is not configured, the system falls back to rule-based prioritization.

## License

MIT
