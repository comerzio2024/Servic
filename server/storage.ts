import {
  users,
  categories,
  subcategories,
  services,
  reviews,
  favorites,
  submittedCategories,
  plans,
  platformSettings,
  serviceContacts,
  aiConversations,
  temporaryCategories,
  addresses,
  userModerationActions,
  bannedIdentifiers,
  orders,
  servicePricingOptions,
  type User,
  type UserWithPlan,
  type UpsertUser,
  type Category,
  type InsertCategory,
  type Subcategory,
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
  type PlatformSettings,
  type InsertPlatformSettings,
  type ServiceContact,
  type InsertServiceContact,
  type AiConversation,
  type InsertAiConversation,
  type TemporaryCategory,
  type InsertTemporaryCategory,
  type SelectAddress,
  type InsertAddress,
  type UserModerationAction,
  type InsertUserModerationAction,
  type BannedIdentifier,
  type InsertBannedIdentifier,
  type Order,
  type InsertOrder,
  type ServicePricingOption,
  type InsertServicePricingOption,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, ilike, or } from "drizzle-orm";

// Type alias for service with all its relations
export type ServiceWithRelations = Service & {
  owner: User;
  category: Category;
  subcategory: Subcategory | null;
  rating: number;
  reviewCount: number;
};

export interface IStorage {
  // Plan operations
  getPlans(): Promise<Plan[]>;
  getPlan(id: string): Promise<Plan | undefined>;
  getPlanBySlug(slug: string): Promise<Plan | undefined>;
  createPlan(plan: InsertPlan): Promise<Plan>;
  updatePlan(id: string, plan: Partial<InsertPlan>): Promise<Plan | undefined>;
  deletePlan(id: string): Promise<void>;
  
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<UserWithPlan | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserVerification(id: string, isVerified: boolean): Promise<User | undefined>;
  updateUserPlan(userId: string, planId: string): Promise<User | undefined>;
  updateUserAdmin(userId: string, isAdmin: boolean): Promise<User | undefined>;
  updateUserProfile(userId: string, data: { firstName?: string; lastName?: string; phoneNumber?: string; profileImageUrl?: string; locationLat?: number | null; locationLng?: number | null; preferredLocationName?: string }): Promise<User>;
  
  // Address operations
  getAddresses(userId: string): Promise<SelectAddress[]>;
  createAddress(userId: string, data: InsertAddress): Promise<SelectAddress>;
  updateAddress(addressId: string, userId: string, data: Partial<InsertAddress>): Promise<SelectAddress>;
  deleteAddress(addressId: string, userId: string): Promise<void>;
  
  // Category operations
  getCategories(): Promise<Category[]>;
  getCategoryBySlug(slug: string): Promise<Category | undefined>;
  createCategory(category: InsertCategory): Promise<Category>;
  
  // Subcategory operations
  getSubcategories(): Promise<Subcategory[]>;
  getSubcategoriesByCategoryId(categoryId: string): Promise<Subcategory[]>;
  
  // Service operations
  getServices(filters?: {
    categoryId?: string;
    ownerId?: string;
    status?: string;
    search?: string;
  }): Promise<ServiceWithRelations[]>;
  getAllServices(): Promise<Service[]>;
  getService(id: string): Promise<ServiceWithRelations | undefined>;
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
  getUserFavorites(userId: string): Promise<Array<Favorite & { service: ServiceWithRelations }>>;
  addFavorite(userId: string, serviceId: string): Promise<Favorite>;
  removeFavorite(userId: string, serviceId: string): Promise<void>;
  isFavorite(userId: string, serviceId: string): Promise<boolean>;

  // Category suggestion operations
  submitCategory(category: InsertSubmittedCategory): Promise<SubmittedCategory>;
  getCategorySuggestions(status?: string): Promise<Array<SubmittedCategory & { user: User }>>;
  updateCategorySuggestionStatus(id: string, status: string): Promise<SubmittedCategory | undefined>;

  // Platform settings operations
  getPlatformSettings(): Promise<PlatformSettings | undefined>;
  updatePlatformSettings(settings: Partial<InsertPlatformSettings>): Promise<PlatformSettings>;

  // Service contacts operations
  getServiceContacts(serviceId: string): Promise<ServiceContact[]>;
  createServiceContact(contact: InsertServiceContact): Promise<ServiceContact>;
  updateServiceContact(id: string, contact: Partial<InsertServiceContact>): Promise<ServiceContact | undefined>;
  deleteServiceContact(id: string): Promise<void>;
  verifyServiceContact(id: string, code: string): Promise<boolean>;

