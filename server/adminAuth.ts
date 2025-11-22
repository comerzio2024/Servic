import type { RequestHandler } from "express";
import { storage } from "./storage";

// Simple admin credentials (for demonstration only)
const ADMIN_CREDENTIALS = {
  username: "admin",
  password: "admin",
};

// Middleware to check if user is an admin
export const isAdmin: RequestHandler = async (req: any, res, next) => {
  // Check if user is logged in via session as admin
  if (req.session && req.session.isAdmin) {
    return next();
  }
  
  // Check if user is authenticated via Replit Auth and has isAdmin flag
  if (req.isAuthenticated && req.isAuthenticated()) {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (user && user.isAdmin) {
        return next();
      }
    } catch (error) {
      console.error("Error checking admin status:", error);
    }
  }

  return res.status(403).json({ message: "Admin access required" });
};

// Admin login handler
export const adminLogin: RequestHandler = (req, res) => {
  const { username, password } = req.body;

  if (username === ADMIN_CREDENTIALS.username && password === ADMIN_CREDENTIALS.password) {
    // Set admin session flag
    (req.session as any).isAdmin = true;
    
    return res.json({
      success: true,
      message: "Admin logged in successfully",
      user: {
        username: "admin",
        role: "admin",
      },
    });
  }

  return res.status(401).json({
    success: false,
    message: "Invalid credentials",
  });
};

// Admin logout handler
export const adminLogout: RequestHandler = (req, res) => {
  (req.session as any).isAdmin = false;
  res.json({ success: true, message: "Logged out successfully" });
};

// Get admin session info
export const getAdminSession: RequestHandler = (req, res) => {
  if ((req.session as any)?.isAdmin) {
    return res.json({
      isAdmin: true,
      user: {
        username: "admin",
        role: "admin",
      },
    });
  }
  
  return res.json({ isAdmin: false });
};
