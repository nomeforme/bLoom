// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "forge-std/Test.sol";
import "../LoomFactory.sol";
import "../LoomTree.sol";

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
            string memory content,
            bytes32[] memory children,
            address author,
            uint256 timestamp,
            bool isRoot
        ) = treeContract.getNode(childId);
        
        assertEq(id, childId);
        assertEq(parentId, rootId);
        assertEq(content, "Child content");
        assertEq(author, user1);
        assertFalse(isRoot);
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
        bytes32 child3 = treeContract.addNode(rootId, "Child 3");
        
        // Check root has all children
        bytes32[] memory rootChildren = treeContract.getChildren(rootId);
        assertEq(rootChildren.length, 3);
        
        // Verify children content and authors
        (, , string memory content1, , address author1, ,) = treeContract.getNode(child1);
        assertEq(content1, "Child 1");
        assertEq(author1, user1);
        
        (, , string memory content2, , address author2, ,) = treeContract.getNode(child2);
        assertEq(content2, "Child 2");
        assertEq(author2, user2);
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
}