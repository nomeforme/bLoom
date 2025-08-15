export const createSocketHandlers = (
  socket,
  currentTree,
  setCurrentTree,
  setTrees,
  setIsGeneratingChildren,
  setIsGeneratingSiblings,
  addNotification,
  graphRef,
  getTree
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
    
    if (graphRef.current) {
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
      try {
        getTree(data.treeAddress).then(fullTree => {
          setTrees(prevTrees => {
            const stillExists = prevTrees.some(tree => tree.address === data.treeAddress);
            if (stillExists) return prevTrees;
            return [...prevTrees, fullTree];
          });
          setCurrentTree(fullTree);
        }).catch(error => {
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
          setCurrentTree(basicTree);
        });
      } catch (error) {
        console.error('Socket: Error in tree creation handler:', error);
      }
      
      return prev;
    });
  };

  return {
    handleGenerationComplete,
    handleNodeCreated,
    handleTreeCreated
  };
};