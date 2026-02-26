import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";

// GET: List sessions the user owns or is invited to
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const [ownedSessions, invitedSessions] = await Promise.all([
      prisma.metaverseSession.findMany({
        where: { owner_id: session.user.id },
        include: { invites: true },
        orderBy: { created_at: "desc" },
      }),
      prisma.sessionInvite.findMany({
        where: {
          invitee_id: session.user.id,
          status: "accepted",
        },
        include: { session: true },
        orderBy: { created_at: "desc" },
      }),
    ]);

    return NextResponse.json({ ownedSessions, invitedSessions });
  } catch (error) {
    console.error("Get sessions error:", error);
    return NextResponse.json(
      { error: "セッション取得に失敗しました" },
      { status: 500 }
    );
  }
}

// POST: Create a new metaverse session
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { name } = await request.json();
    if (!name?.trim()) {
      return NextResponse.json(
        { error: "セッション名を入力してください" },
        { status: 400 }
      );
    }

    const roomCode = uuidv4().slice(0, 8);

    const metaverseSession = await prisma.metaverseSession.create({
      data: {
        name: name.trim(),
        owner_id: session.user.id,
        room_code: roomCode,
      },
    });

    return NextResponse.json({ session: metaverseSession }, { status: 201 });
  } catch (error) {
    console.error("Create session error:", error);
    return NextResponse.json(
      { error: "セッション作成に失敗しました" },
      { status: 500 }
    );
  }
}
