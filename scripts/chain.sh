#!/bin/bash

# Chain management script for Loom Chain
# Usage: ./scripts/chain.sh [command] [options]

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$ROOT_DIR/.env"
FRONTEND_ENV_FILE="$ROOT_DIR/frontend/.env"

# Function to display usage
show_usage() {
    echo -e "${BLUE}Loom Chain Management Script${NC}"
    echo ""
    echo "Usage: $0 [command] [options]"
    echo ""
    echo "Commands:"
    echo -e "  ${GREEN}info${NC}          Show current active chain configuration"
    echo -e "  ${GREEN}list${NC}          List all configured chains"
    echo -e "  ${GREEN}local${NC}         Switch to local Anvil chain (31337)"
    echo -e "  ${GREEN}sepolia${NC}       Switch to Sepolia testnet (11155111)"
    echo -e "  ${GREEN}switch${NC} <id>   Switch to specific chain ID"
    echo -e "  ${GREEN}config${NC} <id>   Show configuration for specific chain ID"
    echo -e "  ${GREEN}deploy${NC}        Deploy contracts to active chain"
    echo -e "  ${GREEN}deploy${NC} <id>   Deploy contracts to specific chain"
    echo ""
    echo "Options:"
    echo -e "  ${YELLOW}-h, --help${NC}    Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 info"
    echo "  $0 switch sepolia"
    echo "  $0 deploy local"
    echo "  $0 config 11155111"
}

# Function to get chain config
get_chain_config() {
    local chain_id="$1"
    if [ -z "$chain_id" ]; then
        chain_id="active"
    fi
    node "$SCRIPT_DIR/getChainConfig.js" "$chain_id" 2>/dev/null || {
        echo -e "${RED}Error: Could not get chain configuration for ID: $chain_id${NC}" >&2
        return 1
    }
}

# Function to get chain property
get_chain_property() {
    local chain_id="$1"
    local property="$2"
    if [ -z "$chain_id" ] || [ -z "$property" ]; then
        echo -e "${RED}Error: Chain ID and property required${NC}" >&2
        return 1
    fi
    node "$SCRIPT_DIR/getChainConfig.js" "$chain_id" "$property" 2>/dev/null || {
        echo -e "${RED}Error: Could not get property '$property' for chain ID: $chain_id${NC}" >&2
        return 1
    }
}

# Function to update environment files
update_chain_id() {
    local chain_id="$1"
    
    echo -e "${BLUE}Updating environment files...${NC}"
    
    # Update root .env file
    if [ -f "$ENV_FILE" ]; then
        sed -i "s/ACTIVE_CHAIN_ID=.*/ACTIVE_CHAIN_ID=$chain_id/" "$ENV_FILE"
        sed -i "s/REACT_APP_ACTIVE_CHAIN_ID=.*/REACT_APP_ACTIVE_CHAIN_ID=$chain_id/" "$ENV_FILE"
    else
        echo -e "${RED}Error: Root .env file not found at $ENV_FILE${NC}" >&2
        return 1
    fi
    
    # Update frontend .env file
    if [ -f "$FRONTEND_ENV_FILE" ]; then
        sed -i "s/REACT_APP_ACTIVE_CHAIN_ID=.*/REACT_APP_ACTIVE_CHAIN_ID=$chain_id/" "$FRONTEND_ENV_FILE"
    else
        echo -e "${YELLOW}Warning: Frontend .env file not found at $FRONTEND_ENV_FILE${NC}" >&2
        echo -e "${YELLOW}Creating frontend .env file...${NC}"
        # Copy React environment variables from root .env
        grep -E "REACT_APP_" "$ENV_FILE" > "$FRONTEND_ENV_FILE" || {
            echo -e "${RED}Error: Could not create frontend .env file${NC}" >&2
            return 1
        }
    fi
    
    echo -e "${GREEN}Environment files updated successfully${NC}"
}

# Function to show chain info
show_chain_info() {
    echo -e "${BLUE}Current Active Chain Configuration:${NC}"
    get_chain_config "active" | jq -r '
        "  Chain ID: \(.chainId)",
        "  Name: \(.name // "Unknown")",
        "  RPC URL: \(.rpcUrl // "Not configured")",
        "  Factory Address: \(.factoryAddress // "Not configured")",
        "  Explorer URL: \(.explorerUrl // "Not configured")",
        if .gasPrice then "  Gas Price: \(.gasPrice) wei" else empty end,
        if .baseFee then "  Base Fee: \(.baseFee) wei" else empty end
    ' || {
        echo -e "${RED}Error: Could not retrieve chain information${NC}" >&2
        return 1
    }
}

