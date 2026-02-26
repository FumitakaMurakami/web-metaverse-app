"use client";

import { useSession } from "next-auth/react";
import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";

interface Media {
  id: string;
  url: string;
  media_type: string;
}

interface Message {
  id: string;
  sender_id: string;
  message: string;
  created_at: string;
  media: Media[];
}

interface JoinUser {
  id: string;
  user_id: string;
  user_name: string | null;
}

interface Thread {
  thread_id: string;
  title: string | null;
  join_users: JoinUser[];
}

export default function ChatPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const params = useParams();
  const threadId = params.threadId as string;

  const [messages, setMessages] = useState<Message[]>([]);
  const [thread, setThread] = useState<Thread | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/threads/${threadId}/messages`);
      if (!res.ok) {
        if (res.status === 403 || res.status === 401) {
          router.push("/mypage");
          return;
        }
        throw new Error("Failed to fetch messages");
      }
      const data = await res.json();
      setMessages(data.messages || []);
      if (data.thread) setThread(data.thread);
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    } finally {
      setLoading(false);
    }
  }, [threadId, router]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/signin");
    }
  }, [status, router]);

  useEffect(() => {
    if (session && threadId) {
      fetchMessages();
      // Poll for new messages every 3 seconds
      pollingRef.current = setInterval(fetchMessages, 3000);
      return () => {
        if (pollingRef.current) clearInterval(pollingRef.current);
      };
    }
  }, [session, threadId, fetchMessages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      const res = await fetch(`/api/threads/${threadId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: newMessage }),
      });

      if (res.ok) {
        setNewMessage("");
        await fetchMessages();
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setSending(false);
    }
  };

  const getOtherUserName = () => {
    if (!thread) return "チャット";
    if (thread.title) return thread.title;
    const otherUser = thread.join_users.find(
      (ju) => ju.user_id !== session?.user?.id
    );
    return otherUser?.user_name || "不明なユーザー";
  };

  const getSenderName = (senderId: string) => {
    if (!thread) return "不明";
    const user = thread.join_users.find((ju) => ju.user_id === senderId);
    return user?.user_name || "不明";
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
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-56px)]">
      {/* Chat Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => router.push("/mypage")}
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
        <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-medium">
          {getOtherUserName()[0]?.toUpperCase() || "?"}
        </div>
        <h1 className="font-semibold text-gray-900">{getOtherUserName()}</h1>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-400">
              メッセージを送信して会話を始めましょう
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.sender_id === session.user?.id;
            return (
              <div
                key={msg.id}
                className={`flex ${isOwn ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[70%] ${
                    isOwn ? "order-2" : "order-1"
                  }`}
                >
                  {!isOwn && (
                    <p className="text-xs text-gray-500 mb-1 ml-1">
                      {getSenderName(msg.sender_id)}
                    </p>
                  )}
                  <div
                    className={`px-4 py-2 rounded-2xl ${
                      isOwn
                        ? "bg-blue-600 text-white rounded-br-md"
                        : "bg-white text-gray-900 rounded-bl-md shadow-sm"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">
                      {msg.message}
                    </p>
                  </div>
                  <p
                    className={`text-xs text-gray-400 mt-1 ${
                      isOwn ? "text-right mr-1" : "ml-1"
                    }`}
                  >
                    {new Date(msg.created_at).toLocaleTimeString("ja-JP", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <form
        onSubmit={sendMessage}
        className="bg-white border-t px-4 py-3 flex gap-2"
      >
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="メッセージを入力..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          type="submit"
          disabled={sending || !newMessage.trim()}
          className="bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 transition disabled:opacity-50"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
        </button>
      </form>
    </div>
  );
}
