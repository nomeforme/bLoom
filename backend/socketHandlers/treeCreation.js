const { ethers } = require('ethers');
const { factory } = require('../config/blockchain');
const { emitGasCost } = require('../utils/gasTracker');
const { ipfsService } = require('../services/ipfsService');

function handleTreeCreation(socket, io) {
  socket.on('createTree', async (data) => {
    const { rootContent, userAccount, storageMode = 'full', model = 'manual' } = data;
    
    try {
      console.log('🌳 Creating tree with server signing:', {
        rootContentLength: rootContent?.length || 0,
        userAccount,
        storageMode,
        model,
        requestedBy: socket.id
      });

      // Validate inputs
      if (!rootContent || !rootContent.trim()) {
        throw new Error('Root content is required');
      }
      
      if (!userAccount || userAccount === '0x0000000000000000000000000000000000000000') {
        throw new Error('User account is required for tree creation');
      }

      // Calculate token supply using same logic as frontend (characters / 4, minimum 1)
      const calculateTokenSupply = (content) => {
        if (!content) return 1;
        return Math.max(1, Math.floor(content.length / 4));
      };

      let finalContent = rootContent.trim();
      const rootTokenSupply = calculateTokenSupply(finalContent);
      
      // Handle IPFS mode - pin content first if requested
      if (storageMode === 'ipfs') {
        try {
          console.log('🌐 Pinning root content to IPFS...');
          const pinResult = await ipfsService.pinText(finalContent, {
            userAccount,
            name: `loom-tree-root-${Date.now()}`
          });
          finalContent = `ipfs:${pinResult.hash}`;
          console.log('✅ Root content pinned to IPFS:', pinResult.hash);
        } catch (ipfsError) {
          console.error('❌ IPFS pinning failed, using direct storage:', ipfsError);
          // Keep original content and continue
        }
      }

      console.log('🔗 Creating tree on blockchain:', {
        finalContentLength: finalContent.length,
        rootTokenSupply,
        model
      });

      // Use createTree with user as creator parameter
      console.log('🔗 Creating tree for user:', { userAccount, model });
      const tx = await factory.createTree(finalContent, rootTokenSupply, model, userAccount);
      const receipt = await tx.wait();

      console.log('📄 Tree creation receipt:', {
        status: receipt.status,
        gasUsed: receipt.gasUsed?.toString(),
        transactionHash: receipt.transactionHash || receipt.hash,
        logs: receipt.logs?.length || 0
      });

      // Track gas cost for tree creation
      const modeDescription = storageMode === 'full' ? 'NFT/Token' : storageMode === 'lightweight' ? 'Lightweight' : 'IPFS';
      await emitGasCost(receipt, 'Tree Creation', `Created new tree (${rootContent.length} chars) - ${modeDescription}`, io);

      // Find the TreeCreated event
      const treeCreatedEvent = receipt.logs.find(log => {
        try {
          const parsed = factory.interface.parseLog(log);
          return parsed.name === 'TreeCreated';
        } catch {
          return false;
        }
      });

      // Find the NodeCreated event (for root node) in the same transaction
      const { ethers } = require('ethers');
      const { TREE_ABI } = require('../config/blockchain');
      const treeInterface = new ethers.Interface(TREE_ABI);
      
      const nodeCreatedEvent = receipt.logs.find(log => {
        try {
          const parsed = treeInterface.parseLog(log);
          return parsed.name === 'NodeCreated';
        } catch {
          return false;
        }
      });

      if (treeCreatedEvent) {
        const parsedTreeEvent = factory.interface.parseLog(treeCreatedEvent);
        const treeData = {
          treeId: parsedTreeEvent.args.treeId,
          treeAddress: parsedTreeEvent.args.treeAddress,
          nftContractAddress: parsedTreeEvent.args.nftContractAddress,
          creator: parsedTreeEvent.args.creator, // This will be the backend wallet for now
          rootContent: parsedTreeEvent.args.rootContent,
          requestedBy: userAccount, // Track who requested it
          model: model
        };

        console.log('✅ Tree created successfully:', {
          treeId: treeData.treeId.substring(0, 10) + '...',
          treeAddress: treeData.treeAddress,
          creator: treeData.creator,
          requestedBy: treeData.requestedBy
        });

        // Emit TreeCreated event to all connected clients
        console.log(`📡 Emitting treeCreated event to ${io.engine.clientsCount} clients`);
        io.emit('treeCreated', treeData);

        // Also emit NodeCreated event for the root node if found
        if (nodeCreatedEvent) {
          const parsedNodeEvent = treeInterface.parseLog(nodeCreatedEvent);
          const nodeData = {
            nodeId: parsedNodeEvent.args.nodeId,
            parentId: parsedNodeEvent.args.parentId, // Should be null/0x0 for root
            content: parsedTreeEvent.args.rootContent, // Get content from TreeCreated event
            author: parsedNodeEvent.args.author,
            timestamp: Number(parsedNodeEvent.args.timestamp),
            treeAddress: treeData.treeAddress, // Associate with the tree
            hasNFT: parsedNodeEvent.args.hasNFT,
            modelId: parsedNodeEvent.args.modelId || model,
            tokenId: parsedNodeEvent.args.tokenId ? Number(parsedNodeEvent.args.tokenId) : null,
            tokenBoundAccount: parsedNodeEvent.args.tokenBoundAccount || null,
            nodeTokenContract: parsedNodeEvent.args.nodeTokenContract || null
          };

          console.log('✅ Root node created:', {
            nodeId: nodeData.nodeId.substring(0, 10) + '...',
            hasNFT: nodeData.hasNFT,
            tokenId: nodeData.tokenId
          });

          // Emit NodeCreated event for the root node
          console.log(`📡 Emitting nodeCreated event for root node to ${io.engine.clientsCount} clients`);
          io.emit('nodeCreated', nodeData);
        } else {
          console.warn('⚠️ NodeCreated event not found for root node in tree creation transaction');
        }

        // Send success response to requesting client
        socket.emit('treeCreationComplete', {
          success: true,
          treeAddress: treeData.treeAddress,
          treeId: treeData.treeId,
          nftContractAddress: treeData.nftContractAddress,
          creator: treeData.creator,
          requestedBy: treeData.requestedBy,
          message: 'Tree created successfully'
        });

      } else {
        throw new Error('TreeCreated event not found in transaction receipt');
      }

    } catch (error) {
      console.error('❌ Error creating tree:', {
        error: error.message,
        stack: error.stack?.substring(0, 300),
        socketId: socket.id,
        userAccount
      });

      // Send error response to requesting client
      socket.emit('treeCreationComplete', {
        success: false,
        error: error.message,
        message: 'Failed to create tree'
      });

      // Also broadcast error to all clients
      console.log(`📡 Broadcasting tree creation error to all ${io.engine.clientsCount} clients`);
      io.emit('treeCreationError', {
        error: error.message,
        requestedBy: userAccount
      });
    }
  });
}

module.exports = {
  handleTreeCreation
};