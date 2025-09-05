/**
 * Multi-chain configuration utility
 * Reads chain configuration from chains.json and private keys from environment variables
 */

const fs = require('fs');
const path = require('path');

// Load chains configuration
const chainsConfigPath = path.join(__dirname, 'chains.json');
let chainsConfig;

function loadChainsConfig() {
  if (!chainsConfig) {
    try {
      const configData = fs.readFileSync(chainsConfigPath, 'utf8');
      chainsConfig = JSON.parse(configData);
    } catch (error) {
      console.error('Error loading chains configuration:', error.message);
      throw new Error('Failed to load chains configuration');
    }
  }
  return chainsConfig;
}

/**
 * Resolve chain ID from alias or return as-is
 * @param {string|number} chainIdOrAlias - Chain ID or alias (e.g., 'local', 'sepolia')
 * @returns {string} Chain ID
 */
function resolveChainId(chainIdOrAlias) {
  const config = loadChainsConfig();
  const input = chainIdOrAlias.toString().toLowerCase();
  
  // Check if it's an alias
  if (config.aliases && config.aliases[input]) {
    return config.aliases[input].toString();
  }
  
  return chainIdOrAlias.toString();
}

/**
 * Get configuration for a specific chain
 * @param {string|number} chainIdOrAlias - The chain ID or alias
 * @returns {object} Chain configuration object
 */
function getChainConfig(chainIdOrAlias) {
  const config = loadChainsConfig();
  const chainId = resolveChainId(chainIdOrAlias);
  
  if (!config.chains[chainId]) {
    throw new Error(`Chain configuration not found for ID: ${chainId}`);
  }

  const chainConfig = { ...config.chains[chainId] };
  
  // Add private key from environment variables
  const privateKey = process.env[`PRIVATE_KEY_${chainId}`] || process.env.PRIVATE_KEY;
  if (privateKey) {
    chainConfig.privateKey = privateKey;
  }

  return chainConfig;
}

/**
 * Get the currently active chain configuration
 * @returns {object} Active chain configuration
 */
function getActiveChainConfig() {
  const config = loadChainsConfig();
  const activeChainId = config.activeChainId;
  
  return getChainConfig(activeChainId);
}

/**
 * Set the active chain
 * @param {string|number} chainIdOrAlias - Chain ID or alias to set as active
 */
function setActiveChain(chainIdOrAlias) {
  const config = loadChainsConfig();
  const chainId = resolveChainId(chainIdOrAlias);
  
  // Verify chain exists
  if (!config.chains[chainId]) {
    throw new Error(`Chain configuration not found for ID: ${chainId}`);
  }
  
  config.activeChainId = chainId;
  
  // Write back to file
  fs.writeFileSync(chainsConfigPath, JSON.stringify(config, null, 2));
  
  // Reload config
  chainsConfig = null;
}

/**
 * Get all available chain configurations (without private keys for security)
 * @returns {object} Object with chainId as keys and config as values
 */
function getAllChainConfigs() {
  const config = loadChainsConfig();
  const chains = {};
  
  Object.keys(config.chains).forEach(chainId => {
    const chainConfig = { ...config.chains[chainId] };
    // Remove private key for security
    delete chainConfig.privateKey;
    chains[chainId] = chainConfig;
  });

  return chains;
}

/**
 * Get all available chain configurations with private keys (for server use)
 * @returns {object} Object with chainId as keys and config as values
 */
function getAllChainConfigsWithKeys() {
  const config = loadChainsConfig();
  const chains = {};
  
  Object.keys(config.chains).forEach(chainId => {
    chains[chainId] = getChainConfig(chainId);
  });

  return chains;
}

/**
 * Check if a chain is configured
 * @param {string|number} chainIdOrAlias - The chain ID or alias to check
 * @returns {boolean} True if chain is configured
 */
function isChainConfigured(chainIdOrAlias) {
  try {
    const config = loadChainsConfig();
    const chainId = resolveChainId(chainIdOrAlias);
    return !!config.chains[chainId];
  } catch (error) {
    return false;
  }
}

/**
 * Get supported chain IDs
 * @returns {string[]} Array of supported chain IDs
 */
function getSupportedChainIds() {
  const config = loadChainsConfig();
  return Object.keys(config.chains);
}

/**
 * Get all available aliases
 * @returns {object} Object with alias as keys and chain IDs as values
 */
function getAliases() {
  const config = loadChainsConfig();
  return config.aliases || {};
}

/**
 * Get chain name by ID or alias
 * @param {string|number} chainIdOrAlias - Chain ID or alias
 * @returns {string} Chain name
 */
function getChainName(chainIdOrAlias) {
  try {
    const chainConfig = getChainConfig(chainIdOrAlias);
    return chainConfig.name;
  } catch (error) {
    return 'Unknown Chain';
  }
}

module.exports = {
  getChainConfig,
  getActiveChainConfig,
  setActiveChain,
  getAllChainConfigs,
  getAllChainConfigsWithKeys,
  isChainConfigured,
  getSupportedChainIds,
  getAliases,
  getChainName,
  resolveChainId
};