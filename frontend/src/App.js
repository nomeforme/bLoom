import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ethers } from 'ethers';
import io from 'socket.io-client';
import LoomGraph from './components/LoomGraph';
import RightSidebar from './components/RightSidebar';
import LeftSidebar from './components/LeftSidebar';
import { useBlockchain } from './hooks/useBlockchain';
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
    addNode,
    updateNode,
    getUserTrees,
    getAllTrees,
    getNodeNFTInfo
  } = useBlockchain();

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io('http://localhost:3001');
    setSocket(newSocket);

    newSocket.on('treeCreated', async (data) => {
      console.log('Socket: Tree created event received:', data);
      
      // Check if tree already exists (may have been added by handleCreateTree)
      setTrees(prev => {
        const exists = prev.some(tree => tree.address === data.treeAddress);
        if (exists) {
          console.log('Socket: Tree already exists in list, skipping socket update');
          return prev;
        }
        
        // Tree doesn't exist, this might be from another client or a missed immediate update
        console.log('Socket: Adding tree from socket event');
        try {
          // Try to fetch full tree data
          getTree(data.treeAddress).then(fullTree => {
            setTrees(prevTrees => {
              const stillExists = prevTrees.some(tree => tree.address === data.treeAddress);
              if (stillExists) return prevTrees;
              return [...prevTrees, fullTree];
            });
            setCurrentTree(fullTree);
          }).catch(error => {
            console.error('Socket: Error fetching full tree data:', error);
            // Fallback to basic tree
            const basicTree = {
              address: data.treeAddress,
              rootContent: data.rootContent,
              nodeCount: 1,
              nodes: [],
              nftContract: null,
              nftAddress: null
            };
            setTrees(prevTrees => {
              const stillExists = prevTrees.some(tree => tree.address === data.treeAddress);
              if (stillExists) return prevTrees;
              return [...prevTrees, basicTree];
            });
            setCurrentTree(basicTree);
          });
        } catch (error) {
          console.error('Socket: Error in tree creation handler:', error);
        }
        
        return prev; // Return unchanged for now, async operations will update
      });
    });

    return () => newSocket.close();
  }, [getTree, currentTree]);

  // Add notification function
  const addNotification = useCallback((message, type = 'info') => {
    const notification = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Unique ID
      message,
      type,
      timestamp: new Date()
    };
    setNotifications(prev => [...prev, notification]);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 5000);
  }, []);

  // Handle socket events that depend on currentTree
  useEffect(() => {
    if (!socket) {
      console.log('🎯 App: No socket available for event handlers');
      return;
    }

    console.log('🎯 App: Setting up socket event handlers');

    const handleGenerationComplete = (data) => {
      console.log('🎯 App: Global handleGenerationComplete called:', data);
      
      // Handle notifications here in the global handler
      // Show warnings if any generations failed
      if (data.warnings && data.warnings.length > 0) {
        data.warnings.forEach(warning => {
          addNotification(warning, 'warning');
        });
      }
      
      // Show appropriate message based on success/failure
      if (data.successCount > 0) {
        // Success message
        const kind = isGeneratingChildren ? 'children' : 'sibling';
        const plural = data.successCount === 1 ? '' : 's';
        const msg = `Generated ${data.successCount}/${data.totalRequested ?? data.successCount} ${kind} node${plural} successfully`;
        console.log('🎯 App: Adding success notification:', msg);
        addNotification(msg, 'success');
      } else {
        // Error message when all failed
        const errorMsg = data.message || 'All generation attempts failed';
        console.log('🎯 App: Adding error notification:', errorMsg);
        addNotification(errorMsg, 'error');
      }
      
      // Reset generation states at the end
      setIsGeneratingChildren(false);
      setIsGeneratingSiblings(false);
      // Note: Tree refresh after generation removed to prevent unnecessary full redraws
      // The new nodes are already added to the graph via the generation process
    };

    const handleNodeCreated = (data) => {
      console.log('Socket nodeCreated event received:', {
        nodeId: data.nodeId,
        parentId: data.parentId,
        content: data.content?.substring(0, 50) + '...',
        treeAddress: data.treeAddress,
        currentTreeAddress: currentTree?.address
      });
      
      if (graphRef.current) {
        graphRef.current.addNodeFromBlockchain(data);
      }
      
      // Update current tree state with new node
      if (currentTree && data.treeAddress === currentTree.address) {
        console.log('Updating current tree with new node');
        const newNode = {
          nodeId: data.nodeId,
          parentId: data.parentId,
          content: data.content,
          children: [],
          author: data.author,
          timestamp: data.timestamp,
          isRoot: false
        };

        setCurrentTree(prevTree => {
          console.log('Previous tree node count:', prevTree.nodeCount);
          const updatedTree = {
            ...prevTree,
            nodes: [...(prevTree.nodes || []), newNode],
            nodeCount: (prevTree.nodeCount || 0) + 1
          };
          console.log('Updated tree node count:', updatedTree.nodeCount);
          return updatedTree;
        });

        // Also update the tree in the trees list to ensure persistence
        setTrees(prevTrees => 
          prevTrees.map(tree => 
            tree.address === data.treeAddress 
              ? {
                  ...tree,
                  nodes: [...(tree.nodes || []), newNode],
                  nodeCount: (tree.nodeCount || 0) + 1
                }
              : tree
          )
        );
      } else {
        console.log('Not updating tree - currentTree mismatch or null');
      }
    };

    socket.on('nodeCreated', handleNodeCreated);
    socket.on('generationComplete', handleGenerationComplete);
    console.log('🎯 App: Added global socket event listeners');

    return () => {
      console.log('🎯 App: Removing global socket event listeners');
      socket.off('nodeCreated', handleNodeCreated);
      socket.off('generationComplete', handleGenerationComplete);
    };
  }, [socket, currentTree?.address, getTree, addNotification]);

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
            setCurrentTree(allTrees[0]);
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
        
        // Set as current tree
        setCurrentTree(fullTree);
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
        setCurrentTree(basicTree);
      }
      
      // Socket event is still useful for other clients or as backup
    } catch (error) {
      console.error('Error creating tree:', error);
      throw error; // Re-throw so UI can show error state
    }
  };

  const handleNodeSelect = useCallback((node) => {
    setSelectedNode(node);
  }, []);

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

  const handleAddNode = useCallback(async (parentId, content) => {
    if (!currentTree) return;
    
    try {
      await addNode(currentTree.address, parentId, content);
      // After adding a node, refresh the tree to get the latest state
      setTimeout(async () => {
        try {
          const updatedTree = await getTree(currentTree.address);
          setCurrentTree(updatedTree);
          // Update trees list as well
          setTrees(prevTrees => 
            prevTrees.map(tree => 
              tree.address === currentTree.address ? updatedTree : tree
            )
          );
        } catch (error) {
          console.error('Error refreshing tree after node addition:', error);
        }
      }, 1000); // Give some time for blockchain to process
    } catch (error) {
      console.error('Error adding node:', error);
    }
  }, [currentTree, addNode, getTree]);

  const handleUpdateNode = useCallback(async (treeAddress, nodeId, newContent) => {
    if (!socket) {
      throw new Error('Socket not connected - cannot update node');
    }

    if (!treeAddress) {
      throw new Error('Tree address is required');
    }
    
    if (!nodeId) {
      throw new Error('Node ID is required');
    }
    
    try {
      // Use socket to send update request to backend
      const updatePromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          socket.off('updateComplete', handleComplete);
          reject(new Error('Update timeout'));
        }, 30000); // 30 second timeout
        
        const handleComplete = (data) => {
          clearTimeout(timeout);
          socket.off('updateComplete', handleComplete);
          if (data.success) {
            resolve(data);
          } else {
            reject(new Error(data.error || 'Update failed'));
          }
        };

        socket.on('updateComplete', handleComplete);

        // Send update request to backend
        socket.emit('updateNode', {
          treeAddress,
          nodeId,
          newContent
        });
      });

      // Wait for backend to complete the update
      await updatePromise;
      
      // Refresh the tree to get the updated content from blockchain
      setTimeout(async () => {
        try {
          const updatedTree = await getTree(treeAddress);
          
          // Update current tree if it matches
          if (currentTree?.address === treeAddress) {
            setCurrentTree(updatedTree);
          }
          
          // Update trees list
          setTrees(prevTrees => 
            prevTrees.map(tree => 
              tree.address === treeAddress ? updatedTree : tree
            )
          );
        } catch (error) {
          console.error('Error refreshing tree after node update:', error);
        }
      }, 1000); // Give some time for blockchain to process
      
    } catch (error) {
      console.error('Error updating node:', error);
      throw error;
    }
  }, [socket, getTree, currentTree]);

  // Helper function to build full narrative context from root to target node
  const buildFullPathContext = useCallback((targetNodeId) => {
    if (!currentTree || !currentTree.nodes) return '';
    
    // Build a map of nodes for quick lookup
    const nodeMap = new Map();
    currentTree.nodes.forEach(node => {
      nodeMap.set(node.nodeId, node);
    });
    
    // Find the target node
    const targetNode = nodeMap.get(targetNodeId);
    if (!targetNode) return '';
    
    // Build path from root to target
    const path = [];
    let currentNode = targetNode;
    
    // Trace back to root
    while (currentNode) {
      path.unshift(currentNode);
      
      // Check if this is the root node
      if (currentNode.isRoot || 
          currentNode.parentId === '0x0000000000000000000000000000000000000000000000000000000000000000' ||
          currentNode.parentId === '0x0') {
        break;
      }
      
      // Move to parent
      currentNode = nodeMap.get(currentNode.parentId);
      
      // Prevent infinite loops
      if (path.length > 50) {
        console.warn('Path too long, breaking to prevent infinite loop');
        break;
      }
    }
    
    // Combine all content in sequence
    const fullContext = path.map(node => node.content.trim()).filter(content => content).join('\n\n');
    return fullContext;
  }, [currentTree]);

  const handleGenerateSiblings = useCallback((parentId, count = 3) => {
    if (!parentId) return Promise.resolve();
    
    return new Promise((resolve, reject) => {
      if (!socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      console.log('🎯 App: Starting generation for parentId:', parentId);

      // Set up one-time listeners for completion (for promise resolution only)
      const handleComplete = (data) => {
        console.log('🎯 App: Local handleComplete called for promise resolution:', data);
        socket.off('generationComplete', handleComplete);
        socket.off('error', handleError);
        // Just resolve the promise, notifications handled by global listener
        resolve(data);
      };

      const handleError = (error) => {
        socket.off('generationComplete', handleComplete);
        socket.off('error', handleError);
        reject(error);
      };

      socket.on('generationComplete', handleComplete);
      socket.on('error', handleError);
      console.log('🎯 App: Added local socket listeners for generation promise');

      // Build full narrative context from root to parent node
      const fullPathContext = buildFullPathContext(parentId);

      // Send generation request to backend with full context
      socket.emit('generateSiblings', {
        treeAddress: currentTree?.address,
        parentId,
        parentContent: fullPathContext, // Full narrative path context
        count,
        userAccount: account, // Pass the current user's account address
        model: selectedModel, // Use the selected model from dropdown
        temperature: modelsConfig.generationSettings.temperature,
        maxTokens: modelsConfig.generationSettings.maxTokens
      });
    });
  }, [socket, currentTree, buildFullPathContext, selectedModel, account]);

  // Handle model selection change
  const handleModelChange = useCallback((newModel) => {
    setSelectedModel(newModel);
    console.log('🤖 Model changed to:', newModel);
  }, []);

  const handleImportTrees = useCallback(async (importData) => {
    if (!socket) {
      throw new Error('Socket not connected - cannot import trees');
    }

    try {
      console.log('Starting import of', importData.trees.length, 'trees');
      const importedTrees = [];
      
      for (let i = 0; i < importData.trees.length; i++) {
        const treeData = importData.trees[i];
        console.log(`Importing tree ${i + 1}/${importData.trees.length}:`, treeData.rootContent.substring(0, 50));
        
        try {
          // Create the tree with root content (only wallet transaction needed)
          const treeAddress = await createTree(treeData.rootContent);
          let newTree = await getTree(treeAddress);
          importedTrees.push(newTree);
          
          // Update UI with new tree
          setTrees(prev => [...prev, newTree]);
          
          // Wait for tree creation to settle on blockchain
          console.log('Waiting for tree deployment to settle...');
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          // Get the fresh tree data to get the new root ID
          console.log('Fetching fresh tree data for import...');
          newTree = await getTree(treeAddress);
          const newRootId = newTree.rootId;
          
          console.log(`Tree ready for import - Address: ${treeAddress}, Root ID: ${newRootId.substring(0, 8)}`);
          
          // Find the old root node
          const oldRootNode = treeData.nodes.find(node => node.isRoot);
          
          // Prepare all non-root nodes for import via backend
          const nonRootNodes = treeData.nodes.filter(node => !node.isRoot);
          
          if (nonRootNodes.length > 0) {
            console.log(`Importing ${nonRootNodes.length} nodes via backend for tree ${treeAddress}`);
            
            // Use socket to send import request to backend
            const importPromise = new Promise((resolve, reject) => {
              const timeout = setTimeout(() => {
                socket.off('importComplete', handleComplete);
                socket.off('error', handleError);
                reject(new Error('Import timeout'));
              }, 300000); // 5 minute timeout
              
              const handleComplete = (data) => {
                clearTimeout(timeout);
                socket.off('importComplete', handleComplete);
                socket.off('error', handleError);
                if (data.success) {
                  resolve(data);
                } else {
                  reject(new Error(data.error || 'Import failed'));
                }
              };

              const handleError = (error) => {
                clearTimeout(timeout);
                socket.off('importComplete', handleComplete);
                socket.off('error', handleError);
                reject(error);
              };

              socket.on('importComplete', handleComplete);
              socket.on('error', handleError);

              // Send import request to backend
              socket.emit('importNodes', {
                treeAddress: treeAddress,
                rootId: newRootId,
                oldRootId: oldRootNode?.nodeId,
                userAccount: account, // Pass the current user's account address
                nodes: nonRootNodes.map(node => ({
                  nodeId: node.nodeId,
                  parentId: node.parentId,
                  content: node.content,
                  author: node.author,
                  timestamp: node.timestamp
                }))
              });
            });

            // Wait for backend to complete the import
            await importPromise;
            console.log(`Backend import completed for tree ${treeAddress}`);
          }
          
          // Refresh the tree after all nodes are added
          setTimeout(async () => {
            try {
              const updatedTree = await getTree(treeAddress);
              setTrees(prevTrees => 
                prevTrees.map(tree => 
                  tree.address === treeAddress ? updatedTree : tree
                )
              );
              if (currentTree?.address === treeAddress) {
                setCurrentTree(updatedTree);
              }
              console.log(`Tree ${treeAddress} refreshed with ${updatedTree.nodeCount} nodes`);
            } catch (error) {
              console.error('Error refreshing imported tree:', error);
            }
          }, 3000);
          
        } catch (treeError) {
          console.error(`Failed to import tree ${i + 1}:`, treeError);
          throw treeError; // Re-throw to handle in caller
        }
      }
      
      return importedTrees;
    } catch (error) {
      console.error('Error in handleImportTrees:', error);
      throw error;
    }
  }, [createTree, getTree, currentTree, socket]);

  // Helper function to sort nodes by dependency order
  const sortNodesByDependency = (nodes) => {
    const sorted = [];
    const processed = new Set();
    const rootParentId = '0x0000000000000000000000000000000000000000000000000000000000000000';
    
    // Keep trying to add nodes until all are processed
    let remainingNodes = [...nodes];
    let maxIterations = nodes.length * 2; // Prevent infinite loops
    let iteration = 0;
    
    while (remainingNodes.length > 0 && iteration < maxIterations) {
      const initialLength = remainingNodes.length;
      
      remainingNodes = remainingNodes.filter(node => {
        // Can add if parent is root or already processed
        if (node.parentId === rootParentId || node.parentId === '0x0' || processed.has(node.parentId)) {
          sorted.push(node);
          processed.add(node.nodeId);
          return false; // Remove from remaining
        }
        return true; // Keep in remaining
      });
      
      // If no progress was made, break to avoid infinite loop
      if (remainingNodes.length === initialLength) {
        console.warn('Could not resolve all node dependencies, adding remaining nodes anyway');
        sorted.push(...remainingNodes);
        break;
      }
      
      iteration++;
    }
    
    return sorted;
  };

  return (
    <div className="app-container">
      <RightSidebar
        connected={connected}
        account={account}
        onConnect={connect}
        onDisconnect={disconnect}
        onCreateTree={handleCreateTree}
        trees={trees}
        currentTree={currentTree}
        onSelectTree={setCurrentTree}
        selectedNode={selectedNode}
        selectedNodeNFT={selectedNodeNFT}
        onGenerateSiblings={handleGenerateSiblings}
        onImportTrees={handleImportTrees}
        isGeneratingChildren={isGeneratingChildren}
        setIsGeneratingChildren={setIsGeneratingChildren}
        isGeneratingSiblings={isGeneratingSiblings}
        setIsGeneratingSiblings={setIsGeneratingSiblings}
        onModelChange={handleModelChange}
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
              onClick={() => setNotifications(prev => prev.filter(n => n.id !== notification.id))}
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
          isGeneratingChildren={isGeneratingChildren}
          setIsGeneratingChildren={setIsGeneratingChildren}
          isGeneratingSiblings={isGeneratingSiblings}
          setIsGeneratingSiblings={setIsGeneratingSiblings}
        />
      </div>
      
      <LeftSidebar
        currentTree={currentTree}
        selectedNode={selectedNode}
        isGeneratingChildren={isGeneratingChildren}
        isGeneratingSiblings={isGeneratingSiblings}
      />
    </div>
  );
}

export default App;