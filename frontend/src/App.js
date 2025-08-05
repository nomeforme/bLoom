import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ethers } from 'ethers';
import io from 'socket.io-client';
import LoomGraph from './components/LoomGraph';
import Sidebar from './components/Sidebar';
import { useBlockchain } from './hooks/useBlockchain';
import './App.css';

function App() {
  const graphRef = useRef(null);
  const [socket, setSocket] = useState(null);
  const [selectedNode, setSelectedNode] = useState(null);
  const [trees, setTrees] = useState([]);
  const [currentTree, setCurrentTree] = useState(null);
  
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
    getUserTrees
  } = useBlockchain();

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io('http://localhost:3001');
    setSocket(newSocket);

    newSocket.on('treeCreated', (data) => {
      console.log('Tree created:', data);
      setTrees(prev => [...prev, data]);
    });

    return () => newSocket.close();
  }, []);

  // Handle socket events that depend on currentTree
  useEffect(() => {
    if (!socket) return;

    const handleGenerationComplete = (data) => {
      console.log('Generation complete:', data);
      // Refresh the current tree after generation is complete
      if (currentTree && data.success) {
        setTimeout(async () => {
          try {
            console.log('Refreshing tree after generation complete');
            const updatedTree = await getTree(currentTree.address);
            setCurrentTree(updatedTree);
            // Update trees list as well
            setTrees(prevTrees => 
              prevTrees.map(tree => 
                tree.address === currentTree.address ? updatedTree : tree
              )
            );
          } catch (error) {
            console.error('Error refreshing tree after generation:', error);
          }
        }, 2000); // Wait for blockchain to settle
      }
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

    return () => {
      socket.off('nodeCreated', handleNodeCreated);
      socket.off('generationComplete', handleGenerationComplete);
    };
  }, [socket, currentTree, getTree]);

  // Load existing trees when user connects
  useEffect(() => {
    const loadExistingTrees = async () => {
      if (connected && account && getUserTrees) {
        try {
          console.log('Loading existing trees for account:', account);
          const userTrees = await getUserTrees();
          console.log('Found trees:', userTrees);
          setTrees(userTrees);
          
          // If no current tree is selected and we have trees, select the first one
          if (userTrees.length > 0 && !currentTree) {
            console.log('Setting current tree to first tree:', userTrees[0]);
            setCurrentTree(userTrees[0]);
          }
        } catch (error) {
          console.error('Error loading existing trees:', error);
        }
      }
    };

    loadExistingTrees();
  }, [connected, account, getUserTrees, currentTree]);

  const handleCreateTree = async (rootContent) => {
    try {
      const treeAddress = await createTree(rootContent);
      const tree = await getTree(treeAddress);
      setCurrentTree(tree);
      setTrees(prev => [...prev, tree]);
    } catch (error) {
      console.error('Error creating tree:', error);
    }
  };

  const handleNodeSelect = useCallback((node) => {
    setSelectedNode(node);
  }, []);

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

  const handleGenerateSiblings = useCallback((parentId, count = 3) => {
    if (!parentId) return Promise.resolve();
    
    return new Promise((resolve, reject) => {
      if (!socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      // Set up one-time listeners for completion
      const handleComplete = (data) => {
        socket.off('generationComplete', handleComplete);
        socket.off('error', handleError);
        if (data.success) {
          resolve(data);
        } else {
          reject(new Error(data.error || 'Generation failed'));
        }
      };

      const handleError = (error) => {
        socket.off('generationComplete', handleComplete);
        socket.off('error', handleError);
        reject(error);
      };

      socket.on('generationComplete', handleComplete);
      socket.on('error', handleError);

      // Send generation request to backend
      socket.emit('generateSiblings', {
        treeAddress: currentTree?.address,
        parentId,
        count
      });
    });
  }, [socket, currentTree]);

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
      <Sidebar
        connected={connected}
        account={account}
        onConnect={connect}
        onDisconnect={disconnect}
        onCreateTree={handleCreateTree}
        trees={trees}
        currentTree={currentTree}
        onSelectTree={setCurrentTree}
        selectedNode={selectedNode}
        onGenerateSiblings={handleGenerateSiblings}
        onImportTrees={handleImportTrees}
      />
      
      <div className="graph-container">
        <LoomGraph
          ref={graphRef}
          currentTree={currentTree}
          onNodeSelect={handleNodeSelect}
          onAddNode={handleAddNode}
        />
      </div>
    </div>
  );
}

export default App;