import { buildFullPathContext } from './treeUtils';

export const createGenerationHandler = (
  socket,
  currentTree,
  account,
  selectedModel,
  modelsConfig,
  storageMode,
  setIsGeneratingChildren,
  setIsGeneratingSiblings,
  addNotification
) => {
  const generateNodes = (parentId, count = 3) => {
    if (!parentId) return Promise.resolve();
    
    return new Promise((resolve, reject) => {
      if (!socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      console.log('🎯 App: Starting generation for parentId:', parentId);

      const handleComplete = (data) => {
        console.log('🎯 App: Local handleComplete called for promise resolution:', data);
        socket.off('generationComplete', handleComplete);
        socket.off('error', handleError);
        
        // Handle notifications here
        if (data.warnings && data.warnings.length > 0) {
          data.warnings.forEach(warning => {
            addNotification(warning, 'warning');
          });
        }
        
        if (data.successCount > 0) {
          // Determine if we're generating children or siblings based on generation state
          const kind = 'node'; // Generic since this handles both
          const plural = data.successCount === 1 ? '' : 's';
          const msg = `Generated ${data.successCount}/${data.totalRequested ?? data.successCount} ${kind}${plural} successfully`;
          addNotification(msg, 'success');
        } else {
          const errorMsg = data.message || 'All generation attempts failed';
          addNotification(errorMsg, 'error');
        }
        
        resolve(data);
      };

      const handleError = (error) => {
        socket.off('generationComplete', handleComplete);
        socket.off('error', handleError);
        reject(error);
      };

      socket.on('generationComplete', handleComplete);
      socket.on('error', handleError);
      console.log('🎯 App: Added local socket listeners for generation promise');

      const fullPathContext = buildFullPathContext(parentId, currentTree);

      socket.emit('generateNodes', {
        treeAddress: currentTree?.address,
        parentId,
        parentContent: fullPathContext,
        count,
        userAccount: account,
        model: selectedModel,
        temperature: modelsConfig.generationSettings.temperature,
        maxTokens: modelsConfig.generationSettings.maxTokens,
        storageMode: storageMode
      });
    });
  };

  return {
    generateNodes
  };
};