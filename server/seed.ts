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
      // Home Services
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
        images: ["https://images.unsplash.com/photo-1581578731548-c64695c952952?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=MnwxfDB8MXxyYW5kb218MHx8Y2xlYW5pbmd8fHx8fHwxNjk5Njc4Mjcw&ixlib=rb-4.0.3&q=80"],
        tags: ["cleaning", "eco-friendly", "home"],
      },
      {
        id: "demo-service-7",
        title: "Apartment Painting & Renovation",
        description: "Professional interior and exterior painting. Expert color consultation, high-quality finishes. 15+ years experience. Free quotes.",
        priceType: "text" as const,
        priceText: "Call for quote",
        priceUnit: "custom" as const,
        contactPhone: "+41 79 987 65 43",
        contactEmail: "painter.zurich@example.ch",
        locations: ["Zürich", "Zug"],
        ownerId: "demo-user-1",
        categoryId: homeCategory.id,
        status: "active" as const,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        viewCount: 156,
        images: ["https://images.unsplash.com/photo-1580274455191-1c62238fa333?crop=entropy&cs=tinysrgb&fit=max&fm=jpg"],
        tags: ["painting", "renovation", "interior"],
      },
      {
        id: "demo-service-8",
        title: "Plumbing & Installation Services",
        description: "Expert plumbing repairs, installations, and maintenance. 24/7 emergency service available. Licensed and insured. Transparent pricing.",
        priceType: "fixed" as const,
        price: "85.00",
        priceUnit: "hour" as const,
        contactPhone: "+41 76 234 56 78",
        contactEmail: "plumber.ch@example.ch",
        locations: ["Basel", "Solothurn"],
        ownerId: "demo-user-2",
        categoryId: homeCategory.id,
        status: "active" as const,
        expiresAt: new Date(Date.now() + 13 * 24 * 60 * 60 * 1000),
        viewCount: 198,
        images: ["https://images.unsplash.com/photo-1558618666-fcd25c85cd64?crop=entropy&cs=tinysrgb&fit=max&fm=jpg"],
        tags: ["plumbing", "repair", "maintenance"],
      },
      {
        id: "demo-service-9",
        title: "Electrical Installation & Repair",
        description: "Licensed electrician offering installation, repair, and maintenance. Smart home integration, solar panel setup. Certified professionals.",
        priceType: "fixed" as const,
        price: "95.00",
        priceUnit: "hour" as const,
        contactPhone: "+41 77 456 78 90",
        contactEmail: "electrician.ch@example.ch",
        locations: ["Bern", "Thun"],
        ownerId: "demo-user-4",
        categoryId: homeCategory.id,
        status: "active" as const,
        expiresAt: new Date(Date.now() + 13 * 24 * 60 * 60 * 1000),
        viewCount: 167,
        images: ["https://images.unsplash.com/photo-1581092160562-40fed08a2816?crop=entropy&cs=tinysrgb&fit=max&fm=jpg"],
        tags: ["electrical", "installation", "repair"],
      },
      {
        id: "demo-service-10",
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
        images: ["https://images.unsplash.com/photo-1558618666-fcd25c85cd64?crop=entropy&cs=tinysrgb&fit=max&fm=jpg"],
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
      },
      {
        id: "demo-service-11",
        title: "Web Design & Development",
        description: "Professional website design and development for businesses. Responsive, SEO-optimized, fast loading. Includes CMS training.",
        priceType: "text" as const,
        priceText: "Starting from CHF 1500",
        priceUnit: "custom" as const,
        contactPhone: "+41 78 123 45 67",
        contactEmail: "webdev.ch@example.ch",
        locations: ["Zürich", "Remote"],
        ownerId: "demo-user-2",
        categoryId: designCategory.id,
        status: "active" as const,
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        viewCount: 267,
        images: ["https://images.unsplash.com/photo-1517694712202-14dd9538aa97?crop=entropy&cs=tinysrgb&fit=max&fm=jpg"],
        tags: ["web design", "development", "programming"],
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
        images: ["https://images.unsplash.com/photo-1502920917128-1aa500764cbd?crop=entropy&cs=tinysrgb&fit=max&fm=jpg"],
        tags: ["photography", "events", "corporate"],
      },
      {
        id: "demo-service-14",
        title: "Video Production & Editing",
        description: "Professional video production, editing, and animation for businesses. Corporate videos, commercials, social media content.",
        priceType: "text" as const,
        priceText: "Starting from CHF 2000",
        priceUnit: "custom" as const,
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
        images: ["https://images.unsplash.com/photo-1534438327276-14e5300c3a48?crop=entropy&cs=tinysrgb&fit=max&fm=jpg"],
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
        priceUnit: "custom" as const,
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
        priceUnit: "custom" as const,
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
