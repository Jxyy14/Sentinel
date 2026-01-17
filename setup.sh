#!/bin/bash

# Quick Setup Script for Sentinel App
# This script helps new users set up the app after cloning

echo "🚀 Sentinel App Setup Script"
echo "=============================="
echo ""

# Check if .env file exists
if [ ! -f "backend/.env" ]; then
  echo "📝 Creating .env file from .env.example..."
  cp backend/.env.example backend/.env
  echo "✅ Created backend/.env file"
  echo ""
  echo "⚠️  IMPORTANT: You need to edit backend/.env and add your API keys!"
  echo "   Open backend/.env in a text editor and replace all 'your_*_here' values"
  echo ""
else
  echo "✅ backend/.env file already exists"
  echo ""
fi

# Check if node_modules exists for backend
if [ ! -d "backend/node_modules" ]; then
  echo "📦 Installing backend dependencies..."
  cd backend
  npm install
  cd ..
  echo "✅ Backend dependencies installed"
  echo ""
else
  echo "✅ Backend dependencies already installed"
  echo ""
fi

# Check if node_modules exists for frontend
if [ ! -d "frontend/node_modules" ]; then
  echo "📦 Installing frontend dependencies..."
  cd frontend
  npm install
  cd ..
  echo "✅ Frontend dependencies installed"
  echo ""
else
  echo "✅ Frontend dependencies already installed"
  echo ""
fi

echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "   1. Edit backend/.env and add your API keys"
echo "   2. For phone calls: Set up ngrok (see TROUBLESHOOTING.md)"
echo "   3. Start the backend: cd backend && node server.js"
echo "   4. Start the frontend: cd frontend && npm run dev"
echo ""
echo "📖 For detailed instructions, see README.md or TROUBLESHOOTING.md"
