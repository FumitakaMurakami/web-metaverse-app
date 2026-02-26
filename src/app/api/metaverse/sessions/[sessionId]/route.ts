import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: Get session detail (owner or accepted invitee only)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { sessionId } = await params;

    const metaverseSession = await prisma.metaverseSession.findUnique({
      where: { session_id: sessionId },
      include: { invites: true },
    });

    if (!metaverseSession) {
      return NextResponse.json(
        { error: "セッションが見つかりません" },
        { status: 404 }
      );
    }

    // Check access: owner or accepted invitee
    const isOwner = metaverseSession.owner_id === session.user.id;
    const isInvited = metaverseSession.invites.some(
      (inv) => inv.invitee_id === session.user.id && inv.status === "accepted"
    );

    if (!isOwner && !isInvited) {
      return NextResponse.json(
        { error: "このセッションへのアクセス権がありません" },
        { status: 403 }
      );
    }

    return NextResponse.json({ session: metaverseSession });
  } catch (error) {
    console.error("Get session error:", error);
    return NextResponse.json(
      { error: "セッション取得に失敗しました" },
      { status: 500 }
    );
  }
}

// DELETE: Close session (owner only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { sessionId } = await params;

    const metaverseSession = await prisma.metaverseSession.findUnique({
      where: { session_id: sessionId },
    });

    if (!metaverseSession || metaverseSession.owner_id !== session.user.id) {
      return NextResponse.json(
        { error: "権限がありません" },
        { status: 403 }
      );
    }

    await prisma.metaverseSession.update({
      where: { session_id: sessionId },
      data: { is_active: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete session error:", error);
    return NextResponse.json(
      { error: "セッション終了に失敗しました" },
      { status: 500 }
    );
  }
}
