#!/bin/bash

# Clear Metro bundler cache and restart

echo "🧹 Clearing Metro bundler cache..."

# Clear Metro cache
rm -rf .expo
rm -rf node_modules/.cache
rm -rf $TMPDIR/metro-*
rm -rf $TMPDIR/haste-*

# For watchman if installed
if command -v watchman &> /dev/null; then
    echo "🔄 Resetting watchman..."
    watchman watch-del-all
fi

echo "✅ Cache cleared!"
echo "🚀 Restarting bundler..."

# Restart the bundler
bun start
