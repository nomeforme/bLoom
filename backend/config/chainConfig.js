/**
 * Multi-chain configuration utility
 * Provides dynamic chain configuration based on environment variables
 */

/**
 * Get configuration for a specific chain
 * @param {string|number} chainId - The chain ID
 * @returns {object} Chain configuration object
 */
function getChainConfig(chainId) {
  const id = chainId.toString();
  
  const config = {
    chainId: parseInt(id),
    name: process.env[`CHAIN_${id}_NAME`],
    rpcUrl: process.env[`CHAIN_${id}_RPC_URL`],
    factoryAddress: process.env[`CHAIN_${id}_FACTORY_ADDRESS`],
    privateKey: process.env[`CHAIN_${id}_PRIVATE_KEY`],
    gasPrice: process.env[`CHAIN_${id}_GAS_PRICE`],
    baseFee: process.env[`CHAIN_${id}_BASE_FEE`],
    explorerUrl: process.env[`CHAIN_${id}_EXPLORER_URL`]
  };

  // Remove undefined values
  Object.keys(config).forEach(key => {
    if (config[key] === undefined) {
      delete config[key];
    }
  });

  return config;
}

/**
 * Get the currently active chain configuration
 * @returns {object} Active chain configuration
 */
function getActiveChainConfig() {
  const activeChainId = process.env.ACTIVE_CHAIN_ID || '31337';
  const config = getChainConfig(activeChainId);
  
  // Fallback to legacy env vars for backward compatibility
  return {
    chainId: parseInt(activeChainId),
    name: config.name || 'Local Chain',
    rpcUrl: config.rpcUrl || process.env.RPC_URL || 'http://localhost:8545',
    factoryAddress: config.factoryAddress || process.env.FACTORY_ADDRESS,
    privateKey: config.privateKey || process.env.PRIVATE_KEY,
    gasPrice: config.gasPrice,
    baseFee: config.baseFee,
    explorerUrl: config.explorerUrl,
    ...config
  };
}

/**
 * Get all available chain configurations
 * @returns {object} Object with chainId as keys and config as values
 */
function getAllChainConfigs() {
  const chains = {};
  
  // Extract chain IDs from environment variables
  const chainIds = new Set();
  Object.keys(process.env).forEach(key => {
    const match = key.match(/^CHAIN_(\d+)_/);
    if (match) {
      chainIds.add(match[1]);
    }
  });

  // Get config for each chain
  chainIds.forEach(chainId => {
    const config = getChainConfig(chainId);
    if (config.rpcUrl) { // Only include chains with RPC URL
      chains[chainId] = config;
    }
  });

  return chains;
}

/**
 * Check if a chain is configured
 * @param {string|number} chainId - The chain ID to check
 * @returns {boolean} True if chain is configured
 */
function isChainConfigured(chainId) {
  const config = getChainConfig(chainId);
  return !!config.rpcUrl;
}

/**
 * Get supported chain IDs
 * @returns {string[]} Array of supported chain IDs
 */
function getSupportedChainIds() {
  return Object.keys(getAllChainConfigs());
}

module.exports = {
  getChainConfig,
  getActiveChainConfig,
  getAllChainConfigs,
  isChainConfigured,
  getSupportedChainIds
};