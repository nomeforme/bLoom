import { GraphQLClient } from 'graphql-request';

// Configuration for different networks
const GRAPH_URLS = {
  'scroll-sepolia': 'https://api.studio.thegraph.com/query/your-subgraph-id/loomchain-subgraph/version/latest',
  sepolia: 'https://api.studio.thegraph.com/query/your-subgraph-id/loomchain-sepolia/version/latest',
  localhost: 'http://localhost:8000/subgraphs/name/loomchain/loomchain-subgraph',
  scroll: 'https://api.studio.thegraph.com/query/your-subgraph-id/loomchain-scroll/version/latest'
};

// Get the active network from chain config
const getActiveNetwork = async () => {
  try {
    // You can import getActiveChainConfig if needed
    // For now, default to sepolia or read from environment
    return process.env.REACT_APP_GRAPH_NETWORK || 'scroll-sepolia';
  } catch (error) {
    console.warn('Could not determine active network, using scroll-sepolia');
    return 'scroll-sepolia';
  }
};

// Create GraphQL client instance
let graphQLClient = null;

const getGraphQLClient = async () => {
  if (!graphQLClient) {
    const network = await getActiveNetwork();
    const graphUrl = GRAPH_URLS[network];
    
    if (!graphUrl) {
      throw new Error(`No Graph URL configured for network: ${network}`);
    }
    
    console.log('🔗 Connecting to Graph endpoint:', graphUrl);
    graphQLClient = new GraphQLClient(graphUrl, {
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
  
  return graphQLClient;
};

// Reset client (useful when switching networks)
export const resetGraphClient = () => {
  graphQLClient = null;
};

// GraphQL queries
export const GET_ALL_TREES = `
  query GetAllTrees($first: Int!, $skip: Int!, $orderBy: Tree_orderBy!, $orderDirection: OrderDirection!) {
    trees(first: $first, skip: $skip, orderBy: $orderBy, orderDirection: $orderDirection) {
      id
      address
      creator
      rootContent
      nodeCount
      nftContract
      createdAt
      createdAtBlock
    }
  }
`;

export const GET_TREE_WITH_NODES = `
  query GetTreeWithNodes($treeId: ID!) {
    tree(id: $treeId) {
      id
      address
      creator
      rootContent
      rootId
      nodeCount
      nftContract
      createdAt
      nodes(first: 1000, orderBy: createdAt) {
        id
        nodeId
        content
        author
        isRoot
        hasNFT
        modelId
        timestamp
        parentId
        createdAt
      }
    }
  }
`;

export const GET_USER_TREES = `
  query GetUserTrees($creator: Bytes!, $first: Int!) {
    trees(where: { creator: $creator }, first: $first, orderBy: createdAt, orderDirection: desc) {
      id
      address
      rootContent
      nodeCount
      createdAt
      nodes(first: 10, orderBy: createdAt) {
        id
        nodeId
        content
        isRoot
        hasNFT
      }
    }
  }
`;

export const GET_RECENT_NODES = `
  query GetRecentNodes($first: Int!) {
    nodes(first: $first, orderBy: createdAt, orderDirection: desc) {
      id
      nodeId
      content
      author
      timestamp
      isRoot
      hasNFT
      modelId
      tree {
        id
        address
        rootContent
      }
    }
  }
`;

export const GET_USER_STATS = `
  query GetUserStats($userAddress: ID!) {
    userStat(id: $userAddress) {
      id
      address
      treesCreated
      nodesCreated
      nodesUpdated
      nftsOwned
      tokensCreated
      firstTreeCreated
      lastActivity
    }
  }
`;

export const GET_NODE_NFTS = `
  query GetNodeNFTs($first: Int!, $skip: Int!) {
    nodeNFTs(first: $first, skip: $skip, orderBy: createdAt, orderDirection: desc) {
      id
      tokenId
      nodeId
      owner
      content
      textContent
      tokenBoundAccount
      nftContract {
        id
        address
        tree {
          id
          address
          rootContent
        }
      }
      nodeToken {
        id
        address
        name
        symbol
        totalSupply
        initialSupply
      }
      createdAt
    }
  }
`;

export const GET_NFT_BY_NODE = `
  query GetNFTByNode($nodeId: Bytes!) {
    nodeNFTs(where: { nodeId: $nodeId }) {
      id
      tokenId
      nodeId
      owner
      content
      textContent
      tokenBoundAccount
      nftContract {
        id
        address
      }
      nodeToken {
        id
        address
        name
        symbol
        totalSupply
        mintEvents(first: 10, orderBy: timestamp, orderDirection: desc) {
          id
          amount
          reason
          timestamp
        }
        burnEvents(first: 10, orderBy: timestamp, orderDirection: desc) {
          id
          amount
          reason
          timestamp
        }
      }
      createdAt
      updatedAt
    }
  }
`;

export const GET_TOKEN_ACTIVITIES = `
  query GetTokenActivities($tokenAddress: ID!, $first: Int!) {
    nodeToken(id: $tokenAddress) {
      id
      name
      symbol
      totalSupply
      mintEvents(first: $first, orderBy: timestamp, orderDirection: desc) {
        id
        to
        amount
        reason
        timestamp
        transactionHash
      }
      burnEvents(first: $first, orderBy: timestamp, orderDirection: desc) {
        id
        from
        amount
        reason
        timestamp
        transactionHash
      }
    }
  }
`;

export const GET_USER_NFTS = `
  query GetUserNFTs($owner: Bytes!, $first: Int!) {
    nodeNFTs(where: { owner: $owner }, first: $first, orderBy: createdAt, orderDirection: desc) {
      id
      tokenId
      nodeId
      content
      textContent
      tokenBoundAccount
      nftContract {
        id
        address
        tree {
          id
          address
          rootContent
        }
      }
      nodeToken {
        id
        name
        symbol
        totalSupply
      }
      createdAt
    }
  }
`;

export const GET_NFT_CONTRACTS = `
  query GetNFTContracts($first: Int!) {
    nftContracts(first: $first, orderBy: createdAt, orderDirection: desc) {
      id
      address
      creator
      totalSupply
      tree {
        id
        address
        rootContent
        nodeCount
      }
      nodeNFTs(first: 5, orderBy: createdAt, orderDirection: desc) {
        id
        tokenId
        owner
        content
      }
      createdAt
    }
  }
`;

export const GET_DAILY_STATS = `
  query GetDailyStats($startDate: String!, $endDate: String!) {
    dailyTreeStats(
      where: { date_gte: $startDate, date_lte: $endDate }
      orderBy: date
      orderDirection: asc
    ) {
      id
      date
      treesCreated
      nodesCreated
      nodesUpdated
      totalGasUsed
    }
  }
`;

export const SEARCH_TREES = `
  query SearchTrees($searchTerm: String!, $first: Int!) {
    trees(
      where: { rootContent_contains: $searchTerm }
      first: $first
      orderBy: createdAt
      orderDirection: desc
    ) {
      id
      address
      rootContent
      creator
      nodeCount
      createdAt
    }
  }
`;

// API functions
export const graphAPI = {
  // Get all trees with pagination
  async getAllTrees(first = 10, skip = 0, orderBy = 'createdAt', orderDirection = 'desc') {
    try {
      const client = await getGraphQLClient();
      const data = await client.request(GET_ALL_TREES, {
        first,
        skip,
        orderBy,
        orderDirection
      });
      return data.trees;
    } catch (error) {
      console.error('Error fetching trees from Graph:', error);
      throw error;
    }
  },

  // Get a specific tree with all its nodes
  async getTreeWithNodes(treeAddress) {
    try {
      const client = await getGraphQLClient();
      const data = await client.request(GET_TREE_WITH_NODES, {
        treeId: treeAddress.toLowerCase()
      });
      return data.tree;
    } catch (error) {
      console.error('Error fetching tree from Graph:', error);
      throw error;
    }
  },

  // Get trees created by a specific user
  async getUserTrees(creatorAddress, first = 10) {
    try {
      const client = await getGraphQLClient();
      const data = await client.request(GET_USER_TREES, {
        creator: creatorAddress.toLowerCase(),
        first
      });
      return data.trees;
    } catch (error) {
      console.error('Error fetching user trees from Graph:', error);
      throw error;
    }
  },

  // Get recent nodes across all trees
  async getRecentNodes(first = 20) {
    try {
      const client = await getGraphQLClient();
      const data = await client.request(GET_RECENT_NODES, {
        first
      });
      return data.nodes;
    } catch (error) {
      console.error('Error fetching recent nodes from Graph:', error);
      throw error;
    }
  },

  // Get user statistics
  async getUserStats(userAddress) {
    try {
      const client = await getGraphQLClient();
      const data = await client.request(GET_USER_STATS, {
        userAddress: userAddress.toLowerCase()
      });
      return data.userStat;
    } catch (error) {
      console.error('Error fetching user stats from Graph:', error);
      throw error;
    }
  },

  // Get daily statistics for a date range
  async getDailyStats(startDate, endDate) {
    try {
      const client = await getGraphQLClient();
      const data = await client.request(GET_DAILY_STATS, {
        startDate,
        endDate
      });
      return data.dailyTreeStats;
    } catch (error) {
      console.error('Error fetching daily stats from Graph:', error);
      throw error;
    }
  },

  // Search trees by content
  async searchTrees(searchTerm, first = 10) {
    try {
      const client = await getGraphQLClient();
      const data = await client.request(SEARCH_TREES, {
        searchTerm,
        first
      });
      return data.trees;
    } catch (error) {
      console.error('Error searching trees from Graph:', error);
      throw error;
    }
  },

  // Get Node NFTs with pagination
  async getNodeNFTs(first = 20, skip = 0) {
    try {
      const client = await getGraphQLClient();
      const data = await client.request(GET_NODE_NFTS, {
        first,
        skip
      });
      return data.nodeNFTs;
    } catch (error) {
      console.error('Error fetching NFTs from Graph:', error);
      throw error;
    }
  },

  // Get NFT data for a specific node
  async getNFTByNode(nodeId) {
    try {
      const client = await getGraphQLClient();
      const data = await client.request(GET_NFT_BY_NODE, {
        nodeId
      });
      return data.nodeNFTs.length > 0 ? data.nodeNFTs[0] : null;
    } catch (error) {
      console.error('Error fetching NFT by node from Graph:', error);
      throw error;
    }
  },

  // Get token mint/burn activities
  async getTokenActivities(tokenAddress, first = 50) {
    try {
      const client = await getGraphQLClient();
      const data = await client.request(GET_TOKEN_ACTIVITIES, {
        tokenAddress: tokenAddress.toLowerCase(),
        first
      });
      return data.nodeToken;
    } catch (error) {
      console.error('Error fetching token activities from Graph:', error);
      throw error;
    }
  },

  // Get NFTs owned by a specific user
  async getUserNFTs(ownerAddress, first = 20) {
    try {
      const client = await getGraphQLClient();
      const data = await client.request(GET_USER_NFTS, {
        owner: ownerAddress.toLowerCase(),
        first
      });
      return data.nodeNFTs;
    } catch (error) {
      console.error('Error fetching user NFTs from Graph:', error);
      throw error;
    }
  },

  // Get all NFT contracts
  async getNFTContracts(first = 20) {
    try {
      const client = await getGraphQLClient();
      const data = await client.request(GET_NFT_CONTRACTS, {
        first
      });
      return data.nftContracts;
    } catch (error) {
      console.error('Error fetching NFT contracts from Graph:', error);
      throw error;
    }
  }
};

export default graphAPI;