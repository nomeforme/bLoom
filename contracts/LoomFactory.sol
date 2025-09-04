// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./LoomTree.sol";
import "./LoomNodeNFT.sol";
import "./LoomNFTFactory.sol";
import "./ERC6551Registry.sol";
import "./examples/simple/ERC6551Account.sol";

contract LoomFactory {
    mapping(bytes32 => address) public trees;
    mapping(bytes32 => address) public treeNFTContracts;
    mapping(address => bytes32[]) public userTrees;
    bytes32[] public allTrees;
    LoomNFTFactory public nftFactory;
    bytes32 public constant SALT = keccak256("LoomNode");
    
    event TreeCreated(
        bytes32 indexed treeId,
        address indexed treeAddress,
        address indexed nftContractAddress,
        address creator,
        string rootContent
    );
    
    constructor() {
        // Deploy ERC-6551 infrastructure
        ERC6551Registry registry = new ERC6551Registry();
        
        // Deploy account implementation
        ERC6551Account implementation = new ERC6551Account();
        address accountImplementation = address(implementation);
        
        // Deploy NFT factory with ERC-6551 support
        nftFactory = new LoomNFTFactory(
            address(registry),
            accountImplementation,
            SALT
        );
    }
    
    function createTree(string memory rootContent, uint256 rootTokenSupply, string memory modelId, address creator) external returns (address) {
        bytes32 treeId = keccak256(abi.encodePacked(creator, block.timestamp, rootContent));
        
        // Create individual NFT contract for this tree using the NFT factory
        address nftContractAddress = nftFactory.createNFTContract(treeId);
        
        // Create the tree with its own NFT contract
        LoomTree newTree = new LoomTree(rootContent, creator, nftContractAddress);
        address treeAddress = address(newTree);
        
        // Authorize the new tree to mint NFTs on its own contract
        LoomNodeNFT(nftContractAddress).addAuthorizedMinter(treeAddress);
        
        // Initialize the root node with token supply from backend
        newTree.initializeRootNodeWithToken(rootContent, rootTokenSupply, modelId);
        
        // Store mappings
        trees[treeId] = treeAddress;
        treeNFTContracts[treeId] = nftContractAddress;
        userTrees[creator].push(treeId);
        allTrees.push(treeId);
        
        emit TreeCreated(treeId, treeAddress, nftContractAddress, creator, rootContent);
        
        return treeAddress;
    }
    
    function getTree(bytes32 treeId) external view returns (address) {
        return trees[treeId];
    }
    
    function getTreeNFTContract(bytes32 treeId) external view returns (address) {
        return treeNFTContracts[treeId];
    }
    
    function getUserTrees(address user) external view returns (bytes32[] memory) {
        return userTrees[user];
    }
    
    function getAllTrees() external view returns (bytes32[] memory) {
        return allTrees;
    }
    
    function getTreeCount() external view returns (uint256) {
        return allTrees.length;
    }
    
    function getNFTFactory() external view returns (address) {
        return address(nftFactory);
    }
    
    function getSalt() external pure returns (bytes32) {
        return SALT;
    }
}