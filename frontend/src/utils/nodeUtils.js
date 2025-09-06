export const createNodeHandlers = (
  currentTree,
  socket,
  getTree,
  setCurrentTree,
  setTrees,
  graphRef = null, // Optional: only needed for re-selection after edits
  setIsLoadingTrees = null // Optional: for showing loading overlay during tree reload
) => {
  const handleAddNode = async (parentId, content, modelId = '') => {
    // Frontend addNode removed - all node creation should go through backend socket handlers
    console.warn('handleAddNode called but frontend addNode has been removed. Use socket-based node creation instead.');
    throw new Error('Frontend addNode has been removed. Use backend socket handlers for node creation.');
  };

  const handleUpdateNode = async (treeAddress, nodeId, newContent, options = null, modelId = '') => {
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
        const handleComplete = (data) => {
          socket.off('updateComplete', handleComplete);
          if (data.success) {
            resolve(data);
          } else {
            reject(new Error(data.error || 'Update failed'));
          }
        };

        socket.on('updateComplete', handleComplete);

        const payload = {
          treeAddress,
          nodeId,
          newContent,
          modelId
        };
        
        // Add options if provided
        if (options) {
          payload.options = options;
        }

        console.log('Sending updateNode with payload:', payload);
        socket.emit('updateNode', payload);
      });

      await updatePromise;
      
      // Real-time updates now handled by nodeUpdated socket events
      
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