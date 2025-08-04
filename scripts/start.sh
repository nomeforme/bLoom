#!/bin/bash

echo "🚀 Starting Blockchain Loom Development Environment..."

# Function to cleanup background processes
cleanup() {
    echo "🧹 Cleaning up..."
    kill $(jobs -p) 2>/dev/null
    exit
}

# Trap cleanup function on script exit
trap cleanup EXIT INT TERM

# Check if Anvil is running
if ! curl -s http://localhost:8545 > /dev/null; then
    echo "🔗 Starting Anvil blockchain..."
    anvil &
    ANVIL_PID=$!
    
    # Wait for Anvil to start
    echo "⏳ Waiting for Anvil to start..."
    while ! curl -s http://localhost:8545 > /dev/null; do
        sleep 1
    done
    echo "✅ Anvil is running"
else
    echo "✅ Anvil is already running"
fi

# Deploy contracts
echo "📜 Deploying smart contracts..."
if npm run deploy > /dev/null 2>&1; then
    echo "✅ Contracts deployed successfully"
else
    echo "❌ Contract deployment failed. Please check your setup."
    exit 1
fi

# Start backend
echo "🔧 Starting backend server..."
cd backend && npm start &
BACKEND_PID=$!
cd ..

# Wait for backend to start
echo "⏳ Waiting for backend to start..."
while ! curl -s http://localhost:3001/health > /dev/null; do
    sleep 1
done
echo "✅ Backend is running"

# Start frontend
echo "🌐 Starting frontend..."
cd frontend && npm start &
FRONTEND_PID=$!
cd ..

echo "✅ All services started!"
echo ""
echo "🌐 Frontend: http://localhost:3000"
echo "🔧 Backend: http://localhost:3001"
echo "🔗 Blockchain: http://localhost:8545"
echo ""
echo "Press Ctrl+C to stop all services"

# Wait for all background processes
wait