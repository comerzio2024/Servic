import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { users } from "@shared/schema";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { isAdmin, adminLogin, adminLogout, getAdminSession } from "./adminAuth";
import { 
  insertServiceSchema, 
  insertReviewSchema, 
  insertCategorySchema, 
  insertSubmittedCategorySchema, 
  insertPlanSchema,
  insertServiceContactSchema,
  insertTemporaryCategorySchema,
  insertAiConversationSchema,
  insertAddressSchema,
} from "@shared/schema";
import { categorizeService } from "./aiService";
import { getAdminAssistance } from "./aiAdminService";
import { getUserSupport } from "./aiUserSupportService";
import { validateCategoryName, suggestCategoryAlternative } from "./aiCategoryService";
import { 
  analyzeImagesForHashtags, 
  generateServiceTitle, 
  generateServiceDescription, 
  generatePricingSuggestion 
} from "./aiContentService";
import { validateSwissAddress } from "./swissAddressService";
import { sendVerificationCode } from "./contactVerificationService";
import { fromZodError } from "zod-validation-error";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // User profile routes
  app.patch('/api/users/me', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { firstName, lastName, phoneNumber } = req.body;
      
      const updateData: { firstName?: string; lastName?: string; phoneNumber?: string } = {};
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
      
      const user = await storage.updateUserProfile(userId, updateData);
      res.json(user);
    } catch (error) {
      console.error("Error updating user profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Address routes
  app.get('/api/users/me/addresses', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const addresses = await storage.getAddresses(userId);
      res.json(addresses);
    } catch (error) {
      console.error("Error fetching addresses:", error);
      res.status(500).json({ message: "Failed to fetch addresses" });
    }
  });

  app.post('/api/users/me/addresses', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validated = insertAddressSchema.parse(req.body);
      const address = await storage.createAddress(userId, validated);
      res.status(201).json(address);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error creating address:", error);
      res.status(500).json({ message: "Failed to create address" });
    }
  });

  app.patch('/api/users/me/addresses/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const addressId = req.params.id;
      const validated = insertAddressSchema.partial().parse(req.body);
      const address = await storage.updateAddress(addressId, userId, validated);
      res.json(address);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      if (error.message === "Address not found or unauthorized") {
        return res.status(404).json({ message: error.message });
      }
      console.error("Error updating address:", error);
      res.status(500).json({ message: "Failed to update address" });
    }
  });

  app.delete('/api/users/me/addresses/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const addressId = req.params.id;
      await storage.deleteAddress(addressId, userId);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting address:", error);
      res.status(500).json({ message: "Failed to delete address" });
    }
  });

  // Object storage routes (referenced from blueprint:javascript_object_storage)
  app.get("/objects/:objectPath(*)", async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error downloading object:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  app.post("/api/objects/upload", isAuthenticated, async (_req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  app.post("/api/service-images", isAuthenticated, async (req: any, res) => {
    if (!req.body.imageURL) {
      return res.status(400).json({ error: "imageURL is required" });
    }

    const userId = req.user.claims.sub;

    try {
      const objectStorageService = new ObjectStorageService();
      const objectPath = await objectStorageService.trySetObjectEntityAclPolicy(
        req.body.imageURL,
        {
          owner: userId,
          visibility: "public",
        },
      );

      res.status(200).json({ objectPath });
    } catch (error) {
      console.error("Error setting service image ACL:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Category routes
  app.get('/api/categories', async (req: any, res) => {
    try {
      const categories = await storage.getCategories();
      
      // Include temporary categories for authenticated users
      if (req.isAuthenticated && req.isAuthenticated()) {
        const userId = req.user.claims.sub;
        const tempCategories = await storage.getTemporaryCategories(userId);
        
        // Format temporary categories to match category structure
        const formattedTempCategories = tempCategories.map(tc => ({
          id: tc.id,
          name: `${tc.name} (Temporary)`,
          slug: tc.slug,
          icon: tc.icon,
          createdAt: tc.createdAt,
          isTemporary: true,
          expiresAt: tc.expiresAt,
        }));
        
        // Combine permanent and temporary categories
        const allCategories = [...categories, ...formattedTempCategories];
        res.json(allCategories);
      } else {
        res.json(categories);
      }
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  app.post('/api/categories', isAuthenticated, async (req, res) => {
    try {
      const validated = insertCategorySchema.parse(req.body);
      const category = await storage.createCategory(validated);
      res.status(201).json(category);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error creating category:", error);
      res.status(500).json({ message: "Failed to create category" });
    }
  });

  app.post('/api/categories/suggest', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validated = insertSubmittedCategorySchema.parse({
        ...req.body,
        userId,
      });
      const submittedCategory = await storage.submitCategory(validated);
      res.status(201).json(submittedCategory);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error submitting category suggestion:", error);
      res.status(500).json({ message: "Failed to submit category suggestion" });
    }
  });

  app.get('/api/categories/new-service-counts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      // Capture timestamp BEFORE querying to avoid race conditions
      const currentVisitTime = new Date();
      
      // Get counts using the OLD timestamp (user.lastHomeVisitAt)
      const counts = await storage.getNewServiceCountsSince(
        userId, 
        user?.lastHomeVisitAt || null
      );
      
      // Update to the CAPTURED timestamp (not new Date()!)
      await storage.updateUserLastHomeVisit(userId, currentVisitTime);
      
      res.json(counts);
    } catch (error) {
      console.error("Error fetching new service counts:", error);
      res.status(500).json({ message: "Failed to fetch new service counts" });
    }
  });

  // Plan routes
  app.get('/api/plans', async (_req, res) => {
    try {
      const plans = await storage.getPlans();
      res.json(plans);
    } catch (error) {
      console.error("Error fetching plans:", error);
      res.status(500).json({ message: "Failed to fetch plans" });
    }
  });

  app.get('/api/plans/:id', async (req, res) => {
    try {
      const plan = await storage.getPlan(req.params.id);
      if (!plan) {
        return res.status(404).json({ message: "Plan not found" });
      }
      res.json(plan);
    } catch (error) {
      console.error("Error fetching plan:", error);
      res.status(500).json({ message: "Failed to fetch plan" });
    }
  });

  // Service routes
  app.get('/api/services/search', async (req, res) => {
    try {
      const { q, limit = '5' } = req.query;
      if (!q || typeof q !== 'string') {
        return res.json([]);
      }

      const services = await storage.getServices({
        search: q,
        status: 'active',
      });

      const limitNum = parseInt(limit as string, 10);
      const results = services.slice(0, limitNum).map(service => ({
        id: service.id,
        title: service.title,
        category: service.category?.name || 'Uncategorized',
        price: service.price,
        priceUnit: service.priceUnit,
      }));

      res.json(results);
    } catch (error) {
      console.error("Error searching services:", error);
      res.status(500).json({ message: "Failed to search services" });
    }
  });

  app.get('/api/services/hashtag/:hashtag', async (req, res) => {
    try {
      const { hashtag } = req.params;
      const services = await storage.getServicesByHashtag(hashtag);
      res.json(services);
    } catch (error) {
      console.error("Error fetching services by hashtag:", error);
      res.status(500).json({ message: "Failed to fetch services by hashtag" });
    }
  });

  app.get('/api/services', async (req, res) => {
    try {
      const { categoryId, ownerId, status, search } = req.query;
      const services = await storage.getServices({
        categoryId: categoryId as string | undefined,
        ownerId: ownerId as string | undefined,
        status: status as string | undefined,
        search: search as string | undefined,
      });
      res.json(services);
    } catch (error) {
      console.error("Error fetching services:", error);
      res.status(500).json({ message: "Failed to fetch services" });
    }
  });

  app.get('/api/services/:id', async (req, res) => {
    try {
      const service = await storage.getService(req.params.id);
      if (!service) {
        return res.status(404).json({ message: "Service not found" });
      }
      // Increment view count
      await storage.incrementViewCount(req.params.id);
      res.json(service);
    } catch (error) {
      console.error("Error fetching service:", error);
      res.status(500).json({ message: "Failed to fetch service" });
    }
  });

  app.post('/api/services', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate request
      const validated = insertServiceSchema.parse(req.body);

      // AI-powered categorization if not provided
      let categoryId = validated.categoryId;
      if (!categoryId) {
        const suggestion = await categorizeService(validated.title, validated.description);
        const category = await storage.getCategoryBySlug(suggestion.categorySlug);
        if (category) {
          categoryId = category.id;
        }
      }

      // Set expiry date (14 days from now)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 14);

      const service = await storage.createService({
        ...validated,
        categoryId,
        ownerId: userId,
        expiresAt,
      });

      res.status(201).json(service);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error creating service:", error);
      res.status(500).json({ message: "Failed to create service" });
    }
  });

  app.patch('/api/services/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Check ownership
      const existing = await storage.getService(req.params.id);
      if (!existing) {
        return res.status(404).json({ message: "Service not found" });
      }
      if (existing.ownerId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const service = await storage.updateService(req.params.id, req.body);
      res.json(service);
    } catch (error) {
      console.error("Error updating service:", error);
      res.status(500).json({ message: "Failed to update service" });
    }
  });

  app.delete('/api/services/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Check ownership
      const existing = await storage.getService(req.params.id);
      if (!existing) {
        return res.status(404).json({ message: "Service not found" });
      }
      if (existing.ownerId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      await storage.deleteService(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting service:", error);
      res.status(500).json({ message: "Failed to delete service" });
    }
  });

  app.post('/api/services/:id/renew', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Check ownership
      const existing = await storage.getService(req.params.id);
      if (!existing) {
        return res.status(404).json({ message: "Service not found" });
      }
      if (existing.ownerId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const service = await storage.renewService(req.params.id);
      res.json(service);
    } catch (error) {
      console.error("Error renewing service:", error);
      res.status(500).json({ message: "Failed to renew service" });
    }
  });

  // Review routes
  app.get('/api/services/:id/reviews', async (req, res) => {
    try {
      const reviews = await storage.getReviewsForService(req.params.id);
      res.json(reviews);
    } catch (error) {
      console.error("Error fetching reviews:", error);
      res.status(500).json({ message: "Failed to fetch reviews" });
    }
  });

  app.post('/api/services/:id/reviews', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (!user?.isVerified) {
        return res.status(403).json({ message: "Identity verification required to post reviews" });
      }

      const validated = insertReviewSchema.parse(req.body);
      const review = await storage.createReview({
        ...validated,
        serviceId: req.params.id,
        userId,
      });

      res.status(201).json(review);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error creating review:", error);
      res.status(500).json({ message: "Failed to create review" });
    }
  });

  // Favorites routes
  app.get('/api/favorites', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const favorites = await storage.getUserFavorites(userId);
      res.json(favorites);
    } catch (error) {
      console.error("Error fetching favorites:", error);
      res.status(500).json({ message: "Failed to fetch favorites" });
    }
  });

  app.post('/api/favorites/:serviceId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const favorite = await storage.addFavorite(userId, req.params.serviceId);
      res.status(201).json(favorite);
    } catch (error) {
      console.error("Error adding favorite:", error);
      res.status(500).json({ message: "Failed to add favorite" });
    }
  });

  app.delete('/api/favorites/:serviceId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.removeFavorite(userId, req.params.serviceId);
      res.status(204).send();
    } catch (error) {
      console.error("Error removing favorite:", error);
      res.status(500).json({ message: "Failed to remove favorite" });
    }
  });

  app.get('/api/favorites/:serviceId/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const isFavorite = await storage.isFavorite(userId, req.params.serviceId);
      res.json({ isFavorite });
    } catch (error) {
      console.error("Error checking favorite status:", error);
      res.status(500).json({ message: "Failed to check favorite status" });
    }
  });

  // User verification routes
  app.post('/api/user/verify', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      // In a real app, this would involve actual verification process
      // For now, we'll simulate it
      const user = await storage.updateUserVerification(userId, true);
      res.json(user);
    } catch (error) {
      console.error("Error verifying user:", error);
      res.status(500).json({ message: "Failed to verify user" });
    }
  });


  // Cron job endpoint to expire old services (would be called by scheduler)
  app.post('/api/cron/expire-services', async (_req, res) => {
    try {
      await storage.expireOldServices();
      res.json({ message: "Services expired successfully" });
    } catch (error) {
      console.error("Error expiring services:", error);
      res.status(500).json({ message: "Failed to expire services" });
    }
  });

  // Admin authentication routes
  app.post('/api/admin/login', adminLogin);
  app.post('/api/admin/logout', adminLogout);
  app.get('/api/admin/session', getAdminSession);

  // Admin user management routes
  app.get('/api/admin/users', isAdmin, async (_req, res) => {
    try {
      const allUsers = await db.select().from(users);
      res.json(allUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.patch('/api/admin/users/:id', isAdmin, async (req, res) => {
    try {
      const { isAdmin: adminFlag, planId } = req.body;
      
      if (adminFlag !== undefined) {
        await storage.updateUserAdmin(req.params.id, adminFlag);
      }
      
      if (planId !== undefined) {
        await storage.updateUserPlan(req.params.id, planId);
      }
      
      const user = await storage.getUser(req.params.id);
      res.json(user);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Admin service management routes
  app.get('/api/admin/services', isAdmin, async (_req, res) => {
    try {
      const services = await storage.getServices();
      res.json(services);
    } catch (error) {
      console.error("Error fetching services:", error);
      res.status(500).json({ message: "Failed to fetch services" });
    }
  });

  app.delete('/api/admin/services/:id', isAdmin, async (req, res) => {
    try {
      await storage.deleteService(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting service:", error);
      res.status(500).json({ message: "Failed to delete service" });
    }
  });

  // Admin category management routes
  app.get('/api/admin/category-suggestions', isAdmin, async (req, res) => {
    try {
      const { status } = req.query;
      const suggestions = await storage.getCategorySuggestions(status as string | undefined);
      res.json(suggestions);
    } catch (error) {
      console.error("Error fetching category suggestions:", error);
      res.status(500).json({ message: "Failed to fetch category suggestions" });
    }
  });

  app.patch('/api/admin/category-suggestions/:id', isAdmin, async (req, res) => {
    try {
      const { status } = req.body;
      const suggestion = await storage.updateCategorySuggestionStatus(req.params.id, status);
      
      // If approved, create the category
      if (status === 'approved' && suggestion) {
        await storage.createCategory({
          name: suggestion.name,
          slug: suggestion.name.toLowerCase().replace(/\s+/g, '-'),
        });
      }
      
      res.json(suggestion);
    } catch (error) {
      console.error("Error updating category suggestion:", error);
      res.status(500).json({ message: "Failed to update category suggestion" });
    }
  });

  // Admin plan management routes
  app.post('/api/admin/plans', isAdmin, async (req, res) => {
    try {
      const validated = insertPlanSchema.parse(req.body);
      const plan = await storage.createPlan(validated);
      res.status(201).json(plan);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error creating plan:", error);
      res.status(500).json({ message: "Failed to create plan" });
    }
  });

  app.patch('/api/admin/plans/:id', isAdmin, async (req, res) => {
    try {
      const plan = await storage.updatePlan(req.params.id, req.body);
      res.json(plan);
    } catch (error) {
      console.error("Error updating plan:", error);
      res.status(500).json({ message: "Failed to update plan" });
    }
  });

  app.delete('/api/admin/plans/:id', isAdmin, async (req, res) => {
    try {
      await storage.deletePlan(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting plan:", error);
      res.status(500).json({ message: "Failed to delete plan" });
    }
  });

  // AI Routes
  app.post('/api/ai/admin-assist', isAdmin, async (req, res) => {
    try {
      const schema = z.object({
        query: z.string().min(1, "Query is required"),
        context: z.object({
          currentPage: z.string().optional(),
          recentActions: z.array(z.string()).optional(),
          platformStats: z.any().optional(),
        }).optional(),
        conversationHistory: z.array(z.object({
          role: z.enum(["user", "assistant", "system"]),
          content: z.string(),
        })).optional(),
      });

      const validated = schema.parse(req.body);
      const response = await getAdminAssistance(validated);
      res.json({ response });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error getting admin assistance:", error);
      res.status(500).json({ message: "Failed to get AI assistance" });
    }
  });

  app.post('/api/ai/user-support', async (req: any, res) => {
    try {
      const schema = z.object({
        query: z.string().min(1, "Query is required"),
        userContext: z.object({
          isAuthenticated: z.boolean(),
          hasServices: z.boolean().optional(),
          plan: z.string().optional(),
        }).optional(),
        pageContext: z.object({
          currentPage: z.string(),
          currentAction: z.string(),
          formData: z.object({
            hasTitle: z.boolean().optional(),
            hasDescription: z.boolean().optional(),
            hasCategory: z.boolean().optional(),
            hasImages: z.boolean().optional(),
            hasLocation: z.boolean().optional(),
            hasContact: z.boolean().optional(),
            hasPrice: z.boolean().optional(),
            imageCount: z.number().optional(),
          }).optional(),
        }).optional(),
        conversationHistory: z.array(z.object({
          role: z.enum(["user", "assistant", "system"]),
          content: z.string(),
        })).optional(),
      });

      const validated = schema.parse(req.body);
      
      // Enhance user context if authenticated
      if (req.isAuthenticated && req.isAuthenticated()) {
        const userId = req.user.claims.sub;
        const user = await storage.getUser(userId);
        const userServices = await storage.getServices({ ownerId: userId });
        
        validated.userContext = {
          isAuthenticated: true,
          hasServices: userServices.length > 0,
          plan: user?.plan?.name,
        };
      } else {
        validated.userContext = {
          isAuthenticated: false,
        };
      }

      const response = await getUserSupport(validated);
      res.json({ response });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error getting user support:", error);
      res.status(500).json({ message: "Failed to get AI support" });
    }
  });

  app.post('/api/ai/validate-category', async (req, res) => {
    try {
      const schema = z.object({
        categoryName: z.string().min(1, "Category name is required"),
        description: z.string().optional(),
      });

      const validated = schema.parse(req.body);
      const result = await validateCategoryName(validated.categoryName, validated.description);
      res.json(result);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error validating category:", error);
      res.status(500).json({ message: "Failed to validate category" });
    }
  });

  app.post('/api/ai/suggest-category-alternative', async (req, res) => {
    try {
      const schema = z.object({
        categoryName: z.string().min(1, "Category name is required"),
        userFeedback: z.string().optional(),
      });

      const validated = schema.parse(req.body);
      const suggestions = await suggestCategoryAlternative(validated.categoryName, validated.userFeedback);
      res.json({ suggestions });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error suggesting category alternative:", error);
      res.status(500).json({ message: "Failed to suggest alternatives" });
    }
  });

  // Platform Settings Routes
  app.get('/api/settings', async (_req, res) => {
    try {
      const settings = await storage.getPlatformSettings();
      res.json(settings);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.patch('/api/admin/settings', isAdmin, async (req, res) => {
    try {
      const schema = z.object({
        requireEmailVerification: z.boolean().optional(),
        requirePhoneVerification: z.boolean().optional(),
        enableSwissAddressValidation: z.boolean().optional(),
        enableAiCategoryValidation: z.boolean().optional(),
      });

      const validated = schema.parse(req.body);
      const settings = await storage.updatePlatformSettings(validated);
      res.json(settings);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error updating settings:", error);
      res.status(500).json({ message: "Failed to update settings" });
    }
  });

  app.get('/api/admin/env-status', isAdmin, async (_req, res) => {
    try {
      const status = {
        twilioConfigured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
        emailConfigured: !!(process.env.EMAIL_SERVICE_PROVIDER && process.env.EMAIL_SERVICE_API_KEY),
      };
      res.json(status);
    } catch (error) {
      console.error("Error checking env status:", error);
      res.status(500).json({ message: "Failed to check env status" });
    }
  });

  // Service Contacts Routes
  app.get('/api/services/:serviceId/contacts', async (req, res) => {
    try {
      const contacts = await storage.getServiceContacts(req.params.serviceId);
      res.json(contacts);
    } catch (error) {
      console.error("Error fetching service contacts:", error);
      res.status(500).json({ message: "Failed to fetch contacts" });
    }
  });

  app.post('/api/services/:serviceId/contacts', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Check ownership
      const service = await storage.getService(req.params.serviceId);
      if (!service) {
        return res.status(404).json({ message: "Service not found" });
      }
      if (service.ownerId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const validated = insertServiceContactSchema.parse({
        ...req.body,
        serviceId: req.params.serviceId,
      });

      const contact = await storage.createServiceContact(validated);
      res.status(201).json(contact);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error creating service contact:", error);
      res.status(500).json({ message: "Failed to create contact" });
    }
  });

  app.patch('/api/contacts/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Get contact and check ownership through service
      const contacts = await storage.getServiceContacts('');
      const contact = contacts.find(c => c.id === req.params.id);
      
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      const service = await storage.getService(contact.serviceId);
      if (!service || service.ownerId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const schema = z.object({
        name: z.string().optional(),
        role: z.string().optional(),
        isPrimary: z.boolean().optional(),
      });

      const validated = schema.parse(req.body);
      const updatedContact = await storage.updateServiceContact(req.params.id, validated);
      res.json(updatedContact);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error updating contact:", error);
      res.status(500).json({ message: "Failed to update contact" });
    }
  });

  app.delete('/api/contacts/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Get contact and check ownership through service
      const contacts = await storage.getServiceContacts('');
      const contact = contacts.find(c => c.id === req.params.id);
      
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      const service = await storage.getService(contact.serviceId);
      if (!service || service.ownerId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      await storage.deleteServiceContact(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting contact:", error);
      res.status(500).json({ message: "Failed to delete contact" });
    }
  });

  app.post('/api/contacts/:id/send-verification', async (req, res) => {
    try {
      // Get contact details
      const contacts = await storage.getServiceContacts('');
      const contact = contacts.find(c => c.id === req.params.id);
      
      if (!contact) {
        return res.status(404).json({ message: "Contact not found" });
      }

      // Send verification code
      const { code, expiresAt } = await sendVerificationCode(contact.contactType, contact.value);
      
      // Store code in database
      await storage.updateServiceContact(req.params.id, {
        verificationCode: code,
        verificationExpiresAt: expiresAt,
      });

      res.json({ success: true, message: "Verification code sent" });
    } catch (error) {
      console.error("Error sending verification code:", error);
      res.status(500).json({ message: "Failed to send verification code" });
    }
  });

  app.post('/api/contacts/:id/verify', async (req, res) => {
    try {
      const schema = z.object({
        code: z.string().min(6, "Verification code is required"),
      });

      const validated = schema.parse(req.body);
      const success = await storage.verifyServiceContact(req.params.id, validated.code);
      
      if (success) {
        res.json({ success: true, message: "Contact verified successfully" });
      } else {
        res.status(400).json({ success: false, message: "Invalid or expired verification code" });
      }
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error verifying contact:", error);
      res.status(500).json({ message: "Failed to verify contact" });
    }
  });

  // Temporary Categories Routes
  app.get('/api/temporary-categories', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const tempCategories = await storage.getTemporaryCategories(userId);
      res.json(tempCategories);
    } catch (error) {
      console.error("Error fetching temporary categories:", error);
      res.status(500).json({ message: "Failed to fetch temporary categories" });
    }
  });

  app.post('/api/temporary-categories', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Set expiry to 24 hours from now
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const validated = insertTemporaryCategorySchema.parse({
        ...req.body,
        userId,
        expiresAt,
      });

      const tempCategory = await storage.createTemporaryCategory(validated);
      res.status(201).json(tempCategory);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error creating temporary category:", error);
      res.status(500).json({ message: "Failed to create temporary category" });
    }
  });

  app.delete('/api/temporary-categories/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Check ownership
      const tempCategories = await storage.getTemporaryCategories(userId);
      const tempCategory = tempCategories.find(c => c.id === req.params.id);
      
      if (!tempCategory) {
        return res.status(404).json({ message: "Temporary category not found" });
      }

      await storage.deleteTemporaryCategory(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting temporary category:", error);
      res.status(500).json({ message: "Failed to delete temporary category" });
    }
  });

  // AI Conversations Routes
  app.get('/api/ai/conversations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { type } = req.query;
      const conversations = await storage.getAiConversations(userId, type as string | undefined);
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching AI conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  app.get('/api/ai/conversations/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const conversation = await storage.getAiConversation(req.params.id);
      
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }

      // Check ownership
      if (conversation.userId && conversation.userId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      res.json(conversation);
    } catch (error) {
      console.error("Error fetching AI conversation:", error);
      res.status(500).json({ message: "Failed to fetch conversation" });
    }
  });

  // Address Validation Route
  app.post('/api/validate-address', async (req, res) => {
    try {
      const schema = z.object({
        address: z.string().min(1, "Address is required"),
      });

      const validated = schema.parse(req.body);
      const result = await validateSwissAddress(validated.address);
      res.json(result);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error validating address:", error);
      res.status(500).json({ message: "Failed to validate address" });
    }
  });

  // AI Content Generation Routes
  app.post('/api/ai/suggest-hashtags', isAuthenticated, async (req: any, res) => {
    try {
      const schema = z.object({
        imageUrls: z.array(z.string()).min(1, "At least one image is required"),
      });

      const validated = schema.parse(req.body);
      
      // Filter out invalid URLs silently
      const validUrls = validated.imageUrls.filter(url => {
        try {
          // Check if it's a valid URL or data URL
          return url.startsWith('http') || url.startsWith('data:') || url.startsWith('blob:');
        } catch {
          return false;
        }
      });

      if (validUrls.length === 0) {
        return res.status(400).json({ 
          message: "Unable to analyze images. Please upload images and try again." 
        });
      }

      const hashtags = await analyzeImagesForHashtags(validUrls);
      res.json({ hashtags });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ 
          message: "Unable to analyze images. Please make sure images are uploaded correctly." 
        });
      }
      console.error("Error analyzing images for hashtags:", error);
      res.status(500).json({ 
        message: "We couldn't generate hashtag suggestions at this time. You can add hashtags manually." 
      });
    }
  });

  app.post('/api/ai/generate-title', isAuthenticated, async (req: any, res) => {
    try {
      const schema = z.object({
        imageUrls: z.array(z.string().url()).min(1, "At least one image URL is required"),
        currentTitle: z.string().optional(),
      });

      const validated = schema.parse(req.body);
      const title = await generateServiceTitle(validated.imageUrls, validated.currentTitle);
      res.json({ title });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error generating service title:", error);
      res.status(500).json({ message: "Failed to generate title" });
    }
  });

  app.post('/api/ai/generate-description', isAuthenticated, async (req: any, res) => {
    try {
      const schema = z.object({
        imageUrls: z.array(z.string().url()).min(1, "At least one image URL is required"),
        title: z.string().min(1, "Title is required"),
        category: z.string().optional(),
      });

      const validated = schema.parse(req.body);
      const description = await generateServiceDescription(
        validated.imageUrls,
        validated.title,
        validated.category
      );
      res.json({ description });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error generating service description:", error);
      res.status(500).json({ message: "Failed to generate description" });
    }
  });

  app.post('/api/ai/generate-description-simple', isAuthenticated, async (req: any, res) => {
    try {
      const { generateSimpleServiceDescription } = await import("./aiService.js");
      const schema = z.object({
        title: z.string().min(1, "Title is required"),
        categoryName: z.string().optional(),
      });

      const validated = schema.parse(req.body);
      const description = await generateSimpleServiceDescription(
        validated.title,
        validated.categoryName
      );
      res.json({ description });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error generating service description:", error);
      res.status(500).json({ message: "Failed to generate description" });
    }
  });

  app.post('/api/ai/suggest-pricing', isAuthenticated, async (req: any, res) => {
    try {
      const schema = z.object({
        imageUrls: z.array(z.string().url()).min(1, "At least one image URL is required"),
        title: z.string().min(1, "Title is required"),
        description: z.string().min(1, "Description is required"),
        category: z.string().optional(),
      });

      const validated = schema.parse(req.body);
      const pricingSuggestion = await generatePricingSuggestion(
        validated.imageUrls,
        validated.title,
        validated.description,
        validated.category
      );
      res.json(pricingSuggestion);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error suggesting pricing:", error);
      res.status(500).json({ message: "Failed to suggest pricing" });
    }
  });

  // Hashtag Search Route
  app.get('/api/services/hashtag/:hashtag', async (req, res) => {
    try {
      const { hashtag } = req.params;
      
      if (!hashtag || hashtag.trim().length === 0) {
        return res.status(400).json({ message: "Hashtag is required" });
      }

      const services = await storage.getServicesByHashtag(hashtag.toLowerCase().trim());
      res.json(services);
    } catch (error) {
      console.error("Error searching services by hashtag:", error);
      res.status(500).json({ message: "Failed to search services by hashtag" });
    }
  });

  // User Profile Routes
  app.get('/api/users/:userId', async (req, res) => {
    try {
      const user = await storage.getUserById(req.params.userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { isAdmin, emailVerified, phoneVerified, ...publicProfile } = user;
      res.json(publicProfile);
    } catch (error) {
      console.error("Error fetching user profile:", error);
      res.status(500).json({ message: "Failed to fetch user profile" });
    }
  });

  app.get('/api/users/:userId/services', async (req, res) => {
    try {
      const { includeExpired } = req.query;
      const services = await storage.getUserServices(
        req.params.userId,
        includeExpired === 'true'
      );
      res.json(services);
    } catch (error) {
      console.error("Error fetching user services:", error);
      res.status(500).json({ message: "Failed to fetch user services" });
    }
  });

  app.get('/api/users/:userId/reviews', async (req, res) => {
    try {
      const reviews = await storage.getUserReviews(req.params.userId);
      res.json(reviews);
    } catch (error) {
      console.error("Error fetching user reviews:", error);
      res.status(500).json({ message: "Failed to fetch user reviews" });
    }
  });

  // Location-Based Services Routes
  app.get('/api/location/search', async (req, res) => {
    try {
      const { q, limit = '10' } = req.query;
      
      if (!q || typeof q !== 'string' || q.trim().length < 2) {
        return res.json([]);
      }

      const query = q.trim();
      const limitNum = Math.min(parseInt(limit as string, 10) || 10, 20);

      // Use Nominatim API (OpenStreetMap) for location search
      const encodedQuery = encodeURIComponent(query);
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&limit=${limitNum}&countrycodes=ch&addressdetails=1`;

      const response = await fetch(nominatimUrl, {
        headers: {
          'User-Agent': 'ServiceMarketplace/1.0',
        },
      });

      if (!response.ok) {
        throw new Error('Location search service unavailable');
      }

      const results = await response.json();

      if (!results || results.length === 0) {
        return res.json([]);
      }

      // Format results to include city, postcode, canton
      const formattedResults = results.map((result: any) => {
        const address = result.address || {};
        const city = address.city || address.town || address.village || address.municipality || result.name;
        const postcode = address.postcode || '';
        const canton = address.state || '';
        
        // Create a display name in format: "City, Postcode, Canton"
        const parts = [city, postcode, canton].filter(p => p);
        const displayName = parts.join(', ');
        
        return {
          id: result.place_id,
          displayName,
          city,
          postcode,
          canton,
          fullAddress: result.display_name,
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon),
        };
      });

      res.json(formattedResults);
    } catch (error: any) {
      console.error("Error searching locations:", error);
      res.status(500).json({ message: "Failed to search locations" });
    }
  });

  app.post('/api/geocode', async (req, res) => {
    try {
      const schema = z.object({
        location: z.string().min(1, "Location is required"),
      });

      const validated = schema.parse(req.body);
      const location = validated.location.trim();

      // Use Nominatim API (OpenStreetMap) for geocoding
      const encodedLocation = encodeURIComponent(`${location}, Switzerland`);
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodedLocation}&format=json&limit=1&countrycodes=ch`;

      const response = await fetch(nominatimUrl, {
        headers: {
          'User-Agent': 'ServiceMarketplace/1.0',
        },
      });

      if (!response.ok) {
        throw new Error('Geocoding service unavailable');
      }

      const results = await response.json();

      if (!results || results.length === 0) {
        return res.status(404).json({
          message: "Location not found. Please try a valid Swiss postcode or city name.",
        });
      }

      const result = results[0];
      res.json({
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
        displayName: result.display_name,
        name: result.name,
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error geocoding location:", error);
      res.status(500).json({ message: "Failed to geocode location" });
    }
  });

  app.post('/api/services/nearby', async (req, res) => {
    try {
      const schema = z.object({
        lat: z.number().min(-90).max(90),
        lng: z.number().min(-180).max(180),
        radiusKm: z.number().positive().default(10),
        categoryId: z.string().optional(),
        limit: z.number().positive().max(100).default(20),
      });

      const validated = schema.parse(req.body);
      const services = await storage.getNearbyServices(
        validated.lat,
        validated.lng,
        validated.radiusKm,
        validated.categoryId,
        validated.limit
      );
      res.json(services);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error fetching nearby services:", error);
      res.status(500).json({ message: "Failed to fetch nearby services" });
    }
  });

  app.patch('/api/users/location', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      const schema = z.object({
        locationLat: z.string().optional(),
        locationLng: z.string().optional(),
        preferredLocationName: z.string().max(200).optional(),
        preferredSearchRadiusKm: z.number().positive().max(100).optional(),
      });

      const validated = schema.parse(req.body);
      
      if ((validated.locationLat && !validated.locationLng) || 
          (!validated.locationLat && validated.locationLng)) {
        return res.status(400).json({ 
          message: "Both locationLat and locationLng must be provided together" 
        });
      }

      const user = await storage.updateUserLocation(userId, validated);
      res.json(user);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error updating user location:", error);
      res.status(500).json({ message: "Failed to update user location" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
