// Chain configuration mapping chainId to native currency symbol
const CHAIN_CONFIG = {
  1: 'ETH',        // Ethereum Mainnet
  11155111: 'ETH', // Sepolia
  137: 'MATIC',    // Polygon
  80001: 'MATIC',  // Mumbai (Polygon Testnet)
  56: 'BNB',       // BSC
  97: 'BNB',       // BSC Testnet
  43114: 'AVAX',   // Avalanche
  43113: 'AVAX',   // Avalanche Testnet
  250: 'FTM',      // Fantom
  4002: 'FTM',     // Fantom Testnet
  10: 'ETH',       // Optimism
  420: 'ETH',      // Optimism Testnet
  42161: 'ETH',    // Arbitrum One
  421613: 'ETH',   // Arbitrum Testnet
  31337: 'ETH',    // Anvil/Hardhat local
  1337: 'ETH',     // Ganache local
};

/**
 * Get the native currency symbol for a given chain ID
 * @param {number|string} chainId - The chain ID
 * @returns {string} The native currency symbol (defaults to 'ETH')
 */
export const getNativeCurrencySymbol = (chainId) => {
  const numericChainId = typeof chainId === 'string' ? parseInt(chainId, 16) : chainId;
  return CHAIN_CONFIG[numericChainId] || 'ETH';
};

/**
 * Get the current chain's native currency symbol from provider
 * @param {object} provider - Ethers provider instance
 * @returns {Promise<string>} The native currency symbol
 */
export const getCurrentChainSymbol = async (provider) => {
  if (!provider) return 'ETH';
  
  try {
    const network = await provider.getNetwork();
    return getNativeCurrencySymbol(network.chainId);
  } catch (error) {
    console.warn('Could not determine chain ID, defaulting to ETH:', error);
    return 'ETH';
  }
};