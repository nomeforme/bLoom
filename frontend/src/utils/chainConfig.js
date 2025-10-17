/**
 * Frontend multi-chain configuration utility
 * Fetches chain configuration from backend API
 */

import { getEnvironmentConfig } from './envConfig';

const { backendUrl: API_BASE_URL } = getEnvironmentConfig();

// Cache for chain configurations
let chainConfigCache = null;
let activeChainCache = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 30000; // 30 seconds

/**
 * Check if cache is valid
 * @returns {boolean} True if cache is still valid
 */
function isCacheValid() {
  return chainConfigCache && activeChainCache && (Date.now() - cacheTimestamp) < CACHE_DURATION;
}

/**
 * Fetch chain configuration from backend API
 * @returns {Promise<object>} Chain configurations
 */
async function fetchChainConfigs() {
  if (isCacheValid()) {
    return { chains: chainConfigCache, active: activeChainCache };
  }

  try {
    const [chainsResponse, activeResponse] = await Promise.all([
      fetch(`${API_BASE_URL}/api/chains`),
      fetch(`${API_BASE_URL}/api/chains/active`)
    ]);

    if (!chainsResponse.ok || !activeResponse.ok) {
      throw new Error('Failed to fetch chain configuration');
    }

    const chainsData = await chainsResponse.json();
    const activeData = await activeResponse.json();

    if (!chainsData.success || !activeData.success) {
      throw new Error('API returned error response');
    }

    // Update cache
    chainConfigCache = chainsData.data;
    activeChainCache = activeData.data;
    cacheTimestamp = Date.now();

    return { chains: chainConfigCache, active: activeChainCache };
  } catch (error) {
    console.error('Error fetching chain configuration:', error);
    // Return fallback configuration
    return getFallbackConfig();
  }
}

/**
 * Get fallback configuration when API is unavailable
 * @returns {object} Fallback chain configurations
 */
function getFallbackConfig() {
  const fallbackChains = {
    '31337': {
      chainId: 31337,
      name: 'Local Anvil',
      rpcUrl: 'http://localhost:8545',
      factoryAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
      explorerUrl: 'http://localhost:4000'
    },
    '11155111': {
      chainId: 11155111,
      name: 'Sepolia Testnet',
      rpcUrl: 'https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_API_KEY',
      factoryAddress: '0x0a275e9170D873374f7532e77Af34448D77C3a44',
      explorerUrl: 'https://sepolia.etherscan.io'
    }
  };

  return {
    chains: fallbackChains,
    active: fallbackChains['31337']
  };
}

/**
 * Get configuration for a specific chain
 * @param {string|number} chainId - The chain ID
 * @returns {Promise<object>} Chain configuration object
 */
export async function getChainConfig(chainId) {
  const { chains } = await fetchChainConfigs();
  return chains[chainId.toString()] || null;
}

/**
 * Get the currently active chain configuration
 * @returns {Promise<object>} Active chain configuration
 */
export async function getActiveChainConfig() {
  const { active } = await fetchChainConfigs();
  return active;
}

/**
 * Get all available chain configurations
 * @returns {Promise<object>} Object with chainId as keys and config as values
 */
export async function getAllChainConfigs() {
  const { chains } = await fetchChainConfigs();
  return chains;
}

/**
 * Check if a chain is configured
 * @param {string|number} chainId - The chain ID to check
 * @returns {Promise<boolean>} True if chain is configured
 */
export async function isChainConfigured(chainId) {
  const config = await getChainConfig(chainId);
  return !!config;
}

/**
 * Get supported chain IDs
 * @returns {Promise<string[]>} Array of supported chain IDs
 */
export async function getSupportedChainIds() {
  const chains = await getAllChainConfigs();
  return Object.keys(chains);
}

/**
 * Get the default RPC URL for the active chain
 * @returns {Promise<string>} RPC URL
 */
export async function getDefaultRpcUrl() {
  const config = await getActiveChainConfig();
  return config.rpcUrl;
}

/**
 * Switch the active chain (frontend helper)
 * @param {string|number} chainIdOrAlias - Chain ID or alias to switch to
 * @returns {Promise<object>} New active chain configuration
 */
export async function switchActiveChain(chainIdOrAlias) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/chains/active`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ chainId: chainIdOrAlias })
    });

    if (!response.ok) {
      throw new Error('Failed to switch chain');
    }

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to switch chain');
    }

    // Clear cache to force refresh
    chainConfigCache = null;
    activeChainCache = null;
    cacheTimestamp = 0;

    return data.data;
  } catch (error) {
    console.error('Error switching chain:', error);
    throw error;
  }
}

/**
 * Clear the configuration cache (useful for forcing refresh)
 */
export function clearConfigCache() {
  chainConfigCache = null;
  activeChainCache = null;
  cacheTimestamp = 0;
}

/**
 * Get chain aliases
 * @returns {Promise<object>} Object with alias as keys and chain IDs as values
 */
export async function getChainAliases() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/chains/aliases`);
    if (!response.ok) {
      throw new Error('Failed to fetch aliases');
    }
    const data = await response.json();
    return data.success ? data.data : {};
  } catch (error) {
    console.error('Error fetching aliases:', error);
    return {
      local: '31337',
      sepolia: '11155111',
      'scroll-sepolia': '534351'
    };
  }
}