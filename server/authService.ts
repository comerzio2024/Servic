/**
 * Authentication Service
 * 
 * Handles all authentication operations including:
 * - User registration with email/password
 * - User login with rate limiting
 * - Email verification
 * - Password reset
 * - Session management
 * 
 * Security features:
 * - bcrypt password hashing (cost factor 12)
 * - Rate limiting on failed logins (5 attempts = 15 min lockout)
 * - Secure random tokens for verification/reset
 * - Token expiration enforcement
 */

import bcrypt from "bcrypt";
import crypto from "crypto";
import { db } from "./db";
import { users, oauthTokens } from "@shared/schema";
import { eq, and, gt } from "drizzle-orm";
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendPasswordChangedEmail,
} from "./emailService";
import {
  validateReferralCode,
  wouldCreateCircularReference,
  checkReferralRateLimit,
  generateUniqueReferralCode,
  processReferralReward,
} from "./referralService";

// Security constants
const BCRYPT_ROUNDS = 12;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const EMAIL_VERIFICATION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const PASSWORD_RESET_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

/**
 * Generate a secure random token
 */
function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Register a new user with email and password
 * Supports optional referral code for referral tracking
 */
export async function registerUser(data: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  referralCode?: string;
}): Promise<{ success: boolean; message: string; userId?: string; referrerName?: string }> {
  const { email, password, firstName, lastName, referralCode } = data;
  
  // Check if email already exists
  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);
  
  if (existingUser.length > 0) {
    return { success: false, message: "An account with this email already exists" };
  }
  
  // Validate referral code if provided
  let referredBy: string | null = null;
  let referrerName: string | undefined;
  
  if (referralCode) {
    const referralValidation = await validateReferralCode(referralCode);
    
    if (referralValidation.valid && referralValidation.referrerId) {
      // Check rate limiting on the referrer
      const rateLimit = await checkReferralRateLimit(referralValidation.referrerId);
      
      if (rateLimit.allowed) {
        referredBy = referralValidation.referrerId;
        referrerName = referralValidation.referrerName;
      }
      // If rate limited, just don't apply the referral (don't block registration)
    }
    // If invalid code, just ignore it (don't block registration)
  }
  
  // Hash password
  const passwordHash = await hashPassword(password);
  
  // Generate email verification token
  const emailVerificationToken = generateToken();
  const emailVerificationExpires = new Date(Date.now() + EMAIL_VERIFICATION_EXPIRY_MS);
  
  // Generate unique referral code for the new user
  const newUserReferralCode = await generateUniqueReferralCode();
  
  // Create user
  const insertResult = await db
    .insert(users)
    .values({
      email: email.toLowerCase(),
      passwordHash,
      firstName,
      lastName,
      authProvider: "local",
      emailVerificationToken,
      emailVerificationExpires,
      emailVerified: false,
      referralCode: newUserReferralCode,
      referredBy,
    })
    .returning();
  const newUser = insertResult[0];
  
  // Process referral reward if this user was referred
  if (referredBy) {
    await processReferralReward({
      triggeredByUserId: newUser.id,
      triggerType: "signup",
    });
  }
  
  // Send verification email
  await sendVerificationEmail(email, firstName, emailVerificationToken);
  
  return {
    success: true,
    message: referrerName 
      ? `Account created! You were referred by ${referrerName}. Please check your email to verify your account.`
      : "Account created! Please check your email to verify your account.",
    userId: newUser.id,
    referrerName,
  };
}

/**
 * Login a user with email and password
 */
export async function loginUser(data: {
  email: string;
  password: string;
  ipAddress?: string;
}): Promise<{
  success: boolean;
  message: string;
  user?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
    isAdmin: boolean;
    emailVerified: boolean;
  };
}> {
  const { email, password } = data;
  
  // Find user by email
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);
  
  if (!user) {
    return { success: false, message: "Invalid email or password" };
  }
  
  // Check if user is using OAuth (no password)
  if (!user.passwordHash) {
    const provider = user.authProvider || "social login";
    return {
      success: false,
      message: `This account uses ${provider}. Please sign in with ${provider}.`,
    };
  }
  
  // Check if account is locked
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const remainingMinutes = Math.ceil(
      (user.lockedUntil.getTime() - Date.now()) / 60000
    );
    return {
      success: false,
      message: `Account is locked. Try again in ${remainingMinutes} minutes.`,
    };
  }
  
  // Check if account is banned/suspended/kicked
  if (user.status === "banned" || user.status === "suspended" || user.status === "kicked") {
    return {
      success: false,
      message: `Account is ${user.status}. ${user.statusReason || "Please contact support."}`,
    };
  }
  
  // Verify password
  const isValidPassword = await verifyPassword(password, user.passwordHash);
  
  if (!isValidPassword) {
    // Increment failed login attempts
    const newAttempts = (user.failedLoginAttempts || 0) + 1;
    const updateData: any = { failedLoginAttempts: newAttempts };
    
    // Lock account if too many attempts
    if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
      updateData.lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
      updateData.failedLoginAttempts = 0;
    }
    
    await db.update(users).set(updateData).where(eq(users.id, user.id));
    
    if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
      return {
        success: false,
        message: "Too many failed attempts. Account locked for 15 minutes.",
      };
    }
    
    return { success: false, message: "Invalid email or password" };
  }
  
  // Reset failed login attempts and update last login
  await db
    .update(users)
    .set({
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    })
    .where(eq(users.id, user.id));
  
  return {
    success: true,
    message: "Login successful",
    user: {
      id: user.id,
      email: user.email!,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
      isAdmin: user.isAdmin,
      emailVerified: user.emailVerified,
    },
  };
}

