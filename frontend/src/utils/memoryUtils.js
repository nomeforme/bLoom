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
    if (rememberedNodeId) {
      console.log(`🔄 Restoring node ${rememberedNodeId.substring(0, 8)}... for tree ${newTree.address.substring(0, 8)}...`);
      const rememberedNode = newTree.nodes?.find(node => node.nodeId === rememberedNodeId);
      if (rememberedNode) {
        setSelectedNode({
          id: rememberedNode.nodeId,
          content: rememberedNode.content,
          parentId: rememberedNode.parentId,
          author: rememberedNode.author,
          timestamp: rememberedNode.timestamp
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
        console.log(`⚠️ Remembered node not found in new tree, clearing selection`);
        setSelectedNode(null);
      }
    } else {
      console.log(`🆕 No remembered node for tree ${newTree.address.substring(0, 8)}..., clearing selection`);
      setSelectedNode(null);
    }
  };

  return {
    handleNodeSelect,
    handleTreeSelect
  };
};