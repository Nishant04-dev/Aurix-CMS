#!/bin/bash
# Aurix Backend — Pull latest code and restart
# Run this on the server: bash backend/start.sh

set -e

echo "=== Aurix Backend Deploy ==="

# 1. Pull latest code
git pull origin main

# 2. Install dependencies
cd backend
npm install --omit=dev

# 3. Verify the route file exists and has /profile
echo ""
echo "--- Verifying routes ---"
grep -n "profile" src/routes/index.js | head -5
echo ""

# 4. Test syntax
node --check src/index.js && echo "✓ Syntax OK"

# 5. Start (or restart if using PM2)
if command -v pm2 &> /dev/null; then
  pm2 restart aurix-backend 2>/dev/null || pm2 start src/index.js --name aurix-backend
  pm2 save
  echo "✓ Started with PM2"
else
  echo "Starting with node..."
  node src/index.js &
  echo "✓ Started (PID: $!)"
fi

echo ""
echo "=== Testing /health ==="
sleep 2
curl -s http://localhost:25569/health | node -e "process.stdin.resume();let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d)))" 2>/dev/null || curl -s http://localhost:25569/health

echo ""
echo "=== Testing /api/test ==="
curl -s http://localhost:25569/api/test
echo ""
echo "=== Done ==="