/**
 * Verify email address using token
 */
export async function verifyEmail(token: string): Promise<{
  success: boolean;
  message: string;
}> {
  // Find user with this token
  const [user] = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.emailVerificationToken, token),
        gt(users.emailVerificationExpires, new Date())
      )
    )
    .limit(1);
  
  if (!user) {
    return {
      success: false,
      message: "Invalid or expired verification link. Please request a new one.",
    };
  }
  
  // Update user as verified
  await db
    .update(users)
    .set({
      emailVerified: true,
      emailVerificationToken: null,
      emailVerificationExpires: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));
  
  // Send welcome email
  await sendWelcomeEmail(user.email!, user.firstName || "User");
  
  return {
    success: true,
    message: "Email verified successfully! You can now sign in.",
  };
}

/**
 * Resend verification email
 */
export async function resendVerificationEmail(email: string): Promise<{
  success: boolean;
  message: string;
}> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);
  
  if (!user) {
    // Don't reveal if user exists
    return {
      success: true,
      message: "If an account exists with this email, a verification link has been sent.",
    };
  }
  
  if (user.emailVerified) {
    return {
      success: false,
      message: "This email is already verified.",
    };
  }
  
  // Generate new token
  const emailVerificationToken = generateToken();
  const emailVerificationExpires = new Date(Date.now() + EMAIL_VERIFICATION_EXPIRY_MS);
  
  await db
    .update(users)
    .set({
      emailVerificationToken,
      emailVerificationExpires,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));
  
  await sendVerificationEmail(user.email!, user.firstName || "User", emailVerificationToken);
  
  return {
    success: true,
    message: "If an account exists with this email, a verification link has been sent.",
  };
}

/**
 * Request password reset
 */
export async function requestPasswordReset(email: string): Promise<{
  success: boolean;
  message: string;
}> {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);
  
  // Always return success to prevent email enumeration
  const successMessage = "If an account exists with this email, a password reset link has been sent.";
  
  if (!user) {
    return { success: true, message: successMessage };
  }
  
  // Check if user uses OAuth (no password to reset)
  if (!user.passwordHash && user.authProvider !== "local") {
    return { success: true, message: successMessage };
  }
  
  // Generate reset token
  const passwordResetToken = generateToken();
  const passwordResetExpires = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MS);
  
  await db
    .update(users)
    .set({
      passwordResetToken,
      passwordResetExpires,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));
  
  await sendPasswordResetEmail(user.email!, user.firstName || "User", passwordResetToken);
  
  return { success: true, message: successMessage };
}

/**
 * Reset password with token
 */
export async function resetPassword(data: {
  token: string;
  newPassword: string;
}): Promise<{
  success: boolean;
  message: string;
}> {
  const { token, newPassword } = data;
  
  // Find user with valid token
  const [user] = await db
    .select()
    .from(users)
    .where(
      and(
        eq(users.passwordResetToken, token),
        gt(users.passwordResetExpires, new Date())
      )
    )
    .limit(1);
  
  if (!user) {
    return {
      success: false,
      message: "Invalid or expired reset link. Please request a new one.",
    };
  }
  
  // Hash new password
  const passwordHash = await hashPassword(newPassword);
  
  // Update user
  await db
    .update(users)
    .set({
      passwordHash,
      passwordResetToken: null,
      passwordResetExpires: null,
      failedLoginAttempts: 0,
      lockedUntil: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));
  
  // Send confirmation email
  await sendPasswordChangedEmail(user.email!, user.firstName || "User");
  
  return {
    success: true,
    message: "Password reset successfully! You can now sign in with your new password.",
  };
}

/**
 * Change password (for authenticated users)
 */
