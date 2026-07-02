#!/bin/bash

# Script to analyze test performance and find slowest tests

echo "Running tests and analyzing performance..."
echo "This will take a few minutes..."
echo ""

npm run test 2>&1 | tee /tmp/test-output.log

echo ""
echo "========================================="
echo "TOP 20 SLOWEST TEST FILES"
echo "========================================="
grep -E "PASS.*\([0-9]+\.[0-9]+ s\)" /tmp/test-output.log | \
  sed 's/.*PASS.*\/\([^/]*\.spec\.ts\) (\([0-9.]*\) s).*/\2 \1/' | \
  sort -rn | \
  head -20 | \
  awk '{printf "%6.2fs  %s\n", $1, $2}'

echo ""
echo "========================================="
echo "TOTAL TIME BREAKDOWN"
echo "========================================="
grep "Time:" /tmp/test-output.log

echo ""
echo "Test output saved to: /tmp/test-output.log"
