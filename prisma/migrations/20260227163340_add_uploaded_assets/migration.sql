-- CreateTable
CREATE TABLE "uploaded_assets" (
    "asset_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "uploader_id" UUID NOT NULL,
    "file_name" TEXT NOT NULL,
    "stored_name" TEXT NOT NULL,
    "file_type" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uploaded_assets_pkey" PRIMARY KEY ("asset_id")
);

-- AddForeignKey
ALTER TABLE "uploaded_assets" ADD CONSTRAINT "uploaded_assets_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "metaverse_sessions"("session_id") ON DELETE CASCADE ON UPDATE CASCADE;
