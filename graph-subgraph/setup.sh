#!/bin/bash

# LoomChain Subgraph Setup Script

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${GREEN}🔧 Setting up LoomChain Subgraph Development Environment${NC}"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js is not installed. Please install Node.js first.${NC}"
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ npm is not installed. Please install npm first.${NC}"
    exit 1
fi

# Install Graph CLI globally if not installed
if ! command -v graph &> /dev/null; then
    echo -e "${YELLOW}📦 Installing Graph CLI globally...${NC}"
    npm install -g @graphprotocol/graph-cli
else
    echo -e "${GREEN}✅ Graph CLI already installed${NC}"
fi

# Install project dependencies
echo -e "${YELLOW}📦 Installing project dependencies...${NC}"
npm install

# Check if jq is installed (for JSON processing)
if ! command -v jq &> /dev/null; then
    echo -e "${YELLOW}⚠️  jq is not installed. Installing jq for JSON processing...${NC}"
    
    # Detect OS and install jq
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        sudo apt-get update && sudo apt-get install -y jq
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        brew install jq
    else
        echo -e "${RED}❌ Unable to install jq automatically. Please install jq manually.${NC}"
        exit 1
    fi
fi

# Verify installation
echo ""
echo -e "${GREEN}🔍 Verifying installation...${NC}"
echo -e "${BLUE}Graph CLI version:${NC} $(graph --version)"
echo -e "${BLUE}Node.js version:${NC} $(node --version)"
echo -e "${BLUE}npm version:${NC} $(npm --version)"
echo -e "${BLUE}jq version:${NC} $(jq --version)"

echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo -e "${YELLOW}🚀 Next steps:${NC}"
echo -e "1. Update network addresses and start blocks in networks.json"
echo -e "2. For Graph Studio deployment:"
echo -e "   graph auth --studio YOUR_API_KEY"
echo -e "3. Deploy to your chosen network:"
echo -e "   ./deploy.sh sepolia    # for Sepolia testnet"
echo -e "   ./deploy.sh localhost  # for local development"
echo ""
echo -e "${YELLOW}📚 Useful commands:${NC}"
echo -e "npm run codegen  # Generate types"
echo -e "npm run build    # Build subgraph"
echo -e "npm run deploy   # Deploy to Graph Studio"
echo ""