export async function changePassword(data: {
  userId: string;
  currentPassword: string;
  newPassword: string;
}): Promise<{
  success: boolean;
  message: string;
}> {
  const { userId, currentPassword, newPassword } = data;
  
  // Get user
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  
  if (!user || !user.passwordHash) {
    return {
      success: false,
      message: "Unable to change password. Please contact support.",
    };
  }
  
  // Verify current password
  const isValidPassword = await verifyPassword(currentPassword, user.passwordHash);
  
  if (!isValidPassword) {
    return {
      success: false,
      message: "Current password is incorrect.",
    };
  }
  
  // Hash new password
  const passwordHash = await hashPassword(newPassword);
  
  // Update user
  await db
    .update(users)
    .set({
      passwordHash,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));
  
  // Send confirmation email
  await sendPasswordChangedEmail(user.email!, user.firstName || "User");
  
  return {
    success: true,
    message: "Password changed successfully!",
  };
}

/**
 * Get user by ID (for session management)
 */
export async function getUserById(userId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  
  return user || null;
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);
  
  return user || null;
}

/**
 * Create or update user from OAuth provider
 * Supports optional referral code for referral tracking (for new users)
 */
export async function upsertOAuthUser(data: {
  email: string;
  firstName?: string;
  lastName?: string;
  profileImageUrl?: string;
  authProvider: "google" | "twitter" | "facebook";
  oauthProviderId: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
  referralCode?: string; // Optional referral code from session/cookie
}): Promise<{
  success: boolean;
  user?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
    isAdmin: boolean;
    emailVerified: boolean;
  };
  isNewUser: boolean;
  message?: string;
}> {
  const { email, firstName, lastName, profileImageUrl, authProvider, oauthProviderId, accessToken, refreshToken, tokenExpiresAt, referralCode } = data;
  
  // Check if user exists
  let [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, email.toLowerCase()))
    .limit(1);
  
  let isNewUser = false;
  
  if (existingUser) {
    // Check if account is banned
    if (existingUser.status === "banned" || existingUser.status === "suspended" || existingUser.status === "kicked") {
      return {
        success: false,
        isNewUser: false,
        message: `Account is ${existingUser.status}. ${existingUser.statusReason || "Please contact support."}`,
      };
    }
    
    // Update existing user's OAuth info if they're linking a new provider
    // or if this is the same provider they registered with
    await db
      .update(users)
      .set({
        authProvider,
        oauthProviderId,
        profileImageUrl: profileImageUrl || existingUser.profileImageUrl,
        firstName: firstName || existingUser.firstName,
        lastName: lastName || existingUser.lastName,
        emailVerified: true, // OAuth emails are verified
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, existingUser.id));
  } else {
    // Validate referral code if provided (for new users only)
    let referredBy: string | null = null;
    
    if (referralCode) {
      const referralValidation = await validateReferralCode(referralCode);
      
      if (referralValidation.valid && referralValidation.referrerId) {
        const rateLimit = await checkReferralRateLimit(referralValidation.referrerId);
        
        if (rateLimit.allowed) {
          referredBy = referralValidation.referrerId;
        }
      }
    }
    
    // Generate unique referral code for the new user
    const newUserReferralCode = await generateUniqueReferralCode();
    
    // Create new user
    const oauthInsertResult = await db
      .insert(users)
      .values({
        email: email.toLowerCase(),
        firstName,
        lastName,
        profileImageUrl,
        authProvider,
        oauthProviderId,
        emailVerified: true, // OAuth emails are verified
        lastLoginAt: new Date(),
        referralCode: newUserReferralCode,
        referredBy,
      })
      .returning();
    
    existingUser = oauthInsertResult[0];
    isNewUser = true;
    
    // Process referral reward if this user was referred
    if (referredBy) {
      await processReferralReward({
        triggeredByUserId: newUser.id,
        triggerType: "signup",
      });
    }
  }
  
  // Store OAuth tokens if provided
  if (accessToken) {
    // Remove old tokens for this provider
    await db
      .delete(oauthTokens)
      .where(
        and(
          eq(oauthTokens.userId, existingUser.id),
          eq(oauthTokens.provider, authProvider)
        )
      );
    
    // Insert new tokens
    await db.insert(oauthTokens).values({
      userId: existingUser.id,
      provider: authProvider,
      accessToken,
      refreshToken,
      expiresAt: tokenExpiresAt,
    });
  }
  
  return {
    success: true,
    user: {
      id: existingUser.id,
      email: existingUser.email!,
      firstName: existingUser.firstName,
      lastName: existingUser.lastName,
      profileImageUrl: existingUser.profileImageUrl,
      isAdmin: existingUser.isAdmin,
      emailVerified: existingUser.emailVerified,
    },
    isNewUser,
  };
}

