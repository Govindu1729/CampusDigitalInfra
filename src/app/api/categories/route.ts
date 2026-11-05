import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { getAllCategories, getActiveCategories } from "@/lib/categories/categoryService";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const activeOnly = searchParams.get("activeOnly") === "true";

    const categories = activeOnly
      ? await getActiveCategories()
      : await getAllCategories();

    return NextResponse.json({
      success: true,
      count: categories.length,
      categories,
    });
  } catch (error) {
    console.error("Error fetching categories:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || (currentUser.roleLevel !== 1 && currentUser.roleLevel !== 2)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Overall Admin or Department Head permission required." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const {
      name,
      slug: customSlug,
      shortDescription,
      icon = "Home",
      locationType = "general",
      hasCorridor = false,
      allowedDomains = ["Electrical", "Civil", "Plumbing"],
      displayOrder,
      active = true,
    } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { success: false, error: "Category name is required." },
        { status: 400 }
      );
    }

    // Generate clean slug if not specified or format custom slug
    let slug = customSlug
      ? customSlug.toLowerCase().trim().replace(/[^a-z0-9_]/g, "_")
      : name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");

    if (!slug) {
      slug = `zone_${Date.now()}`;
    }

    // Check slug collision
    const existing = await prisma.complaintCategory.findUnique({
      where: { slug },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: `A category with slug "${slug}" already exists. Please choose a distinct name or slug.` },
        { status: 409 }
      );
    }

    // Calculate order if not provided
    const nextOrder =
      typeof displayOrder === "number"
        ? displayOrder
        : (await prisma.complaintCategory.count());

    const { getDefaultLocationOptions } = await import("@/lib/categories/categoryService");
    const locOptions = Array.isArray(body.locationOptions)
      ? body.locationOptions
      : getDefaultLocationOptions(slug, locationType);

    const created = await prisma.complaintCategory.create({
      data: {
        slug,
        name: name.trim(),
        shortDescription: (shortDescription || "").trim(),
        icon,
        locationType,
        hasCorridor: Boolean(hasCorridor),
        allowedDomains: JSON.stringify(Array.isArray(allowedDomains) ? allowedDomains : ["Electrical", "Civil", "Plumbing"]),
        locationOptions: JSON.stringify(locOptions),
        instructions: body.instructions || null,
        responseTimeText: body.responseTimeText || "Avg Response: < 24 hrs",
        bannerNotice: body.bannerNotice || null,
        urgencyPrompt: body.urgencyPrompt || null,
        customCascades: JSON.stringify(body.customCascades || {}),
        displayOrder: nextOrder,
        active: Boolean(active),
      },
    });

    return NextResponse.json({
      success: true,
      message: `Category "${created.name}" created successfully.`,
      category: {
        ...created,
        allowedDomains: JSON.parse(created.allowedDomains),
        locationOptions: locOptions,
      },
    });
  } catch (error) {
    console.error("Error creating category:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create category." },
      { status: 500 }
    );
  }
}
