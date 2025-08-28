const { ethers } = require('ethers');
const { TREE_ABI, NFT_ABI } = require('../config/blockchain');
const { wallet } = require('../config/blockchain');
const { generateText } = require('../services/textGeneration');
const { emitGasCost } = require('../utils/gasTracker');

function handleGenerateNodes(socket, io) {
  socket.on('generateNodes', async (data) => {
    const { treeAddress, parentId, parentContent, count = 3, userAccount, model = 'claude-3-haiku', temperature, maxTokens, lightweightMode = false } = data;
    
    try {
      // Get the tree contract
      const treeContract = new ethers.Contract(treeAddress, TREE_ABI, wallet);
      
      // Use provided content if available, otherwise fetch from blockchain
      let contextContent = parentContent || '';
      if (!contextContent && parentId !== '0x0000000000000000000000000000000000000000000000000000000000000000') {
        try {
          // Get NFT contract address from tree contract
          const nftContractAddress = await treeContract.getNFTContract();
          const nftContract = new ethers.Contract(nftContractAddress, NFT_ABI, wallet);
          
          // Fetch actual text content from NFT contract, not tree contract
          contextContent = await nftContract.getTextContent(parentId);
          console.log(`📖 Fetched parent content from NFT contract: "${contextContent.substring(0, 100)}${contextContent.length > 100 ? '...' : ''}"`);
        } catch (error) {
          console.warn('Could not fetch parent content from NFT contract:', error.message);
        }
      }
      
      // Generate text continuations
      const generations = [];
      for (let i = 0; i < count; i++) {
        try {
          // Use specified model (no more auto mode)
          const selectedModel = model || 'claude-3-haiku';
          
          // Log the prompt being sent to AI (first and last 100 chars)
          const promptLength = contextContent.length;
          const first100 = contextContent.substring(0, 100);
          const last100 = promptLength > 100 ? contextContent.substring(promptLength - 100) : '';
          console.log(`📝 promptUsed (${promptLength} chars):`, {
            first100: `"${first100}"`,
            last100: promptLength > 100 ? `"${last100}"` : '(same as first100)',
            fullPrompt: promptLength <= 200 ? `"${contextContent}"` : '(too long, see first/last 100)'
          });
          
          const result = await generateText(contextContent, selectedModel, temperature, maxTokens);
          
          // Handle both old string format and new object format for backward compatibility
          const generatedText = typeof result === 'string' ? result : result?.text;
          const completionTokens = typeof result === 'object' ? (result?.completionTokens || 0) : 0;
          
          console.log(`🔍 Generation ${i + 1}/${count} result:`, {
            model: selectedModel,
            hasText: !!generatedText,
            length: generatedText?.length || 0,
            words: generatedText ? generatedText.split(/\s+/).length : 0,
            completionTokens: completionTokens,
            firstChars: generatedText?.substring(0, 50) || 'null/empty'
          });
          
          if (generatedText && generatedText.trim()) {
            generations.push({
              text: generatedText.trim(),
              completionTokens: Math.max(completionTokens, 1) // Ensure at least 1 token for supply
            });
            console.log(`✅ Added generation ${i + 1} to array:`, {
              totalGenerations: generations.length,
              textLength: generatedText.trim().length,
              completionTokens: completionTokens,
              promptUsed: contextContent.substring(0, 100) + '...'
            });
          } else {
            console.error(`❌ Empty response generating text ${i + 1} with model ${selectedModel}`);
            // Skip this generation - don't add to generations array
          }
        } catch (error) {
          console.error(`Error generating text ${i + 1}:`, error.message);
          // Skip this generation - don't add placeholder
        }
      }
      
      // Add generated nodes to blockchain sequentially to avoid nonce conflicts
      let successCount = 0;
      console.log(`🔗 Starting blockchain node creation for ${generations.length} generated texts`);
      
      for (let i = 0; i < generations.length; i++) {
        const generation = generations[i];
        const content = generation.text;
        const tokenSupply = generation.completionTokens;
        
        console.log(`🔗 Creating node ${i + 1}/${generations.length}:`, {
          contentLength: content.length,
          completionTokens: tokenSupply,
          hasUserAccount: !!userAccount,
          userAccount: userAccount
        });
        
        try {
          // Add small delay between transactions to avoid nonce conflicts
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
          // Use addNodeDirect with createNFT flag based on lightweightMode
          const tx = await treeContract.addNodeDirect(
            parentId, 
            content, 
            !lightweightMode // createNFT = true when NOT in lightweight mode
          );
          
          console.log(`📝 Transaction sent for node ${i + 1}, waiting for receipt...`);
          const receipt = await tx.wait();
          
          console.log(`📄 Receipt for node ${i + 1}:`, {
            status: receipt.status,
            gasUsed: receipt.gasUsed?.toString(),
            logs: receipt.logs?.length || 0,
            transactionHash: receipt.transactionHash || receipt.hash,
            blockNumber: receipt.blockNumber,
            receiptStructure: Object.keys(receipt)
          });
          
          // Track gas cost for node creation
          const modeDescription = lightweightMode ? 'Direct Storage' : 'NFT/Token';
          await emitGasCost(receipt, 'Node Creation', `Generated child node ${i + 1} with AI model: ${model} - ${modeDescription}`, io);
          
          // Log all events for debugging
          console.log(`🔍 Looking for NodeCreated event signature: ${ethers.id('NodeCreated(bytes32,bytes32,address,uint256)')}`);
          
          receipt.logs.forEach((log, index) => {
            try {
              const parsed = treeContract.interface.parseLog(log);
              console.log(`📝 Event ${index}:`, parsed.name, parsed.args);
            } catch (e) {
              // Only log as unparseable if it's from our tree contract
              if (log.address && log.address.toLowerCase() === treeAddress.toLowerCase()) {
                console.log(`📝 Unparseable log ${index} from tree contract:`, {
                  address: log.address,
                  topic0: log.topics?.[0],
                  allTopics: log.topics,
                  error: e.message
                });
              } else {
                console.log(`📝 Log ${index} from other contract (${log.address}) - skipping`);
              }
            }
          });
          
          // Find the NodeCreated event
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
            const nodeData = {
              nodeId: parsedEvent.args.nodeId,
              parentId: parsedEvent.args.parentId,
              content: content, // Use the original content, not from event (event doesn't include content)
              author: parsedEvent.args.author,
              timestamp: Number(parsedEvent.args.timestamp),
              treeAddress: treeAddress
            };
            
            console.log(`✅ Node ${i + 1} created successfully:`, {
              nodeId: nodeData.nodeId.substring(0, 10) + '...',
              author: nodeData.author,
              contentLength: nodeData.content.length
            });
            
            // Emit to all connected clients
            console.log(`📡 Emitting nodeCreated event to ${io.engine.clientsCount} clients`);
            io.emit('nodeCreated', nodeData);
            successCount++;
          } else {
            console.error(`❌ No NodeCreated event found for node ${i + 1}`);
          }
        } catch (error) {
          console.error(`❌ Error adding node ${i + 1} to blockchain:`, {
            error: error.message,
            stack: error.stack?.substring(0, 200),
            nodeIndex: i + 1,
            totalNodes: generations.length
          });
        }
      }
      
      console.log(`🔗 Blockchain node creation complete: ${successCount}/${generations.length} successful`);
      
      const failedCount = count - successCount;
      const response = {
        success: successCount > 0,
        successCount,
        failedCount,
        totalRequested: count,
        message: successCount > 0 ? 
          `Generated ${successCount}/${count} sibling nodes successfully` :
          'All generation attempts failed'
      };

      // Only add warnings if SOME (not all) generations failed
      if (failedCount > 0 && successCount > 0) {
        response.warnings = [`${failedCount} generation${failedCount > 1 ? 's' : ''} failed or returned empty responses`];
      }

      console.log(`📡 Sending generationComplete to socket ${socket.id}:`, response);
      
      // Emit to the requesting socket
      socket.emit('generationComplete', response);
      
      // Also emit to all connected clients as backup
      console.log(`📡 Broadcasting generationComplete to all ${io.engine.clientsCount} clients`);
      io.emit('generationComplete', response);
      
    } catch (error) {
      console.error('Error in generateNodes:', {
        error: error.message,
        stack: error.stack?.substring(0, 300),
        socketId: socket.id
      });
      
      const errorResponse = {
        success: false,
        error: error.message,
        successCount: 0,
        failedCount: count,
        totalRequested: count
      };
      
      // Emit to the requesting socket
      socket.emit('generationComplete', errorResponse);
      
      // Also broadcast to all clients as backup
      console.log(`📡 Broadcasting error response to all ${io.engine.clientsCount} clients`);
      io.emit('generationComplete', errorResponse);
    }
  });
}

module.exports = {
  handleGenerateNodes
};