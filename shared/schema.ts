import { sql, relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  pgEnum,
  timestamp,
  varchar,
  text,
  integer,
  decimal,
  boolean,
  unique,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (for Express sessions)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Platform settings table (non-sensitive settings only - API keys stored as env vars)
export const platformSettings = pgTable("platform_settings", {
  id: varchar("id").primaryKey().default('default'),
  requireEmailVerification: boolean("require_email_verification").default(false).notNull(),
  requirePhoneVerification: boolean("require_phone_verification").default(false).notNull(),
  enableSwissAddressValidation: boolean("enable_swiss_address_validation").default(true).notNull(),
  enableAiCategoryValidation: boolean("enable_ai_category_validation").default(true).notNull(),
  googleMapsApiKey: text("google_maps_api_key"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Plans table
export const plans = pgTable("plans", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).unique().notNull(),
  description: text("description"),
  priceMonthly: decimal("price_monthly", { precision: 10, scale: 2 }).notNull(),
  priceYearly: decimal("price_yearly", { precision: 10, scale: 2 }).notNull(),
  maxImages: integer("max_images").default(4).notNull(),
  listingDurationDays: integer("listing_duration_days").default(14).notNull(),
  canRenew: boolean("can_renew").default(true).notNull(),
  featuredListing: boolean("featured_listing").default(false).notNull(),
  prioritySupport: boolean("priority_support").default(false).notNull(),
  analyticsAccess: boolean("analytics_access").default(false).notNull(),
  customBranding: boolean("custom_branding").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Users table (extended for marketplace with local auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  phone: varchar("phone", { length: 50 }),
  phoneNumber: varchar("phone_number", { length: 50 }),
  
  // Authentication fields
  passwordHash: varchar("password_hash", { length: 255 }),
  authProvider: varchar("auth_provider", { enum: ["local", "google", "twitter", "facebook"] }).default("local").notNull(),
  oauthProviderId: varchar("oauth_provider_id", { length: 255 }),
  
  // Email verification
  emailVerificationToken: varchar("email_verification_token", { length: 255 }),
  emailVerificationExpires: timestamp("email_verification_expires"),
  
  // Password reset
  passwordResetToken: varchar("password_reset_token", { length: 255 }),
  passwordResetExpires: timestamp("password_reset_expires"),
  
  // Login security
  lastLoginAt: timestamp("last_login_at"),
  failedLoginAttempts: integer("failed_login_attempts").default(0).notNull(),
  lockedUntil: timestamp("locked_until"),
  
  // Existing verification flags
  isVerified: boolean("is_verified").default(false).notNull(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  phoneVerified: boolean("phone_verified").default(false).notNull(),
  isAdmin: boolean("is_admin").default(false).notNull(),
  status: varchar("status", { enum: ["active", "warned", "suspended", "banned", "kicked"] }).default("active").notNull(),
  statusReason: text("status_reason"),
  planId: varchar("plan_id").references(() => plans.id),
  marketingPackage: varchar("marketing_package", { enum: ["basic", "pro", "premium", "enterprise"] }).default("basic"),
  locationLat: decimal("location_lat", { precision: 10, scale: 7 }),
  locationLng: decimal("location_lng", { precision: 10, scale: 7 }),
  preferredLocationName: varchar("preferred_location_name", { length: 200 }),
  preferredSearchRadiusKm: integer("preferred_search_radius_km").default(10),
  lastHomeVisitAt: timestamp("last_home_visit_at"),
  
  // Referral system fields
  referralCode: varchar("referral_code", { length: 20 }).unique(),
  referredBy: varchar("referred_by").references(() => users.id, { onDelete: "set null" }),
  points: integer("points").default(0).notNull(),
  totalEarnedPoints: integer("total_earned_points").default(0).notNull(),
  totalEarnedCommission: decimal("total_earned_commission", { precision: 12, scale: 2 }).default("0").notNull(),
  
  // Stripe integration fields
  stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
  stripeConnectAccountId: varchar("stripe_connect_account_id", { length: 255 }),
  stripeConnectOnboarded: boolean("stripe_connect_onboarded").default(false).notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_users_email").on(table.email),
  index("idx_users_auth_provider").on(table.authProvider),
  index("idx_users_referral_code").on(table.referralCode),
  index("idx_users_referred_by").on(table.referredBy),
]);

// Plans relations (declared after users to avoid circular reference)
export const plansRelations = relations(plans, ({ many }) => ({
  users: many(users),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  plan: one(plans, {
    fields: [users.planId],
    references: [plans.id],
  }),
  referrer: one(users, {
    fields: [users.referredBy],
    references: [users.id],
    relationName: "referrer",
  }),
  referrals: many(users, { relationName: "referrer" }),
  services: many(services),
  reviews: many(reviews),
  favorites: many(favorites),
  submittedCategories: many(submittedCategories),
  aiConversations: many(aiConversations),
  addresses: many(addresses),
  moderationActions: many(userModerationActions),
  oauthTokens: many(oauthTokens),
  pointsLog: many(pointsLog),
  referralTransactionsFrom: many(referralTransactions, { relationName: "fromUser" }),
  referralTransactionsTo: many(referralTransactions, { relationName: "toUser" }),
  // Payment & booking relations
  customerOrders: many(orders, { relationName: "customerOrders" }),
  vendorOrders: many(orders, { relationName: "vendorOrders" }),
  customerBookings: many(bookings, { relationName: "customerBookings" }),
  vendorBookings: many(bookings, { relationName: "vendorBookings" }),
  vendorAvailabilitySettings: one(vendorAvailabilitySettings),
  vendorCalendarBlocks: many(vendorCalendarBlocks),
  customerConversations: many(chatConversations, { relationName: "customerConversations" }),
  vendorConversations: many(chatConversations, { relationName: "vendorConversations" }),
  chatMessages: many(chatMessages),
  // Reports and blocks
  reportsFiled: many(userReports, { relationName: "reportsFiled" }),
  reportsReceived: many(userReports, { relationName: "reportsReceived" }),
  reportsResolved: many(userReports, { relationName: "reportsResolved" }),
  blocksGiven: many(userBlocks, { relationName: "blocksGiven" }),
  blocksReceived: many(userBlocks, { relationName: "blocksReceived" }),
}));

// OAuth tokens table (for storing social login tokens)
export const oauthTokens = pgTable("oauth_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  provider: varchar("provider", { enum: ["google", "twitter", "facebook"] }).notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_oauth_tokens_user").on(table.userId),
  index("idx_oauth_tokens_provider").on(table.provider),
]);

export const oauthTokensRelations = relations(oauthTokens, ({ one }) => ({
  user: one(users, {
    fields: [oauthTokens.userId],
    references: [users.id],
  }),
}));

// ===========================================
// REFERRAL SYSTEM TABLES
// ===========================================

/**
 * Referral Configuration Table
 * Stores configurable referral settings (commission rates, max levels, etc.)
 */
export const referralConfig = pgTable("referral_config", {
  id: varchar("id").primaryKey().default("default"),
  maxLevels: integer("max_levels").default(3).notNull(),
  
  // Commission rates per level (as decimal, e.g., 0.10 = 10%)
  level1CommissionRate: decimal("level1_commission_rate", { precision: 5, scale: 4 }).default("0.10").notNull(),
  level2CommissionRate: decimal("level2_commission_rate", { precision: 5, scale: 4 }).default("0.04").notNull(),
  level3CommissionRate: decimal("level3_commission_rate", { precision: 5, scale: 4 }).default("0.01").notNull(),
  
  // Points configuration
  pointsPerReferral: integer("points_per_referral").default(100).notNull(),
  pointsPerFirstPurchase: integer("points_per_first_purchase").default(50).notNull(),
  pointsPerServiceCreation: integer("points_per_service_creation").default(25).notNull(),
  pointsPerReview: integer("points_per_review").default(10).notNull(),
  
  // Point redemption rates
  pointsToDiscountRate: decimal("points_to_discount_rate", { precision: 10, scale: 4 }).default("0.01").notNull(), // 1 point = 0.01 CHF
  minPointsToRedeem: integer("min_points_to_redeem").default(100).notNull(),
  
  // Referral system settings
  referralCodeLength: integer("referral_code_length").default(8).notNull(),
  referralLinkExpiryDays: integer("referral_link_expiry_days").default(30).notNull(),
  cookieExpiryDays: integer("cookie_expiry_days").default(30).notNull(),
  
  // Anti-abuse settings
  maxReferralsPerDay: integer("max_referrals_per_day").default(50).notNull(),
  minTimeBetweenReferrals: integer("min_time_between_referrals").default(60).notNull(), // seconds
  
  isActive: boolean("is_active").default(true).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Points Log Table
 * Tracks all point transactions (earned, spent, expired, etc.)
 */
export const pointsLog = pgTable("points_log", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  points: integer("points").notNull(), // Positive for earned, negative for spent
  balanceAfter: integer("balance_after").notNull(),
  
  action: varchar("action", { 
    enum: ["referral_signup", "referral_first_purchase", "referral_service_created", 
           "service_created", "review_posted", "purchase_made", 
           "redemption", "admin_adjustment", "expired", "bonus"] 
  }).notNull(),
  
  description: text("description"),
  
  // Reference to what triggered this point change
  referenceType: varchar("reference_type", { enum: ["user", "service", "review", "order", "admin"] }),
  referenceId: varchar("reference_id"),
  
  // For referral-related points, track the referral transaction
  referralTransactionId: varchar("referral_transaction_id").references(() => referralTransactions.id, { onDelete: "set null" }),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_points_log_user").on(table.userId),
  index("idx_points_log_action").on(table.action),
  index("idx_points_log_created").on(table.createdAt),
]);

export const pointsLogRelations = relations(pointsLog, ({ one }) => ({
  user: one(users, {
    fields: [pointsLog.userId],
    references: [users.id],
  }),
  referralTransaction: one(referralTransactions, {
    fields: [pointsLog.referralTransactionId],
    references: [referralTransactions.id],
  }),
}));

/**
 * Referral Transactions Table
 * Tracks commission and points earned from referral chain
 */
export const referralTransactions = pgTable("referral_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // The user who earned the commission/points (the referrer)
  toUserId: varchar("to_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // The user whose action triggered the reward (the referee, or downstream referral)
  fromUserId: varchar("from_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Referral level (1 = direct, 2 = second level, 3 = third level)
  level: integer("level").notNull(),
  
  // Points earned by toUserId from this transaction
  pointsEarned: integer("points_earned").default(0).notNull(),
  
  // Commission earned (monetary value in CHF)
  commissionEarned: decimal("commission_earned", { precision: 12, scale: 2 }).default("0").notNull(),
  
  // Commission rate used for this transaction
  commissionRate: decimal("commission_rate", { precision: 5, scale: 4 }),
  
  // What triggered this transaction
  triggerType: varchar("trigger_type", { 
    enum: ["signup", "first_purchase", "service_created", "order_completed", "subscription_renewed"] 
  }).notNull(),
  
  // Reference to the triggering entity (e.g., service ID, order ID)
  triggerId: varchar("trigger_id"),
  triggerAmount: decimal("trigger_amount", { precision: 12, scale: 2 }), // The base amount for commission calculation
  
  // Status of the transaction
  status: varchar("status", { 
    enum: ["pending", "confirmed", "paid", "cancelled", "expired"] 
  }).default("pending").notNull(),
  
  // Payout tracking
  paidAt: timestamp("paid_at"),
  payoutId: varchar("payout_id"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_referral_tx_to_user").on(table.toUserId),
  index("idx_referral_tx_from_user").on(table.fromUserId),
  index("idx_referral_tx_level").on(table.level),
  index("idx_referral_tx_status").on(table.status),
  index("idx_referral_tx_trigger").on(table.triggerType),
  index("idx_referral_tx_created").on(table.createdAt),
]);

export const referralTransactionsRelations = relations(referralTransactions, ({ one, many }) => ({
  toUser: one(users, {
    fields: [referralTransactions.toUserId],
    references: [users.id],
    relationName: "toUser",
  }),
  fromUser: one(users, {
    fields: [referralTransactions.fromUserId],
    references: [users.id],
    relationName: "fromUser",
  }),
  pointsLogs: many(pointsLog),
}));

/**
 * Referral Stats Cache Table
 * Cached aggregated stats for dashboard performance
 */
export const referralStats = pgTable("referral_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  
  // Direct referral counts
  totalDirectReferrals: integer("total_direct_referrals").default(0).notNull(),
  activeDirectReferrals: integer("active_direct_referrals").default(0).notNull(),
  
  // Network stats (all levels)
  totalNetworkSize: integer("total_network_size").default(0).notNull(),
  
  // Earnings
  totalPointsEarned: integer("total_points_earned").default(0).notNull(),
  totalCommissionEarned: decimal("total_commission_earned", { precision: 12, scale: 2 }).default("0").notNull(),
  pendingCommission: decimal("pending_commission", { precision: 12, scale: 2 }).default("0").notNull(),
  
  // Rankings
  referralRank: integer("referral_rank"),
  
  // Last activity
  lastReferralAt: timestamp("last_referral_at"),
  
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_referral_stats_user").on(table.userId),
  index("idx_referral_stats_rank").on(table.referralRank),
]);

export const referralStatsRelations = relations(referralStats, ({ one }) => ({
  user: one(users, {
    fields: [referralStats.userId],
    references: [users.id],
  }),
}));

// ===========================================
// END REFERRAL SYSTEM TABLES
// ===========================================

// Addresses table
export const addresses = pgTable("addresses", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  label: varchar("label", { length: 100 }),
  street: varchar("street", { length: 255 }).notNull(),
  city: varchar("city", { length: 100 }).notNull(),
  postalCode: varchar("postal_code", { length: 20 }).notNull(),
  canton: varchar("canton", { length: 100 }),
  country: varchar("country", { length: 100 }).notNull().default("Switzerland"),
  isPrimary: boolean("is_primary").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("idx_addresses_user").on(table.userId),
]);

export const addressesRelations = relations(addresses, ({ one }) => ({
  user: one(users, {
    fields: [addresses.userId],
    references: [users.id],
  }),
}));

// User moderation actions table (audit log)
export const userModerationActions = pgTable("user_moderation_actions", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  adminId: varchar("admin_id").references(() => users.id),
  action: varchar("action", { enum: ["warn", "suspend", "ban", "kick", "reactivate"] }).notNull(),
  previousStatus: varchar("previous_status", { enum: ["active", "warned", "suspended", "banned", "kicked"] }),
  newStatus: varchar("new_status", { enum: ["active", "warned", "suspended", "banned", "kicked"] }).notNull(),
  reason: text("reason"),
  ipAddress: varchar("ip_address", { length: 45 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("idx_moderation_user").on(table.userId),
  index("idx_moderation_admin").on(table.adminId),
  index("idx_moderation_action").on(table.action),
]);

export const userModerationActionsRelations = relations(userModerationActions, ({ one }) => ({
  user: one(users, {
    fields: [userModerationActions.userId],
    references: [users.id],
  }),
  admin: one(users, {
    fields: [userModerationActions.adminId],
    references: [users.id],
  }),
}));

// Banned identifiers table (IP, email, phone tracking)
export const bannedIdentifiers = pgTable("banned_identifiers", {
  id: varchar("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  identifierType: varchar("identifier_type", { enum: ["ip", "email", "phone"] }).notNull(),
  identifierValue: varchar("identifier_value", { length: 255 }).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  bannedBy: varchar("banned_by").references(() => users.id),
  reason: text("reason"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at"),
}, (table) => [
  index("idx_banned_type_value").on(table.identifierType, table.identifierValue),
  index("idx_banned_user").on(table.userId),
]);

export const bannedIdentifiersRelations = relations(bannedIdentifiers, ({ one }) => ({
  user: one(users, {
    fields: [bannedIdentifiers.userId],
    references: [users.id],
  }),
  bannedByUser: one(users, {
    fields: [bannedIdentifiers.bannedBy],
    references: [users.id],
  }),
}));

// Categories table
export const categories = pgTable("categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).unique().notNull(),
  icon: varchar("icon", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const categoriesRelations = relations(categories, ({ many }) => ({
  services: many(services),
  subcategories: many(subcategories),
}));

// Subcategories table
export const subcategories = pgTable("subcategories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  categoryId: varchar("category_id").notNull().references(() => categories.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_subcategories_category").on(table.categoryId),
]);

export const subcategoriesRelations = relations(subcategories, ({ one, many }) => ({
  category: one(categories, {
    fields: [subcategories.categoryId],
    references: [categories.id],
  }),
  services: many(services),
}));

// Temporary categories (AI-suggested, auto-expire after 24 hours)
export const temporaryCategories = pgTable("temporary_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).unique().notNull(),
  icon: varchar("icon", { length: 50 }),
  aiSuggested: boolean("ai_suggested").default(true).notNull(),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const temporaryCategoriesRelations = relations(temporaryCategories, ({ one }) => ({
  user: one(users, {
    fields: [temporaryCategories.userId],
    references: [users.id],
  }),
}));

// User-submitted categories (pending approval)
export const submittedCategories = pgTable("submitted_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description").notNull(),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  status: varchar("status", { enum: ["pending", "approved", "rejected"] }).default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const submittedCategoriesRelations = relations(submittedCategories, ({ one }) => ({
  user: one(users, {
    fields: [submittedCategories.userId],
    references: [users.id],
  }),
}));

// Price list item type
export const priceListSchema = z.object({
  description: z.string(),
  price: z.string(),
  unit: z.string().optional(),
});

// Image metadata type
const cropAreaSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
});

export const imageMetadataSchema = z.object({
  crop: cropAreaSchema.optional(), // Percentages (0-100)
  cropPixels: cropAreaSchema.optional(), // Pixel coordinates
  rotation: z.number().default(0),
  zoom: z.number().default(1).optional(),
});

// Services table
export const services = pgTable("services", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  ownerId: varchar("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull(),
  categoryId: varchar("category_id").notNull().references(() => categories.id),
  subcategoryId: varchar("subcategory_id").references(() => subcategories.id),
  priceType: varchar("price_type", { enum: ["fixed", "list", "text"] }).default("fixed").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }),
  priceText: text("price_text"),
  priceList: jsonb("price_list").default(sql`'[]'::jsonb`),
  priceUnit: varchar("price_unit", { enum: ["hour", "job", "consultation", "day", "month"] }).notNull(),
  locations: text("locations").array().default(sql`ARRAY[]::text[]`).notNull(),
  locationLat: decimal("location_lat", { precision: 10, scale: 7 }),
  locationLng: decimal("location_lng", { precision: 10, scale: 7 }),
  preferredLocationName: varchar("preferred_location_name", { length: 200 }),
  images: text("images").array().default(sql`ARRAY[]::text[]`).notNull(),
  imageMetadata: jsonb("image_metadata").default(sql`'[]'::jsonb`),
  mainImageIndex: integer("main_image_index").default(0).notNull(),
  status: varchar("status", { enum: ["draft", "active", "paused", "expired"] }).default("draft").notNull(),
  tags: text("tags").array().default(sql`ARRAY[]::text[]`).notNull(),
  hashtags: text("hashtags").array().default(sql`ARRAY[]::text[]`).notNull(),
  contactPhone: varchar("contact_phone", { length: 50 }).notNull(),
  contactEmail: varchar("contact_email", { length: 200 }).notNull(),
  viewCount: integer("view_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_services_owner").on(table.ownerId),
  index("idx_services_category").on(table.categoryId),
  index("idx_services_status").on(table.status),
]);

export const servicesRelations = relations(services, ({ one, many }) => ({
  owner: one(users, {
    fields: [services.ownerId],
    references: [users.id],
  }),
  category: one(categories, {
    fields: [services.categoryId],
    references: [categories.id],
  }),
  subcategory: one(subcategories, {
    fields: [services.subcategoryId],
    references: [subcategories.id],
  }),
  reviews: many(reviews),
  favorites: many(favorites),
  serviceContacts: many(serviceContacts),
  // Payment & booking relations
  pricingOptions: many(servicePricingOptions),
  orders: many(orders),
  bookings: many(bookings),
  calendarBlocks: many(vendorCalendarBlocks),
  chatConversations: many(chatConversations),
}));

// Service contacts table (support multiple phone/email with verification)
export const serviceContacts = pgTable("service_contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceId: varchar("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  contactType: varchar("contact_type", { enum: ["phone", "email"] }).notNull(),
  value: varchar("value", { length: 200 }).notNull(),
  name: varchar("name", { length: 100 }),
  role: varchar("role", { length: 100 }),
  isPrimary: boolean("is_primary").default(false).notNull(),
  isVerified: boolean("is_verified").default(false).notNull(),
  verificationCode: varchar("verification_code", { length: 10 }),
  verificationExpiresAt: timestamp("verification_expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_service_contacts_service").on(table.serviceId),
]);

export const serviceContactsRelations = relations(serviceContacts, ({ one }) => ({
  service: one(services, {
    fields: [serviceContacts.serviceId],
    references: [services.id],
  }),
}));

// AI conversations table (track AI interactions)
export const aiConversations = pgTable("ai_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  conversationType: varchar("conversation_type", { enum: ["admin_assist", "user_support", "category_validation"] }).notNull(),
  messages: jsonb("messages").default(sql`'[]'::jsonb`).notNull(),
  metadata: jsonb("metadata").default(sql`'{}'::jsonb`).notNull(),
  status: varchar("status", { enum: ["active", "completed", "archived"] }).default("active").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_ai_conversations_user").on(table.userId),
  index("idx_ai_conversations_type").on(table.conversationType),
]);

export const aiConversationsRelations = relations(aiConversations, ({ one }) => ({
  user: one(users, {
    fields: [aiConversations.userId],
    references: [users.id],
  }),
}));

// Reviews table
export const reviews = pgTable("reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceId: varchar("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(),
  comment: text("comment").notNull(),
  editCount: integer("edit_count").default(0).notNull(),
  lastEditedAt: timestamp("last_edited_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_reviews_service").on(table.serviceId),
  index("idx_reviews_user").on(table.userId),
]);

