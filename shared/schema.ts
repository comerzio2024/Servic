import { sql, relations } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  decimal,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

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

export const plansRelations = relations(plans, ({ many }) => ({
  users: many(users),
}));

// Users table (extended for marketplace)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  isVerified: boolean("is_verified").default(false).notNull(),
  isAdmin: boolean("is_admin").default(false).notNull(),
  planId: varchar("plan_id").references(() => plans.id),
  marketingPackage: varchar("marketing_package", { enum: ["basic", "pro", "premium", "enterprise"] }).default("basic"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ one, many }) => ({
  plan: one(plans, {
    fields: [users.planId],
    references: [plans.id],
  }),
  services: many(services),
  reviews: many(reviews),
  favorites: many(favorites),
  submittedCategories: many(submittedCategories),
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
  priceType: varchar("price_type", { enum: ["fixed", "list", "text"] }).default("fixed").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }),
  priceText: text("price_text"),
  priceList: jsonb("price_list").default(sql`'[]'::jsonb`),
  priceUnit: varchar("price_unit", { enum: ["hour", "job", "consultation", "day", "month"] }).notNull(),
  locations: text("locations").array().default(sql`ARRAY[]::text[]`).notNull(),
  images: text("images").array().default(sql`ARRAY[]::text[]`).notNull(),
  imageMetadata: jsonb("image_metadata").default(sql`'[]'::jsonb`),
  mainImageIndex: integer("main_image_index").default(0).notNull(),
  status: varchar("status", { enum: ["draft", "active", "paused", "expired"] }).default("draft").notNull(),
  tags: text("tags").array().default(sql`ARRAY[]::text[]`).notNull(),
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
  reviews: many(reviews),
  favorites: many(favorites),
}));

// Reviews table
export const reviews = pgTable("reviews", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  serviceId: varchar("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(),
  comment: text("comment").notNull(),
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

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;

export type Service = typeof services.$inferSelect;
export type InsertService = typeof services.$inferInsert;

export type Review = typeof reviews.$inferSelect;
export type InsertReview = typeof reviews.$inferInsert;

export type Favorite = typeof favorites.$inferSelect;
export type InsertFavorite = typeof favorites.$inferInsert;

export type SubmittedCategory = typeof submittedCategories.$inferSelect;
export type InsertSubmittedCategory = typeof submittedCategories.$inferInsert;

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
