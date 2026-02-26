import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// GET: List pending invites for the current user
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const invites = await prisma.sessionInvite.findMany({
      where: {
        invitee_id: session.user.id,
        status: "pending",
      },
      include: { session: true },
      orderBy: { created_at: "desc" },
    });

    return NextResponse.json({ invites });
  } catch (error) {
    console.error("Get invites error:", error);
    return NextResponse.json(
      { error: "招待一覧の取得に失敗しました" },
      { status: 500 }
    );
  }
}

// PATCH: Accept or decline an invite
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { invite_id, action } = await request.json();

    if (!invite_id || !["accepted", "declined"].includes(action)) {
      return NextResponse.json(
        { error: "invite_id と action (accepted/declined) が必要です" },
        { status: 400 }
      );
    }

    const invite = await prisma.sessionInvite.findUnique({
      where: { id: invite_id },
    });

    if (!invite || invite.invitee_id !== session.user.id) {
      return NextResponse.json(
        { error: "招待が見つかりません" },
        { status: 404 }
      );
    }

    const updated = await prisma.sessionInvite.update({
      where: { id: invite_id },
      data: { status: action },
      include: { session: true },
    });

    return NextResponse.json({ invite: updated });
  } catch (error) {
    console.error("Update invite error:", error);
    return NextResponse.json(
      { error: "招待の更新に失敗しました" },
      { status: 500 }
    );
  }
}
