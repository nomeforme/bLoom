import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useLazyQuery } from '@apollo/client/react';
import { gql } from '@apollo/client';
import { isIPFSReference } from '../utils/ipfsUtils';

// GraphQL Queries
const GET_ALL_TREES = gql`
  query GetAllTrees($first: Int = 100, $orderBy: TreeCreated_orderBy = "blockTimestamp", $orderDirection: OrderDirection = "desc") {
    treeCreateds(first: $first, orderBy: $orderBy, orderDirection: $orderDirection) {
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
  }
`;

const GET_USER_TREES = gql`
  query GetUserTrees($creator: Bytes!, $first: Int = 100, $orderBy: TreeCreated_orderBy = "blockTimestamp", $orderDirection: OrderDirection = "desc") {
    treeCreateds(where: { creator: $creator }, first: $first, orderBy: $orderBy, orderDirection: $orderDirection) {
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
  }
`;

const GET_TREE_NODES = gql`
  query GetTreeNodes($treeAddress: Bytes!, $first: Int = 1000) {
    # Get nodes for specific tree using treeAddress filter
    nodeCreateds(where: { treeAddress: $treeAddress }, first: $first, orderBy: "timestamp") {
      id
      nodeId
      parentId
      author
      timestamp
      treeAddress
      hasNFT
      modelId
      content
      tokenId
      tokenBoundAccount
      nodeTokenContract
      blockNumber
      blockTimestamp
      transactionHash
    }
    
    # Get node updates for specific tree
    nodeUpdateds(where: { treeAddress: $treeAddress }, first: $first, orderBy: "blockTimestamp") {
      id
      nodeId
      author
      treeAddress
      modelId
      content
      blockNumber
      blockTimestamp
      transactionHash
    }
    
    # Get all NFTs minted for nodes (unfiltered since NFTs don't have treeAddress field)
    nodeNFTMinteds(first: $first, orderBy: "blockTimestamp") {
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
    
    # Get metadata for nodes filtered by tree
    metadataSets(where: { treeAddress: $treeAddress }, first: $first, orderBy: "blockTimestamp") {
      id
      nodeId
      key
      value
      treeAddress
      blockNumber
      blockTimestamp
      transactionHash
    }
  }
`;

const GET_NODE_NFT_INFO = gql`
  query GetNodeNFTInfo($nodeId: Bytes!) {
    nodeNFTMinteds(where: { nodeId: $nodeId }) {
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
    nodeUpdateds(where: { nodeId: $nodeId }, orderBy: blockTimestamp, orderDirection: desc, first: 1) {
      id
      nodeId
      content
      blockNumber
      blockTimestamp
      transactionHash
    }
  }
`;

const GET_TOKEN_BALANCE = gql`
  query GetTokenBalance($tokenBoundAccount: Bytes!) {
    # Get all transfers to calculate balance
    tokenTransfers(
      where: { 
        or: [
          { from: $tokenBoundAccount },
          { to: $tokenBoundAccount }
        ]
      }
      orderBy: "blockTimestamp"
      orderDirection: "desc"
    ) {
      id
      from
      to
      value
      blockNumber
      blockTimestamp
      transactionHash
    }
    
    # Get minting events
    tokensMinteds(where: { to: $tokenBoundAccount }) {
      id
      to
      amount
      reason
      blockNumber
      blockTimestamp
      transactionHash
    }
    
    # Get burning events  
    tokensBurneds(where: { from: $tokenBoundAccount }) {
      id
      from
      amount
      reason
      blockNumber
      blockTimestamp
      transactionHash
    }
  }
`;

