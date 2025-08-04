#!/bin/bash

echo "🚀 Setting up Blockchain Loom..."

# Check if forge is installed
if ! command -v forge &> /dev/null; then
    echo "❌ Forge (Foundry) is not installed. Please install it first:"
    echo "curl -L https://foundry.paradigm.xyz | bash"
    echo "foundryup"
    exit 1
fi

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install it first."
    exit 1
fi

echo "📦 Installing dependencies..."

# Install main dependencies
echo "Installing main project dependencies..."
npm install

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd frontend && npm install && cd ..

# Install backend dependencies
echo "Installing backend dependencies..."
cd backend && npm install && cd ..

# Build smart contracts
echo "🔨 Building smart contracts..."
forge build

# Copy environment file
if [ ! -f .env ]; then
    echo "📝 Creating .env file from example..."
    cp config/.env.example .env
    echo "⚠️  Please edit .env with your API keys if you want to use external LLM providers"
fi

echo "✅ Setup complete!"
echo ""
echo "🚀 To get started:"
echo "1. Start Anvil: npm run anvil"
echo "2. In another terminal, deploy contracts: npm run deploy"
echo "3. Start the backend: npm run backend"
echo "4. In another terminal, start the frontend: npm run frontend"
echo ""
echo "📖 Or use the development script: npm run dev"