export const reviewsRelations = relations(reviews, ({ one }) => ({
  service: one(services, {
    fields: [reviews.serviceId],
    references: [services.id],
  }),
  user: one(users, {
    fields: [reviews.userId],
    references: [users.id],
  }),
}));

// Favorites table (bonus feature)
export const favorites = pgTable("favorites", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  serviceId: varchar("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_favorites_user").on(table.userId),
  index("idx_favorites_service").on(table.serviceId),
]);

export const favoritesRelations = relations(favorites, ({ one }) => ({
  user: one(users, {
    fields: [favorites.userId],
    references: [users.id],
  }),
  service: one(services, {
    fields: [favorites.serviceId],
    references: [services.id],
  }),
}));

// Types
export type Plan = typeof plans.$inferSelect;
export type InsertPlan = typeof plans.$inferInsert;

export type PlatformSettings = typeof platformSettings.$inferSelect;
export type InsertPlatformSettings = typeof platformSettings.$inferInsert;

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type UserWithPlan = User & { plan?: Plan };

export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;

export type Subcategory = typeof subcategories.$inferSelect;
export type InsertSubcategory = typeof subcategories.$inferInsert;

export type TemporaryCategory = typeof temporaryCategories.$inferSelect;
export type InsertTemporaryCategory = typeof temporaryCategories.$inferInsert;

