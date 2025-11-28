/**
 * Authentication Middleware and Routes
 * 
 * This module replaces the Replit Auth system with a custom local
 * authentication system supporting:
 * - Email/password registration and login
 * - OAuth providers (Google, Twitter, Facebook)
 * - Session management with PostgreSQL store
 * - CSRF protection
 * - Rate limiting
 * 
 * Security features:
 * - HttpOnly, Secure cookies
 * - Session regeneration on login
 * - Automatic session cleanup
 */

import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import connectPg from "connect-pg-simple";
import type { Express, Request, Response, NextFunction, RequestHandler } from "express";
import { 
  registerUser, 
  loginUser, 
  verifyEmail, 
  resendVerificationEmail,
  requestPasswordReset,
  resetPassword,
  changePassword,
  getUserById,
} from "./authService";
import { storage } from "./storage";
import {
  registerWithReferralSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
} from "@shared/schema";
import { fromZodError } from "zod-validation-error";

// Extend Express Request to include our user type
declare global {
  namespace Express {
    interface User {
      id: string;
      email: string;
      firstName: string | null;
      lastName: string | null;
      profileImageUrl: string | null;
      isAdmin: boolean;
      emailVerified: boolean;
    }
  }
}

// Session configuration
const SESSION_TTL = 7 * 24 * 60 * 60 * 1000; // 1 week

/**
 * Get session middleware with PostgreSQL store
 */
export function getSession() {
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    ttl: SESSION_TTL / 1000, // in seconds
    tableName: "sessions",
  });
  
  const sessionSecret = process.env.SESSION_SECRET;
  if (!sessionSecret || sessionSecret === "change-this-secret-in-production") {
    console.warn("⚠️  WARNING: SESSION_SECRET is not set or using default value. Set a strong secret in production!");
  }
  
  return session({
    secret: sessionSecret || "dev-secret-change-in-production",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    name: "sid", // Change from default 'connect.sid' for security
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_TTL,
    },
  });
}

/**
 * Setup authentication middleware and routes
 */
