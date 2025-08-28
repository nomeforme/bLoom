const { factory } = require('../config/blockchain');

// Listen for blockchain events
async function setupBlockchainListeners(io) {
  try {
    // Listen for TreeCreated events
    factory.on('TreeCreated', (treeId, treeAddress, nftContractAddress, creator, rootContent) => {
      console.log('TreeCreated event:', { treeId, treeAddress, nftContractAddress, creator, rootContent });
      io.emit('treeCreated', {
        treeId,
        treeAddress,
        nftContractAddress,
        creator,
        rootContent,
        timestamp: Date.now()
      });
    });
    
    console.log('Blockchain event listeners set up successfully');
  } catch (error) {
    console.error('Error setting up blockchain listeners:', error);
  }
}

module.exports = {
  setupBlockchainListeners
};