"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";

const AFrameScene = dynamic(
  () => import("@/components/metaverse/AFrameScene"),
  { ssr: false }
);

interface MetaverseSession {
  session_id: string;
  name: string;
  room_code: string;
  is_active: boolean;
  owner_id: string;
  environment_preset: string;
}

export default function MetaverseRoomPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [metaverseSession, setMetaverseSession] =
    useState<MetaverseSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const nafServerUrl =
    process.env.NEXT_PUBLIC_NAF_SERVER_URL || "http://localhost:8080";

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/metaverse/sessions/${sessionId}`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "セッションの取得に失敗しました");
        return;
      }
      const data = await res.json();
      setMetaverseSession(data.session);
    } catch {
      setError("セッションの取得に失敗しました");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, router]);

  useEffect(() => {
    if (session && sessionId) fetchSession();
  }, [session, sessionId, fetchSession]);

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-56px)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={() => router.push("/metaverse")}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          メタバース一覧に戻る
        </button>
      </div>
    );
  }

  if (!metaverseSession || !metaverseSession.is_active) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <p className="text-gray-600 mb-4">このセッションは終了しています</p>
        <button
          onClick={() => router.push("/metaverse")}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          メタバース一覧に戻る
        </button>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col">
      {/* Top bar */}
      <div className="bg-white border-b px-4 py-2 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/metaverse")}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <div>
            <h1 className="font-semibold text-gray-900">
              {metaverseSession.name}
            </h1>
            <p className="text-xs text-gray-500">
              ルーム: {metaverseSession.room_code}
            </p>
          </div>
        </div>
        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
          接続中
        </span>
      </div>

      {/* A-Frame scene */}
      <div className="flex-1">
        <AFrameScene
          roomCode={metaverseSession.room_code}
          nafServerUrl={nafServerUrl}
          userName={session?.user?.name || undefined}
          sessionId={metaverseSession.session_id}
          environmentPreset={metaverseSession.environment_preset}
        />
      </div>
    </div>
  );
}
