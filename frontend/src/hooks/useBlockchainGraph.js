import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { useGraph } from './useGraph';
import { pinTextToIPFS, checkIPFSAvailability, isIPFSReference } from '../utils/ipfsUtils';
import GlobalIPFSResolver from '../utils/globalIPFSResolver';
import { getCurrentChainSymbol } from '../utils/chainUtils';
import { getActiveChainConfig, getDefaultRpcUrl } from '../utils/chainConfig';
import { updateGraphEndpointFromChainConfig } from '../config/graphql';

// Contract ABIs - only keeping what's needed for write operations
const FACTORY_ABI = [
  "function createTree(string memory rootContent, uint256 rootTokenSupply, string memory modelId, address creator) external returns (address)",
  "event TreeCreated(bytes32 indexed treeId, address indexed treeAddress, address indexed nftContractAddress, address creator, string rootContent)"
];

const TREE_ABI = [
  "function addNode(bytes32 parentId, string memory content, bool createNFT, string memory modelId, address author) external returns (bytes32)",
  "function addNodeWithToken(bytes32 parentId, string memory content, string memory tokenName, string memory tokenSymbol, string memory modelId, address author) external returns (bytes32)",
  "function updateNodeContent(bytes32 nodeId, string memory newContent) external"
];

// IPFS rate limiting configuration
const IPFS_RATE_LIMITS = {
  free: { requestsPerMinute: 60, name: 'Free' },
  picnic: { requestsPerMinute: 250, name: 'Picnic' },
  fiesta: { requestsPerMinute: 500, name: 'Fiesta' }
};

const calculateIPFSDelay = (planType = 'free', safetyMargin = 0.8) => {
  const plan = IPFS_RATE_LIMITS[planType] || IPFS_RATE_LIMITS.free;
  const maxRequestsPerSecond = (plan.requestsPerMinute * safetyMargin) / 60;
  const delayMs = Math.ceil(1000 / maxRequestsPerSecond);
  console.log(`📊 IPFS rate limit config: ${plan.name} plan (${plan.requestsPerMinute}/min) → ${delayMs}ms delay`);
  return delayMs;
};

const IPFS_PLAN_TIER = process.env.REACT_APP_IPFS_PLAN_TIER || 'free';
const IPFS_REQUEST_DELAY = calculateIPFSDelay(IPFS_PLAN_TIER);

// Global IPFS resolver instance
const globalIPFSResolver = new GlobalIPFSResolver(IPFS_REQUEST_DELAY);

// Background IPFS resolution for Graph data
const resolveIPFSInBackground = async (treeResult, updateCallbacks = {}) => {
  const resolutionId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  console.log('🔍 [ID:' + resolutionId + '] Starting Graph-based IPFS resolution for tree:', treeResult.address);
  
  globalIPFSResolver.cancelTreeResolution(treeResult.address);
  globalIPFSResolver.activeResolutions.set(treeResult.address, resolutionId);
  
  const ipfsNodes = treeResult.nodes.filter(node => {
    const contentToCheck = node.originalContent || node.content;
    return isIPFSReference(contentToCheck);
  });
  
  console.log(`🔍 [ID:${resolutionId}] Found ${ipfsNodes.length} IPFS nodes to resolve`);
  
  const resolutionPromises = ipfsNodes.map((node) => {
    const contentToCheck = node.originalContent || node.content;
    const updateCallback = (resolvedContent) => {
      node.content = resolvedContent;
      console.log(`✅ [ID:${resolutionId}] Updated node ${node.nodeId.substring(0, 8)}... with resolved content`);
      
      if (updateCallbacks.updateCurrentTree) {
        updateCallbacks.updateCurrentTree(prev => 
          prev?.address === treeResult.address ? {...treeResult} : prev
        );
      }
      if (updateCallbacks.updateTrees) {
        updateCallbacks.updateTrees(prev => 
          prev.map(tree => 
            tree.address === treeResult.address ? {...treeResult} : tree
          )
        );
      }
    };
    
    return globalIPFSResolver.enqueueRequest(
      node.nodeId,
      contentToCheck,
      treeResult.address,
      updateCallback
    ).catch(error => {
      if (error.message !== 'Tree resolution cancelled') {
        console.warn(`❌ [ID:${resolutionId}] IPFS resolution failed for node:`, node.nodeId.substring(0, 8) + '...', error.message);
      }
      return null;
    });
  });
  
  try {
    await Promise.allSettled(resolutionPromises);
    console.log(`🔍 [ID:${resolutionId}] Background IPFS resolution complete for tree:`, treeResult.address);
  } catch (error) {
    console.warn(`🔍 [ID:${resolutionId}] Background IPFS resolution ended with errors for tree:`, treeResult.address);
  }
  
  globalIPFSResolver.activeResolutions.delete(treeResult.address);
};

