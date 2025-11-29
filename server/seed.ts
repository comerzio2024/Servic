import { db } from "./db";
import { categories, subcategories, users, services, reviews, plans, chatConversations, chatMessages, notifications } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

const CATEGORIES = [
  { name: "Home Services", slug: "home-services", icon: "Home" },
  { name: "Design & Creative", slug: "design-creative", icon: "Palette" },
  { name: "Education & Tutoring", slug: "education", icon: "GraduationCap" },
  { name: "Wellness & Fitness", slug: "wellness", icon: "Dumbbell" },
  { name: "Business Support", slug: "business", icon: "Briefcase" },
  { name: "Automotive Services", slug: "automotive", icon: "Car" },
  { name: "Pet Care & Animals", slug: "pets", icon: "PawPrint" },
  { name: "Events & Entertainment", slug: "events", icon: "PartyPopper" },
  { name: "Legal & Financial", slug: "legal-financial", icon: "Scale" },
  { name: "Technology & IT", slug: "technology", icon: "Laptop" },
];

const SUBCATEGORIES = [
  // Home Services
  { name: "Cleaning & Housekeeping", slug: "cleaning-housekeeping", categorySlug: "home-services" },
  { name: "Plumbing & Electrical", slug: "plumbing-electrical", categorySlug: "home-services" },
  { name: "Painting & Renovation", slug: "painting-renovation", categorySlug: "home-services" },
  { name: "Garden & Landscaping", slug: "garden-landscaping", categorySlug: "home-services" },
  { name: "Moving & Delivery", slug: "moving-delivery", categorySlug: "home-services" },
  { name: "Handyman Services", slug: "handyman", categorySlug: "home-services" },

  // Design & Creative
  { name: "Logo & Branding", slug: "logo-branding", categorySlug: "design-creative" },
  { name: "Web & App Design", slug: "web-app-design", categorySlug: "design-creative" },
  { name: "Graphic Design", slug: "graphic-design", categorySlug: "design-creative" },
  { name: "Photography", slug: "photography", categorySlug: "design-creative" },
  { name: "Video Production", slug: "video-production", categorySlug: "design-creative" },
  { name: "Interior Design", slug: "interior-design", categorySlug: "design-creative" },

  // Education & Tutoring
  { name: "Language Lessons", slug: "language-lessons", categorySlug: "education" },
  { name: "Math & Science", slug: "math-science", categorySlug: "education" },
  { name: "Music Lessons", slug: "music-lessons", categorySlug: "education" },
  { name: "Exam Preparation", slug: "exam-prep", categorySlug: "education" },
  { name: "Adult Education", slug: "adult-education", categorySlug: "education" },
  { name: "Children's Tutoring", slug: "children-tutoring", categorySlug: "education" },

  // Wellness & Fitness
  { name: "Personal Training", slug: "personal-training", categorySlug: "wellness" },
  { name: "Yoga & Pilates", slug: "yoga-pilates", categorySlug: "wellness" },
  { name: "Massage Therapy", slug: "massage-therapy", categorySlug: "wellness" },
  { name: "Nutrition & Coaching", slug: "nutrition-coaching", categorySlug: "wellness" },
  { name: "Mental Health Support", slug: "mental-health", categorySlug: "wellness" },

  // Business Support
  { name: "Bookkeeping & Accounting", slug: "bookkeeping-accounting", categorySlug: "business" },
  { name: "Consulting & Strategy", slug: "consulting-strategy", categorySlug: "business" },
  { name: "Marketing & SEO", slug: "marketing-seo", categorySlug: "business" },
  { name: "Translation & Writing", slug: "translation-writing", categorySlug: "business" },
  { name: "HR & Recruitment", slug: "hr-recruitment", categorySlug: "business" },

  // Automotive Services
  { name: "Repair & Maintenance", slug: "repair-maintenance", categorySlug: "automotive" },
  { name: "Car Detailing & Cleaning", slug: "car-detailing", categorySlug: "automotive" },
  { name: "Tire Services", slug: "tire-services", categorySlug: "automotive" },
  { name: "Pre-Purchase Inspection", slug: "pre-purchase-inspection", categorySlug: "automotive" },
  { name: "Mobile Mechanics", slug: "mobile-mechanics", categorySlug: "automotive" },

  // Pet Care & Animals
  { name: "Dog Walking", slug: "dog-walking", categorySlug: "pets" },
  { name: "Pet Grooming", slug: "pet-grooming", categorySlug: "pets" },
  { name: "Veterinary Care", slug: "veterinary-care", categorySlug: "pets" },
  { name: "Pet Sitting & Boarding", slug: "pet-sitting-boarding", categorySlug: "pets" },
  { name: "Training & Behavior", slug: "training-behavior", categorySlug: "pets" },

  // Events & Entertainment
  { name: "Photography & Video", slug: "event-photo-video", categorySlug: "events" },
  { name: "Catering", slug: "catering", categorySlug: "events" },
  { name: "DJ & Music", slug: "dj-music", categorySlug: "events" },
  { name: "Event Planning", slug: "event-planning", categorySlug: "events" },
  { name: "Entertainment & Performers", slug: "entertainment-performers", categorySlug: "events" },

  // Legal & Financial
  { name: "Legal Consulting", slug: "legal-consulting", categorySlug: "legal-financial" },
  { name: "Immigration & Work Permits", slug: "immigration-permits", categorySlug: "legal-financial" },
  { name: "Financial Planning", slug: "financial-planning", categorySlug: "legal-financial" },
  { name: "Tax Preparation", slug: "tax-preparation", categorySlug: "legal-financial" },
  { name: "Notary Services", slug: "notary-services", categorySlug: "legal-financial" },

  // Technology & IT
  { name: "Computer Repair", slug: "computer-repair", categorySlug: "technology" },
  { name: "Software Development", slug: "software-development", categorySlug: "technology" },
  { name: "Network & Security", slug: "network-security", categorySlug: "technology" },
  { name: "Website Maintenance", slug: "website-maintenance", categorySlug: "technology" },
  { name: "Cloud & DevOps", slug: "cloud-devops", categorySlug: "technology" },
];