# Function to list all chains
list_chains() {
    echo -e "${BLUE}Available Chain Configurations:${NC}"
    
    local chains=("31337" "11155111")
    for chain_id in "${chains[@]}"; do
        local config
        config=$(get_chain_config "$chain_id" 2>/dev/null)
        if [ $? -eq 0 ]; then
            local name
            name=$(echo "$config" | jq -r '.name // "Unknown"')
            local rpc_url
            rpc_url=$(echo "$config" | jq -r '.rpcUrl // "Not configured"')
            echo -e "  ${GREEN}$chain_id${NC}: $name"
            echo -e "    RPC: $rpc_url"
        fi
    done
}

# Function to switch chains
switch_chain() {
    local target="$1"
    local chain_id=""
    
    case "$target" in
        "local"|"31337")
            chain_id="31337"
            ;;
        "sepolia"|"11155111")
            chain_id="11155111"
            ;;
        [0-9]*)
            chain_id="$target"
            ;;
        *)
            echo -e "${RED}Error: Unknown chain target: $target${NC}" >&2
            echo -e "${YELLOW}Available targets: local, sepolia, or chain ID${NC}" >&2
            return 1
            ;;
    esac
    
    # Verify chain is configured
    if ! get_chain_config "$chain_id" >/dev/null 2>&1; then
        echo -e "${RED}Error: Chain ID $chain_id is not configured${NC}" >&2
        return 1
    fi
    
    local name
    name=$(get_chain_property "$chain_id" "name")
    echo -e "${BLUE}Switching to chain: $name ($chain_id)${NC}"
    
    update_chain_id "$chain_id"
    echo -e "${GREEN}Successfully switched to $name${NC}"
    echo -e "${YELLOW}Note: Restart the frontend development server to apply changes${NC}"
}

# Function to deploy contracts
deploy_contracts() {
    local target="$1"
    local chain_id=""
    
    if [ -z "$target" ]; then
        echo -e "${BLUE}Deploying to active chain...${NC}"
        forge script scripts/Deploy.s.sol \
            --rpc-url "$(get_chain_property active rpcUrl)" \
            --private-key "$(get_chain_property active privateKey)" \
            --with-gas-price "$(get_chain_property active gasPrice)" \
            --broadcast
        return $?
    fi
    
    case "$target" in
        "local"|"31337")
            chain_id="31337"
            ;;
        "sepolia"|"11155111")
            chain_id="11155111"
            ;;
        [0-9]*)
            chain_id="$target"
            ;;
        *)
            echo -e "${RED}Error: Unknown deployment target: $target${NC}" >&2
            return 1
            ;;
    esac
    
    local name
    name=$(get_chain_property "$chain_id" "name")
    echo -e "${BLUE}Deploying to $name ($chain_id)...${NC}"
    
    local gas_price_arg=""
    local gas_price
    gas_price=$(get_chain_property "$chain_id" "gasPrice" 2>/dev/null)
    if [ -n "$gas_price" ]; then
        gas_price_arg="--with-gas-price $gas_price"
    fi
    
    forge script scripts/Deploy.s.sol \
        --rpc-url "$(get_chain_property "$chain_id" "rpcUrl")" \
        --private-key "$(get_chain_property "$chain_id" "privateKey")" \
        $gas_price_arg \
        --broadcast
}

# Main script logic
main() {
    # Check if in correct directory
    if [ ! -f "$ENV_FILE" ]; then
        echo -e "${RED}Error: .env file not found. Please run this script from the project root.${NC}" >&2
        exit 1
    fi
    
    # Check if required tools are available
    if ! command -v node >/dev/null 2>&1; then
        echo -e "${RED}Error: Node.js is required but not installed${NC}" >&2
        exit 1
    fi
    
    if ! command -v jq >/dev/null 2>&1; then
        echo -e "${YELLOW}Warning: jq not found. Install with: sudo apt install jq${NC}" >&2
    fi
    
    # Parse command
    case "${1:-}" in
        "info"|"status")
            show_chain_info
            ;;
        "list"|"ls")
            list_chains
            ;;
        "local"|"sepolia")
            switch_chain "$1"
            ;;
        "switch"|"use")
            if [ -z "$2" ]; then
                echo -e "${RED}Error: Chain target required${NC}" >&2
                show_usage
                exit 1
            fi
            switch_chain "$2"
            ;;
        "config")
            if [ -z "$2" ]; then
                echo -e "${RED}Error: Chain ID required${NC}" >&2
                exit 1
            fi
            get_chain_config "$2"
            ;;
        "deploy")
            deploy_contracts "$2"
            ;;
        "-h"|"--help"|"help")
            show_usage
            ;;
        "")
            show_usage
            ;;
        *)
            echo -e "${RED}Error: Unknown command: $1${NC}" >&2
            show_usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"