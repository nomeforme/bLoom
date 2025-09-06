import { useState, useEffect, useCallback, useRef } from 'react';
import { useSubscription } from '@apollo/client/react';
import { gql } from '@apollo/client';

// GraphQL Subscriptions for real-time updates
// Note: The Graph Studio doesn't support subscriptions yet, but we can simulate
// real-time updates by polling and comparing data

const TREE_CREATED_SUBSCRIPTION = gql`
  subscription TreeCreated($blockNumber: BigInt) {
    treeCreateds(
      where: { blockNumber_gt: $blockNumber }
      orderBy: blockTimestamp
      orderDirection: desc
    ) {
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

const NODE_CREATED_SUBSCRIPTION = gql`
  subscription NodeCreated($blockNumber: BigInt) {
    nodeCreateds(
      where: { blockNumber_gt: $blockNumber }
      orderBy: blockTimestamp
      orderDirection: desc
    ) {
      id
      nodeId
      parentId
      author
      timestamp
      treeAddress
      blockNumber
      blockTimestamp
      transactionHash
    }
  }
`;

const NFT_MINTED_SUBSCRIPTION = gql`
  subscription NFTMinted($blockNumber: BigInt) {
    nodeNFTMinteds(
      where: { blockNumber_gt: $blockNumber }
      orderBy: blockTimestamp
      orderDirection: desc
    ) {
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
  }
`;

// Since The Graph Studio doesn't support subscriptions yet, we'll use polling
// This simulates real-time updates by comparing with latest known block numbers

// Configuration from environment variables
const GRAPH_USER_ID = process.env.REACT_APP_GRAPH_USER_ID || '120278';
const GRAPH_VERSION = process.env.REACT_APP_GRAPH_VERSION || 'v0.0.4';
export const useGraphSubscriptions = (callbacks = {}) => {
  const [lastKnownBlockNumber, setLastKnownBlockNumber] = useState(0);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState(null);
  const [isVisible, setIsVisible] = useState(!document.hidden);
  
  // Use refs for callbacks to avoid stale closures
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;
  
  // Callback functions for different events
  const {
    onTreeCreated = () => {},
    onNodeCreated = () => {},
    onNFTMinted = () => {},
    onTokenTransfer = () => {},
    onError = () => {}
  } = callbacksRef.current;

  // Polling function to check for new events
  const pollForUpdates = useCallback(async () => {
    if (isPolling) return; // Prevent overlapping polls
    
    try {
      setIsPolling(true);
      setError(null);

      // Query for events newer than our last known block
      const query = `
        query GetLatestEvents($blockNumber: BigInt!) {
          treeCreateds(
            where: { blockNumber_gt: $blockNumber }
            first: 10
            orderBy: blockTimestamp
            orderDirection: desc
          ) {
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
          
          nodeCreateds(
            where: { blockNumber_gt: $blockNumber }
            first: 20
            orderBy: blockTimestamp
            orderDirection: desc
          ) {
            id
            nodeId
            parentId
            author
            timestamp
            treeAddress
            blockNumber
            blockTimestamp
            transactionHash
          }
          
          nodeNFTMinteds(
            where: { blockNumber_gt: $blockNumber }
            first: 20
            orderBy: blockTimestamp
            orderDirection: desc
          ) {
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
          
          tokenTransfers(
            where: { blockNumber_gt: $blockNumber }
            first: 50
            orderBy: blockTimestamp
            orderDirection: desc
          ) {
            id
            from
            to
            value
            blockNumber
            blockTimestamp
            transactionHash
          }
        }
      `;

      const response = await fetch(`https://api.studio.thegraph.com/query/${GRAPH_USER_ID}/bloom-subgraph/${GRAPH_VERSION}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables: { blockNumber: lastKnownBlockNumber.toString() }
        })
      });

      const { data } = await response.json();
      
      if (!data) return;

      let newMaxBlockNumber = lastKnownBlockNumber;

      // Process new tree creations
      if (data.treeCreateds?.length > 0) {
        console.log('🌳 New trees created:', data.treeCreateds.length);
        data.treeCreateds.forEach(tree => {
          onTreeCreated(tree);
          newMaxBlockNumber = Math.max(newMaxBlockNumber, parseInt(tree.blockNumber));
        });
      }

      // Process new node creations
      if (data.nodeCreateds?.length > 0) {
        console.log('📝 New nodes created:', data.nodeCreateds.length);
        data.nodeCreateds.forEach(node => {
          onNodeCreated(node);
          newMaxBlockNumber = Math.max(newMaxBlockNumber, parseInt(node.blockNumber));
        });
      }

      // Process new NFT mints
      if (data.nodeNFTMinteds?.length > 0) {
        console.log('🎨 New NFTs minted:', data.nodeNFTMinteds.length);
        data.nodeNFTMinteds.forEach(nft => {
          onNFTMinted(nft);
          newMaxBlockNumber = Math.max(newMaxBlockNumber, parseInt(nft.blockNumber));
        });
      }

      // Process new token transfers
      if (data.tokenTransfers?.length > 0) {
        console.log('💰 New token transfers:', data.tokenTransfers.length);
        data.tokenTransfers.forEach(transfer => {
          onTokenTransfer(transfer);
          newMaxBlockNumber = Math.max(newMaxBlockNumber, parseInt(transfer.blockNumber));
        });
      }

      // Update our checkpoint
      if (newMaxBlockNumber > lastKnownBlockNumber) {
        setLastKnownBlockNumber(newMaxBlockNumber);
      }

    } catch (err) {
      console.error('❌ Error polling for Graph updates:', err);
      setError(err);
      onError(err);
    } finally {
      setIsPolling(false);
    }
  }, [lastKnownBlockNumber, isPolling, onTreeCreated, onNodeCreated, onNFTMinted, onTokenTransfer, onError]);

  // Initialize with current latest block
  useEffect(() => {
    const initializeBlockNumber = async () => {
      try {
        const query = `
          query GetLatestBlock {
            treeCreateds(first: 1, orderBy: blockNumber, orderDirection: desc) {
              blockNumber
            }
            nodeCreateds(first: 1, orderBy: blockNumber, orderDirection: desc) {
              blockNumber
            }
            nodeNFTMinteds(first: 1, orderBy: blockNumber, orderDirection: desc) {
              blockNumber
            }
          }
        `;

        const response = await fetch(`https://api.studio.thegraph.com/query/${GRAPH_USER_ID}/bloom-subgraph/${GRAPH_VERSION}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ query })
        });

        const { data } = await response.json();
        
        if (data) {
          const latestBlocks = [
            ...(data.treeCreateds || []),
            ...(data.nodeCreateds || []),
            ...(data.nodeNFTMinteds || [])
          ].map(item => parseInt(item.blockNumber));
          
          if (latestBlocks.length > 0) {
            const maxBlock = Math.max(...latestBlocks);
            setLastKnownBlockNumber(maxBlock);
            console.log('📡 Initialized Graph polling from block:', maxBlock);
          }
        }
      } catch (err) {
        console.error('❌ Error initializing block number:', err);
      }
    };

    initializeBlockNumber();
  }, []);

  // Handle visibility changes to pause polling when tab is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = !document.hidden;
      console.log('📡 Tab visibility changed:', visible ? 'visible' : 'hidden');
      setIsVisible(visible);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Setup polling interval - stable reference to prevent constant restarts
  const intervalRef = useRef(null);
  
  useEffect(() => {
    if (lastKnownBlockNumber === 0) return; // Wait for initialization
    
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    console.log('📡 Polling disabled - using socket-based real-time updates only');
    // Polling disabled since all events are handled via sockets in real-time
    // intervalRef.current = setInterval(() => {
    //   pollForUpdates();
    // }, 15000);

    return () => {
      console.log('📡 Stopping Graph real-time polling...');
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [lastKnownBlockNumber]); // Only depend on lastKnownBlockNumber to avoid restarts

  // Manual refresh function
  const refreshNow = useCallback(() => {
    console.log('🔄 Manual Graph refresh triggered');
    pollForUpdates();
  }, [pollForUpdates]);

  // Function to reset polling from a specific block
  const resetFromBlock = useCallback((blockNumber) => {
    console.log('🔄 Resetting Graph polling from block:', blockNumber);
    setLastKnownBlockNumber(blockNumber);
  }, []);

  return {
    isPolling,
    error,
    lastKnownBlockNumber,
    refreshNow,
    resetFromBlock,
    
    // Connection status
    isConnected: !error && lastKnownBlockNumber > 0,
    
    // Statistics
    pollingStats: {
      lastPolled: isPolling ? 'now' : 'idle',
      fromBlock: lastKnownBlockNumber,
      hasError: !!error
    }
  };
};

// Higher-order hook that combines subscriptions with notifications
export const useRealtimeGraph = (notificationCallback) => {
  const [recentEvents, setRecentEvents] = useState([]);
  const [eventCounts, setEventCounts] = useState({
    trees: 0,
    nodes: 0,
    nfts: 0,
    transfers: 0
  });

  const addEvent = useCallback((type, event) => {
    const newEvent = {
      id: event.id,
      type,
      timestamp: Date.now(),
      blockNumber: event.blockNumber,
      data: event
    };
    
    setRecentEvents(prev => [newEvent, ...prev.slice(0, 49)]); // Keep last 50 events
    
    setEventCounts(prev => ({
      ...prev,
      [type]: prev[type] + 1
    }));

    // Trigger notification if callback provided
    if (notificationCallback) {
      const messages = {
        trees: `🌳 New tree created: ${event.rootContent?.substring(0, 30)}...`,
        nodes: `📝 New node added by ${event.author?.substring(0, 6)}...`,
        nfts: `🎨 NFT minted for node: ${event.content?.substring(0, 30)}...`,
        transfers: `💰 Token transfer: ${event.value} tokens`
      };
      
      notificationCallback({
        message: messages[type] || 'New blockchain event',
        type: 'info'
      });
    }
  }, [notificationCallback]);

  const subscriptions = useGraphSubscriptions({
    onTreeCreated: (event) => addEvent('trees', event),
    onNodeCreated: (event) => addEvent('nodes', event),
    onNFTMinted: (event) => addEvent('nfts', event),
    onTokenTransfer: (event) => addEvent('transfers', event),
    onError: (error) => {
      if (notificationCallback) {
        notificationCallback({
          message: '❌ Graph connection error',
          type: 'error'
        });
      }
    }
  });

  return {
    ...subscriptions,
    recentEvents,
    eventCounts,
    clearEvents: () => {
      setRecentEvents([]);
      setEventCounts({ trees: 0, nodes: 0, nfts: 0, transfers: 0 });
    }
  };
};