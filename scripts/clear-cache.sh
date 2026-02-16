#!/bin/bash

# Clear all caches and build artifacts (Wyshkit 2026: Comprehensive cleanup)
# Usage: ./scripts/clear-cache.sh

set -e  # Exit on error

echo "🧹 Clearing all caches and build artifacts..."

# 1. Remove Next.js build cache
if [ -d ".next" ]; then
  echo "  ✓ Removing .next directory..."
  rm -rf .next
else
  echo "  ℹ .next directory not found (already clean)"
fi

# 2. Remove Turbopack cache
if [ -d ".turbo" ]; then
  echo "  ✓ Removing .turbo directory..."
  rm -rf .turbo
else
  echo "  ℹ .turbo directory not found (already clean)"
fi

# 3. Remove node_modules cache
if [ -d "node_modules/.cache" ]; then
  echo "  ✓ Removing node_modules/.cache..."
  rm -rf node_modules/.cache
else
  echo "  ℹ node_modules/.cache not found (already clean)"
fi

# 4. Remove TypeScript build info
if [ -d ".tsbuildinfo" ]; then
  echo "  ✓ Removing .tsbuildinfo..."
  rm -f .tsbuildinfo
fi

# 5. Clear Next.js telemetry (if any)
if [ -d ".next" ]; then
  echo "  ✓ Clearing Next.js telemetry..."
  rm -rf .next/cache 2>/dev/null || true
fi

# 6. Clear browser storage files (if using a tool that stores them)
if [ -d ".vercel" ]; then
  echo "  ✓ Clearing .vercel cache..."
  rm -rf .vercel/cache 2>/dev/null || true
fi

# 7. Clear any package manager caches (npm/yarn/pnpm)
if command -v npm &> /dev/null; then
  echo "  ✓ Clearing npm cache..."
  npm cache clean --force 2>/dev/null || true
fi

echo ""
echo "✅ All caches cleared!"
echo ""
echo "📋 Next steps:"
echo "  1. Verify .env.local has required variables:"
echo "     - NEXT_PUBLIC_SUPABASE_URL"
echo "     - NEXT_PUBLIC_SUPABASE_ANON_KEY"
echo ""
echo "  2. Install dependencies (if needed):"
echo "     npm install"
echo ""
echo "  3. Restart dev server:"
echo "     npm run dev:clean"
echo "     # OR manually: rm -rf .next .turbo && npm run dev"
echo ""
echo "  4. Check health endpoint:"
echo "     curl http://localhost:3000/api/health"
echo ""
echo "  5. Open customer UI:"
echo "     http://localhost:3000"
