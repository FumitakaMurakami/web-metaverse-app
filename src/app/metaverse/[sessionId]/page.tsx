"use client";

import { useSession, signIn } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import SharePopover from "@/components/SharePopover";

const AFrameScene = dynamic(
  () => import("@/components/metaverse/AFrameScene"),
  { ssr: false }
);

interface MetaverseSession {
  session_id: string;
  name: string;
  room_code: string;
  is_active: boolean;
  is_public: boolean;
  owner_id: string;
  environment_preset: string;
}

interface PublicSessionInfo {
  name: string;
  is_public: boolean;
  is_active: boolean;
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
  const [publicInfo, setPublicInfo] = useState<PublicSessionInfo | null>(null);
  const [guestLoading, setGuestLoading] = useState(false);

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

  // Unauthenticated: check if public session, otherwise redirect to signin
  useEffect(() => {
    if (status !== "unauthenticated") return;

    const checkPublic = async () => {
      try {
        const res = await fetch(
          `/api/metaverse/sessions/${sessionId}/public`
        );
        if (!res.ok) {
          router.push(`/auth/signin?callbackUrl=/metaverse/${sessionId}`);
          return;
        }
        const data = await res.json();
        if (data.session.is_public) {
          setPublicInfo(data.session);
          setLoading(false);
        } else {
          router.push(`/auth/signin?callbackUrl=/metaverse/${sessionId}`);
        }
      } catch {
        router.push(`/auth/signin?callbackUrl=/metaverse/${sessionId}`);
      }
    };
    checkPublic();
  }, [status, router, sessionId]);

  useEffect(() => {
    if (session && sessionId) fetchSession();
  }, [session, sessionId, fetchSession]);

  const handleGuestEntry = async () => {
    setGuestLoading(true);
    try {
      const result = await signIn("guest", { redirect: false });
      if (result?.error) {
        setError("ゲストログインに失敗しました");
      }
    } catch {
      setError("ゲストログインに失敗しました");
    } finally {
      setGuestLoading(false);
    }
  };

  // Guest entry screen for public rooms when unauthenticated
  if (status === "unauthenticated" && publicInfo) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-blue-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9"
                />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              {publicInfo.name}
            </h1>
            <p className="text-gray-500">
              この空間に入室しますか？
            </p>
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          {!publicInfo.is_active ? (
            <p className="text-red-600 mb-4">このセッションは終了しています</p>
          ) : (
            <div className="space-y-3">
              <button
                onClick={() =>
                  router.push(
                    `/auth/signin?callbackUrl=/metaverse/${sessionId}`
                  )
                }
                className="w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 transition font-medium"
              >
                ログインして入室
              </button>
              <button
                onClick={handleGuestEntry}
                disabled={guestLoading}
                className="w-full bg-gray-100 text-gray-700 py-2.5 rounded-lg hover:bg-gray-200 transition font-medium disabled:opacity-50 border border-gray-300"
              >
                {guestLoading ? "入室中..." : "ゲストで入室"}
              </button>
              <p className="text-xs text-gray-400 mt-2">
                ゲストは「ゲスト」として入室します。表示名は後から変更できます。
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Still loading (auth check or public info fetch)
  if (status === "loading" || (status === "unauthenticated" && !publicInfo)) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-56px)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  // Authenticated but still loading session data
  if (loading) {
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
        <div className="flex items-center gap-2">
          <SharePopover
            url={`${typeof window !== "undefined" ? window.location.origin : ""}/metaverse/${sessionId}`}
            title={metaverseSession.name}
          />
          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
            接続中
          </span>
        </div>
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
