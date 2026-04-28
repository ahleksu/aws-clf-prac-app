#!/bin/bash
# EC2 backend setup script — run line-by-line via SSH, not all at once.
# SSH: ssh -i ~/Desktop/live-quiz-backend-key.pem ubuntu@47.130.41.30
set -e

DOMAIN="api.47.130.41.30.nip.io"
REPO="https://github.com/ahleksu/aws-clf-prac-app.git"

# ── P6-B3: System + Node.js 20 + PM2 + nginx + certbot ──────────────────────
sudo apt-get update && sudo apt-get upgrade -y

curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v   # must be v20.x

sudo npm install -g pm2

sudo apt-get install -y nginx certbot python3-certbot-nginx
sudo nginx -t   # must pass

# ── P6-B4: Clone repo + build backend ────────────────────────────────────────
git clone "$REPO" ~/aws-clf-prac-app
cd ~/aws-clf-prac-app/backend
cp -r ../public/quiz/ ./quiz/
npm install
npm run build
ls dist/index.js   # must exist

# ── P6-B5: nip.io domain ─────────────────────────────────────────────────────
# Elastic IP: 47.130.41.30
# nip.io domain: api.47.130.41.30.nip.io
nslookup "$DOMAIN"   # must resolve to 47.130.41.30

# ── P6-B6: Configure nginx ───────────────────────────────────────────────────
sudo tee /etc/nginx/sites-available/live-quiz > /dev/null <<NGINX
limit_conn_zone \$binary_remote_addr zone=conn_limit_per_ip:10m;
limit_req_zone  \$binary_remote_addr zone=req_limit_per_ip:10m rate=60r/m;

server {
    listen 80;
    server_name ${DOMAIN};
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    server_name ${DOMAIN};

    ssl_certificate     /etc/letsencrypt/live/${DOMAIN}/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/${DOMAIN}/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;

    # All 30 students may share one school NAT IP
    limit_conn conn_limit_per_ip 120;

    location /health {
        limit_req zone=req_limit_per_ip burst=5 nodelay;
        proxy_pass http://localhost:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINX

sudo ln -sf /etc/nginx/sites-available/live-quiz /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# ── P6-B7: Let's Encrypt cert ────────────────────────────────────────────────
sudo certbot --nginx -d "$DOMAIN"
# Follow the prompts. certbot auto-renews via systemd timer.
sudo certbot renew --dry-run   # verify auto-renewal works

# ── P6-B8: Start with PM2 + configure systemd startup ────────────────────────
cd ~/aws-clf-prac-app/backend

# Create .env for production
cat > .env <<'ENV'
PORT=3000
NODE_ENV=production
# CORS_ORIGIN will be set after CloudFront distribution is created (P6-C1)
CORS_ORIGIN=*
ENV

pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup   # IMPORTANT: copy and run the sudo command it prints

# ── Verify ───────────────────────────────────────────────────────────────────
curl http://localhost:3000/health
# → {"status":"ok","sessions":0}

curl https://api.47.130.41.30.nip.io/health
# → {"status":"ok","sessions":0}  with valid TLS (no curl SSL errors)