const GET_NODE_TOKEN_INFO = gql`
  query GetNodeTokenInfo($nodeTokenContract: Bytes!, $tokenBoundAccount: Bytes!) {
    # Get token creation info
    nodeTokenCreateds(where: { nodeTokenContract: $nodeTokenContract }) {
      id
      tokenId
      nodeTokenContract
      tokenBoundAccount
      blockNumber
      blockTimestamp
      transactionHash
    }
    
    # Get TBA creation info
    tokenBoundAccountCreateds(where: { tokenBoundAccount: $tokenBoundAccount }) {
      id
      tokenId
      tokenBoundAccount
      blockNumber
      blockTimestamp
      transactionHash
    }
  }
`;

const GET_RECENT_ACTIVITIES = gql`
  query GetRecentActivities($first: Int = 50) {
    # Recent tree creations
    treeCreateds(first: $first, orderBy: "blockTimestamp", orderDirection: "desc") {
      id
      treeId
      treeAddress
      creator
      rootContent
      blockTimestamp
      transactionHash
    }
    
    # Recent node creations
    nodeCreateds(first: $first, orderBy: "blockTimestamp", orderDirection: "desc") {
      id
      nodeId
      parentId
      author
      timestamp
      blockTimestamp
      transactionHash
    }
    
    # Recent NFT mints
    nodeNFTMinteds(first: $first, orderBy: "blockTimestamp", orderDirection: "desc") {
      id
      tokenId
      nodeId
      owner
      content
      blockTimestamp
      transactionHash
    }
  }
`;

// Helper function to calculate token balance from transfers
const calculateTokenBalance = (transfers, mints, burns, userAddress) => {
  let balance = 0;
  
  // Add minted tokens
  mints.forEach(mint => {
    if (mint.to.toLowerCase() === userAddress.toLowerCase()) {
      balance += parseInt(mint.amount);
    }
  });
  
  // Subtract burned tokens
  burns.forEach(burn => {
    if (burn.from.toLowerCase() === userAddress.toLowerCase()) {
      balance -= parseInt(burn.amount);
    }
  });
  
  // Process transfers
  transfers.forEach(transfer => {
    if (transfer.from.toLowerCase() === userAddress.toLowerCase()) {
      balance -= parseInt(transfer.value);
    }
    if (transfer.to.toLowerCase() === userAddress.toLowerCase()) {
      balance += parseInt(transfer.value);
    }
  });
  
  return balance;
};

