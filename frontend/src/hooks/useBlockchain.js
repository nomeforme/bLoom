import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { pinTextToIPFS, checkIPFSAvailability, isIPFSReference } from '../utils/ipfsUtils';
import GlobalIPFSResolver from '../utils/globalIPFSResolver';
import { getCurrentChainSymbol } from '../utils/chainUtils';
import { getActiveChainConfig, getDefaultRpcUrl } from '../utils/chainConfig';

// Contract ABI - in a real app, you'd import this from generated files
const FACTORY_ABI = [
  "function createTree(string memory rootContent, uint256 rootTokenSupply, string memory modelId, address creator) external returns (address)",
  "function getTree(bytes32 treeId) external view returns (address)",
  "function getTreeNFTContract(bytes32 treeId) external view returns (address)",
  "function getUserTrees(address user) external view returns (bytes32[] memory)",
  "function getAllTrees() external view returns (bytes32[] memory)",
  "event TreeCreated(bytes32 indexed treeId, address indexed treeAddress, address indexed nftContractAddress, address creator, string rootContent)"
];

const TREE_ABI = [
  "function addNode(bytes32 parentId, string memory content, bool createNFT, string memory modelId, address author) external returns (bytes32)",
  "function addNodeWithToken(bytes32 parentId, string memory content, string memory tokenName, string memory tokenSymbol, string memory modelId, address author) external returns (bytes32)",
  "function updateNodeContent(bytes32 nodeId, string memory newContent) external",
  "function getNode(bytes32 nodeId) external view returns (bytes32 id, bytes32 parentId, bytes32[] memory children, address author, uint256 timestamp, bool isRoot, string memory modelId)",
  "function getNodeContent(bytes32 nodeId) external view returns (string memory)",
  "function getNodeModelId(bytes32 nodeId) external view returns (string memory)",
  "function nodeHasNFT(bytes32 nodeId) external view returns (bool)",
  "function getAllNodes() external view returns (bytes32[] memory)",
  "function getRootId() external view returns (bytes32)",
  "function getNodeCount() external view returns (uint256)",
  "function getNFTContract() external view returns (address)",
  "event NodeCreated(bytes32 indexed nodeId, bytes32 indexed parentId, address indexed author, uint256 timestamp)",
  "event NodeUpdated(bytes32 indexed nodeId, address indexed author)"
];

const NFT_ABI = [
  "function ownerOf(uint256 tokenId) external view returns (address owner)",
  "function tokenURI(uint256 tokenId) external view returns (string memory)",
  "function getTokenIdFromNodeId(bytes32 nodeId) external view returns (uint256)",
  "function getNodeIdFromTokenId(uint256 tokenId) external view returns (bytes32)",
  "function getNodeContent(bytes32 nodeId) external view returns (string memory)",
  "function getTextContent(bytes32 nodeId) external view returns (string memory)",
  "function totalSupply() external view returns (uint256)",
  "function name() external view returns (string memory)",
  "function symbol() external view returns (string memory)"
];

// Get factory address from dynamic configuration
const chainConfig = getActiveChainConfig();
const FACTORY_ADDRESS = chainConfig.factoryAddress;

// IPFS rate limiting configuration based on Pinata plans
const IPFS_RATE_LIMITS = {
  free: { requestsPerMinute: 60, name: 'Free' },
  picnic: { requestsPerMinute: 250, name: 'Picnic' },
  fiesta: { requestsPerMinute: 500, name: 'Fiesta' }
};

// Calculate delay between requests to stay under rate limit (with safety margin)
const calculateIPFSDelay = (planType = 'free', safetyMargin = 0.8) => {
  const plan = IPFS_RATE_LIMITS[planType] || IPFS_RATE_LIMITS.free;
  const maxRequestsPerSecond = (plan.requestsPerMinute * safetyMargin) / 60;
  const delayMs = Math.ceil(1000 / maxRequestsPerSecond);
  console.log(`📊 IPFS rate limit config: ${plan.name} plan (${plan.requestsPerMinute}/min) → ${delayMs}ms delay`);
  return delayMs;
};

// Get IPFS plan from environment or default to free
const IPFS_PLAN_TIER = process.env.REACT_APP_IPFS_PLAN_TIER || 'free';
const IPFS_REQUEST_DELAY = calculateIPFSDelay(IPFS_PLAN_TIER);

// Global instance
const globalIPFSResolver = new GlobalIPFSResolver(IPFS_REQUEST_DELAY);

