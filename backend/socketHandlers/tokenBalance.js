const { ethers } = require('ethers');
const { TREE_ABI, NFT_ABI } = require('../config/blockchain');
const { wallet } = require('../config/blockchain');

function handleTokenBalance(socket, io) {
  socket.on('getTokenBalance', async (data) => {
    try {
      const { treeAddress, nodeId } = data;
      
      if (!treeAddress || !nodeId) {
        socket.emit('tokenBalanceError', { error: 'Tree address and node ID are required' });
        return;
      }

      // Get the tree contract
      const treeContract = new ethers.Contract(treeAddress, TREE_ABI, wallet);
      
      // First check if the node has NFT/tokens
      const hasNFT = await treeContract.nodeHasNFT(nodeId);
      
      if (!hasNFT) {
        // Node is lightweight, doesn't have tokens
        socket.emit('tokenBalanceError', { error: 'No token exists for this node' });
        return;
      }
      
      // Check if the node has an NFT first
      const socketNodeHasNFT = await treeContract.nodeHasNFT(nodeId);
      
      if (socketNodeHasNFT) {
        // Get NFT contract address
        const nftContractAddress = await treeContract.getNFTContract();
        const nftContract = new ethers.Contract(nftContractAddress, NFT_ABI, wallet);
        
        // Get ERC20 contract and total supply (instead of TBA balance)
        const nodeTokenContract = await nftContract.getNodeTokenContractByNodeId(nodeId);
        const tokenContract = new ethers.Contract(nodeTokenContract, ['function totalSupply() view returns (uint256)'], wallet);
        const totalSupplyBigInt = await tokenContract.totalSupply();
        const balance = Number(totalSupplyBigInt) / Math.pow(10, 18); // Convert from wei to tokens
        
        socket.emit('tokenBalance', {
          balance,
          nodeId,
          treeAddress,
          timestamp: new Date().toISOString()
        });
      } else {
        // For lightweight nodes, emit balance of 0 or null
        socket.emit('tokenBalance', {
          balance: null,
          nodeId,
          treeAddress,
          timestamp: new Date().toISOString(),
          isLightweight: true
        });
      }
    } catch (error) {
      console.error('Error fetching token balance via socket:', error);
      socket.emit('tokenBalanceError', { error: error.message });
    }
  });
}

function handleReportGasCost(socket, io) {
  socket.on('reportGasCost', async (data) => {
    try {
      const { type, description, txHash, gasUsed, gasPrice, gasCost } = data;
      
      const gasData = {
        type,
        description,
        txHash,
        gasUsed,
        gasPrice,
        gasCost,
        timestamp: new Date().toISOString()
      };

      // Emit to all connected clients (including the sender)
      io.emit('gasCost', gasData);
      console.log(`⛽ Gas reported from frontend: ${type} - ${gasCost} ETH`);
    } catch (error) {
      console.error('Error processing gas cost report:', error);
    }
  });
}

module.exports = {
  handleTokenBalance,
  handleReportGasCost
};