# LoomChain Subgraph

This subgraph indexes LoomChain's tree and node creation events, providing fast GraphQL queries for the frontend instead of slow RPC calls.

## 🚀 Quick Start

### 1. Setup
```bash
cd graph-subgraph
./setup.sh
```

### 2. Configure Networks
Edit `networks.json` with your contract addresses and start blocks:

```json
{
  "sepolia": {
    "LoomFactory": {
      "address": "0x0a275e9170D873374f7532e77Af34448D77C3a44",
      "startBlock": 1234567
    }
  }
}
```

### 3. Deploy to Graph Studio
```bash
# Authenticate with your API key
graph auth --studio YOUR_API_KEY

# Deploy to Sepolia
./deploy.sh sepolia loomchain-subgraph
```

### 4. Deploy Locally (Optional)
```bash
# Start local Graph node first
# See: https://github.com/graphprotocol/graph-node

./deploy.sh localhost
```

## 📊 What Gets Indexed

### Core Entities
- **Factory**: Main factory contract stats and tree creation
- **Tree**: Individual tree contracts with metadata and node relationships
- **Node**: All nodes within trees with content, hierarchy, and NFT status
- **NodeUpdate**: History of node content changes with full audit trail

### NFT & Token Entities  
- **NFTFactory**: Factory for creating NFT contracts per tree
- **NFTContract**: Individual NFT contracts linked to trees
- **NodeNFT**: ERC721 tokens representing specific nodes with metadata
- **NodeToken**: ERC20 tokens created for each NFT with mint/burn tracking
- **TokenBoundAccount**: ERC6551 accounts owned by NFTs for holding tokens
- **TokenMintEvent**: All token minting activities with reasons
- **TokenBurnEvent**: All token burning activities with reasons

### Analytics Entities
- **UserStat**: Per-user statistics (trees, nodes, NFTs owned, tokens created)
- **DailyTreeStat**: Daily aggregated statistics across all activities

### Events Indexed
- **Factory Events**: `TreeCreated`
- **Tree Events**: `NodeCreated`, `NodeUpdated` 
- **NFT Factory Events**: `NFTContractCreated`
- **NFT Contract Events**: `NodeNFTMinted`, `TokenBoundAccountCreated`, `NodeTokenCreated`, `Transfer`
- **Token Events**: `TokensMinted`, `TokensBurned`, `Transfer`

## 🔍 GraphQL Queries

### Get All Trees
```graphql
query GetAllTrees {
  trees(first: 10, orderBy: createdAt, orderDirection: desc) {
    id
    address
    creator
    rootContent
    nodeCount
    createdAt
  }
}
```

### Get Tree with Nodes
```graphql
query GetTreeWithNodes($treeId: ID!) {
  tree(id: $treeId) {
    id
    address
    nodes(first: 100) {
      id
      nodeId
      content
      author
      isRoot
      hasNFT
      children {
        id
        content
      }
    }
  }
}
```

More examples in `queries/examples.graphql`.

## 🔧 Frontend Integration

### Using GraphQL Client
```javascript
import { graphAPI } from '../utils/graphClient';

// Get tree data instantly from The Graph
const tree = await graphAPI.getTreeWithNodes(treeAddress);

// Get user's trees
const userTrees = await graphAPI.getUserTrees(userAddress);

// Search trees
const results = await graphAPI.searchTrees("AI agent");
```

### Drop-in Replacement Hook
Replace `useBlockchain` with `useGraphBlockchain` for automatic Graph integration:

```javascript
// Before: Slow RPC calls
import { useBlockchain } from './hooks/useBlockchain';

// After: Fast Graph queries
import { useGraphBlockchain as useBlockchain } from './hooks/useGraphBlockchain';
```

## 🌐 Network Configuration

### Supported Networks
- **Sepolia**: `sepolia`
- **Local**: `localhost` 
- **Mainnet**: `mainnet` (configure address first)

### Graph Endpoints
Update `frontend/src/utils/graphClient.js` with your deployed subgraph URLs:

```javascript
const GRAPH_URLS = {
  sepolia: 'https://api.studio.thegraph.com/query/your-subgraph-id/loomchain-subgraph/version/latest',
  localhost: 'http://localhost:8000/subgraphs/name/loomchain/loomchain-subgraph'
};
```

## 📈 Performance Benefits

| Operation | RPC Calls | Graph Query | Improvement |
|-----------|-----------|-------------|-------------|
| Get 45 nodes | 45+ calls | 1 query | ~45x faster |
| Get user trees | N*M calls | 1 query | ~100x faster |
| Search content | Not possible | Instant | ∞x faster |

## 🔄 Development Workflow

### Local Development
1. Run local Graph node
2. Deploy subgraph: `./deploy.sh localhost`
3. Frontend connects to `http://localhost:8000`

### Production Deployment
1. Deploy to Graph Studio: `./deploy.sh sepolia`
2. Update frontend Graph URL
3. Enjoy fast queries!

## 🛠️ Troubleshooting

### Common Issues

**Build fails**
```bash
# Regenerate types
npm run codegen
npm run build
```

**Deployment fails**
```bash
# Check network configuration
cat networks.json

# Verify API key
graph auth --studio YOUR_API_KEY
```

**No data appearing**
- Check start block in `networks.json`
- Verify contract address
- Wait for indexing to catch up

### Useful Commands
```bash
# Check subgraph status
graph status loomchain-subgraph

# View logs
graph logs loomchain-subgraph

# Redeploy
./deploy.sh sepolia --force
```

## 📚 Additional Resources

- [The Graph Documentation](https://thegraph.com/docs/)
- [GraphQL Query Language](https://graphql.org/learn/)
- [AssemblyScript for Subgraphs](https://thegraph.com/docs/assemblyscript-api)

## 🤝 Contributing

1. Update schema in `schema.graphql`
2. Modify mappings in `src/`
3. Add example queries to `queries/`
4. Test with local deployment
5. Update documentation