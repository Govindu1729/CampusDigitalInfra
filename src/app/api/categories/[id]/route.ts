import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/session";
import { getDefaultLocationOptions } from "@/lib/categories/categoryService";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const cat = await prisma.complaintCategory.findFirst({
      where: {
        OR: [{ id }, { slug: id.toLowerCase() }],
      },
    });

    if (!cat) {
      return NextResponse.json(
        { success: false, error: "Category not found." },
        { status: 404 }
      );
    }

    let allowedDomains: string[] = [];
    try {
      allowedDomains = JSON.parse(cat.allowedDomains);
    } catch {
      allowedDomains = ["Electrical", "Civil", "Plumbing"];
    }

    let locationOptions: string[] = [];
    try {
      locationOptions = JSON.parse(cat.locationOptions);
    } catch {
      locationOptions = [];
    }

    if (!locationOptions || locationOptions.length === 0) {
      locationOptions = getDefaultLocationOptions(cat.slug, cat.locationType);
    }

    let customCascades: Record<string, any> = {};
    try {
      customCascades = JSON.parse(cat.customCascades || "{}");
    } catch {
      customCascades = {};
    }

    return NextResponse.json({
      success: true,
      category: {
        ...cat,
        allowedDomains,
        locationOptions,
        customCascades,
        responseTimeText: cat.responseTimeText || "Avg Response: < 24 hrs",
      },
    });
  } catch (error) {
    console.error("Error fetching category:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch category." },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || (currentUser.roleLevel !== 1 && currentUser.roleLevel !== 2)) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Overall Admin or Department Head permission required." },
        { status: 403 }
      );
    }

    const { id } = params;
    const existing = await prisma.complaintCategory.findFirst({
      where: {
        OR: [{ id }, { slug: id.toLowerCase() }],
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Category not found." },
        { status: 404 }
      );
    }

    const body = await req.json();
    const {
      name,
      slug: customSlug,
      shortDescription,
      icon,
      locationType,
      hasCorridor,
      allowedDomains,
      locationOptions,
      instructions,
      responseTimeText,
      bannerNotice,
      urgencyPrompt,
      customCascades,
      displayOrder,
      active,
    } = body;

    const updateData: any = {};
    if (typeof name === "string") updateData.name = name.trim();
    if (typeof shortDescription === "string") updateData.shortDescription = shortDescription.trim();
    if (typeof icon === "string") updateData.icon = icon;
    if (typeof locationType === "string") updateData.locationType = locationType;
    if (typeof hasCorridor === "boolean") updateData.hasCorridor = hasCorridor;
    if (Array.isArray(allowedDomains)) updateData.allowedDomains = JSON.stringify(allowedDomains);
    if (Array.isArray(locationOptions)) updateData.locationOptions = JSON.stringify(locationOptions);
    if (typeof instructions === "string" || instructions === null) updateData.instructions = instructions;
    if (typeof responseTimeText === "string") updateData.responseTimeText = responseTimeText.trim();
    if (typeof bannerNotice === "string" || bannerNotice === null) updateData.bannerNotice = bannerNotice;
    if (typeof urgencyPrompt === "string" || urgencyPrompt === null) updateData.urgencyPrompt = urgencyPrompt;
    if (typeof customCascades === "object" && customCascades !== null) updateData.customCascades = JSON.stringify(customCascades);
    if (typeof displayOrder === "number") updateData.displayOrder = displayOrder;
    if (typeof active === "boolean") updateData.active = active;

    if (customSlug && customSlug.trim() !== existing.slug) {
      const cleanSlug = customSlug.toLowerCase().trim().replace(/[^a-z0-9_]/g, "_");
      // Check collision
      const slugCollision = await prisma.complaintCategory.findFirst({
        where: { slug: cleanSlug, NOT: { id: existing.id } },
      });
      if (slugCollision) {
        return NextResponse.json(
          { success: false, error: `Slug "${cleanSlug}" is already taken by another category.` },
          { status: 409 }
        );
      }
      updateData.slug = cleanSlug;
    }

    const updated = await prisma.complaintCategory.update({
      where: { id: existing.id },
      data: updateData,
    });

    let parsedDomains: string[] = [];
    try {
      parsedDomains = JSON.parse(updated.allowedDomains);
    } catch {
      parsedDomains = ["Electrical", "Civil", "Plumbing"];
    }

    let parsedLocations: string[] = [];
    try {
      parsedLocations = JSON.parse(updated.locationOptions);
    } catch {
      parsedLocations = [];
    }

    return NextResponse.json({
      success: true,
      message: `Category "${updated.name}" updated successfully.`,
      category: {
        ...updated,
        allowedDomains: parsedDomains,
        locationOptions: parsedLocations,
      },
    });
  } catch (error) {
    console.error("Error updating category:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update category." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.roleLevel !== 1) {
      return NextResponse.json(
        { success: false, error: "Unauthorized. Overall Admin permission required." },
        { status: 403 }
      );
    }

    const { id } = params;
    const existing = await prisma.complaintCategory.findFirst({
      where: {
        OR: [{ id }, { slug: id.toLowerCase() }],
      },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Category not found." },
        { status: 404 }
      );
    }

    // Check if there are complaints filed under this category
    const requestCount = await prisma.maintenanceRequest.count({
      where: { category: existing.slug },
    });

    if (requestCount > 0) {
      // Rather than a destructive hard delete that orphans foreign keys,
      // mark it inactive so past tickets retain history but no new complaints can be filed
      await prisma.complaintCategory.update({
        where: { id: existing.id },
        data: { active: false },
      });

      return NextResponse.json({
        success: true,
        message: `Category "${existing.name}" has ${requestCount} active complaint(s). It has been disabled/deactivated so new complaints cannot be filed.`,
        deactivated: true,
      });
    }

    await prisma.complaintCategory.delete({
      where: { id: existing.id },
    });

    return NextResponse.json({
      success: true,
      message: `Category "${existing.name}" was permanently deleted.`,
    });
  } catch (error) {
    console.error("Error deleting category:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete category." },
      { status: 500 }
    );
  }
}
