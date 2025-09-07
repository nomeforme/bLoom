const { ethers } = require('ethers');
const { TREE_ABI } = require('../config/blockchain');
const { wallet, provider } = require('../config/blockchain');
const { sortNodesByDependency } = require('../utils/nodeUtils');
const { emitGasCost } = require('../utils/gasTracker');

function handleImportNodes(socket, io) {
  socket.on('importNodes', async (data) => {
    const { treeAddress, rootId, oldRootId, nodes, userAccount } = data;
    
    try {
      // Verify the tree contract exists and is accessible
      try {
        const code = await provider.getCode(treeAddress);
        if (code === '0x') {
          throw new Error(`No contract found at address ${treeAddress}`);
        }
      } catch (error) {
        console.error('Contract verification failed:', error);
        throw new Error(`Failed to verify tree contract: ${error.message}`);
      }
      
      // Get the tree contract
      const treeContract = new ethers.Contract(treeAddress, TREE_ABI, wallet);
      
      // Test the contract by calling a simple read function
      try {
        const nodeCount = await treeContract.getNodeCount();
      } catch (error) {
        console.error('Tree contract test call failed:', error);
        throw new Error(`Tree contract not responsive: ${error.message}`);
      }
      
      // Create mapping from old node IDs to new node IDs
      const nodeIdMapping = new Map();
      
      // Map old root to new root
      if (oldRootId && rootId) {
        nodeIdMapping.set(oldRootId, rootId);
      }
      
      // Sort nodes by dependency order (parents before children)
      const sortedNodes = sortNodesByDependency(nodes, oldRootId);
      
      let successCount = 0;
      let failureCount = 0;
      
      // Add nodes to blockchain sequentially
      for (let i = 0; i < sortedNodes.length; i++) {
        const nodeData = sortedNodes[i];
        try {
          // Map the parent ID to the new blockchain ID
          let parentIdToUse = nodeData.parentId;
          
          if (nodeData.parentId === oldRootId) {
            // Parent is the old root, use new root ID
            parentIdToUse = rootId;
          } else if (nodeIdMapping.has(nodeData.parentId)) {
            // Use mapped parent ID
            parentIdToUse = nodeIdMapping.get(nodeData.parentId);
          } else {
            console.warn(`Parent node ${nodeData.parentId.substring(0, 8)} not found in mapping for node ${i + 1}`);
            failureCount++;
            continue; // Skip this node
          }
          
          // Add small delay between transactions to avoid nonce conflicts
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          // Use addNodeWithTokenForUser if userAccount is provided, otherwise use addNodeWithToken
          const tx = userAccount && userAccount !== "0x0000000000000000000000000000000000000000"
            ? await treeContract.addNodeWithTokenForUser(
                parentIdToUse, 
                nodeData.content, 
                "NODE", 
                "NODE",
                userAccount, // Set the user as the author and NFT owner
                nodeData.modelId || '' // Use original modelId if available
              )
            : await treeContract.addNodeWithToken(
                parentIdToUse, 
                nodeData.content, 
                "NODE", 
                "NODE",
                nodeData.modelId || '' // Use original modelId if available
              );
          const receipt = await tx.wait();
          
          // Track gas cost for imported node creation
          await emitGasCost(receipt, 'Node Creation', `Imported node ${i + 1}/${sortedNodes.length} (${nodeData.content.length} chars)`, io);
          
          // Find the NodeCreated event to get the new node ID
          const nodeCreatedEvent = receipt.logs.find(log => {
            try {
              const parsed = treeContract.interface.parseLog(log);
              return parsed.name === 'NodeCreated';
            } catch {
              return false;
            }
          });
          
          if (nodeCreatedEvent) {
            const parsedEvent = treeContract.interface.parseLog(nodeCreatedEvent);
            const newNodeId = parsedEvent.args.nodeId;
            
            // Store mapping for future children
            nodeIdMapping.set(nodeData.nodeId, newNodeId);
            
            const broadcastData = {
              nodeId: newNodeId,
              parentId: parsedEvent.args.parentId,
              content: parsedEvent.args.content,
              author: parsedEvent.args.author,
              timestamp: Number(parsedEvent.args.timestamp),
              treeAddress: treeAddress,
              hasNFT: parsedEvent.args.hasNFT || false,
              ipfsHash: parsedEvent.args.ipfsHash || null,
              modelId: nodeData.modelId || '', // Use original modelId if available from import data
              tokenId: parsedEvent.args.tokenId ? Number(parsedEvent.args.tokenId) : null,
              tokenBoundAccount: parsedEvent.args.tokenBoundAccount || null,
              nodeTokenContract: parsedEvent.args.nodeTokenContract || null
            };
            
            // Emit to all connected clients
            io.emit('nodeCreated', broadcastData);
            successCount++;
          } else {
            console.error('NodeCreated event not found in receipt');
            failureCount++;
          }
        } catch (error) {
          console.error(`Error importing node ${i + 1}:`, error.message);
          failureCount++;
        }
      }
      
      socket.emit('importComplete', {
        success: true,
        message: `Import completed: ${successCount} successful, ${failureCount} failed`,
        successCount,
        failureCount,
        totalNodes: sortedNodes.length
      });
      
    } catch (error) {
      console.error('Error in importNodes:', error);
      socket.emit('importComplete', {
        success: false,
        error: error.message
      });
    }
  });
}

module.exports = {
  handleImportNodes
};