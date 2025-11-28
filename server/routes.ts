import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { eq, sql } from "drizzle-orm";
import { users, reviews, services, notifications, pushSubscriptions } from "@shared/schema";
import { setupAuth, isAuthenticated, requireEmailVerified } from "./auth";
import { isAdmin, adminLogin, adminLogout, getAdminSession } from "./adminAuth";
import { setupOAuthRoutes } from "./oauthProviders";
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
  referralCodeSchema,
  redeemPointsSchema,
  adminReferralAdjustmentSchema,
  updateReferralConfigSchema,
  referralTransactions,
  pointsLog,
} from "@shared/schema";
import {
  validateReferralCode,
  getOrCreateReferralCode,
  getReferralStatsForUser,
  getDirectReferrals,
  getReferralChain,
  getTopReferrers,
  getReferralSystemStats,
  getReferralConfig,
  updateReferralConfig,
  initializeReferralConfig,
  adminAdjustPoints,
  generateReferralLink,
  processReferralReward,
} from "./referralService";
import {
  getPointsBalance,
  getPointsHistory,
  getPointsSummary,
  redeemPoints,
  awardPoints,
  getPointsLeaderboard,
  calculateDiscountValue,
} from "./pointsService";
import {
  createNotification,
  getNotifications,
  getUnreadCount as getNotificationUnreadCount,
  markAsRead,
  markAllAsRead,
  dismissNotification,
  clearAllNotifications,
  getNotificationPreferences,
  updateNotificationPreferences,
} from "./notificationService";
import {
  initializePushService,
  isPushEnabled,
  getVapidPublicKey,
  registerPushSubscription,
  unregisterPushSubscription,
  getUserSubscriptions,
} from "./pushService";
import { updateNotificationPreferencesSchema, NOTIFICATION_TYPES, type NotificationType } from "@shared/schema";
import {
  isStripeConfigured,
  getStripePublishableKey,
  getOrCreateStripeCustomer,
  createConnectAccount,
  getConnectAccountStatus,
  createPaymentIntent,
  createCheckoutSession,
  constructWebhookEvent,
  handlePaymentSucceeded,
  handlePaymentFailed,
  handleAccountUpdated,
  createRefund,
  PLATFORM_FEE_PERCENTAGE,
} from "./stripeService";
import {
  getVendorAvailabilitySettings,
  upsertVendorAvailabilitySettings,
  getVendorCalendarBlocks,
  createCalendarBlock,
  updateCalendarBlock,
  deleteCalendarBlock,
  getAvailableSlots,
  createBookingRequest,
  acceptBooking,
  rejectBooking,
  proposeAlternative,
  acceptAlternative,
  cancelBooking,
  getCustomerBookings,
  getVendorBookings,
  getBookingById,
  startBooking,
  completeBooking,
  getPendingBookingsCount,
  getQueuePosition,
} from "./bookingService";
import {
  getOrCreateConversation,
  getUserConversations,
  getConversationById,
  sendMessage,
  getMessages,
  markMessagesAsRead,
  getUnreadCount as getChatUnreadCount,
  sendSystemMessage,
  blockConversation,
  getFlaggedConversations,
  clearConversationFlag,
  deleteMessage,
  editMessage,
  moderateMessage,
} from "./chatService";
import { categorizeService } from "./aiService";
import { getAdminAssistance } from "./aiAdminService";
import { getUserSupport } from "./aiUserSupportService";
import { validateCategoryName, suggestCategoryAlternative, findSimilarCategoryName, suggestCategoryAndSubcategory } from "./aiCategoryService";
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
  // Auth middleware and routes
  await setupAuth(app);
  
  // OAuth routes (Google, Twitter, Facebook)
  setupOAuthRoutes(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user!.id;
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
      const userId = req.user!.id;
      const { firstName, lastName, phoneNumber, profileImageUrl, locationLat, locationLng, preferredLocationName } = req.body;
      
      // Validate Swiss phone number if provided
      if (phoneNumber) {
        const swissPhoneRegex = /^\+41\s?(\d{2}\s?\d{3}\s?\d{2}\s?\d{2}|\d{9,11})$/;
        const normalizedPhone = phoneNumber.replace(/\s/g, '');
        if (!swissPhoneRegex.test(normalizedPhone)) {
          return res.status(400).json({ 
            message: "Invalid phone number. Swiss phone numbers must start with +41 (e.g., +41 44 123 4567)" 
          });
        }
      }
      
      // Validate location fields - both must be provided together or neither
      if ((locationLat !== undefined || locationLng !== undefined) && (locationLat === undefined || locationLng === undefined)) {
        return res.status(400).json({ 
          message: "Both latitude and longitude must be provided together" 
        });
      }
      
      const updateData: { firstName?: string; lastName?: string; phoneNumber?: string; profileImageUrl?: string; locationLat?: number | null; locationLng?: number | null; preferredLocationName?: string } = {};
      if (firstName !== undefined) updateData.firstName = firstName;
      if (lastName !== undefined) updateData.lastName = lastName;
      if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
      if (profileImageUrl !== undefined) updateData.profileImageUrl = profileImageUrl;
      if (locationLat !== undefined) updateData.locationLat = locationLat ? parseFloat(locationLat) : null;
      if (locationLng !== undefined) updateData.locationLng = locationLng ? parseFloat(locationLng) : null;
      if (preferredLocationName !== undefined) updateData.preferredLocationName = preferredLocationName;
      
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
      const userId = req.user!.id;
      const addresses = await storage.getAddresses(userId);
      res.json(addresses);
    } catch (error) {
      console.error("Error fetching addresses:", error);
      res.status(500).json({ message: "Failed to fetch addresses" });
    }
  });

  app.post('/api/users/me/addresses', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      const validated = insertAddressSchema.parse(req.body);
      
      // Validate Swiss address
      const fullAddress = `${validated.street}, ${validated.postalCode} ${validated.city}, ${validated.country}`;
      const isValid = await validateSwissAddress(fullAddress);
      
      if (!isValid) {
        return res.status(400).json({ 
          message: "Invalid Swiss address. Please select a validated address from the search suggestions." 
        });
      }
      
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
      const userId = req.user!.id;
      const addressId = req.params.id;
      const validated = insertAddressSchema.partial().parse(req.body);
      
      // Validate Swiss address if address fields are being updated
      if (validated.street || validated.city || validated.postalCode || validated.country) {
        // Get existing address to merge with updates
        const existingAddresses = await storage.getAddresses(userId);
        const existingAddress = existingAddresses.find(a => a.id === addressId);
        
        if (!existingAddress) {
          return res.status(404).json({ message: "Address not found or unauthorized" });
        }
        
        const fullAddress = `${validated.street || existingAddress.street}, ${validated.postalCode || existingAddress.postalCode} ${validated.city || existingAddress.city}, ${validated.country || existingAddress.country}`;
        const isValid = await validateSwissAddress(fullAddress);
        
        if (!isValid) {
          return res.status(400).json({ 
            message: "Invalid Swiss address. Please select a validated address from the search suggestions." 
          });
        }
      }
      
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
      const userId = req.user!.id;
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

    const userId = req.user!.id;

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
        const userId = req.user!.id;
        const tempCategories = await storage.getTemporaryCategories(userId);
        
        // Format temporary categories to match category structure
        const formattedTempCategories = tempCategories.map(tc => ({
          id: tc.id,
          name: tc.name,
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

  // Subcategory routes
  app.get('/api/categories/:categoryId/subcategories', async (req, res) => {
    try {
      const subcategories = await storage.getSubcategoriesByCategoryId(req.params.categoryId);
      res.json(subcategories);
    } catch (error) {
      console.error("Error fetching subcategories:", error);
      res.status(500).json({ message: "Failed to fetch subcategories" });
    }
  });

  app.get('/api/subcategories', async (req, res) => {
    try {
      const subcategories = await storage.getSubcategories();
      res.json(subcategories);
    } catch (error) {
      console.error("Error fetching all subcategories:", error);
      res.status(500).json({ message: "Failed to fetch subcategories" });
    }
  });

  app.post('/api/categories/suggest', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user!.id;
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
      const userId = req.user!.id;
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
      const userId = req.user!.id;
      
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

      // Geocode first location if provided
      let locationLat = null;
      let locationLng = null;
      let preferredLocationName = null;

      if (validated.locations && validated.locations.length > 0) {
        const firstLocation = validated.locations[0];
        try {
          const geocodeUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(firstLocation)}&format=json&countrycodes=ch&limit=1`;
          const geocodeResponse = await fetch(geocodeUrl, {
            headers: { 'User-Agent': 'ServiceMarketplace/1.0' }
          });
          
          if (geocodeResponse.ok) {
            const results = await geocodeResponse.json();
            if (results && results.length > 0) {
              locationLat = parseFloat(results[0].lat);
              locationLng = parseFloat(results[0].lon);
              preferredLocationName = firstLocation;
            }
          }
        } catch (error) {
          console.error('Failed to geocode service location:', error);
        }
      }

      const createdService = await storage.createService({
        ...validated,
        categoryId,
        ownerId: userId,
        expiresAt,
        locationLat: locationLat ? locationLat.toString() : null,
        locationLng: locationLng ? locationLng.toString() : null,
        preferredLocationName,
      });

      // Return enriched service data with all relations including subcategory
      const enrichedService = await storage.getService(createdService.id);
      res.status(201).json(enrichedService);
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
      const userId = req.user!.id;
      
      // Check ownership
      const existing = await storage.getService(req.params.id);
      if (!existing) {
        return res.status(404).json({ message: "Service not found" });
      }
      if (existing.ownerId !== userId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      // Geocode first location if locations are being updated
      let updateData = { ...req.body };
      
      if (req.body.locations && req.body.locations.length > 0) {
        const firstLocation = req.body.locations[0];
        try {
          const geocodeUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(firstLocation)}&format=json&countrycodes=ch&limit=1`;
          const geocodeResponse = await fetch(geocodeUrl, {
            headers: { 'User-Agent': 'ServiceMarketplace/1.0' }
          });
          
          if (geocodeResponse.ok) {
            const results = await geocodeResponse.json();
            if (results && results.length > 0) {
              updateData.locationLat = parseFloat(results[0].lat).toString();
              updateData.locationLng = parseFloat(results[0].lon).toString();
              updateData.preferredLocationName = firstLocation;
            }
          }
        } catch (error) {
          console.error('Failed to geocode service location:', error);
        }
      }

      await storage.updateService(req.params.id, updateData);
      
      // Return enriched service data with all relations including subcategory
      const enrichedService = await storage.getService(req.params.id);
      res.json(enrichedService);
    } catch (error) {
      console.error("Error updating service:", error);
      res.status(500).json({ message: "Failed to update service" });
    }
  });

  app.delete('/api/services/:id', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      
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
      const userId = req.user!.id;
      
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
      const userId = req.user!.id;
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
      const userId = req.user!.id;
      const favorites = await storage.getUserFavorites(userId);
      res.json(favorites);
    } catch (error) {
      console.error("Error fetching favorites:", error);
      res.status(500).json({ message: "Failed to fetch favorites" });
    }
  });

  app.post('/api/favorites/:serviceId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      const favorite = await storage.addFavorite(userId, req.params.serviceId);
      res.status(201).json(favorite);
    } catch (error) {
      console.error("Error adding favorite:", error);
      res.status(500).json({ message: "Failed to add favorite" });
    }
  });

  app.delete('/api/favorites/:serviceId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      await storage.removeFavorite(userId, req.params.serviceId);
      res.status(204).send();
    } catch (error) {
      console.error("Error removing favorite:", error);
      res.status(500).json({ message: "Failed to remove favorite" });
    }
  });

  app.get('/api/favorites/:serviceId/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user!.id;
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
      const userId = req.user!.id;
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

  // User moderation routes
  app.post('/api/admin/users/:id/moderate', isAdmin, async (req: any, res) => {
    try {
      const { action, reason, ipAddress } = req.body;
      const adminId = req.user?.id || 'admin';
      
      if (!['warn', 'suspend', 'ban', 'kick', 'reactivate'].includes(action)) {
        return res.status(400).json({ message: "Invalid moderation action" });
      }

      const user = await storage.moderateUser(
        req.params.id,
        action,
        adminId,
        reason,
        ipAddress
      );
      
      res.json(user);
    } catch (error: any) {
      console.error("Error moderating user:", error);
      res.status(500).json({ message: error.message || "Failed to moderate user" });
    }
  });

  app.get('/api/admin/users/:id/history', isAdmin, async (req, res) => {
    try {
      const history = await storage.getUserModerationHistory(req.params.id);
      res.json(history);
    } catch (error) {
      console.error("Error fetching moderation history:", error);
      res.status(500).json({ message: "Failed to fetch moderation history" });
    }
  });

  // Banned identifiers routes
  app.get('/api/admin/banned-identifiers', isAdmin, async (_req, res) => {
    try {
      const banned = await storage.getBannedIdentifiers();
      res.json(banned);
    } catch (error) {
      console.error("Error fetching banned identifiers:", error);
      res.status(500).json({ message: "Failed to fetch banned identifiers" });
    }
  });

  app.post('/api/admin/banned-identifiers', isAdmin, async (req: any, res) => {
    try {
      const { identifierType, identifierValue, userId, reason } = req.body;
      const adminId = req.user?.id || 'admin';
      
      const banned = await storage.addBannedIdentifier({
        identifierType,
        identifierValue,
        userId,
        bannedBy: adminId,
        reason,
      });
      
      res.status(201).json(banned);
    } catch (error) {
      console.error("Error adding banned identifier:", error);
      res.status(500).json({ message: "Failed to add banned identifier" });
    }
  });

  app.delete('/api/admin/banned-identifiers/:id', isAdmin, async (req, res) => {
    try {
      await storage.removeBannedIdentifier(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error removing banned identifier:", error);
      res.status(500).json({ message: "Failed to remove banned identifier" });
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

  app.patch('/api/admin/services/:id', isAdmin, async (req, res) => {
    try {
      const service = await storage.updateService(req.params.id, req.body);
      res.json(service);
    } catch (error) {
      console.error("Error updating service:", error);
      res.status(500).json({ message: "Failed to update service" });
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

  app.post('/api/admin/geocode-all-services', isAdmin, async (req: any, res) => {
    try {
      const allServices = await storage.getAllServices();
      let geocoded = 0;
      let failed = 0;
      
      for (const service of allServices) {
        if (service.locationLat && service.locationLng) {
          continue;
        }
        
        if (!service.locations || service.locations.length === 0) {
          continue;
        }
        
        const firstLocation = service.locations[0];
        try {
          const geocodeUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(firstLocation)}&format=json&countrycodes=ch&limit=1`;
          const geocodeResponse = await fetch(geocodeUrl, {
            headers: { 'User-Agent': 'ServiceMarketplace/1.0' }
          });
          
          if (geocodeResponse.ok) {
            const results = await geocodeResponse.json();
            if (results && results.length > 0) {
              const locationLat = parseFloat(results[0].lat);
              const locationLng = parseFloat(results[0].lon);
              
              await storage.updateService(service.id, {
                locationLat: locationLat.toString(),
                locationLng: locationLng.toString(),
                preferredLocationName: firstLocation,
              });
              
              geocoded++;
            } else {
              failed++;
            }
          } else {
            failed++;
          }
          
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`Failed to geocode service ${service.id}:`, error);
          failed++;
        }
      }
      
      res.json({ 
        message: "Geocoding complete",
        geocoded,
        failed,
      });
    } catch (error: any) {
      console.error("Error geocoding services:", error);
      res.status(500).json({ message: "Failed to geocode services" });
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

  // Category CRUD routes
  app.patch('/api/admin/categories/:id', isAdmin, async (req, res) => {
    try {
      const validated = insertCategorySchema.partial().parse(req.body);
      const category = await storage.updateCategory(req.params.id, validated);
      res.json(category);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error updating category:", error);
      res.status(500).json({ message: "Failed to update category" });
    }
  });

  app.delete('/api/admin/categories/:id', isAdmin, async (req, res) => {
    try {
      await storage.deleteCategory(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting category:", error);
      res.status(500).json({ message: "Failed to delete category" });
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
        const userId = req.user!.id;
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

  app.post('/api/ai/suggest-category-subcategory', async (req, res) => {
    try {
      const schema = z.object({
        title: z.string().min(1, "Title is required"),
        description: z.string().default(""),
        imageUrls: z.array(z.string()).optional(),
      });

      const validated = schema.parse(req.body);
      const suggestion = await suggestCategoryAndSubcategory(
        validated.title,
        validated.description,
        validated.imageUrls
      );

      const allCategories = await storage.getCategories();
      const category = allCategories.find(c => c.slug === suggestion.categorySlug);

      if (!category) {
        return res.status(404).json({ 
          message: "Suggested category not found",
          suggestion 
        });
      }

      let subcategory = null;
      if (suggestion.subcategoryId) {
        const allSubcategories = await storage.getSubcategories();
        subcategory = allSubcategories.find(s => s.slug === suggestion.subcategoryId);
      }

      res.json({
        categoryId: category.id,
        categorySlug: category.slug,
        categoryName: category.name,
        subcategoryId: subcategory?.id || null,
        subcategorySlug: subcategory?.slug || null,
        subcategoryName: subcategory?.name || null,
        confidence: suggestion.confidence,
      });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error suggesting category and subcategory:", error);
      res.status(500).json({ message: "Failed to suggest category and subcategory" });
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

  app.patch('/api/admin/api-keys', isAdmin, async (req, res) => {
    try {
      const schema = z.object({
        googleMapsApiKey: z.string().optional(),
      });

      const validated = schema.parse(req.body);
      const settings = await storage.updatePlatformSettings(validated);
      res.json({ success: true, message: "API keys updated successfully" });
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error updating API keys:", error);
      res.status(500).json({ message: "Failed to update API keys" });
    }
  });

  app.get('/api/admin/env-status', isAdmin, async (_req, res) => {
    try {
      const status = {
        twilioConfigured: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
        emailConfigured: !!(process.env.EMAIL_SERVICE_PROVIDER && process.env.EMAIL_SERVICE_API_KEY),
        googleMapsConfigured: !!process.env.GOOGLE_MAPS_API_KEY,
      };
      res.json(status);
    } catch (error) {
      console.error("Error checking env status:", error);
      res.status(500).json({ message: "Failed to check env status" });
    }
  });

  app.get('/api/maps/config', async (_req, res) => {
    try {
      const settings = await storage.getPlatformSettings();
      // Fall back to env var if not in database
      const apiKey = settings?.googleMapsApiKey || process.env.GOOGLE_MAPS_API_KEY || "";
      const config = {
        apiKey,
        isConfigured: !!apiKey,
      };
      res.json(config);
    } catch (error) {
      console.error("Error fetching map config:", error);
      res.status(500).json({ message: "Failed to fetch map config" });
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
      const userId = req.user!.id;
      
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
      const userId = req.user!.id;
      
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
      const userId = req.user!.id;
      
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
      const userId = req.user!.id;
      const tempCategories = await storage.getTemporaryCategories(userId);
      res.json(tempCategories);
    } catch (error) {
      console.error("Error fetching temporary categories:", error);
      res.status(500).json({ message: "Failed to fetch temporary categories" });
    }
  });

  app.post('/api/temporary-categories', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      const categoryName = req.body.name?.trim();
      
      if (!categoryName) {
        return res.status(400).json({ message: "Category name is required" });
      }
      
      // First check if a similar category already exists
      const allCategories = await storage.getCategories();
      const similarMatch = findSimilarCategoryName(categoryName, 
        allCategories.map(c => ({ name: c.name, id: c.id }))
      );
      
      if (similarMatch.similarity > 0.8) {
        // A very similar category exists, suggest using it
        return res.status(200).json({
          id: similarMatch.category!.id,
          name: similarMatch.category!.name,
          isExistingCategory: true,
          message: `We found an existing category "${similarMatch.category!.name}" that matches your suggestion. Using it instead.`,
          similarity: similarMatch.similarity
        });
      }
      
      if (similarMatch.similarity > 0.75) {
        // A similar category exists, warn but allow creation
        console.log(`Creating category "${categoryName}" despite similarity to "${similarMatch.category?.name}" (${similarMatch.similarity.toFixed(2)})`);
      }
      
      // Validate category name for appropriateness
      const validation = await validateCategoryName(categoryName);
      if (!validation.isValid && validation.confidence > 0.6) {
        return res.status(400).json({ message: validation.reasoning });
      }
      
      // Set expiry to 24 hours from now
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24);

      const validated = insertTemporaryCategorySchema.parse({
        ...req.body,
        userId,
        expiresAt,
      });

      const tempCategory = await storage.createTemporaryCategory(validated);
      res.status(201).json({ ...tempCategory, isNewCategory: true, isExistingCategory: false });
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
      const userId = req.user!.id;
      
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
      const userId = req.user!.id;
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
      const userId = req.user!.id;
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
      // Ensure consistent response format
      res.json({
        isValid: result.isValid,
        formattedAddress: result.formattedAddress,
        message: result.message,
      });
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
      
      // Convert object paths to signed URLs for OpenAI
      const objectStorageService = new ObjectStorageService();
      const signedUrls: string[] = [];
      
      for (const url of validated.imageUrls) {
        try {
          if (url.startsWith('/objects/')) {
            // Convert internal object path to signed URL
            const signedUrl = await objectStorageService.getSignedObjectUrl(url, 3600);
            signedUrls.push(signedUrl);
          } else if (url.startsWith('http://') || url.startsWith('https://')) {
            // Already a valid URL
            signedUrls.push(url);
          }
          // Skip blob: URLs and other invalid formats
        } catch (error) {
          console.error(`Failed to sign URL for ${url}:`, error);
          // Continue with other images
        }
      }

      if (signedUrls.length === 0) {
        return res.status(400).json({ 
          message: "Images must be fully uploaded before AI can analyze them. Please wait for uploads to complete." 
        });
      }

      const hashtags = await analyzeImagesForHashtags(signedUrls);
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
        imageUrls: z.array(z.string()).min(1, "At least one image is required"),
        currentTitle: z.string().optional(),
      });

      const validated = schema.parse(req.body);
      
      // Convert object paths to signed URLs for OpenAI
      const objectStorageService = new ObjectStorageService();
      const signedUrls: string[] = [];
      
      for (const url of validated.imageUrls) {
        try {
          if (url.startsWith('/objects/')) {
            const signedUrl = await objectStorageService.getSignedObjectUrl(url, 3600);
            signedUrls.push(signedUrl);
          } else if (url.startsWith('http://') || url.startsWith('https://')) {
            signedUrls.push(url);
          }
        } catch (error) {
          console.error(`Failed to sign URL for ${url}:`, error);
        }
      }

      if (signedUrls.length === 0) {
        return res.status(400).json({ message: "Images must be fully uploaded" });
      }

      const title = await generateServiceTitle(signedUrls, validated.currentTitle);
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

  app.post('/api/geocode/search', async (req, res) => {
    try {
      const schema = z.object({
        query: z.string().min(1, "Query is required"),
        limit: z.number().positive().max(20).default(5),
      });

      const validated = schema.parse(req.body);
      const query = validated.query.trim();
      const limit = validated.limit;

      if (query.length < 2) {
        return res.json([]);
      }

      const encodedQuery = encodeURIComponent(query);
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&countrycodes=ch&addressdetails=1&limit=${limit}`;

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
        return res.json([]);
      }

      const formattedResults = results
        .filter((result: any) => result.address?.country_code === 'ch')
        .map((result: any) => {
          const address = result.address || {};
          const street = address.road || address.pedestrian || '';
          const houseNumber = address.house_number || '';
          const city = address.city || address.town || address.village || address.municipality || result.name;
          const postcode = address.postcode || '';
          
          const streetWithNumber = houseNumber ? `${street} ${houseNumber}` : street;
          
          const displayParts = [streetWithNumber, postcode, city].filter(p => p.trim());
          const displayName = displayParts.join(', ');
          
          return {
            display_name: displayName || result.display_name,
            lat: parseFloat(result.lat),
            lon: parseFloat(result.lon),
            city: city || '',
            postcode: postcode || '',
            street: streetWithNumber || '',
          };
        });

      res.json(formattedResults);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error searching geocode:", error);
      res.status(500).json({ message: "Failed to search locations" });
    }
  });

  app.post('/api/geocode-suggestions', async (req, res) => {
    try {
      const schema = z.object({
        query: z.string().min(1, "Query is required"),
      });

      const validated = schema.parse(req.body);
      const query = validated.query.trim();

      if (query.length < 2) {
        return res.json([]);
      }

      const encodedQuery = encodeURIComponent(query);
      const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodedQuery}&format=json&countrycodes=ch&addressdetails=1&limit=10`;

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
        return res.json([]);
      }

      const formattedResults = results
        .filter((result: any) => result.address?.country_code === 'ch')
        .map((result: any) => {
          const address = result.address || {};
          const street = address.road || address.pedestrian || '';
          const houseNumber = address.house_number || '';
          const city = address.city || address.town || address.village || address.municipality || result.name;
          const postcode = address.postcode || '';
          
          const streetWithNumber = houseNumber ? `${street} ${houseNumber}` : street;
          const displayParts = [streetWithNumber, postcode, city].filter(p => p.trim());
          const displayName = displayParts.join(', ');
          
          return {
            lat: parseFloat(result.lat),
            lng: parseFloat(result.lon),
            displayName: displayName || result.display_name,
            name: city || result.name,
          };
        });

      res.json(formattedResults);
    } catch (error: any) {
      if (error.name === 'ZodError') {
        return res.status(400).json({ message: fromZodError(error).message });
      }
      console.error("Error getting address suggestions:", error);
      res.status(500).json({ message: "Failed to get address suggestions" });
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
      const userId = req.user!.id;
      
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

  // Review management routes
  app.get('/api/users/me/reviews-received', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      
      // Get all reviews for services owned by this user
      const receivedReviews = await db
        .select({
          id: reviews.id,
          rating: reviews.rating,
          comment: reviews.comment,
          editCount: reviews.editCount,
          lastEditedAt: reviews.lastEditedAt,
          createdAt: reviews.createdAt,
          reviewer: {
            id: users.id,
            email: users.email,
            firstName: users.firstName,
            lastName: users.lastName,
            profileImageUrl: users.profileImageUrl,
          },
          service: {
            id: services.id,
            title: services.title,
          },
        })
        .from(reviews)
        .innerJoin(users, eq(reviews.userId, users.id))
        .innerJoin(services, eq(reviews.serviceId, services.id))
        .where(eq(services.ownerId, userId));

      res.json(receivedReviews);
    } catch (error) {
      console.error("Error fetching received reviews:", error);
      res.status(500).json({ message: "Failed to fetch received reviews" });
    }
  });

  app.patch('/api/reviews/:reviewId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      const reviewId = req.params.reviewId;
      const { rating, comment } = req.body;

      // Get the review
      const reviewData = await db.select().from(reviews).where(eq(reviews.id, reviewId));
      if (reviewData.length === 0) {
        return res.status(404).json({ message: "Review not found" });
      }

      const review = reviewData[0];

      // Check if user is the reviewer
      if (review.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to edit this review" });
      }

      // Check 7-day constraint
      const createdDate = new Date(review.createdAt);
      const now = new Date();
      const daysDiff = (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysDiff > 7) {
        return res.status(400).json({ message: "Reviews can only be edited within 7 days of creation" });
      }

      // Check edit count constraint
      if ((review.editCount || 0) >= 2) {
        return res.status(400).json({ message: "Reviews can be edited maximum 2 times" });
      }

      // Update review
      await db.update(reviews)
        .set({
          rating: rating !== undefined ? rating : review.rating,
          comment: comment !== undefined ? comment : review.comment,
          editCount: (review.editCount || 0) + 1,
          lastEditedAt: new Date(),
        })
        .where(eq(reviews.id, reviewId));

      const updated = await db.select().from(reviews).where(eq(reviews.id, reviewId));
      res.json(updated[0]);
    } catch (error) {
      console.error("Error updating review:", error);
      res.status(500).json({ message: "Failed to update review" });
    }
  });

  app.delete('/api/reviews/:reviewId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      const reviewId = req.params.reviewId;

      // Get the review
      const reviewData = await db.select().from(reviews).where(eq(reviews.id, reviewId));
      if (reviewData.length === 0) {
        return res.status(404).json({ message: "Review not found" });
      }

      const review = reviewData[0];

      // Check if user is the reviewer
      if (review.userId !== userId) {
        return res.status(403).json({ message: "Not authorized to delete this review" });
      }

      // Delete review
      await db.delete(reviews).where(eq(reviews.id, reviewId));
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting review:", error);
      res.status(500).json({ message: "Failed to delete review" });
    }
  });

  // ===========================================
  // REFERRAL SYSTEM ROUTES
  // ===========================================
  
  // Initialize referral config on startup
  initializeReferralConfig().catch(console.error);

  // Get referral code validation
  app.get('/api/referral/validate/:code', async (req, res) => {
    try {
      const { code } = req.params;
      const result = await validateReferralCode(code);
      res.json(result);
    } catch (error) {
      console.error("Error validating referral code:", error);
      res.status(500).json({ message: "Failed to validate referral code" });
    }
  });

  // Get current user's referral info
  app.get('/api/referral/my-stats', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      const stats = await getReferralStatsForUser(userId);
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const referralLink = generateReferralLink(baseUrl, stats.referralCode);
      
      res.json({
        ...stats,
        referralLink,
      });
    } catch (error) {
      console.error("Error fetching referral stats:", error);
      res.status(500).json({ message: "Failed to fetch referral stats" });
    }
  });

  // Get user's direct referrals
  app.get('/api/referral/my-referrals', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      const limit = parseInt(req.query.limit as string) || 50;
      const referrals = await getDirectReferrals(userId, limit);
      
      // Hide email addresses for privacy
      const sanitizedReferrals = referrals.map(r => ({
        id: r.id,
        firstName: r.firstName,
        lastName: r.lastName ? r.lastName.charAt(0) + '.' : null, // Only show initial
        createdAt: r.createdAt,
        status: r.status,
      }));
      
      res.json(sanitizedReferrals);
    } catch (error) {
      console.error("Error fetching referrals:", error);
      res.status(500).json({ message: "Failed to fetch referrals" });
    }
  });

  // Get who referred the current user
  app.get('/api/referral/my-referrer', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      
      // Get current user's referredBy
      const [user] = await db
        .select({
          referredBy: users.referredBy,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);
      
      if (!user?.referredBy) {
        return res.json({ hasReferrer: false, referrer: null });
      }
      
      // Get referrer info
      const [referrer] = await db
        .select({
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          profileImageUrl: users.profileImageUrl,
          referralCode: users.referralCode,
        })
        .from(users)
        .where(eq(users.id, user.referredBy))
        .limit(1);
      
      res.json({
        hasReferrer: true,
        referrer: referrer ? {
          id: referrer.id,
          firstName: referrer.firstName,
          lastName: referrer.lastName ? referrer.lastName.charAt(0) + '.' : null,
          profileImageUrl: referrer.profileImageUrl,
          referralCode: referrer.referralCode,
        } : null,
      });
    } catch (error) {
      console.error("Error fetching referrer:", error);
      res.status(500).json({ message: "Failed to fetch referrer" });
    }
  });

  // Get multi-level referrals (L1, L2, L3)
  app.get('/api/referral/my-network', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      const config = await getReferralConfig();
      const maxLevels = config.maxLevels || 3;
      
      // Get L1 referrals (direct)
      const l1Referrals = await getDirectReferrals(userId, 100);
      
      // Get L2 referrals (referrals of L1)
      const l2Referrals: any[] = [];
      const l3Referrals: any[] = [];
      
      if (maxLevels >= 2) {
        for (const l1 of l1Referrals.slice(0, 50)) {
          const l2 = await getDirectReferrals(l1.id, 20);
          l2Referrals.push(...l2.map(r => ({
            ...r,
            lastName: r.lastName ? r.lastName.charAt(0) + '.' : null,
            referredByName: `${l1.firstName || ''} ${(l1.lastName || '').charAt(0)}.`.trim(),
          })));
        }
      }
      
      // Get L3 referrals (optional, only first few)
      if (maxLevels >= 3 && l2Referrals.length < 100) {
        for (const l2 of l2Referrals.slice(0, 20)) {
          const l3 = await getDirectReferrals(l2.id, 10);
          l3Referrals.push(...l3.map(r => ({
            ...r,
            lastName: r.lastName ? r.lastName.charAt(0) + '.' : null,
            referredByName: `${l2.firstName || ''} ${(l2.lastName || '').charAt(0) || ''}.`.trim(),
          })));
        }
      }
      
      res.json({
        maxLevels,
        level1: {
          count: l1Referrals.length,
          referrals: l1Referrals.map(r => ({
            id: r.id,
            firstName: r.firstName,
            lastName: r.lastName ? r.lastName.charAt(0) + '.' : null,
            createdAt: r.createdAt,
            status: r.status,
          })),
        },
        level2: {
          count: l2Referrals.length,
          referrals: l2Referrals.slice(0, 50),
        },
        level3: {
          count: l3Referrals.length,
          referrals: l3Referrals.slice(0, 30),
        },
      });
    } catch (error) {
      console.error("Error fetching network:", error);
      res.status(500).json({ message: "Failed to fetch network" });
    }
  });

  // Get user's commission events
  app.get('/api/referral/my-commissions', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      const limit = parseInt(req.query.limit as string) || 50;
      
      const commissions = await db
        .select({
          id: referralTransactions.id,
          fromUserId: referralTransactions.fromUserId,
          level: referralTransactions.level,
          pointsEarned: referralTransactions.pointsEarned,
          commissionEarned: referralTransactions.commissionEarned,
          triggerType: referralTransactions.triggerType,
          triggerId: referralTransactions.triggerId,
          triggerAmount: referralTransactions.triggerAmount,
          status: referralTransactions.status,
          createdAt: referralTransactions.createdAt,
        })
        .from(referralTransactions)
        .where(eq(referralTransactions.toUserId, userId))
        .orderBy(referralTransactions.createdAt)
        .limit(limit);
      
      // Get names for the fromUsers
      const fromUserIds = [...new Set(commissions.map(c => c.fromUserId))];
      const fromUsersMap: Record<string, { firstName: string | null; lastName: string | null }> = {};
      
      if (fromUserIds.length > 0) {
        const fromUsers = await db
          .select({
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
          })
          .from(users)
          .where(sql`${users.id} IN ${fromUserIds}`);
        
        for (const u of fromUsers) {
          fromUsersMap[u.id] = { firstName: u.firstName, lastName: u.lastName };
        }
      }
      
      res.json(commissions.map(c => ({
        ...c,
        fromUserName: fromUsersMap[c.fromUserId] 
          ? `${fromUsersMap[c.fromUserId].firstName || ''} ${(fromUsersMap[c.fromUserId].lastName || '').charAt(0)}.`.trim()
          : 'Unknown',
      })));
    } catch (error) {
      console.error("Error fetching commissions:", error);
      res.status(500).json({ message: "Failed to fetch commissions" });
    }
  });

  // Get user's points balance and summary
  app.get('/api/points/summary', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      const summary = await getPointsSummary(userId);
      res.json(summary);
    } catch (error) {
      console.error("Error fetching points summary:", error);
      res.status(500).json({ message: "Failed to fetch points summary" });
    }
  });

  // Get user's points history
  app.get('/api/points/history', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const history = await getPointsHistory(userId, limit, offset);
      res.json(history);
    } catch (error) {
      console.error("Error fetching points history:", error);
      res.status(500).json({ message: "Failed to fetch points history" });
    }
  });

  // Redeem points
  app.post('/api/points/redeem', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user!.id;
      const validation = redeemPointsSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ message: fromZodError(validation.error).message });
      }
      
      const result = await redeemPoints({
        userId,
        ...validation.data,
      });
      
      if (!result.success) {
        return res.status(400).json({ message: result.message });
      }
      
      res.json(result);
    } catch (error) {
      console.error("Error redeeming points:", error);
      res.status(500).json({ message: "Failed to redeem points" });
    }
  });

  // Calculate discount value from points
  app.get('/api/points/calculate-discount', isAuthenticated, async (req: any, res) => {
    try {
      const points = parseInt(req.query.points as string) || 0;
      const discountValue = await calculateDiscountValue(points);
      res.json({ points, discountValue });
    } catch (error) {
      console.error("Error calculating discount:", error);
      res.status(500).json({ message: "Failed to calculate discount" });
    }
  });

  // Get points leaderboard (public)
  app.get('/api/points/leaderboard', async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const leaderboard = await getPointsLeaderboard(limit);
      
      // Anonymize for privacy
      const anonymized = leaderboard.map(u => ({
        rank: u.rank,
        firstName: u.firstName,
        lastName: u.lastName ? u.lastName.charAt(0) + '.' : null,
        points: u.points,
      }));
      
      res.json(anonymized);
    } catch (error) {
      console.error("Error fetching leaderboard:", error);
      res.status(500).json({ message: "Failed to fetch leaderboard" });
    }
  });

  // Get referral config (public - non-sensitive parts)
  app.get('/api/referral/config', async (req, res) => {
    try {
      const config = await getReferralConfig();
      
      // Return only public config values
      res.json({
        maxLevels: config.maxLevels,
        pointsPerReferral: config.pointsPerReferral,
        pointsPerFirstPurchase: config.pointsPerFirstPurchase,
        pointsPerServiceCreation: config.pointsPerServiceCreation,
        pointsPerReview: config.pointsPerReview,
        pointsToDiscountRate: config.pointsToDiscountRate,
        minPointsToRedeem: config.minPointsToRedeem,
        isActive: config.isActive,
      });
    } catch (error) {
      console.error("Error fetching referral config:", error);
      res.status(500).json({ message: "Failed to fetch referral config" });
    }
  });

  // ===========================================
  // ADMIN REFERRAL ROUTES
  // ===========================================

  // Get referral system overview (admin only)
  app.get('/api/admin/referral/stats', isAdmin, async (req, res) => {
    try {
      const stats = await getReferralSystemStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching admin referral stats:", error);
      res.status(500).json({ message: "Failed to fetch referral stats" });
    }
  });

  // Get top referrers (admin only)
  app.get('/api/admin/referral/top-referrers', isAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 10;
      const topReferrers = await getTopReferrers(limit);
      res.json(topReferrers);
    } catch (error) {
      console.error("Error fetching top referrers:", error);
      res.status(500).json({ message: "Failed to fetch top referrers" });
    }
  });

  // Get full referral config (admin only)
  app.get('/api/admin/referral/config', isAdmin, async (req, res) => {
    try {
      const config = await getReferralConfig();
      res.json(config);
    } catch (error) {
      console.error("Error fetching referral config:", error);
      res.status(500).json({ message: "Failed to fetch referral config" });
    }
  });

  // Update referral config (admin only)
  app.patch('/api/admin/referral/config', isAdmin, async (req, res) => {
    try {
      const validation = updateReferralConfigSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ message: fromZodError(validation.error).message });
      }
      
      await updateReferralConfig(validation.data);
      const updatedConfig = await getReferralConfig();
      res.json(updatedConfig);
    } catch (error) {
      console.error("Error updating referral config:", error);
      res.status(500).json({ message: "Failed to update referral config" });
    }
  });

  // Adjust user points (admin only)
  app.post('/api/admin/referral/adjust-points', isAdmin, async (req: any, res) => {
    try {
      const adminId = req.adminSession?.userId || 'admin';
      const validation = adminReferralAdjustmentSchema.safeParse(req.body);
      
      if (!validation.success) {
        return res.status(400).json({ message: fromZodError(validation.error).message });
      }
      
      const result = await adminAdjustPoints({
        ...validation.data,
        adminId,
      });
      
      res.json(result);
    } catch (error) {
      console.error("Error adjusting points:", error);
      res.status(500).json({ message: "Failed to adjust points" });
    }
  });

  // Get user's referral chain (admin only)
  app.get('/api/admin/referral/user/:userId/chain', isAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const chain = await getReferralChain(userId);
      res.json(chain);
    } catch (error) {
      console.error("Error fetching referral chain:", error);
      res.status(500).json({ message: "Failed to fetch referral chain" });
    }
  });

  // Get user's referral stats (admin only)
  app.get('/api/admin/referral/user/:userId/stats', isAdmin, async (req, res) => {
    try {
      const { userId } = req.params;
      const stats = await getReferralStatsForUser(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching user referral stats:", error);
      res.status(500).json({ message: "Failed to fetch user referral stats" });
    }
  });

  // Get all referral transactions (admin only)
  app.get('/api/admin/referral/transactions', isAdmin, async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      
      const transactions = await db
        .select({
          id: referralTransactions.id,
          toUserId: referralTransactions.toUserId,
          fromUserId: referralTransactions.fromUserId,
          level: referralTransactions.level,
          pointsEarned: referralTransactions.pointsEarned,
          commissionEarned: referralTransactions.commissionEarned,
          triggerType: referralTransactions.triggerType,
          status: referralTransactions.status,
          createdAt: referralTransactions.createdAt,
        })
        .from(referralTransactions)
        .orderBy(referralTransactions.createdAt)
        .limit(limit)
        .offset(offset);
      
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching referral transactions:", error);
      res.status(500).json({ message: "Failed to fetch referral transactions" });
    }
  });

  // ===========================================
  // STRIPE PAYMENT ROUTES
  // ===========================================

  // Get Stripe configuration (public key, etc.)
  app.get('/api/payments/config', (req, res) => {
    res.json({
      publishableKey: getStripePublishableKey(),
      isConfigured: isStripeConfigured(),
      platformFeePercentage: PLATFORM_FEE_PERCENTAGE,
    });
  });

  // Create Stripe customer for current user
  app.post('/api/payments/create-customer', isAuthenticated, async (req: any, res) => {
    try {
      const customerId = await getOrCreateStripeCustomer(req.user!.id);
      res.json({ customerId });
    } catch (error) {
      console.error("Error creating Stripe customer:", error);
      res.status(500).json({ message: "Failed to create payment customer" });
    }
  });

  // Create Stripe Connect account for vendor
  app.post('/api/payments/connect/create', isAuthenticated, async (req: any, res) => {
    try {
      const result = await createConnectAccount(req.user!.id);
      if (!result) {
        return res.status(503).json({ message: "Payment system not configured" });
      }
      res.json(result);
    } catch (error) {
      console.error("Error creating Connect account:", error);
      res.status(500).json({ message: "Failed to create vendor payment account" });
    }
  });

  // Get Connect account status
  app.get('/api/payments/connect/status', isAuthenticated, async (req: any, res) => {
    try {
      const status = await getConnectAccountStatus(req.user!.id);
      res.json(status || { hasAccount: false, isOnboarded: false, chargesEnabled: false, payoutsEnabled: false });
    } catch (error) {
      console.error("Error getting Connect status:", error);
      res.status(500).json({ message: "Failed to get payment account status" });
    }
  });

  // Create payment intent for an order
  app.post('/api/payments/create-intent', isAuthenticated, async (req: any, res) => {
    try {
      const { orderId, amount, description } = req.body;
      
      if (!orderId || !amount) {
        return res.status(400).json({ message: "orderId and amount are required" });
      }

      // Get order to verify ownership and get vendor
      const order = await storage.getOrderById(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      if (order.customerId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized to pay for this order" });
      }

      const result = await createPaymentIntent({
        orderId,
        customerId: req.user!.id,
        vendorId: order.vendorId,
        amount: Math.round(amount * 100), // Convert to cents
        description,
      });

      if (!result) {
        return res.status(503).json({ message: "Payment system not configured" });
      }

      res.json(result);
    } catch (error) {
      console.error("Error creating payment intent:", error);
      res.status(500).json({ message: "Failed to create payment" });
    }
  });

  // Create checkout session
  app.post('/api/payments/create-checkout', isAuthenticated, async (req: any, res) => {
    try {
      const { orderId, lineItems, successUrl, cancelUrl } = req.body;

      if (!orderId || !lineItems || !successUrl || !cancelUrl) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      const order = await storage.getOrderById(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      if (order.customerId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const result = await createCheckoutSession({
        orderId,
        customerId: req.user!.id,
        vendorId: order.vendorId,
        lineItems,
        successUrl,
        cancelUrl,
      });

      if (!result) {
        return res.status(503).json({ message: "Payment system not configured" });
      }

      res.json(result);
    } catch (error) {
      console.error("Error creating checkout session:", error);
      res.status(500).json({ message: "Failed to create checkout" });
    }
  });

  // Stripe webhook handler
  app.post('/api/payments/webhook', async (req, res) => {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      return res.status(400).json({ message: "Missing signature" });
    }

    try {
      // Note: For raw body, ensure express.raw() middleware is set up for this route
      const event = constructWebhookEvent(req.body, signature);

      if (!event) {
        return res.status(400).json({ message: "Invalid webhook signature" });
      }

      // Handle the event
      switch (event.type) {
        case 'payment_intent.succeeded':
          await handlePaymentSucceeded(event.data.object as any);
          break;
        case 'payment_intent.payment_failed':
          await handlePaymentFailed(event.data.object as any);
          break;
        case 'account.updated':
          await handleAccountUpdated(event.data.object as any);
          break;
        default:
          console.log(`Unhandled webhook event type: ${event.type}`);
      }

      res.json({ received: true });
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(500).json({ message: "Webhook handler failed" });
    }
  });

  // Refund an order (admin or vendor)
  app.post('/api/payments/refund', isAuthenticated, async (req: any, res) => {
    try {
      const { orderId, amount, reason } = req.body;
      
      if (!orderId) {
        return res.status(400).json({ message: "orderId is required" });
      }

      const order = await storage.getOrderById(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Only vendor or admin can refund
      const user = await storage.getUser(req.user!.id);
      if (order.vendorId !== req.user!.id && !user?.isAdmin) {
        return res.status(403).json({ message: "Not authorized to refund this order" });
      }

      const success = await createRefund(orderId, amount ? Math.round(amount * 100) : undefined, reason);
      res.json({ success });
    } catch (error) {
      console.error("Error creating refund:", error);
      res.status(500).json({ message: "Failed to create refund" });
    }
  });

  // ===========================================
  // ORDERS ROUTES
  // ===========================================

  // Create an order
  app.post('/api/orders', isAuthenticated, async (req: any, res) => {
    try {
      const { serviceId, pricingOptionId, quantity, customerNotes } = req.body;

      if (!serviceId) {
        return res.status(400).json({ message: "serviceId is required" });
      }

      const order = await storage.createOrder({
        customerId: req.user!.id,
        serviceId,
        pricingOptionId,
        quantity: quantity || 1,
        customerNotes,
      });

      res.status(201).json(order);
    } catch (error) {
      console.error("Error creating order:", error);
      res.status(500).json({ message: "Failed to create order" });
    }
  });

  // Get user's orders (as customer)
  app.get('/api/orders/my', isAuthenticated, async (req: any, res) => {
    try {
      const { status, limit = 20, offset = 0 } = req.query;
      const orders = await storage.getCustomerOrders(
        req.user!.id,
        status as string,
        parseInt(limit as string),
        parseInt(offset as string)
      );
      res.json(orders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  // Get vendor's orders
  app.get('/api/vendor/orders', isAuthenticated, async (req: any, res) => {
    try {
      const { status, limit = 20, offset = 0 } = req.query;
      const orders = await storage.getVendorOrders(
        req.user!.id,
        status as string,
        parseInt(limit as string),
        parseInt(offset as string)
      );
      res.json(orders);
    } catch (error) {
      console.error("Error fetching vendor orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  // Get single order
  app.get('/api/orders/:id', isAuthenticated, async (req: any, res) => {
    try {
      const order = await storage.getOrderById(req.params.id);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      // Verify access
      if (order.customerId !== req.user!.id && order.vendorId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized" });
      }
      res.json(order);
    } catch (error) {
      console.error("Error fetching order:", error);
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  // Update order status (vendor)
  app.patch('/api/orders/:id/status', isAuthenticated, async (req: any, res) => {
    try {
      const { status, vendorNotes } = req.body;
      const order = await storage.getOrderById(req.params.id);
      
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }
      if (order.vendorId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const updated = await storage.updateOrderStatus(req.params.id, status, vendorNotes);
      res.json(updated);
    } catch (error) {
      console.error("Error updating order:", error);
      res.status(500).json({ message: "Failed to update order" });
    }
  });

  // ===========================================
  // SERVICE PRICING OPTIONS ROUTES
  // ===========================================

  // Get pricing options for a service
  app.get('/api/services/:serviceId/pricing-options', async (req, res) => {
    try {
      const options = await storage.getServicePricingOptions(req.params.serviceId);
      res.json(options);
    } catch (error) {
      console.error("Error fetching pricing options:", error);
      res.status(500).json({ message: "Failed to fetch pricing options" });
    }
  });

  // Create pricing option (service owner only)
  app.post('/api/services/:serviceId/pricing-options', isAuthenticated, async (req: any, res) => {
    try {
      const service = await storage.getService(req.params.serviceId);
      if (!service) {
        return res.status(404).json({ message: "Service not found" });
      }
      if (service.ownerId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const option = await storage.createServicePricingOption({
        serviceId: req.params.serviceId,
        ...req.body,
      });
      res.status(201).json(option);
    } catch (error) {
      console.error("Error creating pricing option:", error);
      res.status(500).json({ message: "Failed to create pricing option" });
    }
  });

  // Update pricing option
  app.patch('/api/pricing-options/:id', isAuthenticated, async (req: any, res) => {
    try {
      const option = await storage.getPricingOptionById(req.params.id);
      if (!option) {
        return res.status(404).json({ message: "Pricing option not found" });
      }
      
      const service = await storage.getService(option.serviceId);
      if (!service || service.ownerId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const updated = await storage.updateServicePricingOption(req.params.id, req.body);
      res.json(updated);
    } catch (error) {
      console.error("Error updating pricing option:", error);
      res.status(500).json({ message: "Failed to update pricing option" });
    }
  });

  // Delete pricing option
  app.delete('/api/pricing-options/:id', isAuthenticated, async (req: any, res) => {
    try {
      const option = await storage.getPricingOptionById(req.params.id);
      if (!option) {
        return res.status(404).json({ message: "Pricing option not found" });
      }
      
      const service = await storage.getService(option.serviceId);
      if (!service || service.ownerId !== req.user!.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      await storage.deleteServicePricingOption(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting pricing option:", error);
      res.status(500).json({ message: "Failed to delete pricing option" });
    }
  });

  // ===========================================
  // BOOKING & CALENDAR ROUTES
  // ===========================================

  // Get vendor availability settings
  app.get('/api/vendor/availability', isAuthenticated, async (req: any, res) => {
    try {
      const settings = await getVendorAvailabilitySettings(req.user!.id);
      res.json(settings || { 
        defaultWorkingHours: {},
        timezone: 'Europe/Zurich',
        minBookingNoticeHours: 24,
        maxBookingAdvanceDays: 90,
      });
    } catch (error) {
      console.error("Error fetching availability settings:", error);
      res.status(500).json({ message: "Failed to fetch availability settings" });
    }
  });

  // Update vendor availability settings
  app.put('/api/vendor/availability', isAuthenticated, async (req: any, res) => {
    try {
      const settings = await upsertVendorAvailabilitySettings(req.user!.id, req.body);
      res.json(settings);
    } catch (error) {
      console.error("Error updating availability settings:", error);
      res.status(500).json({ message: "Failed to update availability settings" });
    }
  });

  // Get vendor calendar blocks
  app.get('/api/vendor/calendar/blocks', isAuthenticated, async (req: any, res) => {
    try {
      const { startDate, endDate, serviceId } = req.query;
      
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate and endDate are required" });
      }

      const blocks = await getVendorCalendarBlocks(
        req.user!.id,
        new Date(startDate as string),
        new Date(endDate as string),
        serviceId as string
      );
      res.json(blocks);
    } catch (error) {
      console.error("Error fetching calendar blocks:", error);
      res.status(500).json({ message: "Failed to fetch calendar blocks" });
    }
  });

  // Create calendar block
  app.post('/api/vendor/calendar/blocks', isAuthenticated, async (req: any, res) => {
    try {
      const block = await createCalendarBlock(req.user!.id, req.body);
      res.status(201).json(block);
    } catch (error: any) {
      console.error("Error creating calendar block:", error);
      res.status(400).json({ message: error.message || "Failed to create calendar block" });
    }
  });

  // Update calendar block
  app.patch('/api/vendor/calendar/blocks/:id', isAuthenticated, async (req: any, res) => {
    try {
      const block = await updateCalendarBlock(req.params.id, req.user!.id, req.body);
      if (!block) {
        return res.status(404).json({ message: "Block not found" });
      }
      res.json(block);
    } catch (error) {
      console.error("Error updating calendar block:", error);
      res.status(500).json({ message: "Failed to update calendar block" });
    }
  });

  // Delete calendar block
  app.delete('/api/vendor/calendar/blocks/:id', isAuthenticated, async (req: any, res) => {
    try {
      const deleted = await deleteCalendarBlock(req.params.id, req.user!.id);
      if (!deleted) {
        return res.status(404).json({ message: "Block not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting calendar block:", error);
      res.status(500).json({ message: "Failed to delete calendar block" });
    }
  });

  // Get available slots for a service
  app.get('/api/services/:serviceId/available-slots', async (req, res) => {
    try {
      const { date, duration } = req.query;
      
      if (!date) {
        return res.status(400).json({ message: "date is required" });
      }

      const slots = await getAvailableSlots(
        req.params.serviceId,
        new Date(date as string),
        duration ? parseInt(duration as string) : undefined
      );
      res.json(slots);
    } catch (error: any) {
      console.error("Error fetching available slots:", error);
      res.status(400).json({ message: error.message || "Failed to fetch available slots" });
    }
  });

  // Calculate booking price
  app.post('/api/bookings/calculate-price', async (req, res) => {
    try {
      const { serviceId, pricingOptionId, startTime, endTime } = req.body;
      
      if (!serviceId || !startTime || !endTime) {
        return res.status(400).json({ message: "serviceId, startTime, and endTime are required" });
      }

      const { calculateBookingPrice } = await import('./pricingCalculationService');
      
      const breakdown = await calculateBookingPrice({
        serviceId,
        pricingOptionId,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
      });
      
      res.json(breakdown);
    } catch (error: any) {
      console.error("Error calculating price:", error);
      res.status(400).json({ message: error.message || "Failed to calculate price" });
    }
  });

  // Create booking request
  app.post('/api/bookings', isAuthenticated, async (req: any, res) => {
    try {
      const booking = await createBookingRequest({
        customerId: req.user!.id,
        ...req.body,
        requestedStartTime: new Date(req.body.requestedStartTime),
        requestedEndTime: new Date(req.body.requestedEndTime),
      });
      res.status(201).json(booking);
    } catch (error: any) {
      console.error("Error creating booking:", error);
      res.status(400).json({ message: error.message || "Failed to create booking" });
    }
  });

  // Get customer's bookings
  app.get('/api/bookings/my', isAuthenticated, async (req: any, res) => {
    try {
      const { status, limit = 20, offset = 0 } = req.query;
      const bookings = await getCustomerBookings(
        req.user!.id,
        status as string,
        parseInt(limit as string),
        parseInt(offset as string)
      );
      res.json(bookings);
    } catch (error) {
      console.error("Error fetching bookings:", error);
      res.status(500).json({ message: "Failed to fetch bookings" });
    }
  });

  // Get vendor's bookings
  app.get('/api/vendor/bookings', isAuthenticated, async (req: any, res) => {
    try {
      const { status, startDate, endDate, limit = 20, offset = 0 } = req.query;
      const bookings = await getVendorBookings(
        req.user!.id,
        status as string,
        startDate ? new Date(startDate as string) : undefined,
        endDate ? new Date(endDate as string) : undefined,
        parseInt(limit as string),
        parseInt(offset as string)
      );
      res.json(bookings);
    } catch (error) {
      console.error("Error fetching vendor bookings:", error);
      res.status(500).json({ message: "Failed to fetch bookings" });
    }
  });

  // Get pending bookings count
  app.get('/api/vendor/bookings/pending-count', isAuthenticated, async (req: any, res) => {
    try {
      const count = await getPendingBookingsCount(req.user!.id);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching pending count:", error);
      res.status(500).json({ message: "Failed to fetch pending count" });
    }
  });

  // Get single booking
  app.get('/api/bookings/:id', isAuthenticated, async (req: any, res) => {
    try {
      const booking = await getBookingById(req.params.id, req.user!.id);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }
      
      // Add queue position if pending
      let queuePosition = null;
      if (booking.status === 'pending') {
        queuePosition = await getQueuePosition(booking.id);
      }
      
      res.json({ ...booking, queuePosition });
    } catch (error) {
      console.error("Error fetching booking:", error);
      res.status(500).json({ message: "Failed to fetch booking" });
    }
  });

  // Accept booking (vendor)
  app.post('/api/bookings/:id/accept', isAuthenticated, async (req: any, res) => {
    try {
      const booking = await acceptBooking(req.params.id, req.user!.id, req.body.message);
      res.json(booking);
    } catch (error: any) {
      console.error("Error accepting booking:", error);
      res.status(400).json({ message: error.message || "Failed to accept booking" });
    }
  });

  // Reject booking (vendor)
  app.post('/api/bookings/:id/reject', isAuthenticated, async (req: any, res) => {
    try {
      const booking = await rejectBooking(req.params.id, req.user!.id, req.body.reason);
      res.json(booking);
    } catch (error: any) {
      console.error("Error rejecting booking:", error);
      res.status(400).json({ message: error.message || "Failed to reject booking" });
    }
  });

  // Propose alternative time (vendor)
  app.post('/api/bookings/:id/propose-alternative', isAuthenticated, async (req: any, res) => {
    try {
      const { alternativeStartTime, alternativeEndTime, message, expiryHours } = req.body;
      
      if (!alternativeStartTime || !alternativeEndTime) {
        return res.status(400).json({ message: "Alternative times are required" });
      }

      const booking = await proposeAlternative(
        req.params.id,
        req.user!.id,
        new Date(alternativeStartTime),
        new Date(alternativeEndTime),
        message,
        expiryHours
      );
      res.json(booking);
    } catch (error: any) {
      console.error("Error proposing alternative:", error);
      res.status(400).json({ message: error.message || "Failed to propose alternative" });
    }
  });

  // Accept alternative (customer)
  app.post('/api/bookings/:id/accept-alternative', isAuthenticated, async (req: any, res) => {
    try {
      const booking = await acceptAlternative(req.params.id, req.user!.id);
      res.json(booking);
    } catch (error: any) {
      console.error("Error accepting alternative:", error);
      res.status(400).json({ message: error.message || "Failed to accept alternative" });
    }
  });

  // Cancel booking (customer or vendor)
  app.post('/api/bookings/:id/cancel', isAuthenticated, async (req: any, res) => {
    try {
      const booking = await cancelBooking(req.params.id, req.user!.id, req.body.reason);
      res.json(booking);
    } catch (error: any) {
      console.error("Error cancelling booking:", error);
      res.status(400).json({ message: error.message || "Failed to cancel booking" });
    }
  });

  // Start booking (vendor)
  app.post('/api/bookings/:id/start', isAuthenticated, async (req: any, res) => {
    try {
      const booking = await startBooking(req.params.id, req.user!.id);
      if (!booking) {
        return res.status(400).json({ message: "Cannot start this booking" });
      }
      res.json(booking);
    } catch (error) {
      console.error("Error starting booking:", error);
      res.status(500).json({ message: "Failed to start booking" });
    }
  });

  // Complete booking (vendor)
  app.post('/api/bookings/:id/complete', isAuthenticated, async (req: any, res) => {
    try {
      const booking = await completeBooking(req.params.id, req.user!.id);
      if (!booking) {
        return res.status(400).json({ message: "Cannot complete this booking" });
      }
      res.json(booking);
    } catch (error) {
      console.error("Error completing booking:", error);
      res.status(500).json({ message: "Failed to complete booking" });
    }
  });

  // ===========================================
  // CHAT ROUTES
  // ===========================================

  // Get user's conversations
  app.get('/api/chat/conversations', isAuthenticated, async (req: any, res) => {
    try {
      const { role, limit = 20, offset = 0 } = req.query;
      const conversations = await getUserConversations(
        req.user!.id,
        role as 'customer' | 'vendor' | 'both',
        parseInt(limit as string),
        parseInt(offset as string)
      );
      res.json(conversations);
    } catch (error) {
      console.error("Error fetching conversations:", error);
      res.status(500).json({ message: "Failed to fetch conversations" });
    }
  });

  // Get unread message count
  app.get('/api/chat/unread-count', isAuthenticated, async (req: any, res) => {
    try {
      const count = await getChatUnreadCount(req.user!.id);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching unread count:", error);
      res.status(500).json({ message: "Failed to fetch unread count" });
    }
  });

  // Start or get conversation
  app.post('/api/chat/conversations', isAuthenticated, async (req: any, res) => {
    try {
      const { vendorId, bookingId, orderId, serviceId } = req.body;
      
      if (!vendorId) {
        return res.status(400).json({ message: "vendorId is required" });
      }

      // Prevent chatting with yourself
      if (vendorId === req.user!.id) {
        return res.status(400).json({ message: "Cannot start conversation with yourself" });
      }

      const conversation = await getOrCreateConversation({
        customerId: req.user!.id,
        vendorId,
        bookingId,
        orderId,
        serviceId,
      });
      res.json(conversation);
    } catch (error) {
      console.error("Error creating conversation:", error);
      res.status(500).json({ message: "Failed to create conversation" });
    }
  });

  // Get conversation by ID
  app.get('/api/chat/conversations/:id', isAuthenticated, async (req: any, res) => {
    try {
      const conversation = await getConversationById(req.params.id, req.user!.id);
      if (!conversation) {
        return res.status(404).json({ message: "Conversation not found" });
      }
      res.json(conversation);
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ message: "Failed to fetch conversation" });
    }
  });

  // Get messages in conversation
  app.get('/api/chat/conversations/:id/messages', isAuthenticated, async (req: any, res) => {
    try {
      const { limit = 50, before } = req.query;
      const messages = await getMessages(
        req.params.id,
        req.user!.id,
        parseInt(limit as string),
        before as string
      );
      res.json(messages);
    } catch (error: any) {
      console.error("Error fetching messages:", error);
      res.status(400).json({ message: error.message || "Failed to fetch messages" });
    }
  });

  // Send message
  app.post('/api/chat/conversations/:id/messages', isAuthenticated, async (req: any, res) => {
    try {
      const { content, messageType, attachments } = req.body;
      
      if (!content || content.trim().length === 0) {
        return res.status(400).json({ message: "Message content is required" });
      }

      const message = await sendMessage({
        conversationId: req.params.id,
        senderId: req.user!.id,
        content: content.trim(),
        messageType,
        attachments,
      });
      res.status(201).json(message);
    } catch (error: any) {
      console.error("Error sending message:", error);
      res.status(400).json({ message: error.message || "Failed to send message" });
    }
  });

  // Mark messages as read
  app.post('/api/chat/conversations/:id/read', isAuthenticated, async (req: any, res) => {
    try {
      await markMessagesAsRead(req.params.id, req.user!.id);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error marking messages as read:", error);
      res.status(400).json({ message: error.message || "Failed to mark as read" });
    }
  });

  // Block conversation
  app.post('/api/chat/conversations/:id/block', isAuthenticated, async (req: any, res) => {
    try {
      await blockConversation(req.params.id, req.user!.id, req.body.reason);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error blocking conversation:", error);
      res.status(400).json({ message: error.message || "Failed to block conversation" });
    }
  });

  // Delete message (soft delete)
  app.delete('/api/chat/messages/:id', isAuthenticated, async (req: any, res) => {
    try {
      const success = await deleteMessage(req.params.id, req.user!.id);
      if (!success) {
        return res.status(404).json({ message: "Message not found or not authorized" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting message:", error);
      res.status(500).json({ message: "Failed to delete message" });
    }
  });

  // Edit message
  app.patch('/api/chat/messages/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { content } = req.body;
      if (!content || content.trim().length === 0) {
        return res.status(400).json({ message: "Content is required" });
      }

      const message = await editMessage(req.params.id, req.user!.id, content.trim());
      if (!message) {
        return res.status(404).json({ message: "Message not found or not authorized" });
      }
      res.json(message);
    } catch (error: any) {
      console.error("Error editing message:", error);
      res.status(400).json({ message: error.message || "Failed to edit message" });
    }
  });

  // Preview message moderation (for UI feedback)
  app.post('/api/chat/moderate-preview', isAuthenticated, async (req: any, res) => {
    try {
      const { content } = req.body;
      if (!content) {
        return res.status(400).json({ message: "Content is required" });
      }
      
      const result = moderateMessage(content);
      res.json({
        wouldBeFiltered: !result.isClean,
        previewContent: result.filteredContent,
        reasons: result.filterReasons,
      });
    } catch (error) {
      console.error("Error previewing moderation:", error);
      res.status(500).json({ message: "Failed to preview moderation" });
    }
  });

  // Admin: Get flagged conversations
  app.get('/api/admin/chat/flagged', isAdmin, async (req: any, res) => {
    try {
      const { limit = 20, offset = 0 } = req.query;
      const flagged = await getFlaggedConversations(
        parseInt(limit as string),
        parseInt(offset as string)
      );
      res.json(flagged);
    } catch (error) {
      console.error("Error fetching flagged conversations:", error);
      res.status(500).json({ message: "Failed to fetch flagged conversations" });
    }
  });

  // Admin: Clear conversation flag
  app.post('/api/admin/chat/conversations/:id/clear-flag', isAdmin, async (req: any, res) => {
    try {
      await clearConversationFlag(req.params.id);
      res.json({ success: true });
    } catch (error) {
      console.error("Error clearing flag:", error);
      res.status(500).json({ message: "Failed to clear flag" });
    }
  });

  // ===========================================
  // NOTIFICATION ROUTES
  // ===========================================

  // Initialize push service on server start
  initializePushService();

  /**
   * Get notifications for authenticated user
   * Supports pagination and filtering by type/read status
   */
  app.get('/api/notifications', isAuthenticated, async (req: any, res) => {
    try {
      const { 
        limit = '20', 
        offset = '0', 
        unreadOnly = 'false',
        types 
      } = req.query;

      const result = await getNotifications(req.user!.id, {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        unreadOnly: unreadOnly === 'true',
        types: types ? (types as string).split(',') as NotificationType[] : undefined,
      });

      res.json(result);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  /**
   * Get unread notification count for badge display
   */
  app.get('/api/notifications/unread-count', isAuthenticated, async (req: any, res) => {
    try {
      const count = await getNotificationUnreadCount(req.user!.id);
      res.json({ count });
    } catch (error) {
      console.error("Error fetching unread count:", error);
      res.status(500).json({ message: "Failed to fetch unread count" });
    }
  });

  /**
   * Mark a specific notification as read
   */
  app.post('/api/notifications/:id/read', isAuthenticated, async (req: any, res) => {
    try {
      const success = await markAsRead(req.params.id, req.user!.id);
      if (!success) {
        return res.status(404).json({ message: "Notification not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark as read" });
    }
  });

  /**
   * Mark all notifications as read
   */
  app.post('/api/notifications/mark-all-read', isAuthenticated, async (req: any, res) => {
    try {
      const count = await markAllAsRead(req.user!.id);
      res.json({ success: true, count });
    } catch (error) {
      console.error("Error marking all as read:", error);
      res.status(500).json({ message: "Failed to mark all as read" });
    }
  });

  /**
   * Dismiss (soft delete) a notification
   */
  app.post('/api/notifications/:id/dismiss', isAuthenticated, async (req: any, res) => {
    try {
      const success = await dismissNotification(req.params.id, req.user!.id);
      if (!success) {
        return res.status(404).json({ message: "Notification not found" });
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error dismissing notification:", error);
      res.status(500).json({ message: "Failed to dismiss notification" });
    }
  });

  /**
   * Clear all notifications for user
   */
  app.post('/api/notifications/clear-all', isAuthenticated, async (req: any, res) => {
    try {
      const count = await clearAllNotifications(req.user!.id);
      res.json({ success: true, count });
    } catch (error) {
      console.error("Error clearing notifications:", error);
      res.status(500).json({ message: "Failed to clear notifications" });
    }
  });

  // ===========================================
  // NOTIFICATION PREFERENCES
  // ===========================================

  /**
   * Get user's notification preferences
   */
  app.get('/api/notifications/preferences', isAuthenticated, async (req: any, res) => {
    try {
      const preferences = await getNotificationPreferences(req.user!.id);
      res.json(preferences);
    } catch (error) {
      console.error("Error fetching preferences:", error);
      res.status(500).json({ message: "Failed to fetch preferences" });
    }
  });

  /**
   * Update notification preferences
   */
  app.put('/api/notifications/preferences', isAuthenticated, async (req: any, res) => {
    try {
      // Validate input
      const validationResult = updateNotificationPreferencesSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          message: "Invalid preferences data",
          errors: validationResult.error.errors 
        });
      }

      const preferences = await updateNotificationPreferences(
        req.user!.id, 
        validationResult.data
      );
      res.json(preferences);
    } catch (error) {
      console.error("Error updating preferences:", error);
      res.status(500).json({ message: "Failed to update preferences" });
    }
  });

  /**
   * Get available notification types (for UI)
   */
  app.get('/api/notifications/types', (req, res) => {
    res.json({
      types: NOTIFICATION_TYPES,
      descriptions: {
        message: "Chat messages from vendors or customers",
        booking: "Booking confirmations, updates, and reminders",
        referral: "Referral rewards and new sign-ups",
        service: "Service approval and status updates",
        payment: "Payment receipts and payout notifications",
        system: "Platform updates and announcements",
        review: "New reviews on your services",
        promotion: "Special offers and promotional content",
      },
    });
  });

  // ===========================================
  // PUSH NOTIFICATION SUBSCRIPTION
  // ===========================================

  /**
   * Get VAPID public key for push subscription
   */
  app.get('/api/push/vapid-key', (req, res) => {
    if (!isPushEnabled()) {
      return res.status(503).json({ 
        message: "Push notifications not configured",
        enabled: false 
      });
    }
    res.json({ 
      publicKey: getVapidPublicKey(),
      enabled: true 
    });
  });

  /**
   * Register a push subscription
   */
  app.post('/api/push/subscribe', isAuthenticated, async (req: any, res) => {
    try {
      if (!isPushEnabled()) {
        return res.status(503).json({ message: "Push notifications not configured" });
      }

      const { subscription, deviceInfo } = req.body;

      if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
        return res.status(400).json({ message: "Invalid subscription data" });
      }

      const result = await registerPushSubscription(
        req.user!.id,
        subscription,
        deviceInfo
      );

      // Enable push in user's preferences
      await updateNotificationPreferences(req.user!.id, { pushEnabled: true });

      res.status(201).json(result);
    } catch (error) {
      console.error("Error registering push subscription:", error);
      res.status(500).json({ message: "Failed to register subscription" });
    }
  });

  /**
   * Unregister a push subscription
   */
  app.post('/api/push/unsubscribe', isAuthenticated, async (req: any, res) => {
    try {
      const { endpoint } = req.body;

      if (!endpoint) {
        return res.status(400).json({ message: "Endpoint is required" });
      }

      const success = await unregisterPushSubscription(req.user!.id, endpoint);
      
      // Check if user has any remaining subscriptions
      const remaining = await getUserSubscriptions(req.user!.id);
      if (remaining.length === 0) {
        // Disable push in preferences if no subscriptions left
        await updateNotificationPreferences(req.user!.id, { pushEnabled: false });
      }

      res.json({ success });
    } catch (error) {
      console.error("Error unregistering push subscription:", error);
      res.status(500).json({ message: "Failed to unregister subscription" });
    }
  });

  /**
   * Get user's push subscriptions
   */
  app.get('/api/push/subscriptions', isAuthenticated, async (req: any, res) => {
    try {
      const subscriptions = await getUserSubscriptions(req.user!.id);
      res.json({ subscriptions });
    } catch (error) {
      console.error("Error fetching subscriptions:", error);
      res.status(500).json({ message: "Failed to fetch subscriptions" });
    }
  });

  // ===========================================
  // ADMIN NOTIFICATION ROUTES
  // ===========================================

  /**
   * Admin: Send system notification to all users
   */
  app.post('/api/admin/notifications/broadcast', isAdmin, async (req: any, res) => {
    try {
      const { title, message, actionUrl, userIds } = req.body;

      if (!title || !message) {
        return res.status(400).json({ message: "Title and message are required" });
      }

      // Get target users
      let targetUserIds: string[] = userIds;
      if (!userIds || userIds.length === 0) {
        // Get all user IDs
        const allUsers = await db.select({ id: users.id }).from(users);
        targetUserIds = allUsers.map(u => u.id);
      }

      // Create notifications for each user
      const results = await Promise.allSettled(
        targetUserIds.map(userId =>
          createNotification({
            userId,
            type: "system",
            title,
            message,
            actionUrl,
            skipAIPrioritization: true,
          })
        )
      );

      const successful = results.filter(r => r.status === "fulfilled").length;
      const failed = results.filter(r => r.status === "rejected").length;

      res.json({ 
        success: true, 
        sent: successful, 
        failed,
        total: targetUserIds.length 
      });
    } catch (error) {
      console.error("Error broadcasting notification:", error);
      res.status(500).json({ message: "Failed to broadcast notification" });
    }
  });

  /**
   * Admin: Get notification statistics
   */
  app.get('/api/admin/notifications/stats', isAdmin, async (req: any, res) => {
    try {
      // Get notification stats from DB
      const totalNotifications = await db.select({ count: sql<number>`count(*)::int` })
        .from(notifications);
      
      const unreadNotifications = await db.select({ count: sql<number>`count(*)::int` })
        .from(notifications)
        .where(eq(notifications.isRead, false));
      
      const pushSubscriptionsCount = await db.select({ count: sql<number>`count(*)::int` })
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.isActive, true));

      // Get notifications by type
      const byType = await db.select({
        type: notifications.type,
        count: sql<number>`count(*)::int`,
      })
        .from(notifications)
        .groupBy(notifications.type);

      res.json({
        total: totalNotifications[0]?.count || 0,
        unread: unreadNotifications[0]?.count || 0,
        pushSubscriptions: pushSubscriptionsCount[0]?.count || 0,
        byType: byType.reduce((acc, item) => ({ ...acc, [item.type]: item.count }), {}),
        pushEnabled: isPushEnabled(),
      });
    } catch (error) {
      console.error("Error fetching notification stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
