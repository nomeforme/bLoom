#!/bin/bash

# Subgraph Deployment Script
# This script handles the complete deployment process for the Bloom subgraph

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SUBGRAPH_DIR="bloom-subgraph"
SUBGRAPH_NAME="bloom-subgraph"
DEPLOY_KEY_FILE=".graph-deploy-key"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if we're in the right directory
check_directory() {
    if [ ! -d "$SUBGRAPH_DIR" ]; then
        print_error "Subgraph directory '$SUBGRAPH_DIR' not found!"
        print_status "Please run this script from the loomchain root directory."
        exit 1
    fi
}

# Function to check for deploy key
check_deploy_key() {
    # Check for key in this order: env var, .env file, saved file, prompt user
    if [ -n "$GRAPH_DEPLOY_KEY" ]; then
        print_status "Using deploy key from GRAPH_DEPLOY_KEY environment variable"
    elif [ -f ".env" ] && grep -q "GRAPH_API_KEY" .env; then
        export GRAPH_DEPLOY_KEY=$(grep "GRAPH_API_KEY" .env | cut -d'=' -f2)
        print_status "Using deploy key from .env file (GRAPH_API_KEY)"
    elif [ -f "$DEPLOY_KEY_FILE" ]; then
        export GRAPH_DEPLOY_KEY=$(cat "$DEPLOY_KEY_FILE")
        print_status "Using deploy key from $DEPLOY_KEY_FILE"
    else
        print_warning "No deploy key found."
        print_status "Please run 'graph auth' first or set GRAPH_DEPLOY_KEY/GRAPH_API_KEY environment variable."
        read -p "Enter your Graph Studio deploy key: " deploy_key
        echo "$deploy_key" > "$DEPLOY_KEY_FILE"
        export GRAPH_DEPLOY_KEY="$deploy_key"
        print_success "Deploy key saved to $DEPLOY_KEY_FILE"
    fi
}

# Function to get version number
get_version() {
    if [ -n "$1" ]; then
        VERSION="$1"
    else
        # Auto-increment version based on existing deployments
        CURRENT_VERSION=$(curl -s "https://api.studio.thegraph.com/query/120278/bloom-subgraph/version" 2>/dev/null || echo "0.0.0")
        if [[ $CURRENT_VERSION =~ ([0-9]+)\.([0-9]+)\.([0-9]+) ]]; then
            MAJOR=${BASH_REMATCH[1]}
            MINOR=${BASH_REMATCH[2]}
            PATCH=${BASH_REMATCH[3]}
            VERSION="$MAJOR.$MINOR.$((PATCH + 1))"
        else
            VERSION="0.0.1"
        fi
        
        print_status "Auto-generated version: $VERSION"
        read -p "Press Enter to use this version or type a new one: " user_version
        if [ -n "$user_version" ]; then
            VERSION="$user_version"
        fi
    fi
    
    print_status "Using version: $VERSION"
}

# Function to run codegen
run_codegen() {
    print_status "Generating types from schema and ABIs..."
    cd "$SUBGRAPH_DIR"
    
    if yarn codegen; then
        print_success "Code generation completed successfully"
    else
        print_error "Code generation failed"
        exit 1
    fi
    
    cd ..
}

# Function to build subgraph
build_subgraph() {
    print_status "Building subgraph..."
    cd "$SUBGRAPH_DIR"
    
    if yarn build; then
        print_success "Build completed successfully"
    else
        print_error "Build failed"
        exit 1
    fi
    
    cd ..
}

# Function to deploy subgraph
deploy_subgraph() {
    print_status "Deploying subgraph to The Graph Studio..."
    cd "$SUBGRAPH_DIR"
    
    # Set the deploy key for this session
    if [ -n "$GRAPH_DEPLOY_KEY" ]; then
        echo "$GRAPH_DEPLOY_KEY" | graph auth --studio 2>/dev/null || true
    fi
    
    if graph deploy --node https://api.studio.thegraph.com/deploy/ "$SUBGRAPH_NAME" --version-label "$VERSION"; then
        print_success "Deployment completed successfully!"
        print_success "Subgraph endpoint: https://api.studio.thegraph.com/query/120278/bloom-subgraph/$VERSION"
        print_success "Studio URL: https://thegraph.com/studio/subgraph/bloom-subgraph"
    else
        print_error "Deployment failed"
        exit 1
    fi
    
    cd ..
}

# Function to test deployment
test_deployment() {
    print_status "Testing deployment with sample query..."
    
    ENDPOINT="https://api.studio.thegraph.com/query/120278/bloom-subgraph/$VERSION"
    
    # Simple test query
    QUERY='{"query":"{ treeCreateds(first: 1) { id treeId creator } }"}'
    
    if response=$(curl -s -X POST -H "Content-Type: application/json" -d "$QUERY" "$ENDPOINT"); then
        if echo "$response" | grep -q '"data"'; then
            print_success "Deployment test passed - subgraph is responding"
            echo "Sample response: $response"
        else
            print_warning "Deployment test inconclusive - got response but no data"
            echo "Response: $response"
        fi
    else
        print_warning "Could not test deployment - endpoint may not be ready yet"
    fi
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS] [VERSION]"
    echo ""
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  -q, --quick    Skip confirmations"
    echo "  -t, --test     Run test query after deployment"
    echo ""
    echo "Examples:"
    echo "  $0                 # Interactive deployment with auto-version"
    echo "  $0 0.1.0           # Deploy specific version"
    echo "  $0 --quick 0.1.1   # Quick deployment with specific version"
    echo "  $0 --test          # Deploy and test"
}

# Main function
main() {
    local quick_mode=false
    local test_mode=false
    local version=""
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_usage
                exit 0
                ;;
            -q|--quick)
                quick_mode=true
                shift
                ;;
            -t|--test)
                test_mode=true
                shift
                ;;
            -*)
                print_error "Unknown option $1"
                show_usage
                exit 1
                ;;
            *)
                if [ -z "$version" ]; then
                    version="$1"
                else
                    print_error "Too many arguments"
                    show_usage
                    exit 1
                fi
                shift
                ;;
        esac
    done
    
    print_status "Starting Bloom Subgraph deployment process..."
    
    # Run all checks and steps
    check_directory
    check_deploy_key
    get_version "$version"
    
    if [ "$quick_mode" = false ]; then
        print_warning "This will deploy version $VERSION to The Graph Studio."
        read -p "Continue? (y/N): " confirm
        if [[ ! $confirm =~ ^[Yy]$ ]]; then
            print_status "Deployment cancelled"
            exit 0
        fi
    fi
    
    run_codegen
    build_subgraph
    deploy_subgraph
    
    if [ "$test_mode" = true ]; then
        sleep 10  # Wait for deployment to propagate
        test_deployment
    fi
    
    print_success "All done! 🚀"
}

# Run main function with all arguments
main "$@"