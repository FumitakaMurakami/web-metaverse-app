#!/bin/bash
# =============================================================
# SNS Sumple - Production Deploy Script
#
# Usage:
#   bash scripts/deploy.sh          # 通常デプロイ
#   bash scripts/deploy.sh --init   # 初回セットアップ
# =============================================================
set -euo pipefail

APP_DIR="/var/www/sns_sumple"
LOG_DIR="/var/log/pm2"

# カラー出力
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[DEPLOY]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# -------------------------------------------------------
# 初回セットアップ
# -------------------------------------------------------
if [[ "${1:-}" == "--init" ]]; then
    log "=== Initial Setup Mode ==="

    # ログディレクトリ
    if [ ! -d "$LOG_DIR" ]; then
        sudo mkdir -p "$LOG_DIR"
        sudo chown "$(whoami):$(whoami)" "$LOG_DIR"
        log "Created log directory: $LOG_DIR"
    fi

    # アップロードディレクトリ
    mkdir -p "$APP_DIR/public/uploads"
    log "Created uploads directory"

    # 環境変数ファイルの確認
    if [ ! -f "$APP_DIR/.env" ]; then
        if [ -f "$APP_DIR/.env.production" ]; then
            cp "$APP_DIR/.env.production" "$APP_DIR/.env"
            warn ".env.production を .env にコピーしました。実際の値を設定してください:"
            warn "  vim $APP_DIR/.env"
            exit 0
        else
            err ".env.production が見つかりません"
        fi
    fi

    log "Initial setup complete. Run deploy again without --init."
    exit 0
fi

# -------------------------------------------------------
# 通常デプロイ
# -------------------------------------------------------
cd "$APP_DIR" || err "App directory not found: $APP_DIR"

# .env ファイルチェック
if [ ! -f ".env" ]; then
    err ".env ファイルがありません。先に --init を実行してください"
fi

log "=== 1/7 Pull latest code ==="
git pull origin main

log "=== 2/7 Install dependencies ==="
npm ci --omit=dev

log "=== 3/7 Generate Prisma client ==="
npx prisma generate

log "=== 4/7 Run database migrations ==="
npx prisma migrate deploy

log "=== 5/7 Build Next.js (standalone) ==="
npm run build

log "=== 6/7 Copy static files to standalone ==="
# Next.js standalone ビルドは public/ と .next/static/ を含まないため手動コピー
cp -r public .next/standalone/public
cp -r .next/static .next/standalone/.next/static

log "=== 7/7 Restart pm2 processes ==="
if pm2 list | grep -q "sns-sumple"; then
    pm2 reload ecosystem.config.js
    log "pm2 processes reloaded (zero-downtime)"
else
    pm2 start ecosystem.config.js
    pm2 save
    log "pm2 processes started for the first time"
fi

echo ""
log "========================================="
log "  Deploy complete!"
log "========================================="
echo ""
pm2 status
