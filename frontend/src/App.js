import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ethers } from 'ethers';
import io from 'socket.io-client';
import LoomGraph from './components/LoomGraph';
import RightSidebar from './components/RightSidebar';
import LeftSidebar from './components/LeftSidebar';
import { useBlockchain } from './hooks/useBlockchain';
import { createSocketHandlers } from './utils/socketHandlers';
import { createGenerationHandler } from './utils/generationUtils';
import { createNodeHandlers } from './utils/nodeUtils';
import { createImportHandler } from './utils/importUtils';
import { createMemoryHandlers } from './utils/memoryUtils';
import { createNotificationSystem } from './utils/notificationUtils';
import { getActiveChainConfig } from './utils/chainConfig';
import modelsConfig from './config/models.json';
import './App.css';

function App() {
  const graphRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [selectedNodeNFT, setSelectedNodeNFT] = useState(null);
  const [trees, setTrees] = useState([]);
  const [currentTree, setCurrentTree] = useState(null);
  const [isLoadingTrees, setIsLoadingTrees] = useState(false);
  const [isGeneratingChildren, setIsGeneratingChildren] = useState(false);
  const [isGeneratingSiblings, setIsGeneratingSiblings] = useState(false);
  const [selectedModel, setSelectedModel] = useState(modelsConfig.defaultModel);
  const [notifications, setNotifications] = useState([]);
  const [treeNodeMemory, setTreeNodeMemory] = useState(new Map()); // Store last selected node for each tree
  
  // Mobile responsiveness state
  const [isMobile, setIsMobile] = useState(false);
  const [leftSidebarVisible, setLeftSidebarVisible] = useState(false);
  const [rightSidebarVisible, setRightSidebarVisible] = useState(false);
  
  const {
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
    startIPFSResolution,
    useIPFSRetrieval,
    setUseIPFSRetrieval,
    nativeCurrencySymbol
  } = useBlockchain(socket);

  useEffect(() => {
    // Log active chain configuration on startup
    const chainConfig = getActiveChainConfig();
    console.log('🔗 Active Chain Configuration:');
    console.log(`   Chain ID: ${chainConfig.chainId}`);
    console.log(`   Chain Name: ${chainConfig.name}`);
    console.log(`   RPC URL: ${chainConfig.rpcUrl}`);
    console.log(`   Factory Address: ${chainConfig.factoryAddress}`);
    console.log(`   Explorer URL: ${chainConfig.explorerUrl || 'Not configured'}`);
    
    // Initialize socket connection
    const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3001';
    const newSocket = io(backendUrl);
    setSocket(newSocket);

    return () => newSocket.close();
  }, []);

  // Initialize notification system
  const { addNotification, removeNotification } = createNotificationSystem(setNotifications);

  // Initialize socket handlers
  const socketHandlers = createSocketHandlers(
    socket,
    currentTree,
    setCurrentTree,
    setTrees,
    setIsGeneratingChildren,
    setIsGeneratingSiblings,
    addNotification,
    graphRef,
    getTree
  );

  // Handle socket events that depend on currentTree
  useEffect(() => {
    if (!socket) {
      return;
    }

    socket.on('treeCreated', socketHandlers.handleTreeCreated);
    socket.on('nodeCreated', socketHandlers.handleNodeCreated);
    socket.on('generationComplete', socketHandlers.handleGenerationComplete);

    return () => {
      socket.off('treeCreated', socketHandlers.handleTreeCreated);
      socket.off('nodeCreated', socketHandlers.handleNodeCreated);
      socket.off('generationComplete', socketHandlers.handleGenerationComplete);
    };
  }, [socket, currentTree?.address, getTree, addNotification, socketHandlers]);

  // Load existing trees when user connects
  useEffect(() => {
    const loadExistingTrees = async () => {
      if (connected && getAllTrees) {
        try {
          console.log('Loading all trees');
          setIsLoadingTrees(true);
          const allTrees = await getAllTrees();
          console.log('Found all trees:', allTrees);
          setTrees(allTrees);
          
          // If no current tree is selected and we have trees, select the first one
          if (allTrees.length > 0 && !currentTree) {
            console.log('Setting current tree to first tree:', allTrees[0]);
            handleTreeSelect(allTrees[0]);
          }
        } catch (error) {
          console.error('Error loading existing trees:', error);
        } finally {
          setIsLoadingTrees(false);
        }
      }
    };

    loadExistingTrees();
  }, [connected, getAllTrees]);

  const handleCreateTree = async (rootContent) => {
    try {
      console.log('Creating tree with content:', rootContent);
      const treeAddress = await createTree(rootContent);
      console.log('Tree created at address:', treeAddress);
      
      // Wait a moment for the blockchain transaction to propagate
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      try {
        // Immediately fetch the full tree data and add to UI
        console.log('Fetching full tree data for immediate UI update');
        const fullTree = await getTree(treeAddress);
        console.log('Full tree data loaded:', fullTree);
        
        // Add to trees list immediately
        setTrees(prev => {
          const exists = prev.some(tree => tree.address === treeAddress);
          if (exists) {
            console.log('Tree already exists in list, skipping duplicate');
            return prev;
          }
          console.log('Adding new tree to sidebar');
          return [...prev, fullTree];
        });
        
        // Set as current tree and trigger root selection
        handleTreeSelect(fullTree);
        console.log('Tree creation and UI update complete');
      } catch (treeError) {
        console.error('Error fetching tree after creation:', treeError);
        
        // Fallback: add basic tree info immediately
        const basicTree = {
          address: treeAddress,
          rootContent: rootContent,
          nodeCount: 1,
          nodes: [],
          nftContract: null,
          nftAddress: null
        };
        
        setTrees(prev => {
          const exists = prev.some(tree => tree.address === treeAddress);
          if (!exists) {
            return [...prev, basicTree];
          }
          return prev;
        });
        handleTreeSelect(basicTree);
      }
      
      // Socket event is still useful for other clients or as backup
    } catch (error) {
      console.error('Error creating tree:', error);
      throw error; // Re-throw so UI can show error state
    }
  };

  // Initialize memory handlers
  const memoryHandlers = createMemoryHandlers(
    treeNodeMemory,
    setTreeNodeMemory,
    setSelectedNode,
    setCurrentTree,
    graphRef
  );

  const handleNodeSelect = useCallback((node) => {
    if (node === null) {
      // Handle deselection - clear the selected node state
      setSelectedNode(null);
      setSelectedNodeNFT(null);
    } else {
      // Handle selection - use existing memory handler
      memoryHandlers.handleNodeSelect(node, currentTree);
    }
  }, [currentTree, memoryHandlers]);

  // Fetch NFT information when a node is selected
  useEffect(() => {
    const fetchNodeNFT = async () => {
      if (selectedNode && currentTree && getNodeNFTInfo) {
        try {
          const nftInfo = await getNodeNFTInfo(currentTree, selectedNode.id);
          setSelectedNodeNFT(nftInfo);
        } catch (error) {
          console.error('Error fetching NFT info:', error);
          setSelectedNodeNFT(null);
        }
      } else {
        setSelectedNodeNFT(null);
      }
    };

    fetchNodeNFT();
  }, [selectedNode, currentTree, getNodeNFTInfo]);

  // Initialize node handlers
  const nodeHandlers = createNodeHandlers(
    currentTree,
    socket,
    getTree,
    setCurrentTree,
    setTrees,
    graphRef,
    setIsLoadingTrees
  );

  const handleAddNode = useCallback(async (parentId, content) => {
    return nodeHandlers.handleAddNode(parentId, content, selectedModel);
  }, [nodeHandlers, selectedModel]);

  const handleUpdateNode = useCallback(async (treeAddress, nodeId, newContent, options) => {
    return nodeHandlers.handleUpdateNode(treeAddress, nodeId, newContent, options, selectedNode?.modelId || '');
  }, [nodeHandlers, selectedNode]);

  // Initialize generation handlers
  const generationHandler = createGenerationHandler(
    socket,
    currentTree,
    account,
    selectedModel,
    modelsConfig,
    storageMode,
    setIsGeneratingChildren,
    setIsGeneratingSiblings,
    addNotification
  );

  const handleGenerateSiblings = useCallback((parentId, count = 3) => {
    return generationHandler.generateNodes(parentId, count);
  }, [generationHandler]);

  // Handle tree selection with node memory
  const handleTreeSelect = useCallback((newTree) => {
    memoryHandlers.handleTreeSelect(newTree, currentTree, selectedNode);
    
    // Start IPFS resolution for the new tree
    if (newTree && startIPFSResolution) {
      startIPFSResolution(newTree, setCurrentTree, setTrees);
    }
  }, [currentTree, selectedNode, memoryHandlers, startIPFSResolution]);

  // Handle model selection change
  const handleModelChange = useCallback((newModel) => {
    setSelectedModel(newModel);
    console.log('🤖 Model changed to:', newModel);
  }, []);

  // Initialize import handlers
  const importHandler = createImportHandler(
    socket,
    createTree,
    getTree,
    setTrees,
    setCurrentTree,
    currentTree,
    account
  );

  const handleImportTrees = useCallback(async (importData) => {
    return importHandler.handleImportTrees(importData);
  }, [importHandler]);

  // Mobile detection and handlers
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Mobile sidebar handlers
  const toggleLeftSidebar = () => {
    setLeftSidebarVisible(prev => {
      const newValue = !prev;
      if (newValue) {
        // If opening left, close right
        setRightSidebarVisible(false);
      }
      return newValue;
    });
  };

  const toggleRightSidebar = () => {
    setRightSidebarVisible(prev => {
      const newValue = !prev;
      if (newValue) {
        // If opening right, close left
        setLeftSidebarVisible(false);
      }
      return newValue;
    });
  };

  const closeMobileSidebars = () => {
    setLeftSidebarVisible(false);
    setRightSidebarVisible(false);
  };

  // Mobile connect handler
  const handleMobileConnect = () => {
    connect();
  };

  // Mobile disconnect handler
  const handleMobileDisconnect = () => {
    disconnect();
    // Close sidebars immediately when disconnecting on mobile
    if (isMobile) {
      closeMobileSidebars();
    }
  };

  return (
    <div className="app-container">
      <RightSidebar
        className={`right-sidebar ${isMobile && rightSidebarVisible ? 'mobile-active' : ''}`}
        connected={connected}
        account={account}
        onConnect={connect}
        onDisconnect={handleMobileDisconnect}
        onCreateTree={handleCreateTree}
        trees={trees}
        currentTree={currentTree}
        onSelectTree={handleTreeSelect}
        selectedNode={selectedNode}
        selectedNodeNFT={selectedNodeNFT}
        onGenerateSiblings={handleGenerateSiblings}
        onImportTrees={handleImportTrees}
        getAllTrees={getAllTrees}
        setTrees={setTrees}
        setCurrentTree={setCurrentTree}
        setIsLoadingTrees={setIsLoadingTrees}
        isGeneratingChildren={isGeneratingChildren}
        setIsGeneratingChildren={setIsGeneratingChildren}
        isGeneratingSiblings={isGeneratingSiblings}
        setIsGeneratingSiblings={setIsGeneratingSiblings}
        onModelChange={handleModelChange}
        checkNodeHasNFT={checkNodeHasNFT}
        storageMode={storageMode}
        cycleStorageMode={cycleStorageMode}
        ipfsAvailable={ipfsAvailable}
        nativeCurrencySymbol={nativeCurrencySymbol}
        socket={socket}
      />
      
      {/* Notifications */}
      {notifications.length > 0 && (
        <div style={{
          position: 'fixed',
          left: '50%',
          bottom: '24px',
          transform: 'translateX(-50%)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px'
        }}>
          {notifications.map(notification => (
            <div
              key={notification.id}
              style={{
                background: '#2a2a2a',
                border: `2px solid ${
                  notification.type === 'error' ? '#ff4444' : 
                  notification.type === 'warning' ? '#ff8800' : 
                  notification.type === 'success' ? '#4CAF50' : '#4488ff'
                }`,
                color: '#e0e0e0',
                padding: '12px 18px',
                borderRadius: '8px',
                maxWidth: '480px',
                fontSize: '14px',
                fontFamily: "'Inconsolata', monospace",
                letterSpacing: '0.3px',
                boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
                cursor: 'pointer',
                transition: 'all 0.3s ease'
              }}
              onClick={() => removeNotification(notification.id)}
            >
              {notification.message}
            </div>
          ))}
        </div>
      )}
      
      <div className="graph-container">
        {isLoadingTrees && (
          <div className="graph-loading-overlay">
            <div className="graph-loading-text gen-fade">Loading trees…</div>
          </div>
        )}
        <LoomGraph
          ref={graphRef}
          currentTree={currentTree}
          onNodeSelect={handleNodeSelect}
          onAddNode={handleAddNode}
          onUpdateNode={handleUpdateNode}
          onGenerateSiblings={handleGenerateSiblings}
          onCreateTree={handleCreateTree}
          isGeneratingChildren={isGeneratingChildren}
          setIsGeneratingChildren={setIsGeneratingChildren}
          isGeneratingSiblings={isGeneratingSiblings}
          setIsGeneratingSiblings={setIsGeneratingSiblings}
          storageMode={storageMode}
        />
      </div>
      
      <LeftSidebar
        className={`left-sidebar ${isMobile && leftSidebarVisible ? 'mobile-active' : ''}`}
        currentTree={currentTree}
        selectedNode={selectedNode}
        isGeneratingChildren={isGeneratingChildren}
        isGeneratingSiblings={isGeneratingSiblings}
        selectedModel={selectedModel}
      />

      {/* Mobile floating buttons */}
      {isMobile && (
        <>
          {/* Floating connect wallet button (only show when disconnected) */}
          {!connected && (
            <button
              className="mobile-connect-wallet"
              onClick={handleMobileConnect}
            >
              Connect Wallet
            </button>
          )}

          {/* Mobile tab buttons (only show when connected) */}
          {connected && (
            <>
              <button
                className={`mobile-tab-button left ${leftSidebarVisible ? 'active' : ''}`.trim()}
                onClick={toggleLeftSidebar}
                aria-label="Toggle left sidebar"
              >
                {leftSidebarVisible ? 'X' : 'L'}
              </button>
              <button
                className={`mobile-tab-button right ${rightSidebarVisible ? 'active' : ''}`.trim()}
                onClick={toggleRightSidebar}
                aria-label="Toggle right sidebar"
              >
                {rightSidebarVisible ? 'X' : 'R'}
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}

export default App;