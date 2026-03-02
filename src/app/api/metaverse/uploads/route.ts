import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { v4 as uuidv4 } from "uuid";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";

const ALLOWED_EXTENSIONS: Record<string, { type: string; mime: string }> = {
  ".glb": { type: "model", mime: "model/gltf-binary" },
  ".gltf": { type: "model", mime: "model/gltf+json" },
  ".png": { type: "image", mime: "image/png" },
  ".jpg": { type: "image", mime: "image/jpeg" },
  ".jpeg": { type: "image", mime: "image/jpeg" },
  ".webp": { type: "image", mime: "image/webp" },
  ".mp4": { type: "video", mime: "video/mp4" },
  ".webm": { type: "video", mime: "video/webm" },
  ".mov": { type: "video", mime: "video/quicktime" },
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// GET: List uploaded assets for a session
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const sessionId = request.nextUrl.searchParams.get("sessionId");
    if (!sessionId) {
      return NextResponse.json(
        { error: "セッションIDが必要です" },
        { status: 400 }
      );
    }

    const assets = await prisma.uploadedAsset.findMany({
      where: { session_id: sessionId },
      orderBy: { created_at: "desc" },
    });

    return NextResponse.json({ assets });
  } catch (error) {
    console.error("Get uploads error:", error);
    return NextResponse.json(
      { error: "アセット一覧の取得に失敗しました" },
      { status: 500 }
    );
  }
}

// POST: Upload a file
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const sessionId = formData.get("sessionId") as string | null;

    if (!file || !sessionId) {
      return NextResponse.json(
        { error: "ファイルとセッションIDが必要です" },
        { status: 400 }
      );
    }

    // Validate extension
    const ext = path.extname(file.name).toLowerCase();
    const allowed = ALLOWED_EXTENSIONS[ext];
    if (!allowed) {
      return NextResponse.json(
        { error: "対応していないファイル形式です (.glb, .gltf, .png, .jpg, .webp, .mp4, .webm, .mov)" },
        { status: 400 }
      );
    }

    // Validate size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "ファイルサイズは50MB以下にしてください" },
        { status: 400 }
      );
    }

    // Generate stored filename
    const storedName = `${uuidv4()}${ext}`;

    // Ensure uploads directory exists
    const uploadDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadDir, { recursive: true });

    // Write file to disk
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(uploadDir, storedName), buffer);

    // Save to DB
    const asset = await prisma.uploadedAsset.create({
      data: {
        session_id: sessionId,
        uploader_id: session.user.id,
        file_name: file.name,
        stored_name: storedName,
        file_type: allowed.type,
        mime_type: allowed.mime,
        file_size: file.size,
      },
    });

    return NextResponse.json({ asset }, { status: 201 });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "ファイルアップロードに失敗しました" },
      { status: 500 }
    );
  }
}

// DELETE: Remove an uploaded asset
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { assetId } = await request.json();
    if (!assetId) {
      return NextResponse.json(
        { error: "アセットIDが必要です" },
        { status: 400 }
      );
    }

    const asset = await prisma.uploadedAsset.findUnique({
      where: { asset_id: assetId },
    });

    if (!asset) {
      return NextResponse.json(
        { error: "アセットが見つかりません" },
        { status: 404 }
      );
    }

    if (asset.uploader_id !== session.user.id) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 });
    }

    // Delete file from disk
    const filePath = path.join(
      process.cwd(),
      "public",
      "uploads",
      asset.stored_name
    );
    try {
      await unlink(filePath);
    } catch {
      // File may not exist on disk, continue with DB deletion
    }

    // Delete from DB
    await prisma.uploadedAsset.delete({ where: { asset_id: assetId } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete upload error:", error);
    return NextResponse.json(
      { error: "アセット削除に失敗しました" },
      { status: 500 }
    );
  }
}
