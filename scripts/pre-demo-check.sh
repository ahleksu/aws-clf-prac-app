#!/bin/bash
# Pre-demo health check — run from your laptop before every classroom session.
# Update FRONTEND once CloudFront distribution is created (P6-A2).
set -e

API="https://api.47.130.41.30.nip.io"
FRONTEND="https://REPLACE_WITH_CLOUDFRONT_DOMAIN.cloudfront.net"   # ← update after P6-A2

echo "=== Pre-Demo Health Check ==="

echo "[1] Backend API health..."
RESULT=$(curl -sf "$API/health") && echo "    OK: $RESULT" || echo "    FAIL: backend unreachable — SSH in and run: pm2 status"

echo "[2] Frontend reachability..."
STATUS=$(curl -o /dev/null -s -w "%{http_code}" "$FRONTEND")
[ "$STATUS" = "200" ] && echo "    OK: HTTP $STATUS" || echo "    FAIL: HTTP $STATUS — check CloudFront distribution status"

echo "[3] PM2 process status (run on EC2):"
echo "    ssh -i ~/Desktop/live-quiz-backend-key.pem ubuntu@47.130.41.30 'pm2 status'"

echo "[4] WebSocket smoke test (requires: npm i -g wscat):"
echo "    wscat -c 'wss://api.47.130.41.30.nip.io/socket.io/?EIO=4&transport=websocket'"

echo ""
echo "=== Done. If [1] and [2] both pass, you are ready to demo. ==="