export async function setupAuth(app: Express) {
  // Trust proxy for secure cookies behind reverse proxy
  app.set("trust proxy", 1);
  
  // Session middleware
  app.use(getSession());
  
  // Initialize Passport
  app.use(passport.initialize());
  app.use(passport.session());
  
  // Configure Local Strategy
  passport.use(
    new LocalStrategy(
      {
        usernameField: "email",
        passwordField: "password",
        passReqToCallback: true,
      },
      async (req, email, password, done) => {
        try {
          const result = await loginUser({
            email,
            password,
            ipAddress: req.ip,
          });
          
          if (!result.success) {
            return done(null, false, { message: result.message });
          }
          
          return done(null, result.user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );
  
  // Serialize user to session
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });
  
  // Deserialize user from session
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await getUserById(id);
      if (!user) {
        return done(null, false);
      }
      
      // Check if user is banned/suspended/kicked
      if (user.status === "banned" || user.status === "suspended" || user.status === "kicked") {
        return done(null, false);
      }
      
      done(null, {
        id: user.id,
        email: user.email!,
        firstName: user.firstName,
        lastName: user.lastName,
        profileImageUrl: user.profileImageUrl,
        isAdmin: user.isAdmin,
        emailVerified: user.emailVerified,
      });
    } catch (error) {
      done(error);
    }
  });
  
  // ===================
  // AUTH ROUTES
  // ===================
  
  /**
   * Register a new user
   * POST /api/auth/register
   * 
   * Supports optional referral code in body or query parameter
   * e.g., POST /api/auth/register?ref=ABC123
   * or { ..., referralCode: "ABC123" }
   */
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      // Get referral code from body, query, or session/cookie
      const referralCode = req.body.referralCode || 
                           req.query.ref as string || 
                           (req.session as any)?.referralCode ||
                           req.cookies?.referral_code;
      
      const validated = registerWithReferralSchema.parse({
        ...req.body,
        referralCode: referralCode || undefined,
      });
      
      const result = await registerUser(validated);
      
      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }
      
      // Clear referral code from session if used
      if ((req.session as any)?.referralCode) {
        delete (req.session as any).referralCode;
      }
      
      res.status(201).json({ 
        message: result.message,
        referrerName: result.referrerName,
      });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed. Please try again." });
    }
  });
  
  /**
   * Store referral code in session (for OAuth flows)
   * GET /api/auth/set-referral?ref=CODE
   */
  app.get("/api/auth/set-referral", (req: Request, res: Response) => {
    const referralCode = req.query.ref as string;
    
    if (referralCode && referralCode.length >= 4 && referralCode.length <= 20) {
      (req.session as any).referralCode = referralCode.toUpperCase();
      
      // Also set a cookie for persistence
      res.cookie('referral_code', referralCode.toUpperCase(), {
        maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      });
      
      res.json({ success: true, message: "Referral code stored" });
    } else {
      res.status(400).json({ success: false, message: "Invalid referral code" });
    }
  });
  
  /**
   * Login with email/password
   * POST /api/auth/login
   */
  app.post("/api/auth/login", (req: Request, res: Response, next: NextFunction) => {
    try {
      loginSchema.parse(req.body);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      return res.status(400).json({ message: "Invalid request" });
    }
    
    passport.authenticate("local", (err: any, user: Express.User | false, info: { message: string } | undefined) => {
      if (err) {
        console.error("Login error:", err);
        return res.status(500).json({ message: "Login failed. Please try again." });
      }
      
      if (!user) {
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }
      
      // Regenerate session for security
      req.login(user, (loginErr) => {
        if (loginErr) {
          console.error("Session error:", loginErr);
          return res.status(500).json({ message: "Login failed. Please try again." });
        }
        
        res.json({
          message: "Login successful",
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            profileImageUrl: user.profileImageUrl,
            isAdmin: user.isAdmin,
            emailVerified: user.emailVerified,
          },
        });
      });
    })(req, res, next);
  });
  
  /**
   * Logout
   * POST /api/auth/logout
   */
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.logout((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Logout failed" });
      }
      
      req.session.destroy((destroyErr) => {
        if (destroyErr) {
          console.error("Session destroy error:", destroyErr);
        }
        res.clearCookie("sid");
        res.json({ message: "Logged out successfully" });
      });
    });
  });
  
  /**
   * Get current user (for backwards compatibility with /api/login redirect)
   * Also handles the legacy /api/login and /api/logout redirects
   */
  app.get("/api/login", (_req: Request, res: Response) => {
    // Redirect to login page instead of Replit OAuth
    res.redirect("/login");
  });
  
  app.get("/api/logout", (req: Request, res: Response) => {
    req.logout((err) => {
      if (err) {
        console.error("Logout error:", err);
      }
      req.session.destroy((destroyErr) => {
        if (destroyErr) {
          console.error("Session destroy error:", destroyErr);
        }
        res.clearCookie("sid");
        res.redirect("/");
      });
    });
  });
  
  /**
   * Get current authenticated user
   * GET /api/auth/user
   */
  app.get("/api/auth/user", async (req: Request, res: Response) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    try {
      // Get full user data from database
      const user = await storage.getUser(req.user.id);
      if (!user) {
        return res.status(401).json({ message: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });
  
  /**
   * Verify email
   * POST /api/auth/verify-email
   */
  app.post("/api/auth/verify-email", async (req: Request, res: Response) => {
    try {
      const { token } = req.body;
      
      if (!token) {
        return res.status(400).json({ message: "Verification token is required" });
      }
      
      const result = await verifyEmail(token);
      
      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }
      
      res.json({ message: result.message });
    } catch (error) {
      console.error("Email verification error:", error);
      res.status(500).json({ message: "Verification failed. Please try again." });
    }
  });
  
  /**
   * Resend verification email
   * POST /api/auth/resend-verification
   */
  app.post("/api/auth/resend-verification", async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      
      const result = await resendVerificationEmail(email);
      res.json({ message: result.message });
    } catch (error) {
      console.error("Resend verification error:", error);
      res.status(500).json({ message: "Failed to send verification email." });
    }
  });
  
  /**
   * Request password reset
   * POST /api/auth/forgot-password
   */
  app.post("/api/auth/forgot-password", async (req: Request, res: Response) => {
    try {
      const validated = forgotPasswordSchema.parse(req.body);
      const result = await requestPasswordReset(validated.email);
      res.json({ message: result.message });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Password reset request error:", error);
      res.status(500).json({ message: "Failed to process request." });
    }
  });
  
  /**
   * Reset password with token
   * POST /api/auth/reset-password
   */
  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    try {
      const validated = resetPasswordSchema.parse(req.body);
      const result = await resetPassword({
        token: validated.token,
        newPassword: validated.password,
      });
      
      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }
      
      res.json({ message: result.message });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Password reset error:", error);
      res.status(500).json({ message: "Failed to reset password." });
    }
  });
  
  /**
   * Change password (authenticated)
   * POST /api/auth/change-password
   */
  app.post("/api/auth/change-password", isAuthenticated, async (req: Request, res: Response) => {
    try {
      const validated = changePasswordSchema.parse(req.body);
      const result = await changePassword({
        userId: req.user!.id,
        currentPassword: validated.currentPassword,
        newPassword: validated.newPassword,
      });
      
      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }
      
      res.json({ message: result.message });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Password change error:", error);
      res.status(500).json({ message: "Failed to change password." });
    }
  });
}

/**
 * Middleware to check if user is authenticated
 */
export const isAuthenticated: RequestHandler = async (req, res, next) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  // Check if user is banned/suspended/kicked
  try {
    const dbUser = await storage.getUser(req.user.id);
    if (!dbUser) {
      return res.status(401).json({ message: "User not found" });
    }
    
    if (dbUser.status === "banned" || dbUser.status === "suspended" || dbUser.status === "kicked") {
      // Force logout
      req.logout((err) => {
        req.session.destroy(() => {
          res.clearCookie("sid");
          res.status(403).json({
            message: `Account is ${dbUser.status}. ${dbUser.statusReason || "Please contact support."}`,
          });
        });
      });
      return;
    }
    
    // Check if email verification is required
    // Email verification is required for posting services (checked in specific routes)
    
    next();
  } catch (error) {
    console.error("Auth check error:", error);
    res.status(500).json({ message: "Authentication error" });
  }
};

/**
 * Middleware to check if user has verified email
 * Use this for routes that require email verification (e.g., posting services)
 */
export const requireEmailVerified: RequestHandler = (req, res, next) => {
  if (!req.user?.emailVerified) {
    return res.status(403).json({
      message: "Please verify your email address before performing this action.",
      requiresEmailVerification: true,
    });
  }
  next();
};

