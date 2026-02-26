"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";

export default function Header() {
  const { data: session } = useSession();

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="text-xl font-bold text-blue-600">
          SNS App
        </Link>
        <nav className="flex items-center gap-4">
          {session ? (
            <>
              <Link
                href="/mypage"
                className="text-sm text-gray-700 hover:text-blue-600 transition"
              >
                マイページ
              </Link>
              <Link
                href="/metaverse"
                className="text-sm text-gray-700 hover:text-purple-600 transition"
              >
                メタバース
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="text-sm text-gray-500 hover:text-red-500 transition"
              >
                ログアウト
              </button>
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-medium">
                {session.user?.name?.[0]?.toUpperCase() || "U"}
              </div>
            </>
          ) : (
            <>
              <Link
                href="/auth/signin"
                className="text-sm text-gray-700 hover:text-blue-600 transition"
              >
                ログイン
              </Link>
              <Link
                href="/auth/register"
                className="text-sm bg-blue-600 text-white px-4 py-1.5 rounded-full hover:bg-blue-700 transition"
              >
                新規登録
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
