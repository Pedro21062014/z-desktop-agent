#!/bin/bash
# Z Desktop Agent - Setup & Build Script
# This script installs dependencies and builds the application

set -e

echo ""
echo "╔══════════════════════════════════════╗"
echo "║     Z Desktop Agent - Setup          ║"
echo "║     AI Desktop Automation Tool       ║"
echo "╚══════════════════════════════════════╝"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js não encontrado. Instale Node.js 18+ em https://nodejs.org"
    exit 1
fi

echo "✅ Node.js $(node -v) encontrado"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm não encontrado"
    exit 1
fi

echo "✅ npm $(npm -v) encontrado"
echo ""

# Install dependencies
echo "📦 Instalando dependências..."
npm install

echo ""
echo "🔨 Recriando módulos nativos para Electron..."
npx electron-rebuild 2>/dev/null || echo "⚠️  electron-rebuild não disponível, tentando continuar..."

echo ""
echo "✅ Setup completo!"
echo ""
echo "Comandos disponíveis:"
echo ""
echo "  npm run dev          — Rodar em modo desenvolvimento"
echo "  npm run pack:linux   — Build para Linux (.deb + AppImage)"
echo "  npm run pack:win     — Build para Windows (.exe)"
echo "  npm run pack:all     — Build para ambos"
echo ""
echo "Para começar a desenvolver: npm run dev"
echo ""