  // AI conversation operations
  getAiConversation(id: string): Promise<AiConversation | undefined>;
  getAiConversations(userId?: string, type?: string): Promise<AiConversation[]>;
  createAiConversation(conversation: InsertAiConversation): Promise<AiConversation>;
  updateAiConversation(id: string, conversation: Partial<InsertAiConversation>): Promise<AiConversation | undefined>;
  
  // Temporary category operations
  getTemporaryCategories(userId?: string): Promise<TemporaryCategory[]>;
  createTemporaryCategory(category: InsertTemporaryCategory): Promise<TemporaryCategory>;
  deleteTemporaryCategory(id: string): Promise<void>;
  cleanupExpiredTemporaryCategories(): Promise<void>;
  getAllUsers(): Promise<User[]>;
  
  // New user profile operations
  getUserById(userId: string): Promise<UserWithPlan | undefined>;
  getUserServices(userId: string, includeExpired: boolean): Promise<ServiceWithRelations[]>;
  getUserReviews(userId: string): Promise<Array<Review & { user: User; service: ServiceWithRelations }>>;
  
  // Hashtag operations
  getServicesByHashtag(hashtag: string): Promise<ServiceWithRelations[]>;
  
  // Location-based operations
  getNearbyServices(lat: number, lng: number, radiusKm: number, categoryId?: string, limit?: number): Promise<Array<ServiceWithRelations & { distance: number }>>;
  updateUserLocation(userId: string, data: { locationLat?: string; locationLng?: string; preferredLocationName?: string; preferredSearchRadiusKm?: number }): Promise<User | undefined>;
  
  // New services indicator operations
  getNewServiceCountsSince(userId: string, since: Date | null): Promise<Array<{ categoryId: string; newCount: number }>>;
  updateUserLastHomeVisit(userId: string, visitTime?: Date): Promise<void>;
  
  // User moderation operations
  moderateUser(userId: string, action: "warn" | "suspend" | "ban" | "kick" | "reactivate", adminId: string, reason?: string, ipAddress?: string): Promise<User>;
  getUserModerationHistory(userId: string): Promise<UserModerationAction[]>;
  getBannedIdentifiers(): Promise<BannedIdentifier[]>;
  addBannedIdentifier(data: InsertBannedIdentifier): Promise<BannedIdentifier>;
  removeBannedIdentifier(id: string): Promise<void>;
  checkIfBanned(email?: string, phone?: string, ip?: string): Promise<{ isBanned: boolean; reason?: string }>;
  
