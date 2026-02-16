#!/bin/bash

# Verify setup and environment configuration (Wyshkit 2026: Proactive validation)
# Usage: ./scripts/verify-setup.sh
# Exit code: 0 = success, 1 = failure

set -e

ERRORS=0
WARNINGS=0

echo "🔍 Verifying project setup..."
echo ""

# 1. Check for .env.local file
if [ ! -f ".env.local" ]; then
  echo "❌ ERROR: .env.local file not found"
  echo "   Create .env.local with required environment variables"
  ERRORS=$((ERRORS + 1))
else
  echo "✓ .env.local file exists"
fi

# 2. Check environment variables (from .env.local if it exists)
if [ -f ".env.local" ]; then
  # Source .env.local to check variables
  set -a
  source .env.local 2>/dev/null || true
  set +a

  if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ "$NEXT_PUBLIC_SUPABASE_URL" = "" ]; then
    echo "❌ ERROR: NEXT_PUBLIC_SUPABASE_URL is not set in .env.local"
    ERRORS=$((ERRORS + 1))
  else
    echo "✓ NEXT_PUBLIC_SUPABASE_URL is set"
    # Validate URL format
    if [[ ! "$NEXT_PUBLIC_SUPABASE_URL" =~ ^https?:// ]]; then
      echo "⚠️  WARNING: NEXT_PUBLIC_SUPABASE_URL doesn't look like a valid URL"
      WARNINGS=$((WARNINGS + 1))
    fi
  fi

  if [ -z "$NEXT_PUBLIC_SUPABASE_ANON_KEY" ] || [ "$NEXT_PUBLIC_SUPABASE_ANON_KEY" = "" ]; then
    echo "❌ ERROR: NEXT_PUBLIC_SUPABASE_ANON_KEY is not set in .env.local"
    ERRORS=$((ERRORS + 1))
  else
    echo "✓ NEXT_PUBLIC_SUPABASE_ANON_KEY is set"
  fi
else
  echo "⚠️  WARNING: Cannot check environment variables (no .env.local)"
  WARNINGS=$((WARNINGS + 1))
fi

# 3. Check for required directories
echo ""
echo "📁 Checking directory structure..."

REQUIRED_DIRS=(
  "src/app"
  "src/components"
  "src/lib"
  "src/hooks"
)

for dir in "${REQUIRED_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    echo "✓ $dir exists"
  else
    echo "❌ ERROR: $dir directory not found"
    ERRORS=$((ERRORS + 1))
  fi
done

# 4. Check for critical files
echo ""
echo "📄 Checking critical files..."

CRITICAL_FILES=(
  "package.json"
  "next.config.ts"
  "tsconfig.json"
  "src/app/layout.tsx"
  "src/app/(customer)/page.tsx"
  "src/lib/supabase/client.ts"
  "src/lib/supabase/server.ts"
)

for file in "${CRITICAL_FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "✓ $file exists"
  else
    echo "❌ ERROR: $file not found"
    ERRORS=$((ERRORS + 1))
  fi
done

# 5. Check TypeScript compilation (if node_modules exists)
if [ -d "node_modules" ]; then
  echo ""
  echo "🔨 Checking TypeScript compilation..."
  
  if command -v npx &> /dev/null; then
    if npx tsc --noEmit --skipLibCheck 2>&1 | head -20; then
      echo "✓ TypeScript compilation passed"
    else
      echo "⚠️  WARNING: TypeScript compilation has errors (check output above)"
      WARNINGS=$((WARNINGS + 1))
    fi
  else
    echo "⚠️  WARNING: npx not found, skipping TypeScript check"
    WARNINGS=$((WARNINGS + 1))
  fi
else
  echo ""
  echo "⚠️  WARNING: node_modules not found. Run 'npm install' first"
  WARNINGS=$((WARNINGS + 1))
fi

# 6. Check if dev server might be running
echo ""
echo "🌐 Checking for running processes..."

if lsof -ti:3000 > /dev/null 2>&1; then
  echo "⚠️  WARNING: Port 3000 is in use. A dev server might already be running."
  echo "   Consider stopping it before starting a new one:"
  echo "   lsof -ti:3000 | xargs kill -9"
  WARNINGS=$((WARNINGS + 1))
else
  echo "✓ Port 3000 is available"
fi

# Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $ERRORS -eq 0 ] && [ $WARNINGS -eq 0 ]; then
  echo "✅ Setup verification passed!"
  echo ""
  echo "Next steps:"
  echo "  1. Clear caches: ./scripts/clear-cache.sh"
  echo "  2. Start dev server: npm run dev:clean"
  echo "  3. Check health: curl http://localhost:3000/api/health"
  exit 0
elif [ $ERRORS -eq 0 ]; then
  echo "⚠️  Setup verification passed with $WARNINGS warning(s)"
  echo "   Review warnings above before proceeding"
  exit 0
else
  echo "❌ Setup verification failed with $ERRORS error(s) and $WARNINGS warning(s)"
  echo "   Fix the errors above before proceeding"
  exit 1
fi
