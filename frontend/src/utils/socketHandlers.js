export const createSocketHandlers = (
  socket,
  currentTree,
  setCurrentTree,
  setTrees,
  setIsGeneratingChildren,
  setIsGeneratingSiblings,
  addNotification,
  graphRef,
  getTree,
  memoryHandlers,
  selectedNode
) => {
  // Socket-based tree creation (no GraphQL fetching needed)
  const handleGenerationComplete = (data) => {
    console.log('🎯 App: Global handleGenerationComplete called:', data);
    
    // Only handle state updates here, notifications are handled by the promise-based handler
    setIsGeneratingChildren(false);
    setIsGeneratingSiblings(false);
  };

  const handleNodeUpdated = (data) => {
    console.log('Socket nodeUpdated event received:', {
      nodeId: data.nodeId,
      content: data.content?.substring(0, 50) + '...',
      treeAddress: data.treeAddress,
      currentTreeAddress: currentTree?.address
    });
    
    // Only update node if it belongs to the currently displayed tree
    if (currentTree && data.treeAddress === currentTree.address) {
      console.log('Updating current tree with updated node content');
      
      setCurrentTree(prevTree => {
        if (!prevTree?.nodes) return prevTree;
        
        const updatedTree = {
          ...prevTree,
          nodes: prevTree.nodes.map(node => 
            node.nodeId === data.nodeId 
              ? { ...node, content: data.content }
              : node
          )
        };
        
        // If the updated node is currently selected, mark it for reselection using a persistent ref
        if (selectedNode && selectedNode.id === data.nodeId && graphRef.current) {
          console.log('🔄 Marking node for reselection after content update');
          graphRef.current.setPendingReselect(data.nodeId);
        }
        
        return updatedTree;
      });

      setTrees(prevTrees => 
        prevTrees.map(tree => 
          tree.address === data.treeAddress 
            ? {
                ...tree,
                nodes: tree.nodes?.map(node => 
                  node.nodeId === data.nodeId 
                    ? { ...node, content: data.content }
                    : node
                ) || tree.nodes
              }
            : tree
        )
      );
    } else {
      console.log('Not updating tree - currentTree mismatch or null');
    }
  };

  const handleNodeCreated = (data) => {
    console.log('Socket nodeCreated event received:', {
      nodeId: data.nodeId,
      parentId: data.parentId,
      content: data.content?.substring(0, 50) + '...',
      treeAddress: data.treeAddress,
      currentTreeAddress: currentTree?.address,
      hasNFT: data.hasNFT,
      tokenId: data.tokenId,
      tokenBoundAccount: data.tokenBoundAccount?.substring(0, 10) + '...' || null,
      nodeTokenContract: data.nodeTokenContract?.substring(0, 10) + '...' || null
    });
    
    // Only add node to graph if it belongs to the currently displayed tree
    if (currentTree && data.treeAddress === currentTree.address && graphRef.current) {
      graphRef.current.addNodeFromBlockchain(data);
    }
    
    // Handle both current tree updates and tree list updates
    const treeAddress = data.treeAddress.toLowerCase();
    
    // Check if this is a root node (parentId is null/0x0 or empty)
    const isRootNode = !data.parentId || data.parentId === '0x0000000000000000000000000000000000000000000000000000000000000000';
    
    console.log('Node details:', {
      isRoot: isRootNode,
      parentId: data.parentId,
      treeAddress: data.treeAddress
    });
    
    const newNode = {
      nodeId: data.nodeId,
      id: data.nodeId, // Also use 'id' for compatibility
      parentId: data.parentId,
      content: data.content,
      children: [],
      author: data.author,
      timestamp: data.timestamp,
      isRoot: isRootNode,
      modelId: data.modelId,
      hasNFT: data.hasNFT,
      tokenId: data.tokenId,
      tokenBoundAccount: data.tokenBoundAccount,
      nodeTokenContract: data.nodeTokenContract
    };
    
    // Update currentTree if this node belongs to it
    if (currentTree && data.treeAddress === currentTree.address) {
      console.log('Updating current tree with new node');

      setCurrentTree(prevTree => {
        console.log('Previous tree node count:', prevTree.nodeCount);
        const updatedTree = {
          ...prevTree,
          nodes: [...(prevTree.nodes || []), newNode],
          nodeCount: (prevTree.nodeCount || 0) + 1,
          rootId: isRootNode ? data.nodeId : prevTree.rootId // Set rootId for root nodes
        };
        console.log('Updated tree node count:', updatedTree.nodeCount);
        return updatedTree;
      });
    }
    
    // Always update the tree in the trees list
    setTrees(prevTrees => {
      const updatedTrees = prevTrees.map(tree => 
        tree.address?.toLowerCase() === treeAddress 
          ? {
              ...tree,
              nodes: [...(tree.nodes || []), newNode],
              nodeCount: (tree.nodeCount || 0) + 1,
              rootId: isRootNode ? data.nodeId : tree.rootId // Set rootId for root nodes
            }
          : tree
      );
      
      // If this is a root node, trigger memory manager to select it after state update
      if (isRootNode) {
        console.log('Root node created - triggering tree selection to activate it in LiteGraph');
        
        const updatedTree = updatedTrees.find(tree => tree.address?.toLowerCase() === treeAddress);
        if (updatedTree && updatedTree.nodes?.length > 0) {
          console.log('Re-triggering tree selection with root node present');
          
          // Use a small timeout to ensure React has processed the state update
          setTimeout(() => {
            if (memoryHandlers) {
              memoryHandlers.handleTreeSelect(updatedTree, currentTree, null);
            }
          }, 100);
        }
      }
      
      return updatedTrees;
    });
  };

  const handleTreeCreated = async (data) => {
    console.log('Socket: Tree created event received:', data);
    
    const treeAddress = data.treeAddress.toLowerCase();
    
    // Check if tree already exists in state
    setTrees(prev => {
      const exists = prev.some(tree => tree.address?.toLowerCase() === treeAddress);
      if (exists) {
        console.log('Socket: Tree already exists in list, skipping socket update');
        return prev;
      }
      
      console.log('Socket: Creating tree immediately from socket data (no GraphQL delay)');
      
      // Create tree structure immediately from socket data
      const immediateTree = {
        address: data.treeAddress,
        treeId: data.treeId,
        rootContent: data.rootContent,
        nodeCount: 1,
        nodes: [], // Will be populated when NodeCreated event arrives
        nftAddress: data.nftContractAddress,
        creator: data.creator,
        blockTimestamp: Date.now() / 1000,
        isSocketTree: true // Flag to indicate this came from socket
      };
      
      console.log('Socket: Adding tree to UI immediately:', {
        address: immediateTree.address,
        rootContent: immediateTree.rootContent.substring(0, 50) + '...'
      });
      
      // Add tree to state immediately
      const updatedTrees = [...prev, immediateTree];
      
      // Set as current tree and select root node (will happen when NodeCreated arrives)
      if (memoryHandlers) {
        memoryHandlers.handleTreeSelect(immediateTree, currentTree, null);
      } else {
        setCurrentTree(immediateTree);
      }
      
      return updatedTrees;
    });
  };

  return {
    handleGenerationComplete,
    handleNodeCreated,
    handleNodeUpdated,
    handleTreeCreated
  };
};