  // Category CRUD operations (admin)
  updateCategory(id: string, category: Partial<InsertCategory>): Promise<Category | undefined>;
  deleteCategory(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<UserWithPlan | undefined> {
    const results = await db
      .select({
        user: users,
        plan: plans,
      })
      .from(users)
      .leftJoin(plans, eq(users.planId, plans.id))
      .where(eq(users.id, id));
    
    if (results.length === 0) return undefined;
    
    const row = results[0];
    return {
      ...row.user,
      plan: row.plan || undefined,
    };
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const result = await db
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
    return result[0];
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

  // Subcategory operations
  async getSubcategories(): Promise<Subcategory[]> {
    return await db.select().from(subcategories);
  }

  async getSubcategoriesByCategoryId(categoryId: string): Promise<Subcategory[]> {
    return await db.select().from(subcategories).where(eq(subcategories.categoryId, categoryId));
  }

  // Service operations
  async getServices(filters?: {
    categoryId?: string;
    ownerId?: string;
    status?: string;
    search?: string;
  }): Promise<ServiceWithRelations[]> {
    let query = db
      .select({
        service: services,
        owner: users,
        category: categories,
        subcategory: subcategories,
        rating: sql<number>`COALESCE(AVG(${reviews.rating}), 0)`,
        reviewCount: sql<number>`COUNT(${reviews.id})`,
      })
      .from(services)
      .leftJoin(users, eq(services.ownerId, users.id))
      .leftJoin(categories, eq(services.categoryId, categories.id))
      .leftJoin(subcategories, eq(services.subcategoryId, subcategories.id))
      .leftJoin(reviews, eq(services.id, reviews.serviceId))
      .groupBy(services.id, users.id, categories.id, subcategories.id)
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
      subcategory: row.subcategory || null,
      rating: Number(row.rating) || 0,
      reviewCount: Number(row.reviewCount) || 0,
    }));
  }

  async getAllServices(): Promise<Service[]> {
    return await db.select().from(services);
  }

  async getService(id: string): Promise<ServiceWithRelations | undefined> {
    const results = await db
      .select({
        service: services,
        owner: users,
        category: categories,
        subcategory: subcategories,
        rating: sql<number>`COALESCE(AVG(${reviews.rating}), 0)`,
        reviewCount: sql<number>`COUNT(${reviews.id})`,
      })
      .from(services)
      .leftJoin(users, eq(services.ownerId, users.id))
      .leftJoin(categories, eq(services.categoryId, categories.id))
      .leftJoin(subcategories, eq(services.subcategoryId, subcategories.id))
      .leftJoin(reviews, eq(services.id, reviews.serviceId))
      .where(eq(services.id, id))
      .groupBy(services.id, users.id, categories.id, subcategories.id);

    if (results.length === 0) return undefined;

    const row = results[0];
    return {
      ...row.service,
      owner: row.owner!,
      category: row.category!,
      subcategory: row.subcategory || null,
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
  async getUserFavorites(userId: string): Promise<Array<Favorite & { service: ServiceWithRelations }>> {
    const results = await db
      .select({
        favorite: favorites,
        service: services,
        owner: users,
        category: categories,
        subcategory: subcategories,
        rating: sql<number>`COALESCE(AVG(${reviews.rating}), 0)`,
        reviewCount: sql<number>`COUNT(${reviews.id})`,
      })
      .from(favorites)
      .leftJoin(services, eq(favorites.serviceId, services.id))
      .leftJoin(users, eq(services.ownerId, users.id))
      .leftJoin(categories, eq(services.categoryId, categories.id))
      .leftJoin(subcategories, eq(services.subcategoryId, subcategories.id))
      .leftJoin(reviews, eq(services.id, reviews.serviceId))
      .where(eq(favorites.userId, userId))
      .groupBy(favorites.id, services.id, users.id, categories.id, subcategories.id)
      .orderBy(desc(favorites.createdAt));

    return results.map((row) => ({
      ...row.favorite,
      service: {
        ...row.service!,
        owner: row.owner!,
        category: row.category!,
        subcategory: row.subcategory || null,
        rating: Number(row.rating) || 0,
        reviewCount: Number(row.reviewCount) || 0,
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

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(desc(users.createdAt));
  }

  async updateUserProfile(userId: string, data: { firstName?: string; lastName?: string; phoneNumber?: string; profileImageUrl?: string; locationLat?: number | null; locationLng?: number | null; preferredLocationName?: string }): Promise<User> {
    const updateData: any = { updatedAt: new Date() };
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.phoneNumber !== undefined) updateData.phoneNumber = data.phoneNumber;
    if (data.profileImageUrl !== undefined) updateData.profileImageUrl = data.profileImageUrl;
    if (data.locationLat !== undefined) updateData.locationLat = data.locationLat;
    if (data.locationLng !== undefined) updateData.locationLng = data.locationLng;
    if (data.preferredLocationName !== undefined) updateData.preferredLocationName = data.preferredLocationName;
    
    const [user] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  // Address operations
  async getAddresses(userId: string): Promise<SelectAddress[]> {
    return await db
      .select()
      .from(addresses)
      .where(eq(addresses.userId, userId))
      .orderBy(desc(addresses.isPrimary), addresses.createdAt);
  }

  async createAddress(userId: string, data: InsertAddress): Promise<SelectAddress> {
    // If setting as primary, unset all other primary addresses for this user
    if (data.isPrimary) {
      await db
        .update(addresses)
        .set({ isPrimary: false })
        .where(eq(addresses.userId, userId));
    }
    
    const [address] = await db
      .insert(addresses)
      .values({ ...data, userId })
      .returning();
    return address;
  }

  async updateAddress(addressId: string, userId: string, data: Partial<InsertAddress>): Promise<SelectAddress> {
    // If setting as primary, unset all other primary addresses for this user
    if (data.isPrimary) {
      await db
        .update(addresses)
        .set({ isPrimary: false })
        .where(and(
          eq(addresses.userId, userId),
          sql`${addresses.id} != ${addressId}`
        ));
    }
    
    const [address] = await db
      .update(addresses)
      .set({ ...data, updatedAt: new Date() })
      .where(and(
        eq(addresses.id, addressId),
        eq(addresses.userId, userId)
      ))
      .returning();
    
    if (!address) {
      throw new Error("Address not found or unauthorized");
    }
    
    return address;
  }

  async deleteAddress(addressId: string, userId: string): Promise<void> {
    await db
      .delete(addresses)
      .where(and(
        eq(addresses.id, addressId),
        eq(addresses.userId, userId)
      ));
  }

  // Platform settings operations
  async getPlatformSettings(): Promise<PlatformSettings | undefined> {
    const [settings] = await db.select().from(platformSettings).where(eq(platformSettings.id, 'default'));
    if (!settings) {
      const [newSettings] = await db.insert(platformSettings).values({ id: 'default' }).returning();
      return newSettings;
    }
    return settings;
  }

  async updatePlatformSettings(settingsData: Partial<InsertPlatformSettings>): Promise<PlatformSettings> {
    const [settings] = await db
      .insert(platformSettings)
      .values({ id: 'default', ...settingsData, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: platformSettings.id,
        set: { ...settingsData, updatedAt: new Date() },
      })
      .returning();
    return settings;
  }

  // Service contacts operations
  async getServiceContacts(serviceId: string): Promise<ServiceContact[]> {
    return await db
      .select()
      .from(serviceContacts)
      .where(eq(serviceContacts.serviceId, serviceId))
      .orderBy(desc(serviceContacts.isPrimary), serviceContacts.createdAt);
  }

  async createServiceContact(contact: InsertServiceContact): Promise<ServiceContact> {
    const [newContact] = await db.insert(serviceContacts).values(contact).returning();
    return newContact;
  }

  async updateServiceContact(id: string, contactData: Partial<InsertServiceContact>): Promise<ServiceContact | undefined> {
    const [contact] = await db
      .update(serviceContacts)
      .set(contactData)
      .where(eq(serviceContacts.id, id))
      .returning();
    return contact;
  }

  async deleteServiceContact(id: string): Promise<void> {
    await db.delete(serviceContacts).where(eq(serviceContacts.id, id));
  }

  async verifyServiceContact(id: string, code: string): Promise<boolean> {
    return await db.transaction(async (tx) => {
      const [contact] = await tx
        .select()
        .from(serviceContacts)
        .where(and(
          eq(serviceContacts.id, id),
          eq(serviceContacts.verificationCode, code)
        ));
      
      if (!contact || !contact.verificationExpiresAt) return false;
      if (new Date() > contact.verificationExpiresAt) return false;

      await tx
        .update(serviceContacts)
        .set({ isVerified: true, verificationCode: null, verificationExpiresAt: null })
        .where(eq(serviceContacts.id, id));

      return true;
    });
  }

  // AI conversation operations
  async getAiConversation(id: string): Promise<AiConversation | undefined> {
    const [conversation] = await db.select().from(aiConversations).where(eq(aiConversations.id, id));
    return conversation;
  }

  async getAiConversations(userId?: string, type?: string): Promise<AiConversation[]> {
    let query = db.select().from(aiConversations).$dynamic();
    
    if (userId) {
      query = query.where(eq(aiConversations.userId, userId));
    }
    if (type) {
      query = query.where(eq(aiConversations.conversationType, type as any));
    }
    
    return await query.orderBy(desc(aiConversations.updatedAt));
  }

  async createAiConversation(conversation: InsertAiConversation): Promise<AiConversation> {
    const [newConversation] = await db.insert(aiConversations).values(conversation).returning();
    return newConversation;
  }

  async updateAiConversation(id: string, conversationData: Partial<InsertAiConversation>): Promise<AiConversation | undefined> {
    const [conversation] = await db
      .update(aiConversations)
      .set({ ...conversationData, updatedAt: new Date() })
      .where(eq(aiConversations.id, id))
      .returning();
    return conversation;
  }

  // Temporary category operations
  async getTemporaryCategories(userId?: string): Promise<TemporaryCategory[]> {
    let query = db.select().from(temporaryCategories).$dynamic();
    
    if (userId) {
      query = query.where(eq(temporaryCategories.userId, userId));
    }
    
    return await query.where(sql`${temporaryCategories.expiresAt} > now()`).orderBy(temporaryCategories.createdAt);
  }

  async createTemporaryCategory(category: InsertTemporaryCategory): Promise<TemporaryCategory> {
    const [newCategory] = await db.insert(temporaryCategories).values(category).returning();
    return newCategory;
  }

  async deleteTemporaryCategory(id: string): Promise<void> {
    await db.delete(temporaryCategories).where(eq(temporaryCategories.id, id));
  }

  async cleanupExpiredTemporaryCategories(): Promise<void> {
    await db.delete(temporaryCategories).where(sql`${temporaryCategories.expiresAt} <= NOW()`);
  }

  // New user profile operations
  async getUserById(userId: string): Promise<User | undefined> {
    return this.getUser(userId);
  }

  async getUserServices(userId: string, includeExpired: boolean): Promise<ServiceWithRelations[]> {
    const filters: any = { ownerId: userId };
    
    if (!includeExpired) {
      filters.status = 'active';
    }
    
    return this.getServices(filters);
  }

  async getUserReviews(userId: string): Promise<Array<Review & { user: User; service: ServiceWithRelations }>> {
    // First get the user's reviews with basic service info
    const userReviews = await db
      .select()
      .from(reviews)
      .where(eq(reviews.userId, userId))
      .orderBy(desc(reviews.createdAt));

    if (userReviews.length === 0) {
      return [];
    }

    // Get full service details with relations for each review
    const serviceIds = userReviews.map(r => r.serviceId);
    const servicesData = await db
      .select({
        service: services,
        owner: users,
        category: categories,
        subcategory: subcategories,
        rating: sql<number>`COALESCE(AVG(${reviews.rating}), 0)`,
        reviewCount: sql<number>`COUNT(${reviews.id})`,
      })
      .from(services)
      .leftJoin(users, eq(services.ownerId, users.id))
      .leftJoin(categories, eq(services.categoryId, categories.id))
      .leftJoin(subcategories, eq(services.subcategoryId, subcategories.id))
      .leftJoin(reviews, eq(services.id, reviews.serviceId))
      .where(sql`${services.id} = ANY(${serviceIds})`)
      .groupBy(services.id, users.id, categories.id, subcategories.id);

    const servicesMap = new Map(
      servicesData.map(s => [
        s.service.id,
        {
          ...s.service,
          owner: s.owner!,
          category: s.category!,
          subcategory: s.subcategory || null,
          rating: Number(s.rating) || 0,
          reviewCount: Number(s.reviewCount) || 0,
        }
      ])
    );

    // Get user info
    const [reviewUser] = await db.select().from(users).where(eq(users.id, userId));

    return userReviews.map((review) => ({
      ...review,
      user: reviewUser!,
      service: servicesMap.get(review.serviceId)!,
    }));
  }

  // Hashtag operations
  async getServicesByHashtag(hashtag: string): Promise<ServiceWithRelations[]> {
    const results = await db
      .select({
        service: services,
        owner: users,
        category: categories,
        subcategory: subcategories,
        rating: sql<number>`COALESCE(AVG(${reviews.rating}), 0)`,
        reviewCount: sql<number>`COUNT(${reviews.id})`,
      })
      .from(services)
      .leftJoin(users, eq(services.ownerId, users.id))
      .leftJoin(categories, eq(services.categoryId, categories.id))
      .leftJoin(subcategories, eq(services.subcategoryId, subcategories.id))
      .leftJoin(reviews, eq(services.id, reviews.serviceId))
      .where(
        and(
          sql`${hashtag} = ANY(${services.hashtags})`,
          eq(services.status, 'active')
        )
      )
      .groupBy(services.id, users.id, categories.id, subcategories.id)
      .orderBy(desc(services.createdAt));

    return results.map((row) => ({
      ...row.service,
      owner: row.owner!,
      category: row.category!,
      subcategory: row.subcategory || null,
      rating: Number(row.rating) || 0,
      reviewCount: Number(row.reviewCount) || 0,
    }));
  }

  // Location-based operations
  async getNearbyServices(
    lat: number,
    lng: number,
    radiusKm: number,
    categoryId?: string,
    limit: number = 20
  ): Promise<Array<ServiceWithRelations & { distance: number }>> {
    const conditions = [eq(services.status, 'active')];
    
    if (categoryId) {
      conditions.push(eq(services.categoryId, categoryId));
    }

    const results = await db
      .select({
        service: services,
        owner: users,
        category: categories,
        subcategory: subcategories,
        rating: sql<number>`COALESCE(AVG(${reviews.rating}), 0)`,
        reviewCount: sql<number>`COUNT(${reviews.id})`,
      })
      .from(services)
      .leftJoin(users, eq(services.ownerId, users.id))
      .leftJoin(categories, eq(services.categoryId, categories.id))
      .leftJoin(subcategories, eq(services.subcategoryId, subcategories.id))
      .leftJoin(reviews, eq(services.id, reviews.serviceId))
      .where(and(...conditions))
      .groupBy(services.id, users.id, categories.id, subcategories.id);

    const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
      const R = 6371;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return R * c;
    };

    const servicesWithDistance = results
      .map((row) => {
        const ownerLat = row.owner?.locationLat ? parseFloat(row.owner.locationLat as string) : null;
        const ownerLng = row.owner?.locationLng ? parseFloat(row.owner.locationLng as string) : null;

        if (ownerLat === null || ownerLng === null || isNaN(ownerLat) || isNaN(ownerLng)) {
          return null;
        }

        const distance = calculateDistance(lat, lng, ownerLat, ownerLng);

        if (distance > radiusKm) {
          return null;
        }

        return {
          ...row.service,
          owner: row.owner!,
          category: row.category!,
          subcategory: row.subcategory || null,
          rating: Number(row.rating) || 0,
          reviewCount: Number(row.reviewCount) || 0,
          distance: Math.round(distance * 10) / 10,
        };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, limit);

    return servicesWithDistance;
  }

  async updateUserLocation(
    userId: string,
    data: {
      locationLat?: string;
      locationLng?: string;
      preferredLocationName?: string;
      preferredSearchRadiusKm?: number;
    }
  ): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async getNewServiceCountsSince(userId: string, since: Date | null): Promise<Array<{ categoryId: string; newCount: number }>> {
    if (!since) {
      return [];
    }

    const results = await db
      .select({
        categoryId: services.categoryId,
        newCount: sql<number>`COUNT(*)::int`,
      })
      .from(services)
      .where(
        and(
          eq(services.status, 'active'),
          sql`${services.createdAt} > ${since}`,
          sql`${services.ownerId} != ${userId}`
        )
      )
      .groupBy(services.categoryId);

    return results.map((row) => ({
      categoryId: row.categoryId,
      newCount: Number(row.newCount) || 0,
    }));
  }

  async updateUserLastHomeVisit(userId: string, visitTime?: Date): Promise<void> {
    const timestamp = visitTime || new Date();
    
    await db
      .update(users)
      .set({ 
        lastHomeVisitAt: sql`GREATEST(COALESCE(${users.lastHomeVisitAt}, '1970-01-01'::timestamp), ${timestamp}::timestamp)` 
      })
      .where(eq(users.id, userId));
  }

  // User moderation operations
  async moderateUser(
    userId: string,
    action: "warn" | "suspend" | "ban" | "kick" | "reactivate",
    adminId: string,
    reason?: string,
    ipAddress?: string
  ): Promise<User> {
    // Use transaction to ensure atomicity
    return await db.transaction(async (tx) => {
      // Get current user status
      const [user] = await tx.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user) {
        throw new Error("User not found");
      }

      const previousStatus = user.status;
      const newStatus = 
        action === "reactivate" ? "active" :
        action === "warn" ? "warned" :
        action === "suspend" ? "suspended" :
        action === "ban" ? "banned" :
        action === "kick" ? "kicked" :
        "active" as "active" | "warned" | "suspended" | "banned" | "kicked";

      // Update user status
      const [updatedUser] = await tx
        .update(users)
        .set({ 
          status: newStatus as "active" | "warned" | "suspended" | "banned" | "kicked",
          statusReason: reason || null,
          updatedAt: new Date()
        })
        .where(eq(users.id, userId))
        .returning();

      // Log moderation action
      await tx.insert(userModerationActions).values({
        userId,
        adminId,
        action,
        previousStatus,
        newStatus,
        reason,
        ipAddress,
      });

    // If banning or kicking, add identifiers to banned list (with uniqueness check)
    if (action === "ban" || action === "kick") {
      const bannedData: InsertBannedIdentifier[] = [];
      
      if (user.email) {
        // Check if this identifier already exists
        const existing = await tx
          .select()
          .from(bannedIdentifiers)
          .where(
            and(
              eq(bannedIdentifiers.identifierType, "email"),
              eq(bannedIdentifiers.identifierValue, user.email)
            )
          )
          .limit(1);
        
        if (existing.length === 0) {
          bannedData.push({
            identifierType: "email",
            identifierValue: user.email,
            userId,
            bannedBy: adminId,
            reason,
          });
        } else {
          // Reactivate if it was deactivated
          await tx
            .update(bannedIdentifiers)
            .set({ isActive: true, bannedBy: adminId, reason })
            .where(eq(bannedIdentifiers.id, existing[0].id));
        }
      }
      
      if (user.phoneNumber) {
        const existing = await tx
          .select()
          .from(bannedIdentifiers)
          .where(
            and(
              eq(bannedIdentifiers.identifierType, "phone"),
              eq(bannedIdentifiers.identifierValue, user.phoneNumber)
            )
          )
          .limit(1);
        
        if (existing.length === 0) {
          bannedData.push({
            identifierType: "phone",
            identifierValue: user.phoneNumber,
            userId,
            bannedBy: adminId,
            reason,
          });
        } else {
          await tx
            .update(bannedIdentifiers)
            .set({ isActive: true, bannedBy: adminId, reason })
            .where(eq(bannedIdentifiers.id, existing[0].id));
        }
      }
      
      if (ipAddress) {
        const existing = await tx
          .select()
          .from(bannedIdentifiers)
          .where(
            and(
              eq(bannedIdentifiers.identifierType, "ip"),
              eq(bannedIdentifiers.identifierValue, ipAddress)
            )
          )
          .limit(1);
        
        if (existing.length === 0) {
          bannedData.push({
            identifierType: "ip",
            identifierValue: ipAddress,
            userId,
            bannedBy: adminId,
            reason,
          });
        } else {
          await tx
            .update(bannedIdentifiers)
            .set({ isActive: true, bannedBy: adminId, reason })
            .where(eq(bannedIdentifiers.id, existing[0].id));
        }
      }
      
      // Insert new identifiers in batch
      if (bannedData.length > 0) {
        await tx.insert(bannedIdentifiers).values(bannedData);
      }
    }
    
    // If reactivating or suspending (lifting ban), deactivate all banned identifiers for this user
    if (action === "reactivate" || action === "suspend") {
      await tx
        .update(bannedIdentifiers)
        .set({ isActive: false })
        .where(eq(bannedIdentifiers.userId, userId));
    }

      return updatedUser;
    });
  }

  async getUserModerationHistory(userId: string): Promise<any[]> {
    const results = await db
      .select({
        action: userModerationActions,
        admin: users,
      })
      .from(userModerationActions)
      .leftJoin(users, eq(userModerationActions.adminId, users.id))
      .where(eq(userModerationActions.userId, userId))
      .orderBy(desc(userModerationActions.createdAt));
    
    return results.map((row) => ({
      ...row.action,
      adminName: row.admin ? `${row.admin.firstName || ''} ${row.admin.lastName || ''}`.trim() || row.admin.email : 'System',
    }));
  }

  async getBannedIdentifiers(): Promise<BannedIdentifier[]> {
    return await db
      .select()
      .from(bannedIdentifiers)
      .where(eq(bannedIdentifiers.isActive, true))
      .orderBy(desc(bannedIdentifiers.createdAt));
  }

  async addBannedIdentifier(data: InsertBannedIdentifier): Promise<BannedIdentifier> {
    const [banned] = await db.insert(bannedIdentifiers).values(data).returning();
    return banned;
  }

  async removeBannedIdentifier(id: string): Promise<void> {
    await db
      .update(bannedIdentifiers)
      .set({ isActive: false })
      .where(eq(bannedIdentifiers.id, id));
  }

  async checkIfBanned(email?: string, phone?: string, ip?: string): Promise<{ isBanned: boolean; reason?: string }> {
    const conditions = [];
    
    if (email) {
      conditions.push(
        and(
          eq(bannedIdentifiers.identifierType, "email"),
          eq(bannedIdentifiers.identifierValue, email),
          eq(bannedIdentifiers.isActive, true)
        )
      );
    }
    
    if (phone) {
      conditions.push(
        and(
          eq(bannedIdentifiers.identifierType, "phone"),
          eq(bannedIdentifiers.identifierValue, phone),
          eq(bannedIdentifiers.isActive, true)
        )
      );
    }
    
    if (ip) {
      conditions.push(
        and(
          eq(bannedIdentifiers.identifierType, "ip"),
          eq(bannedIdentifiers.identifierValue, ip),
          eq(bannedIdentifiers.isActive, true)
        )
      );
    }

    if (conditions.length === 0) {
      return { isBanned: false };
    }

    const results = await db
      .select()
      .from(bannedIdentifiers)
      .where(or(...conditions))
      .limit(1);

    if (results.length > 0) {
      return { isBanned: true, reason: results[0].reason || undefined };
    }

    return { isBanned: false };
  }

  // Category CRUD operations (admin)
  async updateCategory(id: string, category: Partial<InsertCategory>): Promise<Category | undefined> {
    const [updated] = await db
      .update(categories)
      .set(category)
      .where(eq(categories.id, id))
      .returning();
    return updated;
  }

  async deleteCategory(id: string): Promise<void> {
    await db.delete(categories).where(eq(categories.id, id));
  }

  // ===========================================
  // ORDER METHODS
  // ===========================================

  async createOrder(data: {
    customerId: string;
    serviceId: string;
    pricingOptionId?: string;
    quantity?: number;
    customerNotes?: string;
  }): Promise<Order> {
    // Get service to find vendor and pricing
    const [service] = await db.select().from(services).where(eq(services.id, data.serviceId)).limit(1);
    if (!service) {
      throw new Error('Service not found');
    }

    // Get pricing option if specified
    let unitPrice = service.price ? parseFloat(service.price) : 0;
    let priceLabel = '';
    
    if (data.pricingOptionId) {
      const [option] = await db.select()
        .from(servicePricingOptions)
        .where(eq(servicePricingOptions.id, data.pricingOptionId))
        .limit(1);
      
      if (option) {
        unitPrice = parseFloat(option.price);
        priceLabel = option.label;
      }
    }

    const quantity = data.quantity || 1;
    const subtotal = unitPrice * quantity;
    const platformFee = subtotal * 0.10; // 10% platform fee
    const total = subtotal;

    // Generate order number
    const orderNumber = `ORD${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const [order] = await db.insert(orders)
      .values({
        orderNumber,
        customerId: data.customerId,
        vendorId: service.ownerId,
        serviceId: data.serviceId,
        pricingOptionId: data.pricingOptionId,
        priceLabel,
        unitPrice: unitPrice.toString(),
        quantity,
        subtotal: subtotal.toString(),
        platformFee: platformFee.toString(),
        total: total.toString(),
        customerNotes: data.customerNotes,
        status: 'pending',
        paymentStatus: 'pending',
      })
      .returning();

    return order;
  }

  async getOrderById(id: string): Promise<Order | null> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
    return order || null;
  }

  async getCustomerOrders(customerId: string, status?: string, limit: number = 20, offset: number = 0): Promise<Order[]> {
    let query = db.select().from(orders).where(
      status 
        ? and(eq(orders.customerId, customerId), eq(orders.status, status as any))
        : eq(orders.customerId, customerId)
    )
    .orderBy(desc(orders.createdAt))
    .limit(limit)
    .offset(offset);
    
    return await query;
  }

  async getVendorOrders(vendorId: string, status?: string, limit: number = 20, offset: number = 0): Promise<Order[]> {
    let query = db.select().from(orders).where(
      status 
        ? and(eq(orders.vendorId, vendorId), eq(orders.status, status as any))
        : eq(orders.vendorId, vendorId)
    )
    .orderBy(desc(orders.createdAt))
    .limit(limit)
    .offset(offset);
    
    return await query;
  }

  async updateOrderStatus(id: string, status: string, vendorNotes?: string): Promise<Order | null> {
    const [updated] = await db.update(orders)
      .set({ 
        status: status as any, 
        vendorNotes,
        updatedAt: new Date()
      })
      .where(eq(orders.id, id))
      .returning();
    return updated || null;
  }

  // ===========================================
  // SERVICE PRICING OPTIONS METHODS
  // ===========================================

  async getServicePricingOptions(serviceId: string): Promise<ServicePricingOption[]> {
    return await db.select()
      .from(servicePricingOptions)
      .where(
        and(
          eq(servicePricingOptions.serviceId, serviceId),
          eq(servicePricingOptions.isActive, true)
        )
      )
      .orderBy(servicePricingOptions.sortOrder);
  }

  async getPricingOptionById(id: string): Promise<ServicePricingOption | null> {
    const [option] = await db.select()
      .from(servicePricingOptions)
      .where(eq(servicePricingOptions.id, id))
      .limit(1);
    return option || null;
  }

  async createServicePricingOption(data: InsertServicePricingOption): Promise<ServicePricingOption> {
    const [option] = await db.insert(servicePricingOptions)
      .values(data)
      .returning();
    return option;
  }

  async updateServicePricingOption(id: string, data: Partial<InsertServicePricingOption>): Promise<ServicePricingOption | null> {
    const [updated] = await db.update(servicePricingOptions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(servicePricingOptions.id, id))
      .returning();
    return updated || null;
  }

  async deleteServicePricingOption(id: string): Promise<void> {
    await db.update(servicePricingOptions)
      .set({ isActive: false })
      .where(eq(servicePricingOptions.id, id));
  }
}

export const storage = new DatabaseStorage();
