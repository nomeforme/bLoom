const express = require('express');
const router = express.Router();
const { 
  getAllChainConfigs, 
  getActiveChainConfig,
  setActiveChain,
  getChainConfig,
  getAliases,
  getSupportedChainIds,
  isChainConfigured
} = require('../config/chainConfig');

/**
 * GET /api/chains
 * Get all available chain configurations (without private keys)
 */
router.get('/', (req, res) => {
  try {
    const chains = getAllChainConfigs();
    res.json({
      success: true,
      data: chains
    });
  } catch (error) {
    console.error('Error getting chain configurations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve chain configurations'
    });
  }
});

/**
 * GET /api/chains/active
 * Get the currently active chain configuration
 */
router.get('/active', (req, res) => {
  try {
    const activeChain = getActiveChainConfig();
    // Remove private key for security
    const { privateKey, ...safeChain } = activeChain;
    
    res.json({
      success: true,
      data: safeChain
    });
  } catch (error) {
    console.error('Error getting active chain configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve active chain configuration'
    });
  }
});

/**
 * POST /api/chains/active
 * Set the active chain
 */
router.post('/active', (req, res) => {
  try {
    const { chainId } = req.body;
    
    if (!chainId) {
      return res.status(400).json({
        success: false,
        error: 'Chain ID or alias is required'
      });
    }
    
    setActiveChain(chainId);
    const newActiveChain = getActiveChainConfig();
    const { privateKey, ...safeChain } = newActiveChain;
    
    res.json({
      success: true,
      message: `Successfully switched to ${safeChain.name}`,
      data: safeChain
    });
  } catch (error) {
    console.error('Error setting active chain:', error);
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/chains/aliases
 * Get all available chain aliases
 */
router.get('/aliases', (req, res) => {
  try {
    const aliases = getAliases();
    res.json({
      success: true,
      data: aliases
    });
  } catch (error) {
    console.error('Error getting chain aliases:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve chain aliases'
    });
  }
});

/**
 * GET /api/chains/supported
 * Get list of supported chain IDs
 */
router.get('/supported', (req, res) => {
  try {
    const chainIds = getSupportedChainIds();
    res.json({
      success: true,
      data: chainIds
    });
  } catch (error) {
    console.error('Error getting supported chain IDs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve supported chain IDs'
    });
  }
});

/**
 * GET /api/chains/:id
 * Get configuration for a specific chain
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    if (!isChainConfigured(id)) {
      return res.status(404).json({
        success: false,
        error: 'Chain not found'
      });
    }
    
    const chainConfig = getChainConfig(id);
    // Remove private key for security
    const { privateKey, ...safeChain } = chainConfig;
    
    res.json({
      success: true,
      data: safeChain
    });
  } catch (error) {
    console.error('Error getting chain configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve chain configuration'
    });
  }
});

module.exports = router;