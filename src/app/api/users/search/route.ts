import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const query = request.nextUrl.searchParams.get("q") || "";

    const users = await prisma.user.findMany({
      where: {
        AND: [
          { user_id: { not: session.user.id } },
          {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
            ],
          },
        ],
      },
      select: {
        user_id: true,
        name: true,
        email: true,
        avatar_url: true,
      },
      take: 20,
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("Search users error:", error);
    return NextResponse.json(
      { error: "ユーザー検索に失敗しました" },
      { status: 500 }
    );
  }
}
