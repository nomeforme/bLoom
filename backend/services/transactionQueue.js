const { wallet } = require('../config/blockchain');

// Transaction queue to prevent nonce conflicts
let transactionQueue = Promise.resolve();
let lastUsedNonce = null;

/**
 * Get the next nonce for transactions
 * @returns {Promise<number>} - The next nonce to use
 */
async function getNextNonce() {
  const currentNonce = await wallet.getNonce('pending');
  
  // If we have a last used nonce and the blockchain nonce is behind, use our tracked nonce
  if (lastUsedNonce !== null && currentNonce <= lastUsedNonce) {
    lastUsedNonce = lastUsedNonce + 1;
    console.log(`Using tracked nonce: ${lastUsedNonce} (blockchain nonce: ${currentNonce})`);
    return lastUsedNonce;
  }
  
  lastUsedNonce = currentNonce;
  console.log(`Using blockchain nonce: ${currentNonce}`);
  return currentNonce;
}

/**
 * Queue a transaction to prevent nonce conflicts
 * @param {Function} transactionFn - Function that returns a transaction promise
 * @returns {Promise} - Promise that resolves when the transaction is complete
 */
async function queueTransaction(transactionFn) {
  return new Promise((resolve, reject) => {
    transactionQueue = transactionQueue.then(async () => {
      try {
        let retries = 3;
        let result;
        
        while (retries > 0) {
          try {
            const nonce = await getNextNonce();
            result = await transactionFn(nonce);
            break; // Success, exit retry loop
          } catch (error) {
            if (error.code === 'NONCE_EXPIRED' && retries > 1) {
              console.log(`Nonce expired, retrying... (${retries - 1} retries left)`);
              lastUsedNonce = null; // Reset nonce tracking
              await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
              retries--;
            } else {
              throw error;
            }
          }
        }
        
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }).catch((error) => {
      // Don't let one failed transaction break the queue
      console.error('Transaction in queue failed:', error);
    });
  });
}

module.exports = {
  queueTransaction
};