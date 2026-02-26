"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";

export default function Home() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-56px)]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (session) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          おかえりなさい、{session.user?.name || "ユーザー"}さん
        </h1>
        <p className="text-gray-600 mb-8">
          メッセージを確認したり、新しい会話を始めましょう。
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/mypage"
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition font-medium"
          >
            マイページへ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">
        SNS App へようこそ
      </h1>
      <p className="text-lg text-gray-600 mb-10">
        友達とつながり、メッセージを交換しましょう。
      </p>
      <div className="flex gap-4 justify-center">
        <Link
          href="/auth/register"
          className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 transition font-medium text-lg"
        >
          新規登録
        </Link>
        <Link
          href="/auth/signin"
          className="bg-white text-blue-600 border border-blue-600 px-8 py-3 rounded-lg hover:bg-blue-50 transition font-medium text-lg"
        >
          ログイン
        </Link>
      </div>
    </div>
  );
}
