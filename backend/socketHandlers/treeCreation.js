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

      if (treeCreatedEvent) {
        const parsedEvent = factory.interface.parseLog(treeCreatedEvent);
        const treeData = {
          treeId: parsedEvent.args.treeId,
          treeAddress: parsedEvent.args.treeAddress,
          nftContractAddress: parsedEvent.args.nftContractAddress,
          creator: parsedEvent.args.creator, // This will be the backend wallet for now
          rootContent: parsedEvent.args.rootContent,
          requestedBy: userAccount, // Track who requested it
          model: model
        };

        console.log('✅ Tree created successfully:', {
          treeId: treeData.treeId.substring(0, 10) + '...',
          treeAddress: treeData.treeAddress,
          creator: treeData.creator,
          requestedBy: treeData.requestedBy
        });

        // Emit to all connected clients
        console.log(`📡 Emitting treeCreated event to ${io.engine.clientsCount} clients`);
        io.emit('treeCreated', treeData);

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