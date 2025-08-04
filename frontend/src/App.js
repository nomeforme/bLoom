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

    // Listen for blockchain events
    newSocket.on('nodeCreated', (data) => {
      console.log('Node created:', data);
      if (graphRef.current) {
        graphRef.current.addNodeFromBlockchain(data);
      }
    });

    newSocket.on('treeCreated', (data) => {
      console.log('Tree created:', data);
      setTrees(prev => [...prev, data]);
    });

    return () => newSocket.close();
  }, []);

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
  }, [connected, account, getUserTrees]);

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
    } catch (error) {
      console.error('Error adding node:', error);
    }
  }, [currentTree, addNode]);

  const handleGenerateSiblings = useCallback(async (parentId, count = 3) => {
    if (!parentId) return;
    
    // Send generation request to backend
    if (socket) {
      socket.emit('generateSiblings', {
        treeAddress: currentTree?.address,
        parentId,
        count
      });
    }
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