#!/bin/bash

# LoomChain Subgraph Deployment Script

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

NETWORK=${1:-scroll-sepolia}
SUBGRAPH_NAME=${2:-loomchain-subgraph}

echo -e "${GREEN}🚀 Deploying LoomChain Subgraph${NC}"
echo -e "${YELLOW}Network: ${NETWORK}${NC}"
echo -e "${YELLOW}Subgraph: ${SUBGRAPH_NAME}${NC}"
echo ""

# Check if network configuration exists
if ! jq -e ".\"${NETWORK}\"" networks.json > /dev/null 2>&1; then
    echo -e "${RED}❌ Network ${NETWORK} not found in networks.json${NC}"
    exit 1
fi

# Extract network configuration
FACTORY_ADDRESS=$(jq -r ".\"${NETWORK}\".LoomFactory.address" networks.json)
START_BLOCK=$(jq -r ".\"${NETWORK}\".LoomFactory.startBlock" networks.json)

echo -e "${YELLOW}Factory Address: ${FACTORY_ADDRESS}${NC}"
echo -e "${YELLOW}Start Block: ${START_BLOCK}${NC}"
echo ""

# Create network-specific subgraph.yaml
echo -e "${GREEN}📝 Generating network-specific configuration...${NC}"
sed -e "s/network: scroll-sepolia/network: ${NETWORK}/g" \
    -e "s/address: \"0x71836619c0647aE4C4ab8c47Ff12426887A54F7e\"/address: \"${FACTORY_ADDRESS}\"/g" \
    -e "s/startBlock: 1000000/startBlock: ${START_BLOCK}/g" \
    subgraph.yaml > subgraph-${NETWORK}.yaml

# Generate code
echo -e "${GREEN}🔧 Generating AssemblyScript types...${NC}"
if ! graph codegen subgraph-${NETWORK}.yaml; then
    echo -e "${RED}❌ Code generation failed${NC}"
    exit 1
fi

# Build
echo -e "${GREEN}🔨 Building subgraph...${NC}"
if ! graph build subgraph-${NETWORK}.yaml; then
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

# Deploy based on network
if [ "$NETWORK" = "localhost" ]; then
    echo -e "${GREEN}🏠 Deploying to local Graph node...${NC}"
    
    # Create subgraph if it doesn't exist
    graph create --node http://localhost:8020/ loomchain/${SUBGRAPH_NAME} 2>/dev/null || true
    
    # Deploy
    if graph deploy --node http://localhost:8020/ --ipfs http://localhost:5001 loomchain/${SUBGRAPH_NAME} subgraph-${NETWORK}.yaml; then
        echo -e "${GREEN}✅ Successfully deployed to local Graph node${NC}"
        echo -e "${YELLOW}🔗 GraphQL Endpoint: http://localhost:8000/subgraphs/name/loomchain/${SUBGRAPH_NAME}${NC}"
    else
        echo -e "${RED}❌ Local deployment failed${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}☁️  Deploying to Graph Studio...${NC}"
    
    if graph deploy --studio ${SUBGRAPH_NAME} subgraph-${NETWORK}.yaml; then
        echo -e "${GREEN}✅ Successfully deployed to Graph Studio${NC}"
        echo -e "${YELLOW}🔗 Check status at: https://thegraph.com/studio/subgraph/${SUBGRAPH_NAME}${NC}"
    else
        echo -e "${RED}❌ Studio deployment failed${NC}"
        echo -e "${YELLOW}💡 Make sure you've run 'graph auth --studio YOUR_API_KEY'${NC}"
        exit 1
    fi
fi

# Cleanup
rm subgraph-${NETWORK}.yaml

echo ""
echo -e "${GREEN}🎉 Deployment complete!${NC}"
echo -e "${YELLOW}📚 Example queries available in queries/ directory${NC}"