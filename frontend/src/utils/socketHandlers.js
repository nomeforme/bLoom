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
  memoryHandlers
) => {
  // Track ongoing tree fetches to prevent duplicates
  const pendingTreeFetches = new Set();
  const handleGenerationComplete = (data) => {
    console.log('🎯 App: Global handleGenerationComplete called:', data);
    
    // Only handle state updates here, notifications are handled by the promise-based handler
    setIsGeneratingChildren(false);
    setIsGeneratingSiblings(false);
  };

  const handleNodeCreated = (data) => {
    console.log('Socket nodeCreated event received:', {
      nodeId: data.nodeId,
      parentId: data.parentId,
      content: data.content?.substring(0, 50) + '...',
      treeAddress: data.treeAddress,
      currentTreeAddress: currentTree?.address
    });
    
    // Only add node to graph if it belongs to the currently displayed tree
    if (currentTree && data.treeAddress === currentTree.address && graphRef.current) {
      graphRef.current.addNodeFromBlockchain(data);
    }
    
    if (currentTree && data.treeAddress === currentTree.address) {
      console.log('Updating current tree with new node');
      const newNode = {
        nodeId: data.nodeId,
        parentId: data.parentId,
        content: data.content,
        children: [],
        author: data.author,
        timestamp: data.timestamp,
        isRoot: false,
        modelId: data.modelId
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
      
      // Check if we're already fetching this tree
      if (pendingTreeFetches.has(treeAddress)) {
        console.log('Socket: Tree fetch already in progress, skipping duplicate request');
        return prev;
      }
      
      console.log('Socket: Adding tree from socket event - waiting for subgraph to index');
      
      // Mark as pending to prevent duplicates
      pendingTreeFetches.add(treeAddress);
      
      // Add retry logic for subgraph indexing delays - start after a delay to let subgraph index
      const tryFetchTree = async (attempt = 1, maxAttempts = 5) => {
        try {
          const fullTree = await getTree(data.treeAddress);
          
          // If tree is partially loaded (subgraph hasn't indexed yet), retry after delay
          if (fullTree.isPartiallyLoaded && attempt < maxAttempts) {
            console.log(`🔄 Tree partially loaded, retrying in ${attempt * 2}s (attempt ${attempt}/${maxAttempts})`);
            setTimeout(() => tryFetchTree(attempt + 1, maxAttempts), attempt * 2000);
            return;
          }
          
          // Full tree loaded successfully - add to UI
          setTrees(prevTrees => {
            const existingIndex = prevTrees.findIndex(tree => tree.address?.toLowerCase() === treeAddress);
            if (existingIndex >= 0) {
              // Tree already exists, don't add duplicate
              console.log('Socket: Tree already exists when trying to add, skipping');
              return prevTrees;
            } else {
              console.log('Socket: Adding tree to UI from GraphQL data');
              return [...prevTrees, fullTree];
            }
          });
          
          // Use memory handler to properly set tree and select root node
          if (memoryHandlers) {
            memoryHandlers.handleTreeSelect(fullTree, currentTree, null);
          } else {
            setCurrentTree(fullTree);
          }
          
          // Remove from pending set
          pendingTreeFetches.delete(treeAddress);
        } catch (error) {
          if (attempt < maxAttempts) {
            console.log(`🔄 Failed to fetch tree from subgraph, retrying in ${attempt * 2}s (attempt ${attempt}/${maxAttempts}):`, error.message);
            setTimeout(() => tryFetchTree(attempt + 1, maxAttempts), attempt * 2000);
          } else {
            console.log('🔄 Max attempts reached, creating basic tree structure from socket data');
            // Create basic tree as fallback if GraphQL completely fails
            const basicTree = {
              address: data.treeAddress,
              treeId: data.treeId,
              rootContent: data.rootContent,
              nodeCount: 1,
              nodes: [],
              nftAddress: data.nftContractAddress,
              creator: data.creator,
              blockTimestamp: Date.now() / 1000
            };
            
            setTrees(prevTrees => {
              const stillExists = prevTrees.some(tree => tree.address?.toLowerCase() === treeAddress);
              if (stillExists) return prevTrees;
              return [...prevTrees, basicTree];
            });
            
            // Use memory handler to properly set tree and select root node
            if (memoryHandlers) {
              memoryHandlers.handleTreeSelect(basicTree, currentTree, null);
            } else {
              setCurrentTree(basicTree);
            }
            
            // Remove from pending set
            pendingTreeFetches.delete(treeAddress);
          }
        }
      };
      
      // Start the fetch process after a delay to let subgraph index the new tree
      setTimeout(() => tryFetchTree(), 5000); // Wait 5 seconds before first attempt
      
      return prev;
    });
  };

  return {
    handleGenerationComplete,
    handleNodeCreated,
    handleTreeCreated
  };
};