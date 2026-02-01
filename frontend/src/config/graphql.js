import { ApolloClient, InMemoryCache, createHttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';

// Static configuration using environment variables
const GRAPH_VERSION = process.env.REACT_APP_GRAPH_VERSION || 'version/latest';
const GRAPH_USER_ID = process.env.REACT_APP_GRAPH_USER_ID;
const GRAPH_ENDPOINT = `https://api.studio.thegraph.com/query/${GRAPH_USER_ID}/bloom-subgraph/${GRAPH_VERSION}`;

console.log('📊 Using Graph subgraph version:', GRAPH_VERSION);
console.log('🔗 Graph endpoint:', GRAPH_ENDPOINT);

// Create the HTTP link to The Graph
const httpLink = createHttpLink({
  uri: GRAPH_ENDPOINT,
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

// Apollo Client configuration
export const graphClient = new ApolloClient({
  link: from([
    errorLink,
    authLink,
    httpLink
  ]),
  cache: new InMemoryCache({
    // Force cache clear for schema changes
    addTypename: false,
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
    tokenId
    tokenBoundAccount
    nodeTokenContract
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

export const NFT_CONTENT_UPDATE_FRAGMENT = `
  fragment NFTContentUpdateDetails on NodeNFTContentUpdated {
    id
    tokenId
    nodeId
    content
    blockNumber
    blockTimestamp
    transactionHash
  }
`;

// Helper function to update The Graph endpoint version (for reference)
export const updateGraphEndpoint = (version) => {
  const newEndpoint = `https://api.studio.thegraph.com/query/${GRAPH_USER_ID}/bloom-subgraph/${version}`;
  console.log('🔄 Updating Graph endpoint to:', newEndpoint);
  return newEndpoint;
};