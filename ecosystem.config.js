// PM2 Process Manager Configuration
// Usage:
//   pm2 start ecosystem.config.js        # 初回起動
//   pm2 reload ecosystem.config.js       # ゼロダウンタイム再起動
//   pm2 stop all                         # 全停止
//   pm2 logs                             # ログ確認
//   pm2 status                           # ステータス確認

module.exports = {
  apps: [
    // ----- Next.js Application (standalone) -----
    {
      name: "sns-sumple-web",
      script: ".next/standalone/server.js",
      cwd: "/var/www/sns_sumple",
      env: {
        NODE_ENV: "production",
        PORT: 3847,
        HOSTNAME: "127.0.0.1", // nginx 経由のみ許可
      },
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "512M",
      // ログ設定
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "/var/log/pm2/sns-web-error.log",
      out_file: "/var/log/pm2/sns-web-out.log",
      merge_logs: true,
      // 自動再起動
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: "10s",
      restart_delay: 3000,
    },

    // ----- NAF Signaling Server (Socket.IO) -----
    {
      name: "sns-sumple-naf",
      script: "naf-server/index.js",
      cwd: "/var/www/sns_sumple",
      env: {
        NODE_ENV: "production",
        NAF_PORT: 8743,
        CORS_ORIGIN: "https://your-domain.com", // 実際のドメインに変更
      },
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "256M",
      // ログ設定
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "/var/log/pm2/sns-naf-error.log",
      out_file: "/var/log/pm2/sns-naf-out.log",
      merge_logs: true,
      // 自動再起動
      autorestart: true,
      watch: false,
      max_restarts: 10,
      min_uptime: "5s",
      restart_delay: 2000,
    },
  ],
};
