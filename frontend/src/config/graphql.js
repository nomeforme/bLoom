import { ApolloClient, InMemoryCache, createHttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';

// Default configuration - will be updated when chain config is loaded
let GRAPH_VERSION = 'v0.0.1'; // Default fallback
let GRAPH_ENDPOINT = `https://api.studio.thegraph.com/query/120278/bloom-subgraph/${GRAPH_VERSION}`;

console.log('📊 Initial Graph subgraph version:', GRAPH_VERSION);
console.log('🔗 Initial Graph endpoint:', GRAPH_ENDPOINT);

// Function to get current GraphQL endpoint (dynamic)
export const getGraphEndpoint = () => GRAPH_ENDPOINT;
export const getGraphVersion = () => GRAPH_VERSION;

// Function to update the GraphQL endpoint based on chain configuration
export const updateGraphEndpointFromChainConfig = (chainConfig) => {
  if (chainConfig?.subgraphVersion) {
    GRAPH_VERSION = chainConfig.subgraphVersion;
    GRAPH_ENDPOINT = `https://api.studio.thegraph.com/query/120278/bloom-subgraph/${GRAPH_VERSION}`;
    console.log('📊 Updated Graph subgraph version to:', GRAPH_VERSION);
    console.log('🔗 Updated Graph endpoint to:', GRAPH_ENDPOINT);
    
    // Update the Apollo Client with the new endpoint
    updateGraphClient(GRAPH_ENDPOINT);
    
    return GRAPH_ENDPOINT;
  }
  return GRAPH_ENDPOINT;
};

// Function to create Apollo Client with specific endpoint
const createApolloClient = (endpoint) => {
  const httpLink = createHttpLink({
    uri: endpoint,
  });

  // Error handling link
  const errorLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
    if (graphQLErrors) {
      graphQLErrors.forEach(({ message, locations, path }) =>
        console.error(
          `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`,
        ),
      );
    }

    if (networkError) {
      console.error(`[Network error]: ${networkError}`);
    }
  });

  // Context link for adding headers if needed
  const authLink = setContext((_, { headers }) => {
    return {
      headers: {
        ...headers,
        'Content-Type': 'application/json',
      }
    }
  });

  return new ApolloClient({
    link: from([
      errorLink,
      authLink,
      httpLink
    ]),
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            // Define cache policies for better performance
            treeCreateds: {
              merge(existing = [], incoming) {
                return [...incoming];
              }
            },
            nodeCreateds: {
              merge(existing = [], incoming) {
                return [...incoming];
              }
            },
            nodeNFTMinteds: {
              merge(existing = [], incoming) {
                return [...incoming];
              }
            },
            tokenTransfers: {
              merge(existing = [], incoming) {
                return [...incoming];
              }
            }
          }
        }
      }
    }),
    defaultOptions: {
      watchQuery: {
        errorPolicy: 'ignore',
      },
      query: {
        errorPolicy: 'all',
      },
    },
  });
};

// Initial Apollo Client
export let graphClient = createApolloClient(GRAPH_ENDPOINT);

// Function to update Apollo Client with new endpoint
export const updateGraphClient = (endpoint) => {
  console.log('🔄 Creating new Apollo Client with endpoint:', endpoint);
  graphClient = createApolloClient(endpoint);
  return graphClient;
};

// GraphQL query fragments for reuse
export const TREE_FRAGMENT = `
  fragment TreeDetails on TreeCreated {
    id
    treeId
    treeAddress
    nftContractAddress
    creator
    rootContent
    blockNumber
    blockTimestamp
    transactionHash
  }
`;

export const NODE_FRAGMENT = `
  fragment NodeDetails on NodeCreated {
    id
    nodeId
    parentId
    author
    timestamp
    treeAddress
    hasNFT
    blockNumber
    blockTimestamp
    transactionHash
  }
`;

export const NFT_FRAGMENT = `
  fragment NFTDetails on NodeNFTMinted {
    id
    tokenId
    nodeId
    owner
    content
    tokenBoundAccount
    nodeTokenContract
    blockNumber
    blockTimestamp
    transactionHash
  }
`;

export const TOKEN_TRANSFER_FRAGMENT = `
  fragment TokenTransferDetails on TokenTransfer {
    id
    from
    to
    value
    blockNumber
    blockTimestamp
    transactionHash
  }
`;

// Helper function to update The Graph endpoint version
export const updateGraphEndpoint = (version) => {
  const newEndpoint = `https://api.studio.thegraph.com/query/120278/bloom-subgraph/${version}`;
  console.log('🔄 Updating Graph endpoint to:', newEndpoint);
  // Note: In a production app, you'd want to recreate the client
  // For now, this is informational
  return newEndpoint;
};