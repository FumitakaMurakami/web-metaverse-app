"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import {
  ENVIRONMENT_PRESETS,
  getPresetById,
} from "@/lib/environmentPresets";

interface SessionInvite {
  id: string;
  invitee_id: string;
  status: string;
}

interface MetaverseSession {
  session_id: string;
  name: string;
  owner_id: string;
  room_code: string;
  is_active: boolean;
  environment_preset: string;
  created_at: string;
  invites: SessionInvite[];
}

interface InvitedSession {
  id: string;
  session_id: string;
  status: string;
  session: MetaverseSession;
}

interface PendingInvite {
  id: string;
  session_id: string;
  session: MetaverseSession;
}

interface SearchUser {
  user_id: string;
  name: string | null;
  email: string;
}

export default function MetaversePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [ownedSessions, setOwnedSessions] = useState<MetaverseSession[]>([]);
  const [invitedSessions, setInvitedSessions] = useState<InvitedSession[]>([]);
  const [pendingInvites, setPendingInvites] = useState<PendingInvite[]>([]);
  const [newSessionName, setNewSessionName] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("default");
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  // Invite modal state
  const [inviteModal, setInviteModal] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [sessionsRes, invitesRes] = await Promise.all([
        fetch("/api/metaverse/sessions"),
        fetch("/api/metaverse/invites"),
      ]);
      const sessionsData = await sessionsRes.json();
      const invitesData = await invitesRes.json();

      setOwnedSessions(sessionsData.ownedSessions || []);
      setInvitedSessions(sessionsData.invitedSessions || []);
      setPendingInvites(invitesData.invites || []);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/auth/signin");
  }, [status, router]);

  useEffect(() => {
    if (session) fetchData();
  }, [session, fetchData]);

  const createSession = async () => {
    if (!newSessionName.trim() || creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/metaverse/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newSessionName,
          environment_preset: selectedPreset,
        }),
      });
      if (res.ok) {
        setNewSessionName("");
        setSelectedPreset("default");
        fetchData();
      }
    } catch (error) {
      console.error("Failed to create session:", error);
    } finally {
      setCreating(false);
    }
  };

  const closeSession = async (sessionId: string) => {
    try {
      await fetch(`/api/metaverse/sessions/${sessionId}`, { method: "DELETE" });
      fetchData();
    } catch (error) {
      console.error("Failed to close session:", error);
    }
  };

  const handleInvite = async (action: string, inviteId: string) => {
    try {
      await fetch("/api/metaverse/invites", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invite_id: inviteId, action }),
      });
      fetchData();
    } catch (error) {
      console.error("Failed to update invite:", error);
    }
  };

  const searchUsers = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(
        `/api/users/search?q=${encodeURIComponent(searchQuery)}`
      );
      const data = await res.json();
      setSearchResults(data.users || []);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setSearching(false);
    }
  };

  const sendInvite = async (sessionId: string, inviteeId: string) => {
    try {
      const res = await fetch(
        `/api/metaverse/sessions/${sessionId}/invite`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invitee_id: inviteeId }),
        }
      );
      if (res.ok) {
        fetchData();
        setSearchResults((prev) =>
          prev.filter((u) => u.user_id !== inviteeId)
        );
      }
    } catch (error) {
      console.error("Failed to send invite:", error);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-56px)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">メタバース</h1>

      {/* Create Session */}
      <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          新しい空間を作成
        </h2>

        {/* Name input */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            空間の名前
          </label>
          <input
            type="text"
            value={newSessionName}
            onChange={(e) => setNewSessionName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createSession()}
            placeholder="空間の名前を入力"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Environment preset selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            ワールドを選択
          </label>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-80 overflow-y-auto pr-1">
            {ENVIRONMENT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setSelectedPreset(preset.id)}
                className={`relative rounded-lg overflow-hidden border-2 transition-all text-left ${
                  selectedPreset === preset.id
                    ? "border-blue-500 ring-2 ring-blue-200 scale-[1.02]"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="aspect-video bg-gray-100 relative">
                  <Image
                    src={preset.thumbnail}
                    alt={preset.label}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 33vw, 25vw"
                  />
                </div>
                <div className="px-1.5 py-1 text-center bg-white">
                  <p className="text-xs font-medium text-gray-700 truncate">
                    {preset.label}
                  </p>
                </div>
                {selectedPreset === preset.id && (
                  <div className="absolute top-1 right-1 bg-blue-500 text-white rounded-full w-5 h-5 flex items-center justify-center shadow">
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Create button */}
        <button
          onClick={createSession}
          disabled={creating || !newSessionName.trim()}
          className="w-full bg-blue-600 text-white px-5 py-2.5 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 font-medium"
        >
          {creating ? "作成中..." : "作成"}
        </button>
      </div>

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            招待が届いています
          </h2>
          <div className="space-y-3">
            {pendingInvites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between bg-white p-4 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {/* Environment thumbnail */}
                  <div className="w-16 h-11 rounded overflow-hidden bg-gray-200 shrink-0 relative">
                    <Image
                      src={
                        getPresetById(invite.session.environment_preset)
                          ?.thumbnail || "/environments/default.jpg"
                      }
                      alt={
                        getPresetById(invite.session.environment_preset)
                          ?.label || "環境"
                      }
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {invite.session.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      ルーム: {invite.session.room_code}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleInvite("accepted", invite.id)}
                    className="bg-green-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-green-700"
                  >
                    参加
                  </button>
                  <button
                    onClick={() => handleInvite("declined", invite.id)}
                    className="bg-gray-300 text-gray-700 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-400"
                  >
                    辞退
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My Sessions */}
      <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          自分の空間
        </h2>
        {ownedSessions.length === 0 ? (
          <p className="text-gray-500 text-center py-4">
            まだ空間がありません。上から作成してください。
          </p>
        ) : (
          <div className="space-y-3">
            {ownedSessions.map((s) => (
              <div
                key={s.session_id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {/* Environment thumbnail */}
                  <div className="w-16 h-11 rounded overflow-hidden bg-gray-200 shrink-0 relative">
                    <Image
                      src={
                        getPresetById(s.environment_preset)?.thumbnail ||
                        "/environments/default.jpg"
                      }
                      alt={
                        getPresetById(s.environment_preset)?.label || "環境"
                      }
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-gray-900">{s.name}</p>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          s.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-200 text-gray-500"
                        }`}
                      >
                        {s.is_active ? "アクティブ" : "終了"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">
                      ルーム: {s.room_code} / 招待:{" "}
                      {s.invites?.filter((i) => i.status === "accepted")
                        .length || 0}
                      人
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  {s.is_active && (
                    <>
                      <button
                        onClick={() => {
                          setInviteModal(s.session_id);
                          setSearchResults([]);
                          setSearchQuery("");
                        }}
                        className="bg-purple-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-purple-700"
                      >
                        招待
                      </button>
                      <button
                        onClick={() =>
                          router.push(`/metaverse/${s.session_id}`)
                        }
                        className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700"
                      >
                        入室
                      </button>
                      <button
                        onClick={() => closeSession(s.session_id)}
                        className="bg-red-100 text-red-600 px-3 py-1.5 rounded-lg text-sm hover:bg-red-200"
                      >
                        終了
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invited Sessions */}
      {invitedSessions.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            招待された空間
          </h2>
          <div className="space-y-3">
            {invitedSessions.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  {/* Environment thumbnail */}
                  <div className="w-16 h-11 rounded overflow-hidden bg-gray-200 shrink-0 relative">
                    <Image
                      src={
                        getPresetById(inv.session.environment_preset)
                          ?.thumbnail || "/environments/default.jpg"
                      }
                      alt={
                        getPresetById(inv.session.environment_preset)?.label ||
                        "環境"
                      }
                      fill
                      className="object-cover"
                      sizes="64px"
                    />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {inv.session.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      ルーム: {inv.session.room_code}
                    </p>
                  </div>
                </div>
                {inv.session.is_active && (
                  <button
                    onClick={() =>
                      router.push(`/metaverse/${inv.session_id}`)
                    }
                    className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700"
                  >
                    入室
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {inviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">ユーザーを招待</h3>
              <button
                onClick={() => setInviteModal(null)}
                className="text-gray-400 hover:text-gray-600"
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchUsers()}
                placeholder="名前 or メールアドレス"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={searchUsers}
                disabled={searching}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                検索
              </button>
            </div>
            {searchResults.length > 0 && (
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {searchResults.map((user) => (
                  <div
                    key={user.user_id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-sm">
                        {user.name || "名前未設定"}
                      </p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                    <button
                      onClick={() => sendInvite(inviteModal, user.user_id)}
                      className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700"
                    >
                      招待
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
