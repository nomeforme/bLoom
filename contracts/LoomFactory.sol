// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./LoomTree.sol";
import "./LoomNodeNFT.sol";
import "./ERC6551Registry.sol";
import "./examples/simple/ERC6551Account.sol";

contract LoomFactory {
    mapping(bytes32 => address) public trees;
    mapping(address => bytes32[]) public userTrees;
    bytes32[] public allTrees;
    LoomNodeNFT public globalNFTContract;
    ERC6551Registry public registry;
    address public accountImplementation;
    bytes32 public constant SALT = keccak256("LoomNode");
    
    event TreeCreated(
        bytes32 indexed treeId,
        address indexed treeAddress,
        address indexed creator,
        string rootContent
    );
    
    constructor() {
        // Deploy ERC-6551 infrastructure
        registry = new ERC6551Registry();
        
        // Deploy account implementation
        ERC6551Account implementation = new ERC6551Account();
        accountImplementation = address(implementation);
        
        // Deploy global NFT contract with ERC-6551 support
        globalNFTContract = new LoomNodeNFT(
            address(registry),
            accountImplementation,
            SALT
        );
    }
    
    function createTree(string memory rootContent) external returns (address) {
        bytes32 treeId = keccak256(abi.encodePacked(msg.sender, block.timestamp, rootContent));
        
        LoomTree newTree = new LoomTree(rootContent, msg.sender, address(globalNFTContract));
        address treeAddress = address(newTree);
        
        // Authorize the new tree to mint NFTs
        globalNFTContract.addAuthorizedMinter(treeAddress);
        
        // Initialize the root node now that authorization is set up
        newTree.initializeRootNode(rootContent);
        
        trees[treeId] = treeAddress;
        userTrees[msg.sender].push(treeId);
        allTrees.push(treeId);
        
        emit TreeCreated(treeId, treeAddress, msg.sender, rootContent);
        
        return treeAddress;
    }
    
    function getTree(bytes32 treeId) external view returns (address) {
        return trees[treeId];
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
    
    function getGlobalNFTContract() external view returns (address) {
        return address(globalNFTContract);
    }
    
    function getRegistry() external view returns (address) {
        return address(registry);
    }
    
    function getAccountImplementation() external view returns (address) {
        return accountImplementation;
    }
    
    function getSalt() external pure returns (bytes32) {
        return SALT;
    }
}