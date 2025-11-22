import { db } from "./db";
import { categories, users, services, reviews, plans } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

const CATEGORIES = [
  { name: "Home Services", slug: "home-services", icon: "Home" },
  { name: "Design & Creative", slug: "design-creative", icon: "Palette" },
  { name: "Education & Tutoring", slug: "education", icon: "GraduationCap" },
  { name: "Wellness & Fitness", slug: "wellness", icon: "Dumbbell" },
  { name: "Business Support", slug: "business", icon: "Briefcase" },
];

const SAMPLE_USERS = [
  {
    id: "demo-user-1",
    email: "maria.mueller@example.ch",
    firstName: "Maria",
    lastName: "Müller",
    profileImageUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Maria",
    isVerified: true,
    marketingPackage: "enterprise" as const,
  },
  {
    id: "demo-user-2",
    email: "hans.weber@example.ch",
    firstName: "Hans",
    lastName: "Weber",
    profileImageUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Hans",
    isVerified: true,
    marketingPackage: "basic" as const,
  },
  {
    id: "demo-user-3",
    email: "sophie.martin@example.ch",
    firstName: "Sophie",
    lastName: "Martin",
    profileImageUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sophie",
    isVerified: false,
    marketingPackage: "basic" as const,
  },
  {
    id: "demo-user-4",
    email: "thomas.schneider@example.ch",
    firstName: "Thomas",
    lastName: "Schneider",
    profileImageUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Thomas",
    isVerified: true,
    marketingPackage: "pro" as const,
  },
];

const DEFAULT_PLANS = [
  {
    name: "Free",
    slug: "free",
    description: "Get started with basic features",
    priceMonthly: "0.00",
    priceYearly: "0.00",
    maxImages: 2,
    listingDurationDays: 7,
    canRenew: true,
    featuredListing: false,
    prioritySupport: false,
    analyticsAccess: false,
    customBranding: false,
    isActive: true,
    sortOrder: 0,
  },
  {
    name: "Basic",
    slug: "basic",
    description: "Perfect for individual service providers",
    priceMonthly: "19.00",
    priceYearly: "190.00",
    maxImages: 4,
    listingDurationDays: 14,
    canRenew: true,
    featuredListing: false,
    prioritySupport: false,
    analyticsAccess: false,
    customBranding: false,
    isActive: true,
    sortOrder: 1,
  },
  {
    name: "Premium",
    slug: "premium",
    description: "Advanced features for growing businesses",
    priceMonthly: "49.00",
    priceYearly: "490.00",
    maxImages: 10,
    listingDurationDays: 30,
    canRenew: true,
    featuredListing: true,
    prioritySupport: true,
    analyticsAccess: true,
    customBranding: false,
    isActive: true,
    sortOrder: 2,
  },
  {
    name: "Enterprise",
    slug: "enterprise",
    description: "Full features for established businesses",
    priceMonthly: "99.00",
    priceYearly: "990.00",
    maxImages: 20,
    listingDurationDays: 60,
    canRenew: true,
    featuredListing: true,
    prioritySupport: true,
    analyticsAccess: true,
    customBranding: true,
    isActive: true,
    sortOrder: 3,
  },
];

