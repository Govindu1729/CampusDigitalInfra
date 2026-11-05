import { prisma } from "@/lib/prisma";
import {
  CATEGORIES as DEFAULT_STATIC_CATEGORIES,
  ACADEMIC_BLOCKS,
  HOSTEL_LIST,
  JEET_BLOCKS,
  HOUSING_APARTMENTS,
} from "@/config/categories";

export interface CategoryData {
  id?: string;
  slug: string;
  name: string;
  shortDescription: string;
  icon: string;
  locationType: "apartment" | "hostel" | "academic" | "general";
  hasCorridor?: boolean;
  allowedDomains: string[];
  locationOptions?: string[];
  instructions?: string | null;
  responseTimeText?: string;
  bannerNotice?: string | null;
  urgencyPrompt?: string | null;
  customCascades?: Record<string, any>;
  displayOrder?: number;
  active?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

function safeParseArray(raw: string | null | undefined, fallback: string[] = []): string[] {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch (e) {
    return fallback;
  }
}

function safeParseObject(raw: string | null | undefined, fallback: Record<string, any> = {}): Record<string, any> {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : fallback;
  } catch (e) {
    return fallback;
  }
}

export function getDefaultLocationOptions(slug: string, locationType: string): string[] {
  if (slug === "academic" || locationType === "academic") return [...ACADEMIC_BLOCKS];
  if (slug === "hostel") return [...HOSTEL_LIST];
  if (slug === "jeet_hostel") return [...JEET_BLOCKS];
  if (slug === "housing" || locationType === "apartment") return [...HOUSING_APARTMENTS];
  if (slug === "infrastructure") {
    return [
      "Central Arcade",
      "Sports Complex & Gymnasium",
      "Institute Guest House",
      "Research Park & Innovation Centre",
      "Main Campus Roads & Lighting",
      "Substations & Utility Blocks",
      "Student Activity Centre (SAC)",
    ];
  }
  return [];
}

export async function ensureDefaultCategories() {
  try {
    const count = await prisma.complaintCategory.count();
    if (count > 0) return;

    let order = 0;
    for (const [slug, cat] of Object.entries(DEFAULT_STATIC_CATEGORIES)) {
      const defaultLocations = getDefaultLocationOptions(cat.slug, cat.locationType);
      await prisma.complaintCategory.upsert({
        where: { slug: cat.slug },
        update: {},
        create: {
          slug: cat.slug,
          name: cat.name,
          shortDescription: cat.shortDescription,
          icon: cat.icon || "Home",
          locationType: cat.locationType,
          hasCorridor: Boolean(cat.hasCorridor),
          allowedDomains: JSON.stringify(cat.allowedDomains),
          locationOptions: JSON.stringify(defaultLocations),
          responseTimeText: "Avg Response: < 24 hrs",
          displayOrder: order++,
          active: true,
        },
      });
    }
  } catch (err) {
    console.error("Error ensuring default complaint categories in database:", err);
  }
}

export async function getAllCategories(): Promise<CategoryData[]> {
  await ensureDefaultCategories();
  try {
    const dbCats = await prisma.complaintCategory.findMany({
      orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    });

    if (dbCats.length === 0) {
      // Fallback to static categories
      return Object.values(DEFAULT_STATIC_CATEGORIES).map((c, i) => ({
        ...c,
        locationOptions: getDefaultLocationOptions(c.slug, c.locationType),
        responseTimeText: "Avg Response: < 24 hrs",
        displayOrder: i,
        active: true,
      }));
    }

    return dbCats.map((c) => {
      const parsedLocs = safeParseArray(c.locationOptions, []);
      const finalLocs = parsedLocs.length > 0 ? parsedLocs : getDefaultLocationOptions(c.slug, c.locationType);
      return {
        id: c.id,
        slug: c.slug,
        name: c.name,
        shortDescription: c.shortDescription,
        icon: c.icon,
        locationType: c.locationType as any,
        hasCorridor: c.hasCorridor,
        allowedDomains: safeParseArray(c.allowedDomains, ["Electrical", "Civil", "Plumbing"]),
        locationOptions: finalLocs,
        instructions: c.instructions,
        responseTimeText: c.responseTimeText || "Avg Response: < 24 hrs",
        bannerNotice: c.bannerNotice,
        urgencyPrompt: c.urgencyPrompt,
        customCascades: safeParseObject(c.customCascades, {}),
        displayOrder: c.displayOrder,
        active: c.active,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      };
    });
  } catch (err) {
    console.error("Failed to fetch categories from database:", err);
    return Object.values(DEFAULT_STATIC_CATEGORIES).map((c, i) => ({
      ...c,
      locationOptions: getDefaultLocationOptions(c.slug, c.locationType),
      responseTimeText: "Avg Response: < 24 hrs",
      displayOrder: i,
      active: true,
    }));
  }
}

export async function getActiveCategories(): Promise<CategoryData[]> {
  const all = await getAllCategories();
  return all.filter((c) => c.active !== false);
}

export async function getCategoryBySlug(slug: string): Promise<CategoryData | null> {
  await ensureDefaultCategories();
  const cleanSlug = slug.toLowerCase().trim();

  try {
    const c = await prisma.complaintCategory.findUnique({
      where: { slug: cleanSlug },
    });

    if (c) {
      const parsedLocs = safeParseArray(c.locationOptions, []);
      const finalLocs = parsedLocs.length > 0 ? parsedLocs : getDefaultLocationOptions(c.slug, c.locationType);
      return {
        id: c.id,
        slug: c.slug,
        name: c.name,
        shortDescription: c.shortDescription,
        icon: c.icon,
        locationType: c.locationType as any,
        hasCorridor: c.hasCorridor,
        allowedDomains: safeParseArray(c.allowedDomains, ["Electrical", "Civil", "Plumbing"]),
        locationOptions: finalLocs,
        instructions: c.instructions,
        responseTimeText: c.responseTimeText || "Avg Response: < 24 hrs",
        bannerNotice: c.bannerNotice,
        urgencyPrompt: c.urgencyPrompt,
        customCascades: safeParseObject(c.customCascades, {}),
        displayOrder: c.displayOrder,
        active: c.active,
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      };
    }
  } catch (e) {
    console.error(`Error querying category ${slug} from db:`, e);
  }

  // Fallback to static dictionary
  const fallback = DEFAULT_STATIC_CATEGORIES[cleanSlug];
  if (fallback) {
    return {
      ...fallback,
      locationOptions: getDefaultLocationOptions(fallback.slug, fallback.locationType),
      responseTimeText: "Avg Response: < 24 hrs",
      active: true,
    };
  }

  return null;
}
