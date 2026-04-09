#!/bin/bash
# ============================================================
# Aurix Backend — Production Deploy Script
# Run from: /home/ubuntu/backend
# Usage: bash deploy.sh
# ============================================================

set -e

echo "=== Aurix Deploy $(date) ==="

# 1. Pull latest code
echo "--- Pulling latest code ---"
git pull origin main

# 2. Install/update dependencies
echo "--- Installing dependencies ---"
npm install --omit=dev

# 3. Verify .env exists
if [ ! -f .env ]; then
  echo "ERROR: .env file not found. Copy .env.example and fill in values."
  exit 1
fi

# 4. Syntax check
echo "--- Checking syntax ---"
node --check src/index.js && echo "✓ Syntax OK"

# 5. Create log directory
mkdir -p /home/ubuntu/logs

# 6. Restart or start with PM2
echo "--- Restarting PM2 ---"
if pm2 list | grep -q "aurix-backend"; then
  pm2 restart aurix-backend
else
  pm2 start ecosystem.config.cjs
fi

pm2 save

# 7. Health check
echo "--- Health check ---"
sleep 3
curl -sf http://localhost:25569/health && echo " ✓ Backend healthy" || echo " ✗ Health check failed"
curl -sf http://localhost:25569/api/ping | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const r=JSON.parse(d);console.log(' ✓ API ping:', r.message)})" 2>/dev/null || echo " ✗ API ping failed"

echo "=== Deploy complete ==="