export async function seedDatabase() {
  try {
    console.log("Seeding database...");

    // Seed plans first (before users, as users will reference plans)
    for (const plan of DEFAULT_PLANS) {
      const existing = await db
        .select()
        .from(plans)
        .where(eq(plans.slug, plan.slug));

      if (existing.length === 0) {
        await db.insert(plans).values(plan);
        console.log(`Created plan: ${plan.name}`);
      } else {
        console.log(`Plan already exists: ${plan.name}`);
      }
    }

    // Seed categories
    for (const category of CATEGORIES) {
      const existing = await db
        .select()
        .from(categories)
        .where(eq(categories.slug, category.slug));

      if (existing.length === 0) {
        await db.insert(categories).values(category);
        console.log(`Created category: ${category.name}`);
      } else {
        console.log(`Category already exists: ${category.name}`);
      }
    }

    // Get all categories for reference
    const allCategories = await db.select().from(categories);

    // Seed sample users
    for (const user of SAMPLE_USERS) {
      const existing = await db.select().from(users).where(eq(users.id, user.id));
      if (existing.length === 0) {
        await db.insert(users).values(user);
        console.log(`Created user: ${user.firstName} ${user.lastName}`);
      } else {
        console.log(`User already exists: ${user.firstName} ${user.lastName}`);
      }
    }

    // Seed sample services
    const homeCategory = allCategories.find((c) => c.slug === "home-services");
    const designCategory = allCategories.find((c) => c.slug === "design-creative");
    const educationCategory = allCategories.find((c) => c.slug === "education");
    const wellnessCategory = allCategories.find((c) => c.slug === "wellness");
    const businessCategory = allCategories.find((c) => c.slug === "business");

    if (!homeCategory || !designCategory || !educationCategory || !wellnessCategory || !businessCategory) {
      console.log("Skipping service seeding - not all categories found");
      return;
    }

    const SAMPLE_SERVICES = [
      {
        id: "demo-service-1",
        title: "Professional House Cleaning",
        description: "Thorough cleaning service for homes and apartments. Eco-friendly products, experienced team. Weekly or bi-weekly service available in Zurich area.",
        priceType: "fixed" as const,
        price: "45.00",
        priceUnit: "hour" as const,
        contactPhone: "+41 79 123 45 67",
        contactEmail: "maria.mueller@example.ch",
        locations: ["Zürich", "Winterthur"],
        ownerId: "demo-user-1",
        categoryId: homeCategory.id,
        status: "active" as const,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        viewCount: 234,
        images: ["https://images.unsplash.com/photo-1581578731548-c64695c952952v=1&crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=MnwxfDB8MXxyYW5kb218MHx8Y2xlYW5pbmd8fHx8fHwxNjk5Njc4Mjcw&ixlib=rb-4.0.3&q=80&utm_campaign=api-credit&utm_medium=referral&utm_source=unsplash_source&w=400"],
        tags: ["cleaning", "eco-friendly", "home"],
      },
      {
        id: "demo-service-2",
        title: "Modern Logo Design",
        description: "Custom logo design for startups and small businesses. 3 concepts, unlimited revisions, vector files included. Portfolio available upon request.",
        priceType: "fixed" as const,
        price: "350.00",
        priceUnit: "job" as const,
        contactPhone: "+41 76 987 65 43",
        contactEmail: "hans.weber@example.ch",
        locations: ["Bern", "Thun"],
        ownerId: "demo-user-2",
        categoryId: designCategory.id,
        status: "active" as const,
        expiresAt: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
        viewCount: 187,
        images: ["https://images.unsplash.com/photo-1561070791-2526d30994b5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=MnwxfDB8MXxyYW5kb218MHx8ZGVzaWdufHx8fHx8fDE2OTk2Nzg0MjE&ixlib=rb-4.0.3&q=80&utm_campaign=api-credit&utm_medium=referral&utm_source=unsplash_source&w=400"],
        tags: ["design", "logo", "branding"],
      },
      {
        id: "demo-service-3",
        title: "English Tutoring - All Levels",
        description: "Native English speaker offering one-on-one tutoring for all ages and levels. Specializing in business English and exam preparation (TOEFL, IELTS).",
        priceType: "fixed" as const,
        price: "55.00",
        priceUnit: "hour" as const,
        contactPhone: "+41 78 345 67 89",
        contactEmail: "sophie.martin@example.ch",
        locations: ["Geneva", "Online"],
        ownerId: "demo-user-3",
        categoryId: educationCategory.id,
        status: "active" as const,
        expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        viewCount: 156,
        images: ["https://images.unsplash.com/photo-1456406146555-c142cad53c7b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=MnwxfDB8MXxyYW5kb218MHx8dHV0b3Jpbmd8fHx8fHx8fDE2OTk2Nzg0NDA&ixlib=rb-4.0.3&q=80&utm_campaign=api-credit&utm_medium=referral&utm_source=unsplash_source&w=400"],
        tags: ["tutoring", "english", "education"],
      },
      {
        id: "demo-service-4",
        title: "Personal Fitness Training",
        description: "Certified personal trainer with 10+ years experience. Customized workout plans, nutrition guidance. Home visits or gym sessions available in Basel.",
        priceType: "fixed" as const,
        price: "80.00",
        priceUnit: "hour" as const,
        contactPhone: "+41 77 234 56 78",
        contactEmail: "thomas.schneider@example.ch",
        locations: ["Basel", "Liestal"],
        ownerId: "demo-user-4",
        categoryId: wellnessCategory.id,
        status: "active" as const,
        expiresAt: new Date(Date.now() + 13 * 24 * 60 * 60 * 1000),
        viewCount: 298,
        images: ["https://images.unsplash.com/photo-1534438327276-14e5300c3a48?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=MnwxfDB8MXxyYW5kb218MHx8Zml0bmVzc3x8fHx8fHwxNjk5Njc4NDU4&ixlib=rb-4.0.3&q=80&utm_campaign=api-credit&utm_medium=referral&utm_source=unsplash_source&w=400"],
        tags: ["fitness", "training", "health"],
      },
      {
        id: "demo-service-5",
        title: "Bookkeeping & Tax Preparation",
        description: "Professional bookkeeping services for small businesses and freelancers. Monthly financial reports, VAT filing, annual tax preparation. Fluent in German, French, and English.",
        priceType: "fixed" as const,
        price: "120.00",
        priceUnit: "consultation" as const,
        contactPhone: "+41 79 123 45 67",
        contactEmail: "maria.mueller@example.ch",
        locations: ["Zürich", "Remote"],
        ownerId: "demo-user-1",
        categoryId: businessCategory.id,
        status: "active" as const,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        viewCount: 142,
        images: ["https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=MnwxfDB8MXxyYW5kb218MHx8YWNjb3VudGluZ3x8fHx8fHwxNjk5Njc4NDcw&ixlib=rb-4.0.3&q=80&utm_campaign=api-credit&utm_medium=referral&utm_source=unsplash_source&w=400"],
        tags: ["accounting", "tax", "business"],
      },
      {
        id: "demo-service-6",
        title: "Garden Maintenance Service",
        description: "Complete garden care including mowing, trimming, planting, and seasonal cleanup. Serving Lausanne and surrounding areas. Weekly or monthly plans available.",
        priceType: "fixed" as const,
        price: "60.00",
        priceUnit: "hour" as const,
        contactPhone: "+41 77 234 56 78",
        contactEmail: "thomas.schneider@example.ch",
        locations: ["Lausanne", "Vevey", "Montreux"],
        ownerId: "demo-user-4",
        categoryId: homeCategory.id,
        status: "active" as const,
        expiresAt: new Date(Date.now() + 11 * 24 * 60 * 60 * 1000),
        viewCount: 89,
        images: ["https://images.unsplash.com/photo-1558618666-fcd25c85cd64?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=MnwxfDB8MXxyYW5kb218MHx8Z2FyZGVufHx8fHx8fDE2OTk2Nzg0ODg&ixlib=rb-4.0.3&q=80&utm_campaign=api-credit&utm_medium=referral&utm_source=unsplash_source&w=400"],
        tags: ["gardening", "maintenance", "outdoor"],
      },
    ];

    for (const service of SAMPLE_SERVICES) {
      const existing = await db.select().from(services).where(eq(services.id, service.id));
      if (existing.length === 0) {
        await db.insert(services).values(service);
        console.log(`Created service: ${service.title}`);
      } else {
        console.log(`Service already exists: ${service.title}`);
      }
    }

    // Seed sample reviews (only from verified users)
    const SAMPLE_REVIEWS = [
      {
        id: "demo-review-1",
        serviceId: "demo-service-1",
        userId: "demo-user-2",
        rating: 5,
        comment: "Maria's cleaning service is exceptional! Very thorough and professional. Highly recommend.",
      },
      {
        id: "demo-review-2",
        serviceId: "demo-service-1",
        userId: "demo-user-4",
        rating: 5,
        comment: "Outstanding service. Always on time and leaves the house spotless. Great value for money.",
      },
      {
        id: "demo-review-3",
        serviceId: "demo-service-2",
        userId: "demo-user-1",
        rating: 4,
        comment: "Good quality logo design. Hans was patient with revisions and delivered exactly what we needed.",
      },
      {
        id: "demo-review-4",
        serviceId: "demo-service-4",
        userId: "demo-user-1",
        rating: 5,
        comment: "Thomas is an amazing trainer! Lost 8kg in 3 months. Very knowledgeable and motivating.",
      },
      {
        id: "demo-review-5",
        serviceId: "demo-service-4",
        userId: "demo-user-2",
        rating: 5,
        comment: "Best fitness trainer in Basel! Personalized approach and great results.",
      },
    ];

    for (const review of SAMPLE_REVIEWS) {
      const existing = await db.select().from(reviews).where(eq(reviews.id, review.id));
      if (existing.length === 0) {
        await db.insert(reviews).values(review);
        console.log(`Created review for service: ${review.serviceId}`);
      } else {
        console.log(`Review already exists: ${review.id}`);
      }
    }

    console.log("Database seeding completed!");
  } catch (error) {
    console.error("Error seeding database:", error);
    // Don't throw - just log and continue
    console.log("Continuing despite seeding errors...");
  }
}