// Helper function to build tree structure from Graph data
const buildTreeFromGraphData = (treeData, nodeCreations, nodeUpdates, nftMinteds, metadataSets) => {
  console.log('🔄 Building tree from Graph data:', {
    treeAddress: treeData.treeAddress,
    nodeCount: nodeCreations.length,
    nodeUpdateCount: nodeUpdates.length,
    nftCount: nftMinteds.length,
    metadataCount: metadataSets.length
  });

  // Now that we have proper tree filtering in the subgraph, we can use the data directly
  // The nodeCreations and metadataSets are already filtered by treeAddress
  
  console.log('✅ Using filtered data from enhanced subgraph schema');
  
  // Filter NFTs by nodeId to match our nodes (since NFTs don't have treeAddress field yet)
  const nodeIds = new Set(nodeCreations.map(node => node.nodeId));
  const filteredNfts = nftMinteds.filter(nft => nodeIds.has(nft.nodeId));
  
  console.log('🔄 Final filtered data for tree:', {
    treeAddress: treeData.treeAddress,
    nodeCount: nodeCreations.length,
    nodeUpdateCount: nodeUpdates.length,
    filteredNftCount: filteredNfts.length,
    metadataCount: metadataSets.length
  });

  // Create a map of the latest updates by nodeId for quick lookup
  const nodeUpdateMap = new Map();
  nodeUpdates.forEach(update => {
    const existing = nodeUpdateMap.get(update.nodeId);
    // Keep the latest update (highest blockTimestamp)
    if (!existing || parseInt(update.blockTimestamp) > parseInt(existing.blockTimestamp)) {
      nodeUpdateMap.set(update.nodeId, update);
    }
  });

  // Create a map of NFT data by nodeId for quick lookup
  const nftMap = new Map();
  filteredNfts.forEach(nft => {
    nftMap.set(nft.nodeId, nft);
  });

  console.log('🔍 NFT mapping for tree:', {
    treeAddress: treeData.treeAddress,
    totalNfts: filteredNfts.length,
    nftNodeIds: Array.from(nftMap.keys()).map(id => id.substring(0, 10) + '...'),
    nodeIds: nodeCreations.map(n => n.nodeId.substring(0, 10) + '...')
  });

  // Create a map of metadata by nodeId
  const metadataMap = new Map();
  metadataSets.forEach(meta => {
    if (!metadataMap.has(meta.nodeId)) {
      metadataMap.set(meta.nodeId, {});
    }
    metadataMap.get(meta.nodeId)[meta.key] = meta.value;
  });

  // Build node objects
  const nodes = nodeCreations.map(nodeCreation => {
    const nftData = nftMap.get(nodeCreation.nodeId);
    const metadata = metadataMap.get(nodeCreation.nodeId) || {};
    const nodeUpdate = nodeUpdateMap.get(nodeCreation.nodeId);
    
    // Determine content source and type
    let content = '';
    let hasNFT = nodeCreation.hasNFT || false; // Use hasNFT from the event
    let originalContent = '';
    let modelId = nodeCreation.modelId || '';
    
    // If there's an update, use the updated modelId
    if (nodeUpdate && nodeUpdate.modelId) {
      modelId = nodeUpdate.modelId;
    }
    
    // NEW APPROACH: Use NFT data directly from NodeCreated event if available
    let tokenId = null;
    let tokenBoundAccount = null;
    let nodeTokenContract = null;
    
    if (hasNFT) {
      // Use NFT data from the NodeCreated event (available immediately)
      tokenId = nodeCreation.tokenId || null;
      tokenBoundAccount = nodeCreation.tokenBoundAccount || null;
      nodeTokenContract = nodeCreation.nodeTokenContract || null;
      
      // Prioritize updated content over original NFT content
      if (nodeUpdate && nodeUpdate.content) {
        content = nodeUpdate.content;
        originalContent = nftData?.content || '';
        console.log('✅ Using UPDATED content for NFT node:', nodeCreation.nodeId.substring(0, 10) + '...', 'Content:', content.substring(0, 50) + '...');
      } else if (nftData && nftData.content) {
        content = nftData.content;
        originalContent = content;
        console.log('✅ Using original NFT content for node:', nodeCreation.nodeId.substring(0, 10) + '...', 'Content:', content.substring(0, 50) + '...');
      } else {
        content = 'Loading NFT content...';
        originalContent = '';
        console.log('⏳ NFT data available, waiting for content:', nodeCreation.nodeId.substring(0, 10) + '...');
      }
    } else {
      // Lightweight node - prioritize updated content over original content
      if (nodeUpdate && nodeUpdate.content) {
        content = nodeUpdate.content;
        originalContent = content;
        console.log('✅ Using UPDATED contract storage content for lightweight node:', nodeCreation.nodeId.substring(0, 10) + '...', 'Content:', content.substring(0, 50) + '...');
      } else if (nodeCreation.content) {
        content = nodeCreation.content;
        originalContent = content;
        console.log('✅ Using original contract storage content for lightweight node:', nodeCreation.nodeId.substring(0, 10) + '...', 'Content:', content.substring(0, 50) + '...');
      } else {
        content = 'Content in contract storage';
        originalContent = '';
        console.log('📄 Node uses contract storage (content not indexed):', nodeCreation.nodeId.substring(0, 10) + '...');
      }
    }
    
    // Handle IPFS content display
    let displayContent = content;
    if (isIPFSReference(content)) {
      displayContent = "Loading IPFS content...";
      originalContent = content;
    }

    const nodeObject = {
      nodeId: nodeCreation.nodeId,
      parentId: nodeCreation.parentId,
      children: [], // Will be populated below
      author: nodeCreation.author,
      timestamp: parseInt(nodeCreation.timestamp),
      isRoot: nodeCreation.parentId === '0x0000000000000000000000000000000000000000000000000000000000000000',
      modelId: modelId, // Use the resolved modelId (from update if available)
      content: displayContent,
      originalContent: originalContent,
      hasNFT: hasNFT,
      tokenId: tokenId,
      tokenBoundAccount: tokenBoundAccount,
      nodeTokenContract: nodeTokenContract,
      // Add explicit fields for easier access in components
      id: nodeCreation.nodeId // Alias for nodeId for consistency
    };

    console.log('📊 Final node object for', nodeCreation.nodeId.substring(0, 10) + '...:', {
      hasNFT: nodeObject.hasNFT,
      tokenBoundAccount: nodeObject.tokenBoundAccount,
      nodeTokenContract: nodeObject.nodeTokenContract,
      hasEventData: !!(nodeCreation.tokenId || nodeCreation.tokenBoundAccount),
      hasNftContentData: !!nftData
    });

    return nodeObject;
  });

  // Build parent-child relationships
  const nodeMap = new Map();
  nodes.forEach(node => {
    nodeMap.set(node.nodeId, node);
  });

  nodes.forEach(node => {
    if (node.parentId && node.parentId !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
      const parent = nodeMap.get(node.parentId);
      if (parent) {
        parent.children.push(node.nodeId);
      }
    }
  });

  const rootNode = nodes.find(node => node.isRoot);

  return {
    address: treeData.treeAddress,
    treeId: treeData.treeId,
    nftAddress: treeData.nftContractAddress,
    rootId: rootNode?.nodeId || null,
    nodes,
    nodeCount: nodes.length,
    rootContent: rootNode?.content || '',
    creator: treeData.creator,
    blockTimestamp: parseInt(treeData.blockTimestamp)
  };
};

