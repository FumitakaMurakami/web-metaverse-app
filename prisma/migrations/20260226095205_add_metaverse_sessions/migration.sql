-- CreateTable
CREATE TABLE "metaverse_sessions" (
    "session_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "owner_id" UUID NOT NULL,
    "room_code" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "max_users" INTEGER NOT NULL DEFAULT 10,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "metaverse_sessions_pkey" PRIMARY KEY ("session_id")
);

-- CreateTable
CREATE TABLE "session_invites" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "inviter_id" UUID NOT NULL,
    "invitee_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_invites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "metaverse_sessions_room_code_key" ON "metaverse_sessions"("room_code");

-- CreateIndex
CREATE UNIQUE INDEX "session_invites_session_id_invitee_id_key" ON "session_invites"("session_id", "invitee_id");

-- AddForeignKey
ALTER TABLE "session_invites" ADD CONSTRAINT "session_invites_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "metaverse_sessions"("session_id") ON DELETE CASCADE ON UPDATE CASCADE;
