/**
 * OAuth Providers Configuration
 * 
 * Handles OAuth authentication for Google, Twitter, and Facebook.
 * Each provider requires specific credentials in environment variables.
 * 
 * Required environment variables:
 * - Google: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
 * - Twitter: TWITTER_CLIENT_ID, TWITTER_CLIENT_SECRET
 * - Facebook: FACEBOOK_APP_ID, FACEBOOK_APP_SECRET
 * - APP_URL: The base URL of your application (e.g., http://localhost:5000)
 */

import type { Express, Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import { upsertOAuthUser } from "./authService";
import crypto from "crypto";

const APP_URL = process.env.APP_URL || "http://localhost:5000";

// Check which providers are configured
const isGoogleConfigured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
const isTwitterConfigured = !!(process.env.TWITTER_CLIENT_ID && process.env.TWITTER_CLIENT_SECRET);
const isFacebookConfigured = !!(process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET);

// Google OAuth client
let googleClient: OAuth2Client | null = null;
if (isGoogleConfigured) {
  googleClient = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${APP_URL}/api/auth/google/callback`
  );
}

/**
 * Setup OAuth routes for all providers
 */
export function setupOAuthRoutes(app: Express) {
  // Log OAuth configuration status
  console.log("OAuth Configuration Status:");
  console.log(`  - Google: ${isGoogleConfigured ? "✓ Configured" : "✗ Not configured"}`);
  console.log(`  - Twitter: ${isTwitterConfigured ? "✓ Configured" : "✗ Not configured"}`);
  console.log(`  - Facebook: ${isFacebookConfigured ? "✓ Configured" : "✗ Not configured"}`);
  
  // ===================
  // GOOGLE OAUTH
  // ===================
  
  /**
   * Initiate Google OAuth
   * GET /api/auth/google
   */
  app.get("/api/auth/google", (req: Request, res: Response) => {
    if (!googleClient || !isGoogleConfigured) {
      return res.redirect("/login?error=google_not_configured");
    }
    
    const state = generateState();
    req.session.oauthState = state;
    
    const authUrl = googleClient.generateAuthUrl({
      access_type: "offline",
      scope: ["openid", "email", "profile"],
      state,
      prompt: "select_account",
    });
    
    res.redirect(authUrl);
  });
  
  /**
   * Google OAuth callback
   * GET /api/auth/google/callback
   */
  app.get("/api/auth/google/callback", async (req: Request, res: Response) => {
    try {
      const { code, state } = req.query;
      
      // Verify state to prevent CSRF
      if (!state || state !== req.session.oauthState) {
        return res.redirect("/login?error=invalid_state");
      }
      delete req.session.oauthState;
      
      if (!googleClient || !code) {
        return res.redirect("/login?error=missing_code");
      }
      
      // Exchange code for tokens
      const { tokens } = await googleClient.getToken(code as string);
      googleClient.setCredentials(tokens);
      
      // Get user info
      const ticket = await googleClient.verifyIdToken({
        idToken: tokens.id_token!,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      
      const payload = ticket.getPayload();
      if (!payload || !payload.email) {
        return res.redirect("/login?error=no_email");
      }
      
      // Create or update user
      const result = await upsertOAuthUser({
        email: payload.email,
        firstName: payload.given_name,
        lastName: payload.family_name,
        profileImageUrl: payload.picture,
        authProvider: "google",
        oauthProviderId: payload.sub,
        accessToken: tokens.access_token || undefined,
        refreshToken: tokens.refresh_token || undefined,
        tokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined,
      });
      
      if (!result.success) {
        return res.redirect(`/login?error=${encodeURIComponent(result.message || "auth_failed")}`);
      }
      
      // Log the user in
      req.login(result.user!, (err) => {
        if (err) {
          console.error("Google OAuth login error:", err);
          return res.redirect("/login?error=session_error");
        }
        res.redirect("/");
      });
    } catch (error) {
      console.error("Google OAuth callback error:", error);
      res.redirect("/login?error=google_auth_failed");
    }
  });
  
  // ===================
  // TWITTER (X) OAUTH
  // ===================
  
  /**
   * Initiate Twitter OAuth 2.0
   * GET /api/auth/twitter
   */
  app.get("/api/auth/twitter", (req: Request, res: Response) => {
    if (!isTwitterConfigured) {
      return res.redirect("/login?error=twitter_not_configured");
    }
    
    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    
    req.session.oauthState = state;
    req.session.codeVerifier = codeVerifier;
    
    const params = new URLSearchParams({
      response_type: "code",
      client_id: process.env.TWITTER_CLIENT_ID!,
      redirect_uri: `${APP_URL}/api/auth/twitter/callback`,
      scope: "users.read tweet.read offline.access",
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });
    
    res.redirect(`https://twitter.com/i/oauth2/authorize?${params.toString()}`);
  });
  
  /**
   * Twitter OAuth callback
   * GET /api/auth/twitter/callback
   */
  app.get("/api/auth/twitter/callback", async (req: Request, res: Response) => {
    try {
      const { code, state } = req.query;
      
      // Verify state
      if (!state || state !== req.session.oauthState) {
        return res.redirect("/login?error=invalid_state");
      }
      
      const codeVerifier = req.session.codeVerifier;
      delete req.session.oauthState;
      delete req.session.codeVerifier;
      
      if (!code || !codeVerifier) {
        return res.redirect("/login?error=missing_code");
      }
      
      // Exchange code for tokens
      const tokenResponse = await fetch("https://api.twitter.com/2/oauth2/token", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          Authorization: `Basic ${Buffer.from(`${process.env.TWITTER_CLIENT_ID}:${process.env.TWITTER_CLIENT_SECRET}`).toString("base64")}`,
        },
        body: new URLSearchParams({
          code: code as string,
          grant_type: "authorization_code",
          redirect_uri: `${APP_URL}/api/auth/twitter/callback`,
          code_verifier: codeVerifier,
        }),
      });
      
      const tokens = await tokenResponse.json();
      
      if (!tokens.access_token) {
        console.error("Twitter token error: Failed to obtain access token");
        return res.redirect("/login?error=token_error");
      }
      
      // Get user info
      const userResponse = await fetch("https://api.twitter.com/2/users/me?user.fields=profile_image_url,name", {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      });
      
      const userData = await userResponse.json();
      
      if (!userData.data) {
        return res.redirect("/login?error=user_fetch_failed");
      }
      
      // Twitter doesn't provide email by default, use ID as identifier
      // You'll need to request elevated access for email
      const nameParts = (userData.data.name || "").split(" ");
      const firstName = nameParts[0];
      const lastName = nameParts.slice(1).join(" ");
      
      // For Twitter, we'll use the username as a placeholder email if no email is provided
      // In production, you should request email access from Twitter
      const email = `${userData.data.username}@twitter.placeholder`;
      
      // Create or update user
      const result = await upsertOAuthUser({
        email,
        firstName,
        lastName,
        profileImageUrl: userData.data.profile_image_url?.replace("_normal", ""),
        authProvider: "twitter",
        oauthProviderId: userData.data.id,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      });
      
      if (!result.success) {
        return res.redirect(`/login?error=${encodeURIComponent(result.message || "auth_failed")}`);
      }
      
      // Log the user in
      req.login(result.user!, (err) => {
        if (err) {
          console.error("Twitter OAuth login error:", err);
          return res.redirect("/login?error=session_error");
        }
        res.redirect("/");
      });
    } catch (error) {
      console.error("Twitter OAuth callback error:", error);
      res.redirect("/login?error=twitter_auth_failed");
    }
  });
  
  // ===================
  // FACEBOOK OAUTH
  // ===================
  
  /**
   * Initiate Facebook OAuth
   * GET /api/auth/facebook
   */
  app.get("/api/auth/facebook", (req: Request, res: Response) => {
    if (!isFacebookConfigured) {
      return res.redirect("/login?error=facebook_not_configured");
    }
    
    const state = generateState();
    req.session.oauthState = state;
    
    const params = new URLSearchParams({
      client_id: process.env.FACEBOOK_APP_ID!,
      redirect_uri: `${APP_URL}/api/auth/facebook/callback`,
      scope: "email,public_profile",
      response_type: "code",
      state,
    });
    
    res.redirect(`https://www.facebook.com/v18.0/dialog/oauth?${params.toString()}`);
  });
  
  /**
   * Facebook OAuth callback
   * GET /api/auth/facebook/callback
   */
  app.get("/api/auth/facebook/callback", async (req: Request, res: Response) => {
    try {
      const { code, state } = req.query;
      
      // Verify state
      if (!state || state !== req.session.oauthState) {
        return res.redirect("/login?error=invalid_state");
      }
      delete req.session.oauthState;
      
      if (!code) {
        return res.redirect("/login?error=missing_code");
      }
      
      // Exchange code for token
      const tokenUrl = new URL("https://graph.facebook.com/v18.0/oauth/access_token");
      tokenUrl.searchParams.set("client_id", process.env.FACEBOOK_APP_ID!);
      tokenUrl.searchParams.set("client_secret", process.env.FACEBOOK_APP_SECRET!);
      tokenUrl.searchParams.set("redirect_uri", `${APP_URL}/api/auth/facebook/callback`);
      tokenUrl.searchParams.set("code", code as string);
      
      const tokenResponse = await fetch(tokenUrl.toString());
      const tokens = await tokenResponse.json();
      
      if (!tokens.access_token) {
        console.error("Facebook token error: Failed to obtain access token");
        return res.redirect("/login?error=token_error");
      }
      
      // Get user info
      const userUrl = new URL("https://graph.facebook.com/me");
      userUrl.searchParams.set("fields", "id,email,first_name,last_name,picture.type(large)");
      userUrl.searchParams.set("access_token", tokens.access_token);
      
      const userResponse = await fetch(userUrl.toString());
      const userData = await userResponse.json();
      
      if (!userData.email) {
        return res.redirect("/login?error=no_email");
      }
      
      // Create or update user
      const result = await upsertOAuthUser({
        email: userData.email,
        firstName: userData.first_name,
        lastName: userData.last_name,
        profileImageUrl: userData.picture?.data?.url,
        authProvider: "facebook",
        oauthProviderId: userData.id,
        accessToken: tokens.access_token,
      });
      
      if (!result.success) {
        return res.redirect(`/login?error=${encodeURIComponent(result.message || "auth_failed")}`);
      }
      
      // Log the user in
      req.login(result.user!, (err) => {
        if (err) {
          console.error("Facebook OAuth login error:", err);
          return res.redirect("/login?error=session_error");
        }
        res.redirect("/");
      });
    } catch (error) {
      console.error("Facebook OAuth callback error:", error);
      res.redirect("/login?error=facebook_auth_failed");
    }
  });
}

// ===================
// HELPER FUNCTIONS
// ===================

/**
 * Generate a random state parameter for OAuth CSRF protection
 */
function generateState(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Generate a code verifier for PKCE (used by Twitter)
 */
function generateCodeVerifier(): string {
  return base64URLEncode(crypto.randomBytes(32));
}

/**
 * Generate code challenge from verifier for PKCE
 */
function generateCodeChallenge(verifier: string): string {
  const hash = crypto.createHash("sha256").update(verifier).digest();
  return base64URLEncode(hash);
}

/**
 * Base64 URL encode a buffer
 */
function base64URLEncode(buffer: Uint8Array | Buffer): string {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

// Extend session type for OAuth state
declare module "express-session" {
  interface SessionData {
    oauthState?: string;
    codeVerifier?: string;
  }
}