export const useGraph = () => {
  const [trees, setTrees] = useState([]);
  const [currentTree, setCurrentTree] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Cache for NFT data to avoid duplicate requests
  const nftCache = useRef(new Map());
  const pendingNftRequests = useRef(new Map());
  
  // Lazy query functions with error policy
  const [getUserTreesQuery, { loading: userTreesLoading }] = useLazyQuery(GET_USER_TREES, {
    errorPolicy: 'all',
    fetchPolicy: 'cache-first'
  });
  const [getAllTreesQuery, { loading: allTreesLoading }] = useLazyQuery(GET_ALL_TREES, {
    errorPolicy: 'all',
    fetchPolicy: 'cache-first'
  });
  const [getTreeNodesQuery, { loading: treeNodesLoading }] = useLazyQuery(GET_TREE_NODES, {
    errorPolicy: 'all',
    fetchPolicy: 'cache-and-network' // Changed from 'cache-first' to get updates
  });
  const [getNodeNFTInfoQuery] = useLazyQuery(GET_NODE_NFT_INFO, {
    errorPolicy: 'all',
    fetchPolicy: 'cache-first'
  });
  const [getTokenBalanceQuery] = useLazyQuery(GET_TOKEN_BALANCE, {
    errorPolicy: 'all'
  });
  const [getNodeTokenInfoQuery] = useLazyQuery(GET_NODE_TOKEN_INFO, {
    errorPolicy: 'all'
  });
  
  // Recent activities query with polling for real-time updates
  const { data: recentData, loading: recentLoading } = useQuery(GET_RECENT_ACTIVITIES, {
    pollInterval: 15000, // Poll every 15 seconds for more responsive updates
    fetchPolicy: 'cache-and-network'
  });

  // Get user trees using The Graph
  const getUserTrees = useCallback(async (userAddress) => {
    if (!userAddress) return [];
    
    console.log('🔍 Getting user trees from Graph for:', userAddress);
    setLoading(true);
    
    try {
      const { data } = await getUserTreesQuery({
        variables: { creator: userAddress.toLowerCase() }
      });
      
      if (!data?.treeCreateds) return [];
      
      console.log('📊 Found user trees:', data.treeCreateds.length);
      
      // Build tree objects with node data (with error handling)
      const userTrees = await Promise.allSettled(
        data.treeCreateds.map(async (treeData) => {
          try {
            return await getTreeWithNodes(treeData.treeAddress, treeData);
          } catch (error) {
            console.warn(`⚠️ Skipping tree ${treeData.treeAddress} due to error:`, error.message);
            return null;
          }
        })
      );
      
      // Filter out failed trees and extract successful ones
      const successfulTrees = userTrees
        .filter(result => result.status === 'fulfilled' && result.value !== null)
        .map(result => result.value);
      
      setTrees(successfulTrees);
      return successfulTrees;
    } catch (error) {
      console.error('❌ Error fetching user trees from Graph:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, [getUserTreesQuery]);

  // Get all trees using The Graph
  const getAllTrees = useCallback(async () => {
    console.log('🔍 Getting all trees from Graph');
    setLoading(true);
    
    try {
      const { data } = await getAllTreesQuery({
        variables: { first: 100 }
      });
      
      if (!data?.treeCreateds) return [];
      
      console.log('📊 Found all trees:', data.treeCreateds.length);
      
      // Build tree objects with node data sequentially to avoid overwhelming GraphQL client
      const successfulTrees = [];
      
      for (const treeData of data.treeCreateds) {
        try {
          const tree = await getTreeWithNodes(treeData.treeAddress, treeData);
          if (tree) {
            successfulTrees.push(tree);
          }
        } catch (error) {
          // Handle abort errors gracefully - they're common during page refresh
          if (error.name === 'AbortError') {
            console.warn(`🔄 Tree ${treeData.treeAddress} query was aborted (likely due to page refresh)`);
          } else {
            console.warn(`⚠️ Skipping tree ${treeData.treeAddress} due to error:`, error.message);
          }
          // Continue with other trees instead of failing completely
        }
        
        // Small delay between requests to be gentle on GraphQL client
        if (data.treeCreateds.indexOf(treeData) < data.treeCreateds.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      return successfulTrees;
    } catch (error) {
      console.error('❌ Error fetching all trees from Graph:', error);
      return [];
    } finally {
      setLoading(false);
    }
  }, [getAllTreesQuery]);

  // Get tree with nodes using The Graph
  const getTreeWithNodes = useCallback(async (treeAddress, treeData = null) => {
    console.log('🔍 Getting tree nodes from Graph for:', treeAddress);
    
    try {
      const { data, error } = await getTreeNodesQuery({
        variables: { 
          treeAddress: treeAddress.toLowerCase(),
          first: 1000 
        }
      });
      
      if (error) {
        console.warn('⚠️ GraphQL errors for tree nodes:', error);
      }
      
      if (!data) {
        console.warn('⚠️ No data returned from Graph for tree:', treeAddress);
        // Create a minimal tree structure if we have treeData
        if (treeData) {
          return {
            address: treeData.treeAddress,
            treeId: treeData.treeId,
            nftAddress: treeData.nftContractAddress,
            rootId: null,
            nodes: [],
            nodeCount: 0,
            rootContent: treeData.rootContent || '',
            creator: treeData.creator,
            blockTimestamp: parseInt(treeData.blockTimestamp)
          };
        }
        throw new Error('No data returned from Graph and no fallback data available');
      }
      
      // If we don't have tree data, we need to fetch it
      if (!treeData) {
        const { data: treeQueryData } = await getAllTreesQuery({
          variables: { first: 1000 } // Get all to find the specific tree
        });
        
        treeData = treeQueryData?.treeCreateds?.find(
          tree => tree.treeAddress.toLowerCase() === treeAddress.toLowerCase()
        );
        
        if (!treeData) {
          // For newly created trees, the subgraph might not have indexed yet
          // Return a basic tree structure that will be updated when the subgraph catches up
          console.warn('⚠️ Tree not found in Graph data (subgraph may be indexing):', treeAddress);
          return {
            address: treeAddress,
            contract: null,
            nftContract: null,
            nftAddress: null,
            rootId: null,
            nodes: [],
            nodeCount: 0,
            rootContent: 'Loading from subgraph...',
            isPartiallyLoaded: true // Flag to indicate this needs to be refreshed
          };
        }
      }
      
      const tree = buildTreeFromGraphData(
        treeData,
        data.nodeCreateds || [],
        data.nodeUpdateds || [],
        data.nodeNFTMinteds || [],
        data.metadataSets || []
      );
      
      console.log('✅ Built tree from Graph:', {
        address: tree.address,
        nodeCount: tree.nodeCount,
        rootContent: tree.rootContent?.substring(0, 50) + '...'
      });
      
      return tree;
    } catch (error) {
      console.error('❌ Error getting tree from Graph:', error);
      throw error;
    }
  }, [getTreeNodesQuery, getAllTreesQuery]);

  // Invalidate NFT cache for a specific node (useful when node is updated)
  const invalidateNFTCache = useCallback((nodeId) => {
    if (!nodeId) return;
    const normalizedNodeId = nodeId.toLowerCase();
    if (nftCache.current.has(normalizedNodeId)) {
      nftCache.current.delete(normalizedNodeId);
      console.log('🗑️ Invalidated NFT cache for node:', normalizedNodeId.substring(0, 10) + '...');
    }
  }, []);

  // Get node NFT info with caching and request deduplication
  const getNodeNFTInfo = useCallback(async (nodeId) => {
    if (!nodeId) return null;
    
    const normalizedNodeId = nodeId.toLowerCase();
    console.log('🔍 getNodeNFTInfo called for nodeId:', normalizedNodeId.substring(0, 10) + '...', {
      cacheHit: nftCache.current.has(normalizedNodeId) ? 'YES' : 'NO'
    });
    
    // Check cache first
    if (nftCache.current.has(normalizedNodeId)) {
      console.log('✅ Using cached NFT data for node:', normalizedNodeId.substring(0, 10) + '...');
      return nftCache.current.get(normalizedNodeId);
    }
    
    // Check if there's already a pending request for this nodeId
    if (pendingNftRequests.current.has(normalizedNodeId)) {
      return await pendingNftRequests.current.get(normalizedNodeId);
    }
    
    // Create and cache the promise to avoid duplicate requests
    const requestPromise = (async () => {
      try {
        const { data } = await getNodeNFTInfoQuery({
          variables: { nodeId: normalizedNodeId }
        });
        
        let result = null;
        if (data?.nodeNFTMinteds?.length > 0) {
          const nftData = data.nodeNFTMinteds[0];
          
          // Check if there's a more recent NodeUpdated event with content
          let content = nftData.content; // Default to mint content
          if (data?.nodeUpdateds?.length > 0) {
            const updateData = data.nodeUpdateds[0]; // Most recent update
            if (updateData.content && updateData.content.trim()) {
              content = updateData.content; // Use updated content
              console.log('🔄 Using updated content from NodeUpdated event for NFT node:', {
                nodeId: normalizedNodeId.substring(0, 10) + '...',
                originalLength: nftData.content?.length || 0,
                updatedLength: updateData.content?.length || 0,
                updatedPreview: updateData.content?.substring(0, 100) + '...' || 'No content'
              });
            } else {
              console.log('📦 Using original mint content for NFT node:', {
                nodeId: normalizedNodeId.substring(0, 10) + '...',
                contentLength: nftData.content?.length || 0,
                reason: 'No updated content found'
              });
            }
          } else {
            console.log('📦 Using original mint content for NFT node:', {
              nodeId: normalizedNodeId.substring(0, 10) + '...',
              contentLength: nftData.content?.length || 0,
              reason: 'No NodeUpdated events found'
            });
          }
          
          result = {
            tokenId: nftData.tokenId,
            owner: nftData.owner,
            content: content,
            tokenBoundAccount: nftData.tokenBoundAccount,
            nodeTokenContract: nftData.nodeTokenContract,
            nodeId: nftData.nodeId
          };
        }
        
        // Cache the result
        nftCache.current.set(normalizedNodeId, result);
        console.log('💾 Cached NFT data for node:', normalizedNodeId.substring(0, 10) + '...', result ? 'SUCCESS' : 'NO_DATA');
        return result;
      } catch (error) {
        // Don't log AbortError as it's expected when requests are cancelled
        if (error.name !== 'AbortError') {
          console.error('❌ Error getting node NFT info from Graph:', error);
        }
        return null;
      } finally {
        // Remove from pending requests
        pendingNftRequests.current.delete(normalizedNodeId);
      }
    })();
    
    // Store the promise to deduplicate requests
    pendingNftRequests.current.set(normalizedNodeId, requestPromise);
    
    return await requestPromise;
  }, [getNodeNFTInfoQuery]);

  // Get token balance for a token bound account
  const getTokenBalance = useCallback(async (tokenBoundAccount) => {
    try {
      const { data } = await getTokenBalanceQuery({
        variables: { 
          tokenBoundAccount: tokenBoundAccount.toLowerCase()
        }
      });
      
      if (!data) return 0;
      
      const balance = calculateTokenBalance(
        data.tokenTransfers || [],
        data.tokensMinteds || [],
        data.tokensBurneds || [],
        tokenBoundAccount
      );
      
      return balance;
    } catch (error) {
      console.error('❌ Error getting token balance from Graph:', error);
      return 0;
    }
  }, [getTokenBalanceQuery]);

  // Get node token info (TBA and ERC20 creation details)
  const getNodeTokenInfo = useCallback(async (nodeTokenContract, tokenBoundAccount) => {
    try {
      const { data } = await getNodeTokenInfoQuery({
        variables: { 
          nodeTokenContract: nodeTokenContract.toLowerCase(),
          tokenBoundAccount: tokenBoundAccount.toLowerCase()
        }
      });
      
      if (!data) return null;
      
      return {
        tokenCreation: data.nodeTokenCreateds?.[0] || null,
        tbaCreation: data.tokenBoundAccountCreateds?.[0] || null
      };
    } catch (error) {
      console.error('❌ Error getting node token info from Graph:', error);
      return null;
    }
  }, [getNodeTokenInfoQuery]);

  // Function to refresh current tree data (for after edit operations)
  const refreshCurrentTree = useCallback(async () => {
    if (currentTree?.address) {
      console.log('🔄 Refreshing current tree data after edit operation...');
      try {
        const refreshedTree = await getTreeWithNodes(currentTree.address);
        if (refreshedTree) {
          setCurrentTree(refreshedTree);
          
          // Also update the tree in the trees list if it exists
          setTrees(prevTrees => 
            prevTrees.map(tree => 
              tree.address === refreshedTree.address ? refreshedTree : tree
            )
          );
        }
      } catch (error) {
        console.error('❌ Error refreshing current tree:', error);
      }
    }
  }, [currentTree?.address, getTreeWithNodes]);

  return {
    // State
    trees,
    currentTree,
    loading: loading || userTreesLoading || allTreesLoading || treeNodesLoading,
    recentActivities: recentData,
    recentLoading,
    
    // Actions
    getUserTrees,
    getAllTrees,
    getTreeWithNodes,
    getNodeNFTInfo,
    getTokenBalance,
    getNodeTokenInfo,
    setCurrentTree,
    refreshCurrentTree, // New function to refresh after edits
    invalidateNFTCache, // New function to invalidate cache when nodes are updated
    
    // Utilities
    buildTreeFromGraphData
  };
};