export type Service = typeof services.$inferSelect;
export type InsertService = typeof services.$inferInsert;

export type ServiceContact = typeof serviceContacts.$inferSelect;
export type InsertServiceContact = typeof serviceContacts.$inferInsert;

export type AiConversation = typeof aiConversations.$inferSelect;
export type InsertAiConversation = typeof aiConversations.$inferInsert;

export type Review = typeof reviews.$inferSelect;
export type InsertReview = typeof reviews.$inferInsert;

export type Favorite = typeof favorites.$inferSelect;
export type InsertFavorite = typeof favorites.$inferInsert;

export type SubmittedCategory = typeof submittedCategories.$inferSelect;
export type InsertSubmittedCategory = typeof submittedCategories.$inferInsert;

export type SelectAddress = typeof addresses.$inferSelect;

export type UserModerationAction = typeof userModerationActions.$inferSelect;
export type InsertUserModerationAction = typeof userModerationActions.$inferInsert;

export type BannedIdentifier = typeof bannedIdentifiers.$inferSelect;
export type InsertBannedIdentifier = typeof bannedIdentifiers.$inferInsert;

// Zod schemas for validation
export const insertServiceSchema = createInsertSchema(services, {
  title: z.string().min(5, "Title must be at least 5 characters").max(200),
  description: z.string().min(20, "Description must be at least 20 characters"),
  contactPhone: z.string().min(10, "Valid phone number required"),
  contactEmail: z.string().email("Valid email required"),
  locations: z.array(z.string()).min(1, "At least one location required"),
  priceType: z.enum(["fixed", "list", "text"]),
  price: z.string().optional(),
  priceText: z.string().optional(),
  priceList: z.any().optional(),
  hashtags: z.array(z.string().min(1, "Hashtag must have at least 1 character")).max(3, "Maximum 3 hashtags allowed").optional(),
  subcategoryId: z.string().optional().nullable(),
}).omit({
  id: true,
  ownerId: true,
  expiresAt: true,
  createdAt: true,
  updatedAt: true,
  viewCount: true,
  status: true,
}).superRefine((val, ctx) => {
  if (val.priceType === "fixed" && (!val.price || isNaN(Number(val.price)))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["price"],
      message: "Price is required for fixed pricing",
    });
  }
  if (val.priceType === "text" && !val.priceText) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["priceText"],
      message: "Price text is required",
    });
  }
});

