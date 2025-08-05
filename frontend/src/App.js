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