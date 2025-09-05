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
    
    setTrees(prev => {
      const exists = prev.some(tree => tree.address === data.treeAddress);
      if (exists) {
        console.log('Socket: Tree already exists in list, skipping socket update');
        return prev;
      }
      
      console.log('Socket: Adding tree from socket event');
      // Move GraphQL call outside render cycle and add retry logic for subgraph indexing delays
      const tryFetchTree = async (attempt = 1, maxAttempts = 5) => {
        try {
          const fullTree = await getTree(data.treeAddress);
          
          // If tree is partially loaded (subgraph hasn't indexed yet), retry after delay
          if (fullTree.isPartiallyLoaded && attempt < maxAttempts) {
            console.log(`🔄 Tree partially loaded, retrying in ${attempt * 2}s (attempt ${attempt}/${maxAttempts})`);
            setTimeout(() => tryFetchTree(attempt + 1, maxAttempts), attempt * 2000);
            
            // Still add the partial tree to UI immediately
            setTrees(prevTrees => {
              const stillExists = prevTrees.some(tree => tree.address === data.treeAddress);
              if (stillExists) return prevTrees;
              return [...prevTrees, {...fullTree, rootContent: data.rootContent}]; // Use socket data for immediate display
            });
            return;
          }
          
          // Full tree loaded successfully
          setTrees(prevTrees => {
            const existingIndex = prevTrees.findIndex(tree => tree.address === data.treeAddress);
            if (existingIndex >= 0) {
              // Update existing partial tree with full data
              const updated = [...prevTrees];
              updated[existingIndex] = fullTree;
              return updated;
            } else {
              return [...prevTrees, fullTree];
            }
          });
          
          // Use memory handler to properly set tree and select root node
          if (memoryHandlers) {
            memoryHandlers.handleTreeSelect(fullTree, currentTree, null);
          } else {
            setCurrentTree(fullTree);
          }
        } catch (error) {
          console.error('Socket: Error fetching full tree data:', error);
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
          // Use memory handler to properly set tree and select root node
          if (memoryHandlers) {
            memoryHandlers.handleTreeSelect(basicTree, currentTree, null);
          } else {
            setCurrentTree(basicTree);
          }
        }
      };
      
      // Start the fetch process
      setTimeout(() => tryFetchTree(), 0);
      
      return prev;
    });
  };

  return {
    handleGenerationComplete,
    handleNodeCreated,
    handleTreeCreated
  };
};