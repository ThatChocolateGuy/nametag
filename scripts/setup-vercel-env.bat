@echo off
REM Batch script to set Vercel environment variables
REM Run this from the project root directory

cd /d %~dp0..

echo.
echo ========================================
echo   Vercel Environment Setup Script
echo ========================================
echo.

REM Check if .env exists
if not exist .env (
    echo Error: .env file not found!
    exit /b 1
)

echo Loading environment variables from .env...
echo.

REM Load .env file and set variables
for /f "usebackq tokens=1,* delims==" %%a in (".env") do (
    set "line=%%a"
    if not "!line:~0,1!"=="#" (
        set "%%a=%%b"
    )
)

echo Setting environment variables in Vercel...
echo.
echo This will set variables for Production environment.
echo You'll be prompted to enter each value.
echo.
pause

REM Set SUPABASE_URL
echo Setting SUPABASE_URL...
echo %SUPABASE_URL% | vercel env add SUPABASE_URL production

REM Set SUPABASE_SERVICE_KEY
echo Setting SUPABASE_SERVICE_KEY...
echo %SUPABASE_SERVICE_KEY% | vercel env add SUPABASE_SERVICE_KEY production

REM Set MENTRAOS_API_KEY
echo Setting MENTRAOS_API_KEY...
echo %MENTRAOS_API_KEY% | vercel env add MENTRAOS_API_KEY production

REM Set PACKAGE_NAME
echo Setting PACKAGE_NAME...
echo %PACKAGE_NAME% | vercel env add PACKAGE_NAME production

REM Set OPENAI_API_KEY
echo Setting OPENAI_API_KEY...
echo %OPENAI_API_KEY% | vercel env add OPENAI_API_KEY production

REM Set OPENAI_MODEL
echo Setting OPENAI_MODEL...
echo %OPENAI_MODEL% | vercel env add OPENAI_MODEL production

REM Set COOKIE_SECRET
echo Setting COOKIE_SECRET...
echo %COOKIE_SECRET% | vercel env add COOKIE_SECRET production

echo.
echo ========================================
echo   Setup Complete!
echo ========================================
echo.
echo Next step: Deploy with 'vercel --prod'
echo.
