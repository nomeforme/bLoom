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
    const { treeAddress, nodeId, newContent, options } = data;
    
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
      
      // Token adjustments for direct edits are now handled automatically by the contract
      
      // Update the node content
      const updateReceipt = await queueTransaction(async (nonce) => {
        const updateTx = await treeContract.updateNodeContent(nodeId, newContent, { nonce });
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
        
        let finalChildContent = options.childContent;
        
        // Handle IPFS mode for child content
        if (options.storageMode === 'ipfs') {
          try {
            console.log('🌐 Pinning child content to IPFS...');
            const pinResult = await ipfsService.pinText(options.childContent, {
              treeAddress,
              parentId: nodeId,
              name: `loom-child-node-${Date.now()}`
            });
            finalChildContent = `ipfs:${pinResult.hash}`;
            console.log('✅ Child content pinned to IPFS:', pinResult.hash);
          } catch (ipfsError) {
            console.error('❌ IPFS pinning failed for child, using original content:', ipfsError);
            // Keep original content
          }
        }
        
        // Create the child node with appropriate mode
        const childReceipt = await queueTransaction(async (nonce) => {
          const childTx = data.userAccount && data.userAccount !== "0x0000000000000000000000000000000000000000"
            ? await treeContract.addNodeDirectForUser(
                nodeId, 
                finalChildContent,
                options.storageMode === 'full', // createNFT = true when in full mode
                data.userAccount, // Set the user as the author and NFT owner
                '', // modelId - blank for manual child nodes
                { nonce }
              )
            : await treeContract.addNodeDirect(
                nodeId, 
                finalChildContent,
                options.storageMode === 'full', // createNFT = true when in full mode
                '', // modelId - blank for manual child nodes
                { nonce }
              );
          return await childTx.wait();
        });
        childTxHash = childReceipt.hash;
        
        // Track gas cost for child node creation
        const childMode = options.storageMode === 'full' ? 'NFT/Token' : options.storageMode === 'lightweight' ? 'Direct Storage' : 'IPFS';
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
        }
      }
      
      // If options indicate we should create a sibling node
      if (options && options.createSibling && options.siblingContent && options.parentId) {
        console.log('Creating sibling node as part of update operation...');
        
        // Wait longer to ensure previous transaction is confirmed
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Create sibling node - no manual token burning needed
        
        let finalSiblingContent = options.siblingContent;
        
        // Handle IPFS mode for sibling content
        if (options.storageMode === 'ipfs') {
          try {
            console.log('🌐 Pinning sibling content to IPFS...');
            const pinResult = await ipfsService.pinText(options.siblingContent, {
              treeAddress,
              parentId: options.parentId,
              name: `loom-sibling-node-${Date.now()}`
            });
            finalSiblingContent = `ipfs:${pinResult.hash}`;
            console.log('✅ Sibling content pinned to IPFS:', pinResult.hash);
          } catch (ipfsError) {
            console.error('❌ IPFS pinning failed for sibling, using original content:', ipfsError);
            // Keep original content
          }
        }
        
        // Create the sibling node with appropriate mode (same parent as current node)
        const siblingReceipt = await queueTransaction(async (nonce) => {
          const siblingTx = data.userAccount && data.userAccount !== "0x0000000000000000000000000000000000000000"
            ? await treeContract.addNodeDirectForUser(
                options.parentId, 
                finalSiblingContent,
                options.storageMode === 'full', // createNFT = true when in full mode
                data.userAccount, // Set the user as the author and NFT owner
                '', // modelId - blank for manual sibling nodes
                { nonce }
              )
            : await treeContract.addNodeDirect(
                options.parentId, 
                finalSiblingContent,
                options.storageMode === 'full', // createNFT = true when in full mode
                '', // modelId - blank for manual sibling nodes
                { nonce }
              );
          return await siblingTx.wait();
        });
        childTxHash = siblingReceipt.hash; // Reuse the childTxHash variable for consistency
        
        // Track gas cost for sibling node creation
        const siblingMode = options.storageMode === 'full' ? 'NFT/Token' : options.storageMode === 'lightweight' ? 'Direct Storage' : 'IPFS';
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
        }
      }
      
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