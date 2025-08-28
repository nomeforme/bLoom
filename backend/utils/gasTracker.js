const { ethers } = require('ethers');

/**
 * Helper function to calculate and emit gas costs for transactions
 * @param {Object} receipt - Transaction receipt 
 * @param {string} type - Type of transaction (e.g., "Tree Creation", "Node Creation", "Node Update")
 * @param {string} description - Description of the transaction
 * @param {Object} io - Socket.io instance to emit to all clients
 */
async function emitGasCost(receipt, type, description, io) {
  try {
    if (!receipt || !receipt.gasUsed) {
      console.warn('Invalid receipt for gas calculation:', receipt);
      return;
    }

    const gasUsed = receipt.gasUsed;
    const gasPrice = receipt.gasPrice;
    const gasCost = gasPrice ? ethers.formatEther(gasUsed * gasPrice) : null;

    const gasData = {
      type,
      description,
      txHash: receipt.hash,
      gasUsed: gasUsed.toString(),
      gasPrice: gasPrice?.toString(),
      gasCost: gasCost || '0',
      blockNumber: receipt.blockNumber,
      timestamp: new Date().toISOString()
    };

    // Emit to all connected clients
    io.emit('gasCost', gasData);
    console.log(`⛽ Gas tracked: ${type} - ${gasCost || 'N/A'} ETH (${gasUsed.toLocaleString()} gas)`);
  } catch (error) {
    console.error('Error calculating gas cost:', error);
  }
}

module.exports = {
  emitGasCost
};