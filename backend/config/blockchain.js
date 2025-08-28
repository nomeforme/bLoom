const { ethers } = require('ethers');
require('dotenv').config();

// Blockchain setup
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || 'http://localhost:8545');
const privateKey = process.env.PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const wallet = new ethers.Wallet(privateKey, provider);

// Contract addresses
const FACTORY_ADDRESS = process.env.FACTORY_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3";

// Contract ABIs
const FACTORY_ABI = [
  "function createTree(string memory rootContent, uint256 rootTokenSupply) external returns (address)",
  "function getTree(bytes32 treeId) external view returns (address)",
  "function getTreeNFTContract(bytes32 treeId) external view returns (address)",
  "event TreeCreated(bytes32 indexed treeId, address indexed treeAddress, address indexed nftContractAddress, address creator, string rootContent)"
];

const TREE_ABI = [
  "function addNode(bytes32 parentId, string memory content) external returns (bytes32)",
  "function addNodeDirect(bytes32 parentId, string memory content, bool createNFT) external returns (bytes32)",
  "function addNodeWithToken(bytes32 parentId, string memory content, string memory tokenName, string memory tokenSymbol) external returns (bytes32)",
  "function updateNodeContent(bytes32 nodeId, string memory newContent) external",
  "function getNode(bytes32 nodeId) external view returns (bytes32 id, bytes32 parentId, bytes32[] memory children, address author, uint256 timestamp, bool isRoot)",
  "function getNodeContent(bytes32 nodeId) external view returns (string memory)",
  "function nodeHasNFT(bytes32 nodeId) external view returns (bool)",
  "function getAllNodes() external view returns (bytes32[] memory)",
  "function getRootId() external view returns (bytes32)",
  "function getNodeCount() external view returns (uint256)",
  "function getNFTContract() external view returns (address)",
  "event NodeCreated(bytes32 indexed nodeId, bytes32 indexed parentId, address indexed author, uint256 timestamp)",
  "event NodeUpdated(bytes32 indexed nodeId, address indexed author)"
];

const NFT_ABI = [
  "function mintTokensToNode(bytes32 nodeId, uint256 amount, string memory reason) external",
  "function burnTokensFromNode(bytes32 nodeId, uint256 amount, string memory reason) external",
  "function getNodeTokenBalance(bytes32 nodeId) external view returns (uint256)",
  "function getTextContent(bytes32 nodeId) external view returns (string memory)"
];

const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, wallet);

module.exports = {
  provider,
  wallet,
  factory,
  FACTORY_ADDRESS,
  FACTORY_ABI,
  TREE_ABI,
  NFT_ABI
};