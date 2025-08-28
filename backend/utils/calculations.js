/**
 * Helper function to calculate token supply approximation based on content length
 * Formula: Math.max(1, Math.floor(content.length / 4))
 * Used for split operations and direct text edits (not AI generation)
 * 
 * Examples:
 * - 4 characters = 1 token (minimum)
 * - 20 characters = 5 tokens  
 * - 100 characters = 25 tokens
 * - 1000 characters = 250 tokens
 * 
 * @param {string} content - The content to calculate tokens for
 * @returns {number} - The approximate number of tokens (minimum 1)
 */
function calculateTokenApproximation(content) {
  if (!content) return 1;
  return Math.max(1, Math.floor(content.length / 4));
}

module.exports = {
  calculateTokenApproximation
};