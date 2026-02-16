#!/bin/bash

# WyshKit - Complete Server Restart and Verification Script
# This script clears caches, restarts the server, and verifies routes work

set -e  # Exit on error

echo "🚀 WyshKit - Server Restart & Verification"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Check if server is running
echo "📋 Step 1: Checking for running Next.js servers..."
if lsof -ti:3000 > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Port 3000 is in use. Attempting to stop existing server...${NC}"
    lsof -ti:3000 | xargs kill -9 2>/dev/null || echo "No process found to kill"
    sleep 2
else
    echo -e "${GREEN}✅ Port 3000 is available${NC}"
fi
echo ""

# Step 2: Clear all caches
echo "🧹 Step 2: Clearing caches..."
echo "  - Removing .next directory..."
rm -rf .next
echo "  - Removing .turbo directory..."
rm -rf .turbo
echo "  - Removing node_modules/.cache..."
rm -rf node_modules/.cache
echo "  - Removing .tsbuildinfo files..."
find . -name "*.tsbuildinfo" -delete 2>/dev/null || true
echo -e "${GREEN}✅ Caches cleared${NC}"
echo ""

# Step 3: Verify configuration
echo "🔍 Step 3: Verifying configuration..."
if grep -q "outputFileTracingRoot.*\.\.\/\.\.\/" next.config.ts 2>/dev/null; then
    echo -e "${RED}❌ ERROR: outputFileTracingRoot misconfiguration still present!${NC}"
    echo "   Please ensure next.config.ts has the fix applied."
    exit 1
else
    echo -e "${GREEN}✅ Configuration verified (outputFileTracingRoot fix applied)${NC}"
fi
echo ""

# Step 4: Verify route files exist
echo "📁 Step 4: Verifying route files..."
if [ ! -f "src/app/(customer)/page.tsx" ]; then
    echo -e "${RED}❌ ERROR: Home page route not found!${NC}"
    exit 1
fi
if [ ! -f "src/app/api/debug/route.ts" ]; then
    echo -e "${RED}❌ ERROR: Debug API route not found!${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Route files verified${NC}"
echo ""

# Step 5: Check environment variables (optional - don't fail if missing)
echo "🔐 Step 5: Checking environment variables..."
if [ -f ".env.local" ]; then
    echo -e "${GREEN}✅ .env.local file exists${NC}"
    if grep -q "NEXT_PUBLIC_SUPABASE_URL" .env.local 2>/dev/null; then
        echo -e "${GREEN}✅ NEXT_PUBLIC_SUPABASE_URL found${NC}"
    else
        echo -e "${YELLOW}⚠️  NEXT_PUBLIC_SUPABASE_URL not found in .env.local${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  .env.local file not found (may be fine if using .env)${NC}"
fi
echo ""

# Step 6: Start the server in background
echo "🚀 Step 6: Starting Next.js development server..."
echo "   This will start in the background..."
echo ""

# Start server in background and capture PID
npm run dev > /tmp/nextjs-server.log 2>&1 &
SERVER_PID=$!

# Wait for server to start
echo "⏳ Waiting for server to start (max 30 seconds)..."
TIMEOUT=30
ELAPSED=0
while [ $ELAPSED -lt $TIMEOUT ]; do
    if curl -s http://localhost:3000/api/debug > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Server started successfully!${NC}"
        break
    fi
    sleep 1
    ELAPSED=$((ELAPSED + 1))
    echo -n "."
done
echo ""

if [ $ELAPSED -eq $TIMEOUT ]; then
    echo -e "${RED}❌ ERROR: Server did not start within $TIMEOUT seconds${NC}"
    echo "   Check server logs: tail -f /tmp/nextjs-server.log"
    kill $SERVER_PID 2>/dev/null || true
    exit 1
fi

# Step 7: Verify routes
echo ""
echo "🧪 Step 7: Testing routes..."
echo ""

# Test 1: Diagnostic endpoint
echo -n "  Testing /api/debug... "
if curl -s http://localhost:3000/api/debug | grep -q "status.*ok" 2>/dev/null; then
    echo -e "${GREEN}✅ PASS${NC}"
else
    echo -e "${RED}❌ FAIL${NC}"
    ROUTE_FAILED=1
fi

# Test 2: Simple API route
echo -n "  Testing /api/test... "
if curl -s http://localhost:3000/api/test | grep -q "status.*ok" 2>/dev/null; then
    echo -e "${GREEN}✅ PASS${NC}"
else
    echo -e "${RED}❌ FAIL${NC}"
    ROUTE_FAILED=1
fi

# Test 3: Home page (check for 200, not 404)
echo -n "  Testing / (home page)... "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/)
if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ PASS (HTTP $HTTP_CODE)${NC}"
elif [ "$HTTP_CODE" = "404" ]; then
    echo -e "${RED}❌ FAIL (HTTP 404 - Route not found)${NC}"
    ROUTE_FAILED=1
else
    echo -e "${YELLOW}⚠️  Unexpected HTTP $HTTP_CODE${NC}"
    ROUTE_FAILED=1
fi

# Test 4: Health check
echo -n "  Testing /api/health... "
if curl -s http://localhost:3000/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ PASS${NC}"
else
    echo -e "${YELLOW}⚠️  Health check endpoint not responding (may be fine)${NC}"
fi

echo ""

# Final summary
if [ -z "${ROUTE_FAILED:-}" ]; then
    echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
    echo -e "${GREEN}✅ SUCCESS: All routes are working correctly!${NC}"
    echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
    echo ""
    echo "📝 Server is running on: http://localhost:3000"
    echo "📝 Server PID: $SERVER_PID"
    echo "📝 Logs: tail -f /tmp/nextjs-server.log"
    echo ""
    echo "🧪 Manual Verification:"
    echo "   curl http://localhost:3000/api/debug"
    echo "   curl http://localhost:3000/api/test"
    echo "   curl http://localhost:3000/"
    echo ""
    echo "🛑 To stop the server: kill $SERVER_PID"
    exit 0
else
    echo -e "${RED}═══════════════════════════════════════════════${NC}"
    echo -e "${RED}❌ FAILURE: Some routes are not working${NC}"
    echo -e "${RED}═══════════════════════════════════════════════${NC}"
    echo ""
    echo "📝 Check server logs: tail -f /tmp/nextjs-server.log"
    echo "📝 Server PID: $SERVER_PID (still running for debugging)"
    exit 1
fi