// Background IPFS resolution - updates tree state as content resolves using global queue
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

export const useBlockchain = (socket = null) => {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [factory, setFactory] = useState(null);
  const [connected, setConnected] = useState(false);
  const [account, setAccount] = useState(null);
  const [storageMode, setStorageMode] = useState('full'); // 'full', 'lightweight', 'ipfs'
  const [ipfsAvailable, setIpfsAvailable] = useState(false);
  const [useIPFSRetrieval, setUseIPFSRetrieval] = useState(true); // Global toggle for IPFS resolution
  const [nativeCurrencySymbol, setNativeCurrencySymbol] = useState('ETH');

  useEffect(() => {
    // Check if MetaMask is available or use local provider
    if (window.ethereum) {
      const provider = new ethers.BrowserProvider(window.ethereum);
      setProvider(provider);
      
      // Get chain symbol
      getCurrentChainSymbol(provider).then(symbol => {
        setNativeCurrencySymbol(symbol);
      });

      // Listen for account changes
      const handleAccountsChanged = async (accounts) => {
        if (accounts.length === 0) {
          // User disconnected
          disconnect();
        } else {
          // User switched accounts - only update if account actually changed
          try {
            const signer = await provider.getSigner();
            const address = await signer.getAddress();
            
            // Only update if the account actually changed
            if (address !== account) {
              setSigner(signer);
              setAccount(address);
              
              // Always create new factory contract with new signer
              const factoryContract = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);
              setFactory(factoryContract);
              setConnected(true);
              
              console.log('Account switched to:', address);
            }
          } catch (error) {
            console.error('Error handling account change:', error);
          }
        }
      };

      // Listen for chain changes
      const handleChainChanged = (chainId) => {
        // Reset connection state instead of reloading page
        console.log('Chain changed to:', chainId);
        
        // Update currency symbol for new chain
        getCurrentChainSymbol(provider).then(symbol => {
          setNativeCurrencySymbol(symbol);
        });
        
        disconnect();
        // Note: User will need to reconnect manually after chain change
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      // Cleanup listeners
      return () => {
        if (window.ethereum.removeListener) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
          window.ethereum.removeListener('chainChanged', handleChainChanged);
        }
      };
    } else {
      // Fallback to local Anvil node
      const provider = new ethers.JsonRpcProvider(getDefaultRpcUrl());
      setProvider(provider);
      
      // Get chain symbol for local provider
      getCurrentChainSymbol(provider).then(symbol => {
        setNativeCurrencySymbol(symbol);
      });
      
      // For development, auto-connect with a test account
      connectWithTestAccount(provider);
    }
  }, [account]);

  // Check IPFS availability on component mount
  useEffect(() => {
    console.log('🔍 Checking IPFS availability...');
    checkIPFSAvailability().then((available) => {
      console.log('🔍 IPFS availability result:', available);
      setIpfsAvailable(available);
    });
  }, []);


  const connectWithTestAccount = async (provider) => {
    try {
      // Use configured private key from active chain configuration
      const testPrivateKey = chainConfig.privateKey;
      if (!testPrivateKey) {
        throw new Error('No private key configured for active chain');
      }
      const wallet = new ethers.Wallet(testPrivateKey, provider);
      
      setSigner(wallet);
      setAccount(wallet.address);
      setConnected(true);
      
      const factoryContract = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, wallet);
      setFactory(factoryContract);
      
      console.log('Connected with test account:', wallet.address);
    } catch (error) {
      console.error('Error connecting with test account:', error);
    }
  };

  const connect = async () => {
    if (!provider) return;

    try {
      if (window.ethereum) {
        // Request account access
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        const signer = await provider.getSigner();
        const address = await signer.getAddress();
        
        setSigner(signer);
        setAccount(address);
        setConnected(true);
        
        const factoryContract = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, signer);
        setFactory(factoryContract);
        
        console.log('Connected to account:', address);
      } else {
        // Already connected with test account
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

  const createTree = async (rootContent) => {
    if (!factory || !signer) throw new Error('Not connected');

    try {
      console.log('Creating tree with content:', rootContent);
      
      // Calculate token supply using same logic as backend (characters / 4, minimum 1)
      const calculateTokenSupply = (content) => {
        if (!content) return 1;
        return Math.max(1, Math.floor(content.length / 4));
      };
      
      const rootTokenSupply = calculateTokenSupply(rootContent);
      console.log('Root token supply:', rootTokenSupply);
      
      // Use configured gas price for the transaction
      const gasOptions = {};
      if (chainConfig.gasPrice) {
        gasOptions.gasPrice = chainConfig.gasPrice;
        console.log('Using configured gas price:', chainConfig.gasPrice, 'wei');
      }
      
      const tx = await factory.createTree(rootContent, rootTokenSupply, '', signer.address, gasOptions); // modelId blank for manual root, use signer as creator
      const receipt = await tx.wait();
      
      // Report gas cost for tree creation via socket
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
      
      // Get the tree address from the event
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

  const getTree = useCallback(async (treeAddress) => {
    if (!signer) throw new Error('Not connected');

    try {
      console.log('Getting tree at address:', treeAddress);
      
      // Create fresh provider to ensure we get latest blockchain state
      const freshProvider = new ethers.JsonRpcProvider(getDefaultRpcUrl());
      const treeContract = new ethers.Contract(treeAddress, TREE_ABI, freshProvider);
      
      // Check node count first
      const nodeCount = await treeContract.getNodeCount();
      console.log('Contract reports node count:', nodeCount.toString());
      
      const rootId = await treeContract.getRootId();
      console.log('Root ID:', rootId);
      
      const allNodeIds = await treeContract.getAllNodes();
      console.log('getAllNodes() returned:', allNodeIds.length, 'node IDs');
      console.log('Expected:', nodeCount.toString(), 'Got:', allNodeIds.length);
      console.log('Node IDs:', allNodeIds.map(id => id.substring(0, 10) + '...'));
      
      // Get NFT contract address from the tree itself and create NFT contract instance BEFORE loading nodes
      const nftAddress = await treeContract.getNFTContract();
      const nftContract = new ethers.Contract(nftAddress, NFT_ABI, freshProvider);
      
      const nodes = [];
      for (let i = 0; i < allNodeIds.length; i++) {
        const nodeId = allNodeIds[i];
        try {
          console.log(`Loading node ${i + 1}/${allNodeIds.length}: ${nodeId.substring(0, 10)}...`);
          const nodeData = await treeContract.getNode(nodeId);
          
          // Fetch content from appropriate source based on node type
          let content = '';
          let hasNFT = false;
          try {
            // Check if node has NFT to determine content source
            hasNFT = await treeContract.nodeHasNFT(nodeId);
            
            if (hasNFT) {
              // Get content from NFT contract
              const nftContentData = await nftContract.getNodeContent(nodeId);
              // Parse JSON metadata to extract description (content)
              if (nftContentData) {
                try {
                  const metadata = JSON.parse(nftContentData);
                  content = metadata.description || '';
                } catch (parseError) {
                  // If parsing fails, use raw data
                  content = nftContentData;
                }
              }
            } else {
              // Get content directly from tree contract for lightweight nodes
              content = await treeContract.getNodeContent(nodeId);
            }
          } catch (contentError) {
            console.warn(`Could not fetch content for node ${nodeId}:`, contentError);
          }
          
          // Show loading placeholder for IPFS content initially, but store original
          let displayContent = content;
          let originalContent = content; // Keep original for IPFS resolution
          if (isIPFSReference(content)) {
            displayContent = "Loading IPFS content...";
          }
          
          const node = {
            nodeId: nodeData[0],
            parentId: nodeData[1],
            children: nodeData[2],
            author: nodeData[3],
            timestamp: Number(nodeData[4]),
            isRoot: nodeData[5],
            modelId: nodeData[6], // Model ID used to generate this node
            content: displayContent, // Show placeholder or resolved content
            originalContent: originalContent, // Store original IPFS hash
            hasNFT: hasNFT // Whether this node has NFT/tokens
          };
          console.log('✓ Loaded node:', {
            nodeId: node.nodeId.substring(0, 10) + '...',
            parentId: node.parentId.substring(0, 10) + '...',
            isRoot: node.isRoot,
            content: node.content.substring(0, 50) + '...',
            author: node.author.substring(0, 10) + '...'
          });
          nodes.push(node);
        } catch (error) {
          console.error(`✗ Failed to load node ${nodeId}:`, error);
        }
      }

      console.log('Total nodes loaded:', nodes.length);
      
      const result = {
        address: treeAddress,
        contract: treeContract,
        nftContract,
        nftAddress,
        rootId,
        nodes,
        nodeCount: nodes.length,
        rootContent: nodes.find(n => n.isRoot)?.content || ''
      };

      // IPFS resolution will be started by App component with proper state setters
      
      console.log('Tree result:', {
        address: result.address,
        nodeCount: result.nodeCount,
        rootContent: result.rootContent.substring(0, 30)
      });
      
      return result;
    } catch (error) {
      console.error('Error getting tree:', error);
      throw error;
    }
  }, [signer]);


  const updateNode = useCallback(async (treeAddress, nodeId, newContent) => {
    if (!signer) throw new Error('Not connected');

    try {
      const treeContract = new ethers.Contract(treeAddress, TREE_ABI, signer);
      // Use configured gas price for the transaction
      const gasOptions = {};
      if (chainConfig.gasPrice) {
        gasOptions.gasPrice = chainConfig.gasPrice;
        console.log('Using configured gas price for node update:', chainConfig.gasPrice, 'wei');
      }
      
      const tx = await treeContract.updateNodeContent(nodeId, newContent, gasOptions);
      const receipt = await tx.wait();
      
      // Report gas cost for direct node update via socket
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
  }, [signer]);

  const getUserTrees = useCallback(async () => {
    if (!factory || !account) return [];

    try {
      console.log('Getting trees for account:', account);
      const treeIds = await factory.getUserTrees(account);
      console.log('Found tree IDs:', treeIds.length, treeIds);
      
      const trees = await Promise.all(
        treeIds.map(async (treeId, index) => {
          console.log(`Processing tree ${index + 1}/${treeIds.length}, ID:`, treeId);
          const treeAddress = await factory.getTree(treeId);
          console.log(`Tree ${index + 1} address:`, treeAddress);
          return await getTree(treeAddress);
        })
      );
      
      console.log('Loaded trees:', trees.length);
      return trees;
    } catch (error) {
      console.error('Error getting user trees:', error);
      return [];
    }
  }, [factory, account, getTree]);

  const getAllTrees = useCallback(async () => {
    if (!factory) return [];

    try {
      console.log('Getting all trees from factory');
      const treeIds = await factory.getAllTrees();
      console.log('Found all tree IDs:', treeIds.length, treeIds);
      
      const trees = await Promise.all(
        treeIds.map(async (treeId, index) => {
          console.log(`Processing tree ${index + 1}/${treeIds.length}, ID:`, treeId);
          const treeAddress = await factory.getTree(treeId);
          console.log(`Tree ${index + 1} address:`, treeAddress);
          return await getTree(treeAddress);
        })
      );
      
      console.log('Loaded all trees:', trees.length);
      return trees;
    } catch (error) {
      console.error('Error getting all trees:', error);
      return [];
    }
  }, [factory, getTree]);

  const getNodeNFTInfo = useCallback(async (tree, nodeId) => {
    if (!tree.nftContract) return null;

    try {
      const tokenId = await tree.nftContract.getTokenIdFromNodeId(nodeId);
      if (tokenId.toString() === '0') return null;

      const owner = await tree.nftContract.ownerOf(tokenId);
      const tokenURI = await tree.nftContract.tokenURI(tokenId);
      const content = await tree.nftContract.getNodeContent(nodeId);
      
      return {
        tokenId: tokenId.toString(),
        owner,
        tokenURI,
        content,
        nodeId
      };
    } catch (error) {
      console.error('Error getting NFT info:', error);
      return null;
    }
  }, []);

  const cycleStorageMode = () => {
    const modes = ipfsAvailable ? ['full', 'lightweight', 'ipfs'] : ['full', 'lightweight'];
    const currentIndex = modes.indexOf(storageMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    const newMode = modes[nextIndex];
    setStorageMode(newMode);
    console.log('Storage mode changed to:', newMode);
  };

  const checkNodeHasNFT = async (treeAddress, nodeId) => {
    if (!signer) throw new Error('Not connected');
    
    // Validate inputs
    if (!treeAddress || !nodeId || nodeId === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      return false;
    }

    try {
      // Use fresh provider to ensure we get latest blockchain state
      const freshProvider = new ethers.JsonRpcProvider(getDefaultRpcUrl());
      const treeContract = new ethers.Contract(treeAddress, TREE_ABI, freshProvider);
      const hasNFT = await treeContract.nodeHasNFT(nodeId);
      return hasNFT;
    } catch (error) {
      console.error('Error checking if node has NFT:', error);
      return false; // Assume no NFT on error
    }
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
    // Global IPFS resolver utilities
    getIPFSQueueStatus: () => globalIPFSResolver.getStatus(),
    cancelTreeIPFSResolution: (treeAddress) => globalIPFSResolver.cancelTreeResolution(treeAddress)
  };
};