import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { canAccess } from "@/lib/permissions";

export async function GET(req) {
  const auth = await getAuthFromRequest(req);
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Only admins can see all branches
  // if (!canAccess(auth.role, "admin.only")) {
  //    // Non-admins might only see their own branch, or we can just restrict this API to admins
  //    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  // }

  try {
    // Verify if current user belongs to main branch
    const currentUser = await prisma.user.findUnique({
      where: { id: auth.id },
      include: { branch: true },
    });

    if (!currentUser?.branch?.isMain) {
      // If not main branch, only return their own branch
      const myBranch = await prisma.branch.findUnique({
        where: { id: auth.branchId },
      });
      return NextResponse.json({
        success: true,
        data: myBranch ? [myBranch] : [],
      });
    }

    const branches = await prisma.branch.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ success: true, data: branches });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function POST(req) {
  const auth = await getAuthFromRequest(req);
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccess(auth.role, "admin.only"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    // Verify if current user belongs to main branch
    const currentUser = await prisma.user.findUnique({
      where: { id: auth.id },
      include: { branch: true },
    });

    if (!currentUser?.branch?.isMain) {
      return NextResponse.json(
        { error: "Only main branch admins can manage branches" },
        { status: 403 },
      );
    }

    const body = await req.json();
    const { name, location, phone, isMain, status } = body;

    if (!name)
      return NextResponse.json({ error: "Name is required" }, { status: 400 });

    const branch = await prisma.branch.create({
      data: {
        name,
        location,
        phone,
        isMain: isMain || false,
        status: status || "ACTIVE",
      },
    });
    return NextResponse.json({ success: true, data: branch }, { status: 201 });
  } catch (error) {
    if (error.code === "P2002" && error.meta?.target?.includes("name")) {
      return NextResponse.json(
        { error: "Branch name already exists" },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
