export const createMemoryHandlers = (
  treeNodeMemory,
  setTreeNodeMemory,
  setSelectedNode,
  setCurrentTree,
  graphRef
) => {
  const handleNodeSelect = (node, currentTree) => {
    setSelectedNode(node);
    
    if (currentTree && node && node.id) {
      setTreeNodeMemory(prev => {
        const newMemory = new Map(prev);
        newMemory.set(currentTree.address, node.id);
        return newMemory;
      });
    }
  };

  const handleTreeSelect = (newTree, currentTree, selectedNode) => {
    console.log('🌲 handleTreeSelect called:', {
      newTreeAddress: newTree?.address?.substring(0, 8) + '...',
      hasNodes: !!newTree?.nodes?.length,
      rootNode: newTree?.nodes?.find(node => node.isRoot)?.nodeId?.substring(0, 8) + '...' || 'none'
    });
    
    if (currentTree && selectedNode) {
      setTreeNodeMemory(prev => {
        const newMemory = new Map(prev);
        newMemory.set(currentTree.address, selectedNode.id);
        console.log(`💾 Saving node ${selectedNode.id.substring(0, 8)}... for tree ${currentTree.address.substring(0, 8)}...`);
        return newMemory;
      });
    }

    setCurrentTree(newTree);
    
    const rememberedNodeId = treeNodeMemory.get(newTree.address);
    console.log(`🔍 Checking memory for tree ${newTree.address.substring(0, 8)}...:`, rememberedNodeId ? 'found' : 'none');
    
    if (rememberedNodeId) {
      console.log(`🔄 Restoring node ${rememberedNodeId.substring(0, 8)}... for tree ${newTree.address.substring(0, 8)}...`);
      const rememberedNode = newTree.nodes?.find(node => node.nodeId === rememberedNodeId);
      if (rememberedNode) {
        setSelectedNode({
          id: rememberedNode.nodeId,
          content: rememberedNode.content,
          parentId: rememberedNode.parentId,
          author: rememberedNode.author,
          timestamp: rememberedNode.timestamp,
          modelId: rememberedNode.modelId
        });
        
        if (graphRef.current) {
          setTimeout(() => {
            if (graphRef.current) {
              const graphNode = graphRef.current.findNodeById?.(rememberedNodeId);
              if (graphNode) {
                graphRef.current.selectNodeByKeyboard?.(graphNode);
              }
            }
          }, 100);
        }
      } else {
        console.log(`⚠️ Remembered node not found in new tree, selecting root node instead`);
        
        // Find and select root node if remembered node doesn't exist
        const rootNode = newTree.nodes?.find(node => node.isRoot);
        if (rootNode) {
          console.log('🎯 Auto-selecting root node (remembered node not found)');
          setSelectedNode({
            id: rootNode.nodeId,
            content: rootNode.content,
            parentId: rootNode.parentId,
            author: rootNode.author,
            timestamp: rootNode.timestamp,
            modelId: rootNode.modelId
          });
          
          // Also select in LiteGraph
          if (graphRef.current) {
            setTimeout(() => {
              if (graphRef.current) {
                const graphNode = graphRef.current.findNodeById?.(rootNode.nodeId);
                if (graphNode) {
                  graphRef.current.selectNodeByKeyboard?.(graphNode);
                }
              }
            }, 300); // Slightly longer delay to ensure nodes are loaded
          }
        } else {
          setSelectedNode(null);
        }
      }
    } else {
      console.log(`🆕 No remembered node for tree ${newTree.address.substring(0, 8)}..., selecting root node`);
      
      // Find and select root node if no memorized selection
      const rootNode = newTree.nodes?.find(node => node.isRoot);
      if (rootNode) {
        console.log('🎯 Auto-selecting root node for new tree');
        setSelectedNode({
          id: rootNode.nodeId,
          content: rootNode.content,
          parentId: rootNode.parentId,
          author: rootNode.author,
          timestamp: rootNode.timestamp,
          modelId: rootNode.modelId
        });
        
        // Also select in LiteGraph
        if (graphRef.current) {
          setTimeout(() => {
            if (graphRef.current) {
              const graphNode = graphRef.current.findNodeById?.(rootNode.nodeId);
              if (graphNode) {
                graphRef.current.selectNodeByKeyboard?.(graphNode);
              }
            }
          }, 300); // Slightly longer delay to ensure nodes are loaded
        }
      } else {
        setSelectedNode(null);
      }
    }
  };

  return {
    handleNodeSelect,
    handleTreeSelect
  };
};