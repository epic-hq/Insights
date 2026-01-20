#!/bin/bash
#
# Stability Validation Script
#
# Run this script before committing changes to ensure stability.
# Useful for CI/CD pipelines and local development.
#
# Usage:
#   ./scripts/validate-stability.sh           # Run all checks
#   ./scripts/validate-stability.sh --quick   # Skip integration tests
#   ./scripts/validate-stability.sh --ci      # CI mode with stricter checks
#

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Parse arguments
QUICK_MODE=false
CI_MODE=false

for arg in "$@"; do
  case $arg in
    --quick)
      QUICK_MODE=true
      shift
      ;;
    --ci)
      CI_MODE=true
      shift
      ;;
  esac
done

# Track timing
START_TIME=$(date +%s)

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Stability Validation${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Function to print step header
step() {
  echo -e "${BLUE}→ Step $1: $2${NC}"
}

# Function to print success
success() {
  echo -e "${GREEN}✓ $1${NC}"
}

# Function to print warning
warn() {
  echo -e "${YELLOW}⚠ $1${NC}"
}

# Function to print error
error() {
  echo -e "${RED}✗ $1${NC}"
}

# Track failures
FAILURES=0

# =========================================
# Step 1: Type checking
# =========================================
step "1" "TypeScript type checking"

if pnpm typecheck 2>/dev/null; then
  success "Type check passed"
else
  error "Type check failed"
  FAILURES=$((FAILURES + 1))
  if [ "$CI_MODE" = true ]; then
    exit 1
  fi
fi

echo ""

# =========================================
# Step 2: Lint check
# =========================================
step "2" "Code linting (Biome)"

if pnpm check 2>/dev/null; then
  success "Lint check passed"
else
  warn "Lint issues found (non-blocking)"
fi

echo ""

# =========================================
# Step 3: Unit tests
# =========================================
step "3" "Unit tests"

if pnpm test 2>/dev/null; then
  success "Unit tests passed"
else
  error "Unit tests failed"
  FAILURES=$((FAILURES + 1))
  if [ "$CI_MODE" = true ]; then
    exit 1
  fi
fi

echo ""

# =========================================
# Step 4: Integration tests (skip in quick mode)
# =========================================
if [ "$QUICK_MODE" = false ]; then
  step "4" "Integration tests"

  if pnpm test:integration 2>/dev/null; then
    success "Integration tests passed"
  else
    error "Integration tests failed"
    FAILURES=$((FAILURES + 1))
    if [ "$CI_MODE" = true ]; then
      exit 1
    fi
  fi

  echo ""
else
  step "4" "Integration tests (skipped - quick mode)"
  echo ""
fi

# =========================================
# Step 5: Build validation (CI mode only)
# =========================================
if [ "$CI_MODE" = true ]; then
  step "5" "Build validation"

  if pnpm build 2>/dev/null; then
    success "Build succeeded"
  else
    error "Build failed"
    FAILURES=$((FAILURES + 1))
    exit 1
  fi

  echo ""
fi

# =========================================
# Summary
# =========================================
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Duration: ${DURATION}s"

if [ $FAILURES -eq 0 ]; then
  echo -e "${GREEN}All stability checks passed!${NC}"
  exit 0
else
  echo -e "${RED}$FAILURES check(s) failed${NC}"
  exit 1
fi
