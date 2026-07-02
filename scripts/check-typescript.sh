#!/bin/bash

# Get the repository root directory
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "🔍 Checking TypeScript compilation..."
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

has_errors=0

# Function to check TypeScript compilation
check_ts() {
  local project_name=$1
  local project_path=$2

  echo "📦 Checking $project_name..."

  if [ ! -d "$project_path" ]; then
    echo -e "${YELLOW}⚠️  Could not find $project_name at $project_path${NC}"
    echo ""
    return
  fi

  cd "$project_path"

  # Run tsc with noEmit, capture errors
  if ! npx tsc --noEmit --skipLibCheck 2>&1 | tee /tmp/tsc-output.txt | grep -q "error TS"; then
    echo -e "${GREEN}✅ $project_name compiled successfully${NC}"
  else
    echo -e "${RED}❌ TypeScript errors found in $project_name:${NC}"
    grep "error TS" /tmp/tsc-output.txt | head -10
    has_errors=1
  fi

  cd "$REPO_ROOT"
  echo ""
}

# Check every backend service (any directory under backend/services)
for svc_dir in backend/services/*/; do
  check_ts "$(basename "$svc_dir")" "$svc_dir"
done

# Check frontend
check_ts "frontend" "frontend/public-page"

# Exit with error if any project had errors
if [ $has_errors -eq 1 ]; then
  echo -e "${RED}❌ TypeScript compilation failed. Please fix the errors before committing.${NC}"
  exit 1
else
  echo -e "${GREEN}✅ All projects compiled successfully!${NC}"
  exit 0
fi
