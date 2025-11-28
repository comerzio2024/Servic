/**
 * Admin Authentication
 * 
 * Handles admin-specific authentication and authorization.
 * Admins are regular users with the isAdmin flag set to true.
 * 
 * Security features:
 * - Uses bcrypt for password hashing
 * - Session-based authentication
 * - Role checking via database flag
 */

import type { RequestHandler } from "express";
import { storage } from "./storage";
import { loginUser, hashPassword } from "./authService";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

/**
 * Middleware to check if user is an admin
 * 
 * Checks both:
 * 1. Session-based admin login (for the admin panel)
 * 2. Regular user authentication with isAdmin flag
 */
export const isAdmin: RequestHandler = async (req: any, res, next) => {
  // Check if user is logged in via regular auth and has isAdmin flag
  if (req.isAuthenticated && req.isAuthenticated() && req.user) {
    try {
      const user = await storage.getUser(req.user.id);
      
      if (user && user.isAdmin) {
        // Store admin info in request for use in routes
        req.adminUser = user;
        return next();
      }
    } catch (error) {
      console.error("Error checking admin status:", error);
    }
  }

  return res.status(403).json({ message: "Admin access required" });
};

/**
 * Admin login handler
 * 
 * Uses the same authentication as regular users, but only allows
 * users with the isAdmin flag to log in through this endpoint.
 * 
 * POST /api/admin/login
 * Body: { email: string, password: string }
 */
export const adminLogin: RequestHandler = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Email and password are required",
    });
  }

  try {
    // Use the regular login function
    const result = await loginUser({ email, password });

    if (!result.success) {
      return res.status(401).json({
        success: false,
        message: result.message,
      });
    }

    // Check if user is an admin
    const user = await storage.getUser(result.user!.id);
    
    if (!user || !user.isAdmin) {
      return res.status(403).json({
        success: false,
        message: "Admin access required",
      });
    }

    // Log the user in using Passport
    req.login(result.user!, (err) => {
      if (err) {
        console.error("Admin login session error:", err);
        return res.status(500).json({
          success: false,
          message: "Login failed",
        });
      }

      return res.json({
        success: true,
        message: "Admin logged in successfully",
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          isAdmin: true,
        },
      });
    });
  } catch (error) {
    console.error("Admin login error:", error);
    return res.status(500).json({
      success: false,
      message: "Login failed",
    });
  }
};

/**
 * Admin logout handler
 * POST /api/admin/logout
 */
export const adminLogout: RequestHandler = (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error("Admin logout error:", err);
      return res.status(500).json({ success: false, message: "Logout failed" });
    }
    
    req.session.destroy((destroyErr) => {
      if (destroyErr) {
        console.error("Session destroy error:", destroyErr);
      }
      res.clearCookie("sid");
      res.json({ success: true, message: "Logged out successfully" });
    });
  });
};

/**
 * Get admin session info
 * GET /api/admin/session
 */
export const getAdminSession: RequestHandler = async (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated() && req.user) {
    try {
      const user = await storage.getUser((req.user as any).id);
      
      if (user && user.isAdmin) {
        return res.json({
          isAdmin: true,
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
          },
        });
      }
    } catch (error) {
      console.error("Error getting admin session:", error);
    }
  }
  
  return res.json({ isAdmin: false });
};

/**
 * Create or promote a user to admin
 * This is a utility function for initial setup
 * 
 * Usage: Call this once to create the first admin user
 */
export async function createAdminUser(data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}): Promise<{ success: boolean; message: string; userId?: string }> {
  const { email, password, firstName, lastName } = data;
  
  try {
    // Check if user already exists
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    
    if (existingUser) {
      // Promote existing user to admin
      await db
        .update(users)
        .set({ isAdmin: true, updatedAt: new Date() })
        .where(eq(users.id, existingUser.id));
      
      return {
        success: true,
        message: "User promoted to admin",
        userId: existingUser.id,
      };
    }
    
    // Create new admin user
    const passwordHash = await hashPassword(password);
    
    const result = await db
      .insert(users)
      .values({
        email: email.toLowerCase(),
        passwordHash,
        firstName,
        lastName,
        authProvider: "local",
        isAdmin: true,
        emailVerified: true, // Admin accounts are pre-verified
      })
      .returning();
    const newUser = result[0];
    
    return {
      success: true,
      message: "Admin user created",
      userId: newUser.id,
    };
  } catch (error) {
    console.error("Error creating admin user:", error);
    return {
      success: false,
      message: "Failed to create admin user",
    };
  }
}

/**
 * Seed default admin user if no admins exist
 * Called during application startup
 */
export async function seedAdminIfNeeded(): Promise<void> {
  try {
    // Check if any admin users exist
    const [existingAdmin] = await db
      .select()
      .from(users)
      .where(eq(users.isAdmin, true))
      .limit(1);
    
    if (existingAdmin) {
      console.log("Admin user already exists:", existingAdmin.email);
      return;
    }
    
    // Create default admin user
    // In production, you should change these credentials immediately
    const defaultAdminEmail = process.env.ADMIN_EMAIL || "admin@example.com";
    const defaultAdminPassword = process.env.ADMIN_PASSWORD || "Admin123!";
    
    const result = await createAdminUser({
      email: defaultAdminEmail,
      password: defaultAdminPassword,
      firstName: "Admin",
      lastName: "User",
    });
    
    if (result.success) {
      console.log(`Default admin user created: ${defaultAdminEmail}`);
      console.log("⚠️  Please change the default admin password immediately!");
    } else {
      console.error("Failed to create default admin user:", result.message);
    }
  } catch (error) {
    console.error("Error seeding admin user:", error);
  }
}