const SAMPLE_USERS = [
  {
    id: "admin-user",
    email: "admin@servemkt.ch",
    firstName: "Admin",
    lastName: "User",
    profileImageUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Admin",
    isVerified: true,
    isAdmin: true,
    marketingPackage: "enterprise" as const,
  },
  {
    id: "demo-user-1",
    email: "maria.mueller@example.ch",
    firstName: "Maria",
    lastName: "Müller",
    profileImageUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Maria",
    isVerified: true,
    marketingPackage: "enterprise" as const,
    locationLat: 47.3769,
    locationLng: 8.5417,
    preferredLocationName: "Zürich, Switzerland",
  },
  {
    id: "demo-user-2",
    email: "hans.weber@example.ch",
    firstName: "Hans",
    lastName: "Weber",
    profileImageUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Hans",
    isVerified: true,
    marketingPackage: "basic" as const,
    locationLat: 47.5596,
    locationLng: 7.5886,
    preferredLocationName: "Basel, Switzerland",
  },
  {
    id: "demo-user-3",
    email: "sophie.martin@example.ch",
    firstName: "Sophie",
    lastName: "Martin",
    profileImageUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sophie",
    isVerified: false,
    marketingPackage: "basic" as const,
    locationLat: 46.2044,
    locationLng: 6.1432,
    preferredLocationName: "Geneva, Switzerland",
  },
  {
    id: "demo-user-4",
    email: "thomas.schneider@example.ch",
    firstName: "Thomas",
    lastName: "Schneider",
    profileImageUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Thomas",
    isVerified: true,
    marketingPackage: "pro" as const,
    locationLat: 46.9481,
    locationLng: 7.4474,
    preferredLocationName: "Bern, Switzerland",
  },
  {
    id: "demo-user-5",
    email: "petra.fischer@example.ch",
    firstName: "Petra",
    lastName: "Fischer",
    profileImageUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Petra",
    isVerified: true,
    marketingPackage: "pro" as const,
    locationLat: 46.5197,
    locationLng: 6.6323,
    preferredLocationName: "Lausanne, Switzerland",
  },
  {
    id: "demo-user-6",
    email: "luca.rossi@example.ch",
    firstName: "Luca",
    lastName: "Rossi",
    profileImageUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Luca",
    isVerified: false,
    marketingPackage: "basic" as const,
    locationLat: 46.0037,
    locationLng: 8.9511,
    preferredLocationName: "Lugano, Switzerland",
  },
  {
    id: "demo-user-7",
    email: "anna.meier@example.ch",
    firstName: "Anna",
    lastName: "Meier",
    profileImageUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Anna",
    isVerified: true,
    marketingPackage: "premium" as const,
    locationLat: 47.4245,
    locationLng: 9.3767,
    preferredLocationName: "St. Gallen, Switzerland",
  },
  {
    id: "demo-user-8",
    email: "marco.gentile@example.ch",
    firstName: "Marco",
    lastName: "Gentile",
    profileImageUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Marco",
    isVerified: true,
    marketingPackage: "enterprise" as const,
    locationLat: 47.0502,
    locationLng: 8.3093,
    preferredLocationName: "Lucerne, Switzerland",
  },
  {
    id: "demo-user-9",
    email: "nina.brunner@example.ch",
    firstName: "Nina",
    lastName: "Brunner",
    profileImageUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Nina",
    isVerified: true,
    marketingPackage: "pro" as const,
    locationLat: 47.5001,
    locationLng: 8.7500,
    preferredLocationName: "Winterthur, Switzerland",
  },
  {
    id: "demo-user-10",
    email: "florian.roth@example.ch",
    firstName: "Florian",
    lastName: "Roth",
    profileImageUrl: "https://api.dicebear.com/7.x/avataaars/svg?seed=Florian",
    isVerified: true,
    marketingPackage: "premium" as const,
    locationLat: 46.8065,
    locationLng: 7.1620,
    preferredLocationName: "Fribourg, Switzerland",
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

/**
 * Reset the database by clearing all data tables
 * WARNING: This will delete all data! Use with caution.
 * @param confirmReset - Must be true to actually perform the reset (safety check)
 * @throws Error if confirmReset is not true or if in production without explicit confirmation
 */
export async function resetDatabase(confirmReset: boolean = false) {
  // Safety check: prevent accidental data loss
  if (!confirmReset) {
    throw new Error("resetDatabase requires confirmReset=true parameter to prevent accidental data loss");
  }
  
  // Additional safety: warn if running in production
  if (process.env.NODE_ENV === "production") {
    console.warn("⚠️  WARNING: Resetting database in PRODUCTION environment!");
    console.warn("⚠️  This will permanently delete all data!");
  }
  
  try {
    console.log("Resetting database...");
    
    // Delete in reverse order of dependencies
    console.log("Clearing notifications...");
    await db.delete(notifications);
    
    console.log("Clearing chat messages...");
    await db.delete(chatMessages);
    
    console.log("Clearing chat conversations...");
    await db.delete(chatConversations);
    
    console.log("Clearing reviews...");
    await db.delete(reviews);
    
    console.log("Clearing services...");
    await db.delete(services);
    
    console.log("Clearing subcategories...");
    await db.delete(subcategories);
    
    console.log("Clearing categories...");
    await db.delete(categories);
    
    console.log("Clearing users (except sessions)...");
    await db.delete(users);
    
    console.log("Clearing plans...");
    await db.delete(plans);
    
    console.log("Database reset complete!");
  } catch (error) {
    console.error("Error resetting database:", error);
    throw error;
  }
}

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

    // Seed subcategories
    for (const subcategory of SUBCATEGORIES) {
      // Find the parent category
      const parentCategory = allCategories.find((c) => c.slug === subcategory.categorySlug);
      
      if (!parentCategory) {
        console.log(`Skipping subcategory ${subcategory.name} - parent category ${subcategory.categorySlug} not found`);
        continue;
      }

      const existing = await db
        .select()
        .from(subcategories)
        .where(eq(subcategories.slug, subcategory.slug));

      if (existing.length === 0) {
        await db.insert(subcategories).values({
          name: subcategory.name,
          slug: subcategory.slug,
          categoryId: parentCategory.id,
        });
        console.log(`Created subcategory: ${subcategory.name}`);
      } else {
        console.log(`Subcategory already exists: ${subcategory.name}`);
      }
    }

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
    const automotiveCategory = allCategories.find((c) => c.slug === "automotive");
    const petsCategory = allCategories.find((c) => c.slug === "pets");
    const eventsCategory = allCategories.find((c) => c.slug === "events");
    const legalCategory = allCategories.find((c) => c.slug === "legal-financial");
    const technologyCategory = allCategories.find((c) => c.slug === "technology");

    if (!homeCategory || !designCategory || !educationCategory || !wellnessCategory || !businessCategory ||
        !automotiveCategory || !petsCategory || !eventsCategory || !legalCategory || !technologyCategory) {
      console.log("Skipping service seeding - not all categories found");
      return;
    }

    const SAMPLE_SERVICES = [
      // Home Services (demo-user-1 - Zurich area: 47.3769, 8.5417)
      {
        id: "demo-service-1",
        title: "Professional House Cleaning",
        description: "Thorough cleaning service for homes and apartments. Eco-friendly products, experienced team. Weekly or bi-weekly service available in Zurich area.",
        priceType: "fixed" as const,
        price: "45.00",
        priceUnit: "hour" as const,
        contactPhone: "+41 79 123 45 67",
        contactEmail: "maria.mueller@example.ch",
        locations: ["Bahnhofstrasse 50, 8001 Zürich"],
        locationLat: "47.3680",
        locationLng: "8.5395",
        ownerId: "demo-user-1",
        categoryId: homeCategory.id,
        status: "active" as const,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        viewCount: 234,
        images: ["https://images.unsplash.com/photo-1581578731548-c64695c952952?w=800", "https://images.unsplash.com/photo-1563453392212-326f5e854473?w=800"],
        tags: ["cleaning", "eco-friendly", "home"],
        hashtags: ["cleaning", "ecofriendly", "zurich"],
      },
      {
        id: "demo-service-7",
        title: "Apartment Painting & Renovation",
        description: "Professional interior and exterior painting. Expert color consultation, high-quality finishes. 15+ years experience. Free quotes.",
        priceType: "text" as const,
        priceText: "Call for quote",
        priceUnit: "job" as const,
        contactPhone: "+41 79 987 65 43",
        contactEmail: "painter.zurich@example.ch",
        locations: ["Langstrasse 120, 8004 Zürich"],
        locationLat: "47.3773",
        locationLng: "8.5256",
        ownerId: "demo-user-1",
        categoryId: homeCategory.id,
        status: "active" as const,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        viewCount: 156,
        images: ["https://images.unsplash.com/photo-1580274455191-1c62238fa333?w=800", "https://images.unsplash.com/photo-1562259929-b4e1fd3aef09?w=800"],
        tags: ["painting", "renovation", "interior"],
      },
      // Home Services (demo-user-2 - Basel area: 47.5596, 7.5886)
      {
        id: "demo-service-8",
        title: "Plumbing & Installation Services",
        description: "Expert plumbing repairs, installations, and maintenance. 24/7 emergency service available. Licensed and insured. Transparent pricing.",
        priceType: "fixed" as const,
        price: "85.00",
        priceUnit: "hour" as const,
        contactPhone: "+41 76 234 56 78",
        contactEmail: "plumber.ch@example.ch",
        locations: ["Freie Strasse 35, 4001 Basel"],
        locationLat: "47.5565",
        locationLng: "7.5905",
        ownerId: "demo-user-2",
        categoryId: homeCategory.id,
        status: "active" as const,
        expiresAt: new Date(Date.now() + 13 * 24 * 60 * 60 * 1000),
        viewCount: 198,
        images: ["https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800"],
        tags: ["plumbing", "repair", "maintenance"],
      },
      // Home Services (demo-user-4 - Bern area: 46.9480, 7.4474)
      {
        id: "demo-service-9",
        title: "Electrical Installation & Repair",
        description: "Licensed electrician offering installation, repair, and maintenance. Smart home integration, solar panel setup. Certified professionals.",
        priceType: "fixed" as const,
        price: "95.00",
        priceUnit: "hour" as const,
        contactPhone: "+41 77 456 78 90",
        contactEmail: "electrician.ch@example.ch",
        locations: ["Marktgasse 15, 3011 Bern"],
        locationLat: "46.9494",
        locationLng: "7.4484",
        ownerId: "demo-user-4",
        categoryId: homeCategory.id,
        status: "active" as const,
        expiresAt: new Date(Date.now() + 13 * 24 * 60 * 60 * 1000),
        viewCount: 167,
        images: ["https://images.unsplash.com/photo-1581092160562-40fed08a2816?w=800"],
        tags: ["electrical", "installation", "repair"],
      },
      {
        id: "demo-service-10",
        title: "Garden Maintenance Service",
        description: "Complete garden care including mowing, trimming, planting, and seasonal cleanup. Serving Bern and surrounding areas. Weekly or monthly plans available.",
        priceType: "fixed" as const,
        price: "60.00",
        priceUnit: "hour" as const,
        contactPhone: "+41 77 234 56 78",
        contactEmail: "thomas.schneider@example.ch",
        locations: ["Kramgasse 40, 3011 Bern"],
        locationLat: "46.9479",
        locationLng: "7.4516",
        ownerId: "demo-user-4",
        categoryId: homeCategory.id,
        status: "active" as const,
        expiresAt: new Date(Date.now() + 11 * 24 * 60 * 60 * 1000),
        viewCount: 89,
        images: ["https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800", "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800"],
        tags: ["gardening", "maintenance", "outdoor"],
      },

      // Design & Creative
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
        images: ["https://images.unsplash.com/photo-1561070791-2526d30994b5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg"],
        tags: ["design", "logo", "branding"],
        hashtags: ["logodesign", "branding", "startup"],
      },
      {
        id: "demo-service-11",
        title: "Web Design & Development",
        description: "Professional website design and development for businesses. Responsive, SEO-optimized, fast loading. Includes CMS training.",
        priceType: "text" as const,
        priceText: "Starting from CHF 1500",
        priceUnit: "job" as const,
        contactPhone: "+41 78 123 45 67",
        contactEmail: "webdev.ch@example.ch",
        locations: ["Zürich", "Remote"],
        ownerId: "demo-user-2",
        categoryId: designCategory.id,
        status: "active" as const,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        viewCount: 267,
        images: [
          "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?crop=entropy&cs=tinysrgb&fit=max&fm=jpg",
          "https://images.unsplash.com/photo-1547658719-da2b51169166?crop=entropy&cs=tinysrgb&fit=max&fm=jpg",
          "https://images.unsplash.com/photo-1498050108023-c5249f4df085?crop=entropy&cs=tinysrgb&fit=max&fm=jpg"
        ],
        tags: ["web design", "development", "programming"],
        hashtags: ["webdesign", "webdev", "programming"],
      },
      {
        id: "demo-service-12",
        title: "Graphic Design Services",
        description: "Branding, marketing materials, social media graphics. Print and digital design. Custom illustrations available. Fast turnaround.",
        priceType: "fixed" as const,
        price: "75.00",
        priceUnit: "hour" as const,
        contactPhone: "+41 79 654 32 10",
        contactEmail: "graphics@example.ch",
        locations: ["Geneva", "Online"],
        ownerId: "demo-user-1",
        categoryId: designCategory.id,
        status: "active" as const,
        expiresAt: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
        viewCount: 142,
        images: ["https://images.unsplash.com/photo-1561070791-2526d30994b5?crop=entropy&cs=tinysrgb&fit=max&fm=jpg"],
        tags: ["graphic design", "branding", "marketing"],
      },
      {
        id: "demo-service-13",
        title: "Professional Photography",
        description: "Corporate, event, and portrait photography. High-quality editing and retouching. Competitive rates. Digital and printed formats available.",
        priceType: "fixed" as const,
        price: "120.00",
        priceUnit: "hour" as const,
        contactPhone: "+41 76 345 67 89",
        contactEmail: "photo.ch@example.ch",
        locations: ["Basel", "Liestal"],
        ownerId: "demo-user-3",
        categoryId: designCategory.id,
        status: "active" as const,
        expiresAt: new Date(Date.now() + 13 * 24 * 60 * 60 * 1000),
        viewCount: 213,
        images: [
          "https://images.unsplash.com/photo-1502920917128-1aa500764cbd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg",
          "https://images.unsplash.com/photo-1542038784456-1ea8e935640e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg",
          "https://images.unsplash.com/photo-1471341971476-ae15ff5dd4ea?crop=entropy&cs=tinysrgb&fit=max&fm=jpg"
        ],
        tags: ["photography", "events", "corporate"],
        hashtags: ["photography", "basel", "events"],
      },
      {
        id: "demo-service-14",
        title: "Video Production & Editing",
        description: "Professional video production, editing, and animation for businesses. Corporate videos, commercials, social media content.",
        priceType: "text" as const,
        priceText: "Starting from CHF 2000",
        priceUnit: "job" as const,
        contactPhone: "+41 77 987 65 43",
        contactEmail: "video.ch@example.ch",
        locations: ["Bern", "Remote"],
        ownerId: "demo-user-4",
        categoryId: designCategory.id,
        status: "active" as const,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        viewCount: 198,
        images: ["https://images.unsplash.com/photo-1533928298208-27ff66555d0d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg"],
        tags: ["video production", "editing", "animation"],
      },

      // Education & Tutoring
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
        images: ["https://images.unsplash.com/photo-1456406146555-c142cad53c7b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg"],
        tags: ["tutoring", "english", "education"],
        hashtags: ["english", "tutoring", "online"],
      },
      {
        id: "demo-service-15",
        title: "Mathematics Tutoring - Primary to Secondary",
        description: "Patient mathematics tutor for students. Personalized learning approaches. Exam preparation included. Online or in-person lessons.",
        priceType: "fixed" as const,
        price: "50.00",
        priceUnit: "hour" as const,
        contactPhone: "+41 79 123 45 67",
        contactEmail: "math.tutor@example.ch",
        locations: ["Zürich", "Online"],
        ownerId: "demo-user-1",
        categoryId: educationCategory.id,
        status: "active" as const,
        expiresAt: new Date(Date.now() + 11 * 24 * 60 * 60 * 1000),
        viewCount: 134,
        images: ["https://images.unsplash.com/photo-1434190566539-7a0b3934a891?crop=entropy&cs=tinysrgb&fit=max&fm=jpg"],
        tags: ["math", "tutoring", "education"],
      },
      {
        id: "demo-service-16",
        title: "French Language Lessons",
        description: "Comprehensive French lessons from beginner to advanced. Native speaker instructor. Grammar, conversation, cultural immersion. Flexible scheduling.",
        priceType: "fixed" as const,
        price: "52.00",
        priceUnit: "hour" as const,
        contactPhone: "+41 76 567 89 01",
        contactEmail: "french.lessons@example.ch",
        locations: ["Bern", "Online"],
        ownerId: "demo-user-2",
        categoryId: educationCategory.id,
        status: "active" as const,
        expiresAt: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
        viewCount: 167,
        images: ["https://images.unsplash.com/photo-1456406146555-c142cad53c7b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg"],
        tags: ["french", "language", "tutoring"],
      },
      {
        id: "demo-service-17",
        title: "Piano & Music Lessons",
        description: "Professional piano teacher offering lessons for all ages and skill levels. Classical, pop, jazz. Focus on technique and musicality.",
        priceType: "fixed" as const,
        price: "60.00",
        priceUnit: "hour" as const,
        contactPhone: "+41 77 234 56 78",
        contactEmail: "music.lessons@example.ch",
        locations: ["Lausanne", "Online"],
        ownerId: "demo-user-4",
        categoryId: educationCategory.id,
        status: "active" as const,
        expiresAt: new Date(Date.now() + 11 * 24 * 60 * 60 * 1000),
        viewCount: 145,
        images: ["https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg"],
        tags: ["music", "piano", "lessons"],
      },

      // Wellness & Fitness
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
        images: [
          "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?crop=entropy&cs=tinysrgb&fit=max&fm=jpg",
          "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?crop=entropy&cs=tinysrgb&fit=max&fm=jpg",
          "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?crop=entropy&cs=tinysrgb&fit=max&fm=jpg",
          "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg"
        ],
        tags: ["fitness", "training", "health"],
      },
      {
        id: "demo-service-18",
        title: "Yoga Classes & Private Sessions",
        description: "Vinyasa, Hatha, and restorative yoga. Small group classes and private sessions. All levels welcome. Beginner-friendly.",
        priceType: "fixed" as const,
        price: "45.00",
        priceUnit: "class" as const,
        contactPhone: "+41 79 789 01 23",
        contactEmail: "yoga.ch@example.ch",
        locations: ["Zürich", "Online"],
        ownerId: "demo-user-3",
        categoryId: wellnessCategory.id,
        status: "active" as const,
        expiresAt: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
        viewCount: 189,
        images: ["https://images.unsplash.com/photo-1506126613408-eca07ce68773?crop=entropy&cs=tinysrgb&fit=max&fm=jpg"],
        tags: ["yoga", "wellness", "fitness"],
      },
      {
        id: "demo-service-19",
        title: "Massage Therapy & Wellness",
        description: "Swedish, deep tissue, and sports massage. Relaxation and therapeutic treatments. Professional therapist with 8 years experience.",
        priceType: "fixed" as const,
        price: "90.00",
        priceUnit: "hour" as const,
        contactPhone: "+41 76 456 78 90",
        contactEmail: "massage.ch@example.ch",
        locations: ["Geneva", "Carouge"],
        ownerId: "demo-user-1",
        categoryId: wellnessCategory.id,
        status: "active" as const,
        expiresAt: new Date(Date.now() + 13 * 24 * 60 * 60 * 1000),
        viewCount: 176,
        images: ["https://images.unsplash.com/photo-1544367567-0d6fcffe7f1f?crop=entropy&cs=tinysrgb&fit=max&fm=jpg"],
        tags: ["massage", "wellness", "therapy"],
      },
      {
        id: "demo-service-20",
        title: "Nutrition Consulting & Meal Planning",
        description: "Personalized nutrition plans based on your health goals. Dietary assessments, meal prep guidance. Work with registered dietitian.",
        priceType: "fixed" as const,
        price: "85.00",
        priceUnit: "consultation" as const,
        contactPhone: "+41 77 567 89 01",
        contactEmail: "nutrition.ch@example.ch",
        locations: ["Bern", "Online"],
        ownerId: "demo-user-2",
        categoryId: wellnessCategory.id,
        status: "active" as const,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        viewCount: 152,
        images: ["https://images.unsplash.com/photo-1512621776951-a57141f2eefd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg"],
        tags: ["nutrition", "health", "consulting"],
      },
      {
        id: "demo-service-21",
        title: "Mental Health Coaching",
        description: "Life coaching for stress management, motivation, and personal development. Confidential sessions. Evidence-based approaches.",
        priceType: "fixed" as const,
        price: "75.00",
        priceUnit: "session" as const,
        contactPhone: "+41 78 678 90 12",
        contactEmail: "coaching.ch@example.ch",
        locations: ["Lausanne", "Online"],
        ownerId: "demo-user-4",
        categoryId: wellnessCategory.id,
        status: "active" as const,
        expiresAt: new Date(Date.now() + 13 * 24 * 60 * 60 * 1000),
        viewCount: 198,
        images: ["https://images.unsplash.com/photo-1552664730-d307ca884978?crop=entropy&cs=tinysrgb&fit=max&fm=jpg"],
        tags: ["coaching", "wellness", "mental-health"],
      },

      // Business Support
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
        images: ["https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?crop=entropy&cs=tinysrgb&fit=max&fm=jpg"],
        tags: ["accounting", "tax", "business"],
      },
      {
        id: "demo-service-22",
        title: "Business Consulting & Strategy",
        description: "Strategic business planning, market analysis, and growth strategies. Experienced consultant. Free initial consultation.",
        priceType: "fixed" as const,
        price: "150.00",
        priceUnit: "hour" as const,
        contactPhone: "+41 79 234 56 78",
        contactEmail: "consultant.ch@example.ch",
        locations: ["Zürich", "Remote"],
        ownerId: "demo-user-2",
        categoryId: businessCategory.id,
        status: "active" as const,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        viewCount: 134,
        images: ["https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?crop=entropy&cs=tinysrgb&fit=max&fm=jpg"],
        tags: ["consulting", "strategy", "business"],
      },
      {
        id: "demo-service-23",
        title: "Business Translation Services",
        description: "Professional translation for documents, websites, and communications. German, French, English, Italian. Quick turnaround guaranteed.",
        priceType: "fixed" as const,
        price: "0.25",
        priceUnit: "word" as const,
        contactPhone: "+41 76 789 01 23",
        contactEmail: "translate.ch@example.ch",
        locations: ["Bern", "Remote"],
        ownerId: "demo-user-3",
        categoryId: businessCategory.id,
        status: "active" as const,
        expiresAt: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
        viewCount: 107,
        images: ["https://images.unsplash.com/photo-1441974231531-c6227db76b6e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg"],
        tags: ["translation", "business", "language"],
      },
      {
        id: "demo-service-24",
        title: "Digital Marketing & SEO",
        description: "Social media management, SEO optimization, content marketing. Increase your online visibility. Transparent reporting.",
        priceType: "text" as const,
        priceText: "Starting from CHF 500/month",
        priceUnit: "job" as const,
        contactPhone: "+41 77 890 12 34",
        contactEmail: "marketing.ch@example.ch",
        locations: ["Basel", "Remote"],
        ownerId: "demo-user-4",
        categoryId: businessCategory.id,
        status: "active" as const,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        viewCount: 267,
        images: ["https://images.unsplash.com/photo-1460925895917-adf4e565e479?crop=entropy&cs=tinysrgb&fit=max&fm=jpg"],
        tags: ["marketing", "seo", "digital"],
      },
      {
        id: "demo-service-25",
        title: "HR Consulting & Recruitment",
        description: "HR strategy, recruitment, and employee development. Specialized in tech and creative industries.",
        priceType: "text" as const,
        priceText: "Call for quote",
        priceUnit: "job" as const,
        contactPhone: "+41 78 901 23 45",
        contactEmail: "hr.ch@example.ch",
        locations: ["Lausanne", "Remote"],
        ownerId: "demo-user-1",
        categoryId: businessCategory.id,
        status: "active" as const,
        expiresAt: new Date(Date.now() + 13 * 24 * 60 * 60 * 1000),
        viewCount: 123,
        images: ["https://images.unsplash.com/photo-1552664730-d307ca884978?crop=entropy&cs=tinysrgb&fit=max&fm=jpg"],
        tags: ["hr", "recruitment", "business"],
      },

      // Additional Education & Tutoring
      {
        id: "demo-service-26",
        title: "German Language Courses",
        description: "Learn German with experienced native speaker. A1 to C2 levels. Conversation practice, grammar, business German. Individual or group lessons.",
        priceType: "fixed" as const,
        price: "48.00",
        priceUnit: "hour" as const,
        contactPhone: "+41 79 345 67 89",
        contactEmail: "german.lessons@example.ch",
        locations: ["St. Gallen", "Online"],
        ownerId: "demo-user-5",
        categoryId: educationCategory.id,
        status: "active" as const,
        expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        viewCount: 178,
        images: ["https://picsum.photos/seed/german-teacher/800/600"],
        tags: ["german", "language", "tutoring"],
      },

      // Automotive Services
      {
        id: "demo-service-27",
        title: "Mobile Auto Repair & Maintenance",
        description: "Professional mobile mechanic service. Oil changes, brake service, diagnostics. We come to you! Serving Zürich and surrounding areas.",
        priceType: "fixed" as const,
        price: "95.00",
        priceUnit: "hour" as const,
        contactPhone: "+41 79 567 89 01",
        contactEmail: "mobile.mechanic@example.ch",
        locations: ["Zürich", "Winterthur", "Zug"],
        ownerId: "demo-user-5",
        categoryId: automotiveCategory.id,
        status: "active" as const,
        expiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        viewCount: 245,
        images: ["https://picsum.photos/seed/auto-mechanic/800/600"],
        tags: ["auto repair", "maintenance", "mobile service"],
      },
      {
        id: "demo-service-28",
        title: "Car Detailing & Professional Cleaning",
        description: "Interior and exterior detailing. Paint correction, ceramic coating, steam cleaning. Premium products. Your car will look brand new!",
        priceType: "text" as const,
        priceText: "Starting from CHF 150",
        priceUnit: "job" as const,
        contactPhone: "+41 76 678 90 12",
        contactEmail: "cardetail.ch@example.ch",
        locations: ["Basel", "Liestal"],
        ownerId: "demo-user-6",
        categoryId: automotiveCategory.id,
        status: "active" as const,
        expiresAt: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
        viewCount: 167,
        images: ["https://picsum.photos/seed/car-detailing/800/600"],
        tags: ["car detailing", "cleaning", "automotive"],
      },
      {
        id: "demo-service-29",
        title: "Tire Service & Seasonal Storage",
        description: "Tire changes, balancing, alignment. Seasonal tire storage available. Mobile service or at our workshop. All brands.",
        priceType: "fixed" as const,
        price: "65.00",
        priceUnit: "job" as const,
        contactPhone: "+41 77 789 01 23",
        contactEmail: "tires.ch@example.ch",
        locations: ["Bern", "Thun", "Biel"],
        ownerId: "demo-user-7",
        categoryId: automotiveCategory.id,
        status: "active" as const,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        viewCount: 203,
        images: ["https://picsum.photos/seed/tire-service/800/600"],
        tags: ["tires", "seasonal", "automotive"],
      },
      {
        id: "demo-service-30",
        title: "Pre-Purchase Car Inspection",
        description: "Comprehensive vehicle inspection before you buy. Detailed report on condition, mechanical issues, accident history. Peace of mind guaranteed.",
        priceType: "fixed" as const,
        price: "180.00",
        priceUnit: "job" as const,
        contactPhone: "+41 78 890 12 34",
        contactEmail: "carinspection@example.ch",
        locations: ["Geneva", "Lausanne", "Vevey"],
        ownerId: "demo-user-8",
        categoryId: automotiveCategory.id,
        status: "expired" as const,
        expiresAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        viewCount: 134,
        images: ["https://picsum.photos/seed/car-inspection/800/600"],
        tags: ["inspection", "pre-purchase", "automotive"],
      },

      // Pet Care & Animals
      {
        id: "demo-service-31",
        title: "Professional Dog Walking Service",
        description: "Reliable dog walking for busy pet owners. Individual or group walks. Experienced with all breeds and temperaments. GPS tracking included.",
        priceType: "fixed" as const,
        price: "25.00",
        priceUnit: "walk" as const,
        contactPhone: "+41 79 901 23 45",
        contactEmail: "dogwalker@example.ch",
        locations: ["Zürich", "Oerlikon", "Altstetten"],
        ownerId: "demo-user-5",
        categoryId: petsCategory.id,
        status: "active" as const,
        expiresAt: new Date(Date.now() + 11 * 24 * 60 * 60 * 1000),
        viewCount: 289,
        images: ["https://picsum.photos/seed/dog-walking/800/600"],
        tags: ["dog walking", "pets", "care"],
      },
      {
        id: "demo-service-32",
        title: "Mobile Pet Grooming",
        description: "Professional grooming at your doorstep. Bathing, trimming, nail clipping. Stress-free experience for your pet. All breeds welcome.",
        priceType: "text" as const,
        priceText: "From CHF 60 depending on size",
        priceUnit: "job" as const,
        contactPhone: "+41 76 012 34 56",
        contactEmail: "petgrooming@example.ch",
        locations: ["Basel", "Allschwil", "Muttenz"],
        ownerId: "demo-user-6",
        categoryId: petsCategory.id,
        status: "active" as const,
        expiresAt: new Date(Date.now() + 13 * 24 * 60 * 60 * 1000),
        viewCount: 198,
        images: ["https://picsum.photos/seed/pet-grooming/800/600"],
        tags: ["grooming", "pets", "mobile"],
      },
      {
        id: "demo-service-33",
        title: "Veterinary Home Visits",
        description: "Experienced vet offering home visits for elderly pets or anxious animals. Vaccinations, check-ups, minor treatments. Compassionate care.",
        priceType: "fixed" as const,
        price: "120.00",
        priceUnit: "visit" as const,
        contactPhone: "+41 77 123 45 67",
        contactEmail: "homevet@example.ch",
        locations: ["Bern", "Köniz", "Ostermundigen"],
        ownerId: "demo-user-7",
        categoryId: petsCategory.id,
        status: "active" as const,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        viewCount: 156,
        images: ["https://picsum.photos/seed/veterinary/800/600"],
        tags: ["veterinary", "pets", "health"],
      },
      {
        id: "demo-service-34",
        title: "Pet Sitting & Boarding",
        description: "Loving pet care in our home while you're away. Dogs, cats, small animals. Daily updates with photos. Large secure garden. References available.",
        priceType: "fixed" as const,
        price: "35.00",
        priceUnit: "day" as const,
        contactPhone: "+41 78 234 56 78",
        contactEmail: "petsitter@example.ch",
        locations: ["Lucerne", "Kriens"],
        ownerId: "demo-user-8",
        categoryId: petsCategory.id,
        status: "active" as const,
        expiresAt: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
        viewCount: 223,
        images: ["https://picsum.photos/seed/pet-sitting/800/600"],
        tags: ["pet sitting", "boarding", "care"],
      },

      // Events & Entertainment
      {
        id: "demo-service-35",
        title: "Wedding Photography & Videography",
        description: "Capture your special day beautifully. Full day coverage, edited photos and video. Multiple packages available. Award-winning photographer.",
        priceType: "text" as const,
        priceText: "Packages from CHF 2500",
        priceUnit: "job" as const,
        contactPhone: "+41 79 345 67 89",
        contactEmail: "weddingphoto@example.ch",
        locations: ["Zürich", "Lucerne", "St. Gallen"],
        ownerId: "demo-user-5",
        categoryId: eventsCategory.id,
        status: "active" as const,
        expiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        viewCount: 312,
        images: ["https://picsum.photos/seed/wedding-photo/800/600"],
        tags: ["wedding", "photography", "events"],
      },
      {
        id: "demo-service-36",
        title: "DJ & Sound System Rental",
        description: "Professional DJ services for weddings, parties, corporate events. High-quality sound equipment. Extensive music library. Lighting available.",
        priceType: "fixed" as const,
        price: "500.00",
        priceUnit: "event" as const,
        contactPhone: "+41 76 456 78 90",
        contactEmail: "dj.events@example.ch",
        locations: ["Geneva", "Lausanne", "Montreux"],
        ownerId: "demo-user-6",
        categoryId: eventsCategory.id,
        status: "active" as const,
        expiresAt: new Date(Date.now() + 13 * 24 * 60 * 60 * 1000),
        viewCount: 267,
        images: ["https://picsum.photos/seed/dj-events/800/600"],
        tags: ["dj", "music", "events"],
      },
      {
        id: "demo-service-37",
        title: "Event Catering Service",
        description: "Delicious catering for all occasions. Swiss and international cuisine. From intimate dinners to large parties. Custom menus available.",
        priceType: "text" as const,
        priceText: "CHF 45 per person minimum",
        priceUnit: "job" as const,
        contactPhone: "+41 77 567 89 01",
        contactEmail: "catering@example.ch",
        locations: ["Basel", "Zürich", "Bern"],
        ownerId: "demo-user-7",
        categoryId: eventsCategory.id,
        status: "active" as const,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        viewCount: 234,
        images: ["https://picsum.photos/seed/catering/800/600"],
        tags: ["catering", "food", "events"],
      },
      {
        id: "demo-service-38",
        title: "Magic Shows & Entertainment",
        description: "Professional magician for children's parties and events. Interactive shows, balloon animals, face painting. Unforgettable entertainment!",
        priceType: "fixed" as const,
        price: "350.00",
        priceUnit: "event" as const,
        contactPhone: "+41 78 678 90 12",
        contactEmail: "magicshows@example.ch",
        locations: ["Bern", "Thun", "Fribourg"],
        ownerId: "demo-user-8",
        categoryId: eventsCategory.id,
        status: "expired" as const,
        expiresAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        viewCount: 189,
        images: ["https://picsum.photos/seed/magic-show/800/600"],
        tags: ["magic", "entertainment", "children"],
      },

      // Legal & Financial
      {
        id: "demo-service-39",
        title: "Immigration & Work Permit Lawyer",
        description: "Specialized in Swiss immigration law. Work permits, family reunification, naturalization. Multilingual service. Free initial consultation.",
        priceType: "fixed" as const,
        price: "250.00",
        priceUnit: "hour" as const,
        contactPhone: "+41 79 789 01 23",
        contactEmail: "immigration.law@example.ch",
        locations: ["Zürich", "Geneva", "Basel"],
        ownerId: "demo-user-5",
        categoryId: legalCategory.id,
        status: "active" as const,
        expiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        viewCount: 298,
        images: ["https://picsum.photos/seed/immigration-lawyer/800/600"],
        tags: ["immigration", "law", "permits"],
      },
      {
        id: "demo-service-40",
        title: "Financial Planning & Investment Advisory",
        description: "Independent financial advisor. Retirement planning, investment strategies, tax optimization. Certified wealth manager. Client-focused approach.",
        priceType: "fixed" as const,
        price: "200.00",
        priceUnit: "consultation" as const,
        contactPhone: "+41 76 890 12 34",
        contactEmail: "financial.advisory@example.ch",
        locations: ["Zürich", "Zug", "Lucerne"],
        ownerId: "demo-user-6",
        categoryId: legalCategory.id,
        status: "active" as const,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        viewCount: 267,
        images: ["https://picsum.photos/seed/financial-advisor/800/600"],
        tags: ["finance", "investment", "planning"],
      },
      {
        id: "demo-service-41",
        title: "Notary Public Services",
        description: "Certified notary for contracts, wills, property transactions. Document authentication and legalization. Flexible appointment times.",
        priceType: "text" as const,
        priceText: "Fees according to official tariff",
        priceUnit: "job" as const,
        contactPhone: "+41 77 901 23 45",
        contactEmail: "notary@example.ch",
        locations: ["Bern", "Lausanne"],
        ownerId: "demo-user-7",
        categoryId: legalCategory.id,
        status: "active" as const,
        expiresAt: new Date(Date.now() + 13 * 24 * 60 * 60 * 1000),
        viewCount: 178,
        images: ["https://picsum.photos/seed/notary/800/600"],
        tags: ["notary", "legal", "documents"],
      },
      {
        id: "demo-service-42",
        title: "Debt Collection & Recovery",
        description: "Professional debt collection services for businesses. Legal compliance guaranteed. No cure, no pay. Experienced team with high success rate.",
        priceType: "text" as const,
        priceText: "Commission based - call for details",
        priceUnit: "job" as const,
        contactPhone: "+41 78 012 34 56",
        contactEmail: "debtcollection@example.ch",
        locations: ["Basel", "Zürich", "Remote"],
        ownerId: "demo-user-8",
        categoryId: legalCategory.id,
        status: "active" as const,
        expiresAt: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
        viewCount: 145,
        images: ["https://picsum.photos/seed/debt-collection/800/600"],
        tags: ["debt", "collection", "legal"],
      },

      // Technology & IT
      {
        id: "demo-service-43",
        title: "Computer Repair & IT Support",
        description: "Fast computer repair, virus removal, data recovery. Home and office visits. PC and Mac specialists. Same-day service available.",
        priceType: "fixed" as const,
        price: "85.00",
        priceUnit: "hour" as const,
        contactPhone: "+41 79 123 45 67",
        contactEmail: "it.support@example.ch",
        locations: ["Zürich", "Winterthur", "Uster"],
        ownerId: "demo-user-5",
        categoryId: technologyCategory.id,
        status: "active" as const,
        expiresAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        viewCount: 312,
        images: ["https://picsum.photos/seed/computer-repair/800/600"],
        tags: ["computer", "repair", "it support"],
        hashtags: ["computer", "repair", "itsupport"],
      },
      {
        id: "demo-service-44",
        title: "Network Setup & Cybersecurity",
        description: "Professional network installation for homes and businesses. WiFi optimization, firewall configuration, security audits. Ongoing support available.",
        priceType: "text" as const,
        priceText: "Starting from CHF 500",
        priceUnit: "job" as const,
        contactPhone: "+41 76 234 56 78",
        contactEmail: "network.setup@example.ch",
        locations: ["Geneva", "Lausanne", "Remote"],
        ownerId: "demo-user-6",
        categoryId: technologyCategory.id,
        status: "active" as const,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        viewCount: 223,
        images: ["https://picsum.photos/seed/network-security/800/600"],
        tags: ["network", "security", "it"],
      },
      {
        id: "demo-service-45",
        title: "Custom Software Development",
        description: "Bespoke software solutions for businesses. Web apps, mobile apps, automation tools. Experienced developers. Agile methodology.",
        priceType: "fixed" as const,
        price: "120.00",
        priceUnit: "hour" as const,
        contactPhone: "+41 77 345 67 89",
        contactEmail: "software.dev@example.ch",
        locations: ["Zürich", "Remote"],
        ownerId: "demo-user-7",
        categoryId: technologyCategory.id,
        status: "active" as const,
        expiresAt: new Date(Date.now() + 13 * 24 * 60 * 60 * 1000),
        viewCount: 289,
        images: ["https://picsum.photos/seed/software-dev/800/600"],
        tags: ["software", "development", "programming"],
      },
      {
        id: "demo-service-46",
        title: "Cloud Migration & DevOps",
        description: "Expert cloud infrastructure setup and migration. AWS, Azure, Google Cloud. CI/CD pipelines, containerization, monitoring. Save costs and improve reliability.",
        priceType: "text" as const,
        priceText: "Project-based pricing - contact us",
        priceUnit: "job" as const,
        contactPhone: "+41 78 456 78 90",
        contactEmail: "cloud.devops@example.ch",
        locations: ["Basel", "Zürich", "Remote"],
        ownerId: "demo-user-8",
        categoryId: technologyCategory.id,
        status: "expired" as const,
        expiresAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        viewCount: 198,
        images: ["https://picsum.photos/seed/cloud-devops/800/600"],
        tags: ["cloud", "devops", "infrastructure"],
      },
    ];

    // Mapping of owner IDs to their base coordinates (Swiss cities)
    const ownerCoordinates: Record<string, { lat: number; lng: number }> = {
      "demo-user-1": { lat: 47.3769, lng: 8.5417 },   // Zurich
      "demo-user-2": { lat: 47.5596, lng: 7.5886 },   // Basel
      "demo-user-3": { lat: 46.2044, lng: 6.1432 },   // Geneva
      "demo-user-4": { lat: 46.9480, lng: 7.4474 },   // Bern
      "demo-user-5": { lat: 46.5197, lng: 6.6323 },   // Lausanne
      "demo-user-6": { lat: 46.0037, lng: 8.9511 },   // Lugano
      "demo-user-7": { lat: 47.4245, lng: 9.3767 },   // St. Gallen
      "demo-user-8": { lat: 47.0502, lng: 8.3093 },   // Lucerne
      "demo-user-9": { lat: 47.5001, lng: 8.7500 },   // Winterthur
      "demo-user-10": { lat: 46.8065, lng: 7.1620 },  // Fribourg
    };

    // Coordinate variation constants for service locations
    // Each unit of 0.001 degrees is approximately 111 meters at Swiss latitudes
    const COORD_VARIATION_STEP = 0.001; // ~111m per step
    const COORD_VARIATION_MAX = 0.01;   // Maximum ~1.1km variation from base

    // Auto-generate hashtags and coordinates from tags for services that don't have them
    let serviceCounter = 0;
    const servicesWithHashtags = SAMPLE_SERVICES.map(service => {
      serviceCounter++;
      const baseCoords = ownerCoordinates[service.ownerId] || { lat: 47.3769, lng: 8.5417 };
      // Add slight variation to coordinates to spread services within city area
      const variation = (serviceCounter * COORD_VARIATION_STEP) % COORD_VARIATION_MAX;
      
      return {
        ...service,
        hashtags: service.hashtags || service.tags.map(tag => tag.toLowerCase().replace(/\s+/g, '')),
        // Only add coordinates if not already present
        locationLat: service.locationLat || String(baseCoords.lat + variation),
        locationLng: service.locationLng || String(baseCoords.lng + variation),
      };
    });

    for (const service of servicesWithHashtags) {
      const existing = await db.select().from(services).where(eq(services.id, service.id));
      if (existing.length === 0) {
        await db.insert(services).values(service);
        console.log(`Created service: ${service.title}`);
      } else {
        // Update existing service with hashtags if missing
        if (!existing[0].hashtags || existing[0].hashtags.length === 0) {
          await db.update(services)
            .set({ hashtags: service.hashtags })
            .where(eq(services.id, service.id));
          console.log(`Updated hashtags for: ${service.title}`);
        } else {
          console.log(`Service already exists: ${service.title}`);
        }
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
      {
        id: "demo-review-6",
        serviceId: "demo-service-8",
        userId: "demo-user-1",
        rating: 5,
        comment: "Excellent plumber! Fixed our leak quickly and professionally. Fair pricing too.",
      },
      {
        id: "demo-review-7",
        serviceId: "demo-service-8",
        userId: "demo-user-4",
        rating: 4,
        comment: "Very reliable and knowledgeable. Solved our plumbing issue efficiently.",
      },
      {
        id: "demo-review-8",
        serviceId: "demo-service-11",
        userId: "demo-user-4",
        rating: 5,
        comment: "Beautiful website design! Very professional and delivered on time. Great communication throughout.",
      },
      {
        id: "demo-review-9",
        serviceId: "demo-service-11",
        userId: "demo-user-5",
        rating: 5,
        comment: "Fantastic work! Our new website looks amazing and loads super fast. Highly recommended!",
      },
      {
        id: "demo-review-10",
        serviceId: "demo-service-13",
        userId: "demo-user-2",
        rating: 5,
        comment: "Amazing photographer! Captured our corporate event perfectly. Very professional.",
      },
      {
        id: "demo-review-11",
        serviceId: "demo-service-15",
        userId: "demo-user-2",
        rating: 4,
        comment: "Patient and effective tutor. My son's math grades improved significantly!",
      },
      {
        id: "demo-review-12",
        serviceId: "demo-service-15",
        userId: "demo-user-4",
        rating: 5,
        comment: "Excellent teacher! Makes math fun and easy to understand.",
      },
      {
        id: "demo-review-13",
        serviceId: "demo-service-18",
        userId: "demo-user-1",
        rating: 5,
        comment: "Love the yoga classes! Great instructor and welcoming atmosphere.",
      },
      {
        id: "demo-review-14",
        serviceId: "demo-service-18",
        userId: "demo-user-2",
        rating: 5,
        comment: "Best yoga studio in Zürich! I feel so much better after each session.",
      },
      {
        id: "demo-review-15",
        serviceId: "demo-service-20",
        userId: "demo-user-4",
        rating: 5,
        comment: "The meal plans are perfect! Lost 5kg and feel healthier. Professional advice throughout.",
      },
      {
        id: "demo-review-16",
        serviceId: "demo-service-22",
        userId: "demo-user-1",
        rating: 4,
        comment: "Solid business advice. Helped us refine our strategy and identify new opportunities.",
      },
      {
        id: "demo-review-17",
        serviceId: "demo-service-24",
        userId: "demo-user-2",
        rating: 5,
        comment: "Our website traffic doubled in 3 months! Great SEO and marketing expertise.",
      },
      {
        id: "demo-review-18",
        serviceId: "demo-service-24",
        userId: "demo-user-5",
        rating: 5,
        comment: "Fantastic results! Very knowledgeable team and transparent reporting.",
      },
      {
        id: "demo-review-19",
        serviceId: "demo-service-27",
        userId: "demo-user-2",
        rating: 5,
        comment: "Super convenient! Fixed my car at home. Very professional mobile mechanic.",
      },
      {
        id: "demo-review-20",
        serviceId: "demo-service-27",
        userId: "demo-user-7",
        rating: 4,
        comment: "Great service! Saved me a trip to the garage. Fair prices.",
      },
      {
        id: "demo-review-21",
        serviceId: "demo-service-28",
        userId: "demo-user-1",
        rating: 5,
        comment: "My car looks brand new! Amazing attention to detail. Worth every franc!",
      },
      {
        id: "demo-review-22",
        serviceId: "demo-service-31",
        userId: "demo-user-2",
        rating: 5,
        comment: "Reliable dog walker! My dog loves him and always comes back happy and tired.",
      },
      {
        id: "demo-review-23",
        serviceId: "demo-service-31",
        userId: "demo-user-7",
        rating: 5,
        comment: "Best dog walker in Zürich! Very responsible and great with dogs.",
      },
      {
        id: "demo-review-24",
        serviceId: "demo-service-31",
        userId: "demo-user-8",
        rating: 4,
        comment: "Good service, always on time and my dog is well taken care of.",
      },
      {
        id: "demo-review-25",
        serviceId: "demo-service-32",
        userId: "demo-user-1",
        rating: 5,
        comment: "Excellent groomer! My dog looks and smells amazing. Very gentle and professional.",
      },
      {
        id: "demo-review-26",
        serviceId: "demo-service-34",
        userId: "demo-user-2",
        rating: 5,
        comment: "Perfect pet sitting! Daily photo updates and my cat was very happy. Highly recommend!",
      },
      {
        id: "demo-review-27",
        serviceId: "demo-service-35",
        userId: "demo-user-1",
        rating: 5,
        comment: "Our wedding photos are absolutely stunning! So talented and captured every special moment.",
      },
      {
        id: "demo-review-28",
        serviceId: "demo-service-35",
        userId: "demo-user-4",
        rating: 5,
        comment: "Best decision we made for our wedding! Beautiful photos and video. Professional throughout.",
      },
      {
        id: "demo-review-29",
        serviceId: "demo-service-36",
        userId: "demo-user-2",
        rating: 4,
        comment: "Great DJ! Everyone danced all night. Good music selection and equipment.",
      },
      {
        id: "demo-review-30",
        serviceId: "demo-service-37",
        userId: "demo-user-5",
        rating: 5,
        comment: "Delicious food and impeccable service! Our guests are still talking about the catering.",
      },
      {
        id: "demo-review-31",
        serviceId: "demo-service-37",
        userId: "demo-user-8",
        rating: 5,
        comment: "Outstanding catering! Professional team and amazing Swiss cuisine.",
      },
      {
        id: "demo-review-32",
        serviceId: "demo-service-39",
        userId: "demo-user-2",
        rating: 5,
        comment: "Excellent immigration lawyer! Got my work permit without any issues. Very knowledgeable.",
      },
      {
        id: "demo-review-33",
        serviceId: "demo-service-39",
        userId: "demo-user-7",
        rating: 5,
        comment: "Professional and efficient! Helped with family reunification. Highly recommend!",
      },
      {
        id: "demo-review-34",
        serviceId: "demo-service-40",
        userId: "demo-user-1",
        rating: 5,
        comment: "Great financial advisor! Clear explanations and solid investment strategies.",
      },
      {
        id: "demo-review-35",
        serviceId: "demo-service-40",
        userId: "demo-user-4",
        rating: 4,
        comment: "Good service. Helped optimize my retirement planning and taxes.",
      },
      {
        id: "demo-review-36",
        serviceId: "demo-service-43",
        userId: "demo-user-2",
        rating: 5,
        comment: "Fixed my computer quickly! Very knowledgeable and reasonably priced.",
      },
      {
        id: "demo-review-37",
        serviceId: "demo-service-43",
        userId: "demo-user-5",
        rating: 5,
        comment: "Excellent IT support! Recovered all my data and removed the virus. Life saver!",
      },
      {
        id: "demo-review-38",
        serviceId: "demo-service-44",
        userId: "demo-user-1",
        rating: 5,
        comment: "Professional network setup! Our office WiFi works perfectly now. Great security advice.",
      },
      {
        id: "demo-review-39",
        serviceId: "demo-service-45",
        userId: "demo-user-2",
        rating: 5,
        comment: "Excellent developers! Built exactly what we needed. Clean code and good communication.",
      },
      {
        id: "demo-review-40",
        serviceId: "demo-service-45",
        userId: "demo-user-8",
        rating: 4,
        comment: "Good work! Professional team and delivered on schedule.",
      },
      {
        id: "demo-review-41",
        serviceId: "demo-service-10",
        userId: "demo-user-1",
        rating: 5,
        comment: "Beautiful garden! Always does a great job with seasonal cleanup. Very reliable.",
      },
      {
        id: "demo-review-42",
        serviceId: "demo-service-12",
        userId: "demo-user-4",
        rating: 5,
        comment: "Amazing graphic designer! Our branding looks professional and modern.",
      },
      {
        id: "demo-review-43",
        serviceId: "demo-service-17",
        userId: "demo-user-1",
        rating: 5,
        comment: "Excellent piano teacher! My daughter loves the lessons. Very patient and skilled.",
      },
      {
        id: "demo-review-44",
        serviceId: "demo-service-19",
        userId: "demo-user-4",
        rating: 5,
        comment: "Best massage therapist! Really helped with my back pain. Very professional.",
      },
      {
        id: "demo-review-45",
        serviceId: "demo-service-26",
        userId: "demo-user-2",
        rating: 4,
        comment: "Good German teacher. My language skills improved significantly!",
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

    // Seed demo notifications
    await seedDemoNotifications();

    // Seed demo chat conversations
    await seedDemoChats();

    console.log("Database seeding completed!");
  } catch (error) {
    console.error("Error seeding database:", error);
    // Don't throw - just log and continue
    console.log("Continuing despite seeding errors...");
  }
}

/**
 * Seed demo chat conversations between existing users
 */
async function seedDemoChats() {
  try {
    // Check if conversations already exist
    const existingConversations = await db.select().from(chatConversations).limit(1);
    if (existingConversations.length > 0) {
      console.log("Chat conversations already seeded, skipping...");
      return;
    }

    // Get existing demo users (get first 6 users excluding admin)
    const demoUsers = await db.select()
      .from(users)
      .where(eq(users.isAdmin, false))
      .limit(6);

    if (demoUsers.length < 2) {
      console.log("Not enough users to seed conversations, skipping...");
      return;
    }

    // Get some services for context
    const demoServices = await db.select().from(services).limit(5);

    // Demo conversation templates
    const conversationTemplates = [
      {
        messages: [
          { role: 'customer', content: "Hi! I saw your cleaning service and I'm interested. Can you tell me more about what's included?" },
          { role: 'vendor', content: "Hello! Thank you for your interest. Our standard cleaning includes dusting, vacuuming, mopping, bathroom cleaning, and kitchen cleaning. We can also add extras like window cleaning or deep cleaning." },
          { role: 'customer', content: "That sounds great! How much would it cost for a 3-bedroom apartment?" },
          { role: 'vendor', content: "For a 3-bedroom apartment, our standard cleaning is CHF 180. Deep cleaning would be CHF 250. Both include all supplies." },
          { role: 'customer', content: "Perfect, I'd like to book the standard cleaning. When are you available?" },
        ]
      },
      {
        messages: [
          { role: 'customer', content: "Hello! Do you offer piano lessons for beginners?" },
          { role: 'vendor', content: "Yes, absolutely! I work with students of all levels, from complete beginners to advanced. I've been teaching for 10 years." },
          { role: 'customer', content: "That's great! My daughter is 8 years old and has never played before. Is that too young?" },
          { role: 'vendor', content: "Not at all! 8 is actually a perfect age to start. Children at this age absorb music quickly and develop good habits. I use fun, age-appropriate methods." },
          { role: 'customer', content: "Wonderful! Can we schedule a trial lesson?" },
          { role: 'vendor', content: "Of course! I have openings on Wednesday at 4pm or Saturday at 10am. Which works better for you?" },
        ]
      },
      {
        messages: [
          { role: 'customer', content: "Hi, I need help with a website for my small business. Is this something you can help with?" },
          { role: 'vendor', content: "Hello! Yes, I specialize in websites for small businesses. What kind of business do you have?" },
          { role: 'customer', content: "I run a bakery. I need something simple with a menu, contact info, and maybe online ordering." },
          { role: 'vendor', content: "Perfect! I can create a beautiful, mobile-friendly website for your bakery. For a site with menu, gallery, contact form, and basic online ordering, it would be around CHF 1,500-2,000." },
          { role: 'customer', content: "That's within my budget. How long would it take?" },
          { role: 'vendor', content: "Usually 2-3 weeks from start to launch. I'll need your logo, some photos of your products, and your menu. Can we schedule a call to discuss the details?" },
        ]
      },
      {
        messages: [
          { role: 'customer', content: "Good morning! I need a plumber urgently - my kitchen sink is leaking!" },
          { role: 'vendor', content: "Good morning! I'm sorry to hear that. Can you describe what's happening? Is the leak from the pipes under the sink or from the faucet?" },
          { role: 'customer', content: "It's from under the sink, where the pipes connect. There's water dripping constantly." },
          { role: 'vendor', content: "That sounds like it could be a loose connection or a worn seal. I can come by this afternoon around 3pm. Would that work for you?" },
          { role: 'customer', content: "Yes, please! That would be amazing. What should I do in the meantime?" },
          { role: 'vendor', content: "Turn off the water supply valve under the sink to stop the leak temporarily. It's usually a knob you turn clockwise. Put a bucket under the leak and I'll see you at 3pm!" },
        ]
      },
      {
        messages: [
          { role: 'customer', content: "Hello! I'm looking for a personal trainer. Do you offer sessions for weight loss?" },
          { role: 'vendor', content: "Hi there! Yes, weight loss is one of my specialties. I combine strength training with cardio and provide nutrition guidance. What are your goals?" },
          { role: 'customer', content: "I want to lose about 10kg and get more toned. I've never really worked out before." },
          { role: 'vendor', content: "That's a very achievable goal! For beginners, I recommend 2-3 sessions per week. We'll start slow and progressively increase intensity. I'll also help you with meal planning." },
          { role: 'customer', content: "Sounds perfect! What are your rates?" },
          { role: 'vendor', content: "Individual sessions are CHF 90/hour. Or you can get a package of 10 sessions for CHF 800, which saves you CHF 100. I also offer partner sessions if you have a friend who wants to join." },
          { role: 'customer', content: "The 10-session package sounds good. When can we start?" },
        ]
      },
    ];

    // Create conversations between different user pairs
    const userPairs = [
      [demoUsers[0], demoUsers[1]], // Maria (customer) - Hans (vendor)
      [demoUsers[2], demoUsers[3]], // Sophie (customer) - Thomas (vendor)
      [demoUsers[4], demoUsers[0]], // Petra (customer) - Maria (vendor)
      [demoUsers[1], demoUsers[4]], // Hans (customer) - Petra (vendor)
      [demoUsers[3], demoUsers[2]], // Thomas (customer) - Sophie (vendor)
    ];

    for (let i = 0; i < Math.min(userPairs.length, conversationTemplates.length); i++) {
      const [customer, vendor] = userPairs[i];
      const template = conversationTemplates[i];
      const service = demoServices[i % demoServices.length];

      // Create conversation
      const [conversation] = await db.insert(chatConversations)
        .values({
          customerId: customer.id,
          vendorId: vendor.id,
          serviceId: service?.id || null,
          status: 'active',
          lastMessageAt: new Date(),
          lastMessagePreview: template.messages[template.messages.length - 1].content.substring(0, 100),
          customerUnreadCount: 0,
          vendorUnreadCount: 1,
        })
        .returning();

      console.log(`Created conversation between ${customer.firstName} and ${vendor.firstName}`);

      // Create messages for this conversation
      const baseTime = new Date();
      baseTime.setHours(baseTime.getHours() - template.messages.length);

      for (let j = 0; j < template.messages.length; j++) {
        const msg = template.messages[j];
        const msgTime = new Date(baseTime.getTime() + j * 30 * 60 * 1000); // 30 min apart

        await db.insert(chatMessages)
          .values({
            conversationId: conversation.id,
            senderId: msg.role === 'customer' ? customer.id : vendor.id,
            senderRole: msg.role as 'customer' | 'vendor',
            content: msg.content,
            messageType: 'text',
            wasFiltered: false,
            readAt: j < template.messages.length - 1 ? msgTime : null, // Mark all but last as read
            createdAt: msgTime,
          });
      }

      console.log(`  Added ${template.messages.length} messages to conversation`);
    }

    console.log("Demo chat conversations seeded successfully!");
  } catch (error) {
    console.error("Error seeding demo chats:", error);
  }
}

/**
 * Seed demo notifications for testing the notification center
 */
async function seedDemoNotifications() {
  try {
    // Check if notifications already exist
    const existingNotifications = await db.select().from(notifications).limit(1);
    if (existingNotifications.length > 0) {
      console.log("Notifications already seeded, skipping...");
      return;
    }

    // Get demo users (filtering by ID pattern rather than isAdmin flag for reliability)
    // This ensures we get the demo users even if isAdmin defaults weren't applied
    const allUsers = await db.select().from(users).limit(20);
    const demoUsers = allUsers.filter(u => u.id.startsWith("demo-user-"));
    
    if (demoUsers.length === 0) {
      console.log("No demo users found for notifications, skipping...");
      return;
    }

    // Sample notifications for different types
    const notificationTemplates = [
      {
        type: "message" as const,
        title: "New message from a customer",
        message: "You have a new inquiry about your cleaning service. Reply to keep your response time low!",
        icon: "message-circle",
        relatedEntityType: "conversation",
        priority: 2,
      },
      {
        type: "booking" as const,
        title: "New booking request",
        message: "A customer has requested a booking for your Garden Maintenance Service on December 15th at 10:00 AM.",
        icon: "calendar",
        relatedEntityType: "booking",
        priority: 1,
      },
      {
        type: "referral" as const,
        title: "You earned referral points!",
        message: "Congratulations! Your referral code was used by a new user. You've earned 100 points!",
        icon: "gift",
        relatedEntityType: "user",
        priority: 4,
      },
      {
        type: "service" as const,
        title: "Your service is expiring soon",
        message: "Your listing 'Professional House Cleaning' will expire in 3 days. Renew now to keep it active.",
        icon: "alert-triangle",
        relatedEntityType: "service",
        priority: 3,
      },
      {
        type: "payment" as const,
        title: "Payment received",
        message: "You received a payment of CHF 85.00 for your Plumbing service. The funds will be transferred to your account.",
        icon: "credit-card",
        relatedEntityType: "order",
        priority: 2,
      },
      {
        type: "system" as const,
        title: "Welcome to Commerzio!",
        message: "Your account has been verified. Start exploring services or create your first listing today!",
        icon: "check-circle",
        priority: 5,
      },
      {
        type: "review" as const,
        title: "New 5-star review!",
        message: "A customer left a 5-star review on your Professional House Cleaning service. Great job!",
        icon: "star",
        relatedEntityType: "review",
        priority: 3,
      },
      {
        type: "promotion" as const,
        title: "Boost your visibility",
        message: "Upgrade to Premium and get 50% more views on your listings. Limited time offer!",
        icon: "trending-up",
        priority: 7,
      },
      {
        type: "booking" as const,
        title: "Booking confirmed",
        message: "Your booking for Piano Lessons has been confirmed for December 20th at 2:00 PM.",
        icon: "calendar-check",
        relatedEntityType: "booking",
        priority: 2,
      },
      {
        type: "message" as const,
        title: "Quick reply reminder",
        message: "You have 2 unread messages from potential customers. Fast responses lead to more bookings!",
        icon: "message-square",
        relatedEntityType: "conversation",
        priority: 3,
      },
    ];

    // Create notifications for each demo user (mix of read and unread)
    const baseTime = new Date();
    let notificationCount = 0;
    
    for (let userIndex = 0; userIndex < Math.min(demoUsers.length, 6); userIndex++) {
      const user = demoUsers[userIndex];
      
      // Each user gets 2-4 notifications
      const numNotifications = 2 + (userIndex % 3);
      
      for (let i = 0; i < numNotifications; i++) {
        const templateIndex = (userIndex * 3 + i) % notificationTemplates.length;
        const template = notificationTemplates[templateIndex];
        const notificationTime = new Date(baseTime.getTime() - (i + userIndex) * 60 * 60 * 1000); // Hours ago
        const isRead = i > 0 && Math.random() > 0.5; // First notification unread, others random
        
        await db.insert(notifications).values({
          userId: user.id,
          type: template.type,
          title: template.title,
          message: template.message,
          icon: template.icon,
          relatedEntityType: template.relatedEntityType || null,
          priority: template.priority,
          isRead: isRead,
          readAt: isRead ? notificationTime : null,
          deliveredVia: ["in_app"],
          createdAt: notificationTime,
        });
        
        notificationCount++;
      }
    }

    console.log(`Demo notifications seeded successfully! Created ${notificationCount} notifications.`);
  } catch (error) {
    console.error("Error seeding demo notifications:", error);
  }
}
