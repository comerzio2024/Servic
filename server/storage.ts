import {
  users,
  categories,
  services,
  reviews,
  favorites,
  submittedCategories,
  plans,
  type User,
  type UpsertUser,
  type Category,
  type InsertCategory,
  type Service,
  type InsertService,
  type Review,
  type InsertReview,
  type Favorite,
  type InsertFavorite,
  type SubmittedCategory,
  type InsertSubmittedCategory,
  type Plan,
  type InsertPlan,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, ilike, or } from "drizzle-orm";

export interface IStorage {
  // Plan operations
  getPlans(): Promise<Plan[]>;
  getPlan(id: string): Promise<Plan | undefined>;
  getPlanBySlug(slug: string): Promise<Plan | undefined>;
  createPlan(plan: InsertPlan): Promise<Plan>;
  updatePlan(id: string, plan: Partial<InsertPlan>): Promise<Plan | undefined>;
  deletePlan(id: string): Promise<void>;
  
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserVerification(id: string, isVerified: boolean): Promise<User | undefined>;
  updateUserPlan(userId: string, planId: string): Promise<User | undefined>;
  updateUserAdmin(userId: string, isAdmin: boolean): Promise<User | undefined>;
  
  // Category operations
  getCategories(): Promise<Category[]>;
  getCategoryBySlug(slug: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  
  // Service operations
  getServices(filters?: {
    categoryId?: string;
    ownerId?: string;
    status?: string;
    search?: string;
  }): Promise<Array<Service & { owner: User; category: Category; rating: number; reviewCount: number }>>;
  getService(id: string): Promise<(Service & { owner: User; category: Category; rating: number; reviewCount: number }) | undefined>;
  createService(service: InsertService): Promise<Service>;
  updateService(id: string, service: Partial<InsertService>): Promise<Service | undefined>;
  deleteService(id: string): Promise<void>;
  incrementViewCount(id: string): Promise<void>;
  renewService(id: string): Promise<Service | undefined>;
  expireOldServices(): Promise<void>;
  
  // Review operations
  getReviewsForService(serviceId: string): Promise<Array<Review & { user: User }>>;
  createReview(review: InsertReview): Promise<Review>;
  
  // Favorites operations
  getUserFavorites(userId: string): Promise<Array<Favorite & { service: Service & { owner: User; category: Category } }>>;
  addFavorite(userId: string, serviceId: string): Promise<Favorite>;
  removeFavorite(userId: string, serviceId: string): Promise<void>;
  isFavorite(userId: string, serviceId: string): Promise<boolean>;

  // Category suggestion operations
  submitCategory(category: InsertSubmittedCategory): Promise<SubmittedCategory>;
  getCategorySuggestions(status?: string): Promise<Array<SubmittedCategory & { user: User }>>;
  updateCategorySuggestionStatus(id: string, status: string): Promise<SubmittedCategory | undefined>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserVerification(id: string, isVerified: boolean): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ isVerified, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  // Category operations
  async getCategories(): Promise<Category[]> {
    return await db.select().from(categories);
  }

  async getCategoryBySlug(slug: string): Promise<Category | undefined> {
    const [category] = await db.select().from(categories).where(eq(categories.slug, slug));
    return category;
  }

  async createCategory(category: InsertCategory): Promise<Category> {
    const [newCategory] = await db.insert(categories).values(category).returning();
    return newCategory;
  }

  // Service operations
  async getServices(filters?: {
    categoryId?: string;
    ownerId?: string;
    status?: string;
    search?: string;
  }): Promise<Array<Service & { owner: User; category: Category; rating: number; reviewCount: number }>> {
    let query = db
      .select({
        service: services,
        owner: users,
        category: categories,
        rating: sql<number>`COALESCE(AVG(${reviews.rating}), 0)`,
        reviewCount: sql<number>`COUNT(${reviews.id})`,
      })
      .from(services)
      .leftJoin(users, eq(services.ownerId, users.id))
      .leftJoin(categories, eq(services.categoryId, categories.id))
      .leftJoin(reviews, eq(services.id, reviews.serviceId))
      .groupBy(services.id, users.id, categories.id)
      .orderBy(desc(services.createdAt))
      .$dynamic();

    const conditions = [];
    
    if (filters?.categoryId) {
      conditions.push(eq(services.categoryId, filters.categoryId));
    }
    
    if (filters?.ownerId) {
      conditions.push(eq(services.ownerId, filters.ownerId));
    }
    
    if (filters?.status) {
      conditions.push(eq(services.status, filters.status as any));
    }
    
    if (filters?.search) {
      conditions.push(
        or(
          ilike(services.title, `%${filters.search}%`),
          ilike(services.description, `%${filters.search}%`)
        )
      );
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    const results = await query;
    
    return results.map((row) => ({
      ...row.service,
      owner: row.owner!,
      category: row.category!,
      rating: Number(row.rating) || 0,
      reviewCount: Number(row.reviewCount) || 0,
    }));
  }

  async getService(id: string): Promise<(Service & { owner: User; category: Category; rating: number; reviewCount: number }) | undefined> {
    const results = await db
      .select({
        service: services,
        owner: users,
        category: categories,
        rating: sql<number>`COALESCE(AVG(${reviews.rating}), 0)`,
        reviewCount: sql<number>`COUNT(${reviews.id})`,
      })
      .from(services)
      .leftJoin(users, eq(services.ownerId, users.id))
      .leftJoin(categories, eq(services.categoryId, categories.id))
      .leftJoin(reviews, eq(services.id, reviews.serviceId))
      .where(eq(services.id, id))
      .groupBy(services.id, users.id, categories.id);

    if (results.length === 0) return undefined;

    const row = results[0];
    return {
      ...row.service,
      owner: row.owner!,
      category: row.category!,
      rating: Number(row.rating) || 0,
      reviewCount: Number(row.reviewCount) || 0,
    };
  }

  async createService(service: InsertService): Promise<Service> {
    const [newService] = await db.insert(services).values(service).returning();
    return newService;
  }

  async updateService(id: string, service: Partial<InsertService>): Promise<Service | undefined> {
    const [updated] = await db
      .update(services)
      .set({ ...service, updatedAt: new Date() })
      .where(eq(services.id, id))
      .returning();
    return updated;
  }

  async deleteService(id: string): Promise<void> {
    await db.delete(services).where(eq(services.id, id));
  }

  async incrementViewCount(id: string): Promise<void> {
    await db
      .update(services)
      .set({ viewCount: sql`${services.viewCount} + 1` })
      .where(eq(services.id, id));
  }

  async renewService(id: string): Promise<Service | undefined> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 14);
    
    const [renewed] = await db
      .update(services)
      .set({ 
        expiresAt,
        status: "active",
        updatedAt: new Date(),
      })
      .where(eq(services.id, id))
      .returning();
    return renewed;
  }

