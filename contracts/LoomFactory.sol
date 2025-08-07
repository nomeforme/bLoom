// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./LoomTree.sol";
import "./LoomNodeNFT.sol";

contract LoomFactory {
    mapping(bytes32 => address) public trees;
    mapping(address => bytes32[]) public userTrees;
    bytes32[] public allTrees;
    LoomNodeNFT public globalNFTContract;
    
    event TreeCreated(
        bytes32 indexed treeId,
        address indexed treeAddress,
        address indexed creator,
        string rootContent
    );
    
    constructor() {
        globalNFTContract = new LoomNodeNFT();
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
}