export const insertReviewSchema = createInsertSchema(reviews, {
  rating: z.number().min(1).max(5),
  comment: z.string().min(10, "Review must be at least 10 characters"),
}).omit({
  id: true,
  createdAt: true,
});

export const insertCategorySchema = createInsertSchema(categories).omit({
  id: true,
  createdAt: true,
});

export const insertSubmittedCategorySchema = createInsertSchema(submittedCategories, {
  name: z.string().min(3, "Category name must be at least 3 characters").max(100),
  description: z.string().min(10, "Description must be at least 10 characters").max(500),
}).omit({
  id: true,
  createdAt: true,
  status: true,
});

export const insertPlanSchema = createInsertSchema(plans, {
  name: z.string().min(3, "Plan name must be at least 3 characters").max(100),
  slug: z.string().min(3, "Slug must be at least 3 characters").max(100),
  maxImages: z.number().min(1).max(100),
  listingDurationDays: z.number().min(1).max(365),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertServiceContactSchema = createInsertSchema(serviceContacts, {
  value: z.string().min(1, "Contact value is required"),
  contactType: z.enum(["phone", "email"]),
  name: z.string().optional(),
  role: z.string().optional(),
}).omit({
  id: true,
  createdAt: true,
  isVerified: true,
  verificationCode: true,
  verificationExpiresAt: true,
});

export const insertTemporaryCategorySchema = createInsertSchema(temporaryCategories, {
  name: z.string().min(3, "Category name must be at least 3 characters").max(100),
  slug: z.string().min(3, "Slug must be at least 3 characters").max(100),
}).omit({
  id: true,
  createdAt: true,
});

export const insertAiConversationSchema = createInsertSchema(aiConversations, {
  conversationType: z.enum(["admin_assist", "user_support", "category_validation"]),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAddressSchema = createInsertSchema(addresses, {
  street: z.string().min(1, "Street is required").max(255),
  city: z.string().min(1, "City is required").max(100),
  postalCode: z.string().min(1, "Postal code is required").max(20),
  canton: z.string().optional(),
  label: z.string().optional(),
}).omit({
  id: true,
  userId: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertAddress = z.infer<typeof insertAddressSchema>;

export const insertUserModerationActionSchema = createInsertSchema(userModerationActions, {
  action: z.enum(["warn", "suspend", "ban", "kick", "reactivate"]),
  reason: z.string().optional(),
}).omit({
  id: true,
  createdAt: true,
});

export const insertBannedIdentifierSchema = createInsertSchema(bannedIdentifiers, {
  identifierType: z.enum(["ip", "email", "phone"]),
  identifierValue: z.string().min(1, "Identifier value is required"),
  reason: z.string().optional(),
}).omit({
  id: true,
  createdAt: true,
});

// OAuth tokens types
export type OAuthToken = typeof oauthTokens.$inferSelect;
export type InsertOAuthToken = typeof oauthTokens.$inferInsert;

// Auth validation schemas
export const registerSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  firstName: z.string().min(1, "First name is required").max(50),
  lastName: z.string().min(1, "Last name is required").max(50),
});

export const loginSchema = z.object({
  email: z.string().email("Valid email is required"),
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Valid email is required"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
});

// ===========================================
// REFERRAL SYSTEM TYPES AND SCHEMAS
// ===========================================

// Referral Config types
export type ReferralConfig = typeof referralConfig.$inferSelect;
export type InsertReferralConfig = typeof referralConfig.$inferInsert;

// Points Log types
export type PointsLog = typeof pointsLog.$inferSelect;
export type InsertPointsLog = typeof pointsLog.$inferInsert;

// Referral Transaction types
export type ReferralTransaction = typeof referralTransactions.$inferSelect;
export type InsertReferralTransaction = typeof referralTransactions.$inferInsert;

// Referral Stats types
export type ReferralStats = typeof referralStats.$inferSelect;
export type InsertReferralStats = typeof referralStats.$inferInsert;

// Extended register schema with referral code
export const registerWithReferralSchema = registerSchema.extend({
  referralCode: z.string().min(4).max(20).optional(),
});

// Referral code validation schema
export const referralCodeSchema = z.object({
  referralCode: z.string().min(4, "Referral code must be at least 4 characters").max(20),
});

// Points redemption schema
export const redeemPointsSchema = z.object({
  points: z.number().min(1, "Must redeem at least 1 point"),
  redemptionType: z.enum(["discount", "promo_package", "visibility_boost"]),
  targetId: z.string().optional(), // e.g., service ID for visibility boost
});

// Admin referral adjustment schema
export const adminReferralAdjustmentSchema = z.object({
  userId: z.string().min(1, "User ID is required"),
  points: z.number(),
  reason: z.string().min(1, "Reason is required"),
});

// Referral config update schema
export const updateReferralConfigSchema = z.object({
  maxLevels: z.number().min(1).max(10).optional(),
  level1CommissionRate: z.string().optional(),
  level2CommissionRate: z.string().optional(),
  level3CommissionRate: z.string().optional(),
  pointsPerReferral: z.number().min(0).optional(),
  pointsPerFirstPurchase: z.number().min(0).optional(),
  pointsPerServiceCreation: z.number().min(0).optional(),
  pointsPerReview: z.number().min(0).optional(),
  pointsToDiscountRate: z.string().optional(),
  minPointsToRedeem: z.number().min(0).optional(),
  maxReferralsPerDay: z.number().min(1).optional(),
  isActive: z.boolean().optional(),
});

// ===========================================
// STRIPE PAYMENT SYSTEM
// ===========================================

/**
 * Service Pricing Options Table
 * Allows multiple pricing tiers per service (e.g., basic, premium, enterprise)
 */
export const servicePricingOptions = pgTable("service_pricing_options", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceId: varchar("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  
  // Pricing option details
  label: varchar("label", { length: 100 }).notNull(), // e.g., "Basic Cleaning", "Deep Clean"
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("CHF").notNull(),
  
  // Billing interval
  billingInterval: varchar("billing_interval", { 
    enum: ["one_time", "hourly", "daily", "weekly", "monthly", "yearly"] 
  }).default("one_time").notNull(),
  
  // Duration for the service (in minutes)
  durationMinutes: integer("duration_minutes"),
  
  // Stripe Price ID (created when pricing option is added)
  stripePriceId: varchar("stripe_price_id", { length: 255 }),
  
  // Ordering
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_pricing_options_service").on(table.serviceId),
  index("idx_pricing_options_active").on(table.isActive),
]);

export const servicePricingOptionsRelations = relations(servicePricingOptions, ({ one }) => ({
  service: one(services, {
    fields: [servicePricingOptions.serviceId],
    references: [services.id],
  }),
}));

/**
 * Orders Table
 * Tracks all orders/purchases made on the platform
 */
export const orders = pgTable("orders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  orderNumber: varchar("order_number", { length: 20 }).unique().notNull(),
  
  // Parties involved
  customerId: varchar("customer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  vendorId: varchar("vendor_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  serviceId: varchar("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  pricingOptionId: varchar("pricing_option_id").references(() => servicePricingOptions.id, { onDelete: "set null" }),
  
  // Pricing at time of order (snapshot)
  priceLabel: varchar("price_label", { length: 100 }),
  unitPrice: decimal("unit_price", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").default(1).notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  platformFee: decimal("platform_fee", { precision: 10, scale: 2 }).default("0").notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("CHF").notNull(),
  
  // Order status
  status: varchar("status", { 
    enum: ["pending", "confirmed", "in_progress", "completed", "cancelled", "refunded", "disputed"] 
  }).default("pending").notNull(),
  
  // Payment info (Stripe)
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
  stripeCheckoutSessionId: varchar("stripe_checkout_session_id", { length: 255 }),
  paymentStatus: varchar("payment_status", { 
    enum: ["pending", "processing", "succeeded", "failed", "refunded", "cancelled"] 
  }).default("pending").notNull(),
  paidAt: timestamp("paid_at"),
  
  // Vendor payout
  vendorPayoutAmount: decimal("vendor_payout_amount", { precision: 10, scale: 2 }),
  vendorPayoutStatus: varchar("vendor_payout_status", { 
    enum: ["pending", "processing", "paid", "failed"] 
  }).default("pending").notNull(),
  vendorPaidAt: timestamp("vendor_paid_at"),
  stripeTransferId: varchar("stripe_transfer_id", { length: 255 }),
  
  // Linked booking (if applicable)
  bookingId: varchar("booking_id"),
  
  // Notes
  customerNotes: text("customer_notes"),
  vendorNotes: text("vendor_notes"),
  adminNotes: text("admin_notes"),
  
  // Referral tracking (for commission calculation)
  referralProcessed: boolean("referral_processed").default(false).notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_orders_customer").on(table.customerId),
  index("idx_orders_vendor").on(table.vendorId),
  index("idx_orders_service").on(table.serviceId),
  index("idx_orders_status").on(table.status),
  index("idx_orders_payment_status").on(table.paymentStatus),
  index("idx_orders_created").on(table.createdAt),
]);

export const ordersRelations = relations(orders, ({ one, many }) => ({
  customer: one(users, {
    fields: [orders.customerId],
    references: [users.id],
    relationName: "customerOrders",
  }),
  vendor: one(users, {
    fields: [orders.vendorId],
    references: [users.id],
    relationName: "vendorOrders",
  }),
  service: one(services, {
    fields: [orders.serviceId],
    references: [services.id],
  }),
  pricingOption: one(servicePricingOptions, {
    fields: [orders.pricingOptionId],
    references: [servicePricingOptions.id],
  }),
  booking: one(bookings, {
    fields: [orders.bookingId],
    references: [bookings.id],
  }),
  chatConversation: one(chatConversations),
}));

// ===========================================
// BOOKING & CALENDAR SYSTEM
// ===========================================

/**
 * Vendor Availability Settings
 * Stores vendor's general availability preferences
 */
export const vendorAvailabilitySettings = pgTable("vendor_availability_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  
  // Default working hours (JSON: { mon: { start: "09:00", end: "17:00" }, ... })
  defaultWorkingHours: jsonb("default_working_hours").default(sql`'{}'::jsonb`),
  
  // Timezone
  timezone: varchar("timezone", { length: 50 }).default("Europe/Zurich").notNull(),
  
  // Booking settings
  minBookingNoticeHours: integer("min_booking_notice_hours").default(24).notNull(),
  maxBookingAdvanceDays: integer("max_booking_advance_days").default(90).notNull(),
  defaultSlotDurationMinutes: integer("default_slot_duration_minutes").default(60).notNull(),
  bufferBetweenBookingsMinutes: integer("buffer_between_bookings_minutes").default(15).notNull(),
  
  // Auto-accept settings
  autoAcceptBookings: boolean("auto_accept_bookings").default(false).notNull(),
  requireDeposit: boolean("require_deposit").default(false).notNull(),
  depositPercentage: integer("deposit_percentage").default(20),
  
  // Notifications
  emailNotifications: boolean("email_notifications").default(true).notNull(),
  smsNotifications: boolean("sms_notifications").default(false).notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_vendor_availability_user").on(table.userId),
]);

export const vendorAvailabilitySettingsRelations = relations(vendorAvailabilitySettings, ({ one }) => ({
  user: one(users, {
    fields: [vendorAvailabilitySettings.userId],
    references: [users.id],
  }),
}));

/**
 * Vendor Calendar Blocks
 * Manual blocks, holidays, unavailable periods
 */
export const vendorCalendarBlocks = pgTable("vendor_calendar_blocks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Block period
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  
  // Block type
  blockType: varchar("block_type", { 
    enum: ["manual", "holiday", "personal", "break", "maintenance"] 
  }).default("manual").notNull(),
  
  // Recurrence (null = one-time, else: daily, weekly, monthly)
  recurrence: varchar("recurrence", { enum: ["daily", "weekly", "monthly"] }),
  recurrenceEndDate: timestamp("recurrence_end_date"),
  
  // Details
  title: varchar("title", { length: 100 }),
  notes: text("notes"),
  
  // For specific service blocking (null = all services blocked)
  serviceId: varchar("service_id").references(() => services.id, { onDelete: "cascade" }),
  
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_calendar_blocks_user").on(table.userId),
  index("idx_calendar_blocks_time").on(table.startTime, table.endTime),
  index("idx_calendar_blocks_service").on(table.serviceId),
]);

export const vendorCalendarBlocksRelations = relations(vendorCalendarBlocks, ({ one }) => ({
  user: one(users, {
    fields: [vendorCalendarBlocks.userId],
    references: [users.id],
  }),
  service: one(services, {
    fields: [vendorCalendarBlocks.serviceId],
    references: [services.id],
  }),
}));

/**
 * Bookings Table
 * All booking requests and confirmed bookings
 */
export const bookings = pgTable("bookings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bookingNumber: varchar("booking_number", { length: 20 }).unique().notNull(),
  
  // Parties
  customerId: varchar("customer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  vendorId: varchar("vendor_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  serviceId: varchar("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  pricingOptionId: varchar("pricing_option_id").references(() => servicePricingOptions.id, { onDelete: "set null" }),
  
  // Requested time slot
  requestedStartTime: timestamp("requested_start_time").notNull(),
  requestedEndTime: timestamp("requested_end_time").notNull(),
  
  // Confirmed time slot (may differ from requested if alternative proposed)
  confirmedStartTime: timestamp("confirmed_start_time"),
  confirmedEndTime: timestamp("confirmed_end_time"),
  
  // Status workflow: pending → accepted/rejected/alternative_proposed → confirmed/cancelled
  status: varchar("status", { 
    enum: [
      "pending",           // Initial request from customer
      "accepted",          // Vendor accepted
      "rejected",          // Vendor rejected
      "alternative_proposed", // Vendor proposed different time
      "confirmed",         // Customer confirmed (after alternative or deposit paid)
      "in_progress",       // Service being delivered
      "completed",         // Service completed
      "cancelled",         // Cancelled by either party
      "no_show"            // Customer didn't show up
    ] 
  }).default("pending").notNull(),
  
  // Alternative proposal (if vendor proposes different time)
  alternativeStartTime: timestamp("alternative_start_time"),
  alternativeEndTime: timestamp("alternative_end_time"),
  alternativeMessage: text("alternative_message"),
  alternativeExpiresAt: timestamp("alternative_expires_at"),
  
  // Queue position (for waitlist functionality)
  queuePosition: integer("queue_position"),
  
  // Customer details at booking time
  customerMessage: text("customer_message"),
  customerPhone: varchar("customer_phone", { length: 50 }),
  customerAddress: text("customer_address"),
  
  // Vendor response
  vendorMessage: text("vendor_message"),
  rejectionReason: text("rejection_reason"),
  
  // Cancellation
  cancelledBy: varchar("cancelled_by", { enum: ["customer", "vendor", "system"] }),
  cancellationReason: text("cancellation_reason"),
  cancelledAt: timestamp("cancelled_at"),
  
  // Reminders sent
  reminderSentAt: timestamp("reminder_sent_at"),
  
  // Timestamps for status changes
  acceptedAt: timestamp("accepted_at"),
  confirmedAt: timestamp("confirmed_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_bookings_customer").on(table.customerId),
  index("idx_bookings_vendor").on(table.vendorId),
  index("idx_bookings_service").on(table.serviceId),
  index("idx_bookings_status").on(table.status),
  index("idx_bookings_requested_time").on(table.requestedStartTime),
  index("idx_bookings_confirmed_time").on(table.confirmedStartTime),
]);

export const bookingsRelations = relations(bookings, ({ one, many }) => ({
  customer: one(users, {
    fields: [bookings.customerId],
    references: [users.id],
    relationName: "customerBookings",
  }),
  vendor: one(users, {
    fields: [bookings.vendorId],
    references: [users.id],
    relationName: "vendorBookings",
  }),
  service: one(services, {
    fields: [bookings.serviceId],
    references: [services.id],
  }),
  pricingOption: one(servicePricingOptions, {
    fields: [bookings.pricingOptionId],
    references: [servicePricingOptions.id],
  }),
  orders: many(orders),
  chatConversation: one(chatConversations),
}));

// ===========================================
// CHAT SYSTEM
// ===========================================

/**
 * Chat Conversations Table
 * Links conversations to bookings/orders
 */
export const chatConversations = pgTable("chat_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Participants
  customerId: varchar("customer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  vendorId: varchar("vendor_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Context (at least one should be set)
  bookingId: varchar("booking_id").references(() => bookings.id, { onDelete: "cascade" }),
  orderId: varchar("order_id").references(() => orders.id, { onDelete: "cascade" }),
  serviceId: varchar("service_id").references(() => services.id, { onDelete: "set null" }),
  
  // Conversation status
  status: varchar("status", { 
    enum: ["active", "archived", "blocked", "closed"] 
  }).default("active").notNull(),
  
  // Last activity tracking
  lastMessageAt: timestamp("last_message_at"),
  lastMessagePreview: varchar("last_message_preview", { length: 100 }),
  
  // Unread counts (per participant)
  customerUnreadCount: integer("customer_unread_count").default(0).notNull(),
  vendorUnreadCount: integer("vendor_unread_count").default(0).notNull(),
  
  // Moderation
  flaggedForReview: boolean("flagged_for_review").default(false).notNull(),
  flagReason: text("flag_reason"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_chat_conversations_customer").on(table.customerId),
  index("idx_chat_conversations_vendor").on(table.vendorId),
  index("idx_chat_conversations_booking").on(table.bookingId),
  index("idx_chat_conversations_order").on(table.orderId),
  index("idx_chat_conversations_last_message").on(table.lastMessageAt),
]);

export const chatConversationsRelations = relations(chatConversations, ({ one, many }) => ({
  customer: one(users, {
    fields: [chatConversations.customerId],
    references: [users.id],
    relationName: "customerConversations",
  }),
  vendor: one(users, {
    fields: [chatConversations.vendorId],
    references: [users.id],
    relationName: "vendorConversations",
  }),
  booking: one(bookings, {
    fields: [chatConversations.bookingId],
    references: [bookings.id],
  }),
  order: one(orders, {
    fields: [chatConversations.orderId],
    references: [orders.id],
  }),
  service: one(services, {
    fields: [chatConversations.serviceId],
    references: [services.id],
  }),
  messages: many(chatMessages),
}));

/**
 * Chat Messages Table
 * Individual messages with moderation tracking
 */
export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull().references(() => chatConversations.id, { onDelete: "cascade" }),
  
  // Sender
  senderId: varchar("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  senderRole: varchar("sender_role", { enum: ["customer", "vendor", "system"] }).notNull(),
  
  // Message content
  content: text("content").notNull(),
  originalContent: text("original_content"), // Stored if message was modified by filter
  
  // Message type
  messageType: varchar("message_type", { 
    enum: ["text", "image", "file", "system", "booking_update", "payment_update"] 
  }).default("text").notNull(),
  
  // Attachments (for images/files)
  attachments: jsonb("attachments").default(sql`'[]'::jsonb`),
  
  // Moderation
  wasFiltered: boolean("was_filtered").default(false).notNull(),
  filterReason: varchar("filter_reason", { 
    enum: ["profanity", "contact_info", "spam", "manual"] 
  }),
  blockedContent: text("blocked_content"), // What was blocked (for admin review)
  
  // Read status
  readAt: timestamp("read_at"),
  
  // Edit/delete
  isEdited: boolean("is_edited").default(false).notNull(),
  editedAt: timestamp("edited_at"),
  isDeleted: boolean("is_deleted").default(false).notNull(),
  deletedAt: timestamp("deleted_at"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_chat_messages_conversation").on(table.conversationId),
  index("idx_chat_messages_sender").on(table.senderId),
  index("idx_chat_messages_created").on(table.createdAt),
]);

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  conversation: one(chatConversations, {
    fields: [chatMessages.conversationId],
    references: [chatConversations.id],
  }),
  sender: one(users, {
    fields: [chatMessages.senderId],
    references: [users.id],
  }),
}));

/**
 * User Reports Table
 * For reporting users in chat conversations
 */
export const userReports = pgTable("user_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Reporter
  reporterId: varchar("reporter_id").notNull().references(() => users.id, { onDelete: "cascade" }),

  // Reported user
  reportedUserId: varchar("reported_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

  // Context
  conversationId: varchar("conversation_id").references(() => chatConversations.id, { onDelete: "cascade" }),
  messageId: varchar("message_id").references(() => chatMessages.id, { onDelete: "cascade" }),

  // Report details
  reportType: varchar("report_type", {
    enum: ["spam", "harassment", "scam", "inappropriate_content", "fake_account", "other"]
  }).notNull(),

  description: text("description").notNull(),

  // AI moderation results
  aiSeverity: varchar("ai_severity", {
    enum: ["low", "medium", "high", "critical"]
  }),

  aiAnalysis: text("ai_analysis"),

  aiRecommendation: text("ai_recommendation"),

  // Status
  status: varchar("status", {
    enum: ["pending", "under_review", "resolved", "dismissed"]
  }).default("pending").notNull(),

  // Resolution
  adminDecision: varchar("admin_decision", {
    enum: ["warning", "suspension", "ban", "no_action"]
  }),

  adminNotes: text("admin_notes"),

  resolvedBy: varchar("resolved_by").references(() => users.id),
  resolvedAt: timestamp("resolved_at"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => [
  index("idx_user_reports_reporter").on(table.reporterId),
  index("idx_user_reports_reported").on(table.reportedUserId),
  index("idx_user_reports_conversation").on(table.conversationId),
  index("idx_user_reports_status").on(table.status),
  index("idx_user_reports_severity").on(table.aiSeverity),
]);

export const userReportsRelations = relations(userReports, ({ one }) => ({
  reporter: one(users, {
    fields: [userReports.reporterId],
    references: [users.id],
    relationName: "reportsFiled",
  }),
  reportedUser: one(users, {
    fields: [userReports.reportedUserId],
    references: [users.id],
    relationName: "reportsReceived",
  }),
  conversation: one(chatConversations, {
    fields: [userReports.conversationId],
    references: [chatConversations.id],
  }),
  message: one(chatMessages, {
    fields: [userReports.messageId],
    references: [chatMessages.id],
  }),
  resolvedByUser: one(users, {
    fields: [userReports.resolvedBy],
    references: [users.id],
    relationName: "reportsResolved",
  }),
}));

/**
 * User Blocks Table
 * For blocking users in chat
 */
export const userBlocks = pgTable("user_blocks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  // Blocker
  blockerId: varchar("blocker_id").notNull().references(() => users.id, { onDelete: "cascade" }),

  // Blocked user
  blockedUserId: varchar("blocked_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),

  // Reason
  reason: text("reason"),

  // Block scope
  blockType: varchar("block_type", {
    enum: ["chat_only", "full_block"] // chat_only blocks only messaging, full_block blocks all interaction
  }).default("chat_only").notNull(),

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_user_blocks_blocker").on(table.blockerId),
  index("idx_user_blocks_blocked").on(table.blockedUserId),
  unique("unique_user_block").on(table.blockerId, table.blockedUserId),
]);

export const userBlocksRelations = relations(userBlocks, ({ one }) => ({
  blocker: one(users, {
    fields: [userBlocks.blockerId],
    references: [users.id],
    relationName: "blocksGiven",
  }),
  blockedUser: one(users, {
    fields: [userBlocks.blockedUserId],
    references: [users.id],
    relationName: "blocksReceived",
  }),
}));

// ===========================================
// STRIPE USER EXTENSIONS (add to users table later via migration)
// Note: These fields should be added to the users table
// stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
// stripeConnectAccountId: varchar("stripe_connect_account_id", { length: 255 }),
// stripeConnectOnboarded: boolean("stripe_connect_onboarded").default(false),
// ===========================================

// ===========================================
// NOTIFICATION SYSTEM
// ===========================================

/**
 * Notification Types Enum
 * Defines all possible notification categories
 */
export const notificationTypeEnum = pgEnum("notification_type", [
  "message",      // New chat message
  "booking",      // Booking updates (new, accepted, rejected, etc.)
  "referral",     // Referral-related (new referral, commission earned)
  "service",      // Service updates (approved, featured, etc.)
  "payment",      // Payment-related (received, payout, etc.)
  "system",       // System notifications (maintenance, updates)
  "review",       // New review received
  "promotion",    // Promotional notifications
]);

/**
 * Notifications Table
 * Stores all user notifications with AI prioritization support
 */
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Notification content
  type: notificationTypeEnum("type").notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message").notNull(),
  icon: varchar("icon", { length: 50 }), // Icon name for UI (e.g., "message", "bell", "dollar")
  
  // Related entities (for navigation)
  relatedEntityType: varchar("related_entity_type", { length: 50 }), // 'booking', 'conversation', 'service', 'order'
  relatedEntityId: varchar("related_entity_id"),
  actionUrl: varchar("action_url", { length: 500 }), // Where to navigate on click
  
  // AI Prioritization
  priority: integer("priority").default(5).notNull(), // 1 (highest) to 10 (lowest)
  aiRelevanceScore: decimal("ai_relevance_score", { precision: 4, scale: 3 }), // 0.000 to 1.000
  aiReasoning: text("ai_reasoning"), // Why AI assigned this priority
  
  // Status tracking
  isRead: boolean("is_read").default(false).notNull(),
  readAt: timestamp("read_at"),
  isDismissed: boolean("is_dismissed").default(false).notNull(),
  
  // Delivery tracking
  deliveredVia: jsonb("delivered_via").default([]).notNull(), // ['in_app', 'email', 'push']
  emailSentAt: timestamp("email_sent_at"),
  pushSentAt: timestamp("push_sent_at"),
  
  // Metadata
  metadata: jsonb("metadata").default({}), // Additional data specific to notification type
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"), // Optional expiration
}, (table) => [
  index("idx_notifications_user").on(table.userId),
  index("idx_notifications_user_unread").on(table.userId, table.isRead),
  index("idx_notifications_type").on(table.type),
  index("idx_notifications_created").on(table.createdAt),
  index("idx_notifications_priority").on(table.userId, table.priority),
]);

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, {
    fields: [notifications.userId],
    references: [users.id],
  }),
}));

