import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { getAuthFromRequest } from "@/lib/auth";
import { canAccess } from "@/lib/permissions";

export async function GET(req, { params }) {
  const auth = await getAuthFromRequest(req);
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = parseInt(params.id);
  if (!canAccess(auth.role, "admin.only") && auth.branchId !== id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const branch = await prisma.branch.findUnique({
      where: { id },
    });
    if (!branch)
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true, data: branch });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

export async function PUT(req, { params }) {
  const auth = await getAuthFromRequest(req);
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccess(auth.role, "admin.only"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = parseInt(params.id);
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

    const branch = await prisma.branch.update({
      where: { id },
      data: { name, location, phone, isMain, status },
    });
    return NextResponse.json({ success: true, data: branch });
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

export async function DELETE(req, { params }) {
  const auth = await getAuthFromRequest(req);
  if (!auth)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canAccess(auth.role, "admin.only"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const id = parseInt(params.id);
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

    // Prevent deleting the last branch or a branch with active users/sales might need consideration
    // For now, simple delete
    await prisma.branch.delete({ where: { id } });
    return NextResponse.json({ success: true, message: "Branch deleted" });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
