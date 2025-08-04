// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract LoomTree {
    struct Node {
        bytes32 id;
        bytes32 parentId;
        string content;
        bytes32[] children;
        address author;
        uint256 timestamp;
        bool isRoot;
        mapping(string => string) metadata;
        string[] metadataKeys;
    }
    
    mapping(bytes32 => Node) public nodes;
    bytes32[] public allNodes;
    bytes32 public rootId;
    address public treeOwner;
    
    event NodeCreated(
        bytes32 indexed nodeId,
        bytes32 indexed parentId,
        string content,
        address indexed author,
        uint256 timestamp
    );
    
    event NodeUpdated(
        bytes32 indexed nodeId,
        string newContent,
        address indexed author
    );
    
    event MetadataSet(
        bytes32 indexed nodeId,
        string key,
        string value
    );
    
    modifier onlyOwner() {
        require(msg.sender == treeOwner, "Only tree owner can perform this action");
        _;
    }
    
    constructor(string memory rootContent, address owner) {
        treeOwner = owner;
        rootId = _createNode(bytes32(0), rootContent, true);
    }
    
    function addNode(bytes32 parentId, string memory content) external returns (bytes32) {
        require(nodes[parentId].id != bytes32(0) || parentId == bytes32(0), "Parent node does not exist");
        return _createNode(parentId, content, false);
    }
    
    function _createNode(bytes32 parentId, string memory content, bool isRoot) internal returns (bytes32) {
        bytes32 nodeId = keccak256(abi.encodePacked(msg.sender, block.timestamp, content, parentId));
        
        Node storage newNode = nodes[nodeId];
        newNode.id = nodeId;
        newNode.parentId = parentId;
        newNode.content = content;
        newNode.author = msg.sender;
        newNode.timestamp = block.timestamp;
        newNode.isRoot = isRoot;
        
        allNodes.push(nodeId);
        
        if (!isRoot && parentId != bytes32(0)) {
            nodes[parentId].children.push(nodeId);
        }
        
        emit NodeCreated(nodeId, parentId, content, msg.sender, block.timestamp);
        
        return nodeId;
    }
    
    function updateNodeContent(bytes32 nodeId, string memory newContent) external {
        require(nodes[nodeId].id != bytes32(0), "Node does not exist");
        require(nodes[nodeId].author == msg.sender || msg.sender == treeOwner, "Not authorized to update this node");
        
        nodes[nodeId].content = newContent;
        emit NodeUpdated(nodeId, newContent, msg.sender);
    }
    
    function setNodeMetadata(bytes32 nodeId, string memory key, string memory value) external {
        require(nodes[nodeId].id != bytes32(0), "Node does not exist");
        require(nodes[nodeId].author == msg.sender || msg.sender == treeOwner, "Not authorized to update this node");
        
        // Check if key already exists
        bool keyExists = false;
        for (uint i = 0; i < nodes[nodeId].metadataKeys.length; i++) {
            if (keccak256(bytes(nodes[nodeId].metadataKeys[i])) == keccak256(bytes(key))) {
                keyExists = true;
                break;
            }
        }
        
        if (!keyExists) {
            nodes[nodeId].metadataKeys.push(key);
        }
        
        nodes[nodeId].metadata[key] = value;
        emit MetadataSet(nodeId, key, value);
    }
    
    function getNode(bytes32 nodeId) external view returns (
        bytes32 id,
        bytes32 parentId,
        string memory content,
        bytes32[] memory children,
        address author,
        uint256 timestamp,
        bool isRoot
    ) {
        Node storage node = nodes[nodeId];
        return (
            node.id,
            node.parentId,
            node.content,
            node.children,
            node.author,
            node.timestamp,
            node.isRoot
        );
    }
    
    function getNodeMetadata(bytes32 nodeId, string memory key) external view returns (string memory) {
        return nodes[nodeId].metadata[key];
    }
    
    function getNodeMetadataKeys(bytes32 nodeId) external view returns (string[] memory) {
        return nodes[nodeId].metadataKeys;
    }
    
    function getChildren(bytes32 nodeId) external view returns (bytes32[] memory) {
        return nodes[nodeId].children;
    }
    
    function getAllNodes() external view returns (bytes32[] memory) {
        return allNodes;
    }
    
    function getNodeCount() external view returns (uint256) {
        return allNodes.length;
    }
    
    function getRootId() external view returns (bytes32) {
        return rootId;
    }
}