import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertServiceSchema, insertReviewSchema, insertCategorySchema } from "@shared/schema";
import { categorizeService } from "./aiService";
import { fromZodError } from "zod-validation-error";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";

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
  app.get('/api/categories', async (_req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
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

  const httpServer = createServer(app);
  return httpServer;
}