  async expireOldServices(): Promise<void> {
    await db
      .update(services)
      .set({ status: "expired", updatedAt: new Date() })
      .where(
        and(
          sql`${services.expiresAt} < NOW()`,
          sql`${services.status} = 'active'`
        )
      );
  }

  // Review operations
  async getReviewsForService(serviceId: string): Promise<Array<Review & { user: User }>> {
    const results = await db
      .select({
        review: reviews,
        user: users,
      })
      .from(reviews)
      .leftJoin(users, eq(reviews.userId, users.id))
      .where(eq(reviews.serviceId, serviceId))
      .orderBy(desc(reviews.createdAt));

    return results.map((row) => ({
      ...row.review,
      user: row.user!,
    }));
  }

  async createReview(review: InsertReview): Promise<Review> {
    const [newReview] = await db.insert(reviews).values(review).returning();
    return newReview;
  }

  // Favorites operations
  async getUserFavorites(userId: string): Promise<Array<Favorite & { service: Service & { owner: User; category: Category } }>> {
    const results = await db
      .select({
        favorite: favorites,
        service: services,
        owner: users,
        category: categories,
      })
      .from(favorites)
      .leftJoin(services, eq(favorites.serviceId, services.id))
      .leftJoin(users, eq(services.ownerId, users.id))
      .leftJoin(categories, eq(services.categoryId, categories.id))
      .where(eq(favorites.userId, userId))
      .orderBy(desc(favorites.createdAt));

    return results.map((row) => ({
      ...row.favorite,
      service: {
        ...row.service!,
        owner: row.owner!,
        category: row.category!,
      },
    }));
  }