export const useBlockchainGraph = (socket = null, graphFunctions = {}) => {
  // Write-only blockchain state
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [factory, setFactory] = useState(null);
  const [connected, setConnected] = useState(false);
  const [account, setAccount] = useState(null);
  const [nativeCurrencySymbol, setNativeCurrencySymbol] = useState('ETH');
  const [chainConfig, setChainConfig] = useState(null);
  const [factoryAddress, setFactoryAddress] = useState(null);
  
  // IPFS and storage configuration
  const [storageMode, setStorageMode] = useState('full');
  const [ipfsAvailable, setIpfsAvailable] = useState(false);
  const [useIPFSRetrieval, setUseIPFSRetrieval] = useState(true);

  // Graph functions will be passed in as props to avoid context issues
  const [trees, setTrees] = useState([]);
  const [currentTree, setCurrentTree] = useState(null);
  const [graphLoading, setGraphLoading] = useState(false);

  // Load chain configuration
  useEffect(() => {
    const loadChainConfig = async () => {
      try {
        const config = await getActiveChainConfig();
        setChainConfig(config);
        setFactoryAddress(config.factoryAddress);
        
        // Update GraphQL endpoint based on chain configuration
        updateGraphEndpointFromChainConfig(config);
      } catch (error) {
        console.error('Error loading chain configuration:', error);
        setFactoryAddress("0x5FbDB2315678afecb367f032d93F642f64180aa3");
      }
    };
    
    loadChainConfig();
  }, []);

  // Setup provider and connection handling
  useEffect(() => {
    if (window.ethereum) {
      const provider = new ethers.BrowserProvider(window.ethereum);
      setProvider(provider);
      
      getCurrentChainSymbol(provider).then(symbol => {
        setNativeCurrencySymbol(symbol);
      });

      const handleAccountsChanged = async (accounts) => {
        if (accounts.length === 0) {
          disconnect();
        } else {
          try {
            const signer = await provider.getSigner();
            const address = await signer.getAddress();
            
            if (address !== account) {
              setSigner(signer);
              setAccount(address);
              
              if (factoryAddress) {
                const factoryContract = new ethers.Contract(factoryAddress, FACTORY_ABI, signer);
                setFactory(factoryContract);
                setConnected(true);
                console.log('🔗 Account switched to:', address);
              }
            }
          } catch (error) {
            console.error('Error handling account change:', error);
          }
        }
      };

      const handleChainChanged = (chainId) => {
        console.log('⛓️ Chain changed to:', chainId);
        getCurrentChainSymbol(provider).then(symbol => {
          setNativeCurrencySymbol(symbol);
        });
        disconnect();
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        if (window.ethereum.removeListener) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
          window.ethereum.removeListener('chainChanged', handleChainChanged);
        }
      };
    } else {
      // Fallback to local provider
      const setupFallbackProvider = async () => {
        try {
          const rpcUrl = await getDefaultRpcUrl();
          const provider = new ethers.JsonRpcProvider(rpcUrl);
          setProvider(provider);
          
          getCurrentChainSymbol(provider).then(symbol => {
            setNativeCurrencySymbol(symbol);
          });
          
          connectWithTestAccount(provider);
        } catch (error) {
          console.error('Error setting up fallback provider:', error);
          const provider = new ethers.JsonRpcProvider('http://localhost:8545');
          setProvider(provider);
          
          getCurrentChainSymbol(provider).then(symbol => {
            setNativeCurrencySymbol(symbol);
          });
          
          connectWithTestAccount(provider);
        }
      };
      setupFallbackProvider();
    }
  }, [account, factoryAddress]);

  // Check IPFS availability
  useEffect(() => {
    console.log('🔍 Checking IPFS availability...');
    checkIPFSAvailability().then((available) => {
      console.log('🔍 IPFS availability result:', available);
      setIpfsAvailable(available);
    });
  }, []);

  const connectWithTestAccount = async (provider) => {
    try {
      const testPrivateKey = chainConfig?.privateKey;
      if (!testPrivateKey) {
        throw new Error('No private key configured for active chain');
      }
      const wallet = new ethers.Wallet(testPrivateKey, provider);
      
      setSigner(wallet);
      setAccount(wallet.address);
      setConnected(true);
      
      if (factoryAddress) {
        const factoryContract = new ethers.Contract(factoryAddress, FACTORY_ABI, wallet);
        setFactory(factoryContract);
      }
      
      console.log('🔗 Connected with test account:', wallet.address);
    } catch (error) {
      console.error('Error connecting with test account:', error);
    }
  };

  const connect = async () => {
    if (!provider) return;

    try {
      if (window.ethereum) {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        
        setSigner(signer);
        setAccount(address);
        setConnected(true);
        
        if (factoryAddress) {
          const factoryContract = new ethers.Contract(factoryAddress, FACTORY_ABI, signer);
          setFactory(factoryContract);
        }
        
        console.log('🔗 Connected to account:', address);
      } else {
        console.log('🔗 Using test account connection');
      }
    } catch (error) {
      console.error('Error connecting to wallet:', error);
    }
  };

  const disconnect = () => {
    setSigner(null);
    setAccount(null);
    setConnected(false);
    setFactory(null);
  };

  // Create tree - write operation using RPC
  const createTree = async (rootContent) => {
    if (!factory || !signer) throw new Error('Not connected');

    try {
      console.log('🌳 Creating tree with content:', rootContent);
      
      const calculateTokenSupply = (content) => {
        if (!content) return 1;
        return Math.max(1, Math.floor(content.length / 4));
      };
      
      const rootTokenSupply = calculateTokenSupply(rootContent);
      console.log('💰 Root token supply:', rootTokenSupply);
      
      const gasOptions = {};
      if (chainConfig?.gasPrice) {
        gasOptions.gasPrice = chainConfig.gasPrice;
        console.log('⛽ Using configured gas price:', chainConfig.gasPrice, 'wei');
      }
      
      const tx = await factory.createTree(rootContent, rootTokenSupply, '', signer.address, gasOptions);
      const receipt = await tx.wait();
      
      if (socket) {
        const gasUsed = receipt.gasUsed;
        const gasPrice = receipt.gasPrice;
        const gasCost = gasPrice ? ethers.formatEther(gasUsed * gasPrice) : '0';
        
        socket.emit('reportGasCost', {
          type: 'Tree Creation',
          description: `Created new tree with root content (${rootContent.length} chars)`,
          txHash: receipt.hash,
          gasUsed: gasUsed.toString(),
          gasPrice: gasPrice?.toString(),
          gasCost
        });
      }
      
      const event = receipt.logs.find(log => {
        try {
          const parsed = factory.interface.parseLog(log);
          return parsed.name === 'TreeCreated';
        } catch {
          return false;
        }
      });
      
      if (event) {
        const parsedEvent = factory.interface.parseLog(event);
        console.log('✅ Tree created at address:', parsedEvent.args.treeAddress);
        return parsedEvent.args.treeAddress;
      }
      
      throw new Error('TreeCreated event not found');
    } catch (error) {
      console.error('❌ Error creating tree:', error);
      throw error;
    }
  };

  // Update node - write operation using RPC
  const updateNode = useCallback(async (treeAddress, nodeId, newContent) => {
    if (!signer) throw new Error('Not connected');

    try {
      const treeContract = new ethers.Contract(treeAddress, TREE_ABI, signer);
      const gasOptions = {};
      if (chainConfig?.gasPrice) {
        gasOptions.gasPrice = chainConfig.gasPrice;
        console.log('⛽ Using configured gas price for node update:', chainConfig.gasPrice, 'wei');
      }
      
      const tx = await treeContract.updateNodeContent(nodeId, newContent, gasOptions);
      const receipt = await tx.wait();
      
      if (socket) {
        const gasUsed = receipt.gasUsed;
        const gasPrice = receipt.gasPrice;
        const gasCost = gasPrice ? ethers.formatEther(gasUsed * gasPrice) : '0';
        
        socket.emit('reportGasCost', {
          type: 'Node Update',
          description: `Direct node content update (${newContent.length} chars)`,
          txHash: receipt.hash,
          gasUsed: gasUsed.toString(),
          gasPrice: gasPrice?.toString(),
          gasCost
        });
      }
      
      return receipt;
    } catch (error) {
      console.error('❌ Error updating node:', error);
      throw error;
    }
  }, [signer, chainConfig, socket]);

  // Read operations now use The Graph (when available)
  const getUserTrees = useCallback(async () => {
    if (!account) return [];
    
    console.log('📊 Getting user trees from The Graph for:', account);
    setGraphLoading(true);
    
    try {
      if (graphFunctions.getUserTrees) {
        const trees = await graphFunctions.getUserTrees(account);
        setTrees(trees);
        
        // Start IPFS resolution for each tree
        if (useIPFSRetrieval) {
          trees.forEach(tree => {
            setTimeout(() => {
              resolveIPFSInBackground(tree, { 
                updateCurrentTree: setCurrentTree, 
                updateTrees: setTrees
              });
            }, 1000);
          });
        }
        
        return trees;
      } else {
        console.warn('⚠️ Graph functions not available, returning empty array');
        return [];
      }
    } catch (error) {
      console.error('❌ Error getting user trees from Graph:', error);
      return [];
    } finally {
      setGraphLoading(false);
    }
  }, [account, graphFunctions.getUserTrees, useIPFSRetrieval]);

  const getAllTrees = useCallback(async () => {
    console.log('📊 Getting all trees from The Graph');
    setGraphLoading(true);
    
    try {
      if (graphFunctions.getAllTrees) {
        const trees = await graphFunctions.getAllTrees();
        setTrees(trees);
        
        // Start IPFS resolution for each tree
        if (useIPFSRetrieval) {
          trees.forEach(tree => {
            setTimeout(() => {
              resolveIPFSInBackground(tree, { 
                updateCurrentTree: setCurrentTree, 
                updateTrees: setTrees
              });
            }, 1000);
          });
        }
        
        return trees;
      } else {
        console.warn('⚠️ Graph functions not available, returning empty array');
        return [];
      }
    } catch (error) {
      console.error('❌ Error getting all trees from Graph:', error);
      return [];
    } finally {
      setGraphLoading(false);
    }
  }, [graphFunctions.getAllTrees, useIPFSRetrieval]);

  const getTree = useCallback(async (treeAddress) => {
    console.log('📊 Getting tree from The Graph:', treeAddress);
    try {
      if (graphFunctions.getTreeWithNodes) {
        const tree = await graphFunctions.getTreeWithNodes(treeAddress);
        
        // Start IPFS resolution
        if (useIPFSRetrieval) {
          setTimeout(() => {
            resolveIPFSInBackground(tree, { 
              updateCurrentTree: setCurrentTree, 
              updateTrees: setTrees
            });
          }, 1000);
        }
        
        return tree;
      } else {
        console.warn('⚠️ Graph getTreeWithNodes not available');
        throw new Error('Graph functions not available');
      }
    } catch (error) {
      console.error('❌ Error getting tree from Graph:', error);
      throw error;
    }
  }, [graphFunctions.getTreeWithNodes, useIPFSRetrieval]);

  const getNodeNFTInfo = useCallback(async (tree, nodeId) => {
    try {
      if (graphFunctions.getNodeNFTInfo) {
        return await graphFunctions.getNodeNFTInfo(nodeId);
      } else {
        console.warn('⚠️ Graph getNodeNFTInfo not available');
        return null;
      }
    } catch (error) {
      console.error('❌ Error getting node NFT info from Graph:', error);
      return null;
    }
  }, [graphFunctions.getNodeNFTInfo]);

  // Storage mode cycling
  const cycleStorageMode = () => {
    const modes = ipfsAvailable ? ['full', 'lightweight', 'ipfs'] : ['full', 'lightweight'];
    const currentIndex = modes.indexOf(storageMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    const newMode = modes[nextIndex];
    setStorageMode(newMode);
    console.log('🔄 Storage mode changed to:', newMode);
  };

  // Utility function to check if node has NFT (Contract-based)
  const checkNodeHasNFT = async (treeAddress, nodeId) => {
    if (!nodeId || nodeId === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      return false;
    }

    try {
      // Use fresh provider to ensure we get latest blockchain state
      const rpcUrl = await getDefaultRpcUrl();
      const freshProvider = new ethers.JsonRpcProvider(rpcUrl);
      const treeContract = new ethers.Contract(treeAddress, TREE_ABI, freshProvider);
      const hasNFT = await treeContract.nodeHasNFT(nodeId);
      return hasNFT;
    } catch (error) {
      console.error('❌ Error checking if node has NFT:', error);
      return false; // Assume no NFT on error
    }
  };

  return {
    // Blockchain connection state
    provider,
    signer,
    factory,
    connected,
    account,
    connect,
    disconnect,
    nativeCurrencySymbol,
    
    // Write operations (RPC-based)
    createTree,
    updateNode,
    
    // Read operations (Graph-based)
    getTree,
    getUserTrees,
    getAllTrees,
    getNodeNFTInfo,
    checkNodeHasNFT,
    
    // Graph-specific data
    trees, // From Graph state
    currentTree, // From Graph state
    setCurrentTree, // Allow external setting
    loading: graphLoading, // Graph loading state
    
    // Storage and IPFS
    storageMode,
    cycleStorageMode,
    ipfsAvailable,
    useIPFSRetrieval,
    setUseIPFSRetrieval,
    
    // IPFS utilities
    startIPFSResolution: (treeResult, setCurrentTree, setTrees) => {
      if (!useIPFSRetrieval) {
        console.log('🚫 IPFS retrieval disabled, skipping background resolution');
        return;
      }
      setTimeout(() => {
        resolveIPFSInBackground(treeResult, { 
          updateCurrentTree: setCurrentTree, 
          updateTrees: setTrees 
        });
      }, 1000);
    },
    getIPFSQueueStatus: () => globalIPFSResolver.getStatus(),
    cancelTreeIPFSResolution: (treeAddress) => globalIPFSResolver.cancelTreeResolution(treeAddress)
  };
};