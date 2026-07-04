#!/bin/bash
#
# Typechecks every project (libs AND services AND frontend) via Nx.
#
# Each project defines a cached `typecheck` target that runs `tsc --noEmit`
# against its own tsconfig. This delegates to `nx run-many` so:
#   - the shared libs are covered (the old hand-rolled loop skipped them),
#   - success/failure comes from tsc's EXIT CODE, not grepping stdout for
#     "error TS" (which missed non-TS-prefixed diagnostics), and
#   - results are Nx-cached, so an unchanged project is not re-checked.
set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo "🔍 Typechecking all projects (nx run-many -t typecheck)..."
exec npx nx run-many -t typecheck --exclude=forgestack