  async addFavorite(userId: string, serviceId: string): Promise<Favorite> {
    const [favorite] = await db
      .insert(favorites)
      .values({ userId, serviceId })
      .returning();
    return favorite;
  }

  async removeFavorite(userId: string, serviceId: string): Promise<void> {
    await db
      .delete(favorites)
      .where(
        and(
          eq(favorites.userId, userId),
          eq(favorites.serviceId, serviceId)
        )
      );
  }

  async isFavorite(userId: string, serviceId: string): Promise<boolean> {
    const [result] = await db
      .select()
      .from(favorites)
      .where(
        and(
          eq(favorites.userId, userId),
          eq(favorites.serviceId, serviceId)
        )
      );
    return !!result;
  }

  // Category suggestion operations
  async submitCategory(category: InsertSubmittedCategory): Promise<SubmittedCategory> {
    const [submittedCategory] = await db
      .insert(submittedCategories)
      .values(category)
      .returning();
    return submittedCategory;
  }

  async getCategorySuggestions(status?: string): Promise<Array<SubmittedCategory & { user: User }>> {
    let query = db
      .select({
        suggestion: submittedCategories,
        user: users,
      })
      .from(submittedCategories)
      .leftJoin(users, eq(submittedCategories.userId, users.id))
      .orderBy(desc(submittedCategories.createdAt))
      .$dynamic();

    if (status) {
      query = query.where(eq(submittedCategories.status, status as any));
    }

    const results = await query;
    return results.map((row) => ({
      ...row.suggestion,
      user: row.user!,
    }));
  }

  async updateCategorySuggestionStatus(id: string, status: string): Promise<SubmittedCategory | undefined> {
    const [updatedSuggestion] = await db
      .update(submittedCategories)
      .set({ status: status as any })
      .where(eq(submittedCategories.id, id))
      .returning();
    return updatedSuggestion;
  }

  // Plan operations
  async getPlans(): Promise<Plan[]> {
    return await db.select().from(plans).orderBy(plans.sortOrder);
  }

  async getPlan(id: string): Promise<Plan | undefined> {
    const [plan] = await db.select().from(plans).where(eq(plans.id, id));
    return plan;
  }

  async getPlanBySlug(slug: string): Promise<Plan | undefined> {
    const [plan] = await db.select().from(plans).where(eq(plans.slug, slug));
    return plan;
  }

  async createPlan(plan: InsertPlan): Promise<Plan> {
    const [newPlan] = await db.insert(plans).values(plan).returning();
    return newPlan;
  }

  async updatePlan(id: string, planData: Partial<InsertPlan>): Promise<Plan | undefined> {
    const [updatedPlan] = await db
      .update(plans)
      .set({ ...planData, updatedAt: new Date() })
      .where(eq(plans.id, id))
      .returning();
    return updatedPlan;
  }

  async deletePlan(id: string): Promise<void> {
    await db.delete(plans).where(eq(plans.id, id));
  }

  async updateUserPlan(userId: string, planId: string): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ planId, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateUserAdmin(userId: string, isAdmin: boolean): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ isAdmin, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }
}

export const storage = new DatabaseStorage();
