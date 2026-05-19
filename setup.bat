@echo off
REM Z Desktop Agent - Setup & Build Script for Windows
REM This script installs dependencies and builds the application

echo.
echo ========================================
echo      Z Desktop Agent - Setup
echo      AI Desktop Automation Tool
echo ========================================
echo.

REM Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Node.js nao encontrado. Instale Node.js 18+ em https://nodejs.org
    pause
    exit /b 1
)

echo Node.js encontrada:
node -v

REM Check npm
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo npm nao encontrado
    pause
    exit /b 1
)

echo npm encontrada:
npm -v
echo.

REM Install dependencies
echo Instalando dependencias...
call npm install

echo.
echo Reconstruindo modulos nativos para Electron...
call npx electron-rebuild 2>nul || echo electron-rebuild nao disponivel, tentando continuar...

echo.
echo Setup completo!
echo.
echo Comandos disponiveis:
echo.
echo   npm run dev          — Rodar em modo desenvolvimento
echo   npm run pack:win     — Build para Windows (.exe)
echo   npm run pack:linux   — Build para Linux (.deb + AppImage)
echo   npm run pack:all     — Build para ambos
echo.
echo Para comecar a desenvolver: npm run dev
echo.
pause
