const { ethers } = require('ethers');
const { TREE_ABI, NFT_ABI } = require('../config/blockchain');
const { wallet } = require('../config/blockchain');
const { queueTransaction } = require('../services/transactionQueue');
const { emitGasCost } = require('../utils/gasTracker');

function handleUpdateNode(socket, io) {
  socket.on('updateNode', async (data) => {
    const { treeAddress, nodeId, newContent, options } = data;
    
    console.log('Received updateNode request:', { treeAddress, nodeId, newContent, options });
    
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
        
        // Wait a moment to avoid nonce conflicts
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Create child node - no manual token burning needed
        
        // Create the child node with appropriate mode
        const childReceipt = await queueTransaction(async (nonce) => {
          const childTx = await treeContract.addNodeDirect(
            nodeId, 
            options.childContent,
            !options.lightweightMode, // createNFT = true when NOT in lightweight mode
            { nonce }
          );
          return await childTx.wait();
        });
        childTxHash = childReceipt.hash;
        
        // Track gas cost for child node creation
        const childMode = options.lightweightMode ? 'Direct Storage' : 'NFT/Token';
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
        
        // Wait a moment to avoid nonce conflicts
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Create sibling node - no manual token burning needed
        
        // Create the sibling node with appropriate mode (same parent as current node)
        const siblingReceipt = await queueTransaction(async (nonce) => {
          const siblingTx = await treeContract.addNodeDirect(
            options.parentId, 
            options.siblingContent,
            !options.lightweightMode, // createNFT = true when NOT in lightweight mode
            { nonce }
          );
          return await siblingTx.wait();
        });
        childTxHash = siblingReceipt.hash; // Reuse the childTxHash variable for consistency
        
        // Track gas cost for sibling node creation
        const siblingMode = options.lightweightMode ? 'Direct Storage' : 'NFT/Token';
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
    }
  });
}

module.exports = {
  handleUpdateNode
};