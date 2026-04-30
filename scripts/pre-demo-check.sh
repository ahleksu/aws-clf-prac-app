#!/usr/bin/env bash
# Pre-demo health check — run from your laptop before every classroom session.
# Start the EC2 backend first if it has been stopped:
#   ./scripts/ec2-backend-lifecycle.sh start
set -euo pipefail

API="${API:-https://api.47.130.41.30.nip.io}"
FRONTEND="${FRONTEND:-https://aws-clf-prac-app.vercel.app}"
FAILED=0

echo "=== Pre-Demo Health Check ==="

echo "[1] Backend API health..."
if RESULT=$(curl -sf "$API/health"); then
  echo "    OK: $RESULT"
else
  echo "    FAIL: backend unreachable — run ./scripts/ec2-backend-lifecycle.sh start, then check PM2"
  FAILED=1
fi

echo "[2] Frontend reachability..."
STATUS=$(curl -o /dev/null -s -w "%{http_code}" "$FRONTEND")
if [ "$STATUS" = "200" ]; then
  echo "    OK: HTTP $STATUS"
else
  echo "    FAIL: HTTP $STATUS — check Vercel deployment status"
  FAILED=1
fi

echo "[3] PM2 process status (run on EC2):"
echo "    ssh -i ~/Desktop/live-quiz-backend-key.pem ubuntu@47.130.41.30 'pm2 status'"

echo "[4] WebSocket smoke test (requires: npm i -g wscat):"
echo "    wscat -c 'wss://api.47.130.41.30.nip.io/socket.io/?EIO=4&transport=websocket'"

echo ""
if [ "$FAILED" -eq 0 ]; then
  echo "=== Done. Backend and frontend are reachable. ==="
else
  echo "=== Done with failures. Fix the failed checks before demo. ==="
  exit 1
fi
