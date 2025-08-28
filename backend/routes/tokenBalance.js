const express = require('express');
const { ethers } = require('ethers');
const { TREE_ABI, NFT_ABI } = require('../config/blockchain');
const { wallet } = require('../config/blockchain');
const router = express.Router();

// Get node token balance
router.get('/:treeAddress/:nodeId', async (req, res) => {
  try {
    const { treeAddress, nodeId } = req.params;
    
    if (!treeAddress || !nodeId) {
      return res.status(400).json({
        success: false,
        error: 'Tree address and node ID are required'
      });
    }

    // Get the tree contract
    const treeContract = new ethers.Contract(treeAddress, TREE_ABI, wallet);
    
    // Check if the node has an NFT first
    const apiNodeHasNFT = await treeContract.nodeHasNFT(nodeId);
    
    if (apiNodeHasNFT) {
      // Get NFT contract address
      const nftContractAddress = await treeContract.getNFTContract();
      const nftContract = new ethers.Contract(nftContractAddress, NFT_ABI, wallet);
      
      // Get current token balance
      const balanceBigInt = await nftContract.getNodeTokenBalance(nodeId);
      const balance = Number(balanceBigInt);
      
      res.json({
        success: true,
        balance,
        nodeId,
        treeAddress,
        timestamp: new Date().toISOString()
      });
    } else {
      // For lightweight nodes, return null balance
      res.json({
        success: true,
        balance: null,
        nodeId,
        treeAddress,
        timestamp: new Date().toISOString(),
        isLightweight: true
      });
    }
  } catch (error) {
    console.error('Error fetching token balance:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;