/**
 * Notification Preferences Table
 * User-specific notification settings
 */
export const notificationPreferences = pgTable("notification_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }).unique(),
  
  // Global toggle
  notificationsEnabled: boolean("notifications_enabled").default(true).notNull(),
  
  // Delivery method toggles
  inAppEnabled: boolean("in_app_enabled").default(true).notNull(),
  emailEnabled: boolean("email_enabled").default(true).notNull(),
  pushEnabled: boolean("push_enabled").default(false).notNull(),
  
  // Per-type settings (stored as JSON for flexibility)
  // Each type has { in_app: boolean, email: boolean, push: boolean }
  typeSettings: jsonb("type_settings").default({
    message: { in_app: true, email: true, push: true },
    booking: { in_app: true, email: true, push: true },
    referral: { in_app: true, email: false, push: false },
    service: { in_app: true, email: false, push: false },
    payment: { in_app: true, email: true, push: true },
    system: { in_app: true, email: false, push: false },
    review: { in_app: true, email: true, push: false },
    promotion: { in_app: true, email: false, push: false },
  }).notNull(),
  
  // Quiet hours (do not disturb)
  quietHoursEnabled: boolean("quiet_hours_enabled").default(false).notNull(),
  quietHoursStart: varchar("quiet_hours_start", { length: 5 }), // "22:00" format
  quietHoursEnd: varchar("quiet_hours_end", { length: 5 }),     // "08:00" format
  quietHoursTimezone: varchar("quiet_hours_timezone", { length: 50 }).default("UTC"),
  
  // Additional preferences
  soundEnabled: boolean("sound_enabled").default(true).notNull(),
  vibrationEnabled: boolean("vibration_enabled").default(true).notNull(),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const notificationPreferencesRelations = relations(notificationPreferences, ({ one }) => ({
  user: one(users, {
    fields: [notificationPreferences.userId],
    references: [users.id],
  }),
}));

/**
 * Push Subscriptions Table
 * Stores Web Push API subscription data for each user device
 */
export const pushSubscriptions = pgTable("push_subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  
  // Web Push subscription data (from PushSubscription object)
  endpoint: text("endpoint").notNull(),
  p256dhKey: text("p256dh_key").notNull(), // Public key for encryption
  authKey: text("auth_key").notNull(),     // Auth secret
  
  // Device info
  userAgent: varchar("user_agent", { length: 500 }),
  deviceName: varchar("device_name", { length: 100 }),
  deviceType: varchar("device_type", { length: 20 }), // 'desktop', 'mobile', 'tablet'
  
  // Status
  isActive: boolean("is_active").default(true).notNull(),
  failedAttempts: integer("failed_attempts").default(0).notNull(),
  lastFailureReason: text("last_failure_reason"),
  
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastUsedAt: timestamp("last_used_at"),
}, (table) => [
  index("idx_push_subscriptions_user").on(table.userId),
  index("idx_push_subscriptions_active").on(table.userId, table.isActive),
  index("idx_push_subscriptions_endpoint").on(table.endpoint),
]);

