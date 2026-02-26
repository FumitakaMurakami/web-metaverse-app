import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { threadId } = await params;

    // Verify user is a member of this thread
    const membership = await prisma.joinUser.findFirst({
      where: {
        thread_id: threadId,
        user_id: session.user.id,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "このスレッドへのアクセス権がありません" },
        { status: 403 }
      );
    }

    const messages = await prisma.chatLog.findMany({
      where: { thread_id: threadId },
      include: { media: true },
      orderBy: { created_at: "asc" },
    });

    const thread = await prisma.thread.findUnique({
      where: { thread_id: threadId },
      include: { join_users: true },
    });

    return NextResponse.json({ messages, thread });
  } catch (error) {
    console.error("Get messages error:", error);
    return NextResponse.json(
      { error: "メッセージの取得に失敗しました" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { threadId } = await params;
    const { message } = await request.json();

    if (!message?.trim()) {
      return NextResponse.json(
        { error: "メッセージを入力してください" },
        { status: 400 }
      );
    }

    // Verify user is a member of this thread
    const membership = await prisma.joinUser.findFirst({
      where: {
        thread_id: threadId,
        user_id: session.user.id,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "このスレッドへのアクセス権がありません" },
        { status: 403 }
      );
    }

    const chatLog = await prisma.chatLog.create({
      data: {
        thread_id: threadId,
        sender_id: session.user.id,
        message: message.trim(),
      },
      include: { media: true },
    });

    // Update thread timestamp
    await prisma.thread.update({
      where: { thread_id: threadId },
      data: { updated_at: new Date() },
    });

    return NextResponse.json({ message: chatLog }, { status: 201 });
  } catch (error) {
    console.error("Send message error:", error);
    return NextResponse.json(
      { error: "メッセージの送信に失敗しました" },
      { status: 500 }
    );
  }
}
