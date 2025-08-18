// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../LoomFactory.sol";
import "../LoomTree.sol";
import "../LoomNodeNFT.sol";

contract LoomTest is Test {
    LoomFactory public factory;
    LoomTree public tree;
    address public user1;
    address public user2;

    function setUp() public {
        factory = new LoomFactory();
        user1 = address(0x1);
        user2 = address(0x2);
        vm.deal(user1, 1 ether);
        vm.deal(user2, 1 ether);
    }
    
    // Helper function to get NFT contract for a user's first tree
    function getNFTContractForUser(address user) internal view returns (LoomNodeNFT) {
        bytes32[] memory userTrees = factory.getUserTrees(user);
        require(userTrees.length > 0, "User has no trees");
        bytes32 treeId = userTrees[0];
        return LoomNodeNFT(factory.getTreeNFTContract(treeId));
    }

    function testCreateTree() public {
        vm.prank(user1);
        address treeAddress = factory.createTree("Once upon a time...");
        
        assertTrue(treeAddress != address(0));
        
        bytes32[] memory userTrees = factory.getUserTrees(user1);
        assertEq(userTrees.length, 1);
        
        bytes32[] memory allTrees = factory.getAllTrees();
        assertEq(allTrees.length, 1);
    }

    function testAddNode() public {
        vm.prank(user1);
        address treeAddress = factory.createTree("Root content");
        
        LoomTree treeContract = LoomTree(treeAddress);
        bytes32 rootId = treeContract.getRootId();
        
        vm.prank(user1);
        bytes32 childId = treeContract.addNode(rootId, "Child content");
        
        assertTrue(childId != bytes32(0));
        
        (
            bytes32 id,
            bytes32 parentId,
            bytes32[] memory children,
            address author,
            uint256 timestamp,
            bool isRoot
        ) = treeContract.getNode(childId);
        
        assertEq(id, childId);
        assertEq(parentId, rootId);
        assertEq(author, user1);
        assertFalse(isRoot);
        
        // Check content is stored in NFT
        LoomNodeNFT nftContract = getNFTContractForUser(user1);
        string memory nftContent = nftContract.getNodeContent(childId);
        assertTrue(bytes(nftContent).length > 0);
    }

    function testMultipleChildren() public {
        vm.prank(user1);
        address treeAddress = factory.createTree("Root");
        
        LoomTree treeContract = LoomTree(treeAddress);
        bytes32 rootId = treeContract.getRootId();
        
        // Add multiple children
        vm.prank(user1);
        bytes32 child1 = treeContract.addNode(rootId, "Child 1");
        
        vm.prank(user2);
        bytes32 child2 = treeContract.addNode(rootId, "Child 2");
        
        vm.prank(user1);
        treeContract.addNode(rootId, "Child 3");
        
        // Check root has all children
        bytes32[] memory rootChildren = treeContract.getChildren(rootId);
        assertEq(rootChildren.length, 3);
        
        // Verify children authors
        (, , , address author1, ,) = treeContract.getNode(child1);
        assertEq(author1, user1);
        
        (, , , address author2, ,) = treeContract.getNode(child2);
        assertEq(author2, user2);
        
        // Verify content is stored in NFT
        LoomNodeNFT nftContract = getNFTContractForUser(user1);
        string memory content1 = nftContract.getNodeContent(child1);
        string memory content2 = nftContract.getNodeContent(child2);
        assertTrue(bytes(content1).length > 0);
        assertTrue(bytes(content2).length > 0);
    }

    function testNodeMetadata() public {
        vm.prank(user1);
        address treeAddress = factory.createTree("Root");
        
        LoomTree treeContract = LoomTree(treeAddress);
        bytes32 rootId = treeContract.getRootId();
        
        vm.prank(user1);
        bytes32 nodeId = treeContract.addNode(rootId, "Test node");
        
        // Set metadata
        vm.prank(user1);
        treeContract.setNodeMetadata(nodeId, "category", "important");
        
        vm.prank(user1);
        treeContract.setNodeMetadata(nodeId, "tag", "action");
        
        // Check metadata
        string memory category = treeContract.getNodeMetadata(nodeId, "category");
        assertEq(category, "important");
        
        string memory tag = treeContract.getNodeMetadata(nodeId, "tag");
        assertEq(tag, "action");
        
        string[] memory keys = treeContract.getNodeMetadataKeys(nodeId);
        assertEq(keys.length, 2);
    }

    function testUnauthorizedMetadataUpdate() public {
        vm.prank(user1);
        address treeAddress = factory.createTree("Root");
        
        LoomTree treeContract = LoomTree(treeAddress);
        bytes32 rootId = treeContract.getRootId();
        
        vm.prank(user1);
        bytes32 nodeId = treeContract.addNode(rootId, "User1 node");
        
        // User2 tries to set metadata on User1's node
        vm.prank(user2);
        vm.expectRevert("Not authorized to update this node");
        treeContract.setNodeMetadata(nodeId, "category", "hacked");
    }

    function testTreeStats() public {
        vm.prank(user1);
        address treeAddress = factory.createTree("Root");
        
        LoomTree treeContract = LoomTree(treeAddress);
        bytes32 rootId = treeContract.getRootId();
        
        // Initially should have 1 node (root)
        assertEq(treeContract.getNodeCount(), 1);
        
        // Add some nodes
        vm.prank(user1);
        treeContract.addNode(rootId, "Child 1");
        
        vm.prank(user1);
        treeContract.addNode(rootId, "Child 2");
        
        assertEq(treeContract.getNodeCount(), 3);
        
        bytes32[] memory allNodes = treeContract.getAllNodes();
        assertEq(allNodes.length, 3);
    }

    function testNodeNFTMinting() public {
        vm.prank(user1);
        address treeAddress = factory.createTree("Root content");
        
        LoomTree treeContract = LoomTree(treeAddress);
        LoomNodeNFT nftContract = getNFTContractForUser(user1);
        bytes32 rootId = treeContract.getRootId();
        
        // Check that root node has NFT
        uint256 rootTokenId = nftContract.getTokenIdFromNodeId(rootId);
        assertTrue(rootTokenId > 0);
        assertEq(nftContract.ownerOf(rootTokenId), user1);
        
        // Add a child node and check NFT is minted
        vm.prank(user2);
        bytes32 childId = treeContract.addNode(rootId, "Child content");
        
        uint256 childTokenId = nftContract.getTokenIdFromNodeId(childId);
        assertTrue(childTokenId > 0);
        assertEq(nftContract.ownerOf(childTokenId), user2);
        
        // Check total supply
        assertEq(nftContract.totalSupply(), 2);
    }

    function testNFTMetadata() public {
        vm.prank(user1);
        address treeAddress = factory.createTree("Test content for NFT");
        
        LoomTree treeContract = LoomTree(treeAddress);
        LoomNodeNFT nftContract = getNFTContractForUser(user1);
        bytes32 rootId = treeContract.getRootId();
        
        uint256 tokenId = nftContract.getTokenIdFromNodeId(rootId);
        string memory tokenURI = nftContract.tokenURI(tokenId);
        
        // Should contain node information in metadata
        assertTrue(bytes(tokenURI).length > 0);
        
        // Check reverse mapping
        bytes32 nodeIdFromToken = nftContract.getNodeIdFromTokenId(tokenId);
        assertEq(nodeIdFromToken, rootId);
    }

    function testMultipleNFTs() public {
        vm.prank(user1);
        address treeAddress = factory.createTree("Root");
        
        LoomTree treeContract = LoomTree(treeAddress);
        LoomNodeNFT nftContract = getNFTContractForUser(user1);
        bytes32 rootId = treeContract.getRootId();
        
        // Create multiple nodes
        vm.prank(user1);
        bytes32 child1 = treeContract.addNode(rootId, "Child 1");
        
        vm.prank(user2);
        bytes32 child2 = treeContract.addNode(rootId, "Child 2");
        
        vm.prank(user1);
        bytes32 child3 = treeContract.addNode(child1, "Grandchild");
        
        // Check NFT ownership
        assertEq(nftContract.ownerOf(nftContract.getTokenIdFromNodeId(rootId)), user1);
        assertEq(nftContract.ownerOf(nftContract.getTokenIdFromNodeId(child1)), user1);
        assertEq(nftContract.ownerOf(nftContract.getTokenIdFromNodeId(child2)), user2);
        assertEq(nftContract.ownerOf(nftContract.getTokenIdFromNodeId(child3)), user1);
        
        // Check total supply
        assertEq(nftContract.totalSupply(), 4);
    }
}