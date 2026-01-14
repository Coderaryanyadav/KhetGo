#!/bin/bash
# KhetGo Professional Build & Polish Script

echo "🚀 Initializing Professional Build..."

# 1. Clean previous artifacts
echo "🧹 Cleaning previous builds..."
rm -rf dist

# 2. Install dependencies (if needed)
echo "📦 Verifying dependencies..."
npm install

# 3. Production Build
echo "🏗️  Building for Production..."
npm run build

# 4. Post-build checks
if [ -d "dist" ]; then
    echo "✅ Build Completed Successfully!"
    echo "📊 Build Stats:"
    du -sh dist/assets/*
else
    echo "❌ Build Failed!"
    exit 1
fi

echo "✨ Project is ready for deployment."
echo "💡 Tip: Run 'npm run preview' to test the production build locally."
