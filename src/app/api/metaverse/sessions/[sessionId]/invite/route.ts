import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// POST: Invite a user to the session
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { sessionId } = await params;
    const { invitee_id } = await request.json();

    if (!invitee_id) {
      return NextResponse.json(
        { error: "招待先ユーザーIDが必要です" },
        { status: 400 }
      );
    }

    const metaverseSession = await prisma.metaverseSession.findUnique({
      where: { session_id: sessionId },
    });

    if (!metaverseSession) {
      return NextResponse.json(
        { error: "セッションが見つかりません" },
        { status: 404 }
      );
    }

    if (metaverseSession.owner_id !== session.user.id) {
      return NextResponse.json(
        { error: "セッションオーナーのみ招待できます" },
        { status: 403 }
      );
    }

    if (!metaverseSession.is_active) {
      return NextResponse.json(
        { error: "このセッションは終了しています" },
        { status: 400 }
      );
    }

    const invite = await prisma.sessionInvite.upsert({
      where: {
        session_id_invitee_id: {
          session_id: sessionId,
          invitee_id: invitee_id,
        },
      },
      update: { status: "pending" },
      create: {
        session_id: sessionId,
        inviter_id: session.user.id,
        invitee_id: invitee_id,
        status: "pending",
      },
    });

    return NextResponse.json({ invite }, { status: 201 });
  } catch (error) {
    console.error("Invite error:", error);
    return NextResponse.json(
      { error: "招待に失敗しました" },
      { status: 500 }
    );
  }
}
