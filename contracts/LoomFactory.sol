// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "./LoomTree.sol";

contract LoomFactory {
    mapping(bytes32 => address) public trees;
    mapping(address => bytes32[]) public userTrees;
    bytes32[] public allTrees;
    
    event TreeCreated(
        bytes32 indexed treeId,
        address indexed treeAddress,
        address indexed creator,
        string rootContent
    );
    
    function createTree(string memory rootContent) external returns (address) {
        bytes32 treeId = keccak256(abi.encodePacked(msg.sender, block.timestamp, rootContent));
        
        LoomTree newTree = new LoomTree(rootContent, msg.sender);
        address treeAddress = address(newTree);
        
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
}