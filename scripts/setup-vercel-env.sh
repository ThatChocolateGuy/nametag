#!/bin/bash
# Script to configure Vercel environment variables from .env file
# Run this script after installing Vercel CLI: npm install -g vercel

set -e

echo "╔════════════════════════════════════════╗"
echo "║   Vercel Environment Setup Script      ║"
echo "╚════════════════════════════════════════╝"
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Please create a .env file with your configuration."
    exit 1
fi

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Error: Vercel CLI not found!"
    echo "Install it with: npm install -g vercel"
    exit 1
fi

echo "✓ Found .env file"
echo "✓ Vercel CLI is installed"
echo ""

# Load environment variables from .env
source .env

# Required variables
REQUIRED_VARS=(
    "SUPABASE_URL"
    "SUPABASE_SERVICE_KEY"
    "MENTRAOS_API_KEY"
    "PACKAGE_NAME"
    "OPENAI_API_KEY"
)

# Optional variables with defaults
OPTIONAL_VARS=(
    "OPENAI_MODEL:gpt-4o-mini"
    "COOKIE_SECRET:change-this-secret-in-production"
    "ASSEMBLYAI_API_KEY"
    "ENABLE_DIARIZATION:true"
)

echo "Checking required variables..."
echo ""

# Validate required variables
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ Error: $var is not set in .env file"
        exit 1
    fi
    echo "✓ $var is set"
done

echo ""
echo "This script will set the following environment variables in Vercel:"
echo "  (for Production, Preview, and Development environments)"
echo ""

for var in "${REQUIRED_VARS[@]}"; do
    echo "  • $var"
done

for var in "${OPTIONAL_VARS[@]}"; do
    var_name="${var%%:*}"
    if [ -n "${!var_name}" ]; then
        echo "  • $var_name"
    fi
done

echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo "Setting environment variables in Vercel..."
echo ""

# Function to set environment variable in Vercel
set_vercel_env() {
    local var_name=$1
    local var_value=$2

    if [ -z "$var_value" ]; then
        echo "⚠️  Skipping $var_name (not set)"
        return
    fi

    echo "Setting $var_name..."
    echo "$var_value" | vercel env add "$var_name" production preview development --force > /dev/null 2>&1 || {
        echo "⚠️  Warning: Failed to set $var_name (you may need to login: vercel login)"
    }
}

# Set required variables
for var in "${REQUIRED_VARS[@]}"; do
    set_vercel_env "$var" "${!var}"
done

# Set optional variables
for var in "${OPTIONAL_VARS[@]}"; do
    var_name="${var%%:*}"
    default_value="${var#*:}"
    value="${!var_name:-$default_value}"
    set_vercel_env "$var_name" "$value"
done

echo ""
echo "╔════════════════════════════════════════╗"
echo "║          Setup Complete! ✓             ║"
echo "╚════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "  1. Verify variables in Vercel Dashboard:"
echo "     https://vercel.com/dashboard → Your Project → Settings → Environment Variables"
echo ""
echo "  2. Redeploy your application:"
echo "     vercel --prod"
echo "     OR push to your git repository to trigger auto-deployment"
echo ""
echo "  3. Test your deployment:"
echo "     curl https://your-app.vercel.app/health"
echo ""
