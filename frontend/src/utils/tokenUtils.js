/**
 * Utility functions for token calculations
 */

/**
 * Calculate token approximation based on content length
 * Formula: Math.max(1, Math.floor(content.length / 4))
 * 
 * @param {string} content - The content to calculate tokens for
 * @returns {number} - The approximate number of tokens (minimum 1)
 */
export function calculateTokenApproximation(content) {
  if (!content) return 1;
  return Math.max(1, Math.floor(content.length / 4));
}

/**
 * Examples:
 * - 4 characters = 1 token (minimum)
 * - 20 characters = 5 tokens
 * - 100 characters = 25 tokens
 * - 1000 characters = 250 tokens
 */

/**
 * Fetch the current token balance for a node
 * @param {Object} nftContract - The NFT contract instance
 * @param {string} nodeId - The node ID to get balance for
 * @returns {Promise<number>} - The current token balance
 */
export async function getNodeTokenBalance(nftContract, nodeId) {
  try {
    if (!nftContract || !nodeId) {
      return 0;
    }
    
    const balance = await nftContract.getNodeTokenBalance(nodeId);
    return Number(balance);
  } catch (error) {
    console.error('Error fetching node token balance:', error);
    return 0;
  }
}