export const pushSubscriptionsRelations = relations(pushSubscriptions, ({ one }) => ({
  user: one(users, {
    fields: [pushSubscriptions.userId],
    references: [users.id],
  }),
}));

// ===========================================
// INSERT SCHEMAS
// ===========================================

export const insertServicePricingOptionSchema = createInsertSchema(servicePricingOptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertOrderSchema = createInsertSchema(orders).omit({
  id: true,
  orderNumber: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVendorAvailabilitySettingsSchema = createInsertSchema(vendorAvailabilitySettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertVendorCalendarBlockSchema = createInsertSchema(vendorCalendarBlocks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertBookingSchema = createInsertSchema(bookings).omit({
  id: true,
  bookingNumber: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChatConversationSchema = createInsertSchema(chatConversations).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export const insertNotificationPreferencesSchema = createInsertSchema(notificationPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptions).omit({
  id: true,
  createdAt: true,
});

// Notification preferences update schema (for API validation)
export const updateNotificationPreferencesSchema = z.object({
  notificationsEnabled: z.boolean().optional(),
  inAppEnabled: z.boolean().optional(),
  emailEnabled: z.boolean().optional(),
  pushEnabled: z.boolean().optional(),
  typeSettings: z.record(z.object({
    in_app: z.boolean(),
    email: z.boolean(),
    push: z.boolean(),
  })).optional(),
  quietHoursEnabled: z.boolean().optional(),
  quietHoursStart: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  quietHoursEnd: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/).optional(),
  quietHoursTimezone: z.string().optional(),
  soundEnabled: z.boolean().optional(),
  vibrationEnabled: z.boolean().optional(),
});

// ===========================================
// TYPE EXPORTS
// ===========================================

export type ServicePricingOption = typeof servicePricingOptions.$inferSelect;
export type InsertServicePricingOption = typeof servicePricingOptions.$inferInsert;

export type Order = typeof orders.$inferSelect;
export type InsertOrder = typeof orders.$inferInsert;

export type VendorAvailabilitySettings = typeof vendorAvailabilitySettings.$inferSelect;
export type InsertVendorAvailabilitySettings = typeof vendorAvailabilitySettings.$inferInsert;

export type VendorCalendarBlock = typeof vendorCalendarBlocks.$inferSelect;
export type InsertVendorCalendarBlock = typeof vendorCalendarBlocks.$inferInsert;

export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = typeof bookings.$inferInsert;

export type ChatConversation = typeof chatConversations.$inferSelect;
export type InsertChatConversation = typeof chatConversations.$inferInsert;

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = typeof notifications.$inferInsert;

export type NotificationPreferences = typeof notificationPreferences.$inferSelect;
export type InsertNotificationPreferences = typeof notificationPreferences.$inferInsert;

export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type InsertPushSubscription = typeof pushSubscriptions.$inferInsert;

// User Reports
export const insertUserReportSchema = createInsertSchema(userReports).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type UserReport = typeof userReports.$inferSelect;
export type InsertUserReport = typeof userReports.$inferInsert;

// User Blocks
export const insertUserBlockSchema = createInsertSchema(userBlocks).omit({
  id: true,
  createdAt: true,
});

export type UserBlock = typeof userBlocks.$inferSelect;
export type InsertUserBlock = typeof userBlocks.$inferInsert;

// Notification type constants for use throughout the app
export const NOTIFICATION_TYPES = [
  "message",
  "booking", 
  "referral",
  "service",
  "payment",
  "system",
  "review",
  "promotion",
] as const;

export type NotificationType = typeof NOTIFICATION_TYPES[number];
