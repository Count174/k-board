#!/usr/bin/env bash
# Первичная настройка нового VPS для k-board / o-board.ru
# Запускать от root на Ubuntu 22.04+
# Usage: bash setup-server.sh
set -euo pipefail

REPO_URL="https://github.com/Count174/k-board"
APP_DIR="/root/k-board"
PM2_APP="k-board"
DOMAIN="o-board.ru"

echo "==> [1/7] Обновление системы и установка зависимостей"
apt-get update -q
apt-get install -y -q curl git nginx certbot python3-certbot-nginx ufw

echo "==> [2/7] Установка Node.js 20"
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get remove -y libnode-dev libnode72 nodejs-doc 2>/dev/null || true
apt-get install -y -q nodejs
node -v && npm -v

echo "==> [3/7] Установка PM2"
npm install -g pm2
pm2 startup systemd -u root --hp /root | tail -1 | bash || true

echo "==> [4/7] Клонирование репозитория"
if [ -d "$APP_DIR" ]; then
  echo "  Директория уже существует, пропускаем clone"
else
  git clone "$REPO_URL" "$APP_DIR"
fi

echo "==> [5/7] Установка npm-зависимостей"
cd "$APP_DIR/backend" && npm install --production
cd "$APP_DIR/frontend" && npm install && npm run build
mkdir -p /var/www/k-board/html
rm -rf /var/www/k-board/html/*
cp -a "$APP_DIR/frontend/dist/." /var/www/k-board/html/
chown -R www-data:www-data /var/www/k-board/html

echo "==> [6/7] Настройка nginx"
cat > /etc/nginx/sites-available/o-board.ru <<'NGINX'
server {
    listen 80;
    server_name o-board.ru www.o-board.ru;

    # Лендинг — корень
    root /var/www/k-board/html;
    index index.html;

    # SPA — всё под /app/ отдаём index.html
    location /app/ {
        try_files $uri $uri/ /app/index.html;
    }

    # API → Node.js
    location /api/ {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Telegram webhook
    location /telegram/ {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Статика (загруженные файлы)
    location /k-board/images/ {
        proxy_pass http://127.0.0.1:3002;
    }
    location /assets/goals/ {
        proxy_pass http://127.0.0.1:3002;
    }

    # Всё остальное — SPA или лендинг
    location / {
        try_files $uri $uri/ /index.html;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/o-board.ru /etc/nginx/sites-enabled/o-board.ru
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo "==> [7/7] SSL через Let's Encrypt"
certbot --nginx -d o-board.ru -d www.o-board.ru --non-interactive --agree-tos -m admin@o-board.ru || \
  echo "  WARN: certbot завершился с ошибкой — домен может ещё не резолвиться на этот IP. Запусти вручную позже."

echo ""
echo "==> ГОТОВО. Следующие шаги:"
echo "  1. Положи /root/k-board/backend/.env (см. .env.example)"
echo "  2. cd /root/k-board/backend && pm2 start ecosystem.config.cjs && pm2 save"
echo "  3. Проверь: curl http://localhost:3002/api/health || аналог"
