const { ethers } = require('ethers');
const { getActiveChainConfig } = require('./chainConfig');
require('dotenv').config();

// Get active chain configuration
const chainConfig = getActiveChainConfig();

// Blockchain setup using dynamic configuration
const provider = new ethers.JsonRpcProvider(chainConfig.rpcUrl);
const privateKey = chainConfig.privateKey;
const wallet = new ethers.Wallet(privateKey, provider);

// Contract addresses from dynamic configuration
const FACTORY_ADDRESS = chainConfig.factoryAddress;

// Contract ABIs
const FACTORY_ABI = [
  "function createTree(string memory rootContent, uint256 rootTokenSupply, string memory modelId, address creator) external returns (address)",
  "function getTree(bytes32 treeId) external view returns (address)",
  "function getTreeNFTContract(bytes32 treeId) external view returns (address)",
  "event TreeCreated(bytes32 indexed treeId, address indexed treeAddress, address indexed nftContractAddress, address creator, string rootContent)"
];

const TREE_ABI = [
  "function addNode(bytes32 parentId, string memory content, bool createNFT, string memory modelId, address author) external returns (bytes32)",
  "function addNodeWithToken(bytes32 parentId, string memory content, string memory tokenName, string memory tokenSymbol, string memory modelId, address author) external returns (bytes32)",
  "function updateNodeContent(bytes32 nodeId, string memory newContent) external",
  "function getNode(bytes32 nodeId) external view returns (bytes32 id, bytes32 parentId, bytes32[] memory children, address author, uint256 timestamp, bool isRoot, string memory modelId)",
  "function getNodeContent(bytes32 nodeId) external view returns (string memory)",
  "function getNodeModelId(bytes32 nodeId) external view returns (string memory)",
  "function nodeHasNFT(bytes32 nodeId) external view returns (bool)",
  "function getAllNodes() external view returns (bytes32[] memory)",
  "function getRootId() external view returns (bytes32)",
  "function getNodeCount() external view returns (uint256)",
  "function getNFTContract() external view returns (address)",
  "event NodeCreated(bytes32 indexed nodeId, bytes32 indexed parentId, address indexed author, uint256 timestamp, bool hasNFT, string modelId, uint256 tokenId, address tokenBoundAccount, address nodeTokenContract)",
  "event NodeUpdated(bytes32 indexed nodeId, address indexed author, string modelId)"
];

const NFT_ABI = [
  "function mintTokensToNode(bytes32 nodeId, uint256 amount, string memory reason) external",
  "function burnTokensFromNode(bytes32 nodeId, uint256 amount, string memory reason) external",
  "function getNodeTokenBalance(bytes32 nodeId) external view returns (uint256)",
  "function getTextContent(bytes32 nodeId) external view returns (string memory)",
  "function getNodeTokenContractByNodeId(bytes32 nodeId) external view returns (address)"
];

const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, wallet);

module.exports = {
  TREE_ABI,
  provider,
  wallet,
  factory,
  FACTORY_ADDRESS,
  FACTORY_ABI,
  TREE_ABI,
  NFT_ABI
};