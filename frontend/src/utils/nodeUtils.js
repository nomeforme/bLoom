export const createNodeHandlers = (
  currentTree,
  socket,
  getTree,
  setCurrentTree,
  setTrees,
  graphRef = null, // Optional: only needed for re-selection after edits
  setIsLoadingTrees = null, // Optional: for showing loading overlay during tree reload
  invalidateNFTCache = null // Optional: for invalidating NFT cache when nodes are updated
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
      
      // Show loading overlay immediately after blockchain confirmation
      if (setIsLoadingTrees) {
        setIsLoadingTrees(true);
      }
      
      // Wait for subgraph indexing before refreshing
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
          
          // Invalidate NFT cache for the updated node to force fresh data on next access
          if (invalidateNFTCache) {
            // Find the updated node in the tree to log its new content
            const updatedNode = updatedTree.nodes?.find(n => n.nodeId === nodeId);
            if (updatedNode) {
              console.log('🗑️ Invalidated NFT cache after node update:', {
                nodeId: nodeId.substring(0, 10) + '...',
                hasNFT: updatedNode.hasNFT,
                newContentLength: updatedNode.content?.length || 0,
                newContentPreview: updatedNode.content?.substring(0, 100) + '...' || 'No content'
              });
            } else {
              console.log('🗑️ Invalidated NFT cache after node update:', nodeId.substring(0, 8) + '...');
            }
            invalidateNFTCache(nodeId);
          }
          
          // Re-select the edited node after tree update, similar to post-generation
          if (graphRef?.current?.reselectNode) {
            setTimeout(() => {
              const success = graphRef.current.reselectNode(nodeId);
              if (!success) {
                console.warn('Failed to re-select edited node:', nodeId.substring(0, 8) + '...');
              }
              
              // Hide loading overlay after node reselection is complete
              if (setIsLoadingTrees) {
                setIsLoadingTrees(false);
              }
            }, 100); // Small delay to ensure tree is fully updated
          } else {
            // If no reselection available, still hide loading overlay
            if (setIsLoadingTrees) {
              setIsLoadingTrees(false);
            }
          }
        } catch (error) {
          console.error('Error refreshing tree after node update:', error);
          
          // Hide loading overlay on error
          if (setIsLoadingTrees) {
            setIsLoadingTrees(false);
          }
        }
      }, 5000); // Increased delay to account for subgraph indexing
      
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