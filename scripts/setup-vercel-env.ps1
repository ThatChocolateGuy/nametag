# PowerShell Script to configure Vercel environment variables from .env file
# Run this script after installing Vercel CLI: npm install -g vercel

$ErrorActionPreference = "Stop"

Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   Vercel Environment Setup Script      ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check if .env file exists
if (-not (Test-Path ".env")) {
    Write-Host "❌ Error: .env file not found!" -ForegroundColor Red
    Write-Host "Please create a .env file with your configuration."
    exit 1
}

# Check if vercel CLI is installed
$vercelInstalled = Get-Command vercel -ErrorAction SilentlyContinue
if (-not $vercelInstalled) {
    Write-Host "❌ Error: Vercel CLI not found!" -ForegroundColor Red
    Write-Host "Install it with: npm install -g vercel"
    exit 1
}

Write-Host "✓ Found .env file" -ForegroundColor Green
Write-Host "✓ Vercel CLI is installed" -ForegroundColor Green
Write-Host ""

# Parse .env file
$envVars = @{}
Get-Content .env | ForEach-Object {
    if ($_ -match '^([^#][^=]+)=(.*)$') {
        $key = $matches[1].Trim()
        $value = $matches[2].Trim()
        $envVars[$key] = $value
    }
}

# Required variables
$requiredVars = @(
    "SUPABASE_URL",
    "SUPABASE_SERVICE_KEY",
    "MENTRAOS_API_KEY",
    "PACKAGE_NAME",
    "OPENAI_API_KEY"
)

# Optional variables with defaults
$optionalVars = @{
    "OPENAI_MODEL" = "gpt-4o-mini"
    "COOKIE_SECRET" = "change-this-secret-in-production"
    "ASSEMBLYAI_API_KEY" = ""
    "ENABLE_DIARIZATION" = "true"
}

Write-Host "Checking required variables..." -ForegroundColor Yellow
Write-Host ""

# Validate required variables
foreach ($var in $requiredVars) {
    if (-not $envVars.ContainsKey($var) -or [string]::IsNullOrWhiteSpace($envVars[$var])) {
        Write-Host "❌ Error: $var is not set in .env file" -ForegroundColor Red
        exit 1
    }
    Write-Host "✓ $var is set" -ForegroundColor Green
}

Write-Host ""
Write-Host "This script will set the following environment variables in Vercel:" -ForegroundColor Yellow
Write-Host "  (for Production, Preview, and Development environments)"
Write-Host ""

foreach ($var in $requiredVars) {
    Write-Host "  • $var"
}

foreach ($var in $optionalVars.Keys) {
    if ($envVars.ContainsKey($var) -and -not [string]::IsNullOrWhiteSpace($envVars[$var])) {
        Write-Host "  • $var"
    }
}

Write-Host ""
$continue = Read-Host "Continue? (y/n)"

if ($continue -ne "y" -and $continue -ne "Y") {
    Write-Host "Aborted."
    exit 0
}

Write-Host ""
Write-Host "Setting environment variables in Vercel..." -ForegroundColor Yellow
Write-Host ""

# Function to set environment variable in Vercel
function Set-VercelEnv {
    param(
        [string]$VarName,
        [string]$VarValue
    )

    if ([string]::IsNullOrWhiteSpace($VarValue)) {
        Write-Host "⚠️  Skipping $VarName (not set)" -ForegroundColor Yellow
        return
    }

    Write-Host "Setting $VarName..." -ForegroundColor Cyan

    try {
        # Use echo to pipe the value to vercel env add
        $VarValue | vercel env add $VarName production preview development --force 2>&1 | Out-Null
        Write-Host "✓ $VarName set successfully" -ForegroundColor Green
    }
    catch {
        Write-Host "⚠️  Warning: Failed to set $VarName" -ForegroundColor Yellow
        Write-Host "   (you may need to login: vercel login)" -ForegroundColor Yellow
    }
}

# Set required variables
foreach ($var in $requiredVars) {
    Set-VercelEnv -VarName $var -VarValue $envVars[$var]
}

# Set optional variables
foreach ($var in $optionalVars.Keys) {
    if ($envVars.ContainsKey($var)) {
        Set-VercelEnv -VarName $var -VarValue $envVars[$var]
    }
    elseif (-not [string]::IsNullOrWhiteSpace($optionalVars[$var])) {
        Set-VercelEnv -VarName $var -VarValue $optionalVars[$var]
    }
}

Write-Host ""
Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║          Setup Complete! ✓             ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Verify variables in Vercel Dashboard:"
Write-Host "     https://vercel.com/dashboard → Your Project → Settings → Environment Variables"
Write-Host ""
Write-Host "  2. Redeploy your application:"
Write-Host "     vercel --prod"
Write-Host "     OR push to your git repository to trigger auto-deployment"
Write-Host ""
Write-Host "  3. Test your deployment:"
Write-Host "     curl https://your-app.vercel.app/health"
Write-Host ""
