import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const threads = await prisma.thread.findMany({
      where: {
        join_users: {
          some: {
            user_id: session.user.id,
          },
        },
      },
      include: {
        join_users: true,
        chat_logs: {
          orderBy: { created_at: "desc" },
          take: 1,
        },
      },
      orderBy: { updated_at: "desc" },
    });

    return NextResponse.json({ threads });
  } catch (error) {
    console.error("Get threads error:", error);
    return NextResponse.json(
      { error: "スレッドの取得に失敗しました" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { target_user_id, title } = await request.json();

    if (!target_user_id) {
      return NextResponse.json(
        { error: "対象ユーザーIDが必要です" },
        { status: 400 }
      );
    }

    // Check if a 1-on-1 thread already exists
    const existingThread = await prisma.thread.findFirst({
      where: {
        AND: [
          { join_users: { some: { user_id: session.user.id } } },
          { join_users: { some: { user_id: target_user_id } } },
        ],
      },
      include: { join_users: true },
    });

    if (existingThread && existingThread.join_users.length === 2) {
      return NextResponse.json({ thread: existingThread });
    }

    const currentUser = await prisma.user.findUnique({
      where: { user_id: session.user.id },
    });

    const targetUser = await prisma.user.findUnique({
      where: { user_id: target_user_id },
    });

    const thread = await prisma.thread.create({
      data: {
        title: title || null,
        join_users: {
          create: [
            {
              user_id: session.user.id,
              user_name: currentUser?.name,
            },
            {
              user_id: target_user_id,
              user_name: targetUser?.name,
            },
          ],
        },
      },
      include: { join_users: true },
    });

    return NextResponse.json({ thread }, { status: 201 });
  } catch (error) {
    console.error("Create thread error:", error);
    return NextResponse.json(
      { error: "スレッドの作成に失敗しました" },
      { status: 500 }
    );
  }
}
