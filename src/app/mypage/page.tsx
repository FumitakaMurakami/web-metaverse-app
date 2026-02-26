"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";

interface JoinUser {
  id: string;
  user_id: string;
  user_name: string | null;
  thread_id: string;
}

interface ChatLog {
  id: string;
  message: string;
  created_at: string;
}

interface Thread {
  thread_id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  join_users: JoinUser[];
  chat_logs: ChatLog[];
}

interface User {
  user_id: string;
  name: string | null;
  email: string;
  avatar_url: string | null;
}

export default function MyPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingThreads, setLoadingThreads] = useState(true);

  const fetchThreads = useCallback(async () => {
    try {
      const res = await fetch("/api/threads");
      const data = await res.json();
      if (data.threads) {
        setThreads(data.threads);
      }
    } catch (error) {
      console.error("Failed to fetch threads:", error);
    } finally {
      setLoadingThreads(false);
    }
  }, []);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  useEffect(() => {
    if (session) {
      fetchThreads();
    }
  }, [session, fetchThreads]);

  const handleSearch = async () => {
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

  const startChat = async (targetUserId: string) => {
    try {
      const res = await fetch("/api/threads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target_user_id: targetUserId }),
      });
      const data = await res.json();
      if (data.thread) {
        router.push(`/chat/${data.thread.thread_id}`);
      }
    } catch (error) {
      console.error("Failed to start chat:", error);
    }
  };

  const getThreadDisplayName = (thread: Thread) => {
    if (thread.title) return thread.title;
    const otherUser = thread.join_users.find(
      (ju) => ju.user_id !== session?.user?.id
    );
    return otherUser?.user_name || "不明なユーザー";
  };

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-56px)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Profile Section */}
      <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-2xl font-bold">
            {session.user?.name?.[0]?.toUpperCase() || "U"}
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {session.user?.name || "ユーザー"}
            </h1>
            <p className="text-sm text-gray-500">{session.user?.email}</p>
          </div>
        </div>
      </div>

      {/* User Search */}
      <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          ユーザーを検索
        </h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="名前またはメールアドレスで検索"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            onClick={handleSearch}
            disabled={searching}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {searching ? "検索中..." : "検索"}
          </button>
        </div>

        {searchResults.length > 0 && (
          <div className="mt-4 space-y-2">
            {searchResults.map((user) => (
              <div
                key={user.user_id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-sm font-medium">
                    {user.name?.[0]?.toUpperCase() || "U"}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {user.name || "名前未設定"}
                    </p>
                    <p className="text-sm text-gray-500">{user.email}</p>
                  </div>
                </div>
                <button
                  onClick={() => startChat(user.user_id)}
                  className="bg-blue-600 text-white px-3 py-1.5 rounded-lg text-sm hover:bg-blue-700 transition"
                >
                  チャット
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Thread List */}
      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          メッセージ
        </h2>

        {loadingThreads ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
          </div>
        ) : threads.length === 0 ? (
          <p className="text-center text-gray-500 py-8">
            まだメッセージがありません。ユーザーを検索して会話を始めましょう。
          </p>
        ) : (
          <div className="space-y-1">
            {threads.map((thread) => (
              <button
                key={thread.thread_id}
                onClick={() => router.push(`/chat/${thread.thread_id}`)}
                className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition text-left"
              >
                <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-medium">
                  {getThreadDisplayName(thread)[0]?.toUpperCase() || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {getThreadDisplayName(thread)}
                  </p>
                  <p className="text-sm text-gray-500 truncate">
                    {thread.chat_logs[0]?.message || "メッセージなし"}
                  </p>
                </div>
                <span className="text-xs text-gray-400">
                  {new Date(thread.updated_at).toLocaleDateString("ja-JP")}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
