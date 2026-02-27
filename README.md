# sns_sumple

Next.js + Prisma + Networked A-Frame を使った SNS サンプルアプリケーションです。

## 前提条件

- Node.js v23 以上
- npm
- Docker / Docker Compose

## 開発環境構築

### 1. リポジトリのクローン

```bash
git clone <repository-url>
cd sns_sumple
```

### 2. 依存パッケージのインストール

```bash
npm install
```

### 3. 環境変数の設定

`.env` ファイルをプロジェクトルートに作成し、以下を設定します。

```bash
cp .env.example .env
```

> `.env.example` がない場合は `.env` を直接編集してください。最低限以下が必要です。

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/sns_sumple?schema=public"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key-change-this-in-production"
NEXT_PUBLIC_NAF_SERVER_URL="http://localhost:8888"
```

OAuth プロバイダ (Google, Microsoft, Twitter, Instagram) を利用する場合は、対応するクライアント ID / シークレットも設定してください。

### 4. Docker で DB を起動

```bash
docker compose up -d db
```

PostgreSQL が `localhost:5432` で起動します。ヘルスチェックが通るまで数秒待ちます。

起動確認:

```bash
docker compose ps
```

`sns_sumple_db` の Status が `healthy` になっていれば OK です。

### 5. Prisma のセットアップ

DB にスキーマを反映し、Prisma Client を生成します。

```bash
npx prisma migrate dev
```

> 初回はマイグレーション名を聞かれるので、任意の名前（例: `init`）を入力してください。

### 6. 開発サーバーの起動

Next.js と NAF シグナリングサーバーをまとめて起動します。

```bash
npm run dev:all
```

以下のサーバーが立ち上がります:

| サービス | URL |
| --- | --- |
| Next.js (フロントエンド) | http://localhost:3000 |
| NAF シグナリングサーバー | http://localhost:8888 |

ブラウザで http://localhost:3000 を開いて動作確認してください。

## 詳細情報

- [Next.js ドキュメント](https://nextjs.org/docs) - Next.js の機能と API について
- [Learn Next.js](https://nextjs.org/learn) - Next.js の対話式チュートリアル

## Vercel へのデプロイ

[Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) を使ってデプロイできます。

詳細は [Next.js デプロイメントドキュメント](https://nextjs.org/docs/app/building-your-application/deploying) を参照してください。
