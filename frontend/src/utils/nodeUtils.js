export const createNodeHandlers = (
  currentTree,
  socket,
  addNode,
  getTree,
  setCurrentTree,
  setTrees
) => {
  const handleAddNode = async (parentId, content) => {
    if (!currentTree) return;
    
    try {
      await addNode(currentTree.address, parentId, content);
      setTimeout(async () => {
        try {
          const updatedTree = await getTree(currentTree.address);
          setCurrentTree(updatedTree);
          setTrees(prevTrees => 
            prevTrees.map(tree => 
              tree.address === currentTree.address ? updatedTree : tree
            )
          );
        } catch (error) {
          console.error('Error refreshing tree after node addition:', error);
        }
      }, 1000);
    } catch (error) {
      console.error('Error adding node:', error);
    }
  };

  const handleUpdateNode = async (treeAddress, nodeId, newContent) => {
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
      const updatePromise = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          socket.off('updateComplete', handleComplete);
          reject(new Error('Update timeout'));
        }, 30000);
        
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

        socket.emit('updateNode', {
          treeAddress,
          nodeId,
          newContent
        });
      });

      await updatePromise;
      
      setTimeout(async () => {
        try {
          const updatedTree = await getTree(treeAddress);
          
          if (currentTree?.address === treeAddress) {
            setCurrentTree(updatedTree);
          }
          
          setTrees(prevTrees => 
            prevTrees.map(tree => 
              tree.address === treeAddress ? updatedTree : tree
            )
          );
        } catch (error) {
          console.error('Error refreshing tree after node update:', error);
        }
      }, 1000);
      
    } catch (error) {
      console.error('Error updating node:', error);
      throw error;
    }
  };

  return {
    handleAddNode,
    handleUpdateNode
  };
};