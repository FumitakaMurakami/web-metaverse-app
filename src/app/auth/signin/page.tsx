"use client";

import { Suspense, useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [isPublicSession, setIsPublicSession] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);

  // Detect if redirected from a public metaverse session
  useEffect(() => {
    const match = callbackUrl.match(/\/metaverse\/([^/?]+)/);
    if (!match) return;
    const sessionId = match[1];
    fetch(`/api/metaverse/sessions/${sessionId}/public`)
      .then((res) => res.json())
      .then((data) => {
        if (data.session?.is_public) {
          setIsPublicSession(true);
        }
      })
      .catch(() => {});
  }, [callbackUrl]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError(result.error);
      } else {
        router.push(callbackUrl || "/mypage");
        router.refresh();
      }
    } catch {
      setError("ログインに失敗しました");
    } finally {
      setLoading(false);
    }
  };

  const handleGuestEntry = async () => {
    setGuestLoading(true);
    try {
      const result = await signIn("guest", { redirect: false });
      if (result?.error) {
        setError("ゲストログインに失敗しました");
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError("ゲストログインに失敗しました");
    } finally {
      setGuestLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-center text-gray-900 mb-8">
          ログイン
        </h1>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              メールアドレス
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="email@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              パスワード
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="パスワード"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2.5 rounded-lg hover:bg-blue-700 transition font-medium disabled:opacity-50"
          >
            {loading ? "ログイン中..." : "ログイン"}
          </button>
        </form>

        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-gray-50 px-2 text-gray-500">または</span>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <button
              onClick={() =>
                signIn("google", { callbackUrl: callbackUrl || "/mypage" })
              }
              className="w-full flex items-center justify-center gap-2 bg-white border border-gray-300 text-gray-700 py-2.5 rounded-lg hover:bg-gray-50 transition text-sm"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Googleでログイン
            </button>
            <button
              onClick={() =>
                signIn("twitter", { callbackUrl: callbackUrl || "/mypage" })
              }
              className="w-full flex items-center justify-center gap-2 bg-black text-white py-2.5 rounded-lg hover:bg-gray-800 transition text-sm"
            >
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
              X (Twitter) でログイン
            </button>
          </div>
        </div>

        {isPublicSession && (
          <div className="mt-4">
            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="bg-gray-50 px-2 text-gray-500">
                  ゲスト入室
                </span>
              </div>
            </div>
            <button
              onClick={handleGuestEntry}
              disabled={guestLoading}
              className="w-full bg-gray-100 text-gray-700 py-2.5 rounded-lg hover:bg-gray-200 transition font-medium disabled:opacity-50 border border-gray-300"
            >
              {guestLoading ? "入室中..." : "ゲストで入室"}
            </button>
            <p className="text-xs text-gray-400 text-center mt-1">
              アカウント不要で入室できます
            </p>
          </div>
        )}

        <p className="mt-6 text-center text-sm text-gray-600">
          アカウントをお持ちでないですか？{" "}
          <Link
            href="/auth/register"
            className="text-blue-600 hover:underline"
          >
            新規登録
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[calc(100vh-56px)]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      }
    >
      <SignInForm />
    </Suspense>
  );
}
