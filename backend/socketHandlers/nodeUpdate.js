const { ethers } = require('ethers');
const { TREE_ABI, NFT_ABI } = require('../config/blockchain');
const { wallet } = require('../config/blockchain');
const { queueTransaction } = require('../services/transactionQueue');
const { emitGasCost } = require('../utils/gasTracker');
const { ipfsService } = require('../services/ipfsService');

// Track ongoing operations to prevent duplicates
const ongoingOperations = new Set();

function handleUpdateNode(socket, io) {
  socket.on('updateNode', async (data) => {
    const { treeAddress, nodeId, newContent, options, modelId } = data;
    
    console.log('Received updateNode request:', { treeAddress, nodeId, newContent, options });
    
    // Create operation key to prevent duplicates
    const operationKey = `${nodeId}-${Date.now()}`;
    
    if (ongoingOperations.has(nodeId)) {
      console.log('⚠️ Operation already in progress for node:', nodeId);
      socket.emit('updateComplete', {
        success: false,
        error: 'Update operation already in progress for this node'
      });
      return;
    }
    
    ongoingOperations.add(nodeId);
    
    try {
      // Get the tree contract
      const treeContract = new ethers.Contract(treeAddress, TREE_ABI, wallet);
      
      // Check if node was originally created in IPFS mode by getting its current content
      let ipfsHash = '';
      let wasIPFSMode = false;
      
      try {
        // Get current node content to check if it's in IPFS format
        const currentContent = await treeContract.getNodeContent(nodeId);
        wasIPFSMode = ipfsService.isIPFSReference(currentContent);
        
        console.log('📝 Node update analysis:', {
          nodeId: nodeId.substring(0, 10) + '...',
          wasIPFSMode,
          currentContent: wasIPFSMode ? currentContent : currentContent.substring(0, 50) + '...',
          newContentLength: newContent.length
        });
        
        // If node was originally in IPFS mode, maintain consistency by pinning new content
        if (wasIPFSMode) {
          console.log('🌐 Maintaining IPFS mode: pinning updated content to IPFS...');
          const pinResult = await ipfsService.pinText(newContent, {
            treeAddress,
            parentId: nodeId, // For metadata purposes
            name: `loom-node-update-${Date.now()}`
          });
          ipfsHash = pinResult.hash;
          console.log('✅ Updated content pinned to IPFS:', pinResult.hash);
        }
      } catch (contentError) {
        console.warn('⚠️ Could not check node\'s current content, proceeding with direct update:', contentError.message);
        // Proceed with direct content update
      }
      
      // Token adjustments for direct edits are now handled automatically by the contract
      
      // Update the node content - always pass original content and ipfsHash separately
      const updateReceipt = await queueTransaction(async (nonce) => {
        const updateTx = await treeContract.updateNodeContent(nodeId, newContent, ipfsHash, { nonce });
        return await updateTx.wait();
      });
      
      // Track gas cost for node update
      await emitGasCost(updateReceipt, 'Node Update', `Updated node content (${newContent.length} chars)`, io);
      
      let childNodeId = null;
      let childTxHash = null;
      
      // If options indicate we should create a child node
      if (options && options.createChild && options.childContent) {
        console.log('Creating child node as part of update operation...');
        
        // Wait longer to ensure previous transaction is confirmed
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Create child node - no manual token burning needed
        
        let childIpfsHash = '';
        
        // Handle IPFS mode for child content
        if (options.storageMode === 'ipfs') {
          try {
            console.log('🌐 Pinning child content to IPFS...');
            const pinResult = await ipfsService.pinText(options.childContent, {
              treeAddress,
              parentId: nodeId,
              name: `loom-child-node-${Date.now()}`
            });
            childIpfsHash = pinResult.hash;
            console.log('✅ Child content pinned to IPFS:', pinResult.hash);
          } catch (ipfsError) {
            console.error('❌ IPFS pinning failed for child:', ipfsError);
            throw ipfsError; // Don't fall back, fail the operation
          }
        }
        
        // Create the child node with appropriate mode
        const author = data.userAccount && data.userAccount !== "0x0000000000000000000000000000000000000000" 
          ? data.userAccount 
          : wallet.address;
          
        const childReceipt = await queueTransaction(async (nonce) => {
          const childTx = await treeContract.addNode(
            nodeId, 
            options.childContent, // Always pass original content
            childIpfsHash, // Pass IPFS hash (empty string if not IPFS mode)
            options.storageMode === 'full', // createNFT = true when in full mode
            modelId || '', // modelId from the selected node being edited
            author, // author parameter
            { nonce }
          );
          return await childTx.wait();
        });
        childTxHash = childReceipt.hash;
        
        // Track gas cost for child node creation
        const childMode = options.storageMode === 'full' ? 'NFT/Token' : options.storageMode === 'lightweight' ? 'Lightweight' : 'IPFS';
        await emitGasCost(childReceipt, 'Node Creation', `Created child node during update with ${childMode} (${options.childContent.length} chars)`, io);
        
        // Find the NodeCreated event to get the new child node ID
        const nodeCreatedEvent = childReceipt.logs.find(log => {
          try {
            const parsed = treeContract.interface.parseLog(log);
            return parsed.name === 'NodeCreated';
          } catch {
            return false;
          }
        });
        
        if (nodeCreatedEvent) {
          const parsedEvent = treeContract.interface.parseLog(nodeCreatedEvent);
          childNodeId = parsedEvent.args.nodeId;
          console.log('Child node created with ID:', childNodeId);
          
          // Emit nodeCreated event for the new child node (same as generation flow)
          const childNodeData = {
            nodeId: parsedEvent.args.nodeId,
            parentId: parsedEvent.args.parentId,
            content: options.childContent, // Use the original content, not from event
            author: parsedEvent.args.author,
            timestamp: Number(parsedEvent.args.timestamp),
            treeAddress: treeAddress,
            hasNFT: parsedEvent.args.hasNFT,
            modelId: parsedEvent.args.modelId || modelId || '',
            tokenId: parsedEvent.args.tokenId ? Number(parsedEvent.args.tokenId) : null,
            tokenBoundAccount: parsedEvent.args.tokenBoundAccount || null,
            nodeTokenContract: parsedEvent.args.nodeTokenContract || null
          };
          
          console.log('📡 Emitting nodeCreated event for child node created during split');
          io.emit('nodeCreated', childNodeData);
        }
      }
      
      // If options indicate we should create a sibling node
      if (options && options.createSibling && options.siblingContent && options.parentId) {
        console.log('Creating sibling node as part of update operation...');
        
        // Wait longer to ensure previous transaction is confirmed
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Create sibling node - no manual token burning needed
        
        let siblingIpfsHash = '';
        
        // Handle IPFS mode for sibling content
        if (options.storageMode === 'ipfs') {
          try {
            console.log('🌐 Pinning sibling content to IPFS...');
            const pinResult = await ipfsService.pinText(options.siblingContent, {
              treeAddress,
              parentId: options.parentId,
              name: `loom-sibling-node-${Date.now()}`
            });
            siblingIpfsHash = pinResult.hash;
            console.log('✅ Sibling content pinned to IPFS:', pinResult.hash);
          } catch (ipfsError) {
            console.error('❌ IPFS pinning failed for sibling:', ipfsError);
            throw ipfsError; // Don't fall back, fail the operation
          }
        }
        
        // Create the sibling node with appropriate mode (same parent as current node)
        const siblingAuthor = data.userAccount && data.userAccount !== "0x0000000000000000000000000000000000000000" 
          ? data.userAccount 
          : wallet.address;
          
        const siblingReceipt = await queueTransaction(async (nonce) => {
          const siblingTx = await treeContract.addNode(
            options.parentId, 
            options.siblingContent, // Always pass original content
            siblingIpfsHash, // Pass IPFS hash (empty string if not IPFS mode)
            options.storageMode === 'full', // createNFT = true when in full mode
            modelId || '', // modelId from the selected node being edited
            siblingAuthor, // author parameter
            { nonce }
          );
          return await siblingTx.wait();
        });
        childTxHash = siblingReceipt.hash; // Reuse the childTxHash variable for consistency
        
        // Track gas cost for sibling node creation
        const siblingMode = options.storageMode === 'full' ? 'NFT/Token' : options.storageMode === 'lightweight' ? 'Lightweight' : 'IPFS';
        await emitGasCost(siblingReceipt, 'Node Creation', `Created sibling node during update with ${siblingMode} (${options.siblingContent.length} chars)`, io);
        
        // Find the NodeCreated event to get the new sibling node ID
        const nodeCreatedEvent = siblingReceipt.logs.find(log => {
          try {
            const parsed = treeContract.interface.parseLog(log);
            return parsed.name === 'NodeCreated';
          } catch {
            return false;
          }
        });
        
        if (nodeCreatedEvent) {
          const parsedEvent = treeContract.interface.parseLog(nodeCreatedEvent);
          childNodeId = parsedEvent.args.nodeId; // Reuse the childNodeId variable for consistency
          console.log('Sibling node created with ID:', childNodeId);
          
          // Emit nodeCreated event for the new sibling node (same as generation flow)
          const siblingNodeData = {
            nodeId: parsedEvent.args.nodeId,
            parentId: parsedEvent.args.parentId,
            content: options.siblingContent, // Use the original content, not from event
            author: parsedEvent.args.author,
            timestamp: Number(parsedEvent.args.timestamp),
            treeAddress: treeAddress,
            hasNFT: parsedEvent.args.hasNFT,
            modelId: parsedEvent.args.modelId || modelId || '',
            tokenId: parsedEvent.args.tokenId ? Number(parsedEvent.args.tokenId) : null,
            tokenBoundAccount: parsedEvent.args.tokenBoundAccount || null,
            nodeTokenContract: parsedEvent.args.nodeTokenContract || null
          };
          
          console.log('📡 Emitting nodeCreated event for sibling node created during split');
          io.emit('nodeCreated', siblingNodeData);
        }
      }
      
      // Emit nodeUpdated socket event for real-time parent content update (similar to nodeCreated for children)
      console.log('📡 Emitting nodeUpdated event for parent node content change');
      io.emit('nodeUpdated', {
        nodeId,
        content: newContent,
        treeAddress: treeAddress,
        modelId: modelId || '',
        timestamp: Date.now(),
        txHash: updateReceipt.hash
      });

      // Emit success response
      const response = {
        success: true,
        nodeId,
        newContent,
        txHash: updateReceipt.hash
      };
      
      // Add child node info if one was created
      if (childNodeId && options?.createChild) {
        response.childNode = {
          nodeId: childNodeId,
          content: options.childContent,
          txHash: childTxHash
        };
      }
      
      // Add sibling node info if one was created
      if (childNodeId && options?.createSibling) {
        response.siblingNode = {
          nodeId: childNodeId,
          content: options.siblingContent,
          txHash: childTxHash
        };
      }
      
      socket.emit('updateComplete', response);
      
      // After successful update, emit updated token balance for the node (only if it has NFT)
      try {
        // Check if the node has an NFT first
        const nodeHasNFT = await treeContract.nodeHasNFT(nodeId);
        
        if (nodeHasNFT) {
          const nftContractAddress = await treeContract.getNFTContract();
          const nftContract = new ethers.Contract(nftContractAddress, NFT_ABI, wallet);
          const balanceBigInt = await nftContract.getNodeTokenBalance(nodeId);
          const balance = Number(balanceBigInt);
          
          // Emit balance update to all connected clients
          io.emit('tokenBalanceUpdate', {
            balance,
            nodeId,
            treeAddress,
            timestamp: new Date().toISOString()
          });
          
          console.log(`📡 Token balance updated for node ${nodeId}: ${balance} tokens`);
        } else {
          console.log(`📡 Skipping token balance update for lightweight node ${nodeId}`);
        }
      } catch (balanceError) {
        console.error('Error fetching updated token balance:', balanceError);
      }
      
    } catch (error) {
      console.error('Error updating node via backend:', error);
      socket.emit('updateComplete', {
        success: false,
        error: error.message
      });
    } finally {
      // Always remove the operation lock
      ongoingOperations.delete(nodeId);
    }
  });
}

module.exports = {
  handleUpdateNode
};