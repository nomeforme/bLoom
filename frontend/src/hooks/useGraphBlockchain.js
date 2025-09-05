import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { graphAPI } from '../utils/graphClient';
import { pinTextToIPFS, checkIPFSAvailability, isIPFSReference } from '../utils/ipfsUtils';
import GlobalIPFSResolver from '../utils/globalIPFSResolver';
import { getCurrentChainSymbol } from '../utils/chainUtils';
import { getActiveChainConfig, getDefaultRpcUrl, switchActiveChain, isChainConfigured } from '../utils/chainConfig';

// Contract ABI - only what we need for write operations
const FACTORY_ABI = [
  "function createTree(string memory rootContent, uint256 rootTokenSupply, string memory modelId, address creator) external returns (address)"
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

// Global instance
const globalIPFSResolver = new GlobalIPFSResolver(IPFS_REQUEST_DELAY);

// Background IPFS resolution using global queue
const resolveIPFSInBackground = async (treeResult, updateCallbacks = {}) => {
  const resolutionId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  console.log('🔍 [ID:' + resolutionId + '] Starting background IPFS resolution for tree:', treeResult.address);
  console.log('🔍 [ID:' + resolutionId + '] Total nodes to check:', treeResult.nodes.length);
  
  // Cancel any previous resolution for this tree
  globalIPFSResolver.cancelTreeResolution(treeResult.address);
  
  // Mark this tree as having active resolution
  globalIPFSResolver.activeResolutions.set(treeResult.address, resolutionId);
  
  const ipfsNodes = [];
  
  // First pass: identify all IPFS nodes and queue them
  for (let i = 0; i < treeResult.nodes.length; i++) {
    const node = treeResult.nodes[i];
    const contentToCheck = node.originalContent || node.content;
    
    if (isIPFSReference(contentToCheck)) {
      console.log(`🔍 [ID:${resolutionId}] Queuing IPFS node ${i + 1}/${treeResult.nodes.length}:`, {
        nodeId: node.nodeId.substring(0, 8) + '...',
        originalContent: contentToCheck.substring(0, 50) + '...'
      });
      
      ipfsNodes.push({
        node,
        contentToCheck,
        index: i
      });
    }
  }
  
  console.log(`🔍 [ID:${resolutionId}] Found ${ipfsNodes.length} IPFS nodes to resolve`);
  
  // Second pass: queue all IPFS resolution requests
  const resolutionPromises = ipfsNodes.map(({ node, contentToCheck, index }) => {
    const updateCallback = (resolvedContent) => {
      // Update the node content in the tree
      node.content = resolvedContent;
      
      console.log(`✅ [ID:${resolutionId}] Updated node ${node.nodeId.substring(0, 8)}... with resolved content`);
      
      // Trigger tree updates if callbacks provided
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
  
  // Wait for all resolutions to complete (or fail)
  try {
    await Promise.allSettled(resolutionPromises);
    console.log(`🔍 [ID:${resolutionId}] Background IPFS resolution complete for tree:`, treeResult.address);
  } catch (error) {
    console.warn(`🔍 [ID:${resolutionId}] Background IPFS resolution ended with errors for tree:`, treeResult.address);
  }
  
  // Clean up active resolution tracking
  globalIPFSResolver.activeResolutions.delete(treeResult.address);
};

export const useGraphBlockchain = (socket = null, onChainSwitch = null) => {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [factory, setFactory] = useState(null);
  const [connected, setConnected] = useState(false);
  const [account, setAccount] = useState(null);
  const [storageMode, setStorageMode] = useState('full');
  const [ipfsAvailable, setIpfsAvailable] = useState(false);
  const [useIPFSRetrieval, setUseIPFSRetrieval] = useState(true);
  const [nativeCurrencySymbol, setNativeCurrencySymbol] = useState('ETH');
  const [chainConfig, setChainConfig] = useState(null);
  const [factoryAddress, setFactoryAddress] = useState(null);
  const [isChainSwitching, setIsChainSwitching] = useState(false);

  // Load chain configuration
  useEffect(() => {
    const loadChainConfig = async () => {
      try {
        const config = await getActiveChainConfig();
        setChainConfig(config);
        setFactoryAddress(config.factoryAddress);
      } catch (error) {
        console.error('Error loading chain configuration:', error);
        setFactoryAddress("0x5FbDB2315678afecb367f032d93F642f64180aa3");
      }
    };
    
    loadChainConfig();
  }, []);

  // Provider and wallet setup (same as original)
  useEffect(() => {
    if (window.ethereum) {
      const provider = new ethers.BrowserProvider(window.ethereum);
      setProvider(provider);
      
      getCurrentChainSymbol(provider).then(symbol => {
        setNativeCurrencySymbol(symbol);
      });

      // Event handlers for account and chain changes (same as original)
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
                console.log('Account switched to:', address);
              }
            }
          } catch (error) {
            console.error('Error handling account change:', error);
          }
        }
      };

      const handleChainChanged = async (chainId) => {
        const chainIdDecimal = parseInt(chainId, 16);
        console.log('Chain changed to:', chainId, '(decimal:', chainIdDecimal + ')');
        
        setIsChainSwitching(true);
        
        try {
          const isSupported = await isChainConfigured(chainIdDecimal);
          
          if (isSupported) {
            console.log('🔄 Switching active chain to:', chainIdDecimal);
            const newConfig = await switchActiveChain(chainIdDecimal);
            console.log('✅ Active chain switched to:', newConfig.name);
            
            setChainConfig(newConfig);
            setFactoryAddress(newConfig.factoryAddress);
            
            const newProvider = new ethers.BrowserProvider(window.ethereum);
            setProvider(newProvider);
            
            getCurrentChainSymbol(newProvider).then(symbol => {
              setNativeCurrencySymbol(symbol);
            });
            
            if (connected && account) {
              try {
                const newSigner = await newProvider.getSigner();
                setSigner(newSigner);
                
                if (newConfig.factoryAddress) {
                  const factoryContract = new ethers.Contract(newConfig.factoryAddress, FACTORY_ABI, newSigner);
                  setFactory(factoryContract);
                }
                
                console.log('🔄 Updated provider and contracts for new chain');
                
                if (onChainSwitch) {
                  console.log('🔄 Triggering soft refresh for chain switch');
                  onChainSwitch(newConfig);
                }
              } catch (error) {
                console.error('❌ Error updating provider/signer for new chain:', error);
              }
            }
          } else {
            alert(`Chain ${chainIdDecimal} is not supported. Please switch to a supported chain or add it to the configuration. Staying on current chain.`);
            console.warn('🚫 Unsupported chain:', chainIdDecimal);
          }
        } catch (error) {
          console.error('❌ Error handling chain change:', error);
          alert('Error switching chains. Please check your connection and try again.');
        } finally {
          setIsChainSwitching(false);
        }
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
      // Fallback to local provider (same as original)
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
  }, [account]);

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
      
      console.log('Connected with test account:', wallet.address);
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
        
        console.log('Connected to account:', address);
      } else {
        console.log('Using test account connection');
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

  // Write operations remain the same (createTree, updateNode, etc.)
  const createTree = async (rootContent) => {
    if (!factory || !signer) throw new Error('Not connected');

    try {
      console.log('Creating tree with content:', rootContent);
      
      const calculateTokenSupply = (content) => {
        if (!content) return 1;
        return Math.max(1, Math.floor(content.length / 4));
      };
      
      const rootTokenSupply = calculateTokenSupply(rootContent);
      console.log('Root token supply:', rootTokenSupply);
      
      const gasOptions = {};
      if (chainConfig?.gasPrice) {
        gasOptions.gasPrice = chainConfig.gasPrice;
        console.log('Using configured gas price:', chainConfig.gasPrice, 'wei');
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
        console.log('Tree created at address:', parsedEvent.args.treeAddress);
        return parsedEvent.args.treeAddress;
      }
      
      throw new Error('TreeCreated event not found');
    } catch (error) {
      console.error('Error creating tree:', error);
      throw error;
    }
  };

  // READ OPERATIONS NOW USE THE GRAPH
  const getTree = useCallback(async (treeAddress) => {
    if (!signer || !provider) throw new Error('Not connected');

    try {
      console.log('🔍 Getting tree from The Graph:', treeAddress);
      
      // Query The Graph for tree data
      const graphTree = await graphAPI.getTreeWithNodes(treeAddress);
      
      if (!graphTree) {
        throw new Error('Tree not found in The Graph');
      }
      
      console.log('📊 Got tree data from Graph:', {
        address: graphTree.address,
        nodeCount: graphTree.nodeCount,
        nodesLength: graphTree.nodes.length
      });
      
      // Transform Graph data to match the expected format
      const nodes = graphTree.nodes.map(node => {
        // Show loading placeholder for IPFS content initially, but store original
        let displayContent = node.content;
        let originalContent = node.content;
        if (isIPFSReference(node.content)) {
          displayContent = "Loading IPFS content...";
        }
        
        return {
          nodeId: node.nodeId,
          parentId: node.parentId || '0x0000000000000000000000000000000000000000000000000000000000000000',
          children: [], // We'll need to build this from the flat structure if needed
          author: node.author,
          timestamp: parseInt(node.timestamp),
          isRoot: node.isRoot,
          modelId: node.modelId || '',
          content: displayContent,
          originalContent: originalContent,
          hasNFT: node.hasNFT
        };
      });
      
      const result = {
        address: graphTree.address,
        nftAddress: graphTree.nftContract,
        rootId: graphTree.rootId,
        nodes,
        nodeCount: nodes.length,
        rootContent: graphTree.rootContent || ''
      };
      
      console.log('✅ Tree result prepared:', {
        address: result.address,
        nodeCount: result.nodeCount,
        rootContent: result.rootContent.substring(0, 30)
      });
      
      return result;
    } catch (error) {
      console.error('Error getting tree from Graph:', error);
      throw error;
    }
  }, [signer, provider]);

  const getUserTrees = useCallback(async () => {
    if (!account) return [];

    try {
      console.log('🔍 Getting user trees from The Graph for:', account);
      
      const graphTrees = await graphAPI.getUserTrees(account);
      
      console.log('📊 Got user trees from Graph:', graphTrees.length);
      
      // Transform each tree to expected format
      const trees = graphTrees.map(graphTree => {
        const nodes = graphTree.nodes.map(node => {
          let displayContent = node.content;
          let originalContent = node.content;
          if (isIPFSReference(node.content)) {
            displayContent = "Loading IPFS content...";
          }
          
          return {
            nodeId: node.nodeId,
            parentId: node.parentId || '0x0000000000000000000000000000000000000000000000000000000000000000',
            children: [],
            author: account, // From Graph query
            timestamp: parseInt(node.timestamp || 0),
            isRoot: node.isRoot,
            modelId: node.modelId || '',
            content: displayContent,
            originalContent: originalContent,
            hasNFT: node.hasNFT
          };
        });
        
        return {
          address: graphTree.address,
          nftAddress: graphTree.nftContract,
          rootId: graphTree.rootId,
          nodes,
          nodeCount: nodes.length,
          rootContent: graphTree.rootContent || ''
        };
      });
      
      console.log('✅ User trees prepared:', trees.length);
      return trees;
    } catch (error) {
      console.error('Error getting user trees from Graph:', error);
      return [];
    }
  }, [account]);

  const getAllTrees = useCallback(async () => {
    try {
      console.log('🔍 Getting all trees from The Graph');
      
      const graphTrees = await graphAPI.getAllTrees(100); // Limit to 100 trees
      
      console.log('📊 Got all trees from Graph:', graphTrees.length);
      
      // For getAllTrees, we don't need full node data, just basic tree info
      const trees = await Promise.all(
        graphTrees.map(async (graphTree) => {
          try {
            const fullTree = await getTree(graphTree.address);
            return fullTree;
          } catch (error) {
            console.warn('Failed to get full tree data for:', graphTree.address);
            // Return basic tree data if full data fails
            return {
              address: graphTree.address,
              nftAddress: graphTree.nftContract || '',
              rootId: '0x0000000000000000000000000000000000000000000000000000000000000000',
              nodes: [],
              nodeCount: parseInt(graphTree.nodeCount || 0),
              rootContent: graphTree.rootContent || ''
            };
          }
        })
      );
      
      console.log('✅ All trees prepared:', trees.length);
      return trees;
    } catch (error) {
      console.error('Error getting all trees from Graph:', error);
      return [];
    }
  }, [getTree]);

  const updateNode = useCallback(async (treeAddress, nodeId, newContent) => {
    if (!signer) throw new Error('Not connected');

    try {
      const treeContract = new ethers.Contract(treeAddress, TREE_ABI, signer);
      const gasOptions = {};
      if (chainConfig?.gasPrice) {
        gasOptions.gasPrice = chainConfig.gasPrice;
        console.log('Using configured gas price for node update:', chainConfig.gasPrice, 'wei');
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
      console.error('Error updating node:', error);
      throw error;
    }
  }, [signer, chainConfig, socket]);

  // Placeholder for NFT info - could be enhanced with Graph queries
  const getNodeNFTInfo = useCallback(async (tree, nodeId) => {
    // This could be implemented with Graph queries as well
    return null;
  }, []);

  const checkNodeHasNFT = async (treeAddress, nodeId) => {
    // Could query The Graph for this info instead of RPC call
    try {
      const rpcUrl = await getDefaultRpcUrl();
      const freshProvider = new ethers.JsonRpcProvider(rpcUrl);
      const treeContract = new ethers.Contract(treeAddress, TREE_ABI, freshProvider);
      const hasNFT = await treeContract.nodeHasNFT(nodeId);
      return hasNFT;
    } catch (error) {
      console.error('Error checking if node has NFT:', error);
      return false;
    }
  };

  const cycleStorageMode = () => {
    const modes = ipfsAvailable ? ['full', 'lightweight', 'ipfs'] : ['full', 'lightweight'];
    const currentIndex = modes.indexOf(storageMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    const newMode = modes[nextIndex];
    setStorageMode(newMode);
    console.log('Storage mode changed to:', newMode);
  };

  return {
    provider,
    signer,
    factory,
    connected,
    account,
    connect,
    disconnect,
    createTree,
    getTree,
    updateNode,
    getUserTrees,
    getAllTrees,
    getNodeNFTInfo,
    checkNodeHasNFT,
    storageMode,
    cycleStorageMode,
    ipfsAvailable,
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
    useIPFSRetrieval,
    setUseIPFSRetrieval,
    nativeCurrencySymbol,
    chainConfig,
    isChainSwitching,
    // Global IPFS resolver utilities
    getIPFSQueueStatus: () => globalIPFSResolver.getStatus(),
    cancelTreeIPFSResolution: (treeAddress) => globalIPFSResolver.cancelTreeResolution(treeAddress)
  };
};