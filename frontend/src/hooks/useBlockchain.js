import { useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';

// Contract ABI - in a real app, you'd import this from generated files
const FACTORY_ABI = [
  "function createTree(string memory rootContent) external returns (address)",
  "function getTree(bytes32 treeId) external view returns (address)",
  "function getUserTrees(address user) external view returns (bytes32[] memory)",
  "function getAllTrees() external view returns (bytes32[] memory)",
  "event TreeCreated(bytes32 indexed treeId, address indexed treeAddress, address indexed creator, string rootContent)"
];

const TREE_ABI = [
  "function addNode(bytes32 parentId, string memory content) external returns (bytes32)",
  "function getNode(bytes32 nodeId) external view returns (bytes32 id, bytes32 parentId, string memory content, bytes32[] memory children, address author, uint256 timestamp, bool isRoot)",
  "function getAllNodes() external view returns (bytes32[] memory)",
  "function getRootId() external view returns (bytes32)",
  "function getNodeCount() external view returns (uint256)",
  "event NodeCreated(bytes32 indexed nodeId, bytes32 indexed parentId, string content, address indexed author, uint256 timestamp)"
];

// Replace with your deployed factory address
const FACTORY_ADDRESS = process.env.REACT_APP_FACTORY_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3";

export const useBlockchain = () => {
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [factory, setFactory] = useState(null);
  const [connected, setConnected] = useState(false);
  const [account, setAccount] = useState(null);

  useEffect(() => {
    // Check if MetaMask is available or use local provider
    if (window.ethereum) {
      const provider = new ethers.BrowserProvider(window.ethereum);
      setProvider(provider);

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
      const provider = new ethers.JsonRpcProvider('http://localhost:8545');
      setProvider(provider);
      
      // For development, auto-connect with a test account
      connectWithTestAccount(provider);
    }
  }, [account]);

  const connectWithTestAccount = async (provider) => {
    try {
      // Use one of Anvil's test private keys
      const testPrivateKey = 'REDACTED_PRIVATE_KEY';
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
      const tx = await factory.createTree(rootContent);
      const receipt = await tx.wait();
      
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
      
      // Use existing provider instead of creating fresh one
      const treeContract = new ethers.Contract(treeAddress, TREE_ABI, provider);
      
      // Check node count first
      const nodeCount = await treeContract.getNodeCount();
      console.log('Contract reports node count:', nodeCount.toString());
      
      const rootId = await treeContract.getRootId();
      console.log('Root ID:', rootId);
      
      const allNodeIds = await treeContract.getAllNodes();
      console.log('getAllNodes() returned:', allNodeIds.length, 'node IDs');
      console.log('Node IDs:', allNodeIds);
      
      const nodes = await Promise.all(
        allNodeIds.map(async (nodeId) => {
          const nodeData = await treeContract.getNode(nodeId);
          const node = {
            nodeId: nodeData[0],
            parentId: nodeData[1],
            content: nodeData[2],
            children: nodeData[3],
            author: nodeData[4],
            timestamp: Number(nodeData[5]),
            isRoot: nodeData[6]
          };
          console.log('Loaded node:', {
            nodeId: node.nodeId,
            parentId: node.parentId,
            isRoot: node.isRoot,
            content: node.content.substring(0, 50) + '...',
            author: node.author
          });
          return node;
        })
      );

      console.log('Total nodes loaded:', nodes.length);
      const result = {
        address: treeAddress,
        contract: treeContract,
        rootId,
        nodes,
        nodeCount: nodes.length,
        rootContent: nodes.find(n => n.isRoot)?.content || ''
      };
      
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
  }, [signer, provider]);

  const addNode = async (treeAddress, parentId, content) => {
    if (!signer) throw new Error('Not connected');

    try {
      const treeContract = new ethers.Contract(treeAddress, TREE_ABI, signer);
      console.log('Adding node to tree:', treeAddress, 'parent:', parentId, 'content:', content);
      
      const tx = await treeContract.addNode(parentId, content);
      const receipt = await tx.wait();
      
      console.log('Node added, transaction:', receipt.hash);
      return receipt;
    } catch (error) {
      console.error('Error adding node:', error);
      throw error;
    }
  };

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
    addNode,
    getUserTrees
  };
};