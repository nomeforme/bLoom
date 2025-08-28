const { ipfsService } = require('../services/ipfsService');

const handleIPFSOperations = (io, socket) => {
  // Handle IPFS content pinning
  socket.on('ipfs:pin:text', async (data) => {
    try {
      const { text, metadata = {} } = data;
      
      if (!text) {
        socket.emit('ipfs:pin:text:error', {
          error: 'Missing required field: text'
        });
        return;
      }

      if (!ipfsService.isConfigured()) {
        socket.emit('ipfs:pin:text:error', {
          error: 'IPFS service not configured',
          message: 'Please set Pinata credentials in environment variables'
        });
        return;
      }

      console.log(`📌 IPFS: Pinning text content for client ${socket.id}`);
      
      const result = await ipfsService.pinText(text, {
        name: metadata.name || `loom-node-${Date.now()}`,
        treeAddress: metadata.treeAddress,
        parentId: metadata.parentId,
        metadata: {
          socketId: socket.id,
          ...metadata.custom
        }
      });

      socket.emit('ipfs:pin:text:success', {
        hash: result.hash,
        gatewayUrl: result.gatewayUrl,
        pinSize: result.pinSize,
        timestamp: result.timestamp
      });

      console.log(`✅ IPFS: Successfully pinned text to ${result.hash} for client ${socket.id}`);

    } catch (error) {
      console.error(`❌ IPFS: Failed to pin text for client ${socket.id}:`, error);
      socket.emit('ipfs:pin:text:error', {
        error: 'Failed to pin text to IPFS',
        message: error.message
      });
    }
  });

  // Handle IPFS JSON content pinning
  socket.on('ipfs:pin:json', async (data) => {
    try {
      const { content, metadata = {} } = data;
      
      if (!content) {
        socket.emit('ipfs:pin:json:error', {
          error: 'Missing required field: content'
        });
        return;
      }

      if (!ipfsService.isConfigured()) {
        socket.emit('ipfs:pin:json:error', {
          error: 'IPFS service not configured'
        });
        return;
      }

      console.log(`📌 IPFS: Pinning JSON content for client ${socket.id}`);
      
      const result = await ipfsService.pinJSON(content, {
        name: metadata.name || `loom-json-${Date.now()}`,
        treeAddress: metadata.treeAddress,
        parentId: metadata.parentId,
        metadata: {
          socketId: socket.id,
          ...metadata.custom
        }
      });

      socket.emit('ipfs:pin:json:success', {
        hash: result.hash,
        gatewayUrl: result.gatewayUrl,
        pinSize: result.pinSize,
        timestamp: result.timestamp
      });

    } catch (error) {
      console.error(`❌ IPFS: Failed to pin JSON for client ${socket.id}:`, error);
      socket.emit('ipfs:pin:json:error', {
        error: 'Failed to pin JSON to IPFS',
        message: error.message
      });
    }
  });

  // Handle IPFS content retrieval
  socket.on('ipfs:get', async (data) => {
    try {
      const { hash } = data;
      
      if (!hash) {
        socket.emit('ipfs:get:error', {
          error: 'Missing required field: hash'
        });
        return;
      }

      if (!ipfsService.isValidHash(hash)) {
        socket.emit('ipfs:get:error', {
          error: 'Invalid IPFS hash format'
        });
        return;
      }

      console.log(`📥 IPFS: Retrieving content ${hash} for client ${socket.id}`);
      
      const content = await ipfsService.getContent(hash);
      
      socket.emit('ipfs:get:success', {
        hash,
        content,
        gatewayUrl: ipfsService.getGatewayUrl(hash)
      });

    } catch (error) {
      console.error(`❌ IPFS: Failed to get content for client ${socket.id}:`, error);
      socket.emit('ipfs:get:error', {
        error: 'Failed to retrieve content from IPFS',
        message: error.message,
        hash: data.hash
      });
    }
  });

  // Handle IPFS text content retrieval
  socket.on('ipfs:get:text', async (data) => {
    try {
      const { hash } = data;
      
      if (!hash) {
        socket.emit('ipfs:get:text:error', {
          error: 'Missing required field: hash'
        });
        return;
      }

      if (!ipfsService.isValidHash(hash)) {
        socket.emit('ipfs:get:text:error', {
          error: 'Invalid IPFS hash format'
        });
        return;
      }

      console.log(`📥 IPFS: Retrieving text ${hash} for client ${socket.id}`);
      
      const text = await ipfsService.getText(hash);
      
      socket.emit('ipfs:get:text:success', {
        hash,
        text,
        gatewayUrl: ipfsService.getGatewayUrl(hash)
      });

    } catch (error) {
      console.error(`❌ IPFS: Failed to get text for client ${socket.id}:`, error);
      socket.emit('ipfs:get:text:error', {
        error: 'Failed to retrieve text from IPFS',
        message: error.message,
        hash: data.hash
      });
    }
  });

  // Handle content resolution (works with both regular content and IPFS references)
  socket.on('ipfs:resolve', async (data) => {
    try {
      const { content } = data;
      
      if (content === undefined) {
        socket.emit('ipfs:resolve:error', {
          error: 'Missing required field: content'
        });
        return;
      }

      const resolved = await ipfsService.resolveNodeContent(content);
      
      socket.emit('ipfs:resolve:success', {
        originalContent: content,
        resolvedContent: resolved,
        isIPFS: ipfsService.isIPFSReference(content),
        hash: ipfsService.extractIPFSHash(content)
      });

    } catch (error) {
      console.error(`❌ IPFS: Failed to resolve content for client ${socket.id}:`, error);
      socket.emit('ipfs:resolve:error', {
        error: 'Failed to resolve content',
        message: error.message
      });
    }
  });

  // Handle batch content resolution
  socket.on('ipfs:resolve:batch', async (data) => {
    try {
      const { contents } = data;
      
      if (!Array.isArray(contents)) {
        socket.emit('ipfs:resolve:batch:error', {
          error: 'Contents must be an array'
        });
        return;
      }

      console.log(`🔄 IPFS: Batch resolving ${contents.length} items for client ${socket.id}`);
      
      const results = await Promise.allSettled(
        contents.map(async (item) => {
          const resolved = await ipfsService.resolveNodeContent(item.content);
          return {
            nodeId: item.nodeId,
            originalContent: item.content,
            resolvedContent: resolved,
            isIPFS: ipfsService.isIPFSReference(item.content)
          };
        })
      );

      const resolved = results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          return {
            nodeId: contents[index].nodeId,
            originalContent: contents[index].content,
            resolvedContent: `[IPFS Error: ${result.reason.message}]`,
            isIPFS: ipfsService.isIPFSReference(contents[index].content),
            error: result.reason.message
          };
        }
      });
      
      socket.emit('ipfs:resolve:batch:success', {
        resolved
      });

    } catch (error) {
      console.error(`❌ IPFS: Failed batch resolve for client ${socket.id}:`, error);
      socket.emit('ipfs:resolve:batch:error', {
        error: 'Failed to resolve content batch',
        message: error.message
      });
    }
  });

  // Handle IPFS health check
  socket.on('ipfs:health', async () => {
    try {
      const health = await ipfsService.healthCheck();
      socket.emit('ipfs:health:result', health);
    } catch (error) {
      socket.emit('ipfs:health:result', {
        status: 'error',
        message: error.message
      });
    }
  });

  // Handle IPFS service status check
  socket.on('ipfs:status', () => {
    socket.emit('ipfs:status:result', {
      configured: ipfsService.isConfigured(),
      gatewayUrl: ipfsService.gatewayURL
    });
  });
  
  console.log(`🔌 IPFS: Socket handlers registered for client ${socket.id}`);
};

module.exports = {
  handleIPFSOperations
};