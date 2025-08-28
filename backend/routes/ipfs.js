const express = require('express');
const { ipfsService } = require('../services/ipfsService');
const router = express.Router();

// Middleware for IPFS availability check
const requireIPFS = (req, res, next) => {
  if (!ipfsService.isConfigured()) {
    return res.status(503).json({
      error: 'IPFS service not configured',
      message: 'Please set Pinata credentials in environment variables'
    });
  }
  next();
};

// Health check endpoint
router.get('/health', async (req, res) => {
  try {
    const health = await ipfsService.healthCheck();
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'disabled' ? 503 : 500;
    
    res.status(statusCode).json(health);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: error.message
    });
  }
});

// Pin text content to IPFS
router.post('/pin/text', requireIPFS, async (req, res) => {
  try {
    const { text, metadata = {} } = req.body;
    
    if (!text) {
      return res.status(400).json({
        error: 'Missing required field: text'
      });
    }

    const result = await ipfsService.pinText(text, {
      name: metadata.name || `loom-node-${Date.now()}`,
      treeAddress: metadata.treeAddress,
      parentId: metadata.parentId,
      metadata: metadata.custom || {}
    });

    res.json({
      success: true,
      hash: result.hash,
      gatewayUrl: result.gatewayUrl,
      pinSize: result.pinSize,
      timestamp: result.timestamp
    });
  } catch (error) {
    console.error('IPFS pin text error:', error);
    res.status(500).json({
      error: 'Failed to pin text to IPFS',
      message: error.message
    });
  }
});

// Pin JSON content to IPFS
router.post('/pin/json', requireIPFS, async (req, res) => {
  try {
    const { content, metadata = {} } = req.body;
    
    if (!content) {
      return res.status(400).json({
        error: 'Missing required field: content'
      });
    }

    const result = await ipfsService.pinJSON(content, {
      name: metadata.name || `loom-json-${Date.now()}`,
      treeAddress: metadata.treeAddress,
      parentId: metadata.parentId,
      metadata: metadata.custom || {}
    });

    res.json({
      success: true,
      hash: result.hash,
      gatewayUrl: result.gatewayUrl,
      pinSize: result.pinSize,
      timestamp: result.timestamp
    });
  } catch (error) {
    console.error('IPFS pin JSON error:', error);
    res.status(500).json({
      error: 'Failed to pin JSON to IPFS',
      message: error.message
    });
  }
});

// Get content from IPFS by hash
router.get('/get/:hash', async (req, res) => {
  try {
    const { hash } = req.params;
    
    if (!ipfsService.isValidHash(hash)) {
      return res.status(400).json({
        error: 'Invalid IPFS hash format'
      });
    }

    const content = await ipfsService.getContent(hash);
    
    res.json({
      success: true,
      content,
      gatewayUrl: ipfsService.getGatewayUrl(hash)
    });
  } catch (error) {
    console.error('IPFS get content error:', error);
    res.status(500).json({
      error: 'Failed to retrieve content from IPFS',
      message: error.message
    });
  }
});

// Get text content from IPFS by hash
router.get('/get/:hash/text', async (req, res) => {
  try {
    const { hash } = req.params;
    
    if (!ipfsService.isValidHash(hash)) {
      return res.status(400).json({
        error: 'Invalid IPFS hash format'
      });
    }

    const text = await ipfsService.getText(hash);
    
    res.json({
      success: true,
      text,
      gatewayUrl: ipfsService.getGatewayUrl(hash)
    });
  } catch (error) {
    console.error('IPFS get text error:', error);
    res.status(500).json({
      error: 'Failed to retrieve text from IPFS',
      message: error.message
    });
  }
});

// Resolve node content (handles both regular content and IPFS references)
router.post('/resolve', async (req, res) => {
  try {
    const { content } = req.body;
    
    if (content === undefined) {
      return res.status(400).json({
        error: 'Missing required field: content'
      });
    }

    const resolved = await ipfsService.resolveNodeContent(content);
    
    res.json({
      success: true,
      originalContent: content,
      resolvedContent: resolved,
      isIPFS: ipfsService.isIPFSReference(content)
    });
  } catch (error) {
    console.error('IPFS resolve content error:', error);
    res.status(500).json({
      error: 'Failed to resolve content',
      message: error.message
    });
  }
});

// List pins with optional filtering
router.get('/pins', requireIPFS, async (req, res) => {
  try {
    const { limit = 100, treeAddress, type } = req.query;
    
    const filters = {};
    const metadata = {};
    
    if (treeAddress) {
      metadata.treeAddress = treeAddress;
    }
    
    if (type) {
      metadata.type = type;
    }

    const result = await ipfsService.listPins({
      limit: parseInt(limit),
      metadata,
      filters
    });

    res.json({
      success: true,
      pins: result.rows || [],
      count: result.count || 0
    });
  } catch (error) {
    console.error('IPFS list pins error:', error);
    res.status(500).json({
      error: 'Failed to list pins',
      message: error.message
    });
  }
});

// Unpin content from IPFS (admin only - use with caution)
router.delete('/unpin/:hash', requireIPFS, async (req, res) => {
  try {
    const { hash } = req.params;
    
    if (!ipfsService.isValidHash(hash)) {
      return res.status(400).json({
        error: 'Invalid IPFS hash format'
      });
    }

    const result = await ipfsService.unpin(hash);
    
    res.json({
      success: true,
      message: `Successfully unpinned ${hash}`
    });
  } catch (error) {
    console.error('IPFS unpin error:', error);
    res.status(500).json({
      error: 'Failed to unpin content',
      message: error.message
    });
  }
});

// Utility endpoint to check if content is IPFS reference
router.post('/is-ipfs', (req, res) => {
  try {
    const { content } = req.body;
    
    res.json({
      success: true,
      isIPFS: ipfsService.isIPFSReference(content),
      hash: ipfsService.extractIPFSHash(content)
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to check IPFS reference',
      message: error.message
    });
  }
});

module.exports = router;