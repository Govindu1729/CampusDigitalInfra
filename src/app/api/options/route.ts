import { NextResponse } from "next/server";
import { DOMAIN_CASCADE, HOSTEL_LIST, JEET_BLOCKS, ACADEMIC_BLOCKS, HOUSING_APARTMENTS } from "@/config/categories";
import { prisma } from "@/lib/prisma";
import { getActiveCategories } from "@/lib/categories/categoryService";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const activeCats = await getActiveCategories();
    const categoriesMap: Record<string, any> = {};
    activeCats.forEach((c) => {
      categoriesMap[c.slug] = c;
    });

    const departments = await prisma.department.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        slaHoursL1: true,
        icon: true,
      },
    });

    return NextResponse.json({
      success: true,
      categories: categoriesMap,
      domainCascade: DOMAIN_CASCADE,
      departments,
      locations: {
        hostels: HOSTEL_LIST,
        jeetBlocks: JEET_BLOCKS,
        academicBlocks: ACADEMIC_BLOCKS,
        apartments: HOUSING_APARTMENTS,
      },
    });
  } catch (error) {
    console.error("Failed to fetch options:", error);
    return NextResponse.json(
      { success: false, error: "Failed to load options" },
      { status: 500 }
    );
  }
}
