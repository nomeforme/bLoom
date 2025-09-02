export const createImportHandler = (
  socket,
  createTree,
  getTree,
  setTrees,
  setCurrentTree,
  currentTree,
  account
) => {
  const handleImportTrees = async (importData) => {
    if (!socket) {
      throw new Error('Socket not connected - cannot import trees');
    }

    try {
      console.log('Starting import of', importData.trees.length, 'trees');
      const importedTrees = [];
      
      for (let i = 0; i < importData.trees.length; i++) {
        const treeData = importData.trees[i];
        console.log(`Importing tree ${i + 1}/${importData.trees.length}:`, treeData.rootContent.substring(0, 50));
        
        try {
          const treeAddress = await createTree(treeData.rootContent);
          let newTree = await getTree(treeAddress);
          importedTrees.push(newTree);
          
          setTrees(prev => [...prev, newTree]);
          
          console.log('Waiting for tree deployment to settle...');
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          console.log('Fetching fresh tree data for import...');
          newTree = await getTree(treeAddress);
          const newRootId = newTree.rootId;
          
          console.log(`Tree ready for import - Address: ${treeAddress}, Root ID: ${newRootId.substring(0, 8)}`);
          
          const oldRootNode = treeData.nodes.find(node => node.isRoot);
          const nonRootNodes = treeData.nodes.filter(node => !node.isRoot);
          
          if (nonRootNodes.length > 0) {
            console.log(`Importing ${nonRootNodes.length} nodes via backend for tree ${treeAddress}`);
            
            const importPromise = new Promise((resolve, reject) => {
              const timeout = setTimeout(() => {
                socket.off('importComplete', handleComplete);
                socket.off('error', handleError);
                reject(new Error('Import timeout'));
              }, 300000);
              
              const handleComplete = (data) => {
                clearTimeout(timeout);
                socket.off('importComplete', handleComplete);
                socket.off('error', handleError);
                if (data.success) {
                  resolve(data);
                } else {
                  reject(new Error(data.error || 'Import failed'));
                }
              };

              const handleError = (error) => {
                clearTimeout(timeout);
                socket.off('importComplete', handleComplete);
                socket.off('error', handleError);
                reject(error);
              };

              socket.on('importComplete', handleComplete);
              socket.on('error', handleError);

              socket.emit('importNodes', {
                treeAddress: treeAddress,
                rootId: newRootId,
                oldRootId: oldRootNode?.nodeId,
                userAccount: account,
                nodes: nonRootNodes.map(node => ({
                  nodeId: node.nodeId,
                  parentId: node.parentId,
                  content: node.content,
                  author: node.author,
                  timestamp: node.timestamp,
                  modelId: node.modelId
                }))
              });
            });

            await importPromise;
            console.log(`Backend import completed for tree ${treeAddress}`);
          }
          
          setTimeout(async () => {
            try {
              const updatedTree = await getTree(treeAddress);
              setTrees(prevTrees => 
                prevTrees.map(tree => 
                  tree.address === treeAddress ? updatedTree : tree
                )
              );
              if (currentTree?.address === treeAddress) {
                setCurrentTree(updatedTree);
              }
              console.log(`Tree ${treeAddress} refreshed with ${updatedTree.nodeCount} nodes`);
            } catch (error) {
              console.error('Error refreshing imported tree:', error);
            }
          }, 3000);
          
        } catch (treeError) {
          console.error(`Failed to import tree ${i + 1}:`, treeError);
          throw treeError;
        }
      }
      
      return importedTrees;
    } catch (error) {
      console.error('Error in handleImportTrees:', error);
      throw error;
    }
  };

  return {
    handleImportTrees
  };
};