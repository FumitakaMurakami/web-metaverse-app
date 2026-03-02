import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET: Get public session info (no auth required)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    const metaverseSession = await prisma.metaverseSession.findUnique({
      where: { session_id: sessionId },
      select: {
        name: true,
        is_public: true,
        is_active: true,
        environment_preset: true,
      },
    });

    if (!metaverseSession) {
      return NextResponse.json(
        { error: "セッションが見つかりません" },
        { status: 404 }
      );
    }

    return NextResponse.json({ session: metaverseSession });
  } catch (error) {
    console.error("Get public session info error:", error);
    return NextResponse.json(
      { error: "セッション情報の取得に失敗しました" },
      { status: 500 }
    );
  }
}
