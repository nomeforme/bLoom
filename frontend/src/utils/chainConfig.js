/**
 * Frontend multi-chain configuration utility
 * Provides dynamic chain configuration based on environment variables
 */

/**
 * Get configuration for a specific chain (frontend version)
 * @param {string|number} chainId - The chain ID
 * @returns {object} Chain configuration object
 */
export function getChainConfig(chainId) {
  const id = chainId.toString();
  
  const config = {
    chainId: parseInt(id),
    name: process.env[`REACT_APP_CHAIN_${id}_NAME`],
    rpcUrl: process.env[`REACT_APP_CHAIN_${id}_RPC_URL`],
    factoryAddress: process.env[`REACT_APP_CHAIN_${id}_FACTORY_ADDRESS`],
    explorerUrl: process.env[`REACT_APP_CHAIN_${id}_EXPLORER_URL`],
    gasPrice: process.env[`REACT_APP_CHAIN_${id}_GAS_PRICE`]
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
 * Get the currently active chain configuration (frontend version)
 * @returns {object} Active chain configuration
 */
export function getActiveChainConfig() {
  const activeChainId = process.env.REACT_APP_ACTIVE_CHAIN_ID || '31337';
  const config = getChainConfig(activeChainId);
  
  // Fallback to legacy env vars for backward compatibility
  return {
    chainId: parseInt(activeChainId),
    name: config.name || 'Local Chain',
    rpcUrl: config.rpcUrl || 'http://localhost:8545',
    factoryAddress: config.factoryAddress || process.env.REACT_APP_FACTORY_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    explorerUrl: config.explorerUrl,
    gasPrice: config.gasPrice,
    ...config
  };
}

/**
 * Get all available chain configurations (frontend version)
 * @returns {object} Object with chainId as keys and config as values
 */
export function getAllChainConfigs() {
  const chains = {};
  
  // Extract chain IDs from environment variables
  const chainIds = new Set();
  Object.keys(process.env).forEach(key => {
    const match = key.match(/^REACT_APP_CHAIN_(\d+)_/);
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
 * Check if a chain is configured (frontend version)
 * @param {string|number} chainId - The chain ID to check
 * @returns {boolean} True if chain is configured
 */
export function isChainConfigured(chainId) {
  const config = getChainConfig(chainId);
  return !!config.rpcUrl;
}

/**
 * Get supported chain IDs (frontend version)
 * @returns {string[]} Array of supported chain IDs
 */
export function getSupportedChainIds() {
  return Object.keys(getAllChainConfigs());
}

/**
 * Get the default RPC URL for the active chain
 * @returns {string} RPC URL
 */
export function getDefaultRpcUrl() {
  const config = getActiveChainConfig();
  return config.rpcUrl;
}