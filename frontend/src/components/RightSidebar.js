import React, { useState, useEffect } from 'react';
import KeyboardShortcutsManager from '../utils/keyboardShortcuts';
import { refreshTrees } from '../utils/treeUtils';
import { getNodeTokenBalance } from '../utils/tokenUtils';
import { parseNFTMetadata, formatTokenSupply } from '../utils/nftUtils';
import { getEnvironmentConfig } from '../utils/envConfig';
import modelsConfig from '../config/models.json';

// Import subcomponents
import SidebarHeader from './sidebar/SidebarHeader';
import ModelSelector from './sidebar/ModelSelector';
import SelectedNodeInfo from './sidebar/SelectedNodeInfo';
import AIGenerationControls from './sidebar/AIGenerationControls';
import TreeCreationForm from './sidebar/TreeCreationForm';
import TreeList from './sidebar/TreeList';
import BackupRestore from './sidebar/BackupRestore';
import KeyboardShortcuts from './sidebar/KeyboardShortcuts';
import Instructions from './sidebar/Instructions';
import GasTrackerModal from './sidebar/GasTrackerModal';

const RightSidebar = ({
  className,
  connected,
  account,
  storageMode,
  onConnect,
  onDisconnect,
  onCreateTree,
  trees,
  currentTree,
  onSelectTree,
  selectedNode,
  selectedNodeNFT,
  onGenerateSiblings,
  onImportTrees,
  getAllTrees,
  setTrees,
  setCurrentTree,
  setIsLoadingTrees,
  isGeneratingChildren,
  setIsGeneratingChildren,
  isGeneratingSiblings,
  setIsGeneratingSiblings,
  onModelChange,
  checkNodeHasNFT,
  cycleStorageMode,
  ipfsAvailable,
  nativeCurrencySymbol = 'ETH',
  socket,
  childrenCount,
  setChildrenCount,
  siblingCount,
  setSiblingCount
}) => {
  const [newTreeContent, setNewTreeContent] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isCreatingTree, setIsCreatingTree] = useState(false);
  const [showOnlyMyTrees, setShowOnlyMyTrees] = useState(false);
  const [selectedModel, setSelectedModel] = useState(modelsConfig.defaultModel);
  const [availableModels, setAvailableModels] = useState([]);
  const [currentTokenBalance, setCurrentTokenBalance] = useState(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [nodeHasNFT, setNodeHasNFT] = useState(false);
  const [isCheckingNFT, setIsCheckingNFT] = useState(false);
  const [gasTransactions, setGasTransactions] = useState([]);
  const [totalGasCost, setTotalGasCost] = useState(0);
  const [showGasModal, setShowGasModal] = useState(false);
  
  // Initialize keyboard shortcuts manager
  const shortcutsManager = new KeyboardShortcutsManager();

  // Load gas transactions from localStorage when account changes
  useEffect(() => {
    if (!account) {
      // No account connected, clear transactions
      setGasTransactions([]);
      setTotalGasCost(0);
      return;
    }

    const storageKey = `gasTransactions_${account.toLowerCase()}`;
    const storedTransactions = localStorage.getItem(storageKey);
    if (storedTransactions) {
      try {
        const transactions = JSON.parse(storedTransactions);
        setGasTransactions(transactions);
        const total = transactions.reduce((sum, tx) => sum + parseFloat(tx.gasCost), 0);
        setTotalGasCost(total);
      } catch (error) {
        console.error('Error loading gas transactions from localStorage:', error);
        setGasTransactions([]);
        setTotalGasCost(0);
      }
    } else {
      // No stored transactions for this account
      setGasTransactions([]);
      setTotalGasCost(0);
    }
  }, [account]);

  // Function to add a new gas transaction
  const addGasTransaction = (transaction) => {
    if (!account) return; // Don't add transactions if no account is connected

    const newTransaction = {
      ...transaction,
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      account: account.toLowerCase() // Store which account made this transaction
    };
    
    setGasTransactions(prev => {
      const updated = [...prev, newTransaction];
      const storageKey = `gasTransactions_${account.toLowerCase()}`;
      localStorage.setItem(storageKey, JSON.stringify(updated));
      return updated;
    });
    
    setTotalGasCost(prev => prev + parseFloat(transaction.gasCost));
  };

  // Function to clear all gas transactions for current account
  const clearGasTransactions = () => {
    if (!account) return; // Don't clear if no account is connected

    setGasTransactions([]);
    setTotalGasCost(0);
    const storageKey = `gasTransactions_${account.toLowerCase()}`;
    localStorage.removeItem(storageKey);
  };

  // Fetch available models from backend
  useEffect(() => {
    const fetchModels = async () => {
      try {
        const { backendUrl } = getEnvironmentConfig();
        const response = await fetch(`${backendUrl}/api/models`);
        if (response.ok) {
          const data = await response.json();
          setAvailableModels(data.models || []);
        } else {
          // Fallback to config models if backend unavailable
          const configModels = Object.keys(modelsConfig.models).map(id => ({
            id,
            name: modelsConfig.models[id].name,
            provider: modelsConfig.models[id].provider,
            modelId: modelsConfig.models[id].modelId,
            available: false // Unknown availability
          }));
          setAvailableModels(configModels);
        }
      } catch (error) {
        console.error('Error fetching models:', error);
        // Fallback to config models
        const configModels = Object.keys(modelsConfig.models).map(id => ({
          id,
          name: modelsConfig.models[id].name,
          provider: modelsConfig.models[id].provider,
          modelId: modelsConfig.models[id].modelId,
          available: false
        }));
        setAvailableModels(configModels);
      }
    };

    fetchModels();
  }, []);

  // Notify parent component when model changes
  useEffect(() => {
    if (onModelChange) {
      onModelChange(selectedModel);
    }
  }, [selectedModel, onModelChange]);

  // Check if node has NFT using GraphQL hasNFT flag
  useEffect(() => {
    if (!selectedNode?.id || !connected) {
      setNodeHasNFT(false);
      setCurrentTokenBalance(null);
      setIsCheckingNFT(false);
      return;
    }

    // Skip if node ID is invalid
    if (selectedNode.id === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      setNodeHasNFT(false);
      setCurrentTokenBalance(null);
      setIsCheckingNFT(false);
      return;
    }

    setIsCheckingNFT(true);
    
    // Use hasNFT flag directly from GraphQL data (NodeCreated event)
    const hasNFT = selectedNode.hasNFT || false;
    console.log('🔍 RightSidebar: Setting nodeHasNFT for node', selectedNode.id.substring(0, 10) + '...:', {
      hasNFT: hasNFT,
      selectedNodeHasNFT: selectedNode.hasNFT,
      selectedNodeNFT: !!selectedNodeNFT,
      tokenBoundAccount: selectedNode.tokenBoundAccount,
      nodeTokenContract: selectedNode.nodeTokenContract
    });
    setNodeHasNFT(hasNFT);
    
    // Only fetch token balance if node has NFT
    if (hasNFT && socket) {
      setIsLoadingBalance(true);
      socket.emit('getTokenBalance', {
        treeAddress: currentTree?.address,
        nodeId: selectedNode.id
      });
    } else {
      setCurrentTokenBalance(null);
      setIsLoadingBalance(false);
    }
    
    setIsCheckingNFT(false);
  }, [selectedNode?.id, selectedNode?.hasNFT, connected, socket, currentTree?.address]);

  // Set up socket listeners for token balance updates
  useEffect(() => {
    if (!socket) return;

    const handleTokenBalance = (data) => {
      if (data.nodeId === selectedNode?.id) {
        setCurrentTokenBalance(data.balance);
        setIsLoadingBalance(false);
      }
    };

    const handleTokenBalanceUpdate = (data) => {
      if (data.nodeId === selectedNode?.id) {
        setCurrentTokenBalance(data.balance);
        console.log(`Token balance updated for node ${data.nodeId}: ${data.balance}`);
      }
    };

    const handleTokenBalanceError = (data) => {
      if (selectedNode?.id) {
        console.log('Token balance error:', data.error);
        setCurrentTokenBalance(null);
        setIsLoadingBalance(false);
      }
    };

    socket.on('tokenBalance', handleTokenBalance);
    socket.on('tokenBalanceUpdate', handleTokenBalanceUpdate);
    socket.on('tokenBalanceError', handleTokenBalanceError);

    // Gas cost listeners
    const handleGasCost = (data) => {
      addGasTransaction({
        type: data.type,
        txHash: data.txHash,
        gasCost: data.gasCost,
        gasUsed: data.gasUsed,
        gasPrice: data.gasPrice,
        description: data.description
      });
      console.log(`Gas cost tracked: ${data.type} - ${data.gasCost} ${nativeCurrencySymbol}`);
    };
    
    socket.on('gasCost', handleGasCost);

    return () => {
      socket.off('tokenBalance', handleTokenBalance);
      socket.off('tokenBalanceUpdate', handleTokenBalanceUpdate);
      socket.off('tokenBalanceError', handleTokenBalanceError);
      socket.off('gasCost', handleGasCost);
    };
  }, [socket, selectedNode?.id]);

  // Handle ESC key for gas modal with highest priority
  useEffect(() => {
    const handleGasModalClose = (e) => {
      if (showGasModal && shortcutsManager.matchShortcut(e, 'deselect')) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation(); // Stop ALL other event handlers
        setShowGasModal(false);
      }
    };

    if (showGasModal) {
      // Add listener with capture: true to handle it BEFORE other listeners
      document.addEventListener('keydown', handleGasModalClose, { capture: true });
      return () => {
        document.removeEventListener('keydown', handleGasModalClose, { capture: true });
      };
    }
  }, [showGasModal]);

  // Handle keyboard shortcuts for model and tree navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't interfere if user is typing in an input field
      if (shortcutsManager.isTypingInInput()) {
        return;
      }

      // Don't allow changes during generation
      const isGenerating = isGeneratingChildren || isGeneratingSiblings;
      if (isGenerating) {
        return;
      }

      // Handle model navigation shortcuts
      if (shortcutsManager.matchShortcut(e, 'previousModel')) {
        e.preventDefault();
        const currentIndex = availableModels.findIndex(model => model.id === selectedModel);
        if (currentIndex > 0) {
          const newModel = availableModels[currentIndex - 1];
          if (newModel.available !== false) {
            setSelectedModel(newModel.id);
          }
        }
        return;
      }

      if (shortcutsManager.matchShortcut(e, 'nextModel')) {
        e.preventDefault();
        const currentIndex = availableModels.findIndex(model => model.id === selectedModel);
        if (currentIndex < availableModels.length - 1) {
          const newModel = availableModels[currentIndex + 1];
          if (newModel.available !== false) {
            setSelectedModel(newModel.id);
          }
        }
        return;
      }

      // Handle tree navigation shortcuts
      if (shortcutsManager.matchShortcut(e, 'previousTree')) {
        e.preventDefault();
        const filteredTrees = getFilteredTrees();
        const currentIndex = filteredTrees.findIndex(tree => tree.address === currentTree?.address);
        if (currentIndex > 0) {
          console.log('⌨️ Keyboard: Switching to previous tree');
          onSelectTree(filteredTrees[currentIndex - 1]);
        }
        return;
      }

      if (shortcutsManager.matchShortcut(e, 'nextTree')) {
        e.preventDefault();
        const filteredTrees = getFilteredTrees();
        const currentIndex = filteredTrees.findIndex(tree => tree.address === currentTree?.address);
        if (currentIndex < filteredTrees.length - 1) {
          console.log('⌨️ Keyboard: Switching to next tree');
          onSelectTree(filteredTrees[currentIndex + 1]);
        }
        return;
      }

      // Handle gas tracker modal shortcut
      if (shortcutsManager.matchShortcut(e, 'gasTracker')) {
        e.preventDefault();
        setShowGasModal(prev => !prev);
        return;
      }

      // Handle storage mode cycling shortcut
      if (shortcutsManager.matchShortcut(e, 'lightweightMode')) {
        e.preventDefault();
        cycleStorageMode();
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedModel, availableModels, currentTree, trees, showOnlyMyTrees, account, onSelectTree, isGeneratingChildren, isGeneratingSiblings]);

  // Helper function to get filtered trees (same logic as in render)
  const getFilteredTrees = () => {
    return trees.filter(tree => {
      if (showOnlyMyTrees && account) {
        return tree.creator && tree.creator.toLowerCase() === account.toLowerCase();
      }
      return true;
    });
  };

  const ellipseAddress = (address) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const copyToClipboard = async (address) => {
    try {
      await navigator.clipboard.writeText(address);
      // Could add a toast notification here if desired
    } catch (err) {
      console.error('Failed to copy address:', err);
    }
  };

  const handleCreateTree = async () => {
    if (newTreeContent.trim()) {
      setIsCreatingTree(true);
      try {
        await onCreateTree(newTreeContent.trim());
        setNewTreeContent('');
      } catch (error) {
        console.error('Failed to create tree:', error);
        alert('Failed to create tree: ' + error.message);
      } finally {
        setIsCreatingTree(false);
      }
    }
  };

  const handleGenerateChildren = async () => {
    if (selectedNode && selectedNode.id && !isGeneratingChildren && !isGeneratingSiblings) {
      setIsGeneratingChildren(true);
      try {
        await onGenerateSiblings(selectedNode.id, childrenCount);
      } finally {
        setIsGeneratingChildren(false);
      }
    }
  };

  const handleGenerateSiblings = async () => {
    if (selectedNode && selectedNode.id && selectedNode.parentId && !isGeneratingChildren && !isGeneratingSiblings) {
      console.log('🎯 Starting sibling generation...');
      setIsGeneratingSiblings(true);
      
      // Add a safety timeout to reset state if promise doesn't resolve
      const timeoutId = setTimeout(() => {
        console.log('🎯 Generation timeout - forcing state reset');
        setIsGeneratingSiblings(false);
      }, 30000); // 30 second timeout
      
      try {
        // Generate siblings by using the parent ID
        const result = await onGenerateSiblings(selectedNode.parentId, siblingCount);
        console.log('🎯 Generation completed:', result);
      } catch (error) {
        console.error('🎯 Generation failed:', error);
      } finally {
        console.log('🎯 Resetting generation state...');
        clearTimeout(timeoutId);
        setIsGeneratingSiblings(false);
      }
    }
  };

  const handleExportTrees = async () => {
    if (!trees || trees.length === 0) {
      alert('No trees to export');
      return;
    }

    setIsExporting(true);
    try {
      // Create export data with tree structure and metadata
      const exportData = {
        version: '1.0',
        exportDate: new Date().toISOString(),
        account: account,
        trees: trees.map(tree => ({
          address: tree.address,
          rootContent: tree.rootContent,
          nodeCount: tree.nodeCount,
          nodes: tree.nodes.map(node => ({
            nodeId: node.nodeId,
            parentId: node.parentId,
            content: node.content,
            author: node.author,
            timestamp: node.timestamp,
            isRoot: node.isRoot
          }))
        }))
      };

      // Create downloadable JSON file
      const dataStr = JSON.stringify(exportData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `loom-trees-${account?.slice(0, 8)}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      alert(`Successfully exported ${trees.length} trees to JSON file`);
    } catch (error) {
      console.error('Error exporting trees:', error);
      alert('Failed to export trees: ' + error.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportTrees = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (event) => {
      const file = event.target.files[0];
      if (!file) return;

      setIsImporting(true);
      try {
        const text = await file.text();
        const importData = JSON.parse(text);

        // Validate import data structure
        if (!importData.version || !importData.trees || !Array.isArray(importData.trees)) {
          throw new Error('Invalid import file format');
        }

        // Ask user for confirmation
        const confirmMessage = `This will recreate ${importData.trees.length} trees with all their nodes on the blockchain. This action cannot be undone and will cost gas. Continue?`;
        if (!window.confirm(confirmMessage)) {
          return;
        }

        // Use the parent component's import function
        if (onImportTrees) {
          await onImportTrees(importData);
          alert(`Successfully imported ${importData.trees.length} trees to the blockchain!`);
        } else {
          throw new Error('Import function not available');
        }
      } catch (error) {
        console.error('Error importing trees:', error);
        alert('Failed to import trees: ' + error.message);
      } finally {
        setIsImporting(false);
      }
    };
    input.click();
  };

  return (
    <div className={className || "right-sidebar"}>
      {/* Header Section - Using subcomponent */}
      <SidebarHeader
        connected={connected}
        account={account}
        onConnect={onConnect}
        onDisconnect={onDisconnect}
        totalGasCost={totalGasCost}
        nativeCurrencySymbol={nativeCurrencySymbol}
        storageMode={storageMode}
        setShowGasModal={setShowGasModal}
      />

      {/* AI Model Selector - Using subcomponent */}
      <ModelSelector
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        availableModels={availableModels}
        isGeneratingChildren={isGeneratingChildren}
        isGeneratingSiblings={isGeneratingSiblings}
      />

      {/* Selected Node Info - Using subcomponent */}
      <SelectedNodeInfo
        selectedNode={selectedNode}
        selectedNodeNFT={selectedNodeNFT}
        nodeHasNFT={nodeHasNFT}
        currentTree={currentTree}
        currentTokenBalance={currentTokenBalance}
        isLoadingBalance={isLoadingBalance}
      />

      {/* AI Generation Controls - Using subcomponent */}
      <AIGenerationControls
        selectedNode={selectedNode}
        connected={connected}
        childrenCount={childrenCount}
        setChildrenCount={setChildrenCount}
        siblingCount={siblingCount}
        setSiblingCount={setSiblingCount}
        isGeneratingChildren={isGeneratingChildren}
        isGeneratingSiblings={isGeneratingSiblings}
        handleGenerateChildren={handleGenerateChildren}
        handleGenerateSiblings={handleGenerateSiblings}
      />

      {/* Create New Tree - Using subcomponent */}
      <TreeCreationForm
        connected={connected}
        newTreeContent={newTreeContent}
        setNewTreeContent={setNewTreeContent}
        isCreatingTree={isCreatingTree}
        handleCreateTree={handleCreateTree}
      />

      {/* Tree List - Using subcomponent */}
      <TreeList
        connected={connected}
        trees={trees}
        currentTree={currentTree}
        account={account}
        showOnlyMyTrees={showOnlyMyTrees}
        setShowOnlyMyTrees={setShowOnlyMyTrees}
        onSelectTree={onSelectTree}
        getAllTrees={getAllTrees}
        setTrees={setTrees}
        setCurrentTree={setCurrentTree}
        setIsLoadingTrees={setIsLoadingTrees}
      />

      {/* Backup & Restore - Using subcomponent */}
      <BackupRestore
        connected={connected}
        trees={trees}
        account={account}
        isExporting={isExporting}
        isImporting={isImporting}
        handleExportTrees={handleExportTrees}
        handleImportTrees={handleImportTrees}
      />

      {/* Keyboard Shortcuts - Using subcomponent */}
      <KeyboardShortcuts shortcutsManager={shortcutsManager} />

      {/* Instructions - Using subcomponent */}
      <Instructions shortcutsManager={shortcutsManager} ipfsAvailable={ipfsAvailable} />

      {/* Gas Tracker Modal - Using subcomponent */}
      <GasTrackerModal
        showGasModal={showGasModal}
        setShowGasModal={setShowGasModal}
        totalGasCost={totalGasCost}
        nativeCurrencySymbol={nativeCurrencySymbol}
        gasTransactions={gasTransactions}
        clearGasTransactions={clearGasTransactions}
      />
    </div>
  );
};

export default RightSidebar;